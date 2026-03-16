
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';
import cliProgress from 'cli-progress';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

puppeteer.use(StealthPlugin());

const SEARCH_QUERIES = [
    '박물관/체험관',
    '체험관',
    '과학관',
    '미술관',
    '어린이체험'
];
const EXTRA_URLS = [
    'https://mom-mom.net/travel/places/6507a66e53e91cf1df2b57f2' // hy팩토리+
];
const OUTPUT_FILE = path.resolve(process.cwd(), 'src/data/mommom.json');

// Helper to clean address
function cleanAddress(addr: string): string {
    return addr.replace('주소', '').trim();
}

function slugify(text: string): string {
    return text
        .replace(/[^a-zA-Z0-9가-힣]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

function determineGenre(title: string): string {
    const t = title;
    // User requested "Museum/Experience" category specifically. 
    // The link '1102241' is seemingly for that.
    // We can default to 'museum' for most, or refine.
    if (t.includes('박물관') || t.includes('기념관') || t.includes('과학관') || t.includes('미술관')) return 'museum';
    if (t.includes('키즈') || t.includes('랜드') || t.includes('월드')) return 'kids';
    if (t.includes('호텔') || t.includes('리조트')) return 'travel';
    // Default fallback
    return 'museum';
}

// Fallback Coordinates for mapping if API/Geo lookup is missing (using static map for now)
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

function classifyRegion(address: string): string {
    if (address.includes('서울')) return 'seoul';
    if (address.includes('경기')) return 'gyeonggi';
    if (address.includes('인천')) return 'incheon';
    if (address.includes('강원')) return 'gangwon';
    if (address.includes('제주')) return 'jeju';
    if (address.includes('부산')) return 'busan';
    if (address.includes('대구')) return 'daegu';
    if (address.includes('광주')) return 'gwangju';
    if (address.includes('대전')) return 'daejeon';
    if (address.includes('울산')) return 'ulsan';
    if (address.includes('세종')) return 'sejong';
    if (address.includes('충북')) return 'chungbuk';
    if (address.includes('충남')) return 'chungnam';
    if (address.includes('전북')) return 'jeonbuk';
    if (address.includes('전남')) return 'jeonnam';
    if (address.includes('경북')) return 'gyeongbuk';
    if (address.includes('경남')) return 'gyeongnam';
    return 'etc';
}

interface MomMomItem {
    id: string;
    title: string;
    image: string;
    link: string;
    date: string; // Will store "Closed Day" info or "Open Run"
    genre: string;
    region: string;
    venue: string;
    address: string;
    latitude: number;
    longitude: number;
    originalPrice: number | string;
    price: number | string; // Store text if format varies
    rate: number;
    platform: string;
    description?: string;
    closedDay?: string;
    targetAudience?: string;
    operatingHours?: string;
    priceDetail?: string;
    facilities?: string;
    website?: string;
    feesAndPrograms?: string;
}

async function scrapeMomMom() {
    console.log('Starting Mom-Mom Scraper (Detail Mode)...');
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
            timeout: 60000
        });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.evaluateOnNewDocument(() => { (window as any).__name = (f: any) => f; });

    try {
        // Discovery via Search Queries
        const listItems: { title: string, link: string, image: string }[] = [];
        const seenUrls = new Set<string>();

        for (const query of SEARCH_QUERIES) {
            console.log(`Searching for: ${query}...`);
            const searchUrl = `https://mom-mom.net/search?q=${encodeURIComponent(query)}&hl=places`;
            await page.goto(searchUrl, { waitUntil: ['domcontentloaded', 'networkidle2'], timeout: 60000 });

            console.log('Loading list...');
            await page.evaluate(async () => {
                await new Promise<void>((resolve) => {
                    let totalHeight = 0;
                    const distance = 800;
                    const timer = setInterval(() => {
                        const scrollHeight = document.body.scrollHeight;
                        window.scrollBy(0, distance);
                        totalHeight += distance;
                        if (totalHeight > 20000) { // Limit depth for efficiency
                            clearInterval(timer);
                            resolve();
                        }
                    }, 200);
                });
            });

            const queryItems = await page.evaluate(() => {
                const results: { title: string, link: string, image: string }[] = [];
                const anchors = Array.from(document.querySelectorAll('a[href*="/travel/places/"]'));
                anchors.forEach((a: any) => {
                    let title = '';
                    let image = '';
                    const titleEl = a.querySelector('h4') || a.closest('div')?.querySelector('h4');
                    if (titleEl) title = titleEl.textContent?.trim() || '';
                    if (!title) title = 'Pending';
                    const imgTag = a.querySelector('img') || a.closest('div')?.querySelector('img');
                    if (imgTag) image = imgTag.src;
                    results.push({ title, link: a.href, image });
                });
                return results;
            });

            queryItems.forEach(it => {
                if (!seenUrls.has(it.link)) {
                    seenUrls.add(it.link);
                    listItems.push(it);
                }
            });
        }

        // Add Extra URLs
        EXTRA_URLS.forEach(link => {
            if (!seenUrls.has(link)) {
                seenUrls.add(link);
                listItems.push({ title: 'Pending', link, image: '' });
            }
        });

        console.log(`Found ${listItems.length} items to process.`);

        // Load existing data to minimize server load
        const DATA_PATH = path.join(__dirname, '../src/data/mommom.json');
        let existingData: Record<string, MomMomItem> = {};
        if (fs.existsSync(DATA_PATH)) {
            try {
                const raw = fs.readFileSync(DATA_PATH, 'utf-8');
                const parsed = JSON.parse(raw);
                parsed.forEach((item: MomMomItem) => {
                    // Normalize link to use as key
                    existingData[item.link] = item;
                });
                console.log(`Loaded ${Object.keys(existingData).length} existing items for incremental update.`);
            } catch (e) {
                console.warn('Failed to load existing data, starting fresh.', e);
            }
        }

        // Detail Scraping
        const finalItems: MomMomItem[] = [];
        const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
        bar.start(listItems.length, 0);

        // Batch processing to respect resources
        const CHUNK_SIZE = 3;
        for (let i = 0; i < listItems.length; i += CHUNK_SIZE) {
            const chunk = listItems.slice(i, i + CHUNK_SIZE);
            if (i > 0) {
                console.log(`Waiting 1s before next chunk...`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            const promises = chunk.map(async (item) => {
                // Filter existing items based on criteria:
                const existing = existingData[item.link];

                // Case 1: New Item -> Scrape
                if (!existing) {
                    // fall through
                }
                // Case 2: Incomplete Data -> Scrape
                else if (!existing.description || existing.description.length < 10 || !existing.price) {
                    // fall through
                }
                // Case 3: Permanent/OpenRun items -> Skip (Efficiency)
                // If date suggests permanence and we have good description AND clean feesAndPrograms, skip.
                else {
                    const isPermanent = existing.date.includes('오픈런') ||
                        existing.date.includes('상시') ||
                        existing.date.includes('연중무휴') ||
                        existing.date.includes('매일') ||
                        !existing.date.match(/\d{4}\.\d{2}\.\d{2}/);

                    const isClean = existing.feesAndPrograms && 
                                    !existing.feesAndPrograms.includes('저장') && 
                                    !existing.feesAndPrograms.includes('서울더보기');

                    if (isPermanent && existing.feesAndPrograms && isClean) {
                        // Ensure list data (title/image) is synced
                        return {
                            ...existing,
                            title: (item.title && item.title !== 'Pending') ? item.title : existing.title,
                            image: (item.image) ? item.image : existing.image
                        };
                    }
                }

                const detailPage = await browser.newPage();
                await detailPage.evaluateOnNewDocument(() => { (window as any).__name = (f: any) => f; });
                try {
                    // Block images on detail to speed up
                    await detailPage.setRequestInterception(true);
                    detailPage.on('request', (req) => {
                        if (['image', 'media', 'font'].includes(req.resourceType())) req.abort();
                        else req.continue();
                    });

                    await detailPage.goto(item.link, { waitUntil: 'networkidle2', timeout: 60000 }); // Increase timeout here

                    // Wait for dynamic content
                    await detailPage.waitForSelector('.toggle-title', { timeout: 10000 }).catch(() => { });

                    // Click all toggles to reveal hidden content
                    await detailPage.evaluate(async () => {
                        const toggles = Array.from(document.querySelectorAll('.toggle-title'));
                        for (const toggle of toggles) {
                            (toggle as HTMLElement).click();
                            await new Promise(res => setTimeout(res, 300));
                        }
                    });

                    // Scrape Details using correct selectors
                    const details = await detailPage.evaluate(() => {
                        const allKeyElements = Array.from(document.querySelectorAll('p.key, th, dt, span.key'));
                        const allPs = Array.from(document.querySelectorAll('p, li, article div, span'));
                        // 1. Title
                        const pageTitle = document.querySelector('h1')?.textContent?.trim() ||
                            document.querySelector('h2')?.textContent?.trim() || '';

                        // 2. Address
                        let address = '';
                        const addressKey = allKeyElements.find(el => el.textContent?.trim() === '주소');
                        if (addressKey) {
                            let valueEl = addressKey.nextElementSibling;
                            if (valueEl && (valueEl.classList.contains('value') || valueEl.tagName === 'P')) {
                                address = valueEl.textContent?.trim() || '';
                            }
                            if (!address && addressKey.parentElement) {
                                const parentValue = addressKey.parentElement.querySelector('.value, p:last-child');
                                if (parentValue) address = parentValue.textContent?.trim() || '';
                            }
                        }

                        // 3. Website
                        let website = '';
                        const webKey = allKeyElements.find(el => el.textContent?.includes('홈페이지'));
                        if (webKey) {
                            const linkEl = webKey.parentElement?.querySelector('a') || webKey.nextElementSibling?.querySelector('a');
                            if (linkEl) website = linkEl.href;
                        }

                        // 4. Target Audience (Popular Age)
                        let targetAudience = '';
                        // Identify by grey help icon + text pattern
                        const greyIcons = Array.from(document.querySelectorAll('.icon-help-grey'));
                        greyIcons.forEach(icon => {
                            const parent = icon.parentElement;
                            if (parent && parent.textContent?.includes('인기 연령')) {
                                const infoEl = parent.nextElementSibling;
                                if (infoEl) targetAudience = infoEl.textContent?.trim() || '';
                            }
                        });
                        // Fallback target extraction
                        if (!targetAudience) {
                            const targetEl = allPs.find(el => {
                                const text = el.textContent || '';
                                return (text.includes('인기') && text.includes('개월')) ||
                                    (text.includes('세') && text.includes('이상'));
                            });
                            if (targetEl) targetAudience = targetEl.textContent?.trim() || '';
                        }

                        // 5. Operating Hours & Price Detail (Check Toggles)
                        let priceDetail = '';
                        let operatingHours = '';
                        let closedDay = '';

                        // Loop through toggles to find price and hours
                        const toggles = Array.from(document.querySelectorAll('.toggle-title'));
                        toggles.forEach(toggle => {
                            const text = toggle.textContent || '';
                            const content = toggle.nextElementSibling?.textContent?.trim() || '';

                            if (text.includes('입장료') || text.includes('요금')) {
                                priceDetail = content || toggle.parentElement?.textContent?.split(']')[1]?.trim() || '';
                            }
                            if (text.includes('관람 시간') || text.includes('이용 시간')) {
                                operatingHours = content || '';
                            }
                        });

                        // 5.5 Extract "요금 및 프로그램" section specifically (SURGICAL)
                        let feesAndProgramsArr: string[] = [];

                        // 1. Surgical attempt: Target the specific UL container commonly found in detail pages
                        const feeSection = Array.from(document.querySelectorAll('section')).find(s => 
                            s.textContent?.includes('요금 및 프로그램') && s.querySelector('ul')
                        );
                        
                        if (feeSection) {
                            const items = Array.from(feeSection.querySelectorAll('li')).map(li => {
                                return li.innerText.trim();
                            }).filter(t => t.length > 0 && !t.includes('업데이트') && !t.includes('사진 보기'));
                            
                            feesAndProgramsArr = Array.from(new Set(items));
                        }

                        // 2. Fallback: If surgical fails, look for markers in text (more careful than innerText)
                        if (feesAndProgramsArr.length === 0) {
                            const allElements = Array.from(document.querySelectorAll('li, p, div.sc-'));
                            let foundMarker = false;
                            for (const el of allElements) {
                                const t = el.textContent?.trim() || '';
                                if (t.includes('요금 및 프로그램') && t.length < 50) {
                                    foundMarker = true;
                                    continue;
                                }
                                if (foundMarker) {
                                    if (t.includes('꿀팁') || t.includes('주소') || t.includes('예약')) break;
                                    if (t.length > 1 && t.length < 200) feesAndProgramsArr.push(t);
                                }
                            }
                        }

                        let feesAndPrograms = Array.from(new Set(feesAndProgramsArr)).join('\n');

                        // Standard extraction if toggles failed
                        if (!operatingHours) {
                            const hoursKey = allKeyElements.find(el => el.textContent?.trim() === '영업시간');
                            if (hoursKey && hoursKey.parentElement) {
                                operatingHours = hoursKey.parentElement.textContent?.replace('영업시간', '').trim() || '';
                            }
                        }

                        // 6. Facilities
                        let facilities = '';
                        const facKey = allKeyElements.find(el => el.textContent?.includes('편의시설') || el.textContent?.includes('시설'));
                        if (facKey && facKey.parentElement) {
                            facilities = facKey.parentElement.textContent?.replace(/편의시설|시설/g, '').trim() || '';
                        }

                        // 7. Image
                        let detailImage = '';
                        const ogImg = document.querySelector('meta[property="og:image"]');
                        if (ogImg) detailImage = ogImg.getAttribute('content') || '';

                        // 8. Description (Legacy fallback)
                        let description = '';
                        const descP = document.querySelector('p.item-description');
                        if (descP) description = descP.textContent?.trim() || '';

                        return {
                            address,
                            closedDay,
                            price: priceDetail ? priceDetail.split('\n')[0] : '', // Main price summary
                            pageTitle,
                            detailImage,
                            description,
                            targetAudience,
                            priceDetail,
                            operatingHours,
                            facilities,
                            website,
                            feesAndPrograms
                        };
                    });

                    // Resolve Title
                    const finalTitle = (item.title === 'Pending' || !item.title) ? details.pageTitle : item.title;
                    const finalImage = item.image || details.detailImage;

                    if (!finalTitle) return null; // Skip if still no title

                    // Clean Address
                    const rawAddr = details.address.replace('주소', '').trim();
                    const validAddr = rawAddr.match(/(([가-힣]+[시도])\s+([가-힣]+[시구군]).+)/)?.[1] || rawAddr;

                    const region = classifyRegion(validAddr);

                    let coords = { lat: 0, lng: 0 };
                    const regionKey = Object.keys(REGION_COORDS).find(k => validAddr.includes(k));
                    if (regionKey) coords = REGION_COORDS[regionKey];

                    return {
                        ...item,
                        title: finalTitle,
                        image: finalImage,
                        ...details,
                        address: validAddr,
                        region,
                        latitude: coords.lat,
                        longitude: coords.lng
                    };

                } catch (e) {
                    console.error(`Failed to scrape ${item.link}:`, e);
                    return null;
                } finally {
                    await detailPage.close();
                }
            });

            const results = await Promise.all(promises);
            results.forEach(r => {
                if (r) {
                    // ID generation
                    const id = `mommom_${slugify(r.title)}`;

                    finalItems.push({
                        id,
                        title: r.title,
                        image: r.image,
                        link: r.link,
                        date: r.closedDay || '연중무휴', // Map closed day to date!
                        genre: determineGenre(r.title),
                        region: r.region,
                        venue: r.title, // Venue name IS the title for MomMom places
                        address: r.address,
                        latitude: r.latitude,
                        longitude: r.longitude,
                        originalPrice: '', // No distinct original price scraped yet
                        price: r.price || '무료',
                        rate: 0,
                        platform: 'mommom',
                        targetAudience: r.targetAudience,
                        operatingHours: r.operatingHours,
                        priceDetail: r.priceDetail,
                        facilities: r.facilities,
                        website: r.website,
                        feesAndPrograms: r.feesAndPrograms
                    });
                }
            });
            bar.increment(chunk.length);
            
            // Incremental Save
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalItems, null, 2));
        }
        bar.stop();

        // Save
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalItems, null, 2));
        console.log(`\nSaved ${finalItems.length} items to ${OUTPUT_FILE}`);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}

scrapeMomMom();
