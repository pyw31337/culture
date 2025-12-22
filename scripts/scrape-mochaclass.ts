
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

interface MochaClassItem {
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

const OUTPUT_PATH = path.resolve(process.cwd(), 'src/data/mochaclass.json');

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

function saveData(data: MochaClassItem[]) {
    if (data.length === 0) {
        console.log("No items to save.");
        return;
    }
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2));
    console.log(`\nSaved ${data.length} items to ${OUTPUT_PATH}`);
}

async function scrapeMochaClass() {
    console.log(`Starting MochaClass Scraper...`);

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

    // Header settings
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'ko-KR,ko;q=0.9',
    });

    const allItems: MochaClassItem[] = [];
    const seenTitles = new Set<string>();

    // We target "Region Seoul" (area=2 equivalent, or location=%EC%84%9C%EC%9A%B8)
    // URL from user: https://mochaclass.com/Search?page=1&is_online_class=false&where=list&course=원데이&sort=거리순&location=서울
    // Need to encode params properly or use exact string.
    let currentPage = 1;
    let hasNextPage = true;
    const MAX_PAGES = 5; // Start with safe limit

    console.log(`\nPhase 1: Collecting class links...`);

    let pendingItems: { link: string, title: string, image: string, price: string }[] = [];

    while (hasNextPage && currentPage <= MAX_PAGES) {
        const url = `https://mochaclass.com/Search?page=${currentPage}&is_online_class=false&where=list&course=%EC%9B%90%EB%8D%B0%EC%9D%B4&sort=%EA%B1%B0%EB%A6%AC%EC%88%9C&location=%EC%84%9C%EC%9A%B8`;
        console.log(`  Visiting Page ${currentPage}: ${url}`);

        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

            try {
                // Wait for grid container
                await page.waitForSelector('.MuiGrid-root.css-2xazwd', { timeout: 10000 });
            } catch (e) {
                console.log(`    No list container found on page ${currentPage}. Ending or Timeout.`);
                break;
            }

            const pageItems = await page.evaluate(() => {
                const grids = document.querySelectorAll('.MuiGrid-root.css-2xazwd');
                let targetGrid: Element | null = null;
                // Simple heuristic: find the grid with the most 'a' children
                grids.forEach((g: any) => {
                    if (!targetGrid || g.querySelectorAll('a').length > targetGrid.querySelectorAll('a').length) {
                        targetGrid = g;
                    }
                });

                if (!targetGrid) return [];

                const anchors = (targetGrid as Element).querySelectorAll('a');
                const results: any[] = [];

                anchors.forEach((anchor: any) => {
                    const link = anchor.href;
                    if (!link || !link.includes('/class/')) return; // Ensure it's a class link

                    // Title
                    const titleElem = anchor.querySelector('div > div.css-76zbcf > p');
                    const title = titleElem ? titleElem.textContent?.trim() : '';
                    if (!title) return;

                    // Image
                    const imgElem = anchor.querySelector('div > div.css-11udqdf > img');
                    const image = imgElem ? imgElem.getAttribute('src') || '' : '';

                    // Price
                    const priceElem = anchor.querySelector('div > div.css-76zbcf > div.css-1k8tf8v > div > p');
                    const price = priceElem ? (priceElem.textContent?.trim() || '') : '';

                    results.push({
                        title,
                        link,
                        image,
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
                let newItemsCount = 0;
                for (const item of pageItems) {
                    if (!seenTitles.has(item.title)) {
                        seenTitles.add(item.title);
                        pendingItems.push(item);
                        newItemsCount++;
                    }
                }
                if (newItemsCount === 0) {
                    // If all items on this page are duplicates, we might be looping or done.
                    // But maybe user wants deep scrape. Let's continue until empty or max.
                }
                currentPage++;
            }

        } catch (error) {
            console.error(`    Error on page ${currentPage}: ${error}`);
            hasNextPage = false;
        }
    }

    console.log(`  Total unique classes found: ${pendingItems.length}`);

    // Phase 2: Details
    console.log(`\nPhase 2: Scraping details (Address)...`);
    const progressBar = new ProgressBar(pendingItems.length);
    let processedCount = 0;

    process.on('SIGINT', () => {
        console.log('\nProcess interrupted! Saving collected data...');
        saveData(allItems);
        process.exit();
    });

    for (const item of pendingItems) {
        try {
            await page.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await new Promise(r => setTimeout(r, 800)); // Minimal wait

            const detailData = await page.evaluate(() => {
                const el = document.querySelector('#topleft > div:nth-child(10) > div > p');
                return {
                    rawAddress: el ? el.textContent?.trim() || '' : ''
                };
            });

            const address = detailData.rawAddress || '서울';

            // Extract District (Gu) for Venue Name
            // e.g. "대한민국 서울특별시 서초구 잠원동..." -> "서초구"
            let district = '';
            const districtMatch = address.match(/(\w+[구])/);
            if (districtMatch) {
                district = districtMatch[1];
            } else {
                // Try finding typical Seoul districts
                const parts = address.split(' ');
                for (const p of parts) {
                    if (p.endsWith('구')) {
                        district = p;
                        break;
                    }
                }
            }

            const venue = district ? `모카클래스 (${district})` : '모카클래스';

            allItems.push({
                id: `mochaclass_${Math.random().toString(36).substr(2, 9)}`,
                title: item.title,
                image: item.image,
                date: 'OPEN RUN',
                venue: venue,
                link: item.link,
                region: 'seoul',
                genre: 'class',
                price: item.price,
                originalPrice: item.price,
                discount: '', // Calculate if needed later
                runningTime: '예약페이지 참조',
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

scrapeMochaClass().catch(console.error);
