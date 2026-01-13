
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';

puppeteer.use(StealthPlugin());

const TARGET_URL = 'https://mom-mom.net/shop/categories/1102241';
const OUTPUT_FILE = path.resolve(process.cwd(), 'src/data/mommom.json');

// Venue & Coordinate Mapping (User specific requests + defaults)
const VENUE_MAP: Record<string, { address: string; lat: number; lng: number }> = {
    // Leisure / Theme Parks
    '상상체험': { address: '경기도 고양시 일산서구 킨텍스로 217-60', lat: 37.6695, lng: 126.7475 }, // Kintex (Example) - Name varies, assume Kintex for 'SangSang' often
    '서울랜드': { address: '경기도 과천시 광명로 181', lat: 37.4367, lng: 127.0264 },
    '웅진플레이도시': { address: '경기도 부천시 조마루로 2', lat: 37.5029, lng: 126.7441 },
    '롯데월드': { address: '서울특별시 송파구 올림픽로 240', lat: 37.5111, lng: 127.0981 },
    '에버랜드': { address: '경기도 용인시 처인구 포곡읍 에버랜드로 199', lat: 37.2939, lng: 127.2025 },
    '한국민속촌': { address: '경기도 용인시 기흥구 민속촌로 90', lat: 37.2625, lng: 127.1168 },

    // Hotels / Resorts
    '호텔 마리나베이': { address: '경기도 김포시 고촌읍 아라육로152번길 210-50', lat: 37.6015, lng: 126.7661 },
    '켄싱턴리조트': { address: '경기도 가평군 상면 청군로 430', lat: 37.8285, lng: 127.4206 }, // Example (Gapyeong) - need to handle multiple branches? user said "Kensington Resort". Mapping generic or specific if title matches
    '소노벨': { address: '강원도 홍천군 서면 한치골길 262', lat: 37.6496, lng: 127.6854 }, // Vivaldi Park usually
    '한화리조트': { address: '강원도 속초시 미시령로2983번길 111', lat: 38.1925, lng: 128.5375 }, // Sorano
};

// Fallback Region Coordinates
const REGION_COORDS: Record<string, { lat: number; lng: number }> = {
    '서울': { lat: 37.5665, lng: 126.9780 },
    '경기': { lat: 37.4138, lng: 127.5183 },
    '인천': { lat: 37.4563, lng: 126.7052 },
    '강원': { lat: 37.8228, lng: 128.1555 },
    '제주': { lat: 33.4996, lng: 126.5312 },
    '부산': { lat: 35.1796, lng: 129.0756 },
    '대구': { lat: 35.8714, lng: 128.6014 },
    '경북': { lat: 36.5684, lng: 128.7294 },
    '경남': { lat: 35.2383, lng: 128.6925 },
    '전남': { lat: 34.8679, lng: 126.9910 },
    '전북': { lat: 35.7175, lng: 127.1530 },
    '충남': { lat: 36.6588, lng: 126.6728 },
    '충북': { lat: 36.6350, lng: 127.4914 },
    '대전': { lat: 36.3504, lng: 127.3845 },
    '광주': { lat: 35.1595, lng: 126.8526 },
    '울산': { lat: 35.5384, lng: 129.3114 },
    '세종': { lat: 36.4800, lng: 127.2890 },
};

function determineGenre(title: string): string {
    const t = title;
    if (t.includes('상상체험') || t.includes('서울랜드') || t.includes('웅진플레이도시') || t.includes('월드') || t.includes('파크') || t.includes('입장권') || t.includes('티켓') || t.includes('이용권')) return 'leisure';
    if (t.includes('호텔') || t.includes('리조트') || t.includes('펜션') || t.includes('숙박') || t.includes('스테이')) return 'travel';
    if (t.includes('뮤지컬') || t.includes('공연')) return 'musical';
    if (t.includes('전시')) return 'exhibition';
    if (t.includes('키즈')) return 'kids';
    return 'hotdeal'; // Default
}

function classifyRegion(text: string): string {
    if (!text) return 'etc';
    /* 
       "div.sc-fd2f9237-47.cHQTQn" often contains "지역: 경기" or just tags?
       User said: "인천, 제주, 경주-대구-경북, 경기남부 등의 대략적인 위치정보가 나와있으니"
    */
    if (text.includes('서울')) return 'seoul';
    if (text.includes('경기')) return 'gyeonggi';
    if (text.includes('인천')) return 'incheon';
    if (text.includes('강원')) return 'gangwon';
    if (text.includes('제주')) return 'jeju';
    if (text.includes('부산')) return 'busan';
    if (text.includes('대구')) return 'daegu';
    if (text.includes('광주')) return 'gwangju';
    if (text.includes('대전')) return 'daejeon';
    if (text.includes('울산')) return 'ulsan';
    if (text.includes('세종')) return 'sejong';
    if (text.includes('충북')) return 'chungbuk';
    if (text.includes('충남')) return 'chungnam';
    if (text.includes('전북')) return 'jeonbuk';
    if (text.includes('전남')) return 'jeonnam';
    if (text.includes('경북')) return 'gyeongbuk';
    if (text.includes('경남')) return 'gyeongnam';
    return 'etc';
}

function findLocation(title: string, regionText: string): { address: string; lat: number; lng: number } | null {
    // 1. Direct Venue Match
    for (const [key, val] of Object.entries(VENUE_MAP)) {
        if (title.includes(key)) {
            return val;
        }
    }

    // 2. Fallback to Region Center
    const regionKey = Object.keys(REGION_COORDS).find(k => regionText.includes(k));
    if (regionKey) {
        const coords = REGION_COORDS[regionKey];
        return { address: regionKey, ...coords };
    }

    return null;
}

