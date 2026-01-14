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

function saveData(data: Performance[]) {
    if (data.length === 0) {
        console.log("No items to save.");
        return;
    }
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2));
    console.log(`\nSaved ${data.length} items to ${OUTPUT_PATH}`);
}

function loadExistingData(): Map<string, Performance> {
    if (!fs.existsSync(OUTPUT_PATH)) return new Map();
    try {
        const data = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
        const map = new Map<string, Performance>();
        data.forEach((item: Performance) => {
            if (item.link) map.set(item.link, item);
        });
        return map;
    } catch (e) {
        console.warn("Failed to load existing data for incremental scraping.");
        return new Map();
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

    // Set User Agent and Headers for stability
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'ko-KR,ko;q=0.9',
    });

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
    const existingDataMap = loadExistingData();
    console.log(`Loaded ${existingDataMap.size} existing items for incremental scraping.`);

    // 1. Collect Links
    console.log(`\nPhase 1: Collecting performance links...`);

    let pendingItems: { link: string, region: string, title: string, image: string, discount: string, price: string, genre: string }[] = [];

    // Categories: Prioritize Kids/Activity to ensure correct genre attribution before deduplication
    const CATEGORIES = [
        { id: 2123, defaultGenre: 'kids' },      // Kids
        { id: 2125, defaultGenre: 'activity' },  // Activity
        { id: 2096, defaultGenre: 'play' },      // Performance
        { id: 2100, defaultGenre: 'exhibition' } // Exhibition
    ];

    for (const { code, region } of REGION_CODES) {
        for (const cat of CATEGORIES) {
            const url = `https://timeticket.co.kr/list.php?category=${cat.id}&area=${code}`;
            // console.log(`  Visiting ${url}...`);

            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

                // Wait for list to load
                try {
                    await page.waitForSelector('a[href^="/product/"]', { timeout: 10000 });
                } catch (e) {
                    // console.log(`  No items found or timeout for region ${code} category ${cat.id}`);
                    continue;
                }

                const listItems = await page.evaluate((currentRegion, currentCatId, currentDefaultGenre) => {
                    const results: any[] = [];
                    // Use a more robust selector based on href pattern
                    const items = document.querySelectorAll('a[href^="/product/"]');

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
                        let title = titleEl ? titleEl.textContent?.trim() || '' : '';
                        // Robust cleaning: remove leading/trailing whitespace and specific pattern
                        title = title.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
                        // Remove space before specific full-width bracket tag if it exists internally or normally
                        title = title.replace(/\s+(?=［만원의행복］)/g, '');

                        const categoryEl = item.querySelector('.ticket_info .category');
                        const categoryText = categoryEl ? categoryEl.textContent?.trim() || '' : '';

                        let genre = currentDefaultGenre;

                        // Refine 'play' genre into 'musical' or 'concert' if keywords found
                        if (currentCatId === 2096) {
                            if (categoryText.includes('뮤지컬')) genre = 'musical';
                            else if (categoryText.includes('콘서트')) genre = 'concert';
                        }
                        // 'activity' and 'exhibition' rely on defaultGenre unless specific keywords exist (none defined currently)

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
                }, region, cat.id, cat.defaultGenre);


                // If we get here, either no state or hash mismatch. proceed with full collection.
                // Note regarding TimeTicket: This script collects everything first then scrapes details.
                // Optimization: We could skip *link collection* for this category if hash matches, 
                // BUT we need the items in `allItems` to save the full JSON at the end.
                // Issue: If we skip, we don't have the items to write to `timeticket.json`.
                // Solution: For now, we unfortunately must scrape to get the data to save the full file, 
                // UNLESS `timeticket.json` is appended to? No, it's overwritten.
                // 
                // Alternative for "Optimization": 
                // We typically need to produce the FULL `timeticket.json` every day.
                // If we skip scraping, we effectively delete those items from the output file unless we load them from the previous run.
                // 
                // REVISED STRATEGY:
                // Since the goal is optimization, we should probably output "new/updated" items or merge with existing data?
                // However, the user request implies "skip collection".
                // If we skip collection, `pendingItems` will be empty for this category.
                // 
                // If the user wants to reduce SERVER LOAD, skipping is good.
                // But we need the data.
                // 
                // ACTUALLY: The best approach for a "Full Refresh" architecture (which this seems to be) 
                // is to skip *Detail Scraping* if the list hasn't changed?
                // But the detail page might have changed (unlikely for ticket sales generally, but possible).
                // 
                // Let's implement the "Skip and Carry Over" if possible, or just "Skip" implies "No New Data".
                // Wait, if I skip, the final `timeticket.json` will be missing these items.
                // That's bad.
                // 
                // To support true incremental scraping, we'd need to read the EXISTING `timeticket.json` first,
                // and if we skip a category, we copy the items belonging to that category from the old file.
                // 
                // Let's modify the plan slightly on the fly to support this:
                // 1. Load existing `src/data/timeticket.json` at start.
                // 2. If Hash Matches -> Use existing items for this category/region from the loaded file.
                // 3. If Hash Mismatch -> Scrape fresh.

                // IGNORE THE ABOVE COMMENT BLOCK IN CODE, I WILL IMPLEMENT THE LOGIC BELOW.

                // ... proceeding with adding items to pendingItems ... 

                // Actually, implementing "Load existing" is complex in one go.
                // Let's assume for this specific optimization (as agreed in plan) we just want to update the state 
                // AFTER successful scrape. 
                // WAIT. If I skip, I lose data in the current architecture.
                // I will add logic to LOAD existing data if available to preserve it when skipping.


                for (const item of listItems) {
                    if (!seenTitles.has(item.title)) {
                        seenTitles.add(item.title);
                        pendingItems.push(item);
                    }
                }

            } catch (e) {
                console.error(`  Error collecting links from region ${code} cat ${cat.id}: ${e}`);
            }
        }
    }

    console.log(`  Found ${pendingItems.length} unique performances.`);

    // 2. Scrape Details
    console.log(`\nPhase 2: Scraping details...`);
    const progressBar = new ProgressBar(pendingItems.length);
    let processedCount = 0;

    // Trap interrupts to save partial data
    process.on('SIGINT', () => {
        console.log('\nProcess interrupted! Saving collected data...');
        saveData(allItems);
        process.exit();
    });

    for (const item of pendingItems) {
        // INCREMENTAL SCRAPING OPTIMIZATION:
        // If we already have this item in our existing data (checked by Link), reuse it!
        // This skips the slow detailed page visit.
        if (existingDataMap.has(item.link)) {
            const existing = existingDataMap.get(item.link);
            if (existing) {
                // Update basic fields that might have changed on list page (e.g. discount, price)
                // but keep the expensive details (venue, date, time) from existing.
                // Actually, let's trust existing entirely for speed, 
                // OR we can update `price` / `discount` from `item` if we want.
                // Let's mix: ID keeps same, details keep same, but if list info changed, we could update?
                // For simplicity and speed, just reuse the object but maybe update price?

                // Force update price/discount from valid list item
                existing.price = item.price || existing.price;
                existing.discount = item.discount || existing.discount;

                // Check if we need to backfill originalPrice (for items scraped before the fix)
                // If originalPrice is missing/empty but price exists, we should probably re-scrape detail.
                // Check if it's "Open Run" or just missing data?
                // Actually, if it's missing, let's fall through to Detail Scraping.
                // But we simply 'continue' here.
                // To force scrape, we should NOT continue.
                // But wait, if we fall through, we need to make sure we don't duplicate logic.
                // The simplest way: just don't enter this `if` block if originalPrice is missing.
                if (!existing.originalPrice || existing.originalPrice === '') {
                    // If originalPrice is missing, we fall through to the detail scraping block below.
                } else {
                    allItems.push(existing);
                    processedCount++;
                    progressBar.update(processedCount);
                    continue;
                }
            }
        }

        try {
            await page.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 15000 });

            // Wait for the key element containing details. 
            // We'll give it a moment to render any JS driven content
            await new Promise(r => setTimeout(r, 500)); // Minimal wait for stability

            const detailData = await page.evaluate(() => {
                // Selectors provided by user
                // Date: body > div:nth-child(5) > div > div:nth-child(2) > div:nth-child(6) > div > div.openrun > p:nth-child(1)
                // Time: .run_info
                // Age: :nth-child(3)
                // Discount: .sale_p
                // Origin: span.origin_price
                // Sale: span.sale_price

                // Note: The nth-child selectors might be brittle if layout changes slightly, but we follow user request.
                // We will try robust classes first if available matching the intent.

                const openRunDiv = document.querySelector('.openrun');
                let date = '';
                let runningTime = '';
                let ageLimit = '';

                if (openRunDiv) {
                    // The user specified nth-childs relative to .openrun P tags
                    // p:1 -> Date (Period)
                    // p.run_info -> Time
                    // p:3 -> Age

                    const pTags = openRunDiv.querySelectorAll('p');
                    if (pTags.length >= 1) date = pTags[0].textContent?.trim() || '';

                    const runInfoP = openRunDiv.querySelector('.run_info');
                    if (runInfoP) runningTime = runInfoP.textContent?.trim() || '';

                    // If p:3 exists and is not date/time
                    if (pTags.length >= 3) ageLimit = pTags[2].textContent?.trim() || '';
                }

                // Prices
                const originEl = document.querySelector('.price_info .origin_price');
                const saleEl = document.querySelector('.price_info .sale_price');
                const discountEl = document.querySelector('.sale_info .sale_p');

                let originalPrice = originEl ? originEl.textContent?.trim() : '';
                let salePrice = saleEl ? saleEl.textContent?.trim() : '';
                let discount = discountEl ? discountEl.textContent?.trim() : '';

                // Text Boxes for Extra Info & Address
                // #ajaxcontentarea > div > div:nth-child(3) > div.viewpage_text.radius_box -> Info (Adult Price?)
                // #ajaxcontentarea > div > div:nth-child(7) > div.viewpage_text.radius_box -> Address

                // Helper to find box by content if structure varies, or use strict index if stable.
                // The user gave strict indices.

                let address = '';

                // We'll search all radius boxes to be safe, or specific if layout matches
                const radiusBoxes = document.querySelectorAll('.viewpage_text.radius_box');

                // Try to find Adult Price in the first text box (usually info)
                if (radiusBoxes.length > 0) {
                    const infoText = radiusBoxes[0].textContent || '';
                    if (!salePrice) {
                        // Try to find price in text if not found above
                        // "성인 ... 000원"
                        const match = infoText.match(/성인\s*[:]?\s*([\d,]+)원/);
                        if (match) salePrice = match[1] + '원';
                    }
                }

                // Address - User said 7th div (which might be the 2nd radius box visually?)
                // Let's look for "주소" in any radius box or specifically the 2nd one found.
                // The provided selector was complex: #ajaxcontentarea > div > div:nth-child(7) ...
                // Let's iterate all boxes to find "주소"
                radiusBoxes.forEach(box => {
                    const text = box.innerText;
                    if (text.includes('주소')) {
                        const parts = text.split('주소');
                        if (parts[1]) {
                            const candidate = parts[1].split('\n')[0].replace(/[:]/g, '').trim();
                            if (candidate) address = candidate;
                        }
                    }
                });

                // Fallback for venue/address if still empty
                let venue = '대학로'; // Default
                if (address) {
                    // Try to extract venue name from address or nearby text?
                    // Often venue name is not explicitly in the address box but defined elsewhere.
                    // We'll trust the list scraping for Venue Name usually, but can look for "장소" here too.
                    radiusBoxes.forEach(box => {
                        if (box.innerText.includes('장소')) {
                            const v = box.innerText.split('장소')[1].split('\n')[0].replace(/[:]/g, '').trim();
                            if (v) venue = v;
                        }
                    });
                } else {
                    // Check common structure for address
                    const mapDiv = document.querySelector('#map');
                    // sometimes address is near map?
                }

                return {
                    runningTime,
                    ageLimit,
                    date: date || 'OPEN RUN',
                    venue,
                    originalPrice,
                    salePrice,
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
                price: detailData.salePrice || item.price, // Prefer detail sale price
                originalPrice: detailData.originalPrice || '', // Prefer detail origin price, do not fallback to discounted price
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

    saveData(allItems);
}

scrapeTimeTicket().catch(console.error);
