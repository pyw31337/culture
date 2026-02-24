
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
    lastEnriched?: string;
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

function slugify(text: string): string {
    return text
        .replace(/[^a-zA-Z0-9가-힣]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
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

    // Load existing items
    const existingMap = new Map<string, UmClassItem>();
    if (fs.existsSync(OUTPUT_PATH)) {
        try {
            const data = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
            data.forEach((item: UmClassItem) => existingMap.set(item.link, item));
        } catch (e) {
            console.log('No existing data found or parse error.');
        }
    }

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
    await page.close(); // Close list page

    // Phase 2: Details
    console.log(`\nPhase 2: Scraping details (Smart Incremental - Parallel)...`);

    // Filter what needs enrichment
    const todo: typeof pendingItems = [];
    const done: UmClassItem[] = [];

    const isRecentlyEnriched = (ex: UmClassItem) => {
        if (!ex.lastEnriched) return false;
        try {
            const last = new Date(ex.lastEnriched);
            const now = new Date();
            const diffDays = (now.getTime() - last.getTime()) / (1000 * 3600 * 24);
            return diffDays < 7;
        } catch (e) { return false; }
    };

    for (const item of pendingItems) {
        const existing = existingMap.get(item.link);
        if (existing && isRecentlyEnriched(existing)) {
            // Updated basic info from list if needed, but keep detail info?
            // Usually list partial info is fresher (discount/price) but detail info is heavy.
            // We'll trust existing full record.
            done.push({
                ...existing,
                title: item.title, // Update mutable fields from list
                image: item.image,
                price: item.price || existing.price,
                discount: item.discount || existing.discount
            });
        } else {
            todo.push(item);
        }
    }

    console.log(`Skipped (Recently Enriched): ${done.length}. To Enrich: ${todo.length}`);
    allItems.push(...done);

    if (todo.length > 0) {
        const progressBar = new ProgressBar(todo.length);
        let processedCount = 0;
        const CONCURRENCY = 5;

        // Trap SIGINT
        process.on('SIGINT', () => {
            console.log('\nProcess interrupted! Saving collected data...');
            saveData(allItems);
            process.exit();
        });

        for (let i = 0; i < todo.length; i += CONCURRENCY) {
            const chunk = todo.slice(i, i + CONCURRENCY);
            const promises = chunk.map(async (item) => {
                const p = await browser.newPage();
                try {
                    await p.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 15000 });
                    // await new Promise(r => setTimeout(r, 500)); // Remove wait for speed

                    const detailData = await p.evaluate(() => {
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

                        // Heuristic address finding for UmClass
                        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div'));
                        let address = '';

                        for (let i = 0; i < headings.length; i++) {
                            if (headings[i].textContent?.trim() === '클래스 장소') {
                                const container = headings[i].closest('div')?.parentElement;
                                if (container) {
                                    const text = container.textContent || '';
                                    if (text.includes('복사')) {
                                        const parts = text.split('복사');
                                        if (parts[0]) {
                                            address = parts[0].replace('클래스 장소', '').trim();
                                        }
                                    } else {
                                        address = text.replace('클래스 장소', '').trim();
                                    }
                                }
                                break;
                            }
                            if (headings[i].textContent?.trim() === '장소') {
                                const nextSibling = headings[i].nextElementSibling;
                                if (nextSibling) {
                                    address = nextSibling.textContent?.trim() || '';
                                }
                                break;
                            }
                        }

                        if (!address) {
                            for (const el of headings) {
                                const text = el.textContent?.trim() || '';
                                if ((text.includes('대한민국') || text.includes('동구') || text.includes('중구') || text.includes('서구') || text.includes('남구') || text.includes('북구') || text.includes('시 ') || text.includes('도 ') || text.includes('로 ') || text.includes('길 ')) && text.length > 10 && text.length < 100 && !text.includes('솜씨당')) {
                                    if (text.match(/([가-힣]+(도|시|구|군|동|로|길)\s*)+/)) {
                                        address = text;
                                        if (text.includes('대한민국')) break;
                                    }
                                }
                            }
                        }

                        // Strip trailing UI garbage
                        address = address.replace(/지도보기주소복사/g, '').replace(/주소복사/g, '').replace(/지도보기/g, '').trim();

                        return { rawAddress: address, duration, people, totalCount, discount, originPrice, salePrice, useTime };
                    });

                    let venue = '솜씨당 클래스';
                    let address = detailData.rawAddress || '서울';
                    address = address.replace(/^대한민국\s*/, '').trim();

                    if (address.length > 5) {
                        const tokens = address.split(/\s+/);
                        if (tokens.length > 1) {
                            venue = tokens[tokens.length - 1]; // Assume last word might be the venue name, or just use the whole address
                        }
                        // To be safe, let's just use the full accurate address as the venue
                        venue = address;
                    }

                    // Stable ID
                    const id = `class_${slugify(item.title)}`;

                    return {
                        id,
                        title: item.title,
                        date: detailData.duration || '2024-01-01',
                        venue: venue,
                        image: item.image,
                        link: item.link,
                        genre: 'class',
                        region: address,
                        runningTime: detailData.useTime || detailData.duration,
                        viewCount: detailData.totalCount,
                        originalPrice: detailData.originPrice,
                        price: detailData.salePrice || detailData.originPrice,
                        discount: detailData.discount,
                        ageLimit: 'all',
                        address: address,
                        casting: `정원: ${detailData.people}, 총회차: ${detailData.totalCount}`,
                        lastEnriched: new Date().toISOString()
                    };

                } catch (e) {
                    // console.error(e);
                    return null;
                } finally {
                    await p.close();
                }
            });

            const results = await Promise.all(promises);
            results.forEach(r => {
                if (r) allItems.push(r);
                else {
                    // Failed to scrape details? Add fallback or skip
                    // Add basic item?
                }
            });
            processedCount += results.length;
            progressBar.update(processedCount);

            if (i % 20 === 0) saveData(allItems);
        }
        progressBar.finish();
    }

    console.log(`\nCompleted! Total collected: ${allItems.length}`);
    await browser.close();

    saveData(allItems);
}

scrapeUmClass().catch(console.error);
