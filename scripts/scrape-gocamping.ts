import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { Performance } from '../src/types';
import { atomicWriteJson } from './utils/scraper-utils';

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const OUTPUT_FILE = path.join(process.cwd(), 'src/data/gocamping.json');
const BASE_URL = 'https://gocamping.or.kr';

const ensureDir = (dir: string) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

function hashString(text: string): string {
    return crypto.createHash('md5').update(text).digest('hex').substring(0, 16);
}

/**
 * Downloads and processes an image, converting to WebP.
 */
async function processImage(url: string, filenameBase: string, subDir: string): Promise<string> {
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

        console.log(`[GoCamping Image] Downloading: ${url} -> ${relativePath}`);

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
        console.error(`[GoCamping Image] Failed to process ${url}:`, error.message);
        return '';
    }
}

interface GoCampingDetail {
    lat: number;
    lng: number;
}

async function fetchGoCampingDetail(cNo: string): Promise<GoCampingDetail> {
    const detailUrl = `${BASE_URL}/bsite/camp/info/read.do?c_no=${cNo}`;
    try {
        const res = await axios.get(detailUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000
        });
        const $ = cheerio.load(res.data);
        
        let lat = 37.5665; // Default Seoul
        let lng = 126.9780;

        $('script').each((i, el) => {
            const html = $(el).html() || '';
            if (html.includes('lat') && html.includes('lng')) {
                const latMatch = html.match(/var lat = ["']([^"']+)["']/);
                const lngMatch = html.match(/var lng = ["']([^"']+)["']/);
                if (latMatch && latMatch[1]) {
                    lat = parseFloat(latMatch[1]);
                }
                if (lngMatch && lngMatch[1]) {
                    lng = parseFloat(lngMatch[1]);
                }
            }
        });

        return { lat, lng };
    } catch (e: any) {
        console.warn(`[GoCamping Detail] Failed to fetch coordinates for ${cNo}:`, e.message);
    }
    return { lat: 37.5665, lng: 126.9780 };
}

async function scrapeGoCamping() {
    console.log('🚀 Starting GoCamping Scraper...');
    const items: Performance[] = [];
    const seen = new Set<string>();

    try {
        // Scrape page 1 & 2
        for (let page = 1; page <= 2; page++) {
            console.log(`[GoCamping] Fetching page ${page}...`);
            const res = await axios.get(`${BASE_URL}/bsite/camp/info/list.do`, {
                params: {
                    pageIndex: String(page)
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 20000
            });

            const $ = cheerio.load(res.data);
            const listItems = $('.list-item').toArray();
            console.log(`[GoCamping] Found ${listItems.length} items on page ${page}`);

            for (const el of listItems) {
                const anchor = $(el).find('a[href*="c_no="]').first();
                if (!anchor.length) continue;

                const href = anchor.attr('href') || '';
                const cNoMatch = href.match(/c_no=(\d+)/);
                if (!cNoMatch) continue;
                const cNo = cNoMatch[1];
                const id = `gocamping_${cNo}`;

                if (seen.has(id)) continue;
                seen.add(id);

                // Raw title structure: [경상남도 사천시] 솔섬오토캠핑장
                const rawTitle = $(el).find('h2.subject').text().trim();
                const titleMatch = rawTitle.match(/\[(.*?)\]\s*(.*)/);
                const title = titleMatch ? titleMatch[2].trim() : rawTitle;
                const locationLabel = titleMatch ? titleMatch[1].trim() : '대한민국';

                // Map Region mapping
                let region = 'seoul';
                if (locationLabel.includes('서울')) region = 'seoul';
                else if (locationLabel.includes('경기')) region = 'gyeonggi';
                else if (locationLabel.includes('인천')) region = 'incheon';
                else if (locationLabel.includes('부산')) region = 'busan';
                else if (locationLabel.includes('대구')) region = 'daegu';
                else if (locationLabel.includes('광주')) region = 'gwangju';
                else if (locationLabel.includes('대전')) region = 'daejeon';
                else if (locationLabel.includes('울산')) region = 'ulsan';
                else if (locationLabel.includes('세종')) region = 'sejong';
                else if (locationLabel.includes('강원')) region = 'gangwon';
                else if (locationLabel.includes('충북') || locationLabel.includes('충청북도')) region = 'chungbuk';
                else if (locationLabel.includes('충남') || locationLabel.includes('충청남도')) region = 'chungnam';
                else if (locationLabel.includes('전북') || locationLabel.includes('전북특별자치도') || locationLabel.includes('전라북도')) region = 'jeonbuk';
                else if (locationLabel.includes('전남') || locationLabel.includes('전라남도')) region = 'jeonnam';
                else if (locationLabel.includes('경북') || locationLabel.includes('경상북도')) region = 'gyeongbuk';
                else if (locationLabel.includes('경남') || locationLabel.includes('경상남도')) region = 'gyeongnam';
                else if (locationLabel.includes('제주')) region = 'jeju';

                const summary = $(el).find('h3.summary').text().trim() || '고캠핑 등록 야영장';
                const description = $(el).find('p.content').text().trim() || summary;
                const address = $(el).find('.company a.address').text().trim().replace(/\s+/g, ' ');
                const contact = $(el).find('.company a.contact').text().trim() || '02-729-9100';

                // Image processing
                const rawImg = $(el).find('.img-box img').attr('src') || '';
                const imgUrl = rawImg ? (rawImg.startsWith('http') ? rawImg : `${BASE_URL}${rawImg}`) : '';
                const localImage = imgUrl ? await processImage(imgUrl, id, 'posters/gocamping') : '';

                // Fetch detail coordinate mapping
                const detail = await fetchGoCampingDetail(cNo);

                // For camping sites, we can set dates as year-round since they are open sites.
                const yearStr = new Date().getFullYear();
                const dateStr = `${yearStr}.01.01 ~ ${yearStr}.12.31`;

                const perf: Performance = {
                    id,
                    title,
                    venue: title,
                    venueKey: title,
                    address: address || locationLabel,
                    lat: detail.lat,
                    lng: detail.lng,
                    region,
                    date: dateStr,
                    image: localImage || '/images/fallbacks/activity.jpg',
                    poster: localImage || '/images/fallbacks/activity.jpg',
                    backupPoster: localImage || '/images/fallbacks/activity.jpg',
                    link: `${BASE_URL}${href}`,
                    genre: 'activity',
                    category: '액티비티',
                    price: '홈페이지 참고',
                    priceDetail: '홈페이지 참고',
                    contact,
                    website: 'https://gocamping.or.kr/',
                    source: 'gocamping',
                    description,
                    dataCollectedAt: new Date().toISOString()
                };

                items.push(perf);
            }
        }

        console.log(`[GoCamping] Successfully scraped ${items.length} campgrounds.`);
        atomicWriteJson(OUTPUT_FILE, items);
        console.log(`Saved entries to ${OUTPUT_FILE}`);
    } catch (e: any) {
        console.error('Failed to scrape GoCamping:', e.message);
    }
}

scrapeGoCamping();
