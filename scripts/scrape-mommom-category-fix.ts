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

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    try {
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });
        console.log('Page loaded.');

        // Simply try to get title
        const title = await page.evaluate(() => {
            return document.title;
        });
        console.log('Page Title:', title);

        // Try simpler scroll logic without async/await inside if possible, or just standard async
        await page.evaluate(async () => {
            console.log('Starting scroll...');
            // minimal wait
            await new Promise(r => setTimeout(r, 1000));
            window.scrollTo(0, 100);
            console.log('Scrolled.');
        });

        // If we get here, the basic evaluate works.
        // Now try the scrape logic
        const listItems = await page.evaluate(() => {
            const items = [];
            const links = document.querySelectorAll('a');
            for (const a of links) {
                const href = a.href;
                if (href.includes('/shop/') || href.includes('/places/')) {
                    items.push({ link: href, text: a.innerText });
                }
            }
            return items;
        });

        console.log(`Found ${listItems.length} items (simple scrape).`);
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(listItems, null, 2));

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}

scrapeCategory();
