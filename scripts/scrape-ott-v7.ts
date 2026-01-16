
import { firefox } from 'playwright';
import fs from 'fs';
import path from 'path';
import cliProgress from 'cli-progress';
import pLimit from 'p-limit';

// --- CONFIG ---
// Filtered to: Netflix(nfx), Disney+(dnp), Wavve(wav), TVING(tva), Watcha(wac), Coupang(cpq)
const JW_URL = 'https://www.justwatch.com/kr/new?providers=nfx,dnp,wav,tva,wac,cpq';
const OUTPUT_FILE = path.resolve(process.cwd(), 'src/data/ott.json');

// Platforms
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

// --- HELPER: Normalize ---
const cleanText = (s: string) => s.replace(/\s+/g, ' ').trim();
const sanitizeRuntime = (s: string) => {
    if (!s) return null;
    const num = parseInt(s.replace(/[^0-9]/g, ''));
    // If > 400 minutes, likely invalid or season sum.
    if (!isNaN(num) && num > 400) return null;
    return s;
};

// --- TIER 2: TMDB SCRAPER (Reused) ---
async function fetchTMDBData(page: any, title: string) {
    try {
        const searchUrl = `https://www.themoviedb.org/search?query=${encodeURIComponent(title)}`;
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 5000 });

        const firstResult = await page.$('.card.v4.tight a.result');
        if (!firstResult) return null;

        const detailUrl = await firstResult.getAttribute('href');
        await page.goto(`https://www.themoviedb.org${detailUrl}`, { waitUntil: 'domcontentloaded', timeout: 5000 });

        return await page.evaluate(() => {
            const res: any = {};
            // Poster
            const img = document.querySelector('div.image_content img.poster');
            if (img) {
                const src = img.getAttribute('src');
                if (src) {
                    res.poster = src.startsWith('http') ? src : `https://www.themoviedb.org${src}`;
                }
            }
            // Runtime (Try multiple selectors)
            const runtimeEl = document.querySelector('.facts .runtime, .runtime');
            if (runtimeEl) res.runningTime = runtimeEl.textContent?.trim();
            // Genre
            const genres = Array.from(document.querySelectorAll('.facts .genres a')).map(a => a.textContent?.trim());
            if (genres.length > 0) res.subGenre = genres.join(', ');

            return res;
        });
    } catch (e) {
        return null;
    }
}

// --- TIER 3: JW DETAIL SCRAPER (Fallback) ---
async function fetchJWDetail(page: any, url: string) {
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 8000 });

        return await page.evaluate(() => {
            const res: any = {};

            // Hero Details (Rating, Runtime)
            const hero = document.querySelector('#title-detail-hero-details');
            if (hero) {
                const text = hero.textContent || '';
                // Age Rating (Simple regex for common KR ratings)
                if (text.includes('19')) res.ageRating = '19세 이상 관람가';
                else if (text.includes('15')) res.ageRating = '15세 이상 관람가';
                else if (text.includes('12')) res.ageRating = '12세 이상 관람가';
                else if (text.includes('전체')) res.ageRating = '전체 관람가';

                // Runtime
                const runtimeMatch = text.match(/(\d+시간\s*\d+분|\d+분)/);
                if (runtimeMatch) res.runningTime = runtimeMatch[1];
            }

            // Sidebar Poster (Multiple fallback selectors)
            // User confirmed poster exists at: .title-sidebar__title-with-poster__poster picture img
            const posterSelectors = [
                '.title-sidebar__title-with-poster__poster picture img',
                '.title-sidebar__title-with-poster__poster img',
                '.title-sidebar picture img',
                '.title-poster img',
                '.title-hero img'
            ];
            for (const sel of posterSelectors) {
                const posterEl = document.querySelector(sel);
                if (posterEl) {
                    let posterSrc = posterEl.getAttribute('src') || posterEl.getAttribute('data-src');
                    if (posterSrc && posterSrc.includes('justwatch.com')) {
                        posterSrc = posterSrc.replace('/s166/', '/s592/').replace('/s276/', '/s592/');
                        res.sidebarPoster = posterSrc;
                        posterSrc = posterSrc.replace('/s166/', '/s592/').replace('/s276/', '/s592/');
                        res.sidebarPoster = posterSrc;
                        break;
                    }
                }
            }

            // Fallback: Check .title-sidebar__title-with-poster__poster (User reported layout)
            if (!res.sidebarPoster) {
                const specialPoster = document.querySelector('.title-sidebar__title-with-poster__poster img');
                if (specialPoster) {
                    let src = specialPoster.getAttribute('src') || specialPoster.getAttribute('data-src');
                    if (src && !src.startsWith('data:image')) {
                        res.sidebarPoster = src.replace('/s166/', '/s592/').replace('/s276/', '/s592/');
                    }
                }
            }

            // Sidebar (Director, Genre, Runtime, Country)
            // Look in ALL poster-detail sections (above and below)
            // Supports both .detail-infos and .poster-detail-infos
            document.querySelectorAll('.poster-detail > div, .detail-infos, .poster-detail-infos').forEach(row => {
                const label = row.querySelector('[class$="infos__subheading"]')?.textContent?.trim();
                const value = row.querySelector('[class$="infos__value"]')?.textContent?.trim();
                if (label && value) {
                    if (label.includes('감독') || label.toLowerCase().includes('director')) res.director = value;
                    if (label.includes('장르') || label.toLowerCase().includes('genre')) res.subGenre = value;
                    if (label.includes('재생시간') || label.toLowerCase().includes('runtime')) {
                        const rt = value.match(/(\d+시간\s*\d+분|\d+분|\d+h\s*\d+m|\d+min)/);
                        if (rt) res.runningTime = rt[0];
                    }
                    if (label.includes('제작국가') || label.toLowerCase().includes('production country')) res.productionCountry = value;
                }
            });

            // Fallback for Metadata (hidden in other structures)
            if (!res.director) {
                // Try looking for div with specific text content if label structure fails
            }

            // Cast Names with JustWatch Search Links
            // JustWatch KR generates search URLs like: /kr/검색?q=Nam%20Ji-hyun
            const castItems = document.querySelectorAll('.title-credits__actor, .title-credits .title-credit');
            const castWithLinks: { name: string; link: string }[] = [];
            castItems.forEach((item, idx) => {
                if (idx >= 5) return; // Max 5 cast members
                const nameEl = item.querySelector('span.title-credit-name, .title-credit-name');
                if (nameEl) {
                    const name = nameEl.textContent?.trim() || '';
                    if (name) {
                        castWithLinks.push({
                            name,
                            link: `https://www.justwatch.com/kr/검색?q=${encodeURIComponent(name)}`
                        });
                    }
                }
            });
            if (castWithLinks.length > 0) {
                res.castWithLinks = castWithLinks;
                res.cast = castWithLinks.map(c => c.name);
            }


            return res;
        });
    } catch (e) {
        return null;
    }
}


