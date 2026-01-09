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
}

interface ListItem {
    id: string; title: string; thumbnailImage: string; urlParams?: { cat1: string, cat2: string, areacode: string };
}

function parseRegion(address: string): string {
    if (!address) return 'etc';
    for (const [prefix, regionId] of Object.entries(REGION_MAP)) {
        if (address.startsWith(prefix)) return regionId;
    }
    return 'etc';
}

// Sequential List Scraping + Parallel Detail Scraping
async function scrapeListPage(page: Page, pageNum: number): Promise<ListItem[]> {
    // We assume the page is already at the correct location or we will navigate to it relative to current state.
    // However, for pure sequential scraping, we just need to "get current items".
    // AND then "go to next page" at the end of the loop.
    // So this function just extracts items from CURRENT page.

    return page.evaluate(() => {
        const results: ListItem[] = [];
        const listItems = document.querySelectorAll('ul.list_thumType > li');
        listItems.forEach((li) => {
            const titleLink = li.querySelector('.area_txt .tit a') as HTMLAnchorElement;
            const img = li.querySelector('.area_img img') as HTMLImageElement;
            if (titleLink) {
                const onclick = titleLink.getAttribute('onclick') || '';
                const match = onclick.match(/goDetail\(([^)]+)\)/);
                if (match) {
                    const args = match[1].split(',').map(s => s.trim().replace(/['"]/g, ''));
                    if (args.length >= 4) {
                        const [id, cat1, cat2, areacode] = args;
                        results.push({ id, title: titleLink.innerText.trim(), thumbnailImage: img?.src || '', urlParams: { cat1, cat2, areacode } });
                    } else if (args.length >= 1) {
                        results.push({ id: args[0], title: titleLink.innerText.trim(), thumbnailImage: img?.src || '' });
                    }
                }
            }
        });
        return results;
    });
}

// Helper to navigate to next page from current state
async function goToNextPage(page: Page, targetPageNum: number): Promise<boolean> {
    const navigationPromise = page.waitForResponse(response =>
        response.url().includes('list/travelinfo.do') && response.status() === 200
        , { timeout: 10000 }).catch(() => null);

    const clicked = await page.evaluate((targetNum) => {
        // 1. Try clicking specific page number ID first (e.g., "11")
        const directLink = document.querySelector(`.page_box a[id="${targetNum}"]`) as HTMLElement;
        if (directLink) {
            directLink.click();
            return true;
        }

        // 2. If not found, try clicking "Next" button (.btn_next)
        // Check if btn_next exists and looks like it advances us (optimization: sometimes btn_next id is targetNum)
        const nextBtn = document.querySelector('.btn_next') as HTMLElement;
        if (nextBtn) {
            nextBtn.click();
            return true;
        }

        return false;
    }, targetPageNum);

    if (clicked) {
        await navigationPromise;
        // Small stability wait
        await new Promise(r => setTimeout(r, 500));
        return true;
    }

    return false;
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
                const allInfoContents = document.querySelectorAll('.info_content');
                for (const el of allInfoContents) {
                    const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
                    if (text.includes('~') || text.match(/\d{4}\.\d{2}/)) { date = text; break; }
                }
            }

            let venue = '';
            const locIcon = document.querySelector('.info_ico.location');
            if (locIcon && locIcon.nextElementSibling) venue = locIcon.nextElementSibling.textContent?.trim() || '';
            if (!venue) {
                const allInfoContents = document.querySelectorAll('.info_content');
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
        };
    } catch (error) {
        console.error(`Failed to scrape detail for ID ${item.id}:`, error);
        return null;
    }
}

async function main() {
    console.log('Starting VisitKorea Festival Scraper (Sequential List / Parallel Details)...');
    console.log(`Target Concurrency: ${CONCURRENCY}`);

    let existingItems: FestivalItem[] = [];
    const existingIds = new Set<string>();

    if (fs.existsSync(OUTPUT_FILE)) {
        try {
            const loaded = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
            existingItems = loaded.filter((item: FestivalItem) => item.date && item.venue);
            existingItems.forEach(item => existingIds.add(item.id));
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

        const newItems = Array.from(uniqueListItems.values()).filter(item => !existingIds.has(item.id));
        console.log(`New items to scrape details: ${newItems.length}`);

        if (newItems.length === 0) {
            console.log('No new items. Done.');
            await browser.close();
            return;
        }

        // PARALLEL DETAIL SCRAPING
        console.log('Starting Parallel Detail Scraping...');
        const results = [...existingItems];
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
