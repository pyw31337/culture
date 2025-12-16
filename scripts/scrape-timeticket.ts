import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

export interface Performance {
    id: string;
    title: string;
    image: string;
    date: string;
    venue: string;
    link: string;
    region: string;
    genre: string;
    price: string;
    originalPrice: string;
    discount: string;
    runningTime: string;
    ageLimit: string;
    casting: string;
    address?: string;
}

const OUTPUT_PATH = path.resolve(process.cwd(), 'src/data/timeticket.json');

// Region codes: 114 (Daehak-ro), 115 (Seoul), 120 (Gyeonggi/Incheon)
const REGION_CODES = [
    { code: 114, region: 'seoul' },
    { code: 115, region: 'seoul' },
    { code: 120, region: 'gyeonggi' },
];

/**
 * Simple CLI Progress Bar
 */
class ProgressBar {
    private total: number;
    private current: number;
    private barLength: number;

    constructor(total: number, barLength: number = 40) {
        this.total = total;
        this.current = 0;
        this.barLength = barLength;
    }

    update(current: number) {
        this.current = current;
        const percentage = (this.current / this.total) * 100;
        const filledLength = Math.round((this.barLength * this.current) / this.total);
        const emptyLength = this.barLength - filledLength;

        const bar = '█'.repeat(filledLength) + '░'.repeat(emptyLength);

        process.stdout.write(`\r[${bar}] ${percentage.toFixed(1)}% | ${this.current}/${this.total}`);
    }

    finish() {
        process.stdout.write('\n');
    }
}

