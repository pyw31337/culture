import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { Performance } from '../src/types';
import { atomicWriteJson } from './utils/scraper-utils';

const OUTPUT_FILE = path.join(process.cwd(), 'src/data/coex-exhibitions.json');
const BASE_URL = 'https://www.coex.co.kr';
const LIST_URL = `${BASE_URL}/event/full-schedules/`;
const PUBLIC_DIR = path.join(process.cwd(), 'public');

// Ensure directory exists
const ensureDir = (dir: string) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

/**
 * MD5 hash to safely create ascii-only filenames and IDs, preventing Next.js ByteString conversion error.
 */
function hashString(text: string): string {
    return crypto.createHash('md5').update(text).digest('hex').substring(0, 16);
}

/**
 * Downloads and processes an image, converting to WebP.
 */
async function processImage(url: string, filenameBase: string, subDir: string = 'posters/coex'): Promise<string> {
    if (!url) return '';
    if (url.startsWith('data:')) return url;

    const targetDir = path.join(PUBLIC_DIR, 'images', subDir);
    ensureDir(targetDir);

    try {
        const safeFilename = filenameBase.replace(/[^a-z0-9]/gi, '_').substring(0, 100);
        const relativePath = `/images/${subDir}/${safeFilename}.webp`;
        const absolutePath = path.join(targetDir, `${safeFilename}.webp`);

        if (fs.existsSync(absolutePath)) {
            return relativePath;
        }

        console.log(`[Coex Image] Downloading: ${url} -> ${relativePath}`);

        const response = await axios({
            url,
            method: 'GET',
            responseType: 'arraybuffer',
            headers: {
                'Referer': BASE_URL,
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 15000
        });

        await sharp(response.data)
            .resize({ width: 600, withoutEnlargement: true })
            .webp({ quality: 80 })
            .toFile(absolutePath);

        return relativePath;
    } catch (error: any) {
        console.error(`[Coex Image] Failed to process ${url}:`, error.message);
        return '';
    }
}

function formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}.${m}.${d}`;
}

/**
 * Crawls individual exhibition page to fetch high-res/official detail poster.
 */
async function fetchOfficialDetailPoster(url: string, fallbackImg: string): Promise<string> {
    if (!url) return fallbackImg;
    try {
        console.log(`[Coex Detail] Crawling details: ${url}`);
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });
        const $ = cheerio.load(response.data);

        // 1st Option: EventDetailThumbBox container image (Official poster placement)
        const thumbImg = $('.EventDetailThumbBox img').first().attr('src');
        if (thumbImg) {
            return thumbImg;
        }

        // 2nd Option: Body content images
        const bodyImg = $('.EventDetailBoxBody img').first().attr('src');
        if (bodyImg) {
            return bodyImg;
        }

        // 3rd Option: Any major uploads folder image in article
        const articleImg = $('article img').first().attr('src');
        if (articleImg) {
            return articleImg;
        }
    } catch (e: any) {
        console.warn(`[Coex Detail] Failed to extract detail poster from ${url}, using list thumbnail fallback:`, e.message);
    }
    return fallbackImg;
}

async function scrapeCoexExhibitions() {
    console.log('🚀 Starting COEX Exhibitions Scraper...');

    const today = new Date();
    const futureLimit = new Date();
    futureLimit.setMonth(today.getMonth() + 6); // Scrape 6 months into the future

    const startDateStr = formatDate(today);
    const endDateStr = formatDate(futureLimit);

    console.log(`Querying COEX exhibitions from ${startDateStr} to ${endDateStr}...`);

    try {
        const response = await axios.get(LIST_URL, {
            params: {
                search_start_date: startDateStr,
                search_end_date: endDateStr
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 20000
        });

        const $ = cheerio.load(response.data);
        const items: Performance[] = [];
        const seenIds = new Set<string>();

        const blogItems = $('.BlogPost-list .BlogPost-item').toArray();
        console.log(`Found ${blogItems.length} potential items in DOM list.`);

        for (const el of blogItems) {
            const linkEl = $(el).find('a.BlogEventItem-link');
            if (!linkEl.length) continue;

            const href = linkEl.attr('href') || '';
            if (!href) continue;

            // Generate clean ASCII-safe ID using MD5 hash of URL path to avoid character encoding bugs
            let slug = '';
            try {
                const parts = href.split('/exhibitions/');
                if (parts.length > 1) {
                    slug = parts[1].split('/')[0];
                } else {
                    slug = href.split('/').filter(Boolean).pop() || '';
                }
            } catch (e) {
                slug = Math.random().toString(36).substring(7);
            }

            const cleanHash = hashString(decodeURIComponent(slug));
            const id = `coex_${cleanHash}`;

            if (seenIds.has(id)) continue;
            seenIds.add(id);

            const title = $(el).find('.BlogEventItemCont-tit').first().text().trim() || '코엑스 전시';
            const rawImg = $(el).find('.BlogEventItemHover img').attr('src') || '';
            const rawDate = $(el).find('.BlogEventItemCont-date').first().text().trim() || startDateStr;
            const hall = $(el).find('.BlogEventItemCont-hall').first().text().trim() || '전시장';

            // 1st Priority: Crawl the detail page to capture the real high-res poster image
            const officialImgUrl = await fetchOfficialDetailPoster(href, rawImg);
            const localImagePath = officialImgUrl ? await processImage(officialImgUrl, id) : '';

            // Clean date to standard format (2026.07.06 - 2026.07.11) -> (2026.07.06 ~ 2026.07.11)
            const dateStr = rawDate.replace(/\s*-\s*/g, ' ~ ').trim();

            const perf: Performance = {
                id,
                title,
                venue: `코엑스 ${hall}`,
                venueKey: `코엑스 ${hall}`,
                address: '서울 강남구 영동대로 513',
                lat: 37.5113,
                lng: 127.0598,
                region: 'seoul',
                date: dateStr,
                image: localImagePath || '/images/fallbacks/exhibition.jpg',
                poster: localImagePath || '/images/fallbacks/exhibition.jpg',
                backupPoster: localImagePath || '/images/fallbacks/exhibition.jpg',
                link: href,
                genre: 'exhibition',
                category: '전시',
                price: '상세페이지 참고',
                priceDetail: '상세페이지 참고',
                contact: '02-6000-0114',
                website: 'https://www.coex.co.kr/',
                source: 'coex',
                dataCollectedAt: new Date().toISOString()
            };

            items.push(perf);
        }

        console.log(`Successfully scraped ${items.length} unique COEX exhibitions.`);

        // Atomic write to prevent file corruption
        atomicWriteJson(OUTPUT_FILE, items);
        console.log(`Saved entries to ${OUTPUT_FILE}`);

    } catch (error: any) {
        console.error('Failed to scrape COEX exhibitions:', error.message);
    }
}

scrapeCoexExhibitions();
