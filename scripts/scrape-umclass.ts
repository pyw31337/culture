
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
    viewCount?: string;
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


    let pendingItems: { link: string, title: string, image: string, discount: string, price: string }[] = [];

    // Scrape "All" list from main class page
    // URL provided by user: https://www.umclass.com/class?page=1
    let currentPage = 1;
    let hasNextPage = true;
    const MAX_PAGES = 100; // Increased limit for full scrape

    console.log(`\nPhase 1: Collecting all classes (All Regions / All Categories)...`);

    while (hasNextPage && currentPage <= MAX_PAGES) {
        const url = `https://www.umclass.com/class?page=${currentPage}`;
        console.log(`  Visiting Page ${currentPage}: ${url}`);

        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            // Wait for list container - selector might differ on main class page vs plan page
            // Plan page used .classPlan-contents-list. Main class page might use .class-list-wrapper or similar.
            // Let's use a generic wait or check if the previous selector works.
            // If the user says https://www.umclass.com/class?page=1, checking generic list items.
            try {
                await page.waitForSelector('a[href*="/classInfo/"]', { timeout: 5000 });
            } catch (e) {
                console.log(`    No items found on page ${currentPage} (Timeout). Ending.`);
                break;
            }

            const pageItems = await page.evaluate(() => {
                // Generic selector for class items
                const anchors = document.querySelectorAll('a[href*="/classInfo/"]');
                const results: any[] = [];

                anchors.forEach((anchor) => {
                    const link = (anchor as HTMLAnchorElement).href;
                    if (!link.includes('/classInfo/')) return;

                    // Title extraction
                    const titleElem = anchor.querySelector('.class-subject') ||
                        anchor.querySelector('.list-subject') ||
                        anchor.querySelector('[class*="subject"]') ||
                        anchor.querySelector('[class*="title"]');

                    let title = titleElem ? titleElem.textContent?.trim() : '';

                    if (!title) {
                        const text = anchor.textContent?.trim() || '';
                        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 5);
                        title = lines[0] || '';
                    }

                    if (!title) return;

                    // Image extraction
                    let image = '';
                    const imgDiv = anchor.querySelector('[class*="img"]');
                    if (imgDiv) {
                        const style = window.getComputedStyle(imgDiv);
                        const bgImage = style.backgroundImage;
                        if (bgImage && bgImage !== 'none') {
                            image = bgImage.slice(4, -1).replace(/"/g, '');
                        }
                    }
                    if (!image) {
                        const imgTag = anchor.querySelector('img');
                        if (imgTag) image = imgTag.src;
                    }

                    // Price extraction
                    const priceElem = anchor.querySelector('[class*="price"]');
                    const discountElem = anchor.querySelector('[class*="discount"]');
                    const price = priceElem ? priceElem.textContent?.trim() || '' : '';
                    const discount = discountElem ? discountElem.textContent?.trim() || '' : '';

                    results.push({
                        title,
                        link,
                        image,
                        price,
                        discount
                    });
                });
                return results;
            });

            if (pageItems.length === 0) {
                console.log(`    No items found on page ${currentPage}. Stopping.`);
                hasNextPage = false;
            } else {
                let newItems = 0;
                for (const item of pageItems) {
                    if (!seenTitles.has(item.title)) {
                        seenTitles.add(item.title);
                        pendingItems.push(item);
                        newItems++;
                    }
                }
                console.log(`    Found ${pageItems.length} items (${newItems} new).`);

                // If page had items but all were duplicates, we still continue because order isn't guaranteed unique across pages?
                // Or maybe we stop? Safer to continue a bit.
                if (pageItems.length < 5) {
                    // Start calling it quits if very few items
                }

                currentPage++;
            }

        } catch (e) {
            console.error(`    Error on page ${currentPage}: ${e}`);
            hasNextPage = false;
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

            // Selectors provided:
            // Duration: .voucher-semi-info-area > div:nth-child(1) > span:nth-child(2)
            // People: ... > div:nth-child(2) > span:nth-child(2)
            // Total Count: ... > div:nth-child(3) > span:nth-child(2)
            // Discount: .pc-payment-btn-area ... span:nth-child(1)
            // Origin Price: ... span:nth-child(2)
            // Sale Price: ... span:nth-child(3)
            // Use Time: ... > div:nth-child(6) > div:nth-child(1) > div:nth-child(9) > span
            // Address: ... > div:nth-child(6) > div:nth-child(1) > div:nth-child(15) > div:nth-child(2) > span 

            const detailData = await page.evaluate(() => {
                function getTxt(sel: string) {
                    return document.querySelector(sel)?.textContent?.trim() || '';
                }

                const duration = getTxt('#um_contents > div.landing-content > div.voucher-contents > div.voucher-main-img-area-1 > div.voucher-semi-info-area > div:nth-child(1) > span:nth-child(2)');
                const people = getTxt('#um_contents > div.landing-content > div.voucher-contents > div.voucher-main-img-area-1 > div.voucher-semi-info-area > div:nth-child(2) > span:nth-child(2)');
                const totalCount = getTxt('#um_contents > div.landing-content > div.voucher-contents > div.voucher-main-img-area-1 > div.voucher-semi-info-area > div:nth-child(3) > span:nth-child(2)');

                const discount = getTxt('#um_contents > div.landing-content > div.voucher-contents > div:nth-child(3) > div.pc-payment-btn-area > div > span:nth-child(1)');
                const originPrice = getTxt('#um_contents > div.landing-content > div.voucher-contents > div:nth-child(3) > div.pc-payment-btn-area > div > span:nth-child(2)');
                const salePrice = getTxt('#um_contents > div.landing-content > div.voucher-contents > div:nth-child(3) > div.pc-payment-btn-area > div > span:nth-child(3)');

                const useTime = getTxt('#um_contents > div.landing-content > div.voucher-contents > div:nth-child(6) > div:nth-child(1) > div:nth-child(9) > span');
                const rawAddress = getTxt('#um_contents > div.landing-content > div.voucher-contents > div:nth-child(6) > div:nth-child(1) > div:nth-child(15) > div:nth-child(2) > span');

                return {
                    rawAddress,
                    duration,
                    people,
                    totalCount,
                    discount,
                    originPrice,
                    salePrice,
                    useTime
                };
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
                date: detailData.duration || '2024-01-01', // Fallback or scraped data
                venue: venue,
                image: item.image,
                link: item.link,
                genre: 'class',
                region: address, // Extracted region
                runningTime: detailData.useTime || detailData.duration,
                viewCount: detailData.totalCount, // abusing viewCount for capacity/count
                originalPrice: detailData.originPrice,
                price: detailData.salePrice || detailData.originPrice,
                discount: detailData.discount,
                ageLimit: 'all',
                address: address,
                casting: `정원: ${detailData.people}, 총회차: ${detailData.totalCount}` // Combine extra info
            });

        } catch (e) {
            console.error(`    Failed to scrape details for ${item.title}: ${e}`);
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
