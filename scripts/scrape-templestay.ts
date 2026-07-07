import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { Performance } from '../src/types';
import { atomicWriteJson } from './utils/scraper-utils';

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const OUTPUT_FILE = path.join(process.cwd(), 'src/data/templestays.json');
const BASE_URL = 'https://www.templestay.com';

const ensureDir = (dir: string) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

function hashString(text: string): string {
    return crypto.createHash('md5').update(text).digest('hex').substring(0, 16);
}

/**
 * Static lookup table for coordinates of famous Korean temples to bypass external geocoding API dependencies.
 */
const TEMPLE_GEO_LOOKUP: Record<string, { lat: number; lng: number }> = {
    "동화사": { lat: 35.9613, lng: 128.7022 },
    "조계사": { lat: 37.5736, lng: 126.9823 },
    "진관사": { lat: 37.6338, lng: 126.9388 },
    "봉은사": { lat: 37.5144, lng: 127.0573 },
    "불국사": { lat: 35.7900, lng: 129.3320 },
    "범어사": { lat: 35.2838, lng: 129.0683 },
    "해인사": { lat: 35.7904, lng: 128.0983 },
    "통도사": { lat: 35.4842, lng: 129.0642 },
    "화엄사": { lat: 35.2572, lng: 127.4983 },
    "송광사": { lat: 34.9958, lng: 127.3292 },
    "백양사": { lat: 35.4372, lng: 126.8839 },
    "금산사": { lat: 35.7361, lng: 127.0219 },
    "낙산사": { lat: 38.1251, lng: 128.6281 },
    "백담사": { lat: 38.1722, lng: 128.3719 },
    "월정사": { lat: 37.7314, lng: 128.5867 },
    "법주사": { lat: 36.5417, lng: 127.8389 },
    "마곡사": { lat: 36.5583, lng: 127.0122 },
    "수덕사": { lat: 36.6617, lng: 126.6214 },
    "전등사": { lat: 37.6325, lng: 126.4842 },
    "국제선센터": { lat: 37.5255, lng: 126.8732 },
    "묘각사": { lat: 37.5752, lng: 127.0173 },
    "화계사": { lat: 37.6335, lng: 127.0098 },
    "선운사": { lat: 35.4950, lng: 126.5817 },
    "내소사": { lat: 35.6322, lng: 126.7997 },
    "쌍계사": { lat: 35.2344, lng: 127.6432 },
    "대흥사": { lat: 34.4758, lng: 126.6203 },
    "미황사": { lat: 34.3828, lng: 126.5273 },
    "골굴사": { lat: 35.8364, lng: 129.4128 },
    "기림사": { lat: 35.8423, lng: 129.3982 }
};

const REGION_GEO_FALLBACKS: Record<string, { lat: number; lng: number }> = {
    "seoul": { lat: 37.5665, lng: 126.9780 },
    "gyeonggi": { lat: 37.2636, lng: 127.0286 },
    "incheon": { lat: 37.4563, lng: 126.7052 },
    "busan": { lat: 35.1796, lng: 129.0756 },
    "daegu": { lat: 35.8714, lng: 128.6014 },
    "gwangju": { lat: 35.1595, lng: 126.8526 },
    "daejeon": { lat: 36.3504, lng: 127.3845 },
    "ulsan": { lat: 35.5389, lng: 129.3114 },
    "sejong": { lat: 36.4801, lng: 127.2890 },
    "gangwon": { lat: 37.8854, lng: 127.7298 },
    "chungbuk": { lat: 36.6356, lng: 127.4913 },
    "chungnam": { lat: 36.6588, lng: 126.6728 },
    "jeonbuk": { lat: 35.8206, lng: 127.1087 },
    "jeonnam": { lat: 34.8160, lng: 126.4629 },
    "gyeongbuk": { lat: 36.5760, lng: 128.5056 },
    "gyeongnam": { lat: 35.2383, lng: 128.6922 },
    "jeju": { lat: 33.4996, lng: 126.5312 }
};

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

        console.log(`[Templestay Image] Downloading: ${url} -> ${relativePath}`);

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
        console.error(`[Templestay Image] Failed to process ${url}:`, error.message);
        return '';
    }
}

