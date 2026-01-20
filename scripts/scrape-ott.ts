
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import pLimit from 'p-limit';
import cliProgress from 'cli-progress';
import { processImage } from './utils/image-processor';

// --- CONFIG ---
const OUTPUT_FILE = path.resolve(process.cwd(), 'src/data/ott.json');

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

const MANUAL_GRADES: Record<string, string> = {
    '은애하는 도적님아': '15세 이상 관람가',
    '은애하는 도적님아 - 시즌 1': '15세 이상 관람가',
    '언더커버 미쓰홍': '15세 이상 관람가',
    '언더커버 미쓰홍 - 시즌 1': '15세 이상 관람가',
    '화려한 날들': '15세 이상 관람가',
    '화려한 날들 - 시즌 1': '15세 이상 관람가',
    '사죄의 왕': '15세 이상 관람가'
};

function normalizeAgeRating(rating: string): string | null {
    if (!rating) return null;
    const r = rating.trim();
    if (['ALL', 'All', 'all', '전체', 'G', '전체관람가'].some(k => r.includes(k))) return '전체 관람가';
    if (r.includes('12') && (r.includes('세') || r.includes('+') || r.includes('연령'))) return '12세 이상 관람가';
    if (r.includes('15') && (r.includes('세') || r.includes('+') || r.includes('연령'))) return '15세 이상 관람가';
    if (r.includes('18') || r.includes('19') || r.includes('청불') || r.includes('청소년')) return '청소년 관람불가';
    const validSet = ['전체 관람가', '12세 이상 관람가', '15세 이상 관람가', '청소년 관람불가'];
    if (validSet.includes(r)) return r;
    if (/^\d+세 이상 관람가$/.test(r)) return r;
    return null;
}

function cleanOTTItem(item: any) {
    if (item.title && MANUAL_GRADES[item.title]) {
        item.ageRating = MANUAL_GRADES[item.title];
    } else {
        const validGrade = normalizeAgeRating(item.ageRating);
        if (validGrade) item.ageRating = validGrade;
        else delete item.ageRating;
    }
    if (item.originalTitle) {
        let ot = item.originalTitle.trim();
        if (/^\d{1,3}분$/.test(ot)) delete item.originalTitle;
        else if (/^\d{4}$/.test(ot)) delete item.originalTitle;
        else if (ot.length > 20 && (/[\d\.\+\-\(\)]+/.test(ot) && (ot.includes('연령') || ot.includes('분')))) {
            delete item.originalTitle;
        }
        else if (ot === item.title) delete item.originalTitle;
    }
    if (item.subGenre === 'OTT') delete item.subGenre;
}

