
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';
import cliProgress from 'cli-progress';

puppeteer.use(StealthPlugin());

const TARGET_URL = 'https://mom-mom.net/search?q=%EB%B0%95%EB%AC%BC%EA%B4%80/%EC%B2%B4%ED%97%98%EA%B4%80&hl=places'; // Search: 박물관/체험관
const OUTPUT_FILE = path.resolve(process.cwd(), 'src/data/mommom.json');

// Helper to clean address
function cleanAddress(addr: string): string {
    return addr.replace('주소', '').trim();
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
}

async function scrapeMomMom() {
    console.log('Starting Mom-Mom Scraper (Detail Mode)...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
        await page.goto(TARGET_URL, { waitUntil: ['domcontentloaded', 'networkidle2'], timeout: 60000 });

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
                        // Reached bottom
                        if (document.body.scrollHeight > scrollHeight) {
                            noChangeCount = 0;
                        } else {
                            noChangeCount++;
                        }
                    } else {
                        // Still scrolling
                        noChangeCount = 0;
                    }

                    // Stop if no change for 50 ticks (5 seconds) or extremely long scroll
                    if (noChangeCount > 50 || totalHeight > 500000) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        // Debug: Screenshot
        await page.screenshot({ path: 'debug_mommom.png' });

        // Debug: Log all links
        const allLinks = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a')).map(a => a.href).slice(0, 20);
        });
        console.log('Sample Links:', allLinks);

        // Extract Links (Robust: Look for /travel/places/ URLs)
        const listItems = await page.evaluate(() => {
            const results: { title: string, link: string, image: string }[] = [];

            // Debug: Log all links
            const DEBUG_anchors = Array.from(document.querySelectorAll('a'));
            // console.log('DEBUG: Total anchors found:', DEBUG_anchors.length);

            // Find all anchors pointing to places
            // TRY RELATIVE PATH MATCH TOO just in case href gives full path issues (unlikely for selector but good for manually checking)
            const anchors = Array.from(document.querySelectorAll('a[href*="/travel/places/"], a[href*="places"]'));

            // Deduplicate by href
            const seen = new Set();

            anchors.forEach((a: any) => {
                if (seen.has(a.href)) return;
                seen.add(a.href);

                // Try to find title & image relative to anchor
                // Usually the anchor wraps the card or is inside it
                // Strategy: 
                // 1. Look for H4 nearby or inside
                // 2. Look for Image inside

                let title = '';
                let image = '';

                // Title
                const titleEl = a.querySelector('h4') || a.closest('div')?.querySelector('h4');
                if (titleEl) title = titleEl.textContent?.trim() || '';

                // If no title found, use placeholder causing detail scrape to fill it
                if (!title) title = 'Pending';

                // Image
                const imgTag = a.querySelector('img') || a.closest('div')?.querySelector('img');
                if (imgTag) image = imgTag.src;
                else {
                    const bgDiv = a.querySelector('div[style*="background-image"]');
                    if (bgDiv) {
                        const style = window.getComputedStyle(bgDiv);
                        const urlMatch = style.backgroundImage.match(/url\("?(.+?)"?\)/);
                        if (urlMatch) image = urlMatch[1];
                    }
                }

                results.push({ title, link: a.href, image });
            });
            return results;
        });

        console.log(`Found ${listItems.length} items to process.`);

        // Detail Scraping
        const finalItems: MomMomItem[] = [];
        const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
        bar.start(listItems.length, 0);

        // Batch processing to respect resources
        const CHUNK_SIZE = 5;
        for (let i = 0; i < listItems.length; i += CHUNK_SIZE) {
            const chunk = listItems.slice(i, i + CHUNK_SIZE);
            const promises = chunk.map(async (item) => {
                const detailPage = await browser.newPage();
                try {
                    // Block images on detail to speed up
                    await detailPage.setRequestInterception(true);
                    detailPage.on('request', (req) => {
                        if (['image', 'media', 'font'].includes(req.resourceType())) req.abort();
                        else req.continue();
                    });

                    await detailPage.goto(item.link, { waitUntil: 'networkidle2', timeout: 30000 });

                    // Wait for dynamic content to hydrate
                    await detailPage.waitForSelector('p.value', { timeout: 5000 }).catch(() => { });

                    // Scrape Details using correct selectors
                    const details = await detailPage.evaluate(() => {
                        // Title from H1/H2
                        const pageTitle = document.querySelector('h1')?.textContent?.trim() ||
                            document.querySelector('h2')?.textContent?.trim() || '';

                        // Address: Find p.key with "주소" and get its sibling p.value
                        let address = '';
                        const allKeyElements = Array.from(document.querySelectorAll('p.key'));
                        const addressKey = allKeyElements.find(el => el.textContent?.trim() === '주소');
                        if (addressKey && addressKey.nextElementSibling) {
                            address = addressKey.nextElementSibling.textContent?.trim() || '';
                            // Clean common artifacts
                            address = address.replace('지도보기', '').trim();
                        }

                        // Operating Hours: Find p.key with "영업시간" and get content
                        let closedDay = '';
                        let hasHoliday = false;
                        const hoursKey = allKeyElements.find(el => el.textContent?.trim() === '영업시간');
                        if (hoursKey && hoursKey.parentElement) {
                            const hoursContainer = hoursKey.parentElement;
                            const hoursText = hoursContainer.textContent || '';

                            // Check for holiday patterns
                            if (hoursText.includes('정기휴무')) {
                                hasHoliday = true;
                                // Extract specific holiday days
                                const holidayMatch = hoursText.match(/([가-힣]+요일[가-힣]*정기휴무)/g);
                                if (holidayMatch) {
                                    closedDay = holidayMatch.join(' ');
                                } else {
                                    // Fallback: extract any text with 정기휴무
                                    const matches = hoursText.match(/[가-힣]+정기휴무/g);
                                    if (matches) closedDay = matches.join(' ');
                                }
                            }

                            // If no holiday mentioned but hours exist, it's "연중무휴"
                            if (!hasHoliday && hoursText.length > 10 && (hoursText.includes('월요일') || hoursText.includes('매일'))) {
                                closedDay = '연중무휴';
                            }
                        }

                        // Price: Find section with h2 containing "요금"
                        let price = '';
                        const sections = Array.from(document.querySelectorAll('section'));
                        for (const section of sections) {
                            const h2 = section.querySelector('h2');
                            if (h2 && h2.textContent?.includes('요금')) {
                                const listItems = Array.from(section.querySelectorAll('li'));
                                for (const li of listItems) {
                                    const text = li.textContent?.trim() || '';
                                    // Skip section headers like "[요금]"
                                    if (text === '[요금]') continue;
                                    // Look for price patterns
                                    if (text.includes('원') || text.includes('무료')) {
                                        price = text;
                                        break;
                                    }
                                }
                                break;
                            }
                        }

                        // Fallback for price: Look for 무료 anywhere
                        if (!price) {
                            const bodyText = document.body.innerText;
                            if (bodyText.includes('입장료: 무료') || bodyText.includes('입장료 무료')) {
                                price = '무료';
                            }
                        }

                        // Image from swiper or og:image
                        let detailImage = '';
                        const ogImg = document.querySelector('meta[property="og:image"]');
                        if (ogImg) detailImage = ogImg.getAttribute('content') || '';
                        if (!detailImage) {
                            const firstImg = document.querySelector('.swiper-slide img, img');
                            if (firstImg) detailImage = (firstImg as HTMLImageElement).src;
                        }

                        return { address, closedDay, price, pageTitle, detailImage };
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
                    const safeTitle = r.title.replace(/\s/g, '').slice(0, 15);
                    const id = `mommom_${safeTitle}`;

                    finalItems.push({
                        id,
                        title: r.title,
                        image: r.image,
                        link: r.link,
                        date: r.closedDay || '연중무휴', // Map closed day to date!
                        genre: determineGenre(r.title),
                        region: r.region,
                        venue: r.address || r.title, // Venue name often matches title for museums
                        address: r.address,
                        latitude: r.latitude,
                        longitude: r.longitude,
                        originalPrice: '', // No distinct original price scraped yet
                        price: r.price || '무료',
                        rate: 0,
                        platform: 'mommom'
                    });
                }
            });
            bar.increment(chunk.length);
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
