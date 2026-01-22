/**
 * VisitKorea Festival Scraper (Nationwide) - Fully Parallel Version
 * Scrapes festival data from korean.visitkorea.or.kr for all Korean provinces.
 * Parallelized List Scraping AND Detail Scraping.
 */

import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

puppeteer.use(StealthPlugin());

const OUTPUT_FILE = path.join(process.cwd(), 'src/data/festivals.json');
const BASE_URL = 'https://korean.visitkorea.or.kr';
const LIST_URL = 'https://korean.visitkorea.or.kr/kfes/list/wntyFstvlList.do';
const DETAIL_BASE_URL = `${BASE_URL}/kfes/detail/fstvlDetail.do`;

// Configuration
const CONCURRENCY = 5;
const SAVE_INTERVAL = 50;
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

const REGION_MAP: Record<string, string> = {
    '서울': 'seoul', '경기': 'gyeonggi', '인천': 'incheon', '부산': 'busan', '대구': 'daegu',
    '광주': 'gwangju', '대전': 'daejeon', '울산': 'ulsan', '세종': 'sejong', '강원': 'gangwon',
    '충북': 'chungbuk', '충남': 'chungnam', '전북': 'jeonbuk', '전남': 'jeonnam', '경북': 'gyeongbuk',
    '경남': 'gyeongnam', '제주': 'jeju',
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
    link?: string;
}

function parseRegion(address: string): string {
    for (const [k, v] of Object.entries(REGION_MAP)) {
        if (address.includes(k)) return v;
    }
    return 'etc';
}

async function scrapeListPage(page: Page, pageNum: number): Promise<ListItem[]> {
    try {
        // Updated Selectors for New Layout
        return await page.evaluate(() => {
            const items: ListItem[] = [];
            const lis = document.querySelectorAll('#fstvlList > li');

            lis.forEach((el) => {
                const linkEl = el.querySelector('a');
                if (!linkEl) return;

                const href = linkEl.getAttribute('href') || '';
                const url = new URL(href, 'https://korean.visitkorea.or.kr');
                const id = url.searchParams.get('fstvlCntntsId') || '';

                if (!id) return;

                const titleEl = el.querySelector('.other_festival_content strong');
                const title = titleEl?.textContent?.trim() || '';

                const imgEl = el.querySelector('.other_festival_img img');
                const thumbnailImage = (imgEl as HTMLImageElement)?.src || '';

                const dateEl = el.querySelector('.date');
                const date = dateEl?.textContent?.trim() || '';

                const locEl = el.querySelector('.loc');
                const venue = locEl?.textContent?.trim() || '';

                items.push({ id, title, thumbnailImage, date, venue, link: href });
            });
            return items;
        });
    } catch (e) {
        console.error(`Page ${pageNum} scrape error:`, e);
        return [];
    }
}

async function scrapeDetailPage(page: Page, item: ListItem): Promise<FestivalItem | null> {
    // If we already have all data from list, just return it.
    if (item.date && item.venue) {
        return {
            id: item.id,
            title: item.title,
            image: item.thumbnailImage,
            date: item.date,
            venue: item.venue,
            region: parseRegion(item.venue),
            link: `${DETAIL_BASE_URL}?fstvlCntntsId=${item.id}`,
            genre: 'festival',
            lastEnriched: new Date().toISOString()
        };
    }

    // Fallback to scraping detail if info missing (Unlikely with new layout)
    let url = `${DETAIL_BASE_URL}?fstvlCntntsId=${item.id}`;

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        // ... (Existing extraction logic could go here if needed, but simplified for now)
        return null;
    } catch (error) {
        return null;
    }
}

