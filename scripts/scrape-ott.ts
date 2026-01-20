import { firefox } from 'playwright';
import fs from 'fs';
import path from 'path';
import cliProgress from 'cli-progress';

// --- CONFIG ---
const JW_URL = 'https://www.justwatch.com/kr/new';
// Platforms to keep (strict allowlist)
const ALLOWLIST = ['Netflix', 'Disney Plus', 'wavve', 'TVING', 'Watcha', 'Coupang Play', 'Amazon Prime Video', 'Apple TV Plus', 'Apple TV', 'Naver Store', 'Google Play Movies'];
const PLATFORM_MAP: Record<string, string> = {
    'Netflix': 'netflix',
    'Disney Plus': 'disney',
    'wavve': 'wavve',
    'TVING': 'tving',
    'Watcha': 'watcha',
    'Coupang Play': 'coupang',
    'Amazon Prime Video': 'amazon',
    'Apple TV Plus': 'apple',
    'Apple TV': 'apple',
    'Naver Store': 'naver',
    'Google Play Movies': 'google'
};
const OUTPUT_FILE = path.resolve(process.cwd(), 'src/data/ott.json');

// --- HELPER: Normalize Strings ---
const cleanText = (s: string) => s.replace(/\s+/g, ' ').trim();

// --- VALIDATION & CLEANING [NEW] ---
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

    // 1. Standardize known patterns
    if (['ALL', 'All', 'all', '전체', 'G', '전체관람가'].some(k => r.includes(k))) return '전체 관람가';
    if (r.includes('12') && (r.includes('세') || r.includes('+') || r.includes('연령'))) return '12세 이상 관람가';
    if (r.includes('15') && (r.includes('세') || r.includes('+') || r.includes('연령'))) return '15세 이상 관람가';
    if (r.includes('18') || r.includes('19') || r.includes('청불') || r.includes('청소년')) return '청소년 관람불가';

    // 2. Strict whitelist check
    const validSet = ['전체 관람가', '12세 이상 관람가', '15세 이상 관람가', '청소년 관람불가'];
    if (validSet.includes(r)) return r;

    // 3. Fallback: Parse "12세 이상 관람가" exact format
    if (/^\d+세 이상 관람가$/.test(r)) return r;

    // Discard garbage like "7.9 (550)"
    return null;
}

function cleanOTTItem(item: any) {
    // 1. Clean Age Rating
    if (item.title && MANUAL_GRADES[item.title]) {
        item.ageRating = MANUAL_GRADES[item.title];
    } else {
        const validGrade = normalizeAgeRating(item.ageRating);
        if (validGrade) {
            item.ageRating = validGrade;
        } else {
            // Remove invalid/garbage rating
            delete item.ageRating;
        }
    }

    // 2. Clean Original Title
    if (item.originalTitle) {
        let ot = item.originalTitle.trim();
        // Remove simple runtime "42분"
        if (/^\d{1,3}분$/.test(ot)) delete item.originalTitle;
        // Remove simple year "2024"
        else if (/^\d{4}$/.test(ot)) delete item.originalTitle;
        // Remove massive garbage strings "30.-286.3 (456)..."
        else if (ot.length > 20 && (/[\d\.\+\-\(\)]+/.test(ot) && ot.includes('연령') || ot.includes('분'))) {
            delete item.originalTitle;
        }
        // Remove if identical to Title
        else if (ot === item.title) delete item.originalTitle;
    }

    // 3. Clean SubGenre
    if (item.subGenre === 'OTT') delete item.subGenre;
}


