import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';
import * as cliProgress from 'cli-progress';

puppeteer.use(StealthPlugin());

const TARGET_URL = 'https://mom-mom.net/search?q=%EC%A0%84%EC%8B%9C/%EC%B6%95%EC%A0%9C&hl=places';
const OUTPUT_FILE = path.resolve(process.cwd(), 'src/data/mommom-exb.json');

// Region Classification based on Address
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

function classifyRegion(address: string): { region: string, lat: number, lng: number } {
    if (!address) return { region: 'etc', lat: 0, lng: 0 };

    const regionMap: Record<string, string> = {
        '서울': 'seoul', '경기': 'gyeonggi', '인천': 'incheon', '부산': 'busan',
        '대구': 'daegu', '대전': 'daejeon', '광주': 'gwangju', '울산': 'ulsan',
        '세종': 'sejong', '강원': 'gangwon', '충북': 'chungbuk', '충남': 'chungnam',
        '전북': 'jeonbuk', '전남': 'jeonnam', '경북': 'gyeongbuk', '경남': 'gyeongnam', '제주': 'jeju'
    };

    for (const [korean, english] of Object.entries(regionMap)) {
        if (address.includes(korean)) {
            const coords = REGION_COORDS[english] || { lat: 0, lng: 0 };
            return { region: english, ...coords };
        }
    }
    return { region: 'etc', lat: 0, lng: 0 };
}

function determineGenre(title: string): string {
    if (title.startsWith('<공연>') || title.startsWith('[공연]')) return 'play';
    if (title.startsWith('<뮤지컬>') || title.startsWith('[뮤지컬]')) return 'musical';
    if (title.startsWith('<전시>') || title.startsWith('[전시]')) return 'exhibition';
    if (title.includes('축제') || title.includes('페스티벌')) return 'festival';
    return 'exhibition'; // Default
}

function isJapaneseAddress(address: string): boolean {
    const japanKeywords = ['일본', '도쿄', '오사카', '후쿠오카', '나고야', '교토', '삿포로', 'Tokyo', 'Osaka', 'Japan'];
    return japanKeywords.some(k => address.includes(k));
}

// Extract date from title patterns like "(~26/03/28)", "(26/02/22)", "(~2026.03.28)"
function extractDateFromTitle(title: string): { dateStr: string, endDate: Date | null } {
    // Pattern 1: (~YY/MM/DD) or (~YYYY/MM/DD)
    const pattern1 = /\(~?(\d{2,4})[\/.](\d{1,2})[\/.](\d{1,2})\)/;
    // Pattern 2: YYYY.MM.DD ~ YYYY.MM.DD
    const pattern2 = /(\d{4}\.\d{2}\.\d{2})\s*~\s*(\d{4}\.\d{2}\.\d{2})/;

    let match = title.match(pattern1);
    if (match) {
        let year = parseInt(match[1]);
        if (year < 100) year += 2000; // YY -> 20YY
        const month = parseInt(match[2]);
        const day = parseInt(match[3]);
        const dateStr = `~${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`;
        const endDate = new Date(year, month - 1, day);
        endDate.setHours(23, 59, 59, 999);
        return { dateStr, endDate };
    }

    match = title.match(pattern2);
    if (match) {
        const dateStr = `${match[1]} ~ ${match[2]}`;
        const endParts = match[2].split('.').map(Number);
        const endDate = new Date(endParts[0], endParts[1] - 1, endParts[2]);
        endDate.setHours(23, 59, 59, 999);
        return { dateStr, endDate };
    }

    return { dateStr: '상시운영', endDate: null };
}

