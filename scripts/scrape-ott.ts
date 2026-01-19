
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

// --- TMDB SCRAPER (Fallback) ---
// Scrapes TMDB search results for Poster and Metadata
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

            // Country/General info handling is complex on TMDB, but Runtime/Poster/Genre are critical

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
    console.log('Starting Hybrid OTT Scraper (V6 - JustWatch List + Naver Enrichment)...');

    // 1. Scrape JustWatch List
    const browser = await firefox.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    // items: { title, date, platforms, link, originalTitle? }
    const items: any[] = [];

    try {
        const page = await context.newPage();
        await page.goto(JW_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Scroll to load ~50-100 items
        for (let i = 0; i < 8; i++) {
            await page.mouse.wheel(0, 1500);
            await page.waitForTimeout(1000);
        }

        // Extract basic info from List View
        const rawList = await page.evaluate(() => {
            const results: any[] = [];
            document.querySelectorAll('.horizontal-title-list__item').forEach(card => {
                const anchor = card.querySelector('a');
                const img = card.querySelector('img');
                const title = img?.getAttribute('alt') || anchor?.textContent?.trim();
                const link = anchor?.getAttribute('href') ? 'https://www.justwatch.com' + anchor?.getAttribute('href') : '';
                const dateMatch = document.body.innerText.match(/(\d{4}-\d{2}-\d{2})/); // Simplification, JW structure is complex for dates in list
                // Actually, dates are in headers like .timeline__timeframe
                // We need to parse per-section.
                return;
            });
            // Re-implementing logic from V5 for robust list parsing
            return []; // Placeholder to use V5 logic below
        });

        // Re-using V5 List Parsing Logic (It was robust)
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
                    // Identify Provider
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

                        // Valid Poster from JW (fallback) - Force High Res
                        let poster = img?.getAttribute('data-src') || img?.getAttribute('src') || '';

                        // Handle lazy-loaded srcset if available
                        if (!poster || poster.startsWith('data:')) {
                            const srcset = img?.getAttribute('data-srcset') || img?.getAttribute('srcset');
                            if (srcset) {
                                // Take the last URL in srcset (usually largest)
                                const parts = srcset.split(',').map(s => s.trim().split(' ')[0]);
                                poster = parts[parts.length - 1];
                            }
                        }

                        // Reject data URIs or empty placeholders
                        if (poster.startsWith('data:')) poster = '';

                        // Upgrade resolution
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

        // Aggregation
        const aggregated: Record<string, any> = {};
        for (const it of scrapedList) {
            const key = it.title + '|' + (it.date || ''); // Group by Title+Date
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

    // 2. Filter & Prepare for Enrichment
    const filteredItems = items.filter(item => {
        // Platform Filter
        item.platforms = [...new Set(item.platforms)]; // Unique
        const validPlatforms = item.platforms.map((p: string) => {
            const match = ALLOWLIST.find(a => p.toLowerCase().includes(a.toLowerCase()));
            return match ? PLATFORM_MAP[match] : null;
        }).filter(Boolean);

        if (validPlatforms.length === 0) return false;
        item.platforms = validPlatforms;

        // Assign Default Metadata & ID EARLY to ensure visibility even if enrichment fails/skipped
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

    // 3. Enrich with Naver (Limit 100 for performance/rate-limits)
    const ENRICH_LIMIT = 100;

    // Resume Logic: Read existing data to skip already enriched items
    let existingData: any[] = [];
    try {
        if (fs.existsSync(OUTPUT_FILE)) {
            existingData = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
            console.log(`Loaded ${existingData.length} existing items for resume check.`);
        }
    } catch (e) { }

    let processed = 0;

    const progressBar = new cliProgress.SingleBar({
        format: 'Enriching [{bar}] {percentage}% | {value}/{total} | {title}',
        clearOnComplete: false
    }, cliProgress.Presets.shades_classic);

    const itemsToProcess = Math.min(filteredItems.length, ENRICH_LIMIT);
    progressBar.start(itemsToProcess, 0, { title: 'Starting...' });

    const naverPage = await context.newPage();
    const tmdbPage = await context.newPage(); // Reuse this page

    for (const item of filteredItems) {
        if (processed > ENRICH_LIMIT) break; // Check > so we process exactly LIMIT items (processed is incremented after check in loop usually, but here structure is tricky. improved below)

        // Update Title via Progress Bar, avoid spamming stdout
        const currentTitle = item.title.length > 20 ? item.title.substring(0, 20) + '...' : item.title;
        progressBar.update(processed + 1, { title: currentTitle });

        processed++;

        // RESUME CHECK: If item already has good data (Image OR TMDB Poster) + Metadata
        const match = existingData.find(e => e.title === item.title && e.date === item.date);

        // Check if enriched (has subGenre or runningTime AND (image or tmdb poster))
        // [UPDATE] Also check if poster is NOT a data URI
        const hasValidPoster = (match?.image && !match.image.startsWith('data:')) || (match?.poster && !match.poster.startsWith('data:'));
        const hasMetadata = match?.subGenre || match?.runningTime;

        if (match && hasValidPoster && hasMetadata) {
            Object.assign(item, match);
            continue;
        }

        // Incremental Save (Every 5 items to prevent data loss on stop)
        if (processed % 5 === 0) {
            try {
                // [Autosave] Merge and Save (Cumulative)
                let saveData = filteredItems;
                if (existingData && existingData.length > 0) {
                    const idMap = new Map<string, any>();
                    existingData.forEach(item => idMap.set(item.id, item));
                    filteredItems.forEach(item => idMap.set(item.id, item));
                    saveData = Array.from(idMap.values());
                }

                // Sort Descending
                saveData.sort((a, b) => (a.date > b.date ? -1 : 1));

                fs.writeFileSync(OUTPUT_FILE, JSON.stringify(saveData, null, 2));
            } catch (e) { }
        }

        try {
            // Search Query: "[Title] 정보" or just "[Title]"
            // E.g. "오징어 게임 시즌2 정보"
            let query = `${item.title.replace(/\s-\s.*$/, '')} 정보`;
            let searchUrl = `https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(query)}`;

            await naverPage.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });

            // --- ENRICHMENT LOGIC ---
            // Strategies:
            // 1. Full Title + "정보"
            // 2. Clean Title (no season/special chars) + "정보"
            // 3. Clean Title + "영화" (if missing)
            // 4. Clean Title + "드라마" (if missing)
            // 5. Clean Title (just the name)

            const cleanTitle = item.title
                .split(/[:\–-]\s*시즌|[:\–-]\s*\d+기/)[0] // Remove " - Season X" or " - 2기"
                .replace(/[:\–-]\s*Season\s*\d+/i, '')
                .replace(/[【】\[\]()~^!]/g, ' ') // Remove brackets and special chars
                .replace(/\s+/g, ' ')
                .trim();

            const queries = [
                `${item.title} 정보`, // 1. Full Title
                item.title !== cleanTitle ? `${cleanTitle} 정보` : null, // 2. Clean Title
                `${cleanTitle} 영화`, // 3. Explicit Movie
                `${cleanTitle} 드라마`, // 4. Explicit Drama
                cleanTitle // 5. Just Title
            ].filter(Boolean) as string[];

            // Deduplicate queries
            const uniqueQueries = [...new Set(queries)];

            let naverData: any = { hasInfo: false };

            for (const q of uniqueQueries) {
                // console.log(`   > Searching: "${q}"`); 
                try {
                    const searchUrl = `https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(q)}`;
                    await naverPage.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 5000 }); // Fast timeout for retries

                    // Check if we found info
                    const found = await naverPage.evaluate(() => {
                        return !!document.querySelector('.cm_info_box') || !!document.querySelector('.api_subject_bx .detail_info');
                    });

                    if (found) {
                        naverData.hasInfo = true;
                        // console.log(`   > Found info with query: "${q}"`);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }

            naverData = await naverPage.evaluate(() => {
                const res: any = {};

                // 1. Info Box (.cm_info_box) - Rating, Genre, Country, Runtime
                const infoBox = document.querySelector('.cm_info_box');
                if (infoBox) {
                    const dts = infoBox.querySelectorAll('dt');
                    dts.forEach(dt => {
                        const k = dt.textContent?.trim() || '';

                        // Use innerHTML to preserve structural separators like <span class="cm_bar_info"></span>
                        // Example: "멜로/로맨스<span class="cm_bar_info"></span>일본<span class="cm_bar_info"></span>92분"
                        // Replace common separators with " | " for clean splitting
                        let vHtml = dt.nextElementSibling?.innerHTML || '';
                        vHtml = vHtml.replace(/<span[^>]*class="cm_bar_info"[^>]*>.*?<\/span>/g, ' | ');
                        vHtml = vHtml.replace(/<[^>]+>/g, ''); // Strip remaining tags
                        const v = vHtml.trim();

                        // Also get simple text for standard fields
                        const vText = dt.nextElementSibling?.textContent?.trim() || '';

                        if (k === '등급') {
                            res.ageRating = vText;
                            if (res.ageRating.match(/^\d+세$/)) res.ageRating += ' 관람가';
                            if (res.ageRating === '전체') res.ageRating = '전체 관람가';
                        }
                        if (k === '장르') res.subGenre = vText;
                        if (k === '국가') res.productionCountry = vText;
                        if (k === '러닝타임') res.runningTime = vText;
                        if (k === '개봉') res.productionYear = vText.substring(0, 4);
                        if (k === '방송') res.productionYear = vText.substring(0, 4);
                        if (k === '원제') res.originalTitle = vText;

                        // [NEW] Fallback parsing from '편성' (Broadcast info)
                        if (k === '편성') {
                            // Example: "일본 Tokyo MX 2026.01.14. ~ (수) 오후 11:00"
                            if (!res.productionCountry) {
                                if (vText.includes('일본')) res.productionCountry = '일본';
                                if (vText.includes('미국')) res.productionCountry = '미국';
                                if (vText.includes('한국') || vText.match(/(KBS|SBS|MBC|tvN|JTBC|MBN|ENA)/i)) res.productionCountry = '한국';
                                if (vText.includes('중국')) res.productionCountry = '중국';
                                if (vText.includes('영국')) res.productionCountry = '영국';
                            }
                            if (!res.productionYear) {
                                const yearMatch = vText.match(/\d{4}/);
                                if (yearMatch) res.productionYear = yearMatch[0];
                            }
                            // If it has broadcast info, it's likely a Drama/Show
                            if (!res.subGenre) res.subGenre = '드라마';
                        }

                        // [NEW] Fallback for Genre from '원작'
                        if (k === '원작' && !res.subGenre) {
                            if (vText.includes('만화') || vText.includes('웹툰')) res.subGenre = '애니메이션';
                            if (vText.includes('소설')) res.subGenre = '드라마'; // Guess
                        }

                        // [NEW] Parse "개요" (Overview) with separators
                        if (k === '개요') {
                            const parts = v.split('|').map(s => s.trim()).filter(Boolean);
                            // Heuristics:
                            // "92분" -> Runtime
                            // "일본", "미국" -> Country
                            // Others -> Genre

                            parts.forEach(part => {
                                if (part.match(/\d+분/)) {
                                    res.runningTime = part;
                                } else if (['한국', '대한민국', '미국', '일본', '중국', '영국', '프랑스', '독일'].some(c => part.includes(c)) && part.length < 10) {
                                    res.productionCountry = part;
                                } else {
                                    // Make sure it's not a date (2025.09.10)
                                    if (!part.match(/\d{4}\.\d{2}\.\d{2}/)) {
                                        res.subGenre = part;
                                    }
                                }
                            });
                        }
                    });
                }

                // Header Fallback for Genre (e.g. .sub_title .txt: "드라마")
                if (!res.subGenre) {
                    const subTitle = document.querySelector('.sub_title .txt');
                    if (subTitle) res.subGenre = subTitle.textContent?.trim();
                }

                // [Fallback] Age Rating from Body if missing
                if (!res.ageRating) {
                    const bodyText = document.body.innerText;
                    const ratingMatch = bodyText.match(/(?:제한|전체|12세|15세|18세|19세)(?:\s*이상)?\s*관람가/);
                    if (ratingMatch) {
                        res.ageRating = ratingMatch[0];
                    } else if (bodyText.includes('청소년 관람불가')) {
                        res.ageRating = '청소년 관람불가';
                    }
                }

                // 2. Poster (.detail_info a.thumb img OR .cm_content_area .thumb img)
                const posterImg = document.querySelector('.detail_info a.thumb img') || document.querySelector('.cm_content_area .thumb img');
                if (posterImg) {
                    res.poster = posterImg.getAttribute('src');
                }

                // 3. Director / Cast
                // Usually in .detail_info > .info_group ... but Naver layout varies.
                // Strategy: Find text "감독" and "출연" in headings (dt) and get siblings (dd)
                const dts = document.querySelectorAll('dt');
                dts.forEach(dt => {
                    const txt = dt.textContent?.trim();
                    if (txt === '감독') {
                        res.director = dt.nextElementSibling?.textContent?.trim();
                    }
                    if (txt === '출연' || txt === '성우') { // [NEW] Support "Voice Actor"
                        res.cast = dt.nextElementSibling?.textContent?.trim();
                    }
                });

                // Fallback for Cast: sometimes in a separate .cast_box
                if (!res.cast) {
                    const castBox = document.querySelector('.cast_box');
                    if (castBox) {
                        const names = Array.from(castBox.querySelectorAll('.name')).map(n => n.textContent?.trim()).slice(0, 5);
                        if (names.length > 0) res.cast = names.join(', ');
                    }
                }

                return res;
            });

            // 3. Cast Tab Navigation (if missing)
            if (!naverData.cast) {
                // Try finding the tab
                const castTabSelector = 'li[data-tab-name="cast"] a, a[href*="cast"], a:has-text("출연"), a:has-text("등장인물")';
                try {
                    const castTab = await naverPage.$(castTabSelector);
                    if (castTab) {
                        // console.log('   > Clicking Cast Tab...');
                        await castTab.click();
                        await naverPage.waitForTimeout(1000);

                        const castList = await naverPage.evaluate(() => {
                            const names: string[] = [];
                            // Standard Cast List
                            document.querySelectorAll('.cast_box .name, .detail_list .name').forEach(el => {
                                const n = el.textContent?.trim();
                                if (n) names.push(n);
                            });
                            return names.slice(0, 6).join(', ');
                        });

                        if (castList) naverData.cast = castList;
                    }
                } catch (e) { }
            }

            // Merge Data
            // VALIDATION: invalid images
            if (item.poster && item.poster.startsWith('data:image')) item.poster = null;
            if (naverData.poster && naverData.poster.startsWith('data:image')) naverData.poster = null;

            // --- TMDB FALLBACK (If Poster or Critical Metadata Missing) ---
            const missingPoster = !naverData.poster && !item.poster;
            const missingMetadata = !naverData.runningTime || !naverData.subGenre;

            if (missingPoster || missingMetadata) {
                // If data missing from Naver/JW, try TMDB
                console.log(`   > ${missingPoster ? 'Poster' : 'Metadata'} missing for "${item.title}". Trying TMDB...`);

                // We opened 'browser' for JustWatch (closed now?) No, we closed the page, not the browser.
                // We reuse 'tmdbPage'.
                const tmdbData = await fetchTMDBData(tmdbPage, item.title);
                if (tmdbData) {
                    if (tmdbData.poster) {
                        console.log(`   > TMDB Poster Found!`);
                        item.image = tmdbData.poster;
                    }
                    if (tmdbData.runningTime && !naverData.runningTime) item.runningTime = tmdbData.runningTime;
                    if (tmdbData.subGenre && !naverData.subGenre) item.subGenre = tmdbData.subGenre;
                }
            } else {
                // Normal Logic
                if (naverData.poster) item.image = naverData.poster;
                else if (item.poster) item.image = item.poster;
                else item.image = null;
            }

            // Ensure image is set if we skipped the else block above
            if (!item.image && naverData.poster) item.image = naverData.poster;
            else if (!item.image && item.poster) item.image = item.poster;


            if (naverData.director) item.director = naverData.director;
            if (naverData.cast) {
                // Convert string "A, B, C" to array if needed, or keep string. 
                // PerformanceCard expects string or array? UI code handles array join.
                // Let's store as Array for consistency with V4 schema
                item.cast = naverData.cast.split(',').map((s: string) => s.trim());
            }
            if (naverData.ageRating) item.ageRating = naverData.ageRating;
            if (naverData.subGenre) item.subGenre = naverData.subGenre;
            if (naverData.productionCountry) item.productionCountry = naverData.productionCountry;
            if (naverData.runningTime) item.runningTime = naverData.runningTime;

            // ID and default fields already assigned during filtering


        } catch (e) {
            // Log error silently or to file? For now just continue
        }
    }

    progressBar.stop();

    await browser.close();

    // Save
    // Save with Cumulative Merge (Keep history)
    let finalData = filteredItems;

    if (existingData && existingData.length > 0) {
        const idMap = new Map<string, any>();

        // 1. Add existing (history)
        existingData.forEach(item => {
            if (item.id) idMap.set(item.id, item);
        });

        // 2. Overwrite/Add new filtered items
        filteredItems.forEach(item => {
            if (item.id) idMap.set(item.id, item);
        });

        finalData = Array.from(idMap.values());
    }

    // Sort by Date (Descending) for "Newest First" view
    finalData.sort((a, b) => {
        if (a.date > b.date) return -1;
        if (a.date < b.date) return 1;
        return 0;
    });

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalData, null, 2));
    console.log(`Saved ${finalData.length} items to ${OUTPUT_FILE} (Cumulative)`);
}

scrapeHybrid();