// --- SCERAPER HELPERS ---
async function scrapeJWDetail(page: any, url: string) {
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        try { await page.waitForSelector('.title-block, .detail-infos', { timeout: 5000 }); } catch (e) { }

        // Scroll to trigger lazy loading
        await page.mouse.wheel(0, 1000);
        await page.waitForTimeout(500);

        return await page.evaluate(() => {
            const res: any = {};

            // 1. Hero Details (Age, Runtime)
            const heroDivs = Array.from(document.querySelectorAll('#title-detail-hero-details > div > div > div, .title-info > div'));
            heroDivs.forEach(div => {
                const text = div.textContent?.trim() || '';
                // Age Logic
                if (['ALL', '전체', 'G', 'All'].includes(text)) res.ageRating = '전체 관람가';
                else if (text.match(/^\d+$/)) {
                    const num = parseInt(text);
                    if (num > 0 && num < 20) res.ageRating = `${num}세 관람가`;
                }
                else if (text.match(/\d+세/)) res.ageRating = text;
                else if (text.includes('청불') || text.includes('청소년')) res.ageRating = '청소년 관람불가';

                // Runtime Logic
                if (text.includes('분') || text.includes('min') || text.match(/\d+h/)) {
                    res.runningTime = text;
                }
            });

            // 2. Sidebar (Genre, Country, etc.)
            const headers = Array.from(document.querySelectorAll('h3, .detail-infos__subheading, .detail-infos__detail--heading'));
            headers.forEach(h => {
                const label = h.textContent?.trim().toLowerCase();
                let valueDiv = h.nextElementSibling;
                if (!valueDiv) return;
                let value = valueDiv.textContent?.trim() || '';

                if (label?.includes('genre') || label?.includes('장르')) {
                    if (value.includes('Documentary') || value.includes('다큐멘터리')) res.subGenre = '다큐멘터리';
                    else res.subGenre = value;
                }
                if (label?.includes('country') || label?.includes('국가')) {
                    res.productionCountry = value;
                }
                if (label?.includes('runtime') || label?.includes('재생 시간')) {
                    res.runningTime = value;
                }
                if (label?.includes('rating') || label?.includes('등급')) {
                    if (['ALL', 'G', '전체', 'All'].includes(value)) res.ageRating = '전체 관람가';
                    else res.ageRating = value;
                }
                if (label?.includes('original title') || label?.includes('원제')) {
                    const sibling = h.nextElementSibling;
                    if (sibling) res.originalTitle = sibling.textContent?.trim();
                }
            });

            // 3. Cast
            let castItems: any[] = [];
            const cards = document.querySelectorAll('.title-credits__actors .presentation-actor-card, .credits .credits__actor-item');
            if (cards.length > 0) {
                cards.forEach(card => {
                    const name = card.querySelector('.presentation-actor-card__name')?.textContent?.trim() || card.querySelector('.credits__actor-item-name')?.textContent?.trim();
                    const link = card.closest('a') ? card.closest('a')?.getAttribute('href') : card.querySelector('a')?.getAttribute('href');
                    if (name) castItems.push({ name, url: link });
                });
            } else {
                // Fallback: Headings
                const allH = Array.from(document.querySelectorAll('h2, h3'));
                const castH = allH.find(h => h.textContent?.includes('출연진') || h.textContent?.includes('Cast'));
                if (castH && castH.nextElementSibling) {
                    const links = castH.nextElementSibling.querySelectorAll('a');
                    links.forEach(a => {
                        const name = a.querySelector('.presentation-actor-card__name')?.textContent?.trim() || a.textContent?.trim();
                        if (name) castItems.push({ name, url: a.getAttribute('href') });
                    });
                }
            }

            // Fallback 1.5: New JustWatch Layout (2025/2026)
            if (castItems.length === 0) {
                const newCards = document.querySelectorAll('.title-credits__actor');
                newCards.forEach(card => {
                    // Try to find the name specifically. 
                    // Often it's a direct text node or inside a specific hidden span, but let's try getting the text excluding role.
                    // Based on debug: Text is "ActorNameRoleName". 
                    // Valid names usually don't have " / " (role often does).
                    // Let's look for a strong tag or similar if available, otherwise just strict split?
                    // Actually, usually the image alt tag holds the name too!
                    const img = card.querySelector('img');
                    const nameFromImg = img?.getAttribute('alt') || img?.getAttribute('title');

                    if (nameFromImg) {
                        castItems.push({ name: nameFromImg, url: '' });
                    } else {
                        // Fallback to text parsing
                        const text = card.textContent?.trim() || '';
                        // Heuristic: If we have "RoleName" element, remove it from total text
                        const roleEl = card.querySelector('.title-credits__actor--role');
                        let name = text;
                        if (roleEl && roleEl.textContent) {
                            name = name.replace(roleEl.textContent, '').trim();
                        }
                        if (name) castItems.push({ name, url: '' });
                    }
                });
            }

            // Fallback 2: Apollo State
            try {
                const state = (window as any).__APOLLO_STATE__;
                if (state) {
                    const source = state.defaultClient || state;
                    for (const key in source) {
                        if (key.includes('Credit') || key.includes('Person')) {
                            const item = source[key];
                            if (item.name && (item.personId || item.id)) {
                                const pid = item.personId || item.id;
                                castItems.push({
                                    name: item.name,
                                    url: `/검색?q=${encodeURIComponent(item.name)}&person_id=${pid}`
                                });
                            }
                        }
                    }
                }
            } catch (e) { }

            if (castItems.length > 0) {
                const unique = new Map();
                castItems.forEach(c => unique.set(c.name, c));
                res.cast = Array.from(unique.values()).slice(0, 10).map((c: any) => ({
                    name: c.name,
                    url: c.url ? `https://www.justwatch.com${c.url}` : undefined
                }));
            }

            // 4. Poster (High Res)
            const posterImg = document.querySelector('picture > img, .title-poster img');
            if (posterImg) {
                let src = posterImg.getAttribute('data-src') || posterImg.getAttribute('src');
                // Try to get highest res
                if (src) {
                    res.poster = src.replace(/\/s\d+\//, '/s718/');
                }
            }

            return res;
        });
    } catch (e) {
        return {};
    }
}

