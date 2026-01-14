
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

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

async function scrape() {
    console.log('🚀 Starting Seoul Culture Scraper (2026) - URL Params Strategy...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Set User Agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // 1. Initial Navigation with Search Params
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });
    console.log('   Page Loaded via URL Params.');

    // Check if dates are set in inputs (verification)
    const inputs = await page.evaluate(() => {
        const i1 = document.getElementById('datepicker01') as HTMLInputElement;
        const i2 = document.getElementById('datepicker02') as HTMLInputElement;
        return { start: i1?.value, end: i2?.value };
    });
    console.log('   Inputs Verification:', inputs);

    // Wait for list items to ensure content is there
    try {
        await page.waitForSelector('#dataList > li', { timeout: 10000 });
    } catch (e) {
        console.log('   No list items found on initial load. Dumping info...');
        const body = await page.evaluate(() => document.body.innerHTML);
        const text = await page.evaluate(() => document.body.innerText);
        console.log('--- BODY INNER TEXT (First 1000 chars) ---');
        console.log(text.substring(0, 1000));
        await browser.close();
        return;
    }

    let collectedEvents: ScrapedEvent[] = [];
    let hasNext = true;
    let pageNum = 1;
    let lastFirstId = '';

    const MAX_PAGES = 50;

    while (hasNext && pageNum <= MAX_PAGES) {
        console.log(`📄 Scraping Page ${pageNum}...`);

        // Wait slightly
        if (pageNum > 1) {
            try {
                await page.waitForSelector('#dataList > li', { timeout: 5000 });
            } catch (e) { }
        }

        // Extract Items
        const listItems = await page.evaluate(() => {
            const items: any[] = [];
            const rows = document.querySelectorAll('#dataList > li');
            rows.forEach((row, index) => {
                const linkEl = row.querySelector('a');
                if (!linkEl) return;
                const link = linkEl.href;
                const img = row.querySelector('.img img')?.getAttribute('src');
                const title = row.querySelector('.txt2 .tit')?.textContent?.trim() || '';
                const place = row.querySelector('.txt2 .place')?.textContent?.trim() || '';
                const dateDiv = row.querySelector('.txt2 > div');
                const date = dateDiv?.textContent?.trim().replace(/\s+/g, ' ') || '';
                const absoluteImg = img ? (img.startsWith('http') ? img : `https://culture.seoul.go.kr${img}`) : '';

                // Generate a pseudo-ID based on title + date to track duplication
                const pseudoId = title + '_' + date;

                items.push({ title, link, poster: absoluteImg, place, date, pseudoId });
            });
            return items;
        });

        // Check for stagnation
        if (listItems.length > 0) {
            if (listItems[0].pseudoId === lastFirstId) {
                console.log('   ⚠️ Detected Page Stagnation (Same content). Stopping.');
                break;
            }
            lastFirstId = listItems[0].pseudoId;
        } else {
            console.log('   No items on this page. Stopping.');
            break;
        }

        console.log(`   Found ${listItems.length} items.`);

        // Process Details
        for (const item of listItems) {
            let genre = await mapCategory(item.title);
            const detailPage = await browser.newPage();
            try {
                await detailPage.goto(item.link, { waitUntil: 'domcontentloaded' });
                const details = await detailPage.evaluate(() => {
                    const ul = document.querySelector('#print > div.intro-top.clearfix > div.txt-box > div.type-box > ul');
                    if (!ul) return {};

                    const getDesc = (n: number) => ul.querySelector(`li:nth-child(${n}) .type-td`)?.textContent?.trim() || '';

                    return {
                        placeDetail: getDesc(1), // Place
                        period: getDesc(2),  // Period
                        time: getDesc(3),    // Time
                        target: getDesc(4),  // Target (Age)
                        cost: getDesc(5)     // Price
                    };
                });
                collectedEvents.push({
                    id: `seoul-culture-${Math.random().toString(36).substr(2, 9)}`,
                    title: item.title,
                    date: item.date,
                    // Prefer detail page info if available
                    place: details.placeDetail || item.place,
                    poster: item.poster,
                    date: details.period || item.date,
                    // Standardize fields for UI
                    runningTime: details.time,
                    ageRating: details.target, // "Target" usually maps to Age Rating
                    price: details.cost,
                    time: details.time,
                    cost: details.cost,
                    genre,
                    source: 'seoul-culture',
                    link: item.link
                });
            } catch (e: any) {
                console.error(`   Failed details for ${item.title}`);
            } finally { await detailPage.close(); }
        }

        // Pagination: Click Next
        // Use initPageData if available for consistency
        const nextResult = await page.evaluate((pNum) => {
            // @ts-ignore
            if (typeof initPageData === 'function') {
                // @ts-ignore
                initPageData(pNum + 1);
                return true;
            }
            return false;
        }, pageNum);

        if (nextResult) {
            console.log(`   Calling initPageData(${pageNum + 1})...`);
            await new Promise(r => setTimeout(r, 2000));
            try {
                await page.waitForNetworkIdle({ timeout: 2000 }).catch(() => { });
            } catch (e) { }
        } else {
            console.log('   initPageData not found for pagination? Attempting click...');
            const hasNextBtn = await page.$('.paging .next > a');
            if (!hasNextBtn) {
                console.log('   No Next Button found. Reached end.');
                hasNext = false;
            } else {
                console.log('   Clicking Next Page...');
                await page.evaluate(() => {
                    const btn = document.querySelector('.paging .next > a') as HTMLElement;
                    if (btn) btn.click();
                });
                await new Promise(r => setTimeout(r, 2000));
                try {
                    await page.waitForNetworkIdle({ timeout: 2000 }).catch(() => { });
                } catch (e) { }
            }
        }

        pageNum++;
    }

    await browser.close();

    const outputPath = path.join(process.cwd(), 'src/data/seoul-culture.json');
    // Final check for duplicates based on title+date
    const uniqueEvents = [];
    const seen = new Set();
    for (const e of collectedEvents) {
        const key = e.title + e.date;
        if (!seen.has(key)) {
            uniqueEvents.push(e);
            seen.add(key);
        }
    }

    fs.writeFileSync(outputPath, JSON.stringify(uniqueEvents, null, 2));
    console.log(`✅ Scrape Complete! Saved ${uniqueEvents.length} unique events to ${outputPath}`);
}

scrape().catch(console.error);
