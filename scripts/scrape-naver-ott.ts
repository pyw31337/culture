
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';

// --- CONFIG ---
const OUTPUT_FILE = path.resolve(process.cwd(), 'src/data/ott-naver.json');
const RAW_OUTPUT_FILE = path.resolve(process.cwd(), 'src/data/ott-naver-raw.json');

// Platforms & Types
const PLATFORMS = [
    { name: 'coupang', keyword: '쿠팡플레이' },
    { name: 'netflix', keyword: '넷플릭스' },
    { name: 'disney', keyword: '디즈니플러스' },
    { name: 'tving', keyword: '티빙' },
    { name: 'wavve', keyword: '웨이브' }
];
const TYPES = ['추천', '신작'];

// --- HELPERS ---
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function scrapeList(context: any, platform: any, type: string) {
    const page = await context.newPage();
    const query = `${platform.keyword} ${type}`;
    const url = `https://search.naver.com/search.naver?where=nexearch&sm=tab_etc&mra=bkdJ&qvt=0&query=${encodeURIComponent(query)}`;

    console.log(`[Scrape] Starting ${platform.name} - ${type}...`);

    let items: any[] = [];
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Pagination Limit
        const MAX_PAGES = 15;
        let pageNum = 1;

        while (pageNum <= MAX_PAGES) {
            // Extract Items from current page
            const newItems = await page.evaluate((arg: { pName: string, tType: string }) => {
                const { pName, tType } = arg;
                // Correct Selector: li.info_box (Movies) vs li.tab (Filters)
                const els = document.querySelectorAll('#main_pack .cm_content_area ul li.info_box, .cs_common_module li.info_box');
                const list: any[] = [];
                els.forEach(el => {
                    const titleEl = el.querySelector('strong.title a._text') || el.querySelector('a._text');
                    const img = el.querySelector('a.thumb img');

                    if (titleEl) {
                        const title = titleEl.textContent?.trim() || '';
                        let link = titleEl.getAttribute('href') || '';
                        if (link.startsWith('?')) link = `https://search.naver.com/search.naver${link}`;
                        const poster = img?.getAttribute('src') || img?.getAttribute('data-src') || '';

                        if (title && link && !link.includes('#')) {
                            list.push({
                                title,
                                link,
                                poster,
                                platform: pName,
                                type: tType,
                                source: 'naver'
                            });
                        }
                    }
                });
                return list;
            }, { pName: platform.name, tType: type });

            items.push(...newItems);
            console.log(`   ${platform.name} (${type}) Page ${pageNum}: Found ${newItems.length} items.`);

            // Next Page
            const nextBtn = await page.$('a.pg_next.on'); // Must have 'on' class
            if (nextBtn) {
                await nextBtn.click();
                await page.waitForTimeout(1500 + Math.random() * 1000);
                pageNum++;
            } else {
                break;
            }
        }
    } catch (e) {
        console.error(`Error scraping ${platform.name} ${type}:`, e);
    } finally {
        await page.close();
    }
    return items;
}

