
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';
import { processImage } from './utils/image-processor';

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
            const newItems = await page.evaluate((arg: { pName: string, tType: string }) => {
                const { pName, tType } = arg;
                const els = document.querySelectorAll('#main_pack .cm_content_area ul li.info_box, .cs_common_module li.info_box');
                const list: any[] = [];
                els.forEach(el => {
                    const titleEl = el.querySelector('strong.title a._text') || el.querySelector('a._text');
                    const img = el.querySelector('a.thumb img');

                    if (titleEl) {
                        const title = titleEl.textContent?.trim() || '';
                        let link = titleEl.getAttribute('href') || '';
                        if (link.startsWith('?')) link = `https://search.naver.com/search.naver${link}`;

                        let poster = img?.getAttribute('src') || img?.getAttribute('data-src') || '';
                        if (poster.includes('type=')) {
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

            const nextBtn = await page.$('a.pg_next.on');
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

    // --- Scrape List (Phase 1) ---
    const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (Mac)' });
    const limit = pLimit(2);
    const tasks = [];

    for (const p of PLATFORMS) {
        for (const t of TYPES) {
            tasks.push(limit(() => scrapeList(context, p, t)));
        }
    }

    const results = await Promise.all(tasks);
    const flatResults = results.flat();

    const dedupedCtx: Record<string, any> = {};
    for (const it of flatResults) {
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

    // --- Enrichment (Phase 2) ---
    const enrichedItems: any[] = [];
    const browser2 = await chromium.launch({ headless: true });
    // Use slightly taller viewport for NamuWiki scrolling
    const context2 = await browser2.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 1080 }
    });

    const limitEnrich = pLimit(5);
    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progressBar.start(finalRaw.length, 0);

    const enrichTasks = finalRaw.map(item => limitEnrich(async () => {
        const page = await context2.newPage();
        try {
            await page.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 20000 });
            await sleep(500 + Math.random() * 1000);

            const detail = await page.evaluate(async () => {
                const res: any = {};

                // 1. Basic Info Parsing using Iteration (Robust)
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
                            if (!value.match(/(\d+분)/) && !value.match(/(한국|미국|일본|중국|영국|독일|프랑스)/)) {
                                realGenre = value;
                            }
                        }
                    }
                    if (label === '등급') res.ageRating = value;
                    if (label === '국가') res.productionCountry = value;
                    if (label === '러닝타임') res.runningTime = value;
                });

                if (!res.date) {
                    const groups = Array.from(document.querySelectorAll('.info_group'));
                    for (const g of groups) {
                        const dt = g.querySelector('dt');
                        const dd = g.querySelector('dd');
                        if (dt && dd && (dt.textContent?.includes('개봉') || dt.textContent?.includes('방영'))) {
                            res.date = dd.textContent?.trim().replace(/\(.*\)/, '').replace(/\.$/, '');
                            break;
                        }
                    }
                }

                if (!realGenre) {
                    const subGenre = document.querySelector('.sub_title span.txt');
                    if (subGenre) realGenre = subGenre.textContent?.trim() || '';
                }

                res.genre = 'ott';
                res.description = [realGenre, res.productionCountry, res.runningTime].filter(Boolean).join(' | ');

                // 2. Cast Parsing
                const members = document.querySelectorAll('.sec_scroll_cast_member .card_item, ._actor_wrap .card_item, .cm_content_area._cast_area .card_item');
                const cast: string[] = [];
                members.forEach(m => {
                    let name = m.querySelector('.name')?.textContent?.trim() || m.querySelector('a._text')?.textContent?.trim() || '';
                    const role = m.querySelector('.sub_text')?.textContent?.trim() || '';

                    if (name.includes(' 역')) {
                        if (role) name = role;
                        else name = name.split(' 역')[0];
                    }

                    if (name && !name.includes('배역') && !name.includes('출연') && name.length < 20) {
                        if (role.includes('감독') || role.includes('연출')) res.director = name;
                        else cast.push(name);
                    }
                });
                if (cast.length > 0) res.cast = cast.slice(0, 5);

                return res;
            });

            if (detail) Object.assign(item, detail);

            // --- 3. Interactive Cast Fallback ---
            if ((!item.cast || item.cast.length === 0) && item.link.includes('search.naver.com')) {
                try {
                    const foundTab = await page.evaluate(() => {
                        const tabs = Array.from(document.querySelectorAll('a, div[role="tab"]'));
                        const t = tabs.find(el => el.textContent?.includes('출연진') || el.textContent?.includes('등장인물'));
                        if (t) { (t as HTMLElement).click(); return true; }
                        return false;
                    });

                    if (foundTab) {
                        await page.waitForTimeout(1000);
                        const newCastData = await page.evaluate(() => {
                            const newCast: string[] = [];
                            let director = '';
                            const members = document.querySelectorAll('.card_item, .area_link_box li, .sec_scroll_cast_member .card_item, .item, .cm_content_wrap li, .list_info .item');
                            members.forEach(m => {
                                let name = '';
                                let roleOrSub = '';
                                const nameEl = m.querySelector('strong.name, .name');
                                const subEl = m.querySelector('span.sub_text, .sub_text');
                                if (nameEl) {
                                    let nameTxt = nameEl.textContent?.trim() || '';
                                    let subTxt = subEl?.textContent?.trim() || '';
                                    if (nameTxt.includes(' 역')) name = subTxt;
                                    else name = nameTxt;
                                    roleOrSub = subTxt;
                                } else {
                                    if (m.classList.contains('_text')) name = m.textContent?.trim() || '';
                                    else name = m.querySelector('.name')?.textContent?.trim() || m.querySelector('a._text')?.textContent?.trim() || '';
                                }
                                if (name && name.length < 20 && !name.includes('배역') && !name.includes('출연') && !name.includes('전체삭제')) {
                                    if (roleOrSub.includes('감독') || roleOrSub.includes('연출')) director = name;
                                    else newCast.push(name);
                                }
                            });
                            return { cast: Array.from(new Set(newCast)).slice(0, 5), director };
                        });
                        if (newCastData.cast.length > 0) item.cast = newCastData.cast;
                        if (newCastData.director && !item.director) item.director = newCastData.director;
                    }
                } catch (err) { }
            }

            // --- 4. NamuWiki Poster Fallback ---
            const isInvalidPoster = !item.poster || item.poster.length < 50 || item.poster.startsWith('data:');
            const forcedFallbackTitles = ['프랑켄슈타인: 더 뮤지컬 라이브', '좀비딸'];

            if ((isInvalidPoster || forcedFallbackTitles.some(t => item.title.includes(t))) && !item.posterSource) {
                try {
                    await page.goto(`https://namu.wiki/Go?q=${encodeURIComponent(item.title)}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
                    await sleep(2000);

                    // Check for Search Result Page
                    const searchResultLink = await page.$('.search-item a, .search-result-list a');
                    if (searchResultLink) {
                        const txt = await searchResultLink.innerText();
                        if (!txt.includes('User:') && !txt.includes('Talk:') && !txt.includes('사용자:') && !txt.includes('토론:')) {
                            await searchResultLink.click();
                            await page.waitForTimeout(2000);
                        }
                    }

                    // Scroll and Wait for Image
                    await page.evaluate(() => window.scrollTo(0, 800));
                    await page.waitForTimeout(1000);

                    const namuPoster = await page.evaluate(() => {
                        // 1. Try Table/Infobox
                        const imgs = Array.from(document.querySelectorAll('table img, .wiki-table img, div[class*="wiki-table"] img, .wiki-heading-content img'));
                        let candidate = imgs.find(img => {
                            const el = img as HTMLImageElement;
                            // Width > 150 (relaxed)
                            return el.width > 150 && el.src.includes('namu.wiki') && !el.src.includes('icon') && !el.src.includes('logo');
                        });

                        // 2. Global fallback
                        if (!candidate) {
                            const allImgs = Array.from(document.querySelectorAll('img'));
                            candidate = allImgs.find(img => {
                                const el = img as HTMLImageElement;
                                return el.width > 200 && el.height > 250 && el.src.includes('namu.wiki');
                            });
                        }

                        return candidate ? (candidate as HTMLImageElement).src : null;
                    });

                    if (namuPoster) {
                        // Use smart image processor to download/convert if needed
                        item.poster = await processImage(namuPoster, item.title);
                        item.posterSource = 'namuwiki';
                        console.log(`[NamuWiki] Found poster for ${item.title}: ${item.poster}`);
                    }
                } catch (namuErr) {
                    // Fail silently
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