interface MomMomItem {
    id: string;
    title: string;
    image: string;
    link: string;
    date: string; // Valid until? or just scrape date
    genre: string;
    region: string;
    venue: string; // "Seoul Land" or Region Name
    address: string;
    latitude: number;
    longitude: number;
    originalPrice: number;
    price: number;
    rate: number;
    platform: string;
}

async function scrapeMomMom() {
    console.log('Starting Mom-Mom Scraper...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    try {
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        // Infinite Scroll to load all items
        await page.evaluate(async () => {
            await new Promise<void>((resolve) => {
                let totalHeight = 0;
                let noChangeCount = 0;
                const distance = 300; // Scroll distance

                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    // If we reached bottom (or close to it)
                    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 200) {
                        // Check if height increased
                        if (document.body.scrollHeight > scrollHeight) {
                            noChangeCount = 0; // Reset if new content loaded
                        } else {
                            noChangeCount++;
                        }
                    }

                    // Stop if no change for multiple iterations (end of list) or timeout safety
                    if (noChangeCount > 20 || totalHeight > 100000) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 200); // 200ms interval
            });
        });

        // Wait a bit more for final lazy loads
        await new Promise(r => setTimeout(r, 3000));

        const items = await page.evaluate(() => {
            const results: any[] = [];

            // Selector: specific container as requested
            const containers = document.querySelectorAll('div.sc-58f6879c-0.fjlsoj > div > div');

            containers.forEach((el) => {
                const titleEl = el.querySelector('.product-info > h4');
                if (!titleEl) return;

                const title = titleEl.textContent?.trim() || '';

                // Image
                const imgContainer = el.querySelector('.image-container');
                let image = '';
                if (imgContainer) {
                    const bgDiv = imgContainer.querySelector('div[style*="background-image"]');
                    if (bgDiv) {
                        const style = window.getComputedStyle(bgDiv);
                        const urlMatch = style.backgroundImage.match(/url\("?(.+?)"?\)/);
                        if (urlMatch) image = urlMatch[1];
                    }
                    if (!image) {
                        const imgTag = imgContainer.querySelector('img');
                        if (imgTag) image = imgTag.src;
                    }
                }

                // Rate & Price
                const rateEl = el.querySelector('.price > p > span.rate');
                const priceEl = el.querySelector('.price > p > span:nth-child(2)');

                const rateText = rateEl?.textContent?.replace('%', '').trim() || '0';
                const rate = parseInt(rateText, 10) || 0;

                const priceText = priceEl?.textContent?.replace(/[^0-9]/g, '') || '0';
                const price = parseInt(priceText, 10);

                // Calculate Original
                let originalPrice = price;
                if (rate > 0 && rate < 100) {
                    originalPrice = price / (1 - (rate / 100));
                    originalPrice = Math.round(originalPrice / 100) * 100;
                }

                // Region / Category info
                const infoEl = el.querySelector('div.sc-fd2f9237-47.cHQTQn');
                const infoText = infoEl?.textContent?.trim() || '';

                // Link
                const linkEl = el.querySelector('a');
                let link = linkEl ? linkEl.href : '';
                if (!link) {
                    const parentA = el.closest('a');
                    if (parentA) link = parentA.href;
                }

                results.push({
                    title,
                    image,
                    price,
                    originalPrice,
                    rate,
                    infoText,
                    link
                });
            });
            return results;
        });

        console.log(`Found ${items.length} raw items.`);

        const finalItems: MomMomItem[] = items.map(item => {
            const genre = determineGenre(item.title);
            const region = classifyRegion(item.infoText + ' ' + item.title); // Use both for better classification

            const loc = findLocation(item.title, item.infoText + ' ' + item.title);

            // ID: mommom_DATE_TITLE
            const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
            const safeTitle = item.title.replace(/\s/g, '').slice(0, 15);
            const id = `mommom_${today}_${safeTitle}`;

            return {
                id,
                title: item.title,
                image: item.image,
                link: item.link || TARGET_URL, // Fallback if no link found
                date: new Date().toISOString().split('T')[0], // Scraping date
                genre,
                region, // 'seoul', etc for filtering system
                venue: loc?.address || item.infoText || 'Online/Various',
                address: loc?.address || '',
                latitude: loc?.lat || 0,
                longitude: loc?.lng || 0,
                originalPrice: item.originalPrice,
                price: item.price,
                rate: item.rate,
                platform: 'mommom'
            };
        });

        console.log(`Processed ${finalItems.length} items.`);

        // Persistence (Merge)
        let existingItems: MomMomItem[] = [];
        if (fs.existsSync(OUTPUT_FILE)) {
            try {
                existingItems = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
            } catch (e) { }
        }

        const itemMap = new Map<string, MomMomItem>();
        existingItems.forEach(i => itemMap.set(i.id, i));
        finalItems.forEach(i => {
            // Overwrite or Merge? 
            // Mom-Mom deals might change price/rate daily. Let's update if ID matches, or simpler: overwrite same day/title.
            itemMap.set(i.id, i);
        });

        const sortedItems = Array.from(itemMap.values());

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(sortedItems, null, 2));
        console.log(`Saved ${sortedItems.length} items to ${OUTPUT_FILE}`);

    } catch (e) {
        console.error('Error scraping Mom-Mom:', e);
    } finally {
        await browser.close();
    }
}

scrapeMomMom();
