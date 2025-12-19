
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
        headless: "new",
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--window-size=1920,1080'
        ]
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent(USER_AGENT);
        await page.setViewport({ width: 1920, height: 1080 });

        console.log(`Navigating to ${TARGET_URL}...`);
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for list
        const listSelector = '#classCategoryBody > div.search-result-panel > div > div.search-result-list.list-type-1.p-l-0.p-r-0.no-padding > ul > li';
        try {
            await page.waitForSelector(listSelector, { timeout: 15000 });
        } catch (e) {
            console.error('List selector not found immediately. Waiting a bit longer...');
            await new Promise(r => setTimeout(r, 3000));
        }

        // Scroll to load more items (optional but recommended for infinite scroll pages)
        console.log('Scrolling to load items...');
        await page.evaluate(async () => {
            await new Promise<void>((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                let scrolls = 0;
                const maxScrolls = 50; // Limit scroll to avoid infinite loops
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

                const priceEl = el.querySelector('div.list-price');
                const price = priceEl ? (priceEl as HTMLElement).innerText.replace(/\n/g, ' ').trim() : '';

                const imgDiv = el.querySelector('div.list-img > div');
                let image = '';
                if (imgDiv) {
                    const style = (imgDiv as HTMLElement).getAttribute('style');
                    if (style && style.includes('url(')) {
                        const match = style.match(/url\("?(.+?)"?\)/);
                        if (match) image = match[1];
                    }
                }

                return { title, link, price, image };
            }).filter(item => item && item.title && item.link);
        }, listSelector);

        console.log(`Found ${items.length} items. Starting detail scraping...`);

        const results: any[] = [];
        const total = items.length;

        // Detail Scraping Loop
        for (let i = 0; i < total; i++) {
            const item = items[i];
            // Safe check
            if (!item) continue;

            const progress = `[${i + 1}/${total}]`;
            // Log to stdout/stderr in a way that shows progress
            process.stdout.write(`${progress} Scraping ${item.title.substring(0, 20)}... \r`);

            // Skip if invalid link
            if (!item.link.startsWith('http')) continue;

            try {
                const detailPage = await browser.newPage();
                await detailPage.setUserAgent(USER_AGENT);
                await detailPage.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 30000 });

                // Wait a bit for dynamic content
                await new Promise(r => setTimeout(r, 1000));

                const detailInfo = await detailPage.evaluate(() => {
                    const locationEl = document.querySelector('#placeCopy');
                    let location = locationEl ? locationEl.getAttribute('data-clipboard-text') : '';

                    if (!location || location.includes('http') || location === 'Copy Address' || location === '주소복사') {
                        const addressSpan = document.querySelector('span.address-text');
                        if (addressSpan) location = (addressSpan as HTMLElement).textContent?.trim() || '';
                    }

                    if (!location || location === 'Copy Address' || location === '주소복사') {
                        const bodyText = document.body.innerText;
                        // Relaxed regex for road addresses (matches "City Gu Road/Dong ...")
                        const match = bodyText.match(/[가-힣]+[시도]?\s*[가-힣]+[구군시]\s+[가-힣\d]+[로길동가읍면].+/);
                        if (match) location = match[0];
                    }

                    if (!location && locationEl) {
                        const text = (locationEl as HTMLElement).innerText.trim();
                        if (text !== 'Copy Address' && text !== '주소복사') {
                            location = text;
                        } else {
                            location = '상세페이지 참조';
                        }
                    }

                    const summaryArea = document.querySelector('body > div.content.opened > div.container.no-lr-padding > div.class-detail-summery-area');

                    let parking = '';
                    let time = '';
                    let capacity = '';

                    if (summaryArea) {
                        const div2 = summaryArea.querySelector('div:nth-child(2)');
                        const div3 = summaryArea.querySelector('div:nth-child(3)');
                        const div4 = summaryArea.querySelector('div:nth-child(4)');

                        if (div2) parking = (div2 as HTMLElement).innerText.trim();
                        if (div3) time = (div3 as HTMLElement).innerText.trim();
                        if (div4) capacity = (div4 as HTMLElement).innerText.trim();
                    }

                    return { location, parking, time, capacity };
                });

                await detailPage.close();

                // Format "venue" to include key info
                // The user asked to show location. And also asked to show parking, time, capacity "like travel category at the bottom".
                // Since I am just producing a JSON object, I'll store them in fields. 
                // The 'venue' field in the main app is usually displayed prominently. I'll put the address there.
                // The other fields (parking, time, capacity) might need to be appended to the venue or stored in `tags` or `description` if the UI doesn't support custom fields.
                // Reviewing `page.tsx`: it uses `PerformanceItem` which displays `venue`. 
                // Travel items usually don't have special fields in `PerformanceItem` unless customized.
                // However, I can create a composite string for one of the fields or use `tags`.
                // Let's store them as extra properties for now, but also composite them into `venue` or a new field if needed.
                // Actually, `PerformanceListItem` usually shows `venue` and `date`.
                // I'll put the address in `venue`.
                // I'll put the extra info in `tags` because that's a common way to show extra pills/info.

                const tags = [detailInfo.parking, detailInfo.time, detailInfo.capacity].filter(s => s && s.trim() !== '' && !['Copy Address', '주소복사'].includes(s) && !s.includes('http'));

                results.push({
                    id: `sssd-${i}`, // Simple ID
                    title: item.title,
                    date: '상시', // Class
                    venue: detailInfo.location || '장소 정보 없음',
                    price: item.price,
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

        // Ensure directory exists
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
