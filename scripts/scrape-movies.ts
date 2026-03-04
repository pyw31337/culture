import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { processImage } from './utils/image-processor.js';
import pLimit from 'p-limit';
import axios from 'axios';
import sharp from 'sharp';
import cliProgress from 'cli-progress';

// KOBIS Daily Box Office
const KOBIS_URL = 'https://www.kobis.or.kr/kobis/business/stat/boxs/findDailyBoxOfficeList.do';
const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'movies.json');

function slugify(text: string): string {
    return text
        .replace(/[^a-zA-Z0-9가-힣]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

// --- Helper: Sleep ---
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// --- Shared Metadata Extraction Logic (From scrape-ott.ts) ---
// This function is converted to a string to bypass tsx instrumentation
const extractMetadataStr = `() => {
    const res = {};
    const metadataSources = [
        ...Array.from(document.querySelectorAll('.title_area .sub_title > span, .cm_top_wrap .sub_title > span')), 
        ...Array.from(document.querySelectorAll('.title_area .sub_title .txt, .title_area .sub_text .txt, .cm_top_wrap .sub_text .txt')), 
        ...Array.from(document.querySelectorAll('.info_group dd, .detail_info dd, .cm_content_area .info_group dd, .intro_box .intro_desc')) 
    ];

    const patterns = {
        age: /(전체\\s*관람가|전체\\s*시청가|\\d{1,2}세\\s*이상|\\d{1,2}세이상|\\d{1,2}세\\s*(?:이상)?\\s*(?:관람가|시청가)?|청소년\\s*관람불가|청불|미성년자\\s*관람불가)/,
        runtime: /(\\d{1,3}분)/,
        country: /(한국|대한민국|미국|일본|중국|영국|프랑스|독일|캐나다|스페인|이탈리아|홍콩|대만|태국)/,
        genre: /(드라마|액션|스릴러|로맨스|판타지|SF|코미디|애니메이션|범죄|모험|미스터리|가족|공포|다큐멘터리|전쟁|역사|음악|서부|느와르|멜로|애정)/
    };

    let realGenre = '';

    metadataSources.forEach(el => {
        const text = el.textContent?.trim() || '';
        if (!text) return;

        const dt = el.previousElementSibling?.tagName === 'DT' ? el.previousElementSibling : null;
        const label = dt?.textContent?.trim() || '';

        if (label === '등급') res.ageRating = text;
        if (label === '국가') res.productionCountry = text;
        if (label === '러닝타임') res.runningTime = text;
        if (label === '장르' || label === '개요') realGenre = text;
        if (label === '원제') res.originalTitle = text;

        if (!res.ageRating && text.match(patterns.age)) res.ageRating = text.match(patterns.age)[0];
        if (!res.runningTime && text.match(patterns.runtime)) res.runningTime = text.match(patterns.runtime)[0];
        if (!res.productionCountry && text.match(patterns.country)) res.productionCountry = text.match(patterns.country)[0];
        if (!res.subGenre && text.match(patterns.genre) && !text.includes('관람') && !text.match(/\\d/)) {
            if (patterns.genre.test(text)) res.subGenre = text;
        }
    });

    if (realGenre && !res.subGenre) {
        if (realGenre.includes('·')) {
            const parts = realGenre.split('·');
            const match = parts.find(p => patterns.genre.test(p.trim()));
            if (match) res.subGenre = match.trim();
            else res.subGenre = parts[0].trim();
        } else {
            const match = realGenre.match(patterns.genre);
            res.subGenre = match ? match[0] : realGenre;
        }
    }

    const infoGroups = document.querySelectorAll('.info_group');
    infoGroups.forEach(g => {
        const dt = g.querySelector('dt');
        const dd = g.querySelector('dd');
        if (dt && dd) {
            const label = dt.textContent?.trim() || '';
            if (label === '오픈' || label === '개봉') {
                const raw = dd.textContent?.trim() || '';
                const match = raw.match(/(\\d{4})\\.(\\d{2})\\.(\\d{2})/);
                if (match) res.releaseDate = \`\${match[1]}-\${match[2]}-\${match[3]}\`;
            }
        }
    });

    const cast = [];
    const allContentAreas = Array.from(document.querySelectorAll('.cm_content_area, .api_subject_bx'));
    const castContainer = allContentAreas.find(area => {
        const title = area.querySelector('h2, h3, .cm_title')?.textContent?.trim();
        return title && (title.includes('출연진') || title.includes('출연') || title.includes('제작진'));
    });

    if (castContainer) {
        castContainer.querySelectorAll('.card_item, .area_card, li, a.inner, .item').forEach(el => {
            const fullText = el.textContent?.trim() || '';
            const nameEl = el.querySelector('.name, strong span, strong, a._text');
            let name = nameEl?.textContent?.trim() || '';

            if (!name) {
                const link = el.querySelector('a:not(.area_link_box)');
                name = link?.textContent?.trim() || '';
            }

            if (name) {
                if (name.includes(' 역')) name = name.split(' 역')[0];
                if (fullText.includes('감독') || fullText.includes('연출')) {
                    if (!res.director) res.director = name;
                } else {
                    cast.push(name);
                }
            }
        });
    }

    if (cast.length > 0) res.cast = [...new Set(cast)].slice(0, 8);

    const img = document.querySelector('.detail_info a.thumb img') || document.querySelector('.cm_content_area .thumb img') || document.querySelector('.api_subject_bx .thumb img');
    if (img) {
        let src = img.getAttribute('src');
        if (src && src.includes('search.pstatic.net') && src.includes('src=')) {
            try {
                const urlObj = new URL(src, 'https://search.naver.com');
                const realSrc = urlObj.searchParams.get('src');
                if (realSrc) src = decodeURIComponent(realSrc);
            } catch (e) { }
        }
        res.poster = src;
    }

    return res;
}`;

// --- Scraper Class ---

// --- Helper: Process Image (Removed - using shared utility) ---

// --- Cleanup Logic ---
function cleanupOldMovieImages(validMovies: any[]) {
    const posterDir = path.join(process.cwd(), 'public', 'images', 'posters', 'movies');
    if (!fs.existsSync(posterDir)) return;

    console.log(`Cleaning up orphan movie images... (Valid items: ${validMovies.length})`);

    // Generate valid filenames set
    const validFilenames = new Set<string>();
    validMovies.forEach(m => {
        if (m.image && m.image.startsWith('/images/posters/movies/')) {
            validFilenames.add(path.basename(m.image));
        }
    });

    const files = fs.readdirSync(posterDir);
    let deletedCount = 0;

    files.forEach(file => {
        if (!file.endsWith('.webp')) return;
        if (!validFilenames.has(file)) {
            try {
                fs.unlinkSync(path.join(posterDir, file));
                // console.log(`Deleted orphan image: ${file}`);
                deletedCount++;
            } catch (e) {
                console.error(`Failed to delete ${file}:`, e);
            }
        }
    });
    console.log(`Cleanup complete. Deleted ${deletedCount} orphan images.`);
}


async function scrapeMovies() {
    console.log('Starting KOBIS -> Naver Movie Scraper (Stealth Playwright)...');

    // Ensure data directory
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    // ANTI-BLOCKING: Disable Automation Controls
    const browser = await chromium.launch({
        headless: process.env.HEADLESS !== 'false',
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--disable-setuid-sandbox'
        ]
    });

    try {

        // 0. Load Existing Data for Incremental Check
        const existingMap = new Map<string, any>();
        if (fs.existsSync(OUTPUT_FILE)) {
            try {
                const loaded = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
                loaded.forEach((m: any) => existingMap.set(m.title, m));
                console.log(`Loaded ${loaded.length} existing movies.`);
            } catch (e) {
                console.error('Failed to load existing movies:', e);
            }
        }

        // 1. Scrape KOBIS List
        const kobisContext = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        });
        const kobisPage = await kobisContext.newPage();
        // Stealth
        await kobisPage.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });

        let movies: any[] = [];

        try {
            console.log(`Navigating to KOBIS: ${KOBIS_URL}`);
            await kobisPage.goto(KOBIS_URL, { waitUntil: 'domcontentloaded' });
            await kobisPage.waitForSelector('.rst_sch', { timeout: 30000 });
            try {
                await kobisPage.waitForSelector('#tbody_0 > tr', { timeout: 10000 });
            } catch (e) {
                console.warn('Timeout waiting for rows, trying to proceed anyway (might be empty or slow).');
            }

            // Load More (Click twice to get 30+ items)
            const loadMoreBtn = await kobisPage.$('#btn_0');
            if (loadMoreBtn) {
                try {
                    await loadMoreBtn.click();
                    await sleep(1500);
                    const loadMoreBtn2 = await kobisPage.$('#btn_0');
                    if (loadMoreBtn2) {
                        await loadMoreBtn2.click();
                        await sleep(1500);
                    }
                } catch (e) { }
            }
            const progressBar = new cliProgress.SingleBar({
                format: 'KOBIS 수집 | {bar} | {percentage}% | {value}/{total} | {movie}',
                hideCursor: true
            }, cliProgress.Presets.shades_classic);
            progressBar.start(30, 0, { movie: '대기 중' });

            const list = await kobisPage.evaluate(`(() => {
                const rows = document.querySelectorAll('#tbody_0 > tr');
                const list = [];
                rows.forEach((row, idx) => {
                    if (idx >= 10) return; // ONLY TOP 10
                    const titleLink = row.querySelector('td.tal > span.ellip.per90 > a');
                    if (titleLink) {
                        const title = titleLink.textContent?.trim() || '';
                        const dateRaw = row.querySelector('td:nth-child(3)')?.textContent?.trim();
                        const rank = row.querySelector('td:nth-child(1)')?.textContent?.trim();
                        if (title) {
                            list.push({ title, dateRaw, rank });
                        }
                    }
                });
                return list;
            })()`);
            movies = list as any[];

            progressBar.update(movies.length, { movie: '완료' });
            progressBar.stop();

            if (movies.length === 0) {
                console.error('KOBIS returned 0 items. Creating error marker.');
                fs.writeFileSync(path.join(DATA_DIR, 'movies.error'), 'KOBIS returned 0 items. Check selector: #tbody_0 > tr');
                return;
            } else {
                // Cleanup error file if exists
                const errFile = path.join(DATA_DIR, 'movies.error');
                if (fs.existsSync(errFile)) fs.unlinkSync(errFile);
            }

            console.log(`Found ${movies.length} movies from KOBIS.`);

        } catch (e) {
            console.error('KOBIS Scraping Error:', e);
            return;
        } finally {
            await kobisPage.close();
        }

        // 1.5 Scrape KOBIS Upcoming Schedules (Full: All months × All pages)
        let upcomingMovies: any[] = [];
        try {
            console.log(`Scraping KOBIS Upcoming Schedule (Playwright interactive)...`);
            const upcomingPage = await kobisContext.newPage();
            await upcomingPage.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
            await upcomingPage.goto('https://www.kobis.or.kr/kobis/business/mast/mvie/findOpenScheduleList.do', { waitUntil: 'domcontentloaded', timeout: 30000 });
            await sleep(2000);

            const scheduleBar = new cliProgress.SingleBar({
                format: 'KOBIS 개봉예정 | {bar} | {value}/{total} 월 | {month} | 수집: {count}',
                hideCursor: true
            }, cliProgress.Presets.shades_classic);

            const currentMonth = new Date().getMonth() + 1; // 1-indexed
            const totalMonths = 12 - currentMonth + 1; // e.g., March(3) to Dec(12) = 10 months
            scheduleBar.start(totalMonths, 0, { month: '시작', count: 0 });

            // Helper: extract movies from the current page view
            const extractMovies = async (): Promise<any[]> => {
                return upcomingPage.evaluate(() => {
                    const results: any[] = [];
                    // KOBIS uses .item class for each movie card
                    const items = document.querySelectorAll('.item');
                    items.forEach(el => {
                        // Title is in strong.tit with title attribute
                        const titleEl = el.querySelector('strong.tit');
                        const title = titleEl?.getAttribute('title') || titleEl?.textContent?.trim() || '';

                        // Date: look for a span containing YYYY-MM-DD or YYYY-MM pattern
                        const allSpans = Array.from(el.querySelectorAll('span'));
                        let dateRaw = '';
                        for (const span of allSpans) {
                            const txt = span.textContent?.trim() || '';
                            // Full date: 2026-03-04
                            if (/\d{4}-\d{2}-\d{2}/.test(txt)) {
                                dateRaw = txt.trim();
                                break;
                            }
                            // Partial date: 2026-03 (no day confirmed) -> last day of month
                            if (/^\d{4}-\d{2}$/.test(txt)) {
                                const [year, month] = txt.split('-').map(Number);
                                const lastDay = new Date(year, month, 0).getDate();
                                dateRaw = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                                break;
                            }
                        }

                        if (title && dateRaw && title.length > 1) {
                            results.push({ title: title.trim(), dateRaw });
                        }
                    });
                    return results;
                });
            };

            // Iterate through all months (current to December)
            for (let monthIdx = 0; monthIdx < totalMonths; monthIdx++) {
                // Get current month label
                const monthLabel = await upcomingPage.evaluate(() => {
                    const yearEl = document.querySelector('.year');
                    const monthEl = document.querySelector('#currentMonth');
                    return `${yearEl?.textContent?.trim() || ''} ${monthEl?.textContent?.trim() || ''}`;
                }).catch(() => 'Unknown');

                scheduleBar.update(monthIdx + 1, { month: monthLabel.substring(0, 15), count: upcomingMovies.length });

                // Paginate through all pages in this month
                let pageNum = 1;
                let hasNextPage = true;
                while (hasNextPage) {
                    await sleep(1500);

                    const pageMovies = await extractMovies();
                    upcomingMovies.push(...pageMovies);

                    // Check if there's a next page using goPage() onclick pattern
                    hasNextPage = await upcomingPage.evaluate((currentPage) => {
                        const nextPageNum = currentPage + 1;
                        const pagingDiv = document.querySelector('.paging');
                        if (!pagingDiv) return false;

                        const pageLinks = pagingDiv.querySelectorAll('a');
                        for (const link of Array.from(pageLinks)) {
                            const onclick = link.getAttribute('onclick') || '';
                            if (onclick.includes(`goPage('${nextPageNum}')`)) {
                                link.click();
                                return true;
                            }
                        }
                        return false;
                    }, pageNum).catch(() => false);

                    pageNum++;
                    if (pageNum > 30) break; // Safety limit
                }

                // Navigate to next month using #nextMonth button
                if (monthIdx < totalMonths - 1) {
                    const navigated = await upcomingPage.evaluate(() => {
                        const nextBtn = document.querySelector('#nextMonth') as HTMLElement;
                        if (nextBtn) {
                            nextBtn.click();
                            return true;
                        }
                        return false;
                    }).catch(() => false);

                    if (!navigated) break;
                    await sleep(2500); // Wait for AJAX reload after month change
                }
            }

            scheduleBar.stop();
            await upcomingPage.close();

            console.log(`Found ${upcomingMovies.length} total upcoming movie entries from KOBIS.`);

            // Remove duplicates from upcoming (some might already be in box office)
            const boxOfficeTitles = new Set(movies.map(m => m.title));
            upcomingMovies = upcomingMovies.filter(um => !boxOfficeTitles.has(um.title));

            // Deduplicate upcoming movies themselves (keep earliest date)
            const uniqueUpcoming = new Map<string, any>();
            upcomingMovies.forEach(um => {
                const existing = uniqueUpcoming.get(um.title);
                if (!existing || um.dateRaw < existing.dateRaw) {
                    uniqueUpcoming.set(um.title, um);
                }
            });
            upcomingMovies = Array.from(uniqueUpcoming.values());
            console.log(`Unique upcoming movies to enrich: ${upcomingMovies.length}`);

        } catch (e) {
            console.error('KOBIS Upcoming Scraping Error:', e);
        }

        // 1.6 Supplementary: Naver Upcoming Movies
        try {
            console.log(`\nFetching supplementary upcoming movies from Naver...`);
            const naverPage = await kobisContext.newPage();
            await naverPage.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });

            // Navigate to Naver movie upcoming list
            await naverPage.goto('https://search.naver.com/search.naver?where=nexearch&query=%EA%B0%9C%EB%B4%89+%EC%98%88%EC%A0%95+%EC%98%81%ED%99%94', { waitUntil: 'domcontentloaded', timeout: 30000 });
            await sleep(3000);

            // Also try Naver Movie's dedicated upcoming page
            const naverUpcoming: any[] = [];

            // Try multiple Naver pages for upcoming movies
            const naverUrls = [
                'https://m.search.naver.com/search.naver?where=m&query=%EA%B0%9C%EB%B4%89+%EC%98%88%EC%A0%95+%EC%98%81%ED%99%94',
                'https://search.naver.com/search.naver?where=nexearch&query=2026%EB%85%84+%EA%B0%9C%EB%B4%89+%EC%98%81%ED%99%94',
                'https://search.naver.com/search.naver?where=nexearch&query=2026%EB%85%84+%EC%83%81%EB%B0%98%EA%B8%B0+%EA%B0%9C%EB%B4%89+%EC%98%81%ED%99%94',
                'https://search.naver.com/search.naver?where=nexearch&query=2026%EB%85%84+%ED%95%98%EB%B0%98%EA%B8%B0+%EA%B0%9C%EB%B4%89+%EC%98%81%ED%99%94'
            ];

            for (const url of naverUrls) {
                try {
                    await naverPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
                    await sleep(2000);

                    const pageMovies = await naverPage.evaluate(() => {
                        const results: any[] = [];
                        // Naver search results: movie cards with title and date
                        const cards = document.querySelectorAll('.card_area, .movie_item, .list_type1 li, ._item, .sc_new .card');
                        cards.forEach(card => {
                            const titleEl = card.querySelector('.title, .api_txt_lines, a.tit, .info_title a, .sub_tit');
                            const title = titleEl?.textContent?.trim() || '';

                            const dateEl = card.querySelector('.sub_info .txt, .info_txt, .etc_info, .date, .txt_area .sub');
                            const dateText = dateEl?.textContent?.trim() || card.textContent || '';

                            // Extract date patterns: YYYY.MM.DD, YYYY.MM, YYYY-MM-DD, YYYY-MM
                            const fullDate = dateText.match(/(\d{4})[.\-](\d{1,2})[.\-](\d{1,2})/);
                            const partialDate = dateText.match(/(\d{4})[.\-](\d{1,2})(?:\s|$|일|월|개봉)/);

                            let dateRaw = '';
                            if (fullDate) {
                                dateRaw = `${fullDate[1]}-${fullDate[2].padStart(2, '0')}-${fullDate[3].padStart(2, '0')}`;
                            } else if (partialDate) {
                                const year = parseInt(partialDate[1]);
                                const month = parseInt(partialDate[2]);
                                const lastDay = new Date(year, month, 0).getDate();
                                dateRaw = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                            }

                            if (title && dateRaw && title.length > 1 && dateRaw.startsWith('2026')) {
                                results.push({ title: title.trim(), dateRaw });
                            }
                        });

                        // Also try the scroll list / area for movie names
                        const scrollItems = document.querySelectorAll('.flick_bx .item, .cm_content_area .tit');
                        scrollItems.forEach(item => {
                            const title = item.querySelector('a, .tit')?.textContent?.trim() || item.textContent?.trim() || '';
                            const parent = item.closest('.flick_bx, .cm_content_area');
                            const dateText = parent?.textContent || '';
                            const dateMatch = dateText.match(/(\d{4})[.\-](\d{1,2})[.\-](\d{1,2})/);
                            const partialMatch = dateText.match(/(\d{4})[.\-](\d{1,2})(?:\s|$)/);
                            let dateRaw = '';
                            if (dateMatch) {
                                dateRaw = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
                            } else if (partialMatch) {
                                const y = parseInt(partialMatch[1]);
                                const m = parseInt(partialMatch[2]);
                                const ld = new Date(y, m, 0).getDate();
                                dateRaw = `${y}-${String(m).padStart(2, '0')}-${String(ld).padStart(2, '0')}`;
                            }
                            if (title && dateRaw && title.length > 1 && dateRaw.startsWith('2026')) {
                                results.push({ title, dateRaw });
                            }
                        });

                        return results;
                    });

                    naverUpcoming.push(...pageMovies);
                } catch (e) {
                    // Continue with other URLs
                }
            }

            await naverPage.close();
            console.log(`Found ${naverUpcoming.length} movies from Naver searches.`);

            // Merge with existing upcoming (only add new ones)
            const existingTitles = new Set([
                ...movies.map(m => m.title),
                ...upcomingMovies.map(m => m.title)
            ]);

            let naverNewCount = 0;
            for (const nm of naverUpcoming) {
                if (!existingTitles.has(nm.title)) {
                    upcomingMovies.push(nm);
                    existingTitles.add(nm.title);
                    naverNewCount++;
                }
            }
            console.log(`Added ${naverNewCount} new movies from Naver (not in KOBIS).`);
        } catch (e) {
            console.error('Naver Upcoming Scraping Error:', e);
        }

        // Combine for enrichment
        const allMoviesToProcess = [...movies, ...upcomingMovies];

        // 2. Enrich with Naver (Sequential with context reuse)
        // Filter out movies that already have good data
        const moviesToEnrich: any[] = [];

        // Create Final List Order based on KOBIS rank, but populate with Existing data if available
        const finalMovies: any[] = [];

        for (const m of allMoviesToProcess) {
            const existing = existingMap.get(m.title);
            const hasFallbackPoster = existing?.posterFallback === true;
            if (existing && existing.venue && existing.image && existing.cast && existing.director && !hasFallbackPoster) {
                // Skip if it has good data AND a real (non-fallback) poster.
                if (m.rank) {
                    existing.rank = parseInt(m.rank);
                } else if (!m.rank && existing.rank) {
                    delete existing.rank;
                }
                if (m.dateRaw) existing.dateRaw = m.dateRaw;
                finalMovies.push(existing);
            } else if (hasFallbackPoster) {
                // Has fallback poster — re-enrich to check for official poster
                console.log(`[Re-check] ${m.title} has fallback poster, will re-enrich.`);
                moviesToEnrich.push(m);
            } else if (existing && m.rank) {
                existing.rank = parseInt(m.rank);
                finalMovies.push(existing);
            } else {
                // Needs enrichment
                moviesToEnrich.push(m);
            }
        }

        console.log(`Skipped ${finalMovies.length} movies (Already have data). Enriching ${moviesToEnrich.length}...`);

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        });

        const enrichBar = new cliProgress.SingleBar({
            format: '네이버 정보 보강 | {bar} | {percentage}% | 남은 시간: {eta}s | {value}/{total} | {movie}',
            hideCursor: true
        }, cliProgress.Presets.shades_classic);
        enrichBar.start(moviesToEnrich.length, 0, { movie: '시작' });

        for (const m of moviesToEnrich) {
            enrichBar.update({ movie: m.title.substring(0, 15) });
            const page = await context.newPage();
            await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });

            // Base Item
            let date = m.dateRaw || '';
            if (date.match(/^\d{4}-\d{2}-\d{2}$/)) date = date.replace(/-/g, '.') + '.';

            // Stable ID: use title-only slug (no date) so shared URLs survive re-scrapes
            // Reuse existing ID if available to avoid breaking already-shared links
            const existingForId = existingMap.get(m.title);
            const id = existingForId?.id || `movie_${slugify(m.title)}`;

            const searchUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(`${m.title} 영화`)}`;

            const item: any = {
                id,
                title: m.title,
                date: date, // Will update with precise date if found
                region: '전국', // Default
                genre: 'movie',
                rank: m.rank ? parseInt(m.rank) : undefined,
                link: searchUrl // Add Link
            };

            try {
                await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
                await sleep(500 + Math.random() * 500); // Throttling

                // Initial Extraction
                let detail: any = await page.evaluate(`(${extractMetadataStr})()`);
                Object.assign(item, detail);

                // Tab Click Fallback (Basic Info) - for Age/ReleaseDate
                if (!item.ageRating || !item.releaseDate) {
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
                            await page.waitForTimeout(1000);
                            const newDetail: any = await page.evaluate(`(${extractMetadataStr})()`);
                            if (newDetail.ageRating) item.ageRating = newDetail.ageRating;
                            if (newDetail.releaseDate) item.releaseDate = newDetail.releaseDate;
                            if (newDetail.runningTime) item.runningTime = newDetail.runningTime;
                            if (newDetail.director) item.director = newDetail.director;
                            if (newDetail.cast) item.cast = newDetail.cast;
                            if (newDetail.poster && !item.poster) item.poster = newDetail.poster;
                        }
                    } catch (e) { }
                }

                // Tab Click Fallback (Cast) - for Cast/Director
                if (!item.cast || item.cast.length === 0) {
                    try {
                        const clicked = await page.evaluate(() => {
                            const tabs = Array.from(document.querySelectorAll('a, div[role="tab"]'));
                            const t = tabs.find(el => {
                                const txt = el.textContent?.trim() || '';
                                return txt.includes('출연') || txt.includes('등장인물');
                            });
                            if (t) { (t as HTMLElement).click(); return true; }
                            return false;
                        });
                        if (clicked) {
                            await page.waitForTimeout(1000);
                            const newDetail: any = await page.evaluate(`(${extractMetadataStr})()`);
                            if (newDetail.director) item.director = newDetail.director;
                            if (newDetail.cast) item.cast = newDetail.cast;

                            // Try for poster again if missing
                            if (!item.poster) {
                                const newDetail2: any = await page.evaluate(`(\${extractMetadataStr})()`);
                                if (newDetail2.poster) item.poster = newDetail2.poster;
                            }
                        }
                    } catch (e) { }
                }

                // Final Data Mapping
                if (item.releaseDate) item.date = item.releaseDate; // Prefer precise release date

                // CRITICAL: If country is missing but it's a Top Rank movie, default to '한국'
                // if it looks like a Korean title. This prevents aggressive drama filtering.
                if (!item.productionCountry && item.title.match(/[가-힣]/)) {
                    if (item.rank && item.rank <= 5) item.productionCountry = '한국';
                }

                // Map ageRating to venue (standard convention in this project)
                if (item.ageRating) {
                    if (item.ageRating.includes('전체')) item.venue = '전체 관람가';
                    else if (item.ageRating.includes('12')) item.venue = '12세 관람가';
                    else if (item.ageRating.includes('15')) item.venue = '15세 관람가';
                    else if (item.ageRating.includes('청소년')) item.venue = '청소년 관람불가';
                    else item.venue = item.ageRating;
                } else {
                    item.venue = '등급 미정';
                }

                // Image Processing & Fallback Poster Detection
                const FALLBACK_PATTERNS = [
                    'no_img_people',
                    'sstatic.naver.net/people/',
                    'static.naver.net/people/',
                    'no_img_movie',
                    'placeholder',
                    'default_image'
                ];

                if (item.poster) {
                    const isFallback = FALLBACK_PATTERNS.some(p => item.poster.includes(p));
                    item.posterUrl = item.poster; // Preserve raw URL for future re-checks
                    item.posterFallback = isFallback;

                    if (isFallback) {
                        console.log(`[Fallback Poster] ${item.title}: ${item.poster.substring(0, 80)}...`);
                    }

                    const safeTitle = item.title.replace(/[^a-zA-Z0-9가-힣]/g, '');
                    const stableFilename = `movie_${safeTitle}`;
                    const localPath = await processImage(item.poster, stableFilename, 'posters/movies');
                    if (localPath) item.image = localPath;
                } else {
                    item.image = '';
                    item.posterFallback = true; // No poster at all = fallback
                }

                // Cleanup internal fields (keep posterUrl and posterFallback for re-check)
                delete item.poster;
                delete item.releaseDate;
                delete item.originalTitle;
                delete item.ageRating;     // Mapped to venue

                finalMovies.push(item);
                await sleep(300);

            } catch (e) {
                console.error(`Error processing ${m.title}:`, e);
                finalMovies.push(item); // Push basic info even if failed
            } finally {
                await page.close();
                enrichBar.increment();
            }
        }
        enrichBar.stop();

        await browser.close();

        // Atomic Save
        if (finalMovies.length > 0) { // 3. Merge and Save (Strict Retention Logic)
            console.log('Merging data with strict retention policy...');
            const now = new Date().toISOString();
            const movieMap = new Map<string, any>();

            // Load ALL existing data first
            if (fs.existsSync(OUTPUT_FILE)) {
                const oldData = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
                oldData.forEach((m: any) => movieMap.set(m.title, m));
            }

            // Update with NEW data
            // STRICT POLICY: Only keep movies that are currently in KOBIS Top 10 ranking OR Upcoming
            const synchronizedMovies: any[] = [];

            // finalMovies contains both cached (no enrichment needed) AND newly enriched movies
            for (const newMovie of finalMovies) {
                const existing = movieMap.get(newMovie.title);
                const merged = {
                    ...existing,
                    ...newMovie,
                    lastCollected: now
                };
                synchronizedMovies.push(merged);
            }

            const allMovies = synchronizedMovies;

            // Sort: Ranked items first, then by lastCollected descending
            allMovies.sort((a, b) => {
                if (a.rank && b.rank) return parseInt(a.rank) - parseInt(b.rank);
                if (a.rank) return -1;
                if (b.rank) return 1;
                return new Date(b.lastCollected || 0).getTime() - new Date(a.lastCollected || 0).getTime();
            });

            // Atomic Write
            const tempFile = `${OUTPUT_FILE}.tmp`;
            fs.writeFileSync(tempFile, JSON.stringify(allMovies, null, 2));
            fs.renameSync(tempFile, OUTPUT_FILE);

            console.log(`Saved ${allMovies.length} movies (merged). New/Updated: ${finalMovies.length}.`);

            // Perform Cleanup
            cleanupOldMovieImages(allMovies);

            // Copy to public/data for frontend access
            const publicFile = path.resolve(process.cwd(), 'public/data/movies.json');
            const publicDir = path.dirname(publicFile);
            if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

            fs.copyFileSync(OUTPUT_FILE, publicFile);
            console.log(`Copied to ${publicFile}`);

        } else {
            console.warn('Scraper found 0 movies. Aborting save.');
        }
    } finally {
        await browser.close();
    }
}

scrapeMovies().then(() => {
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
