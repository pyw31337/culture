import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';

puppeteer.use(StealthPlugin());

const TARGET_URL = 'https://mom-mom.net/shop/categories/1102241';
const OUTPUT_FILE = path.resolve(process.cwd(), 'src/data/mommom-debug.json');

async function scrapeCategory() {
    console.log(`Targeting Category: ${TARGET_URL}`);
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    try {
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });
        console.log('Page loaded.');

        // Robust Load Logic: Scroll + Click "More"
        await page.evaluate(async () => {
            const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

            let lastHeight = 0;
            let noChange = 0;

            for (let i = 0; i < 50; i++) { // Try 50 loops
                // 1. Scroll to bottom
                window.scrollTo(0, document.body.scrollHeight);
                await delay(1000); // Wait for load

                // 2. Check for "More" button (common selectors)
                const buttons = Array.from(document.querySelectorAll('button'));
                const moreBtn = buttons.find(b => b.textContent?.includes('더보기') || b.textContent?.includes('More'));
                if (moreBtn) {
                    console.log('Clicking "More" button...');
                    moreBtn.click();
                    await delay(1000);
                }

                // 3. Check height change
                const newHeight = document.body.scrollHeight;
                if (newHeight === lastHeight) {
                    noChange++;
                } else {
                    noChange = 0;
                }
                lastHeight = newHeight;

                if (noChange > 5) break; // Stop if stuck
                console.log(`Scroll Loop ${i + 1}: Height ${newHeight}`);
            }
        });

        // Scrape Items
        const listItems = await page.evaluate(() => {
            const items: any[] = [];
            document.querySelectorAll('a').forEach(a => {
                // Heuristic: Link contains 'shop' or 'places' and has an image or title
                const href = a.href;
                const text = a.innerText;
                if ((href.includes('/shop/') || href.includes('/places/')) && text.length > 2) {
                    const title = a.querySelector('h4')?.textContent ||
                        a.querySelector('.title')?.textContent ||
                        a.innerText.split('\n')[0];
                    if (title) items.push({ title: title.trim(), link: href });
                }
            });
            // Deduplicate
            return items.filter((v, i, a) => a.findIndex(t => (t.link === v.link)) === i);
        });

        console.log(`Final Item Count: ${listItems.length}`);

        // Check for targets
        const targets = ['상상체험', '서울랜드', '자이언트'];
        targets.forEach(t => {
            const matches = listItems.filter(i => i.title.includes(t));
            console.log(`Searching for '${t}': Found ${matches.length} items.`);
            if (matches.length > 0) console.log(matches[0]);
        });

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(listItems, null, 2));
        fs.writeFileSync('debug_final.html', await page.content());

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}

scrapeCategory();