async function scrapeTimeTicket() {
    console.log(`Starting TimeTicket Scraper...`);
    console.log(`Using executablePath: ${process.env.PUPPETEER_EXECUTABLE_PATH || 'Bundled'}`);

    // Launch options for better stability in varied environments
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1280,1024'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1024 });

    // Block only fonts and stylesheets to speed up, ALLOW IMAGES to prevent onerror
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (['font', 'stylesheet'].includes(req.resourceType())) {
            req.abort();
        } else {
            req.continue();
        }
    });

    const allItems: Performance[] = [];
    const seenTitles = new Set<string>();

    // 1. Collect Links
    console.log(`\nPhase 1: Collecting performance links...`);

    let pendingItems: { link: string, region: string, title: string, image: string, discount: string, price: string, genre: string }[] = [];

    // Categories: 2096 (Performance), 2100 (Exhibition)
    const CATEGORIES = [2096, 2100];

    for (const { code, region } of REGION_CODES) {
        for (const category of CATEGORIES) {
            const url = `https://timeticket.co.kr/list.php?category=${category}&area=${code}`;
            // console.log(`  Visiting ${url}...`);

            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

                // Wait for list to load
                try {
                    await page.waitForSelector('.ticket_list_wrap a', { timeout: 5000 });
                } catch (e) {
                    console.log(`  No items found or timeout for region ${code} category ${category}`);
                    continue;
                }

                const listItems = await page.evaluate((currentRegion, currentCategory) => {
                    const results: any[] = [];
                    // The structure seems to be div.ticket_list_wrap > a
                    const items = document.querySelectorAll('.ticket_list_wrap > a');

                    items.forEach((item) => {
                        const linkAttribute = item.getAttribute('href');
                        const link = linkAttribute ? (linkAttribute.startsWith('http') ? linkAttribute : 'https://timeticket.co.kr' + linkAttribute) : '';

                        const imgEl = item.querySelector('.thumb img');
                        const thumbDiv = item.querySelector('.thumb');

                        // Standard src extraction is sufficient now that we don't block images
                        let image = imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src') || '') : '';
                        if (image && !image.startsWith('http')) {
                            image = 'https://timeticket.co.kr' + image;
                        }

                        // Fallback to background image if extracted
                        if (!image && thumbDiv) {
                            const style = thumbDiv.getAttribute('style');
                            const match = style?.match(/url\(['"]?(.*?)['"]?\)/);
                            if (match) image = match[1];
                            if (image && !image.startsWith('http')) {
                                image = 'https://timeticket.co.kr' + image;
                            }
                        }

                        const titleEl = item.querySelector('.ticket_info .title');
                        const title = titleEl ? titleEl.textContent?.trim() || '' : '';

                        const categoryEl = item.querySelector('.ticket_info .category');
                        const categoryText = categoryEl ? categoryEl.textContent?.trim() || '' : '';

                        let genre = 'play';
                        if (currentCategory === 2100) {
                            genre = 'exhibition';
                        } else {
                            if (categoryText.includes('뮤지컬')) genre = 'musical';
                            else if (categoryText.includes('콘서트')) genre = 'concert';
                        }

                        const discountEl = item.querySelector('.sale_percent');
                        const discount = discountEl ? discountEl.textContent?.trim() || '' : '';

                        const priceEl = item.querySelector('.baro_price');
                        const price = priceEl ? priceEl.textContent?.trim() || '' : '';

                        if (link && title) {
                            results.push({
                                link,
                                region: currentRegion,
                                title,
                                image,
                                discount,
                                price,
                                genre
                            });
                        }
                    });
                    return results;
                }, region, category);

                for (const item of listItems) {
                    // Check duplicate strictly.
                    // However, sometimes same title exists in different regions or categories?
                    // Usually not. Dedup by title is fine for now as per previous logic.
                    // But duplicates across categories (e.g. play vs musical if mislabeled) should be handled.
                    if (!seenTitles.has(item.title)) {
                        seenTitles.add(item.title);
                        pendingItems.push(item);
                    }
                }

            } catch (e) {
                console.error(`  Error collecting links from region ${code} cat ${category}: ${e}`);
            }
        }
    }

    console.log(`  Found ${pendingItems.length} unique performances.`);

    // 2. Scrape Details
    console.log(`\nPhase 2: Scraping details...`);
    const progressBar = new ProgressBar(pendingItems.length);
    let processedCount = 0;

    for (const item of pendingItems) {
        try {
            await page.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 30000 });

            // Wait for the key element containing details. 
            // We'll give it a moment to render any JS driven content
            await new Promise(r => setTimeout(r, 500)); // Minimal wait for stability

            const detailData = await page.evaluate(() => {
                let runningTime = '';
                let ageLimit = '';
                let originalPrice = '';
                let venue = '';
                let date = '';
                let address = '';

                const bodyText = document.body.innerText;

                // Improved Venue & Address Parsing from specific container(s)
                const infoBoxes = document.querySelectorAll('.viewpage_text.radius_box');
                infoBoxes.forEach(infoBox => {
                    const text = infoBox.textContent || '';

                    // 1. Try to extract specific lines if they exist as <p> tags
                    const pTags = infoBox.querySelectorAll('p');
                    pTags.forEach(p => {
                        const pText = p.textContent?.trim() || '';
                        if (pText.includes('장소') && !pText.includes('티켓배부')) {
                            const part = pText.split('장소')[1]?.replace(/[:\·]/g, '').trim();
                            if (part && part !== '문의' && part !== '환불규정') venue = part;
                        }
                        if (pText.includes('주소')) {
                            const part = pText.split('주소')[1]?.replace(/[:\·]/g, '').trim();
                            if (part) address = part;
                        }
                    });

                    // 2. Fallback: Regex on full text if p tags didn't help (or format is different)
                    if (!venue) {
                        // Excluding '티켓배부장소' which is often '입구 티켓박스'
                        const vMatch = text.match(/(?<!배부)장소\s*[:\·]?\s*([^\n\/·]+)/);
                        if (vMatch) {
                            const v = vMatch[1].trim();
                            if (v !== '문의' && v !== '환불규정') venue = v;
                        }
                    }
                    if (!address) {
                        const aMatch = text.match(/주소\s*[:\·]?\s*([^\n]+)/);
                        if (aMatch) address = aMatch[1].trim();
                    }
                });

                // Fallback structure (Old logic)
                if (!venue) {
                    const allElements = document.body.getElementsByTagName('*');
                    for (let i = 0; i < allElements.length; i++) {
                        const el = allElements[i] as HTMLElement;
                        const text = el.innerText || '';
                        if (!venue && text.includes('장소 :') && text.length < 100 && !text.includes('공연정보')) {
                            const parts = text.split('장소 :');
                            if (parts.length > 1) {
                                const candidate = parts[1].trim().split('\n')[0];
                                if (candidate && candidate !== '환불규정' && candidate !== '문의' && !candidate.includes('티켓박스')) {
                                    venue = candidate;
                                }
                            }
                        }
                    }
                }

                // Final cleanups
                if (venue.includes('티켓박스') || venue.includes('매표소')) {
                    // Try to find a better venue name if the current one is just a meeting point
                    // Often the title contains the venue or it's unparseable. 
                    // Keep as is if no better option, but the above logic prioritizes the infoBox which usually has the real venue.
                }

                // Running Time
                const runTimeMatch = bodyText.match(/이용시간\s*[:]?\s*약?\s*(\d+분)/);
                if (runTimeMatch) runningTime = runTimeMatch[1];

                // Age Limit (Simple extraction, taking first meaningful match)
                const ageMatch = bodyText.match(/이용등급\s*[:]?\s*([^\n]+)/);
                if (ageMatch) {
                    let age = ageMatch[1].trim();
                    if (age.includes('·')) age = age.split('·')[0].trim();
                    ageLimit = age;
                }

                // Date
                const dateMatch = bodyText.match(/(?:진행)?기간\s*[:]?\s*([^\n·]{5,})/);
                if (dateMatch) date = dateMatch[1].trim();

                return {
                    runningTime,
                    ageLimit,
                    date: date || 'OPEN RUN',
                    venue: venue || '대학로',
                    originalPrice,
                    address,
                };
            });

            // Use LIST image strictly as requested by user (thist is more reliable correctly)
            const finalImage = item.image;

            allItems.push({
                id: `timeticket_${Math.random().toString(36).substr(2, 9)}`,
                title: item.title,
                image: finalImage,
                date: detailData.date,
                venue: detailData.venue,
                link: item.link,
                region: item.region,
                genre: item.genre,
                price: item.price,
                originalPrice: detailData.originalPrice || item.price,
                discount: item.discount,
                runningTime: detailData.runningTime,
                ageLimit: detailData.ageLimit,
                casting: '',
                address: detailData.address
            });


        } catch (e) {
            // console.error(`Failed to scrape ${item.title}: ${e}`);
        }

        processedCount++;
        progressBar.update(processedCount);
    }

    progressBar.finish();
    console.log(`\nCompleted! Total collected: ${allItems.length}`);

    await browser.close();

    if (allItems.length === 0) {
        console.error("No items collected! Skipping file save to prevent data loss.");
        return;
    }

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(allItems, null, 2));
    console.log(`Saved to ${OUTPUT_PATH}`);
}

scrapeTimeTicket().catch(console.error);