// --- MAIN ---
(async () => {
    console.log('Starting OTT Scraper V7 (JustWatch-First Hybrid)...');

    // Resume Logic
    let existingData: any[] = [];
    if (fs.existsSync(OUTPUT_FILE)) {
        try { existingData = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8')); } catch (e) { }
    }
    console.log(`Loaded ${existingData.length} existing items.`);

    const browser = await firefox.launch({ headless: true });

    // 1. List Scraping
    const context = await browser.newContext();
    const page = await context.newPage();

    // URL Update: Netflix(nfx), Disney+(dnp), Wavve(wav) ONLY
    const JW_URL = 'https://www.justwatch.com/kr/new?providers=nfx,dnp,wav';

    await page.goto(JW_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Scroll until date < 2025-12-01
    // Target Date: 2025-12-01
    const targetDate = new Date('2025-12-01');
    let reachedTarget = false;
    let maxScrolls = 200; // Increased max scrolls to reach far back
    let scrollCount = 0;

    console.log('Scrolling to find content from 2025-12-01...');

    while (!reachedTarget && scrollCount < maxScrolls) {
        await page.mouse.wheel(0, 3000); // Faster scroll
        await page.waitForTimeout(800);
        scrollCount++;

        if (scrollCount % 5 === 0) {
            // Check last date periodically
            const dates = await page.evaluate(() => {
                const frames = Array.from(document.querySelectorAll('.timeline__timeframe'));
                return frames.map(f => {
                    // Try to get date string
                    const match = f.className.match(/(\d{4}-\d{2}-\d{2})/);
                    return match ? match[1] : null;
                }).filter(Boolean);
            });

            if (dates.length > 0) {
                const lastDateStr = dates[dates.length - 1]; // Oldest loaded
                if (lastDateStr) {
                    const lastDate = new Date(lastDateStr);
                    console.log(`[Scroll ${scrollCount}] Current Oldest: ${lastDateStr}`);
                    if (lastDate < targetDate) {
                        reachedTarget = true;
                        console.log('Reached target date!');
                    }
                }
            }
        }
    }

    const scannedItems = await page.evaluate(() => {
        const list: any[] = [];
        const timeframes = document.querySelectorAll('.timeline__timeframe');

        timeframes.forEach(frame => {
            // Date
            let dateStr = '';
            // Try user selector first: span > span > span inside frame?
            // Actually usually timeframe has a date header.
            // .timeline__date-header span ? 
            // In JW new, it's often in the class name or a header.
            // Let's use the robust class extraction used in debug script
            if (frame.className.match(/(\d{4}-\d{2}-\d{2})/)) {
                dateStr = frame.className.match(/(\d{4}-\d{2}-\d{2})/)?.[1] || '';
            } else {
                // Fallback: try text
                const textSpan = frame.querySelector('span > span > span');
                if (textSpan) {
                    // "오늘", "어제" needs mapping.
                    const t = textSpan.textContent?.trim();
                    const today = new Date();
                    if (t === '오늘') dateStr = today.toISOString().split('T')[0];
                    else if (t === '어제') {
                        const y = new Date(today); y.setDate(y.getDate() - 1);
                        dateStr = y.toISOString().split('T')[0];
                    }
                }
            }
            if (!dateStr) return; // Skip if no date

            frame.querySelectorAll('.timeline__provider-block').forEach(block => {
                // Provider
                const icon = block.querySelector('.provider-timeline img');
                const providerName = icon ? (icon.getAttribute('alt') || icon.getAttribute('title')) : '';
                if (!providerName) return;

                block.querySelectorAll('.horizontal-title-list__item').forEach(item => {
                    const a = item.querySelector('a');
                    const img = item.querySelector('img');
                    const title = img?.getAttribute('alt') || a?.textContent?.trim();
                    const link = a?.getAttribute('href');
                    let poster = img?.getAttribute('data-src') || img?.getAttribute('src') || '';
                    // 2024-01-16 Fix: Ignore placeholder data URIs
                    if (poster.startsWith('data:image')) poster = '';

                    // Force High Res
                    if (poster) poster = poster.replace('/s166/', '/s592/');

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

    console.log(`Scanned ${scannedItems.length} raw items.`);

    // 2. Aggregate & ID Assignment
    const aggregated: Record<string, any> = {};
    for (const it of scannedItems) {
        const key = it.title + '|' + it.date;
        if (!aggregated[key]) {
            aggregated[key] = {
                ...it,
                platforms: [],
                genre: 'ott',
                venue: 'OTT',
                region: 'ott',
                // Generate ID
                id: `ott_${it.date.replace(/-/g, '')}_${it.title.replace(/\s+/g, '').replace(/[^\w\uAC00-\uD7A3]/g, '')}`
            };
        }
        // Map Platform
        const match = ALLOWLIST.find(p => it.platform.includes(p));
        if (match) {
            const code = PLATFORM_MAP[match];
            if (!aggregated[key].platforms.includes(code)) {
                aggregated[key].platforms.push(code);
            }
        }
    }

    // MERGE: Existing Items + New Scanned Items (Deduplicate by ID)
    const mergedMap = new Map<string, any>();

    // 1. Add Existing
    existingData.forEach(e => mergedMap.set(e.id, e));

    // 2. Overwrite/Add New
    Object.values(aggregated).filter(i => i.platforms.length > 0).forEach(newItem => {
        // If exists, merged properties? 
        // We generally trust the NEW scan for 'platforms' but trust OLD enrichment for metadata.
        // Actually, we want to KEEP the enriched data if it exists.
        if (mergedMap.has(newItem.id)) {
            const old = mergedMap.get(newItem.id);
            // Update platforms, date, link if changed?
            // Keep old metadata (director, cast, etc)
            mergedMap.set(newItem.id, { ...newItem, ...old, platforms: newItem.platforms }); // Prefer new platform list? or merge?
            // Actually, keep old enriched data primarily.
            const merged = { ...newItem, ...old };
            if (newItem.poster && newItem.poster.includes('/s592/') && old.poster && old.poster.includes('/s166/')) {
                merged.poster = newItem.poster;
                if (merged.image === old.poster) merged.image = newItem.poster;
            }
            // Fix: Purge corrupted images
            if (merged.image && (merged.image.includes('themoviedb.orghttps') || merged.image.startsWith('data:image'))) {
                merged.image = null;
                merged.poster = null;
            }
            mergedMap.set(newItem.id, merged);
        } else {
            mergedMap.set(newItem.id, newItem);
        }
    });

    const finalItems = Array.from(mergedMap.values()).sort((a, b) => b.date.localeCompare(a.date)); // Sort by date desc
    console.log(`Merged Total: ${finalItems.length} items (Existing: ${existingData.length}, Valid New: ${Object.values(aggregated).length}).`);

    // 3. Enrichment Loop (Concurrent)
    const limit = pLimit(5); // 5 concurrent pages
    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progressBar.start(finalItems.length, 0);

    let processedCount = 0;

    const tasks = finalItems.map(item => limit(async () => {
        const pageContext = await browser.newContext();
        const page = await pageContext.newPage();

        try {
            // Fix: Purge corrupted images (Double URL or Data URI)
            if (item.image && (item.image.includes('themoviedb.orghttps') || item.image.startsWith('data:image'))) {
                item.image = null;
                item.poster = null;
            }

            // Resume Check
            const cached = existingData.find(e => e.id === item.id);
            if (cached) {
                const validRuntime = cached.runningTime ? sanitizeRuntime(cached.runningTime) : null;
                const isBadRuntime = cached.runningTime && !validRuntime;
                const hasCastWithLinks = cached.castWithLinks && cached.castWithLinks.length > 0;

                // Optimization: If cached data is perfect, skip costly scraping
                if (!isBadRuntime && hasCastWithLinks && cached.image && !cached.image.startsWith('data:image') && cached.director) {
                    Object.assign(item, cached);
                    // Just perform basic filter check later
                    // But still need to close page and return
                } else {
                    // Partial copy
                    Object.assign(item, cached);
                    if (isBadRuntime) item.runningTime = undefined;
                }
            }

            // Only scrape if missing key data
            const missingData = !item.image || !item.runningTime || !item.director || !item.cast || !item.castWithLinks;

            if (missingData) {
                // TIER 1: Naver (Simplified - skip if full data unnecessary or too slow, but user likes it)
                // Let's rely on TMDB/JustWatch primarily for speed unless minimal info
            }

            // TIER 2: TMDB
            if (!item.image || !item.runningTime) {
                const tmdb = await fetchTMDBData(page, item.title);
                if (tmdb) {
                    if (tmdb.poster && !item.image) item.image = tmdb.poster;
                    if (tmdb.runningTime && !item.runningTime) item.runningTime = sanitizeRuntime(tmdb.runningTime);
                    if (tmdb.subGenre && !item.subGenre) item.subGenre = tmdb.subGenre;
                }
            }

            // TIER 3: JW DETAIL
            if (!item.image || !item.runningTime || !item.director || !item.cast || !item.castWithLinks) {
                const jwData = await fetchJWDetail(page, item.link);
                if (jwData) {
                    if (jwData.ageRating && !item.ageRating) item.ageRating = jwData.ageRating;
                    if (jwData.runningTime && !item.runningTime) item.runningTime = sanitizeRuntime(jwData.runningTime);
                    if (jwData.director && !item.director) item.director = jwData.director;
                    if (jwData.castWithLinks && !item.castWithLinks) item.castWithLinks = jwData.castWithLinks;
                    if (jwData.cast && !item.cast) item.cast = jwData.cast;
                    if (jwData.subGenre && !item.subGenre) item.subGenre = jwData.subGenre;
                    if (jwData.sidebarPoster && !item.image) item.image = jwData.sidebarPoster;
                    if (jwData.productionCountry && !item.productionCountry) item.productionCountry = jwData.productionCountry;
                }
            }

            // Final fallback
            if (!item.image) item.image = item.poster;

            // FILTERING LOGIC (User Request)
            // 1. Exclude India, Turkey, Thailand
            const blockedCountries = ['인도', '터키', '태국', 'India', 'Turkey', 'Thailand', 'Indian', 'Turkish', 'Thai'];
            // Check Country
            if (item.productionCountry && blockedCountries.some(c => item.productionCountry.includes(c))) {
                (item as any)._exclude = true;
            }
            // Fallback: Check Title (for cases where country is missing)
            if (blockedCountries.some(b => item.title.toLowerCase().includes(b.toLowerCase()))) {
                (item as any)._exclude = true;
            }

            // 2. Exclude China + Show
            if (item.productionCountry && (item.productionCountry.includes('중국') || item.productionCountry.includes('China'))) {
                const isMovie = item.runningTime && item.runningTime.match(/\d+분/) && parseInt(item.runningTime.replace(/\D/g, '')) < 240;
                const hasSeason = item.title.includes('시즌') || item.title.includes('Season');
                if (!isMovie || hasSeason) {
                    (item as any)._exclude = true;
                }
            }

        } catch (e) {
            console.error(`Error processing ${item.title}:`, e);
        } finally {
            await page.close();
            await pageContext.close();
            processedCount++;
            progressBar.update(processedCount);

            // Increment Save
            if (processedCount % 20 === 0) {
                const validItems = finalItems.filter(i => !(i as any)._exclude);
                fs.writeFileSync(OUTPUT_FILE, JSON.stringify(validItems, null, 2));
            }
        }
    }));

    await Promise.all(tasks);
    progressBar.stop();
    await browser.close();

    const finalValidItems = finalItems.filter(i => !(i as any)._exclude);
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalValidItems, null, 2));
    console.log(`Done. Saved ${finalValidItems.length} items (Filtered from ${finalItems.length}).`);
})();
