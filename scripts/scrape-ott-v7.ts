
import { firefox } from 'playwright';
import fs from 'fs';
import path from 'path';
import cliProgress from 'cli-progress';

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

    await page.goto(JW_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Scroll (Increased to 20 to catch more items like Hello Carbot)
    for (let i = 0; i < 20; i++) {
        await page.mouse.wheel(0, 1500);
        await page.waitForTimeout(1000);
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

    // 3. Enrichment Loop
    const naverPage = await context.newPage();
    const tmdbPage = await context.newPage();
    const jwPage = await context.newPage();

    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progressBar.start(finalItems.length, 0);

    let processedCount = 0;

    for (const item of finalItems) {
        processedCount++;
        progressBar.update(processedCount);

        // Fix: Purge corrupted images (Double URL or Data URI)
        if (item.image && (item.image.includes('themoviedb.orghttps') || item.image.startsWith('data:image'))) {
            item.image = null;
            item.poster = null;
        }

        // Resume Check: If we have this item in existingData with good metadata, copy it
        // Resume Check: If we have this item in existingData with good metadata, copy it
        const cached = existingData.find(e => e.id === item.id);
        if (cached) {
            // Check if cached data is "good enough"
            // Good means: Has (Director OR Runtime) AND (Image OR Poster) AND castWithLinks
            // AND Runtime is valid (< 400 mins)
            const validRuntime = cached.runningTime ? sanitizeRuntime(cached.runningTime) : null;
            const isBadRuntime = cached.runningTime && !validRuntime; // Has text but failed sanitization
            const hasCastWithLinks = cached.castWithLinks && cached.castWithLinks.length > 0;

            // Only skip if we have complete data INCLUDING castWithLinks
            // FORCE RE-SCRAPE: User requested full update for missing metadata.
            // if (!isBadRuntime && hasCastWithLinks && (cached.director || cached.runningTime) && (cached.image || cached.poster)) {
            //    Object.assign(item, cached);
            //    if (item.poster && item.poster.includes('/s166/')) {
            //        item.poster = item.poster.replace('/s166/', '/s592/');
            //    }
            //    if (!item.image && item.poster) item.image = item.poster;
            //    continue;
            // }

            // If bad runtime, keep cached data BUT reset runtime to try again
            if (isBadRuntime) {
                console.log(`[Re-Enrich] Invalid runtime detected for ${item.title}: ${cached.runningTime}`);
                Object.assign(item, cached);
                item.runningTime = undefined; // Force re-fetch
            } else {
                // Partial data, copy what we have and enrich the rest
                Object.assign(item, cached);
            }
        }

        // TIER 1: Naver (Reuse existing strategy, simplified here)
        // For brevity/soundness, let's skip Naver *Full Scraping* implementation here
        // and focus on the user's request: JW Detail Page Fallback + TMDB.
        // BUT user liked Naver data (Korean cast names).
        // I will implement a lightweight Naver Title Search here.

        // Normalize Title for Naver Search (Remove " - Season X", " - Part Y")
        // Example: "Hello Carbot - Season 11" -> "헬로카봇 시즌11" (Naver prefers no spaces or specific formats)
        // Simplest: "Hello Carbot" + "11" ? 
        // Let's try removing " - " and spaces?
        // Better: Remove " - " and keep the rest. Or just search the raw title without " - ".
        const searchTitle = item.title.replace(/\s*-\s*시즌\s*/, ' 시즌').replace(/\s*-\s*/, ' ').trim();

        try {
            await naverPage.goto(`https://search.naver.com/search.naver?query=${encodeURIComponent(searchTitle)}`, { waitUntil: 'domcontentloaded', timeout: 5000 });
            const naverData = await naverPage.evaluate(() => {
                // Info area
                const infoArea = document.querySelector('.cm_info_box');
                if (!infoArea) return null;
                const res: any = {};
                // Poster
                const img = infoArea.querySelector('.detail_info img');
                if (img) res.poster = img.getAttribute('src');
                // Details
                const details = Array.from(infoArea.querySelectorAll('.info_group'));
                details.forEach(d => {
                    const label = d.querySelector('dt')?.textContent?.trim();
                    const val = d.querySelector('dd')?.textContent?.trim();
                    if (label?.includes('감독')) res.director = val;
                    if (label?.includes('출연')) res.cast = val; // String
                    if (label?.includes('등급')) res.ageRating = val;
                    if (label?.includes('장르')) res.subGenre = val;
                    if (label?.includes('국가')) res.productionCountry = val;
                    if (label?.includes('러닝타임')) res.runningTime = val;
                });

                // Fix "79671분" bug - cap at 400 mins (6h) or check format
                if (res.runningTime) {
                    const num = parseInt(res.runningTime.replace(/[^0-9]/g, ''));
                    // If > 400, reject (likely season runtime or error)
                    if (num > 400) res.runningTime = null;
                }

                return res;
            });

            if (naverData) {
                if (naverData.poster) item.image = naverData.poster;
                if (!item.image && item.poster) item.image = item.poster; // Fallback to JW HighRes

                if (naverData.director) item.director = naverData.director;
                if (naverData.cast) item.cast = naverData.cast.split(',').map((s: string) => s.trim());
                if (naverData.ageRating) item.ageRating = naverData.ageRating;
                if (naverData.subGenre) item.subGenre = naverData.subGenre;
                if (naverData.productionCountry) item.productionCountry = naverData.productionCountry;
                if (naverData.runningTime) item.runningTime = sanitizeRuntime(naverData.runningTime);
            }
        } catch (e) { }

        // TIER 2: TMDB (If Poster/Runtime missing)
        if (!item.image || !item.runningTime) {
            const tmdb = await fetchTMDBData(tmdbPage, item.title);
            if (tmdb) {
                if (tmdb.poster && !item.image) item.image = tmdb.poster;
                if (tmdb.runningTime && !item.runningTime) item.runningTime = sanitizeRuntime(tmdb.runningTime);
                if (tmdb.subGenre && !item.subGenre) item.subGenre = tmdb.subGenre;
            }
        }

        // TIER 3: JW DETAIL (Fallback for poster, runtime, director, cast)
        if (!item.image || !item.runningTime || !item.director || !item.cast || !item.castWithLinks) {
            const jwData = await fetchJWDetail(jwPage, item.link);
            if (jwData) {
                if (jwData.ageRating && !item.ageRating) item.ageRating = jwData.ageRating;
                if (jwData.runningTime && !item.runningTime) item.runningTime = sanitizeRuntime(jwData.runningTime);
                if (jwData.director && !item.director) item.director = jwData.director;
                if (jwData.castWithLinks && !item.castWithLinks) item.castWithLinks = jwData.castWithLinks;
                if (jwData.cast && !item.cast) item.cast = jwData.cast;
                if (jwData.subGenre && !item.subGenre) item.subGenre = jwData.subGenre;
                // Use sidebar poster as fallback if no image yet
                if (jwData.sidebarPoster && !item.image) {
                    item.image = jwData.sidebarPoster;
                }
            }
        }

        // Final fallback for image
        if (!item.image) item.image = item.poster;

        // Auto Save
        if (processedCount % 5 === 0) {
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalItems, null, 2));
        }
    }

    progressBar.stop();
    await browser.close();

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalItems, null, 2));
    console.log('Done.');
})();