async function scrapeList(context: any, platform: any, type: string) {
    const page = await context.newPage();
    const query = `${platform.keyword} ${type}`;
    const url = `https://search.naver.com/search.naver?where=nexearch&sm=tab_etc&mra=bkdJ&qvt=0&query=${encodeURIComponent(query)}`;

    console.log(`[Scrape] Starting ${platform.name} - ${type}...`);

    let items: any[] = [];
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        const MAX_PAGES = 15;
        let pageNum = 1;

        while (pageNum <= MAX_PAGES) {
            const newItems = await page.evaluate((arg: { pName: string, tType: string }) => {
                const { pName, tType } = arg;
                const els = document.querySelectorAll('#main_pack .cm_content_area ul li.info_box, .cs_common_module li.info_box, .cm_content_area .card_item');
                const list: any[] = [];
                els.forEach(el => {
                    const titleEl = el.querySelector('strong.title a._text') || el.querySelector('a._text') || el.querySelector('.name');
                    const img = el.querySelector('a.thumb img') || el.querySelector('.thumb img');

                    if (titleEl) {
                        const title = titleEl.textContent?.trim() || '';
                        let link = titleEl.getAttribute('href') || '';
                        if (link && link.startsWith('?')) link = `https://search.naver.com/search.naver${link}`;

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

            const nextBtn = await page.$('a.pg_next.on');
            if (nextBtn) {
                await nextBtn.click();
                await page.waitForTimeout(1000 + Math.random() * 500);
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

// JustWatch Search Fallback
async function searchJustWatch(context: any, title: string) {
    const page = await context.newPage();
    try {
        const sUrl = `https://www.justwatch.com/kr/검색?q=${encodeURIComponent(title)}`;
        await page.goto(sUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });

        // Click first result
        const first = await page.$('.title-list-row__row__header');
        if (first) {
            await first.click();
            await page.waitForTimeout(1500);
        } else {
            await page.close();
            return null;
        }

        // Extract Data
        const jwData = await page.evaluate(() => {
            const res: any = {};
            // Cast Fallback
            const newCards = document.querySelectorAll('.title-credits__actor');
            const cast: any[] = [];
            newCards.forEach(card => {
                const img = card.querySelector('img');
                const nameFromImg = img?.getAttribute('alt') || img?.getAttribute('title');
                if (nameFromImg) {
                    cast.push({ name: nameFromImg });
                } else {
                    let text = card.textContent?.trim() || '';
                    const roleEl = card.querySelector('.title-credits__actor--role');
                    if (roleEl && roleEl.textContent) {
                        text = text.replace(roleEl.textContent, '').trim();
                    }
                    if (text) cast.push({ name: text });
                }
            });
            if (cast.length > 0) res.cast = cast.slice(0, 8).map(c => c.name);

            // Director Fallback
            const dirHeader = Array.from(document.querySelectorAll('h3')).find(h => h.textContent?.includes('감독') || h.textContent?.includes('Director'));
            if (dirHeader && dirHeader.nextElementSibling) {
                res.director = dirHeader.nextElementSibling.textContent?.trim();
            }
            return res;
        });
        return jwData;

    } catch (e) {
        return null;
    } finally {
        await page.close();
    }
}

// --- MAIN ---
(async () => {
    console.log('Starting Naver-First OTT Scraper...');
    const browser = await chromium.launch({ headless: true });

    // --- Scrape List (Phase 1) ---
    const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (Mac)' });
    const limit = pLimit(3);
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
        // Clean Title for ID
        const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const titleStr = it.title.replace(/\s+/g, '').replace(/[^\w\uAC00-\uD7A3]/g, '');
        const id = `ott_${dateStr}_${titleStr}`;

        if (!dedupedCtx[id]) {
            dedupedCtx[id] = {
                ...it,
                id,
                platforms: [it.platform],
                venue: 'OTT',
                region: 'ott',
                genre: 'ott',
                date: new Date().toISOString().split('T')[0]
            };
        } else {
            if (!dedupedCtx[id].platforms.includes(it.platform)) {
                dedupedCtx[id].platforms.push(it.platform);
            }
        }
    }

    const finalRaw = Object.values(dedupedCtx);
    console.log(`Phase 1 Complete. ${finalRaw.length} unique items to enrich.`);

    // --- Enrichment (Phase 2) ---
    const browser2 = await chromium.launch({ headless: true });
    // Use slightly larger viewport
    const context2 = await browser2.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1440, height: 1024 }
    });

    const limitEnrich = pLimit(5);
    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progressBar.start(finalRaw.length, 0);

    const enrichTasks = finalRaw.map(item => limitEnrich(async () => {
        const page = await context2.newPage();
        try {
            // A. NAVER ENRICHMENT
            await page.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 20000 });
            await sleep(500 + Math.random() * 500);

            const detail = await page.evaluate(async () => {
                const res: any = {};

                // 1. Basic Info
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
                                else if (['한국', '미국', '일본', '중국', '영국', '독일', '프랑스'].some(c => p.includes(c))) res.productionCountry = p;
                                else realGenre = p;
                            });
                        } else {
                            if (!value.match(/(\d+분)/)) realGenre = value;
                        }
                    }
                    if (label === '등급') res.ageRating = value;
                    if (label === '국가') res.productionCountry = value;
                    if (label === '러닝타임') res.runningTime = value;
                    if (label === '원제') res.originalTitle = value;
                });

                if (realGenre) res.subGenre = realGenre;

                // 2. Cast (Robust Selectors)
                const members = document.querySelectorAll('.sec_scroll_cast_member .card_item, ._actor_wrap .card_item, .cm_content_area._cast_area .card_item, .cast_box .name, .detail_info .name');
                const cast: string[] = [];
                members.forEach(m => {
                    let name = m.querySelector('.name')?.textContent?.trim() || m.querySelector('a._text')?.textContent?.trim() || m.textContent?.trim() || '';
                    const role = m.querySelector('.sub_text')?.textContent?.trim() || '';
                    if (name.includes(' 역')) name = name.split(' 역')[0];

                    if (name && name.length < 20 && !name.includes('출연') && !name.includes('더보기')) {
                        if (role.includes('감독') || role.includes('연출')) res.director = name;
                        else cast.push(name);
                    }
                });
                if (cast.length > 0) res.cast = [...new Set(cast)].slice(0, 8);

                return res;
            });

            if (detail) Object.assign(item, detail);

            // B. INTERACTIVE CAST FALLBACK (Naver)
            if (!item.cast || item.cast.length === 0) {
                try {
                    const foundTab = await page.evaluate(() => {
                        const tabs = Array.from(document.querySelectorAll('a, div[role="tab"]'));
                        // Includes '등장인물', '출연', '제작'
                        const t = tabs.find(el => el.textContent?.includes('출연') || el.textContent?.includes('등장인물') || el.textContent?.includes('제작'));
                        if (t) { (t as HTMLElement).click(); return true; }
                        return false;
                    });
                    if (foundTab) {
                        await page.waitForTimeout(1500);
                        const newCastData = await page.evaluate(() => {
                            const newCast: string[] = [];
                            let director = '';
                            // Expanded selectors for interactive content
                            const members = document.querySelectorAll('.card_item, .area_link_box li, .list_info .item, .cast_box .name, .detail_info .name');
                            members.forEach(m => {
                                let name = m.querySelector('strong.name, .name')?.textContent?.trim() || '';
                                const sub = m.querySelector('span.sub_text, .sub_text')?.textContent?.trim() || '';
                                if (!name && m.classList.contains('_text')) name = m.textContent?.trim() || '';
                                if (!name && !m.querySelector('.name')) name = m.textContent?.trim() || '';

                                if (name && name.length < 20 && !name.includes('더보기')) {
                                    if (sub.includes('감독')) director = name;
                                    else newCast.push(name);
                                }
                            });
                            return { cast: Array.from(new Set(newCast)).slice(0, 8), director };
                        });
                        if (newCastData.cast.length > 0) item.cast = newCastData.cast;
                        if (newCastData.director) item.director = newCastData.director;
                    }
                } catch (e) { }
            }

            // C. JUSTWATCH FALLBACK (Only if missing Cast)
            if (!item.cast || item.cast.length === 0) {
                const jwRes = await searchJustWatch(context2, item.title);
                if (jwRes) {
                    if (jwRes.cast) item.cast = jwRes.cast;
                    if (jwRes.director && !item.director) item.director = jwRes.director;
                }
            }

            // D. NAMUWIKI FALLBACK (Posters)
            const isInvalidPoster = !item.poster || item.poster.length < 50 || item.poster.startsWith('data:');
            if ((isInvalidPoster) && !item.posterSource) {
                try {
                    await page.goto(`https://namu.wiki/Go?q=${encodeURIComponent(item.title)}`, { waitUntil: 'domcontentloaded', timeout: 10000 });
                    await sleep(1000);
                } catch (e) { }
            }

        } catch (e) {
            // console.error(`Error enriching ${item.title}`, e);
        } finally {
            await page.close();
            progressBar.increment();
        }

        // Final Clean
        cleanOTTItem(item);
        if (!item.image && item.poster) item.image = item.poster;

        return item;
    }));

    await Promise.all(enrichTasks);
    progressBar.stop();
    await browser2.close();
    await browser.close();

    // Final Sort
    finalRaw.sort((a, b) => (a.date > b.date ? -1 : 1));

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalRaw, null, 2));
    console.log(`Done. Saved ${finalRaw.length} items to ${OUTPUT_FILE}`);
})();
