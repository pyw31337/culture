
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import cliProgress from 'cli-progress';

function slugify(text: string): string {
    return text
        .replace(/[^a-zA-Z0-9가-힣]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

// Types
interface ScrapedEvent {
    id: string;
    title: string;
    date: string;
    place: string;
    poster: string;
    time?: string;
    cost?: string;
    runningTime?: string;
    ageRating?: string;
    price?: string;
    genre: string;
    source: 'seoul-culture';
    link: string;
    lastEnriched?: string;
}

function formatDateParam(date: Date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('-');
}

function buildTargetUrl() {
    const start = new Date();
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 1);
    return `https://culture.seoul.go.kr/culture/culture/cultureEvent/list.do?menuNo=200110&sdate=${formatDateParam(start)}&edate=${formatDateParam(end)}`;
}

const TARGET_URL = buildTargetUrl();
const OutputPath = path.join(process.cwd(), 'src/data/seoul-culture.json');

async function mapCategory(title: string): Promise<string> {
    const t = title.toLowerCase();
    if (t.includes('뮤지컬')) return 'musical';
    if (t.includes('콘서트')) return 'concert';
    if (t.includes('연극')) return 'theater';
    if (t.includes('클래식') || t.includes('음악회') || t.includes('독주회') || t.includes('리사이틀')) return 'classic';
    if (t.includes('전시') || t.includes('미술') || t.includes('사진') || t.includes('박물관') || t.includes('개인전')) return 'exhibition';
    if (t.includes('클래스') || t.includes('강좌') || t.includes('교육') || t.includes('교실')) return 'class';
    if (t.includes('체험') || t.includes('축제') || t.includes('페스티벌')) return 'leisure';
    return 'unknown';
}

async function scrapeList(browser: any) {
    console.log('🚀 Starting Seoul Culture List Scraper...');
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // 1. Initial Navigation
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });

    // Wait for list
    try {
        await page.waitForSelector('#dataList > li', { timeout: 10000 });
    } catch (e) {
        console.log('No list items found.');
        return [];
    }

    const collectedEvents: ScrapedEvent[] = [];
    let hasNext = true;
    let pageNum = 1;
    let lastFirstLink = '';
    const MAX_PAGES = 50;

    while (hasNext && pageNum <= MAX_PAGES) {
        process.stdout.write(`\r📄 Scraping List Page ${pageNum}... `);

        // Wait slightly
        if (pageNum > 1) {
            try {
                await page.waitForSelector('#dataList > li', { timeout: 5000 });
            } catch (e) { }
        }

        const listItems = await page.evaluate(() => {
            const items: any[] = [];
            const rows = document.querySelectorAll('#dataList > li');
            rows.forEach((row) => {
                const linkEl = row.querySelector('a');
                if (!linkEl) return;
                const link = linkEl.href;
                const img = row.querySelector('.img img')?.getAttribute('src');
                const title = row.querySelector('.txt2 .tit')?.textContent?.trim() || '';
                const place = row.querySelector('.txt2 .place')?.textContent?.trim() || '';
                const dateDiv = row.querySelector('.txt2 > div');
                const date = dateDiv?.textContent?.trim().replace(/\s+/g, ' ') || '';
                const absoluteImg = img ? (img.startsWith('http') ? img : `https://culture.seoul.go.kr${img}`) : '';

                items.push({ title, link, poster: absoluteImg, place, date });
            });
            return items;
        });

        if (listItems.length === 0) break;
        if (listItems[0].link === lastFirstLink) {
            console.log('   ⚠️ Detected Page Stagnation. Stopping.');
            break;
        }
        lastFirstLink = listItems[0].link;

        for (const item of listItems) {
            const id = `perf_${slugify(item.title)}`;
            const genre = await mapCategory(item.title);
            collectedEvents.push({
                id,
                title: item.title,
                date: item.date,
                place: item.place,
                poster: item.poster,
                genre,
                source: 'seoul-culture',
                link: item.link
            });
        }

        // Next Page
        const nextResult = await page.evaluate((pNum: number) => {
            // @ts-ignore
            if (typeof initPageData === 'function') {
                // @ts-ignore
                initPageData(pNum + 1);
                return true;
            }
            return false;
        }, pageNum);

        if (nextResult) {
            await new Promise(r => setTimeout(r, 1500));
            try { await page.waitForNetworkIdle({ timeout: 2000 }).catch(() => { }); } catch (e) { }
        } else {
            // Click fallback
            const hasNextBtn = await page.$('.paging .next > a');
            if (!hasNextBtn) {
                hasNext = false;
            } else {
                await page.click('.paging .next > a');
                await new Promise(r => setTimeout(r, 1500));
            }
        }
        pageNum++;
    }
    console.log(`\nFound ${collectedEvents.length} items.`);
    await page.close();
    return collectedEvents;
}