async function scrapeTemplestay() {
    console.log('🚀 Starting Templestay Scraper...');
    const items: Performance[] = [];
    const seen = new Set<string>();

    try {
        // Scrape page 1 & 2
        for (let page = 1; page <= 2; page++) {
            console.log(`[Templestay] Fetching page ${page}...`);
            const res = await axios.get(`${BASE_URL}/fe/MI000000000000000062/templestay/prgList.do`, {
                params: {
                    pageIndex: String(page),
                    searchVoucher: 'Y',
                    search3dt: 'Y',
                    search4nr: 'Y',
                    searchSns: 'Y'
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 20000
            });

            const $ = cheerio.load(res.data);
            const listItems = $('.myplace_list li').toArray();
            console.log(`[Templestay] Found ${listItems.length} items on page ${page}`);

            for (const el of listItems) {
                const reserveBtn = $(el).find('a[href*="fncReserve"]').first();
                if (!reserveBtn.length) continue;

                const href = reserveBtn.attr('href') || '';
                // javascript:fncReserve('28808', 'Donghwasa');
                const match = href.match(/fncReserve\('(\d+)',\s*'([^']+)'\)/);
                if (!match) continue;
                const seq = match[1];
                const templeId = match[2];

                const id = `templestay_${seq}`;
                if (seen.has(id)) continue;
                seen.add(id);

                const title = $(el).find('.txt strong').text().trim().replace(/\s+/g, ' ');
                const description = $(el).find('.txt p').text().trim().replace(/\s+/g, ' ');
                const rawImg = $(el).find('.img img').attr('src') || '';

                // Extract address and contact info
                let rawAddress = '';
                let contact = '02-732-9925'; // Default Templestay support

                $(el).find('.txt .list ul li').each((i, li) => {
                    const text = $(li).text().trim();
                    if (text.includes('연락처') || text.match(/\d{2,4}-\d{3,4}-\d{4}/)) {
                        contact = text.replace(/연락처|:\s*/g, '').trim().split(' ')[0];
                    } else {
                        // Treat the other list item as address info
                        rawAddress = text;
                    }
                });

                // Address parsing (동화사, 대구광역시 동구 동화사1길 1 동화사 템플스테이)
                const addressParts = rawAddress.split(',');
                const templeNm = addressParts[0].trim() || '사찰';
                const address = (addressParts[1] || rawAddress).trim();

                // Map region from address
                let region = 'seoul';
                if (address.includes('서울')) region = 'seoul';
                else if (address.includes('경기')) region = 'gyeonggi';
                else if (address.includes('인천')) region = 'incheon';
                else if (address.includes('부산')) region = 'busan';
                else if (address.includes('대구')) region = 'daegu';
                else if (address.includes('광주')) region = 'gwangju';
                else if (address.includes('대전')) region = 'daejeon';
                else if (address.includes('울산')) region = 'ulsan';
                else if (address.includes('세종')) region = 'sejong';
                else if (address.includes('강원')) region = 'gangwon';
                else if (address.includes('충북') || address.includes('충청북도')) region = 'chungbuk';
                else if (address.includes('충남') || address.includes('충청남도')) region = 'chungnam';
                else if (address.includes('전북') || address.includes('전라북도')) region = 'jeonbuk';
                else if (address.includes('전남') || address.includes('전라남도')) region = 'jeonnam';
                else if (address.includes('경북') || address.includes('경상북도')) region = 'gyeongbuk';
                else if (address.includes('경남') || address.includes('경상남도')) region = 'gyeongnam';
                else if (address.includes('제주')) region = 'jeju';

                // Geolocation lookup
                let lat = REGION_GEO_FALLBACKS[region].lat;
                let lng = REGION_GEO_FALLBACKS[region].lng;
                if (TEMPLE_GEO_LOOKUP[templeNm]) {
                    lat = TEMPLE_GEO_LOOKUP[templeNm].lat;
                    lng = TEMPLE_GEO_LOOKUP[templeNm].lng;
                }

                // Process image
                const localImage = rawImg ? await processImage(rawImg, id, 'posters/templestay') : '';

                // Dates: year-round
                const year = new Date().getFullYear();
                const dateStr = `${year}.01.01 ~ ${year}.12.31`;

                const detailUrl = `${BASE_URL}/fe/MI000000000000000062/reserve/view.do?templestaySeq=${seq}&templeBookMarkId=${templeId}`;

                const perf: Performance = {
                    id,
                    title: `[템플스테이] ${title}`,
                    venue: templeNm,
                    venueKey: templeNm,
                    address: address || rawAddress || templeNm,
                    lat,
                    lng,
                    region,
                    date: dateStr,
                    image: localImage || '/images/fallbacks/activity.jpg',
                    poster: localImage || '/images/fallbacks/activity.jpg',
                    backupPoster: localImage || '/images/fallbacks/activity.jpg',
                    link: detailUrl,
                    genre: 'activity',
                    category: '액티비티',
                    price: '홈페이지 참고',
                    priceDetail: '홈페이지 참고',
                    contact,
                    website: 'https://www.templestay.com/',
                    source: 'templestay',
                    description,
                    dataCollectedAt: new Date().toISOString()
                };

                items.push(perf);
            }
        }

        console.log(`[Templestay] Successfully scraped ${items.length} programs.`);
        atomicWriteJson(OUTPUT_FILE, items);
        console.log(`Saved entries to ${OUTPUT_FILE}`);
    } catch (e: any) {
        console.error('Failed to scrape Templestay:', e.message);
    }
}

scrapeTemplestay();
