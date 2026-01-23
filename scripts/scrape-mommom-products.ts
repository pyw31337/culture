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

// Smart genre classification based on title keywords
function classifyGenre(title: string): string {
    const t = title.toLowerCase();

    // Travel
    if (t.includes('호텔') || t.includes('리조트') || t.includes('펜션') ||
        t.includes('숙박') || t.includes('스테이') || t.includes('글램핑') ||
        t.includes('캠핑') || t.includes('풀빌라')) {
        return 'travel';
    }

    // Kids - specific kids places
    if (t.includes('키즈') || t.includes('어린이') || t.includes('유아') ||
        t.includes('아이랑') || t.includes('베이비') || t.includes('놀이터') ||
        t.includes('키카')) {
        return 'kids';
    }

    // Leisure - water/outdoor activities  
    if (t.includes('워터파크') || t.includes('수영') || t.includes('스파') ||
        t.includes('온천') || t.includes('찜질') || t.includes('사우나') ||
        t.includes('스키') || t.includes('스노우') || t.includes('썰매')) {
        return 'leisure';
    }

    // Museum/Experience
    if (t.includes('박물관') || t.includes('과학관') || t.includes('미술관') ||
        t.includes('전시') || t.includes('아쿠아리움') || t.includes('수족관') ||
        t.includes('동물원') || t.includes('식물원') || t.includes('테마파크')) {
        return 'museum';
    }

    // Class - educational experiences
    if (t.includes('클래스') || t.includes('체험') || t.includes('만들기') ||
        t.includes('공방') || t.includes('쿠킹') || t.includes('베이킹') ||
        t.includes('도자기') || t.includes('공예')) {
        return 'class';
    }

    // Food
    if (t.includes('식당') || t.includes('레스토랑') || t.includes('카페') ||
        t.includes('맛집') || t.includes('뷔페') || t.includes('브런치')) {
        return 'food';
    }

    // Default to activity for general experiences
    return 'activity';
}

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

        // Extract Items using h4 titles (data-id only exists on 4 featured items)
        const listItems = await page.evaluate(() => {
            const results: any[] = [];
            const seenTitles = new Set();

            const h4s = document.querySelectorAll('h4');
            console.log('Found h4 elements:', h4s.length);

            h4s.forEach(h4 => {
                const title = h4.textContent?.trim() || '';
                if (!title || seenTitles.has(title)) return;
                seenTitles.add(title);

                // Find the parent card container
                let card = h4.closest('.sc-fd2f9237-27') || h4.parentElement?.parentElement;
                if (!card) return;

                // Get image
                const imgEl = card.querySelector('img');
                const image = imgEl?.src || '';

                // Get price
                const priceEl = card.querySelector('p span:last-child');
                const price = priceEl?.textContent?.trim() || '';

                // Get brand name if available
                const brandEl = card.querySelector('.brand-name');
                const brand = brandEl?.textContent?.trim() || '';

                // Generate ID from title (since data-id not available)
                const safeTitle = title.replace(/[^\w가-힣]/g, '').slice(0, 20);
                const id = `mommom_shop_${safeTitle}`;

                results.push({
                    id,
                    title,
                    brand,
                    image,
                    link: '', // Will need to click to get actual link
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
                genre: classifyGenre(item.title),
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
