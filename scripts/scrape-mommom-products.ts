import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';
import cliProgress from 'cli-progress';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

puppeteer.use(StealthPlugin());

const TARGET_URL = 'https://mom-mom.net/shop/categories/1102241';
const OUTPUT_FILE = path.resolve(process.cwd(), 'src/data/mommom-products.json');

async function scrapeProducts() {
    console.log('Starting Mom-Mom Product Scraper...');
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

            for (let i = 0; i < 100; i++) {
                window.scrollTo(0, document.body.scrollHeight);
                await delay(1000);

                // Click More if exists
                const buttons = Array.from(document.querySelectorAll('button'));
                const moreBtn = buttons.find(b => b.textContent?.includes('더보기'));
                if (moreBtn) {
                    moreBtn.click();
                    await delay(1000);
                }

                const newHeight = document.body.scrollHeight;
                if (newHeight === lastHeight) noChange++;
                else noChange = 0;
                lastHeight = newHeight;

                if (noChange > 5) break;
            }
        });

        // Extract Items using data-id
        const listItems = await page.evaluate(() => {
            const results: any[] = [];

            const cards = document.querySelectorAll('div[data-id][role="button"]');

            cards.forEach(card => {
                const id = card.getAttribute('data-id');
                if (!id) return;

                // Title is sibling
                const parent = card.parentElement;

                let title = 'Unknown Title';
                const titleEl = parent?.querySelector('.product-name') || parent?.querySelector('h4');
                if (titleEl) title = titleEl.textContent?.trim() || 'Unknown Title';

                const imgEl = card.querySelector('img');
                const image = imgEl?.src || '';

                const priceEl = Array.from(parent?.querySelectorAll('div, span, p') || []).find(el => el.textContent?.includes('원'));
                const price = priceEl?.textContent?.trim() || '';

                results.push({
                    id: `mommom_product_${id}`,
                    title,
                    image,
                    link: `https://mom-mom.net/events/${id}`, // CORRECT URL
                    priceRaw: price
                });
            });
            return results;
        });

        console.log(`Found ${listItems.length} products to process.`);

        const finalItems: any[] = [];
        const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
        bar.start(listItems.length, 0);

        // Detail Scraping
        for (const item of listItems) {
            const newItem = {
                ...item,
                date: '상시',
                genre: 'kids',
                region: 'unknown',
                venue: 'unknown',
                address: '',
                latitude: 0,
                longitude: 0,
                platform: 'mommom',
                originalPrice: '',
                description: '',
                rate: 0
            };

            try {
                const detailPage = await browser.newPage();
                await detailPage.setRequestInterception(true);
                detailPage.on('request', (req) => {
                    if (['image', 'media', 'font'].includes(req.resourceType())) req.abort();
                    else req.continue();
                });

                await detailPage.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 30000 });

                // Scrape extra details + Title Fallback
                const detailInfo = await detailPage.evaluate(() => {
                    const text = document.body.innerText;

                    const pageTitle = document.querySelector('h1')?.textContent?.trim() ||
                        document.querySelector('h2')?.textContent?.trim() || '';

                    const addrMatch = text.match(/주소\s*[:]?\s*([가-힣0-9\s\-]+(시|도)\s[가-힣0-9\s\-]+(구|군|시))/);
                    const address = addrMatch ? addrMatch[1].trim() : '';

                    // Try to finding date text too
                    // "기간: 2024.12.01 ~ 2025.03.01"
                    // const dateMatch = text.match(/기간\s*[:]?\s*([0-9\.\s~]+)/);
                    // let date = dateMatch ? dateMatch[1].trim() : '';

                    return { address, pageTitle };
                });

                if (newItem.title === 'Unknown Title' && detailInfo.pageTitle) {
                    newItem.title = detailInfo.pageTitle;
                }

                if (detailInfo.address) {
                    newItem.address = detailInfo.address;
                    if (newItem.address.includes('서울')) newItem.region = 'seoul';
                    else if (newItem.address.includes('경기')) newItem.region = 'gyeonggi';
                    else if (newItem.address.includes('부산')) newItem.region = 'busan';
                    else if (newItem.address.includes('인천')) newItem.region = 'incheon';
                    else if (newItem.address.includes('대구')) newItem.region = 'daegu';
                    else if (newItem.address.includes('광주')) newItem.region = 'gwangju';
                    else if (newItem.address.includes('대전')) newItem.region = 'daejeon';
                    else if (newItem.address.includes('울산')) newItem.region = 'ulsan';
                    else newItem.region = 'etc';
                    newItem.venue = newItem.address.split(' ').slice(2).join(' ') || newItem.title;
                } else {
                    if (newItem.title.includes('서울')) newItem.region = 'seoul';
                    else if (newItem.title.includes('부산')) newItem.region = 'busan';
                    else if (newItem.title.includes('인천')) newItem.region = 'incheon';
                    else if (newItem.title.includes('일산') || newItem.title.includes('킨텍스')) newItem.region = 'gyeonggi';
                }

                await detailPage.close();
            } catch (e) {
                // Ignore
            }

            finalItems.push(newItem);
            bar.increment();
        }
        bar.stop();

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalItems, null, 2));
        console.log(`Saved ${finalItems.length} products to ${OUTPUT_FILE}`);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}

scrapeProducts();
