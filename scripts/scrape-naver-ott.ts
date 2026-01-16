
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

                        // Poster Quality Fix:
                        // 'type=w640' failed for some (404).
                        // 'type=o' is Original. Or just removing params.
                        // Safe bet: Remove `size=...` and `type=...` to get original or default high res.
                        // Or use 'type=o'.
                        let poster = img?.getAttribute('src') || img?.getAttribute('data-src') || '';
                        if (poster.includes('type=')) {
                            // Try type=o (Original) and remove size
                            poster = poster.replace(/type=[^&]+/, 'type=o').replace(/size=[^&]+&?/, '');
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
                        let cleanDate = value;
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
                    // Drama: Name="Role Name 역", Sub="Actor"
                    // Variety: Name="Actor", Sub="Role"
                    // Summary Page usually has standard layout, but we apply separation logic anyway
                    let name = m.querySelector('.name')?.textContent?.trim() || m.querySelector('a._text')?.textContent?.trim() || '';
                    const role = m.querySelector('.sub_text')?.textContent?.trim() || '';

                    // Cast Separation Logic
                    if (name.includes(' 역')) {
                        // "Kim Do-gi 역" -> Actor is likely in SubText or this is just Role
                        // On summary page, usually Name=Actor, Sub=Role. But check '역' to be safe.
                        if (role) name = role;
                        else name = name.split(' 역')[0];
                    }
                    // If Name has no '역', assume it is Actor Name (Standard)

                    if (name && !name.includes('배역') && !name.includes('출연') && name.length < 20) {
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
                    // Iterating multiple possible selectors to find the Tab Element
                    const possibleTabs = [
                        'a[href*="cast"]',
                        'a[href*="tab=cast"]',
                        '._main_tab a',
                        '.tab[role="tab"]',
                        'div[role="tablist"] > a'
                    ];

                    let castTab = null;
                    const allLinks = await page.$$('a, div[role="tab"], ._main_tab a');
                    for (const el of allLinks) {
                        const txt = await el.innerText();
                        // Strict check to avoid "Video" or seemingly unrelated tabs
                        if (txt.includes('출연진') || txt.includes('등장인물')) {
                            castTab = el;
                            break;
                        }
                    }

                    if (castTab) {
                        try {
                            await castTab.click({ timeout: 2000 });
                            await page.waitForTimeout(1000);

                            const newCastData = await page.evaluate(() => {
                                const newCast: string[] = [];
                                let director = '';

                                // Relaxed selector for both Cast and Character layouts
                                const members = document.querySelectorAll('.card_item, .area_link_box li, .sec_scroll_cast_member .card_item, .item, .cm_content_wrap li, .list_info .item');

                                members.forEach(m => {
                                    // HTML Structure:
                                    // Drama: <strong class="name">Role 역</strong> <span class="sub_text">Actor</span>
                                    // Variety: <strong class="name">Actor</strong> <span class="sub_text">Role</span>

                                    let name = '';
                                    let roleOrSub = '';

                                    const nameEl = m.querySelector('strong.name, .name');
                                    const subEl = m.querySelector('span.sub_text, .sub_text');

                                    if (nameEl) {
                                        let nameTxt = nameEl.textContent?.trim() || '';
                                        let subTxt = subEl?.textContent?.trim() || '';

                                        // Separation Logic
                                        if (nameTxt.includes(' 역')) {
                                            // Name is Role (e.g. "Kim Do-gi 역") -> Actor is Sub
                                            name = subTxt;
                                        } else {
                                            // Name is Actor (e.g. "Ma Dong-seok") -> OK
                                            name = nameTxt;
                                        }
                                        roleOrSub = subTxt;
                                    } else {
                                        // Fallback via text content or classes
                                        // Specific to 'Taxi Driver 3' character/cast list text nodes in .item
                                        if (m.classList.contains('_text')) {
                                            name = m.textContent?.trim() || '';
                                        } else {
                                            name = m.querySelector('.name')?.textContent?.trim() || m.querySelector('a._text')?.textContent?.trim() || '';
                                        }
                                    }

                                    // Filter garbage
                                    if (name && name.length < 20 && !name.includes('배역') && !name.includes('출연') && !name.includes('전체삭제')) {
                                        if (roleOrSub.includes('감독') || roleOrSub.includes('연출')) director = name;
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
