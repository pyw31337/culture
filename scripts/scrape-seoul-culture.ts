
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
    genre: string;
    source: 'seoul-culture';
    link: string;
}

const TARGET_URL = 'https://culture.seoul.go.kr/culture/culture/cultureEvent/list.do?searchCate=&menuNo=200110';
const START_DATE = '2026-01-01';
const END_DATE = '2026-12-31';

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
    console.log('🚀 Starting Seoul Culture Scraper (2026)...');
    const browser = await puppeteer.launch({
        headless: "new" as any,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Set User Agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // URL-based Scraper Strategy with Improved Wait

    let collectedEvents: ScrapedEvent[] = [];
    let hasNext = true;
    let pageNum = 1;
    let lastFirstTitle = '';

    // Safety limit
    const MAX_PAGES = 50;

    while (hasNext) {
        let pageUrl = `${TARGET_URL}&searchStartDate=${START_DATE.replace(/-/g, '.')}&searchEndDate=${END_DATE.replace(/-/g, '.')}`;
        if (pageNum > 1) {
            pageUrl += `&pageIndex=${pageNum}`;
        }

        console.log(`🔗 Navigating to Page ${pageNum}: ${pageUrl}`);

        try {
            await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        } catch (e) {
            console.log('   TIMEOUT. Retrying...');
            await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
        }

        // Wait for LIST ITEMS (not just list container)
        try {
            await page.waitForSelector('#dataList > li', { timeout: 10000 });
        } catch (e) {
            console.log('   No list items found (timeout). Checking content...');
            const html = await page.evaluate(() => document.querySelector('#dataList')?.innerHTML || 'No #dataList');
            console.log('   #dataList HTML:', html.substring(0, 200).replace(/\n/g, ' '));

            // Should we look for 'No results' message?
            // .nodata ?

            hasNext = false;
            break;
        }

        // Extract Basic Info
        const listItems = await page.evaluate(() => {
            const items: any[] = [];
            const rows = document.querySelectorAll('#dataList > li');

            rows.forEach(row => {
                const linkEl = row.querySelector('a');
                if (!linkEl) return;

                const link = linkEl.href;
                const img = row.querySelector('.img img')?.getAttribute('src');
                const title = row.querySelector('.txt2 .tit')?.textContent?.trim() || '';
                const place = row.querySelector('.txt2 .place')?.textContent?.trim() || '';
                const dateDiv = row.querySelector('.txt2 > div');
                const date = dateDiv?.textContent?.trim().replace(/\s+/g, ' ') || '';

                const absoluteImg = img ? (img.startsWith('http') ? img : `https://culture.seoul.go.kr${img}`) : '';

                items.push({
                    title,
                    link,
                    poster: absoluteImg,
                    place,
                    date
                });
            });
            return items;
        });

        console.log(`   Found ${listItems.length} items on page ${pageNum}`);

        if (listItems.length === 0) {
            hasNext = false;
            break;
        }

        // Loop and details extraction...
        // ... (reuse existing loop logic logic)

        for (const item of listItems) {
            let genre = await mapCategory(item.title);
            const detailPage = await browser.newPage();
            try {
                await detailPage.goto(item.link, { waitUntil: 'domcontentloaded' });
                const details = await detailPage.evaluate(() => {
                    const time = document.querySelector('.intro-top .type-box ul li:nth-child(3) .type-td span')?.textContent?.trim() || '';
                    const cost = document.querySelector('.intro-top .type-box ul li:nth-child(5) .type-td span')?.textContent?.trim() || '';
                    return { time, cost };
                });
                collectedEvents.push({
                    id: `seoul-culture-${Math.random().toString(36).substr(2, 9)}`,
                    title: item.title,
                    date: item.date,
                    place: item.place,
                    poster: item.poster,
                    time: details.time,
                    cost: details.cost,
                    genre,
                    source: 'seoul-culture',
                    link: item.link
                });
            } catch (e: any) {
                console.error(`   Failed to scrape details for ${item.title}:`, e.message);
            } finally { await detailPage.close(); }
        }

        pageNum++;
        if (pageNum > MAX_PAGES) hasNext = false;

        // No JS navigation needed since we use goto
    }

    await browser.close();

    const outputPath = path.join(process.cwd(), 'src/data/seoul-culture.json');
    // Filter for 2026 events only
    const validEvents = collectedEvents.filter(e => e.date.includes('2026'));
    fs.writeFileSync(outputPath, JSON.stringify(validEvents, null, 2));

    console.log(`✅ Scrape Complete! Saved ${validEvents.length} events (from ${collectedEvents.length} total) to ${outputPath}`);

    // Log sample date for debug
    if (validEvents.length > 0) {
        console.log('Sample Date:', validEvents[0].date);
    }

    const unknown = validEvents.filter(e => e.genre === 'unknown');
    if (unknown.length > 0) {
        console.log('⚠️  Found Unclassified Events (Title):');
        // Limit output
        unknown.slice(0, 20).forEach(e => console.log(`- ${e.title}`));
        if (unknown.length > 20) console.log(`... and ${unknown.length - 20} more.`);
    }
}

scrape().catch(console.error);
