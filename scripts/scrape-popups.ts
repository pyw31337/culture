import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { Performance } from '../src/types';
import { atomicWriteJson } from './utils/scraper-utils';

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const OUTPUT_FILE = path.join(process.cwd(), 'src/data/popup-stores.json');
const BASE_URL = 'https://popga.co.kr';

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

        console.log(`[Popup Image] Downloading: ${url} -> ${relativePath}`);

        const response = await axios({
            url,
            method: 'GET',
            responseType: 'arraybuffer',
            headers: {
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
        console.error(`[Popup Image] Failed to process ${url}:`, error.message);
        return '';
    }
}

async function scrapePopups() {
    console.log('🚀 Starting Pop-up Stores Scraper...');
    const items: Performance[] = [];
    const seen = new Set<string>();

    try {
        const res = await axios.get(`${BASE_URL}/list/popup`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 20000
        });

        const $ = cheerio.load(res.data);
        let rawJson = '';

        $('script').each((i, el) => {
            const html = $(el).html() || '';
            if (html.includes('dehydratedAt') && html.includes('content')) {
                // Unescape Next.js string data
                const unescaped = html.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                const startIdx = unescaped.indexOf('{"state":');
                if (startIdx !== -1) {
                    let braceCount = 0;
                    let endIdx = -1;
                    for (let j = startIdx; j < unescaped.length; j++) {
                        if (unescaped[j] === '{') braceCount++;
                        else if (unescaped[j] === '}') {
                            braceCount--;
                            if (braceCount === 0) {
                                endIdx = j;
                                break;
                            }
                        }
                    }
                    if (endIdx !== -1) {
                        rawJson = unescaped.substring(startIdx, endIdx + 1);
                    }
                }
            }
        });

        if (!rawJson) {
            console.error('[Popup] Failed to extract dehydrated JSON cache from page.');
            return;
        }

        const parsed = JSON.parse(rawJson);
        const queries = parsed.state?.queries || [];
        const pages = queries[0]?.state?.data?.pages || [];
        const content = pages[0]?.data?.content || [];

        console.log(`[Popup] Found ${content.length} popup items in React Query cache.`);

        for (const item of content) {
            if (item.type !== 'STORE') continue;

            const id = `popup_${item.id}`;
            if (seen.has(id)) continue;
            seen.add(id);

            const title = item.title || '팝업스토어';
            const description = item.subTitle || item.tags?.join(', ') || '가볼만한 팝업스토어';
            
            // Format dates: 2026-07-09 -> 2026.07.09
            const openDate = (item.openDate || '').replace(/-/g, '.');
            const closeDate = (item.closeDate || '').replace(/-/g, '.');
            const dateStr = openDate && closeDate ? `${openDate} ~ ${closeDate}` : openDate || '상세정보 참고';

            const address = item.address || '서울시내';
            const lat = item.area?.latitude || 37.5665;
            const lng = item.area?.longitude || 126.9780;
            const region1 = item.area?.region1Depth || '서울';

            // Map region
            let region = 'seoul';
            if (region1.includes('서울')) region = 'seoul';
            else if (region1.includes('경기')) region = 'gyeonggi';
            else if (region1.includes('인천')) region = 'incheon';
            else if (region1.includes('부산')) region = 'busan';
            else if (region1.includes('대구')) region = 'daegu';
            else if (region1.includes('광주')) region = 'gwangju';
            else if (region1.includes('대전')) region = 'daejeon';
            else if (region1.includes('울산')) region = 'ulsan';
            else if (region1.includes('세종')) region = 'sejong';
            else if (region1.includes('강원')) region = 'gangwon';
            else if (region1.includes('충북') || region1.includes('충청북도')) region = 'chungbuk';
            else if (region1.includes('충남') || region1.includes('충청남도')) region = 'chungnam';
            else if (region1.includes('전북') || region1.includes('전라북도')) region = 'jeonbuk';
            else if (region1.includes('전남') || region1.includes('전라남도')) region = 'jeonnam';
            else if (region1.includes('경북') || region1.includes('경상북도')) region = 'gyeongbuk';
            else if (region1.includes('경남') || region1.includes('경상남도')) region = 'gyeongnam';
            else if (region1.includes('제주')) region = 'jeju';

            // Process image
            const rawImg = item.file?.path || '';
            const localImage = rawImg ? await processImage(rawImg, id, 'posters/popups') : '';

            // Construct detail link
            const detailUrl = `${BASE_URL}/popup/${item.id}`;

            const perf: Performance = {
                id,
                title,
                venue: address.split(' ')[2] ? `${address.split(' ')[1]} ${address.split(' ')[2]}` : address,
                venueKey: address,
                address,
                lat,
                lng,
                region,
                date: dateStr,
                image: localImage || '/images/fallbacks/exhibition.jpg',
                poster: localImage || '/images/fallbacks/exhibition.jpg',
                backupPoster: localImage || '/images/fallbacks/exhibition.jpg',
                link: detailUrl,
                genre: 'exhibition', // Map popups to exhibition so they integrate natively
                category: '전시',
                price: '무료',
                priceDetail: '무료 (상세내용 참고)',
                contact: '02-120', // Default Seoul Dasan call center
                website: 'https://popga.co.kr/',
                source: 'popup-store',
                description,
                dataCollectedAt: new Date().toISOString()
            };

            items.push(perf);
        }

        console.log(`[Popup] Successfully scraped ${items.length} popups.`);
        atomicWriteJson(OUTPUT_FILE, items);
        console.log(`Saved entries to ${OUTPUT_FILE}`);
    } catch (e: any) {
        console.error('Failed to scrape Popups:', e.message);
    }
}

scrapePopups();
