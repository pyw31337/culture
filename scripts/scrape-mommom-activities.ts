import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { promisify } from 'util';
import stream from 'stream';

const pipeline = promisify(stream.pipeline);

puppeteer.use(StealthPlugin());

const TARGET_URL = 'https://mom-mom.net/shop/categories/1102241';
const OUTPUT_FILE = path.resolve(process.cwd(), 'src/data/mommom-activities.json');
const IMAGE_DIR = path.resolve(process.cwd(), 'public/images/posters/activity');

if (!fs.existsSync(IMAGE_DIR)) {
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
}

const REGION_COORDS: Record<string, { lat: number, lng: number }> = {
    'seoul': { lat: 37.5665, lng: 126.9780 },
    'gyeonggi': { lat: 37.4138, lng: 127.5183 },
    'incheon': { lat: 37.4563, lng: 126.7052 },
    'busan': { lat: 35.1796, lng: 129.0756 },
    'daegu': { lat: 35.8714, lng: 128.6014 },
    'daejeon': { lat: 36.3504, lng: 127.3845 },
    'gwangju': { lat: 35.1595, lng: 126.8526 },
    'ulsan': { lat: 35.5384, lng: 129.3114 },
    'sejong': { lat: 36.48, lng: 127.289 },
    'gangwon': { lat: 37.8228, lng: 128.1555 },
    'chungbuk': { lat: 36.6357, lng: 127.4912 },
    'chungnam': { lat: 36.6588, lng: 126.6728 },
    'jeonbuk': { lat: 35.8242, lng: 127.1480 },
    'jeonnam': { lat: 34.8161, lng: 126.4629 },
    'gyeongbuk': { lat: 36.5753, lng: 128.5053 },
    'gyeongnam': { lat: 35.4606, lng: 128.2132 },
    'jeju': { lat: 33.4996, lng: 126.5312 },
};

function classifyRegion(text: string): { region: string, lat: number, lng: number } {
    const regionMap: Record<string, string> = {
        '서울': 'seoul', '경기': 'gyeonggi', '인천': 'incheon', '부산': 'busan',
        '대구': 'daegu', '대전': 'daejeon', '광주': 'gwangju', '울산': 'ulsan',
        '세종': 'sejong', '강원': 'gangwon', '충북': 'chungbuk', '충남': 'chungnam',
        '전북': 'jeonbuk', '전남': 'jeonnam', '경북': 'gyeongbuk', '경남': 'gyeongnam',
        '제주': 'jeju', '춘천': 'gangwon', '양평': 'gyeonggi', '포천': 'gyeonggi',
        '과천': 'gyeonggi', '평택': 'gyeonggi', '김포': 'gyeonggi', '고양': 'gyeonggi',
        '일산': 'gyeonggi', '아산': 'chungnam', '청라': 'incheon', '여수': 'jeonnam'
    };

    for (const [korean, english] of Object.entries(regionMap)) {
        if (text.includes(korean)) {
            const coords = REGION_COORDS[english] || { lat: 0, lng: 0 };
            return { region: english, ...coords };
        }
    }
    return { region: 'etc', lat: 0, lng: 0 };
}

async function downloadImage(url: string, filename: string): Promise<string> {
    try {
        const ext = path.extname(url.split('?')[0]) || '.jpg';
        const localFilename = `${filename}${ext}`;
        const localPath = path.join(IMAGE_DIR, localFilename);
        const publicPath = `/images/posters/activity/${localFilename}`;

        if (fs.existsSync(localPath)) return publicPath;

        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            timeout: 10000
        });

        await pipeline(response.data, fs.createWriteStream(localPath));
        return publicPath;
    } catch (e) {
        console.warn(`Failed to download image:`, e);
        return url;
    }
}

async function scrapeActivities() {
    console.log('Starting Mom-Mom Activity Scraper (SPA-aware)...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.evaluateOnNewDocument(() => { (window as any).__name = (f: any) => f; });

    try {
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        // Infinite Scroll
        console.log('Loading list...');
        await page.evaluate(async () => {
            await new Promise<void>((resolve) => {
                let totalHeight = 0;
                let noChangeCount = 0;
                const distance = 500;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 200) {
                        if (document.body.scrollHeight > scrollHeight) noChangeCount = 0;
                        else noChangeCount++;
                    } else noChangeCount = 0;
                    if (noChangeCount > 50 || totalHeight > 500000) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        // Extract items from list page (SPA - no direct links)
        const items = await page.evaluate(() => {
            const results: { title: string, venue: string, discountRate: string, price: string, image: string, productName: string }[] = [];
            const productInfos = Array.from(document.querySelectorAll('.product-info'));

            productInfos.forEach(info => {
                const parent = info.closest('div[class*="sc-"]') || info.parentElement?.parentElement;
                const titleEl = info.querySelector('.product-name') || info.querySelector('h4');
                const title = titleEl?.textContent?.trim() || '';
                if (!title) return;

                const venueEl = info.querySelector('.brand-name');
                const venue = venueEl?.textContent?.trim() || '';

                const rateEl = info.querySelector('.rate');
                const discountRate = rateEl?.textContent?.trim() || '';

                const priceEl = info.querySelector('.price');
                const priceSpans = priceEl?.querySelectorAll('span');
                let price = '';
                priceSpans?.forEach(span => {
                    if (!span.classList.contains('rate') && span.textContent?.includes('원')) {
                        price = span.textContent.trim();
                    }
                });

                const imgContainer = parent?.querySelector('.image-container');
                const imgEl = imgContainer?.querySelector('img');
                const image = imgEl?.src || '';

                results.push({ title, venue, discountRate, price, image, productName: title });
            });

            return results;
        });

        console.log(`Found ${items.length} items on list page.`);

        const finalItems = [];

        for (let i = 0; i < items.length; i++) {
            const item = items[i];

            // Calculate Original Price
            const priceNum = parseInt(item.price.replace(/[^0-9]/g, ''), 10) || 0;
            let originalPrice = '';
            if (item.discountRate.includes('%')) {
                const rate = parseInt(item.discountRate.replace('%', ''), 10);
                if (!isNaN(rate) && rate > 0) {
                    const orig = Math.floor(priceNum / ((100 - rate) / 100));
                    originalPrice = orig.toLocaleString() + '원';
                }
            }

            // Classify Region from title/venue
            const location = classifyRegion(item.title + ' ' + item.venue);

            // Clean Title for ID
            const safeTitle = item.title.replace(/\s/g, '').replace(/[^a-zA-Z0-9가-힣]/g, '').slice(0, 25);
            const id = `mommom_activity_${safeTitle}`;

            // Download Image
            let finalImage = item.image;
            if (item.image) {
                finalImage = await downloadImage(item.image, id);
            }

            finalItems.push({
                id,
                title: item.title,
                image: finalImage,
                link: '', // SPA - no direct link available from list
                date: '상시운영',
                genre: 'activity',
                region: location.region,
                venue: item.venue || item.title,
                address: '', // Would need detail page visit to get
                latitude: location.lat,
                longitude: location.lng,
                originalPrice,
                price: item.price,
                rate: parseInt(item.discountRate.replace('%', ''), 10) || 0,
                platform: 'mommom',
                discountRate: item.discountRate
            });

            if ((i + 1) % 50 === 0) {
                console.log(`Processed ${i + 1}/${items.length} items...`);
            }
        }

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalItems, null, 2));
        console.log(`Saved ${finalItems.length} items to ${OUTPUT_FILE}`);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}

scrapeActivities();