async function enrichItems(browser: any, items: ScrapedEvent[], existingMap: Map<string, ScrapedEvent>) {
    if (process.env.SEOUL_CULTURE_SKIP_DETAIL === '1') {
        return items.map((item) => ({
            ...existingMap.get(item.id),
            ...item,
            lastEnriched: new Date().toISOString(),
        }));
    }

    // Determine TODO
    const todo: ScrapedEvent[] = [];
    const done: ScrapedEvent[] = [];

    // Helper: Check if item was enriched recently (e.g., within 7 days)
    const isRecentlyEnriched = (ex: ScrapedEvent) => {
        if (!ex.lastEnriched) return false;
        try {
            const last = new Date(ex.lastEnriched);
            const now = new Date();
            const diffDays = (now.getTime() - last.getTime()) / (1000 * 3600 * 24);
            return diffDays < 7;
        } catch (e) { return false; }
    };

    items.forEach(item => {
        if (existingMap.has(item.id)) {
            const ex = existingMap.get(item.id)!;
            // Check if enriched fields exist or recently checked
            if ((ex.price || ex.ageRating || ex.runningTime) || isRecentlyEnriched(ex)) {
                done.push({ ...item, ...ex });
            } else {
                todo.push(item);
            }
        } else {
            todo.push(item);
        }
    });

    console.log(`Total: ${items.length}. Cached/Skipped: ${done.length}. To Enrich: ${todo.length}.`);

    const enrichedResults = [...done];
    if (todo.length === 0) return enrichedResults;

    const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    bar.start(todo.length, 0);

    const CONCURRENCY = 5;
    for (let i = 0; i < todo.length; i += CONCURRENCY) {
        const chunk = todo.slice(i, i + CONCURRENCY);

        const promises = chunk.map(async (item) => {
            const page = await browser.newPage();
            try {
                // ... setup ...
                await page.setRequestInterception(true);
                page.on('request', (req: any) => {
                    if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                        req.abort();
                    } else {
                        req.continue();
                    }
                });

                await page.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 15000 });

                const details = await page.evaluate(() => {
                    const ul = document.querySelector('.type-box > ul');
                    if (!ul) return null;

                    const res: any = {};
                    ul.querySelectorAll('li').forEach(li => {
                        const txt = li.textContent || '';
                        if (txt.includes('기간')) {
                            res.period = li.querySelector('.type-td')?.textContent?.trim() || '';
                        } else if (txt.includes('시간')) {
                            res.time = li.querySelector('.type-td')?.textContent?.trim() || '';
                        } else if (txt.includes('대상') || txt.includes('연령')) {
                            res.target = li.querySelector('.type-td')?.textContent?.trim() || '';
                        } else if (txt.includes('요금') || txt.includes('비용')) {
                            res.cost = li.querySelector('.type-td')?.textContent?.trim() || '';
                        }
                    });

                    return res;
                });

                let result = {
                    ...item,
                    lastEnriched: new Date().toISOString()
                };

                if (details) {
                    let price = details.cost || '';
                    if (price.includes('/')) {
                        price = price.split('/')[0].trim();
                    }
                    if (price.includes('(')) {
                        // Keep (reservation required) if needed, but strictly price usually doesn't have it
                    }
                    // Clean newlines
                    price = price.replace(/\n/g, ' ').trim();

                    let timeInfo = details.time ? `[시간] ${details.time}` : '';

                    result = {
                        ...result,
                        date: details.period ? details.period.replace(/\s+/g, ' ') : item.date,
                        runningTime: timeInfo, // Map detailed time string here
                        ageRating: details.target,
                        price: price, // Keep full price string
                        cost: price
                    };
                }
                return result;
            } catch (e) {
                return item;
            } finally {
                await page.close();
            }
        });

        const results = await Promise.all(promises);
        enrichedResults.push(...results);
        bar.increment(results.length);

        // Autosave
        if (i % 20 === 0) {
            fs.writeFileSync(OutputPath, JSON.stringify(enrichedResults, null, 2));
        }
    }
    bar.stop();
    return enrichedResults;
}

(async () => {
    // Load existing
    const existingMap = new Map<string, ScrapedEvent>();
    if (fs.existsSync(OutputPath)) {
        try {
            const data = JSON.parse(fs.readFileSync(OutputPath, 'utf-8'));
            data.forEach((d: ScrapedEvent) => existingMap.set(d.id, d));
        } catch (e) { }
    }

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const listItems = await scrapeList(browser);

        // Enrich
        let finalItems = listItems;
        try {
            finalItems = await enrichItems(browser, listItems, existingMap);
        } catch (error) {
            console.warn('⚠️ Detail enrichment failed; saving list-level Seoul Culture data.', error);
            finalItems = listItems.map((item) => ({
                ...existingMap.get(item.id),
                ...item,
                lastEnriched: new Date().toISOString(),
            }));
        }

        // Final Save
        fs.writeFileSync(OutputPath, JSON.stringify(finalItems, null, 2));
        console.log(`✅ Saved ${finalItems.length} items to ${OutputPath}`);

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();
