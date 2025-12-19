import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

const TARGET_URL = 'https://www.sssd.co.kr/m/search/class/category?midx=all';
const OUTPUT_FILE = path.join(__dirname, '../src/data/sssd-class.json');
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function scrape() {
    console.log('Starting SSSD Scraper...');

    // Launch Browser
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--window-size=1920,1080',
            '--lang=ko-KR' // Set browser language
        ]
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent(USER_AGENT);

        // Critical: Set Accept-Language to Korean
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
        });

        await page.setViewport({ width: 1920, height: 1080 });

        console.log(`Navigating to ${TARGET_URL}...`);

        // Force Korean Language via Cookie
        await page.setCookie({
            name: 'SSSD_MW_LANG',
            value: 'ko-KR',
            domain: '.sssd.co.kr'
        });

        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for list
        const listSelector = '#classCategoryBody > div.search-result-panel > div > div.search-result-list.list-type-1.p-l-0.p-r-0.no-padding > ul > li';
        try {
            await page.waitForSelector(listSelector, { timeout: 15000 });
        } catch (e) {
            console.error('List selector not found immediately. Waiting a bit longer...');
            await new Promise(r => setTimeout(r, 3000));
        }

        // Scroll to load more items
        console.log('Scrolling to load items...');
        await page.evaluate(async () => {
            await new Promise<void>((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                let scrolls = 0;
                const maxScrolls = 50;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    scrolls++;

                    if (scrolls >= maxScrolls || totalHeight >= scrollHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        // Extract List Items
        console.log('Extracting list items...');
        const items = await page.evaluate((selector) => {
            const elements = Array.from(document.querySelectorAll(selector));
            return elements.map(el => {
                const linkEl = el.querySelector('a');
                if (!linkEl) return null;

                const link = linkEl.href;
                const titleEl = el.querySelector('div.list-subject.text-line-restrict.text-2-line');
                const title = titleEl ? (titleEl as HTMLElement).innerText.trim() : '';

                // Helper to extract image URL from background-image
                const imgDiv = el.querySelector('div.list-img > div');
                let image = '';
                if (imgDiv) {
                    const style = (imgDiv as HTMLElement).getAttribute('style');
                    // Match url("...") or url(...)
                    if (style) {
                        const match = style.match(/url\(["']?(.+?)["']?\)/);
                        if (match) image = match[1];
                    }

                    // If no style url, check data-src on the div itself (lazy load)
                    if (!image) {
                        image = (imgDiv as HTMLElement).getAttribute('data-src') || '';
                    }
                }

                // Fallback to img tag if background-image fails
                if (!image) {
                    const imgTag = el.querySelector('img');
                    if (imgTag) {
                        image = imgTag.getAttribute('data-original') || imgTag.getAttribute('data-src') || imgTag.src;
                    }
                }

                // Fallback: look for any div with unexpected structure
                if (!image) {
                    const anyImg = el.querySelector('.list-img img');
                    if (anyImg) {
                        image = anyImg.getAttribute('data-original') || anyImg.getAttribute('data-src') || (anyImg as HTMLImageElement).src;
                    }
                }

                return { title, link, image };
            }).filter(item => item && item.title && item.link);
        }, listSelector);

        console.log(`Found ${items.length} items. Starting detail scraping...`);

        const results: any[] = [];
        const total = items.length;

        // Detail Scraping Loop
        for (let i = 0; i < total; i++) {
            const item = items[i];
            if (!item) continue;

            const progress = `[${i + 1}/${total}]`;
            process.stdout.write(`${progress} Scraping ${item.title.substring(0, 20)}... \r`);

            if (!item.link.startsWith('http')) continue;

            try {
                const detailPage = await browser.newPage();
                await detailPage.setUserAgent(USER_AGENT);

                // Set Header for Detail Page too
                await detailPage.setExtraHTTPHeaders({
                    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
                });

                await detailPage.setCookie({
                    name: 'SSSD_MW_LANG',
                    value: 'ko-KR',
                    domain: '.sssd.co.kr'
                });

                await detailPage.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 30000 });

                // Explicit wait for summary to ensure dynamic content loads
                try {
                    await detailPage.waitForSelector('.class-detail-summery-area', { timeout: 5000 });
                } catch (e) {
                    // ignore timeout, proceed
                }

                // Wait a bit more for text hydration
                await new Promise(r => setTimeout(r, 1000));

                const detailInfo = await detailPage.evaluate(() => {
                    // 1. Address Extraction: Improved Robustness
                    let location = '';
                    const locationEl = document.querySelector('#placeCopy');
                    if (locationEl) {
                        location = locationEl.getAttribute('data-clipboard-text') || '';
                        if (!location || location === 'Copy Address' || location === '주소복사') {
                            location = (locationEl as HTMLElement).innerText.trim();
                        }
                    }

                    // Fallback: look for ANY element with class containing 'address' or strict text
                    if (!location || location.includes('http') || location === 'Copy Address' || location === '주소복사') {
                        // Try to find the summary text explicitly
                        const addressSpan = document.querySelector('.class-detail-place-copy, .address-text');
                        if (addressSpan) location = (addressSpan as HTMLElement).textContent?.trim() || '';
                    }

                    // Regex Fallback (Final Resort)
                    if (!location || location === 'Copy Address' || location === '주소복사') {
                        const bodyText = document.body.innerText;
                        const match = bodyText.match(/[가-힣]+[시도]?\s*[가-힣]+[구군시]\s+[가-힣\d]+[로길동가읍면].+/);
                        if (match) location = match[0];
                    }

                    // Cleanup
                    if (location === 'Copy Address' || location === '주소복사') location = '상세페이지 참조';


                    // 2. Summary Info: Use Class Logic
                    let parking = '';
                    let time = '';
                    let capacity = '';

                    const summaryDivs = Array.from(document.querySelectorAll('.class-detail-summery-area > div'));
                    if (summaryDivs.length >= 4) {
                        // Usually index 1 is Parking, 2 is Time, 3 is Capacity (0 is partial address)
                        if (summaryDivs[1]) parking = (summaryDivs[1] as HTMLElement).innerText.trim();
                        if (summaryDivs[2]) time = (summaryDivs[2] as HTMLElement).innerText.trim();
                        if (summaryDivs[3]) capacity = (summaryDivs[3] as HTMLElement).innerText.trim();
                    }


                    // 3. Price
                    let discountRate = '';
                    let originalPrice = '';
                    let finalPrice = '';

                    // Try getting strictly from price bar
                    const priceRow = document.querySelector('#price-bar .row .detail_txt');
                    if (priceRow) {
                        const discountEl = priceRow.querySelector('.discount_rate');
                        const baseEl = priceRow.querySelector('.base_price');

                        if (discountEl) discountRate = (discountEl as HTMLElement).innerText.trim();
                        if (baseEl) originalPrice = (baseEl as HTMLElement).innerText.trim();

                        // Final price is the identifying text (could be in .price01 or just text node)
                        const raw = (priceRow as HTMLElement).innerText;
                        // Remove discount and base to find final
                        let remain = raw.replace(discountRate, '').replace(originalPrice, '').trim();
                        // Clean up newlines
                        finalPrice = remain.split('\n').pop()?.trim() || '';
                    } else {
                        // Fallback to title area price if bar missing
                        const listPrice = document.querySelector('.list-price');
                        if (listPrice) finalPrice = (listPrice as HTMLElement).innerText.trim();
                    }

                    return { location, parking, time, capacity, discountRate, originalPrice, finalPrice };
                });

                await detailPage.close();

                // Clean tags
                const tags = [
                    detailInfo.parking,
                    detailInfo.time,
                    detailInfo.capacity
                ].filter(s => s && s.trim() !== '' && !['Copy Address', '주소복사'].includes(s) && !s.includes('http'));

                results.push({
                    id: `sssd-${i}`,
                    title: item.title,
                    date: '상시', // Class
                    venue: detailInfo.location || '장소 정보 없음',
                    // Split fields for correct UI rendering
                    price: detailInfo.finalPrice || '가격 정보 없음',
                    originalPrice: detailInfo.originalPrice,
                    discount: detailInfo.discountRate,

                    image: item.image,
                    link: item.link,
                    genre: 'class',
                    source: 'sssd',
                    tags: tags,
                    status: 'OPEN'
                });

            } catch (err) {
                console.error(`\nError scraping ${item.link}:`, err);
            }
        }

        console.log(`\nScraping complete! Saved ${results.length} items to ${OUTPUT_FILE}`);

        const dir = path.dirname(OUTPUT_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));

    } catch (e) {
        console.error('Fatal Error:', e);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

scrape();