// Check if event is expired
function isExpired(endDate: Date | null): boolean {
    if (!endDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return endDate < today;
}

async function scrapeExhibitions() {
    console.log('Starting Mom-Mom Exhibition Scraper (Improved)...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

    try {
        await page.goto(TARGET_URL, { waitUntil: ['domcontentloaded', 'networkidle2'], timeout: 60000 });

        // Infinite Scroll
        console.log('Loading list...');
        await page.evaluate(async () => {
            await new Promise<void>((resolve) => {
                let totalHeight = 0;
                let noChangeCount = 0;
                const distance = 600;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 200) {
                        if (document.body.scrollHeight > scrollHeight) noChangeCount = 0;
                        else noChangeCount++;
                    } else noChangeCount = 0;
                    if (noChangeCount > 40 || totalHeight > 400000) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        // Extract from List View
        const listItems = await page.evaluate(() => {
            const results: { title: string, link: string, image: string }[] = [];
            const anchors = Array.from(document.querySelectorAll('a[href*="/travel/places/"]')) as HTMLAnchorElement[];
            const seen = new Set();

            anchors.forEach(a => {
                if (seen.has(a.href)) return;
                seen.add(a.href);

                let title = '';
                let image = '';

                const titleEl = a.querySelector('h4') || a.closest('div')?.querySelector('h4');
                if (titleEl) title = titleEl.textContent?.trim() || '';
                if (!title) title = '';

                const imgTag = a.querySelector('img') || a.closest('div')?.querySelector('img');
                if (imgTag) image = imgTag.src;

                results.push({ title, link: a.href, image });
            });
            return results;
        });

        console.log(`Found ${listItems.length} items. Starting detail scrape...`);

        const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
        progressBar.start(listItems.length, 0);

        const finalResults: any[] = [];
        const CHUNK_SIZE = 5;

        for (let i = 0; i < listItems.length; i += CHUNK_SIZE) {
            const chunk = listItems.slice(i, i + CHUNK_SIZE);
            const chunkResults = await Promise.all(chunk.map(item => scrapeDetail(browser, item)));

            for (const res of chunkResults) {
                if (res) finalResults.push(res);
            }
            progressBar.update(Math.min(i + CHUNK_SIZE, listItems.length));
        }

        progressBar.stop();

        // Filter duplicates by ID
        const uniqueItems = finalResults.filter((item, idx, arr) =>
            arr.findIndex(t => t.id === item.id) === idx && item.title
        );

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(uniqueItems, null, 2));
        console.log(`Saved ${uniqueItems.length} valid items to ${OUTPUT_FILE}`);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}

async function scrapeDetail(browser: any, item: { title: string, link: string, image: string }) {
    const page = await browser.newPage();
    try {
        await page.setRequestInterception(true);
        page.on('request', (req: any) => {
            if (['image', 'font', 'media'].includes(req.resourceType())) req.abort();
            else req.continue();
        });

        await page.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 30000 });

        const data = await page.evaluate(() => {
            // Title from H1/H2
            const h1 = document.querySelector('h1');
            const h2 = document.querySelector('h2');
            const title = (h1?.textContent || h2?.textContent || '').trim();

            // Image from og:image
            const metaImg = document.querySelector('meta[property="og:image"]');
            const image = metaImg?.getAttribute('content') || '';

            // Address: Find text matching Korean address pattern
            const allEls = Array.from(document.querySelectorAll('div, p, span'));
            const addrEl = allEls.find(el =>
                /([가-힣]+(시|도)\s+[가-힣]+(시|군|구))/.test(el.textContent || '') &&
                el.children.length === 0
            );
            let address = addrEl?.textContent?.trim() || '';
            address = address.replace('지도보기', '').trim();

            // Date: YYYY.MM.DD or ~ pattern
            const dateEl = allEls.find(el =>
                /(\d{4}\.\d{2}\.\d{2})/.test(el.textContent || '') &&
                el.children.length === 0
            );
            const dateRange = dateEl?.textContent?.trim() || '상시운영';

            // Price
            const priceEl = allEls.find(el =>
                /(무료|원)/.test(el.textContent || '') &&
                (el.textContent?.length || 0) < 30 &&
                el.children.length === 0
            );
            const price = priceEl?.textContent?.trim() || '정보없음';

            // Holiday/ClosedDay
            const closedEl = allEls.find(el =>
                /(정기휴무|연중무휴|휴관)/.test(el.textContent || '') &&
                (el.textContent?.length || 0) < 50 &&
                el.children.length === 0
            );
            const closedDay = closedEl?.textContent?.trim() || '';

            return { title, image, address, dateRange, price, closedDay };
        });

        // Use scraped title if list title was empty
        const finalTitle = item.title || data.title;
        const finalImage = data.image || item.image;
        const address = data.address;

        // Filter Japan
        if (isJapaneseAddress(address)) return null;

        // Extract date from title first, fallback to detail page data
        const titleDateInfo = extractDateFromTitle(finalTitle);
        let date = titleDateInfo.dateStr;
        let endDate = titleDateInfo.endDate;

        // If no date in title, try detail page data
        if (date === '상시운영' && data.dateRange) {
            date = data.closedDay || data.dateRange;
            if (date.includes('~')) {
                const parts = date.split('~');
                const endStr = parts[1].trim();
                const parsed = new Date(endStr.replace(/\./g, '-'));
                if (!isNaN(parsed.getTime())) {
                    endDate = parsed;
                    endDate.setHours(23, 59, 59, 999);
                }
            }
        }

        // Expired Check
        if (isExpired(endDate)) {
            console.log(`Skipping expired: ${finalTitle}`);
            return null;
        }

        const genre = determineGenre(finalTitle);
        const location = classifyRegion(address);

        const safeTitle = finalTitle.replace(/\s/g, '').replace(/[^a-zA-Z0-9가-힣]/g, '').slice(0, 20);
        const id = `mommom_exb_${safeTitle}`;

        return {
            id,
            title: finalTitle,
            image: finalImage,
            link: item.link,
            date,
            genre,
            region: location.region,
            venue: finalTitle,
            address,
            latitude: location.lat,
            longitude: location.lng,
            originalPrice: '',
            price: data.price,
            rate: 0,
            platform: 'mommom'
        };

    } catch (e) {
        console.warn('Detail scrape failed:', item.link, (e as Error).message);
        return null;
    } finally {
        await page.close();
    }
}

scrapeExhibitions();
