import axios from 'axios';
import * as cheerio from 'cheerio';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { Performance } from '../src/types';
import { atomicWriteJson } from './utils/scraper-utils';

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const OUTPUT_FILE = path.join(process.cwd(), 'src/data/klook-deals.json');
const BASE_URL = 'https://www.dailyhotel.com';

const ensureDir = (dir: string) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};

function hashString(text: string): string {
    return crypto.createHash('md5').update(text).digest('hex').substring(0, 16);
}

/**
 * Static lookup for famous hot deal locations.
 */
const HOTDEAL_GEO_LOOKUP: Record<string, { address: string; lat: number; lng: number; region: string }> = {
    "서울스카이": { address: "서울 송파구 올림픽로 300 롯데월드타워", lat: 37.5126, lng: 127.1025, region: "seoul" },
    "전망대": { address: "서울 송파구 올림픽로 300 롯데월드타워", lat: 37.5126, lng: 127.1025, region: "seoul" },
    "아쿠아리움": { address: "서울 강남구 영동대로 513 코엑스아쿠아리움", lat: 37.5126, lng: 127.0589, region: "seoul" },
    "서울랜드": { address: "경기 과천시 광명로 181", lat: 37.4363, lng: 127.0210, region: "gyeonggi" },
    "롯데월드": { address: "서울 송파구 올림픽로 240", lat: 37.5111, lng: 127.0982, region: "seoul" },
    "캐리비안베이": { address: "경기 용인시 처인구 포곡읍 에버랜드로 199", lat: 37.2939, lng: 127.2026, region: "gyeonggi" },
    "에버랜드": { address: "경기 용인시 처인구 포곡읍 에버랜드로 199", lat: 37.2939, lng: 127.2026, region: "gyeonggi" },
    "스누피가든": { address: "제주 제주시 구좌읍 금백조로 930", lat: 33.4635, lng: 126.7951, region: "jeju" },
    "아르떼뮤지엄": { address: "제주 제주시 애월읍 어림비로 478", lat: 33.3968, lng: 126.3572, region: "jeju" },
    "하리보": { address: "제주 제주시 아라일동 2380-4", lat: 33.4735, lng: 126.5492, region: "jeju" },
    "이월드": { address: "대구 달서구 두류공원로 200", lat: 35.8537, lng: 128.5645, region: "daegu" },
    "경주월드": { address: "경북 경주시 보문로 544", lat: 35.8372, lng: 129.2825, region: "gyeongbuk" },
    "블루캐니언": { address: "강원 평창군 봉평면 태기로 174", lat: 37.5818, lng: 128.3275, region: "gangwon" },
    "휘닉스파크": { address: "강원 평창군 봉평면 태기로 174", lat: 37.5818, lng: 128.3275, region: "gangwon" }
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

        console.log(`[Hotdeals Image] Downloading: ${url} -> ${relativePath}`);

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
        console.error(`[Hotdeals Image] Failed to process ${url}:`, error.message);
        return '';
    }
}

async function scrapeHotdeals() {
    console.log('🚀 Starting Leisure Hotdeals Scraper...');
    const items: Performance[] = [];
    const seen = new Set<string>();

    try {
        const res = await axios.get(`${BASE_URL}/leisure`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 20000
        });

        const $ = cheerio.load(res.data);
        const cards = $('a[href*="/leisure/"]').toArray();
        console.log(`[Hotdeals] Found ${cards.length} leisure links in DOM.`);

        for (const card of cards) {
            const href = $(card).attr('href') || '';
            const match = href.match(/leisure\/(\d+)/);
            if (!match) continue;
            const dealId = match[1];
            const id = `klook_deal_${dealId}`; // Keep klook_deal prefix as registered

            if (seen.has(id)) continue;
            seen.add(id);

            const title = $(card).find('div').eq(1).text().trim() || '레저 핫딜 상품';
            const rawImg = $(card).find('img').attr('src') || '';

            // Skip invalid items
            if (!title || title.includes('레저') && title.length < 5) continue;

            const cardText = $(card).text().trim().replace(/\s+/g, ' ');
            
            // Extract discount & price
            const discountMatch = cardText.match(/(\d+)%/);
            const discount = discountMatch ? `${discountMatch[1]}%` : '';

            const priceMatch = cardText.match(/([\d,]+)\s*원/);
            const priceVal = priceMatch ? priceMatch[1] : '';
            const price = priceVal ? `${priceVal}원~` : '할인가 참고';

            const priceDetail = discount ? `${price} (${discount} 할인 핫딜)` : price;

            // Geolocation and Region Mapping
            let region = 'seoul';
            let lat = REGION_GEO_FALLBACKS[region].lat;
            let lng = REGION_GEO_FALLBACKS[region].lng;
            let address = '상세페이지 참고';
            let venue = '레저 및 체험 전용관';

            // Check if title or brackets has region name
            if (title.includes('제주')) region = 'jeju';
            else if (title.includes('강릉') || title.includes('속초') || title.includes('강원')) region = 'gangwon';
            else if (title.includes('부산')) region = 'busan';
            else if (title.includes('대구')) region = 'daegu';
            else if (title.includes('경주')) region = 'gyeongbuk';
            else if (title.includes('에버랜드') || title.includes('캐리비안베이') || title.includes('서울랜드') || title.includes('경기')) region = 'gyeonggi';

            lat = REGION_GEO_FALLBACKS[region].lat;
            lng = REGION_GEO_FALLBACKS[region].lng;
            address = `${region.toUpperCase()} 관광 명소`;

            // Static lookup matching
            for (const key of Object.keys(HOTDEAL_GEO_LOOKUP)) {
                if (title.includes(key)) {
                    const lookup = HOTDEAL_GEO_LOOKUP[key];
                    address = lookup.address;
                    lat = lookup.lat;
                    lng = lookup.lng;
                    region = lookup.region;
                    venue = key;
                    break;
                }
            }

            // Image process
            const localImage = rawImg ? await processImage(rawImg, id, 'posters/hotdeals') : '';

            // Dates: valid for this year
            const year = new Date().getFullYear();
            const dateStr = `${year}.01.01 ~ ${year}.12.31`;

            const perf: Performance = {
                id,
                title: `[핫딜] ${title}`,
                venue,
                venueKey: venue,
                address,
                lat,
                lng,
                region,
                date: dateStr,
                image: localImage || '',
                poster: localImage || '',
                backupPoster: localImage || '',
                link: href,
                genre: 'tourism', // map to tourism so they show up under travel/activities
                category: '여행',
                price,
                priceDetail,
                contact: '1544-6663', // Yanolja/Dailyhotel CS
                website: 'https://www.dailyhotel.com/',
                source: 'klook-deal',
                description: `${title} - 스페셜 할인 핫딜 상품! 할인율: ${discount || '특가'}.`,
                dataCollectedAt: new Date().toISOString()
            };

            items.push(perf);
        }

        console.log(`[Hotdeals] Successfully scraped ${items.length} hot deals.`);
        atomicWriteJson(OUTPUT_FILE, items);
        console.log(`Saved entries to ${OUTPUT_FILE}`);
    } catch (e: any) {
        console.error('Failed to scrape Hotdeals:', e.message);
    }
}

scrapeHotdeals();
