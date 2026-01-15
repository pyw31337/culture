
import { firefox } from 'playwright';
import fs from 'fs';
import path from 'path';

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

                        // Valid Poster from JW (fallback)
                        let poster = img?.getAttribute('src') || img?.getAttribute('data-src') || '';

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
        return true;
    });

    console.log(`Filtered: ${filteredItems.length} items to enrich.`);

    // 3. Enrich with Naver (Limit 50 for performance/rate-limits)
    const ENRICH_LIMIT = 50;
    let processed = 0;

    const naverPage = await context.newPage();

    for (const item of filteredItems) {
        if (processed >= ENRICH_LIMIT) break;
        processed++;

        process.stdout.write(`[${processed}/${filteredItems.length}] Enriching "${item.title}"... `);

        try {
            // Search Query: "[Title] 정보" or just "[Title]"
            // E.g. "오징어 게임 시즌2 정보"
            const query = `${item.title.replace(/\s-\s.*$/, '')} 정보`; // Remove " - Season 1" suffix for better search?
            // Actually, keeping Season info is sometimes good, sometimes bad. Naver usually understands "Season 2"

            const searchUrl = `https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(item.title + ' 정보')}`;

            await naverPage.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });

            const naverData = await naverPage.evaluate(() => {
                const res: any = {};

                // 1. Info Box (.cm_info_box) - Rating, Genre, Country, Runtime
                const infoBox = document.querySelector('.cm_info_box');
                if (infoBox) {
                    const dts = infoBox.querySelectorAll('dt');
                    dts.forEach(dt => {
                        const k = dt.textContent?.trim();
                        const v = dt.nextElementSibling?.textContent?.trim();
                        if (k === '개봉' || k === '방영') { /* Date already from JW */ }
                        if (k === '등급') res.ageRating = v;
                        if (k === '장르') res.subGenre = v;
                        if (k === '국가') res.productionCountry = v;
                        if (k === '러닝타임') res.runningTime = v;
                    });
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
                    if (txt === '출연') {
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

            // Merge Data
            if (naverData.poster) item.image = naverData.poster; // Prefer Naver High-res
            else item.image = item.poster; // Fallback to JW

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

            // Generate IDs and common fields
            item.venue = 'OTT';
            item.region = 'ott';
            item.genre = 'ott'; // Internal genre key

            // Final ID
            const dateStr = item.date ? item.date.replace(/-/g, '') : '00000000';
            const titleStr = item.title ? item.title.replace(/\s+/g, '').replace(/[^\w\uAC00-\uD7A3]/g, '') : 'unknown';
            const finalTitleStr = titleStr || Math.random().toString(36).substring(7);
            item.id = `ott_${dateStr}_${finalTitleStr}`;

            process.stdout.write('Done\n');

        } catch (e) {
            process.stdout.write('Failed (Skip)\n');
        }
    }

    await browser.close();

    // Save
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(filteredItems, null, 2));
    console.log(`Saved ${filteredItems.length} items to ${OUTPUT_FILE}`);
}

scrapeHybrid();
