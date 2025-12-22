
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

interface UmClassItem {
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
    address: string;
}

const OUTPUT_PATH = path.resolve(process.cwd(), 'src/data/umclass.json');

// Simple progress bar
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
        if (this.total === 0) return;
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

function saveData(data: UmClassItem[]) {
    if (data.length === 0) {
        console.log("No items to save.");
        return;
    }
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2));
    console.log(`\nSaved ${data.length} items to ${OUTPUT_PATH}`);
}

async function scrapeUmClass() {
    console.log(`Starting UmClass Scraper...`);

    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1280,800'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Header settings for Korean context
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'ko-KR,ko;q=0.9',
    });

    const allItems: UmClassItem[] = [];
    const seenTitles = new Set<string>();

    const MAX_PAGES = 50; // Deep scrape

    let pendingItems: { link: string, title: string, image: string, discount: string, price: string }[] = [];

    // Iterate over more area codes (1-16 covers most of Korea)
    const AREAS = Array.from({ length: 16 }, (_, i) => i + 1);
    for (const area of AREAS) {
        let currentPage = 1;
        let hasNextPage = true;
        console.log(`\nPhase 1: Collecting class links for area ${area}...`);
        while (hasNextPage && currentPage <= MAX_PAGES) {
            const url = `https://www.umclass.com/plan/29?page=${currentPage}&area=${area}`;
            console.log(`  Visiting Page ${currentPage} (area ${area}): ${url}`);
            try {
                await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                await page.waitForSelector('.classPlan-contents-list', { timeout: 5000 });
            } catch (e) {
                console.log(`    No list container found on page ${currentPage}. Ending.`);
                break;
            }

            try {
                const pageItems = await page.evaluate(() => {
                    const listItems = document.querySelectorAll('.class-search-result.search-result-area ul.append-area > li');
                    const results: any[] = [];

                    if (listItems.length === 0) return [];

                    listItems.forEach((item) => {
                        const anchor = item.querySelector('a');
                        if (!anchor) return;

                        const link = anchor.href;
                        const titleElem = anchor.querySelector('.list-subject');
                        const title = titleElem ? titleElem.textContent?.trim() : '';

                        if (!title || !link) return;

                        // Image
                        const imgDiv = anchor.querySelector('.list-img .img');
                        let image = '';
                        if (imgDiv) {
                            const style = window.getComputedStyle(imgDiv);
                            image = style.backgroundImage.slice(4, -1).replace(/\"/g, "");
                        }

                        // Discount and Price
                        const discountElem = anchor.querySelector('.discount-rate');
                        const priceElem = anchor.querySelector('.price');

                        const discount = discountElem ? discountElem.textContent?.trim() || '' : '';
                        const price = priceElem ? priceElem.textContent?.trim() || '' : '';

                        results.push({
                            title,
                            link,
                            image,
                            discount,
                            price
                        });
                    });
                    return results;
                });

                if (pageItems.length === 0) {
                    console.log(`    No items found on page ${currentPage}. Stopping.`);
                    hasNextPage = false;
                } else {
                    console.log(`    Found ${pageItems.length} items.`);
                    for (const item of pageItems) {
                        if (!seenTitles.has(item.title)) {
                            seenTitles.add(item.title);
                            pendingItems.push(item);
                        }
                    }
                    currentPage++;
                }
            } catch (e) {
                console.error(`    Error on page ${currentPage} (area ${area}): ${e}`);
                // If an error occurs, try to continue to the next page or area, but stop current page processing.
                hasNextPage = false; // Stop processing pages for this area if an error occurs
            }
        }
    }



    console.log(`  Total unique classes found: ${pendingItems.length}`);

    // Phase 2: Details
    console.log(`\nPhase 2: Scraping details (Address & Venue)...`);
    const progressBar = new ProgressBar(pendingItems.length);
    let processedCount = 0;

    // Trap SIGINT
    process.on('SIGINT', () => {
        console.log('\nProcess interrupted! Saving collected data...');
        saveData(allItems);
        process.exit();
    });

    for (const item of pendingItems) {
        try {
            await page.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 15000 });

            // Wait a small bit for content
            await new Promise(r => setTimeout(r, 500));

            const detailData = await page.evaluate(() => {
                // Address selector provided by user:
                // #um_contents > div.landing-content > div.voucher-contents > div:nth-child(6) > div:nth-child(1) > div:nth-child(14) > div:nth-child(2) > span

                let rawAddress = '';
                const addressEl = document.querySelector('#um_contents > div.landing-content > div.voucher-contents > div:nth-child(6) > div:nth-child(1) > div:nth-child(14) > div:nth-child(2) > span');
                if (addressEl) {
                    rawAddress = addressEl.textContent?.trim() || '';
                } else {
                    // Fallback search for "주소" text
                    const elements = document.querySelectorAll('span, p, div');
                    for (const el of elements) {
                        if (el.textContent?.includes('주소') && el.textContent.length < 100) {
                            // This is risky, depends on structure.
                            // But umclass seems to have a specific layout.
                            // Let's rely on the selector mostly.
                        }
                    }
                }

                return { rawAddress };
            });

            // Parse Venue from Address (Last word logic)
            let venue = '솜씨당 클래스';
            let address = detailData.rawAddress || '서울';

            if (detailData.rawAddress) {
                const tokens = detailData.rawAddress.split(/\s+/);
                if (tokens.length > 1) {
                    venue = tokens[tokens.length - 1];
                    // Clean venue if needed (remove trailing brackets etc)
                }
            }

            allItems.push({
                id: `umclass_${Math.random().toString(36).substr(2, 9)}`,
                title: item.title,
                image: item.image,
                date: 'OPEN RUN', // Classes are usually ongoing
                venue: venue,
                link: item.link,
                region: address.includes('서울') ? 'seoul' : 'gyeonggi',
                genre: 'class',
                price: item.price,
                originalPrice: item.price, // Can calculate from discount if needed, but simplicity first
                discount: item.discount,
                runningTime: '옵션 참조',
                ageLimit: '전체',
                casting: '',
                address: address
            });

        } catch (e) {
            // console.error(`    Failed to details for ${item.title}: ${e}`);
        }

        processedCount++;
        progressBar.update(processedCount);
    }

    progressBar.finish();
    console.log(`\nCompleted! Total collected: ${allItems.length}`);
    await browser.close();

    saveData(allItems);
}

scrapeUmClass().catch(console.error);