async function main() {
    console.log('Starting VisitKorea Festival Scraper (Sequential List / Parallel Details)...');
    console.log(`Target Concurrency: ${CONCURRENCY}`);

    let existingItems: FestivalItem[] = [];
    let results: FestivalItem[] = []; // Hoisted for safe saving
    const existingMap = new Map<string, FestivalItem>();

    if (fs.existsSync(OUTPUT_FILE)) {
        try {
            const loaded = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
            existingItems = loaded.filter((item: FestivalItem) => item.date && item.venue);
            existingItems.forEach(item => existingMap.set(item.id, item));
            console.log(`Loaded ${existingItems.length} valid existing items.`);
            results = [...existingItems]; // Initialize results with existing Items
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
        // Clean headers for stealth
        await listPage.setExtraHTTPHeaders({
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        });

        console.log(`Loading festival list from: ${LIST_URL}`);
        await listPage.goto(LIST_URL, { waitUntil: 'networkidle0', timeout: 60000 });

        // LOAD MORE SCRAPING (New Layout uses 'Load More' button)
        console.log('Starting Load More Scraping...');

        const uniqueListItems = new Map<string, ListItem>();
        const maxPages = 20; // Safety limit

        // Initial scrape
        let prevCount = 0;
        let noChangeCount = 0;

        for (let p = 1; p <= maxPages; p++) {
            // Intelligent Throttling: Random delay between actions
            await delay(Math.random() * 2000 + 1000);

            // Scrape current visible items
            const items = await scrapeListPage(listPage, p);
            items.forEach(item => {
                if (!uniqueListItems.has(item.id)) uniqueListItems.set(item.id, item);
            });

            const currentCount = uniqueListItems.size;
            // console.log(`  Iteration ${p}: Found ${items.length} visible items. Total Unique: ${currentCount}`);

            if (currentCount === prevCount) {
                noChangeCount++;
                if (noChangeCount >= 3) {
                    console.log(`No new items found for 3 iterations (Stuck at ${currentCount}). Stopping.`);
                    break;
                }
            } else {
                noChangeCount = 0;
                console.log(`  Iteration ${p}: Total Unique Items: ${currentCount}`);
            }
            prevCount = currentCount;

            // Click "Load More" button
            const hasMore = await listPage.evaluate(async () => {
                const buttons = Array.from(document.querySelectorAll('a, button'));
                const loadMoreBtn = buttons.find(b => b.textContent?.includes('더보기'));
                if (loadMoreBtn) {
                    (loadMoreBtn as HTMLElement).click();
                    return true;
                }
                return false;
            });

            if (!hasMore) {
                console.log('No "Load More" button found. Reached end of list.');
                break;
            }

            // Wait for list to expand
            await new Promise(resolve => setTimeout(resolve, 3000));
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
            // Save skipped items just in case order changed
            // Use atomic save here too
            const tempFile = `${OUTPUT_FILE}.temp`;
            fs.writeFileSync(tempFile, JSON.stringify(skippedItems, null, 2));
            fs.renameSync(tempFile, OUTPUT_FILE);

            await browser.close();
            return;
        }

        // PARALLEL DETAIL SCRAPING
        console.log('Starting Parallel Detail Scraping...');
        results = [...skippedItems]; // Start with skipped items

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

                // Throttling for detail pages
                await delay(Math.random() * 1000 + 500);

                const detail = await scrapeDetailPage(page, item);
                if (detail) results.push(detail);

                processedCount++;
                if (processedCount % 10 === 0) {
                    const percent = Math.round((processedCount / totalDetails) * 100);
                    const bar = '='.repeat(Math.floor(percent / 5)) + '-'.repeat(20 - Math.floor(percent / 5));
                    console.log(`[${bar}] ${percent}% (${processedCount}/${totalDetails})`);
                }

                if (processedCount - lastSaveCount >= SAVE_INTERVAL) {
                    // Safe Intermediate Save (Atomic)
                    const tempFile = `${OUTPUT_FILE}.temp`;
                    fs.writeFileSync(tempFile, JSON.stringify(results, null, 2));
                    fs.renameSync(tempFile, OUTPUT_FILE);

                    console.log(`  [Saved] ${results.length} items total.`);
                    lastSaveCount = processedCount;
                }
            }
        };

        await Promise.all(workers.map(p => workerTask(p)));
        console.log('Done.');

    } catch (e) {
        console.error('Fatal Error:', e);
    } finally {
        await browser.close();

        // Final Atomic Save (Circuit Breaker)
        if (results.length > 0) {
            console.log(`Final Save: ${results.length} items to ${OUTPUT_FILE}`);
            const tempFile = `${OUTPUT_FILE}.temp`;
            fs.writeFileSync(tempFile, JSON.stringify(results, null, 2));
            fs.renameSync(tempFile, OUTPUT_FILE);
        } else {
            // Safety measure: Do NOT overwrite if results are empty, unless the list was genuinely empty (handled earlier)
            console.warn('Scraper finished with 0 items. Aborting save to protect existing data.');
        }
    }
}

main().catch(console.error);