// --- TMDB SCRAPER (Fallback) ---
// Scrapes TMDB search results for Poster and Metadata using reused page
async function fetchTMDBData(page: any, title: string) {

    try {
        // Search
        const searchUrl = `https://www.themoviedb.org/search?query=${encodeURIComponent(title)}`;
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 5000 });

        // Click first result (Movie or TV)
        const firstResult = await page.$('.card.v4.tight a.result');
        if (!firstResult) {
            return null;
        }

        const detailUrl = await firstResult.getAttribute('href');
        await page.goto(`https://www.themoviedb.org${detailUrl}`, { waitUntil: 'domcontentloaded', timeout: 5000 });

        // Extract Data
        const data = await page.evaluate(() => {
            const res: any = {};

            // Poster
            const img = document.querySelector('div.image_content img.poster');
            if (img) {
                const src = img.getAttribute('src');
                if (src) res.poster = `https://www.themoviedb.org${src}`;
            } else {
                // Fallback for some layouts
                const img2 = document.querySelector('.poster img');
                if (img2) {
                    const src = img2.getAttribute('src');
                    if (src) res.poster = `https://www.themoviedb.org${src}`;
                }
            }

            // Runtime (usually in .facts)
            const runtimeEl = document.querySelector('.facts .runtime');
            if (runtimeEl) res.runningTime = runtimeEl.textContent?.trim();

            // Genre (in .facts .genres)
            const genres = Array.from(document.querySelectorAll('.facts .genres a')).map(a => a.textContent?.trim());
            if (genres.length > 0) res.subGenre = genres.join(', ');

            return res;
        });

        return data;
    } catch (e) {
        // console.error(`TMDB Error for ${title}:`, e);
        return null;
    }
}

