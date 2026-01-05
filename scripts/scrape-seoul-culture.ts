
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
    if (t.includes('음악회') || t.includes('독주회') || t.includes('독창회') || t.includes('연주회')) return 'classic';
    if (t.includes('개인전') || t.includes('기획전') || t.includes('전시')) return 'exhibition';
    if (t.includes('축제') || t.includes('페스타')) return 'festival';
    if (t.includes('뮤지컬')) return 'musical';
    if (t.includes('연극')) return 'play';
    if (t.includes('콘서트')) return 'concert';
    if (t.includes('클래스') || t.includes('강좌')) return 'class';

    return 'unknown';
}

async function scrape() {
    console.log('🚀 Starting Seoul Culture Scraper (2026)...');
    const browser = await puppeteer.launch({
        headless: "new" as any,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Use URL params for date filtering
    const searchUrl = `${TARGET_URL}&searchStartDate=${START_DATE.replace(/-/g, '.')}&searchEndDate=${END_DATE.replace(/-/g, '.')}`;
    console.log(`🔗 Navigating to: ${searchUrl}`);

    await page.goto(searchUrl, { waitUntil: 'networkidle2' });

    // Verify if filter applied (optional, or just proceed)
    // We skip DOM manipulation for dates now.

    /* 
    await page.evaluate(() => {
        // @ts-ignore
        document.querySelector('#searchStartDate').value = '2026.01.01';
        // @ts-ignore
        document.querySelector('#searchEndDate').value = '2026.12.31';
        // Click search button
        // @ts-ignore
        document.querySelector('.btn-search').click();
    }); 
    */



    let collectedEvents: ScrapedEvent[] = [];
    let hasNext = true;
    let pageNum = 1;

    // Safety limit
    const MAX_PAGES = 50;

    while (hasNext) {
        console.log(`📄 Scraping List Page ${pageNum}...`);

        await page.waitForSelector('#dataList');

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
            } finally {
                await detailPage.close();
            }
        }

        // Pagination
        const nextButton = await page.$('#paging > a.next');

        if (nextButton) {
            const canClick = await page.evaluate(() => {
                const btn = document.querySelector('#paging > a.next');
                // Check if it's the last page (often href="#" or implicit logic)
                // But typically if 'next' exists in the DOM, it might be clickable.
                // We rely on listItems check as well.
                return !!btn;
            });

            if (canClick) {
                await Promise.all([
                    page.evaluate(() => {
                        const btn = document.querySelector('#paging > a.next') as HTMLElement;
                        if (btn) btn.click();
                    }),
                    page.waitForNavigation({ waitUntil: 'networkidle2' }).catch(() => { })
                ]);
                pageNum++;
            } else {
                hasNext = false;
            }
        } else {
            hasNext = false;
        }

        if (pageNum > MAX_PAGES) {
            console.log('Reach max page limit.');
            hasNext = false;
        }
    }

    await browser.close();

    const outputPath = path.join(process.cwd(), 'src/data/seoul-culture.json');
    fs.writeFileSync(outputPath, JSON.stringify(collectedEvents, null, 2));

    console.log(`✅ Scrape Complete! Saved ${collectedEvents.length} events to ${outputPath}`);

    const unknown = collectedEvents.filter(e => e.genre === 'unknown');
    if (unknown.length > 0) {
        console.log('⚠️  Found Unclassified Events (Title):');
        // Limit output
        unknown.slice(0, 20).forEach(e => console.log(`- ${e.title}`));
        if (unknown.length > 20) console.log(`... and ${unknown.length - 20} more.`);
    }
}

scrape().catch(console.error);
