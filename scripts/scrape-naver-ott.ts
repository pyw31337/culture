
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

                        // Poster Quality Fix: Replace 'type=m...' or any resizing with 'type=w640' (Naver High Res)
                        let poster = img?.getAttribute('src') || img?.getAttribute('data-src') || '';
                        if (poster.includes('type=')) {
                            poster = poster.replace(/type=[^&]+/, 'type=w640');
                        }

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
            await sleep(500 + Math.random() * 1000);

            const detail = await page.evaluate(() => {
                const res: any = {};
                const infoGroups = document.querySelectorAll('.info_group, .detail_info dl, .cm_content_area .info_group');
                let realGenre = '';

                infoGroups.forEach(group => {
                    const dt = group.querySelector('dt');
                    const dd = group.querySelector('dd');
                    if (!dt || !dd) return;

                    const label = dt.textContent?.trim() || '';
                    const value = dd.textContent?.trim() || '';

                    if (label.includes('개요') || label.includes('장르')) {
                        if (value.includes('·')) {
                            const parts = value.split('·').map(s => s.trim());
                            parts.forEach(p => {
                                if (p.endsWith('분')) res.runningTime = p;
                                else if (['한국', '미국', '일본', '중국', '영국', '독일', '프랑스'].some(c => p.includes(c)) || p.length < 5) res.productionCountry = p;
                                else realGenre = p;
                            });
                        } else {
                            let temp = value;
                            const timeMatch = temp.match(/(\d+분)/);
                            if (timeMatch) { res.runningTime = timeMatch[1]; temp = temp.replace(timeMatch[1], '').trim(); }
                            const countryMatch = temp.match(/(한국|미국|일본|중국|영국|독일|프랑스|이탈리아|스페인|캐나다|홍콩|대만|인도|태국|베트남|대한민국)/);
                            if (countryMatch) {
                                res.productionCountry = countryMatch[1];
                                if (res.productionCountry === '대한민국') res.productionCountry = '한국';
                                temp = temp.replace(countryMatch[1], '').trim();
                            }
                            if (temp.length > 0) realGenre = temp;
                        }
                    }
                    else if (label.includes('개봉') || label.includes('편성') || label.includes('방영')) {
                        // Date Cleanup: Remove broadcaster prefix (e.g. "SBS ", "TV조선 ") and trailing info
                        // Regex: Start with Date format (YYYY.MM.DD.), capture it, ignore the rest
                        // Or strip known broadcasters if date is embedded
                        let cleanDate = value;
                        // Match YYYY.MM.DD. pattern
                        const dateMatch = cleanDate.match(/(\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\.?)/);
                        if (dateMatch) {
                            cleanDate = dateMatch[1];
                        }
                        res.date = cleanDate.replace(/\.$/, '').trim();
                    }
                    else if (label.includes('등급')) {
                        res.ageRating = value;
                    }
                });

                if (!realGenre) {
                    const subGenre = document.querySelector('.sub_title span.txt, .title_area + .item_info span, .cm_top_wrap .item_info span');
                    if (subGenre) realGenre = subGenre.textContent?.trim() || '';
                }

                res.genre = 'ott';
                res.description = [realGenre, res.productionCountry, res.runningTime].filter(Boolean).join(' | ');

                // --- 2. Cast Extraction (Summary) ---
                const members = document.querySelectorAll('.sec_scroll_cast_member .card_item, ._actor_wrap .card_item, .cm_content_area._cast_area .card_item');
                const cast: string[] = [];
                members.forEach(m => {
                    const name = m.querySelector('.name')?.textContent?.trim() || m.querySelector('a._text')?.textContent?.trim();
                    if (name) {
                        const roleText = m.textContent || '';
                        if ((roleText.includes(' 감독') || roleText.includes('연출')) && !res.director) res.director = name;
                        else cast.push(name);
                    }
                });
                if (cast.length > 0) res.cast = cast.slice(0, 5);

                return res;
            });

            if (detail) Object.assign(item, detail);

            // --- 3. Interactive Cast Fallback (Clicking '출연진' OR '등장인물') ---
            if ((!item.cast || item.cast.length === 0) && item.link.includes('search.naver.com')) {
                try {
                    // Try to find Cast Tab OR Character Tab
                    // 'a[href*="cast"]' covers both 'tab=cast' usually
                    const castTabSelector = 'a[href*="cast"], a:has-text("출연진"), ._main_tab a:has-text("출연진"), a:has-text("등장인물")';
                    const castTab = await page.$(castTabSelector);

                    if (castTab) {
                        try {
                            await castTab.click({ timeout: 2000 });
                            await page.waitForTimeout(1000);

                            const newCastData = await page.evaluate(() => {
                                const newCast: string[] = [];
                                let director = '';

                                // Relaxed selector for both Cast and Character layouts
                                const members = document.querySelectorAll('.card_item, .area_link_box, .sec_scroll_cast_member .card_item, .item, .cm_content_wrap ._text');

                                members.forEach(m => {
                                    // Robust name extraction
                                    let name = '';
                                    if (m.classList.contains('_text')) {
                                        // Specific for 'Taxi Driver 3' character/cast list text nodes
                                        // Need to filter out roles. Heuristic: Name is usually short, Role is descriptive? 
                                        // Or check structure: Title > Name, Text > Role.
                                        // For now, accept text content if seemingly a name (2-4 chars typical KR name)
                                        // Actually, safer to rely on structure if possible.
                                        name = m.textContent?.trim() || '';
                                    } else {
                                        name = m.querySelector('.name')?.textContent?.trim() || m.querySelector('a._text')?.textContent?.trim() || '';
                                    }

                                    const role = m.querySelector('.sub_text')?.textContent?.trim() || '';

                                    if (name && name.length < 10 && !name.includes('배역') && !name.includes('출연')) { // Basic noise filter
                                        if (role.includes('감독') || role.includes('연출')) director = name;
                                        else newCast.push(name);
                                    }
                                });
                                // Unique Names only
                                const uniqueCast = Array.from(new Set(newCast));
                                return { cast: uniqueCast.slice(0, 5), director };
                            });

                            if (newCastData.cast.length > 0) item.cast = newCastData.cast;
                            if (newCastData.director && !item.director) item.director = newCastData.director;

                        } catch (clickErr) {
                            // Click fail or timeout
                        }
                    }
                } catch (err) {
                    // finding cast tab failed
                }
            }

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
