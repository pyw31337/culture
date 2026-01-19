
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import cliProgress from 'cli-progress';

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
}

const TARGET_URL = 'https://culture.seoul.go.kr/culture/culture/cultureEvent/list.do?menuNo=200110&sdate=2026-01-01&edate=2026-12-31';
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
            const id = crypto.createHash('md5').update(item.link).digest('hex');
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
    // Determine TODO
    const todo: ScrapedEvent[] = [];
    const done: ScrapedEvent[] = [];

    items.forEach(item => {
        if (existingMap.has(item.id)) {
            const ex = existingMap.get(item.id)!;
            // Check if enriched fields exist
            if (ex.price || ex.ageRating || ex.runningTime) {
                done.push({ ...item, ...ex }); // keep fresher list info but old details
            } else {
                todo.push(item);
            }
        } else {
            todo.push(item);
        }
    });

    console.log(`Total: ${items.length}. Cached: ${done.length}. To Enrich: ${todo.length}.`);

    const enrichedResults = [...done];
    if (todo.length === 0) return enrichedResults;

    const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    bar.start(todo.length, 0);

    const CONCURRENCY = 15;
    for (let i = 0; i < todo.length; i += CONCURRENCY) {
        const chunk = todo.slice(i, i + CONCURRENCY);

        const promises = chunk.map(async (item) => {
            const page = await browser.newPage();
            try {
                // Optimization
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
                    const getDesc = (n: number) => ul.querySelector(`li:nth-child(${n}) .type-td`)?.textContent?.trim() || '';

                    return {
                        period: getDesc(2).replace(/\s+/g, ' '),
                        time: getDesc(3),
                        target: getDesc(4),
                        cost: getDesc(5)
                    };
                });

                if (details) {
                    // "R석 77,000원 / S석 ..." -> "R석 77,000원"
                    let price = details.cost;
                    if (price.includes('/')) {
                        price = price.split('/')[0].trim();
                    }
                    if (price.includes('\n')) {
                        price = price.split('\n')[0].trim();
                    }

                    return {
                        ...item,
                        date: details.period || item.date, // Update date with period if available
                        runningTime: details.time,
                        time: details.time,
                        ageRating: details.target,
                        price: price,
                        cost: price
                    };
                }
                return item;
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
        const finalItems = await enrichItems(browser, listItems, existingMap);

        // Final Save
        fs.writeFileSync(OutputPath, JSON.stringify(finalItems, null, 2));
        console.log(`✅ Saved ${finalItems.length} items to ${OutputPath}`);

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();
