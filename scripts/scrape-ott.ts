
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

    // 3. Enrich with Naver (Limit 100 for performance/rate-limits)
    const ENRICH_LIMIT = 100;
    let processed = 0;

    const progressBar = new cliProgress.SingleBar({
        format: 'Enriching [{bar}] {percentage}% | {value}/{total} | {title}',
        clearOnComplete: false
    }, cliProgress.Presets.shades_classic);

    const itemsToProcess = Math.min(filteredItems.length, ENRICH_LIMIT);
    progressBar.start(itemsToProcess, 0, { title: 'Starting...' });

    const naverPage = await context.newPage();

    for (const item of filteredItems) {
        if (processed > ENRICH_LIMIT) break; // Check > so we process exactly LIMIT items (processed is incremented after check in loop usually, but here structure is tricky. improved below)

        // Update Title via Progress Bar, avoid spamming stdout
        const currentTitle = item.title.length > 20 ? item.title.substring(0, 20) + '...' : item.title;
        progressBar.update(processed + 1, { title: currentTitle });

        processed++;

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
                                if (vText.includes('한국')) res.productionCountry = '한국';
                                if (vText.includes('중국')) res.productionCountry = '중국';
                                if (vText.includes('영국')) res.productionCountry = '영국';
                            }
                            if (!res.productionYear) {
                                const yearMatch = vText.match(/\d{4}/);
                                if (yearMatch) res.productionYear = yearMatch[0];
                            }
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
                                } else if (['한국', '미국', '일본', '중국', '영국', '프랑스', '독일'].some(c => part.includes(c)) && part.length < 10) {
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

            // Merge Data
            // VALIDATION: invalid images
            if (item.poster && item.poster.startsWith('data:image')) item.poster = null;
            if (naverData.poster && naverData.poster.startsWith('data:image')) naverData.poster = null;

            if (naverData.poster) item.image = naverData.poster; // Prefer Naver High-res
            else if (item.poster) item.image = item.poster; // Fallback to JW
            else item.image = null; // No valid image

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

        } catch (e) {
            // Log error silently or to file? For now just continue
        }
    }

    progressBar.stop();

    await browser.close();

    // Save
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(filteredItems, null, 2));
    console.log(`Saved ${filteredItems.length} items to ${OUTPUT_FILE}`);
}

scrapeHybrid();
