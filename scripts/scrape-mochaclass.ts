
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
    lastEnriched?: string;
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

function slugify(text: string): string {
    return text
        .replace(/[^a-zA-Z0-9가-힣]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
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

    // Load existing items
    const existingMap = new Map<string, MochaClassItem>();
    if (fs.existsSync(OUTPUT_PATH)) {
        try {
            const data = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
            data.forEach((item: MochaClassItem) => existingMap.set(item.link, item));
        } catch (e) {
            console.log('No existing data or parse error.');
        }
    }

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Header settings
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'ko-KR,ko;q=0.9',
    });

    const allItems: MochaClassItem[] = [];
    const seenTitles = new Set<string>();

    let currentPage = 1;
    let hasNextPage = true;
    const MAX_PAGES = 100;

    console.log(`\nPhase 1: Collecting all class links...`);

    let pendingItems: { link: string, title: string, image: string, price: string, originalPrice: string }[] = [];

    while (hasNextPage && currentPage <= MAX_PAGES) {
        const url = `https://mochaclass.com/Search?page=${currentPage}&where=list&sort=%EA%B1%B0%EB%A6%AC%EC%88%9C`;
        console.log(`    Visiting Page ${currentPage}: ${url}`);

        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

            try {
                await page.waitForSelector('.MuiGrid-root.css-2xazwd', { timeout: 10000 });
            } catch (e) {
                console.log(`    No list container found on page ${currentPage}. Ending or Timeout.`);
                break;
            }

            const pageItems = await page.evaluate(() => {
                const grids = document.querySelectorAll('.MuiGrid-root.css-2xazwd');
                let targetGrid: Element | null = null;
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
                    if (!link || !link.includes('/class/')) return;

                    const titleElem = anchor.querySelector('div > div.css-76zbcf > p');
                    const title = titleElem ? titleElem.textContent?.trim() : '';
                    if (!title) return;

                    const imgElem = anchor.querySelector('div > div.css-11udqdf > img');
                    const image = imgElem ? imgElem.getAttribute('src') || '' : '';

                    const priceContainer = anchor.querySelector('div > div.css-76zbcf > div.css-1k8tf8v');
                    let price = '';
                    let originalPrice = '';

                    if (priceContainer) {
                        const allTexts = Array.from(priceContainer.querySelectorAll('p, span, div'))
                            .map((el: any) => el.textContent?.trim() || '')
                            .filter((t: string) => t.length > 0 && !t.includes('포인트') && !t.includes('적립'));

                        const priceLike = allTexts.filter((t: string) => /[0-9,]+원/.test(t) || /[0-9]+%/.test(t));
                        const values = priceLike.map((t: string) => {
                            // Clean up text like "25%120,000원" into just "120,000원"
                            const cleanText = t.replace(/^[0-9]+%/, '');
                            return { text: cleanText, val: parseInt(cleanText.replace(/[^0-9]/g, '')) || 0 };
                        }).filter((v: any) => v.val > 0);

                        if (values.length >= 2) {
                            values.sort((a: any, b: any) => b.val - a.val);
                            originalPrice = values[0].text;
                            price = values[values.length - 1].text;
                        } else if (values.length === 1) {
                            price = values[0].text;
                            originalPrice = price;
                        }
                    }

                    results.push({
                        title,
                        link,
                        image,
                        price,
                        originalPrice
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
                currentPage++;
            }

        } catch (error) {
            console.error(`    Error on page ${currentPage}: ${error}`);
            hasNextPage = false;
        }
    }

    console.log(`  Total unique classes found: ${pendingItems.length}`);
    await page.close();

    // Phase 2: Details
    console.log(`\nPhase 2: Scraping details (Smart Incremental - Parallel)...`);

    // Filter
    const todo: typeof pendingItems = [];
    const done: MochaClassItem[] = [];

    const isRecentlyEnriched = (ex: MochaClassItem) => {
        if (!ex.lastEnriched) return false;
        try {
            const last = new Date(ex.lastEnriched);
            const now = new Date();
            const diffDays = (now.getTime() - last.getTime()) / (1000 * 3600 * 24);
            return false; // Force re-enrichment for all items to fix addresses
        } catch (e) { return false; }
    };

    for (const item of pendingItems) {
        const existing = existingMap.get(item.link);
        if (existing && isRecentlyEnriched(existing)) {
            done.push({
                ...existing,
                title: item.title,
                image: item.image,
                price: item.price || existing.price,
                originalPrice: item.originalPrice || existing.originalPrice
            });
        } else {
            todo.push(item);
        }
    }

    console.log(`Skipped: ${done.length}. To Enrich: ${todo.length}`);
    allItems.push(...done);

    if (todo.length > 0) {
        const progressBar = new ProgressBar(todo.length);
        let processedCount = 0;
        const CONCURRENCY = 10;

        for (let i = 0; i < todo.length; i += CONCURRENCY) {
            const chunk = todo.slice(i, i + CONCURRENCY);
            const promises = chunk.map(async (item) => {
                const p = await browser.newPage();
                try {
                    await p.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 30000 });

                    const detailData = await p.evaluate(() => {
                        const allNodes = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div, p.MuiTypography-root, li'));
                        let rawAddress = '';

                        // High priority: Specific known address locations in Mochaclass DOM
                        const addrElements = document.querySelectorAll('p.MuiTypography-body1, .MuiBox-root p, .css-1vscdpm p');
                        for (const el of Array.from(addrElements)) {
                            const text = el.textContent?.trim() || '';
                            if (text.includes('대한민국') && (text.includes('위치') || text.includes('서울') || text.includes('경기') || text.includes('부산'))) {
                                rawAddress = text.replace(/^.*?위치\s*/, '').trim();
                                break;
                            }
                        }

                        // Fallback 1: search text content for labels
                        if (!rawAddress) {
                            const labels = ['위치', '장소', '스튜디오', '공방'];
                            for (const label of labels) {
                                for (let i = 0; i < allNodes.length; i++) {
                                    if (allNodes[i].textContent?.trim() === label) {
                                        const container = allNodes[i].closest('div')?.parentElement;
                                        if (container) {
                                            const text = container.textContent || '';
                                            // Look for Korea address pattern
                                            const match = text.match(/(대한민국\s+)?([가-힣]+(도|시|구|군|동|로|길)\s*)+[\d-]+\s*.*?(?=(찾아오는|지도|$))/);
                                            if (match) {
                                                rawAddress = match[0].trim();
                                                break;
                                            }
                                        }
                                    }
                                }
                                if (rawAddress) break;
                            }
                        }

                        // Fallback 2: regex search entire body if short enough
                        if (!rawAddress) {
                            const bodyText = document.body.innerText;
                            const match = bodyText.match(/(?:위치|주소)\s*(?::)?\s*(대한민국\s+)?(([가-힣]+(?:시|도|구|군|동|읍|면|로|길))\s+)+[\d-]+\s*[^\n,.<>]{0,50}/);
                            if (match) {
                                rawAddress = match[0].replace(/^(위치|주소)\s*(:)?\s*/, '').trim();
                            }
                        }

                        const timeEl = document.querySelector('#topleft > div:nth-child(11) > section');
                        const priceEl = document.querySelector('#topleft > div:nth-child(2) > div.css-7df1aj > div.css-q3pnu7');

                        return {
                            rawAddress: rawAddress,
                            time: timeEl ? (timeEl as HTMLElement).innerText?.trim() || '' : '',
                            detailPrice: priceEl ? (priceEl as HTMLElement).innerText?.trim() || '' : ''
                        };
                    });

                    let detailPrice = detailData.detailPrice;
                    if (detailPrice) {
                        const match = detailPrice.match(/[\d,]+원/);
                        if (match) detailPrice = match[0];
                    }

                    // Extract tag from title (e.g. [제주], [강남])
                    const tagMatch = item.title.match(/\[([^\]]+)\]/);
                    const titleTag = tagMatch ? tagMatch[1] : '';

                    let address = detailData.rawAddress || '서울';
                    address = address.replace(/^대한민국\s*/, '').trim();

                    let district = '';
                    // Try to extract district from address or title tag
                    const districtMatch = address.match(/([가-힣]+[구|시|군])/);
                    if (districtMatch) {
                        district = districtMatch[1];
                    } else if (titleTag) {
                        const tagDistrictMatch = titleTag.match(/([가-힣]+[구|시|군])/);
                        if (tagDistrictMatch) district = tagDistrictMatch[1];
                    }

                    // Map region based on address or title tag
                    const regionKeywords: Record<string, string> = {
                        '서울': 'seoul', '강남': 'seoul', '홍대': 'seoul', '경기': 'gyeonggi', '인천': 'gyeonggi',
                        '부산': 'busan', '서면': 'busan', '제주': 'jeju', '광주': 'gwangju', '대구': 'daegu', '대전': 'daejeon'
                    };
                    
                    let mappedRegion = address.includes('서울') ? 'seoul' : (address.includes('경기') ? 'gyeonggi' : '');
                    if (!mappedRegion && titleTag) {
                        for (const [k, v] of Object.entries(regionKeywords)) {
                            if (titleTag.includes(k)) {
                                mappedRegion = v;
                                break;
                            }
                        }
                    }

                    // Use accurate address as venue, fallback to Tag or District
                    let venue = (address && address.length > 5) ? address : (titleTag || (district ? `모카클래스 (${district})` : '모카클래스'));

                    // If address has studio name, we can format it nicer
                    // E.g. "대한민국 서울특별시 송파구 송파동 90-7 1층 개더링스튜디오"
                    // Venue is the full string, address is also full string. Usually `fix-venue-coordinates` will handle it.

                    // Calculate discount properly
                    let discountCalc = '';
                    const actualPrice = detailPrice || item.price;
                    const pVal = parseInt(actualPrice.replace(/[^0-9]/g, '')) || 0;
                    const opVal = parseInt(item.originalPrice.replace(/[^0-9]/g, '')) || 0;
                    if (pVal > 0 && opVal > 0 && pVal < opVal) {
                        discountCalc = Math.round((1 - pVal / opVal) * 100) + '%';
                    }

                    // Stable ID
                    const id = `class_${slugify(item.title)}`;

                    return {
                        id,
                        title: item.title,
                        image: item.image,
                        date: 'OPEN RUN',
                        venue: venue,
                        link: item.link,
                        region: address.includes('서울') ? 'seoul' : 'gyeonggi',
                        genre: 'class',
                        price: detailPrice || item.price,
                        originalPrice: item.originalPrice,
                        discount: discountCalc,
                        runningTime: detailData.time || '예약페이지 참조',
                        ageLimit: '전체',
                        casting: '',
                        address: address,
                        lastEnriched: new Date().toISOString()
                    };
                } catch (e: any) {
                    console.error(`Error processing ${item.link}:`, e.message);
                    return null;
                } finally {
                    await p.close();
                }
            });

            const results = await Promise.all(promises);
            results.forEach(r => { if (r) allItems.push(r); });
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

scrapeMochaClass().catch(console.error);
