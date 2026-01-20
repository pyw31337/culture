/**
 * VisitKorea Festival Scraper (Nationwide) - Fully Parallel Version
 * Scrapes festival data from korean.visitkorea.or.kr for all Korean provinces.
 * Parallelized List Scraping AND Detail Scraping.
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_FILE = path.join(process.cwd(), 'src/data/festivals.json');
const BASE_URL = 'https://korean.visitkorea.or.kr';
const LIST_URL = `${BASE_URL}/list/travelinfo.do?service=show`;
const DETAIL_BASE_URL = `${BASE_URL}/detail/fes_detail.do`;

// Configuration
const CONCURRENCY = 5;
const SAVE_INTERVAL = 50;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const REGION_MAP: Record<string, string> = {
    '서울': 'seoul', '경기': 'gyeonggi', '인천': 'incheon', '부산': 'busan', '대구': 'daegu',
    '광주': 'gwangju', '대전': 'daejeon', '울산': 'ulsan', '세종': 'sejong', '강원': 'gangwon',
    '충북': 'chungbuk', '충남': 'chungnam', '전북': 'jeonbuk', '전남': 'jeonnam', '경북': 'gyeongbuk',
    '경남': 'gyeongnam', '제주': 'jeju',
};

interface FestivalItem {
    id: string; title: string; image: string; date: string; venue: string; region: string; link: string; genre: string;
    lastEnriched?: string;
}

interface ListItem {
    id: string;
    title: string;
    thumbnailImage: string;
    date?: string;
    venue?: string;
    urlParams?: {
        cat1: string;
        cat2: string;
        areacode: string;
    };
}

function parseRegion(address: string): string {
    for (const [k, v] of Object.entries(REGION_MAP)) {
        if (address.includes(k)) return v;
    }
    return 'etc';
}

async function scrapeListPage(page: Page, pageNum: number): Promise<ListItem[]> {
    try {
        return await page.evaluate(() => {
            const items: ListItem[] = [];
            const lis = document.querySelectorAll('.list_thum_type > li');
            lis.forEach((el) => {
                const titleEl = el.querySelector('.tit a');
                const title = titleEl?.textContent?.replace(/<!--.*?-->/g, '').trim() || '';

                const imgEl = el.querySelector('.photo img');
                const thumbnailImage = (imgEl as HTMLImageElement)?.src || '';

                const onclick = titleEl?.getAttribute('onclick');
                let id = '';
                let urlParams;

                if (onclick) {
                    // fn_detail('COTID', 'CAT1', 'CAT2', 'AREA') or goDetail
                    // Found variations like goDetail('2816781', '', '', '35')
                    const match = onclick.match(/['"]([0-9]+)['"]\s*,\s*['"](.*?)['"]\s*,\s*['"](.*?)['"]\s*,\s*['"](.*?)['"]/);
                    if (match) {
                        id = match[1];
                        urlParams = { cat1: match[2], cat2: match[3], areacode: match[4] };
                    }
                }

                if (id) {
                    items.push({ id, title, thumbnailImage, urlParams });
                }
            });
            return items;
        });
    } catch (e) {
        return [];
    }
}

async function goToNextPage(page: Page, targetPage: number): Promise<boolean> {
    try {
        // Try executing the script directly which is more reliable than clicking
        await page.evaluate((p) => {
            if (typeof (window as any).fn_link_page === 'function') {
                (window as any).fn_link_page(p);
            }
        }, targetPage);

        // Wait for network/content update
        await new Promise(resolve => setTimeout(resolve, 2000));
        return true;
    } catch (e) {
        return false;
    }
}

async function scrapeDetailPage(page: Page, item: ListItem): Promise<FestivalItem | null> {
    let url = '';
    if (item.urlParams) {
        url = `${DETAIL_BASE_URL}?cotid=${item.id}&big_category=${item.urlParams.cat1}&mid_category=${item.urlParams.cat2}&big_area=${item.urlParams.areacode}`;
    } else {
        url = `${DETAIL_BASE_URL}?cotid=${item.id}`;
    }

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        try { await page.waitForSelector('.detail_img_box img, .visula_bg, .info_ico', { timeout: 3000 }); } catch (e) { }

        const details = await page.evaluate(() => {
            let image = '';
            const posterImg = document.querySelector('.detail_img_box img') as HTMLImageElement;
            if (posterImg?.src) image = posterImg.src;
            if (!image) { const swiperImg = document.querySelector('.swiper-slide img') as HTMLImageElement; if (swiperImg?.src) image = swiperImg.src; }
            if (!image) { const bgDiv = document.querySelector('.visula_bg, .visual_bg'); if (bgDiv) { const bgImage = window.getComputedStyle(bgDiv).backgroundImage; const urlMatch = bgImage.match(/url\(["']?([^"')]+)["']?\)/); if (urlMatch) image = urlMatch[1]; } }
            if (!image) { const anyImg = document.querySelector('.poster_detail img, .detail_info img, section img') as HTMLImageElement; if (anyImg?.src) image = anyImg.src; }

            let date = '';
            const dataIcon = document.querySelector('.info_ico.data');
            if (dataIcon && dataIcon.nextElementSibling) {
                date = (dataIcon.nextElementSibling.textContent || '').replace(/\s+/g, ' ').trim();
            }
            if (!date) {
                const allInfoContents = Array.from(document.querySelectorAll('.info_content'));
                for (const el of allInfoContents) {
                    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
                    if (text.includes('~') || text.match(/\d{4}\.\d{2}/)) { date = text; break; }
                }
            }

            let venue = '';
            const locIcon = document.querySelector('.info_ico.location');
            if (locIcon && locIcon.nextElementSibling) venue = locIcon.nextElementSibling.textContent?.trim() || '';
            if (!venue) {
                const allInfoContents = Array.from(document.querySelectorAll('.info_content'));
                for (const el of allInfoContents) {
                    const text = el.textContent?.trim() || '';
                    if (text.includes('도 ') || text.includes('시 ') || text.includes('군 ') || text.includes('구 ')) { venue = text; break; }
                }
            }
            const titleEl = document.querySelector('h2#festival_head') || document.querySelector('.fstvl_tit') || document.querySelector('h2.tit') || document.querySelector('.poster_detail_wrap h2');
            const title = titleEl?.textContent?.trim() || '';
            return { image, date, venue, title };
        });

        return {
            id: item.id,
            title: details.title || item.title,
            image: details.image || item.thumbnailImage,
            date: details.date || '',
            venue: details.venue || '',
            region: parseRegion(details.venue),
            link: url,
            genre: 'festival',
            lastEnriched: new Date().toISOString()
        };
    } catch (error) {
        console.error(`Failed to scrape detail for ID ${item.id}:`, error);
        return null;
    }
}
// ... (main function continues)

// inside main loop:
// for (const item of Array.from(uniqueListItems.values())) { ... }


async function main() {
    console.log('Starting VisitKorea Festival Scraper (Sequential List / Parallel Details)...');
    console.log(`Target Concurrency: ${CONCURRENCY}`);

    let existingItems: FestivalItem[] = [];
    const existingMap = new Map<string, FestivalItem>();

    if (fs.existsSync(OUTPUT_FILE)) {
        try {
            const loaded = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
            existingItems = loaded.filter((item: FestivalItem) => item.date && item.venue);
            existingItems.forEach(item => existingMap.set(item.id, item));
            console.log(`Loaded ${existingItems.length} valid existing items.`);
        } catch (e) {
            console.error('Failed to load existing data:', e);
        }
    }

    const browser: Browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });

    try {
        const listPage = await browser.newPage();
        await listPage.setViewport({ width: 1280, height: 1024 });
        await listPage.setUserAgent(USER_AGENT);

        console.log('Loading festival list...');
        await listPage.goto(LIST_URL, { waitUntil: 'networkidle0', timeout: 60000 });

        // Detect total pages
        const totalPages = await listPage.evaluate(() => {
            const lastPageBtn = document.querySelector('.page_box .btn_last') as HTMLElement;
            if (lastPageBtn && lastPageBtn.id) return parseInt(lastPageBtn.id, 10);
            return 10; // Fallback
        });
        console.log(`Total Pages: ${totalPages}`);

        const uniqueListItems = new Map<string, ListItem>();
        const maxPages = Math.min(totalPages, 150);

        // SEQUENTIAL LIST SCRAPING
        console.log('Starting Sequential List Scraping...');

        for (let p = 1; p <= maxPages; p++) {
            // Scrape current page
            const items = await scrapeListPage(listPage, p);
            items.forEach(item => {
                if (!uniqueListItems.has(item.id)) uniqueListItems.set(item.id, item);
            });

            if (p % 5 === 0) console.log(`  Scraped Page ${p}/${maxPages} (Total Items: ${uniqueListItems.size})`);

            // Navigate to next page (if not last)
            if (p < maxPages) {
                const success = await goToNextPage(listPage, p + 1);
                if (!success) {
                    console.warn(`Failed to navigate to page ${p + 1}. Stopping list scraping.`);
                    break;
                }
            }
        }

        await listPage.close();
        console.log(`Found ${uniqueListItems.size} unique festivals in list.`);

        // Smart Incremental Filtering
        const newItems: ListItem[] = [];
        const skippedItems: FestivalItem[] = [];

        const isRecentlyEnriched = (ex: FestivalItem) => {
            if (!ex.lastEnriched) return false;
            try {
                const last = new Date(ex.lastEnriched);
                const now = new Date();
                const diffDays = (now.getTime() - last.getTime()) / (1000 * 3600 * 24);
                return diffDays < 7;
            } catch (e) { return false; }
        };

        for (const item of Array.from(uniqueListItems.values())) {
            const existing = existingMap.get(item.id);
            if (existing && isRecentlyEnriched(existing)) {
                skippedItems.push(existing);
            } else {
                newItems.push(item);
            }
        }

        console.log(`Skipped (Recent): ${skippedItems.length}. To Enrich: ${newItems.length}`);

        if (newItems.length === 0) {
            console.log('No new items to enrich. Done.');
            // Save skipped items just in case order changed or something, but essentially no change.
            // Actually we should save skippedItems + any other existing items not in list?
            // Usually we only save what's currently active.
            // Let's save `skippedItems` + `results` from newItems.
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(skippedItems, null, 2));
            await browser.close();
            return;
        }

        // PARALLEL DETAIL SCRAPING
        console.log('Starting Parallel Detail Scraping...');
        const results = [...skippedItems]; // Start with skipped items
        let processedCount = 0;
        let lastSaveCount = 0;
        const detailQueue = [...newItems];
        const totalDetails = detailQueue.length;

        // Reuse browser for workers
        const workers = await Promise.all(Array(CONCURRENCY).fill(null).map(async () => {
            const p = await browser.newPage();
            await p.setViewport({ width: 1280, height: 1024 });
            await p.setUserAgent(USER_AGENT);
            return p;
        }));

        const workerTask = async (page: Page) => {
            while (detailQueue.length > 0) {
                const item = detailQueue.shift();
                if (!item) break;

                const detail = await scrapeDetailPage(page, item);
                if (detail) results.push(detail);

                processedCount++;
                if (processedCount % 10 === 0) {
                    const percent = Math.round((processedCount / totalDetails) * 100);
                    const bar = '='.repeat(Math.floor(percent / 5)) + '-'.repeat(20 - Math.floor(percent / 5));
                    console.log(`[${bar}] ${percent}% (${processedCount}/${totalDetails})`);
                }

                if (processedCount - lastSaveCount >= SAVE_INTERVAL) {
                    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
                    console.log(`  [Saved] ${results.length} items total.`);
                    lastSaveCount = processedCount;
                }
            }
        };

        await Promise.all(workers.map(p => workerTask(p)));

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
        console.log(`Final Save: ${results.length} items to ${OUTPUT_FILE}`);
        console.log('Done.');

    } catch (e) {
        console.error('Fatal Error:', e);
    } finally {
        await browser.close();
    }
}

main().catch(console.error);
