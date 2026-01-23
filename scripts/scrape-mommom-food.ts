import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';
import cliProgress from 'cli-progress';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

puppeteer.use(StealthPlugin());

const TARGET_URL = 'https://mom-mom.net/search?q=%EC%8B%9D%EB%8B%B9%2F%EC%B9%B4%ED%8E%98&hl=places'; // Search: 식당/카페
const OUTPUT_FILE = path.resolve(process.cwd(), 'src/data/mommom-food.json');
const TARGET_COUNT = 3247;

// Helper to clean address
function cleanAddress(addr: string): string {
    return addr.replace('주소', '').trim();
}

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

interface MomMomItem {
    id: string;
    title: string;
    image: string;
    link: string;
    date: string;
    genre: string;
    region: string;
    venue: string;
    address: string;
    latitude: number;
    longitude: number;
    originalPrice: number | string;
    price: number | string;
    rate: number;
    platform: string;
    description?: string;
    closedDay?: string;
}

// Custom delay function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function scrapeMomMomFood() {
    console.log('Starting Mom-Mom Food Scraper (High Volume / Low Load)...');

    // Launch browser
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        // Go to search page
        console.log(`Navigating to ${TARGET_URL}...`);
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        // Scroll to load all items
        console.log('Scrolling to load items...');
        await page.evaluate(async (targetCount) => {
            await new Promise<void>((resolve) => {
                let totalHeight = 0;
                let noChangeCount = 0;
                const distance = 800; // Scroll slightly more per tick
                let lastScrollHeight = 0;
                let itemsCount = 0;

                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    // Check items count
                    itemsCount = document.querySelectorAll('a[href*="/travel/places/"]').length;

                    if (itemsCount >= targetCount) {
                        // Found enough items
                        clearInterval(timer);
                        resolve();
                        return;
                    }

                    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
                        if (document.body.scrollHeight > lastScrollHeight) {
                            noChangeCount = 0;
                            lastScrollHeight = document.body.scrollHeight;
                        } else {
                            noChangeCount++;
                        }
                    } else {
                        noChangeCount = 0;
                    }

                    // Stop if no change for very long time (network error or true end)
                    if (noChangeCount > 200) { // Slower wait
                        clearInterval(timer);
                        resolve();
                    }
                }, 200); // 200ms per scroll - gentle
            });
        }, TARGET_COUNT);

        // Extract Links
        const listItems = await page.evaluate(() => {
            const results: { title: string, link: string, image: string }[] = [];
            const anchors = Array.from(document.querySelectorAll('a[href*="/travel/places/"], a[href*="places"]'));
            const seen = new Set();

            anchors.forEach((a: any) => {
                if (seen.has(a.href)) return;
                seen.add(a.href);

                let title = '';
                let image = '';

                // Title
                const titleEl = a.querySelector('h4') || a.closest('div')?.querySelector('h4');
                if (titleEl) title = titleEl.textContent?.trim() || '';
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

        console.log(`Found ${listItems.length} items.`);

        // Determine items to process
        // We will append to existing list or file
        let existingData: MomMomItem[] = [];
        if (fs.existsSync(OUTPUT_FILE)) {
            existingData = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
        }

        // Filter out already complete items with efficiency logic
        const toProcess = listItems.filter(item => {
            const existing = existingData.find(e => e.link === item.link);
            if (!existing) return true;

            // Efficiency: Skip if description exists. Food spots are generally "permanent".
            // User requested: "Exclude permanent info from periodic crawling"
            if (existing.description && existing.description.length > 10) return false;

            return true;
        });

        console.log(`${toProcess.length} items need scraping.`);

        const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
        bar.start(toProcess.length, 0);

        const finalItems: MomMomItem[] = [...existingData];
        const detailPage = await browser.newPage();

        // Optimization: Block images on detail page
        await detailPage.setRequestInterception(true);
        detailPage.on('request', (req) => {
            if (['image', 'media', 'font'].includes(req.resourceType())) req.abort();
            else req.continue();
        });

        // Loop with improved rate limiting
        for (let i = 0; i < toProcess.length; i++) {
            const item = toProcess[i];

            try {
                // Rate Limit Delay
                await delay(500 + Math.random() * 500); // 0.5s - 1s delay

                await detailPage.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 30000 });

                // Wait briefly for content
                try { await detailPage.waitForSelector('article', { timeout: 3000 }); } catch { }

                const details = await detailPage.evaluate(() => {
                    // Title
                    const pageTitle = document.querySelector('h1')?.textContent?.trim() ||
                        document.querySelector('h2')?.textContent?.trim() || '';

                    // Address
                    let address = '';
                    const allKeyElements = Array.from(document.querySelectorAll('p.key'));
                    const addressKey = allKeyElements.find(el => el.textContent?.trim() === '주소');
                    if (addressKey) {
                        let valueEl = addressKey.nextElementSibling;
                        if (valueEl && valueEl.classList.contains('value')) {
                            address = valueEl.textContent?.trim() || '';
                        }
                        if (!address && addressKey.parentElement) {
                            const parentValue = addressKey.parentElement.querySelector('p.value');
                            if (parentValue) address = parentValue.textContent?.trim() || '';
                        }
                    }
                    if (!address) {
                        const addrMatch = document.body.innerText.match(/([가-힣]+(시|도)\s+[가-힣]+(시|군|구)\s+[가-힣0-9\s\-]+)/);
                        if (addrMatch) address = addrMatch[1].split('\n')[0].trim();
                    }

                    // Description: Feature / Target / Hours
                    // 특징 (Feature)
                    let feature = '';
                    const descP = document.querySelector('p.item-description');
                    if (descP) {
                        feature = descP.textContent?.trim() || '';
                    }
                    if (!feature) {
                        const articleP = document.querySelector('article > div > p');
                        if (articleP) feature = articleP.textContent?.trim() || '';
                    }

                    // 대상 (Target Audience)
                    let target = '';
                    const allPs = Array.from(document.querySelectorAll('article p'));
                    const targetEl = allPs.find(el => {
                        const text = el.textContent || '';
                        return (text.includes('인기') && text.includes('개월')) ||
                            (text.includes('세') && text.includes('이상')) ||
                            (text.includes('모두') && text.includes('추천'));
                    });

                    if (targetEl) {
                        target = targetEl.textContent?.replace(/\n/g, ' ').trim() || '';
                        target = target.replace(/\d{4}\.\d{2}\.\d{2}.*업데이트.*/, '').trim();
                    }

                    // 운영 (Operating Hours)
                    let operatingHours = '';
                    let closedDay = '';
                    let daysWithHours = 0;
                    let hasHoliday = false;

                    const hoursKey = allKeyElements.find(el => el.textContent?.trim() === '영업시간');
                    if (hoursKey && hoursKey.parentElement) {
                        const hoursContainer = hoursKey.parentElement;
                        const hoursText = hoursContainer.textContent || '';
                        const hourLines: string[] = [];
                        const dayPatterns = ['월요일', '화요일', '수요일', '목요일', '금요일', '토요일', '일요일'];

                        // Closed Day
                        if (hoursText.includes('정기휴무')) {
                            hasHoliday = true;
                            const dayMatches = hoursText.match(/([월화수목금토일]요일)\s*정기휴무/g);
                            if (dayMatches) closedDay = dayMatches.map(m => m.replace('정기휴무', '').trim()).join('/') + ' 정기휴무';
                            else closedDay = '정기휴무';
                        }
                        if (!hasHoliday && hoursText.includes('매일')) closedDay = '연중무휴';

                        // Operating Hours String
                        for (const day of dayPatterns) {
                            const idx = hoursText.indexOf(day);
                            if (idx !== -1) {
                                const afterDay = hoursText.substring(idx, idx + 30);
                                const timeMatch = afterDay.match(/(\d{1,2}:\d{2}\s*~\s*\d{1,2}:\d{2})/);
                                if (timeMatch && !afterDay.includes('정기휴무')) {
                                    daysWithHours += 1; // Approximate counting since loop breaks for extraction
                                    // Actually need to check each day properly for count, but for extraction we take first
                                    const timeStr = timeMatch[1];
                                    const dayAbbrev = day.replace('요일', '');
                                    hourLines.push(`${dayAbbrev}: ${timeStr}`);
                                    break; // Just extract one for now as representative
                                }
                            }
                        }

                        // Re-count days properly
                        daysWithHours = 0;
                        dayPatterns.forEach(d => {
                            if (hoursText.includes(d) && !hoursText.substring(hoursText.indexOf(d), hoursText.indexOf(d) + 20).includes('정기휴무')) {
                                daysWithHours++;
                            }
                        });


                        if (hourLines.length > 0) {
                            if (daysWithHours >= 7 || hoursText.includes('매일')) {
                                operatingHours = `매일 ${hourLines[0].split(': ')[1]}`;
                                if (!closedDay) closedDay = '연중무휴';
                            } else if (daysWithHours >= 5) {
                                operatingHours = `월-일 ${hourLines[0].split(': ')[1]}`;
                            } else {
                                operatingHours = hourLines.join(', ');
                            }
                        }
                    }

                    // Price (Food) - Usually "Menu"
                    // Try to find menu items or price range
                    let price = '';
                    // Look for "메뉴" section or similar
                    const menuKey = allKeyElements.find(el => el.textContent?.trim() === '메뉴' || el.textContent?.trim() === '가격');
                    if (menuKey && menuKey.parentElement) {
                        price = menuKey.parentElement.textContent?.replace('메뉴', '').trim().substring(0, 50) + '...' || '';
                    } else {
                        // Try regex for currency
                        const priceMatch = document.body.innerText.match(/([가-힣\w\s]+)\s*[\-:]?\s*(\d{1,3}(,\d{3})*원)/);
                        if (priceMatch) price = priceMatch[0];
                    }
                    if (!price) price = '변동'; // Variable price commonly used for food

                    // Description
                    let description = '';
                    if (feature) description += `[특징] ${feature}\n`;
                    if (target) description += `[대상] ${target}\n`;
                    if (operatingHours) description += `[운영] ${operatingHours}`;

                    // Image fallback from og:image
                    const ogImg = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';

                    return {
                        pageTitle, address, closedDay, price, description, ogImg
                    };
                });

                // Merge
                const finalTitle = (item.title && item.title !== 'Pending') ? item.title : details.pageTitle;
                const finalImage = item.image || details.ogImg;

                // Clean Addr
                const cleanAddr = details.address.replace('주소', '').trim();
                const region = classifyRegion(cleanAddr);

                // Coords
                let coords = { lat: 0, lng: 0 };
                const regionKey = Object.keys(REGION_COORDS).find(k => cleanAddr.includes(k));
                if (regionKey) coords = REGION_COORDS[regionKey];

                const newItem: MomMomItem = {
                    id: `mommom_food_${finalTitle.replace(/\s/g, '').slice(0, 10)}`,
                    title: finalTitle,
                    image: finalImage,
                    link: item.link,
                    date: details.closedDay || '연중무휴',
                    genre: 'food',
                    region,
                    venue: finalTitle, // Venue is the place itself
                    address: cleanAddr,
                    latitude: coords.lat,
                    longitude: coords.lng,
                    originalPrice: '',
                    price: details.price,
                    rate: 0, // No rating 
                    platform: 'mommom',
                    description: details.description
                };

                // Update or push
                const existIdx = finalItems.findIndex(e => e.link === item.link);
                if (existIdx >= 0) {
                    finalItems[existIdx] = newItem;
                } else {
                    finalItems.push(newItem);
                }

                // Save periodically (every 50 items)
                if (i % 50 === 0) {
                    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalItems, null, 2));
                }

                bar.increment();

            } catch (e) {
                console.error(`Failed ${item.link}: ${e}`);
            }
        }
        bar.stop();

        // Final Save
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalItems, null, 2));
        console.log(`Saved ${finalItems.length} items to ${OUTPUT_FILE}`);

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

scrapeMomMomFood();
