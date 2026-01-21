
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

        const data = await page.evaluate(() => {
            const res: any = {};
            // Grade
            const ageEl = document.querySelector('.detail-infos__value .sc-16o0t-1');
            if (ageEl && ageEl.textContent?.includes('세')) res.ageRating = ageEl.textContent.trim();

            // Cast
            const castEls = document.querySelectorAll('.title-credits__actor-name');
            const cast: string[] = [];
            castEls.forEach(c => cast.push(c.textContent?.trim() || ''));
            if (cast.length > 0) res.cast = cast.slice(0, 8);

            // Director
            const dirEl = document.querySelector('.title-credits__director-name');
            if (dirEl) res.director = dirEl.textContent?.trim();

            return res;
        });
        return data;

    } catch (e) {
        return null;
    } finally {
        await page.close();
    }
}

async function scrapeOTT() {
    const browser = await chromium.launch({ headless: true });
    // Keep generic context
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });

    console.log('Starting Naver-First OTT Scraper...');

    let allItems: any[] = [];

    // Phase 1: Scrape Lists
    for (const p of PLATFORMS) {
        for (const t of TYPES) {
            const items = await scrapeList(context, p, t);
            allItems.push(...items);
        }
    }

    // Dedup
    const uniqueItems = new Map();
    allItems.forEach(i => {
        if (!uniqueItems.has(i.title)) {
            i.platforms = [i.platform];
            uniqueItems.set(i.title, i);
        } else {
            const existing = uniqueItems.get(i.title);
            if (!existing.platforms.includes(i.platform)) existing.platforms.push(i.platform);
        }
    });

    let itemsToProcess = Array.from(uniqueItems.values());

    console.log(`Phase 1 Complete. ${itemsToProcess.length} unique items to enrich.`);

    const limit = pLimit(5);
    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progressBar.start(itemsToProcess.length, 0);

    // Phase 2: Enrichment (Naver Detail > Tab Click Fallback > JustWatch/Namu)
    await Promise.all(itemsToProcess.map(item => limit(async () => {
        const page = await context.newPage();
        try {
            await page.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 20000 });
            await sleep(500 + Math.random() * 500);

            // --- Enforce Strict Metadata Extraction Logic ---
            const extractMetadata = () => {
                const res: any = {};
                // Unified Metadata Extraction (Header + Basic Info + Pattern Matching)
                const metadataSources = [
                    ...Array.from(document.querySelectorAll('.title_area .sub_title > span, .cm_top_wrap .sub_title > span')), // Headers (original)
                    ...Array.from(document.querySelectorAll('.title_area .sub_title .txt, .title_area .sub_text .txt, .cm_top_wrap .sub_text .txt')), // Headers (new: for dramas/variety)
                    ...Array.from(document.querySelectorAll('.info_group dd, .detail_info dd, .cm_content_area .info_group dd, .intro_box .intro_desc')) // Details
                ];

                const patterns = {
                    age: /(전체\s*관람가|전체\s*시청가|\d{1,2}세\s*이상|\d{1,2}세이상|\d{1,2}세\s*(?:이상)?\s*(?:관람가|시청가)?|청소년\s*관람불가|청불|미성년자\s*관람불가)/,
                    runtime: /(\d{1,3}분)/,
                    country: /(한국|미국|일본|중국|영국|프랑스|독일|캐나다|스페인|이탈리아|홍콩|대만|태국)/,
                    genre: /(드라마|액션|스릴러|로맨스|판타지|SF|코미디|애니메이션|범죄|모험|미스터리|가족|공포|다큐멘터리|전쟁|역사|음악|서부|느와르|멜로|애정)/
                };

                let realGenre = '';

                metadataSources.forEach(el => {
                    const text = el.textContent?.trim() || '';
                    if (!text) return;

                    // 1. Explicit Parsing (DT/DD structure if parent exists)
                    const dt = el.previousElementSibling?.tagName === 'DT' ? el.previousElementSibling : null;
                    const label = dt?.textContent?.trim() || '';

                    if (label === '등급') res.ageRating = text;
                    if (label === '국가') res.productionCountry = text;
                    if (label === '러닝타임') res.runningTime = text;
                    if (label === '장르' || label === '개요') realGenre = text;
                    if (label === '원제') res.originalTitle = text;

                    // 2. Pattern Matching (Fallback & Header)
                    if (!res.ageRating && text.match(patterns.age)) res.ageRating = text.match(patterns.age)![0];
                    if (!res.runningTime && text.match(patterns.runtime)) res.runningTime = text.match(patterns.runtime)![0];
                    if (!res.productionCountry && text.match(patterns.country)) res.productionCountry = text.match(patterns.country)![0];
                    if (!res.subGenre && text.match(patterns.genre) && !text.includes('관람') && !text.match(/\d/)) {
                        if (patterns.genre.test(text)) res.subGenre = text;
                    }

                    // Use Link Text for Genre (common in Naver headers)
                    const link = el.querySelector('a');
                    if (link && !res.subGenre && patterns.genre.test(link.textContent || '')) {
                        res.subGenre = link.textContent?.trim();
                    }
                });

                // Refine Genre from Basic Info if Pattern failed
                if (realGenre && !res.subGenre) {
                    if (realGenre.includes('·')) {
                        realGenre.split('·').forEach(p => {
                            p = p.trim();
                            if (patterns.genre.test(p)) res.subGenre = p;
                        });
                    } else {
                        const match = realGenre.match(patterns.genre);
                        if (match) {
                            res.subGenre = match[0];
                        } else {
                            res.subGenre = realGenre;
                        }
                    }
                }

                // Final Cleanups for Age Rating
                if (res.ageRating && !res.ageRating.includes('관람가') && !res.ageRating.includes('불가') && !res.ageRating.includes('시청가')) {
                    if (res.ageRating === '전체') res.ageRating = '전체 관람가';
                    else if (res.ageRating.includes('세')) res.ageRating += ' 관람가';
                }

                // Extract Cast (Robust)
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
            };

            // 1. Initial Extraction
            let detail = await page.evaluate(extractMetadata);
            if (detail) Object.assign(item, detail);

            // 1.5. Header-specific Age Rating Extraction (for dramas/variety shows)
            if (!item.ageRating) {
                const headerAge = await page.evaluate(() => {
                    const headerEls = document.querySelectorAll('.title_area .sub_title .txt, .title_area .sub_text .txt, .cm_top_wrap .sub_text .txt');
                    const agePattern = /(전체|ALL|\d{1,2}세\s*이상|\d{1,2}세이상|청소년\s*관람불가|청불)/i;
                    for (const el of headerEls) {
                        const text = el.textContent?.trim() || '';
                        if (agePattern.test(text)) return text;
                    }
                    return null;
                });
                if (headerAge) item.ageRating = headerAge;
            }

            // 2. Fallback: If Age Rating is missing, try clicking '기본정보' or '정보' tab
            // This is the validation loop the user requested
            if (!item.ageRating) {
                try {
                    const clicked = await page.evaluate(() => {
                        const tabs = Array.from(document.querySelectorAll('a, div[role="tab"], span[role="button"]'));
                        const t = tabs.find(el => {
                            const txt = el.textContent?.trim();
                            return txt === '기본정보' || txt === '정보';
                        });
                        if (t) { (t as HTMLElement).click(); return true; }
                        return false;
                    });

                    if (clicked) {
                        await page.waitForTimeout(1500); // Wait for Tab Content
                        // Re-run the EXACT SAME extraction logic to capture everything revealed by the tab
                        const newDetail = await page.evaluate(extractMetadata);
                        // Merge new details, preferring new values if they exist
                        if (newDetail.ageRating) item.ageRating = newDetail.ageRating;
                        if (newDetail.runningTime) item.runningTime = newDetail.runningTime;
                        if (newDetail.productionCountry) item.productionCountry = newDetail.productionCountry;
                        if (newDetail.subGenre) item.subGenre = newDetail.subGenre;
                        if (newDetail.originalTitle) item.originalTitle = newDetail.originalTitle;
                    }
                } catch (e) { }
            }

            // 3. Last Resort: Regex scan on Body Text (if still missing)
            if (!item.ageRating) {
                const bodyAge = await page.evaluate(() => {
                    const patterns = {
                        age: /(전체\s*관람가|전체\s*시청가|\d{1,2}세\s*(?:이상)?\s*(?:관람가|시청가)?|청소년\s*관람불가|청불|미성년자\s*관람불가)/
                    };
                    const match = document.body.innerText.match(patterns.age);
                    return match ? match[0] : null;
                });
                if (bodyAge) {
                    item.ageRating = bodyAge;
                    // Cleanup
                    if (item.ageRating === '전체') item.ageRating = '전체 관람가';
                    else if (item.ageRating.includes('세') && !item.ageRating.includes('관람가')) item.ageRating += ' 관람가';
                }
            }

            // B. INTERACTIVE CAST FALLBACK (Generic)
            if (!item.cast || item.cast.length === 0) {
                try {
                    const foundTab = await page.evaluate(() => {
                        const tabs = Array.from(document.querySelectorAll('a, div[role="tab"]'));
                        // Includes '등장인물', '출연', '제작', '참가', '출연진'
                        // Fix: Ensure tab text is short (< 10 chars) to avoid clicking news links
                        const t = tabs.find(el => {
                            const txt = el.textContent?.trim() || '';
                            return txt.length < 15 && (txt.includes('출연') || txt.includes('등장인물') || txt.includes('제작') || txt.includes('참가'));
                        });
                        if (t) { (t as HTMLElement).click(); return true; }
                        return false;
                    });
                    if (foundTab) {
                        await page.waitForTimeout(1500);
                        const newCastData = await page.evaluate(() => {
                            const newCast: string[] = [];
                            const members = document.querySelectorAll('.cast_box .name, .detail_info .name, ._actor_wrap .card_item');
                            members.forEach(m => {
                                let name = m.textContent?.trim() || '';
                                if (m.querySelector('.name')) name = m.querySelector('.name')?.textContent?.trim() || '';
                                // Fix: Clean '역' suffix instead of discarding
                                if (name.includes(' 역')) name = name.split(' 역')[0];
                                if (name && name.length < 20 && !name.includes('출연') && !name.includes('더보기')) newCast.push(name);
                            });
                            return newCast;
                        });
                        if (newCastData.length > 0) item.cast = [...new Set(newCastData)].slice(0, 8);
                    }
                } catch (e) { }
            }

            cleanOTTItem(item);

            // Fallback to JustWatch if critical info missing
            if (!item.ageRating && !item.cast) {
                const jwData = await searchJustWatch(context, item.title);
                if (jwData) Object.assign(item, jwData);
            }

        } catch (e) {
            console.error(`Error enriching ${item.title}:`, e);
        } finally {
            await page.close();
            progressBar.increment();
        }
    })));

    progressBar.stop();

    // Generate IDs and Image Paths
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    itemsToProcess.forEach(item => {
        // Create ID: ott_YYYYMMDD_Title(sanitized)
        const safeTitle = item.title.replace(/[^a-zA-Z0-9가-힣]/g, '');
        item.id = `ott_${today}_${safeTitle}`;
        item.venue = 'OTT';
        item.region = 'ott';
        if (!item.genre) item.genre = 'ott';
        item.date = new Date().toISOString().slice(0, 10);
    });

    // Phase 3: Images
    console.log('Phase 3: Downloading Images...');
    const imageLimit = pLimit(10);
    await Promise.all(itemsToProcess.map(item => imageLimit(async () => {
        if (item.poster) {
            item.image = await processImage(item.poster, item.id);
        }
    })));

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(itemsToProcess, null, 2));
    console.log(`Done. Saved ${itemsToProcess.length} items to ${OUTPUT_FILE}`);
    await browser.close();
}

scrapeOTT();