// --- MAIN SCRAPER ---
async function scrapeHybrid() {
    console.log('Starting Hybrid OTT Scraper (V8 - Cleaner & Validator Added)...');

    // 1. Scrape JustWatch List
    const browser = await firefox.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const items: any[] = [];

    try {
        const page = await context.newPage();
        await page.goto(JW_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Scroll
        for (let i = 0; i < 8; i++) {
            await page.mouse.wheel(0, 1500);
            await page.waitForTimeout(1000);
        }

        const scrapedList = await page.evaluate(() => {
            const list: any[] = [];
            const timeframes = document.querySelectorAll('.timeline__timeframe');
            timeframes.forEach(frame => {
                let dateStr = '';
                frame.classList.forEach(c => {
                    if (c.startsWith('timeline__timeframe--') && c.match(/\d{4}-\d{2}-\d{2}/)) {
                        dateStr = c.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || '';
                    }
                });

                const providerBlocks = frame.querySelectorAll('.timeline__provider-block');
                providerBlocks.forEach(block => {
                    let providerName = '';
                    block.classList.forEach(c => {
                        if (c.includes('--nfx')) providerName = 'Netflix';
                        if (c.includes('--dnp')) providerName = 'Disney Plus';
                        if (c.includes('--wav')) providerName = 'wavve';
                        if (c.includes('--tvk')) providerName = 'TVING';
                        if (c.includes('--nfa')) providerName = 'Netflix';
                        if (c.includes('--atp')) providerName = 'Apple TV Plus';
                        if (c.includes('--wac')) providerName = 'Watcha';
                        if (c.includes('--cpn')) providerName = 'Coupang Play';
                        if (c.includes('--amp')) providerName = 'Amazon Prime Video';
                    });
                    if (!providerName) {
                        const icon = block.querySelector('.timeline__provider-block__icon') || block.querySelector(':scope > img');
                        if (icon) providerName = icon.getAttribute('alt') || icon.getAttribute('title') || '';
                    }

                    block.querySelectorAll('.horizontal-title-list__item').forEach(card => {
                        const a = card.querySelector('a');
                        const img = card.querySelector('img');
                        const title = img?.getAttribute('alt') || a?.innerText.trim();
                        const link = a?.getAttribute('href') || '';
                        let poster = img?.getAttribute('data-src') || img?.getAttribute('src') || '';

                        if (!poster || poster.startsWith('data:')) {
                            const srcset = img?.getAttribute('data-srcset') || img?.getAttribute('srcset');
                            if (srcset) {
                                const parts = srcset.split(',').map(s => s.trim().split(' ')[0]);
                                poster = parts[parts.length - 1];
                            }
                        }
                        if (poster.startsWith('data:')) poster = '';
                        poster = poster.replace('/s166/', '/s592/');

                        if (title && link) {
                            list.push({
                                title,
                                date: dateStr,
                                link: 'https://www.justwatch.com' + link,
                                platform: providerName,
                                poster
                            });
                        }
                    });
                });
            });
            return list;
        });

        const aggregated: Record<string, any> = {};
        for (const it of scrapedList) {
            const key = it.title + '|' + (it.date || '');
            if (!aggregated[key]) {
                aggregated[key] = { ...it, platforms: [] };
            }
            if (it.platform) aggregated[key].platforms.push(it.platform);
        }

        items.push(...Object.values(aggregated));
        console.log(`Initial Scan: Found ${items.length} unique items.`);
        await page.close();

    } catch (e) {
        console.error('List Scrape Error:', e);
    }

    // Filter Items
    const filteredItems = items.filter(item => {
        item.platforms = Array.from(new Set(item.platforms));
        const validPlatforms = item.platforms.map((p: string) => {
            const match = ALLOWLIST.find(a => p.toLowerCase().includes(a.toLowerCase()));
            return match ? PLATFORM_MAP[match] : null;
        }).filter(Boolean);

        if (validPlatforms.length === 0) return false;
        item.platforms = validPlatforms;

        item.venue = 'OTT';
        item.region = 'ott';
        item.genre = 'ott';

        const dateStr = item.date ? item.date.replace(/-/g, '') : '00000000';
        const titleStr = item.title ? item.title.replace(/\s+/g, '').replace(/[^\w\uAC00-\uD7A3]/g, '') : 'unknown';
        const finalTitleStr = titleStr || Math.random().toString(36).substring(7);
        item.id = `ott_${dateStr}_${finalTitleStr}`;

        return true;
    });

    console.log(`Filtered: ${filteredItems.length} items to enrich.`);

    // --- ENRICHMENT PHASE ---
    const ENRICH_LIMIT = 100;
    let existingData: any[] = [];
    try {
        if (fs.existsSync(OUTPUT_FILE)) {
            existingData = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
        }
    } catch (e) { }

    let processed = 0;
    const progressBar = new cliProgress.SingleBar({
        format: 'Enriching [{bar}] {percentage}% | {value}/{total} | {title}',
        clearOnComplete: false
    }, cliProgress.Presets.shades_classic);

    const itemsToProcess = Math.min(filteredItems.length, ENRICH_LIMIT);
    progressBar.start(itemsToProcess, 0, { title: 'Starting...' });

    const jwPage = await context.newPage();
    const naverPage = await context.newPage();
    const tmdbPage = await context.newPage();

    for (const item of filteredItems) {
        if (processed >= ENRICH_LIMIT) break;

        const currentTitle = item.title.length > 20 ? item.title.substring(0, 20) + '...' : item.title;
        progressBar.update(processed + 1, { title: currentTitle });
        processed++;

        // 1. JW Detail Scraping (New Priority)
        if (item.link) {
            const jwData = await scrapeJWDetail(jwPage, item.link);

            // Check Exclusion (Thailand)
            if (jwData.productionCountry && (jwData.productionCountry.includes('Thailand') || jwData.productionCountry.includes('태국'))) {
                console.log(`   > Skipping ${item.title} (Country: ${jwData.productionCountry})`);
                continue;
            }

            // Merge JW Data
            if (jwData.ageRating) item.ageRating = jwData.ageRating;
            if (jwData.runningTime) item.runningTime = jwData.runningTime;
            if (jwData.subGenre) item.subGenre = jwData.subGenre;
            if (jwData.productionCountry) item.productionCountry = jwData.productionCountry;
            if (jwData.originalTitle) item.originalTitle = jwData.originalTitle;

            // Store JW cast as fallback (type: object[])
            if (jwData.cast) item._jwCast = jwData.cast;
        }

        // Resume Check (Enhanced: Check if we have essential data)
        const match = existingData.find(e => e.title === item.title && e.date === item.date);
        if (match && match.subGenre && match.image && !match.image.startsWith('data:')) {
            // Apply Smart Merge even on resume, to fix missing/bad data in existing items
            if (!match.ageRating && item.ageRating) match.ageRating = item.ageRating;
            if (!match.runningTime && item.runningTime) match.runningTime = item.runningTime;
            if (!match.cast && item._jwCast) match.cast = item._jwCast;
            if (item.subGenre === '다큐멘터리' && match.subGenre !== '다큐멘터리') match.subGenre = item.subGenre;
            if (item.subGenre === '예능' && match.subGenre !== '예능') match.subGenre = item.subGenre;

            Object.assign(item, match);
            delete item._jwCast;

            // Apply Cleaner here too! (For existing data)
            cleanOTTItem(item);

            continue;
        }

        // 2. Naver Enrichment (Korean Metadata)
        try {
            const queryRaw = item.title.replace(/\s-\s.*$/, '');
            const queries = [
                `${queryRaw} 정보`,
                item.originalTitle ? `${item.originalTitle} 정보` : null,
                `${queryRaw.split(' ')[0]} 정보`
            ].filter(Boolean) as string[];

            let naverData: any = { hasInfo: false };

            for (const q of queries) {
                const searchUrl = `https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(q)}`;
                await naverPage.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 5000 });

                const found = await naverPage.evaluate(() => !!document.querySelector('.cm_info_box') || !!document.querySelector('.api_subject_bx .detail_info'));
                if (found) {
                    naverData.hasInfo = true;
                    break;
                }
            }

            if (naverData.hasInfo) {
                const nData = await naverPage.evaluate(() => {
                    const res: any = {};
                    const infoBox = document.querySelector('.cm_info_box');
                    if (infoBox) {
                        const dts = infoBox.querySelectorAll('dt');
                        dts.forEach(dt => {
                            const k = dt.textContent?.trim() || '';
                            let vText = dt.nextElementSibling?.textContent?.trim() || '';

                            // Expanded Selectors
                            if (k.includes('등급') || k.includes('관람')) {
                                res.ageRating = vText;
                                if (res.ageRating.match(/^\d+세$/)) res.ageRating += ' 관람가';
                                if (res.ageRating === '전체') res.ageRating = '전체 관람가';
                            }
                            if (k.includes('장르')) res.subGenre = vText;
                            if (k.includes('국가')) res.productionCountry = vText;
                            if (k.includes('러닝타임') || k.includes('재생시간')) res.runningTime = vText;
                            if (k.includes('개봉') || k.includes('방송')) res.productionYear = vText.substring(0, 4);
                            if (k.includes('원제')) res.originalTitle = vText;
                            if (k.includes('감독')) res.director = vText;
                        });
                    }

                    const posterImg = document.querySelector('.detail_info a.thumb img') || document.querySelector('.cm_content_area .thumb img');
                    if (posterImg) res.poster = posterImg.getAttribute('src');

                    const castBox = document.querySelector('.cast_box');
                    if (castBox) {
                        const names = Array.from(castBox.querySelectorAll('.name')).map(n => n.textContent?.trim()).slice(0, 6);
                        if (names.length > 0) res.cast = names;
                    }
                    return res;
                });

                if (!nData.cast) {
                    // Enhanced Tab Selector
                    const castTab = await naverPage.evaluateHandle(() => {
                        const links = Array.from(document.querySelectorAll('.tab_area a, .api_subject_bx a, .menu_group a'));
                        return links.find(a => a.textContent?.includes('출연') || a.textContent?.includes('제작'));
                    });

                    if (castTab) {
                        await castTab.asElement()?.click();
                        await naverPage.waitForTimeout(2000); // Increased wait
                        nData.cast = await naverPage.evaluate(() => {
                            const names: string[] = [];
                            document.querySelectorAll('.cast_box .name, .detail_info .name').forEach(el => {
                                const n = el.textContent?.trim();
                                if (n) names.push(n);
                            });
                            return names.slice(0, 6);
                        });
                    }
                }

                if (nData.poster && !nData.poster.startsWith('data:')) item.image = nData.poster;
                if (nData.ageRating) item.ageRating = nData.ageRating;
                if (nData.subGenre) item.subGenre = nData.subGenre;
                if (nData.director) item.director = nData.director;

                if (nData.cast && nData.cast.length > 0) {
                    item.cast = nData.cast;
                } else if (!item.cast && item._jwCast) {
                    item.cast = item._jwCast;
                }

                if (nData.runningTime) item.runningTime = nData.runningTime;
                if (nData.productionCountry) item.productionCountry = nData.productionCountry;
            } else {
                if (item._jwCast) item.cast = item._jwCast;
            }

            delete item._jwCast;

            // 3. TMDB Fallback 
            if (!item.image && !item.poster) {
                const tmdb = await fetchTMDBData(tmdbPage, item.title);
                if (tmdb?.poster) item.image = tmdb.poster;
                if (tmdb?.subGenre && !item.subGenre) item.subGenre = tmdb.subGenre;
            }

        } catch (e) {
            // console.error(e);
        }

        // Final cleanup & validation
        if (!item.image && item.poster) item.image = item.poster;

        // --- CLEAN & VALIDATE ---
        cleanOTTItem(item);
    }

    progressBar.stop();
    await browser.close();

    // Dedupe & Merge with History
    let finalData = filteredItems;
    if (existingData.length > 0) {
        const idMap = new Map<string, any>();
        existingData.forEach(item => {
            // Clean existing data too!
            cleanOTTItem(item);
            idMap.set(item.id, item);
        });
        filteredItems.forEach(item => idMap.set(item.id, item));
        finalData = Array.from(idMap.values());
    }

    finalData.sort((a, b) => (a.date > b.date ? -1 : 1));

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalData, null, 2));
    console.log(`Saved ${finalData.length} items to ${OUTPUT_FILE}`);
}

scrapeHybrid();