// --- MAIN ---
(async () => {
    console.log('Starting Naver OTT Scraper...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const limit = pLimit(2);
    const tasks = [];

    for (const p of PLATFORMS) {
        for (const t of TYPES) {
            tasks.push(limit(() => scrapeList(context, p, t)));
        }
    }

    const results = await Promise.all(tasks);
    const flatResults = results.flat();

    // Dedup by Title
    const dedupedCtx: Record<string, any> = {};
    for (const it of flatResults) {
        // ID generation
        const id = `ott_naver_${it.title.replace(/\s+/g, '')}`;
        if (!dedupedCtx[id]) {
            dedupedCtx[id] = { ...it, id, platforms: [it.platform] };
        } else {
            if (!dedupedCtx[id].platforms.includes(it.platform)) {
                dedupedCtx[id].platforms.push(it.platform);
            }
        }
    }

    const finalRaw = Object.values(dedupedCtx);
    console.log(`Raw Collection Complete. Total Unique: ${finalRaw.length}`);
    fs.writeFileSync(RAW_OUTPUT_FILE, JSON.stringify(finalRaw, null, 2));

    await browser.close();
    console.log('Phase 1 Done. Starting Phase 2 (Enrichment)...');

    // Phase 2: Enrichment
    const enrichedItems: any[] = [];
    // Re-launch browser for enrichment phase (clean context)
    const browser2 = await chromium.launch({ headless: true });
    const context2 = await browser2.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const limitEnrich = pLimit(5);
    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progressBar.start(finalRaw.length, 0);

    const enrichTasks = finalRaw.map(item => limitEnrich(async () => {
        const page = await context2.newPage();
        try {
            await page.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 20000 });

            // Random Delay to be safe
            await sleep(500 + Math.random() * 1000);

            const detail = await page.evaluate(() => {
                const res: any = {};

                // 1. Basic Info (Genre, Country, Runtime)
                // Correct Selector from Subagent: #main_pack .detail_info dl div:nth-child(1) dd
                const detailInfo = document.querySelector('#main_pack .detail_info dl');
                if (detailInfo) {
                    const firstDD = detailInfo.querySelector('div:nth-child(1) dd');
                    if (firstDD) {
                        const raw = firstDD.textContent?.trim() || '';
                        // Naver Format: "Genre · Country · Time" OR "GenreCountryTime"
                        if (raw.includes('·')) {
                            const parts = raw.split('·').map(s => s.trim());
                            parts.forEach(p => {
                                if (p.endsWith('분')) res.runningTime = p;
                                else if (['한국', '미국', '일본', '중국', '영국', '독일', '프랑스'].some(c => p.includes(c)) || p.length < 5) res.productionCountry = p;
                                else res.genre = p;
                            });
                        } else {
                            // Helper for Clumped Text
                            let temp = raw;

                            // 1. Time (e.g. 103분)
                            const timeMatch = temp.match(/(\d+분)/);
                            if (timeMatch) {
                                res.runningTime = timeMatch[1];
                                temp = temp.replace(timeMatch[1], '').trim();
                            }

                            // 2. Country
                            const countryMatch = temp.match(/(한국|미국|일본|중국|영국|독일|프랑스|이탈리아|스페인|캐나다|홍콩|대만|인도|태국|베트남|대한민국)/);
                            if (countryMatch) {
                                res.productionCountry = countryMatch[1];
                                if (res.productionCountry === '대한민국') res.productionCountry = '한국'; // Normalize
                                temp = temp.replace(countryMatch[1], '').trim();
                            }

                            // 3. Genre (Remainder)
                            if (temp.length > 0) res.genre = temp;
                        }
                    }

                    const secondDD = detailInfo.querySelector('div:nth-child(2) dd');
                    if (secondDD) res.date = secondDD.textContent?.trim();
                }

                // 2. Cast/Director from Summary (If available)
                // .sec_scroll_cast_member is common
                const members = document.querySelectorAll('.sec_scroll_cast_member .card_item, ._actor_wrap .card_item');
                const cast: string[] = [];
                members.forEach(m => {
                    const name = m.querySelector('.name')?.textContent?.trim() || m.querySelector('a._text')?.textContent?.trim();
                    if (name) {
                        const roleText = m.textContent || '';
                        if (roleText.includes(' 감독') || roleText.includes('연출')) res.director = name;
                        else cast.push(name);
                    }
                });
                if (cast.length > 0) res.cast = cast.slice(0, 5);

                return res;
            });

            if (detail) Object.assign(item, detail);

            // If cast missing, try explicit 'Cast + Query' search?
            // Skipped for speed unless user complains. 
            // Most detail pages have a cast strip at bottom.

        } catch (e) {
            // console.error(`Error enriching ${item.title}:`, e);
        } finally {
            await page.close();
            progressBar.increment();
        }
        enrichedItems.push(item);
    }));

    await Promise.all(enrichTasks);
    progressBar.stop();
    await browser2.close();

    console.log(`Phase 2 Done. Saving ${enrichedItems.length} items to ${OUTPUT_FILE}...`);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(enrichedItems, null, 2));
})();
