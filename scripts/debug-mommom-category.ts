import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const TARGET_URL = 'https://mom-mom.net/shop/categories/1102241';

async function debugScrape() {
    console.log(`Debugging URL: ${TARGET_URL}`);
    const browser = await puppeteer.launch({
        headless: false, // Visual debugging
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    try {
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });
        console.log('Page loaded.');

        // Check for specific items
        const missingItems = ['상상체험', '서울랜드', '자이언트'];

        // Scroll a bit
        await page.evaluate(async () => {
            await new Promise<void>((resolve) => {
                let totalHeight = 0;
                let noChange = 0;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, 500);
                    totalHeight += 500;

                    if (document.body.scrollHeight === scrollHeight) {
                        noChange++;
                    } else {
                        noChange = 0;
                    }

                    // Stop if no change for 20 steps (4 seconds) or very deep
                    if (noChange > 20 || totalHeight > 50000) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 200);
            });
        });

        // Take Screenshot
        await page.screenshot({ path: 'debug_category.png', fullPage: true });

        // Dump HTML
        const html = await page.content();
        console.log('HTML Dump Start');
        console.log(html.slice(0, 20000)); // First 20k chars

        const listItems = await page.evaluate(() => {
            const items: any[] = [];
            document.querySelectorAll('a').forEach(a => {
                // Look for product/place links more broadly
                if (a.href.includes('/shop/') || a.href.includes('/travel/')) {
                    const text = a.innerText.replace(/\n/g, ' ').trim();
                    if (text.length > 2) {
                        items.push({ text, href: a.href });
                    }
                }
            });
            return items;
        });

        console.log(`Found ${listItems.length} items.`);

        missingItems.forEach(query => {
            const found = listItems.find(i => i.text.includes(query));
            if (found) {
                console.log(`[SUCCESS] Found '${query}':`, found);
            } else {
                console.log(`[FAIL] Could not find '${query}' in list items.`);
            }
        });

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}

debugScrape();
