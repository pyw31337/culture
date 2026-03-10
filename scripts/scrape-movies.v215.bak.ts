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
        .replace(/ D-\d+/g, '') // Strip D-day suffix early
        .replace(/[^a-zA-Z0-9가-힣]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

function cleanTitle(title: string): string {
    return title.replace(/\s+D-\d+$/g, '').trim();
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
        
        // Improved genre extraction: avoid matching country names or numbers as genres
        if (!res.subGenre && text.match(patterns.genre) && !text.includes('관람') && !text.match(/\d/)) {
            const genreMatch = text.match(patterns.genre);
            if (genreMatch) {
                // If it's a concatenated string like '공포대한민국', just take the '공포' part
                res.subGenre = genreMatch[0];
            }
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

const extractKobisDetailStr = `
async (code) => {
    // Trigger popup
    if (window.mstView) {
        window.mstView('movie', code);
    } else {
        return null;
    }
    
    // Wait for popup content (Robust selector: look for visible ui-dialog)
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    let popup = document.querySelector('.ui-dialog:not([style*="display: none"])');
    let attempts = 0;
    while (!popup && attempts < 25) {
        await wait(200);
        popup = document.querySelector('.ui-dialog:not([style*="display: none"])');
        attempts++;
    }
    
    // [강화] 만약 팝업은 떴는데 이전 영화 정보가 남아있을 수 있으므로 
    // 현재 코드값과 팝업 내의 코드가 일치하는지 확인하거나 잠시 더 대기
    await wait(300);

    if (!popup) return null;

    const res = { titleEn: '', director: '', highResPoster: '', cast: [] };
    
    res.titleEn = popup.querySelector('.title_en')?.textContent?.trim() || '';
    if (!res.titleEn) {
        // Fallback: search for English title in the header area (text nodes)
        const header = popup.querySelector('.hd_mvie, .title_area');
        if (header) {
            res.titleEn = Array.from(header.childNodes)
                .filter(node => node.nodeType === 3)
                .map(node => node.textContent.trim())
                .filter(txt => /^[a-zA-Z0-9\\s:,.'.!?\\-]+$/.test(txt))
                .join(' ').trim();
        }
    }
    
    res.director = popup.querySelector('dl dd a[onclick*="mstView(\\'people\\'"]')?.textContent?.trim() || '';
    if (!res.director) {
        // Fallback: generic dl dd for director
        const staffDls = Array.from(popup.querySelectorAll('dl.staff_info, dl'));
        for (const dl of staffDls) {
            const dt = dl.querySelector('dt');
            if (dt && (dt.textContent.includes('감독') || dt.textContent.includes('연출'))) {
                res.director = dl.querySelector('dd')?.textContent?.trim() || '';
                break;
            }
        }
    }
    
    // High-res poster cleaning from thumbnail
    const imgEl = popup.querySelector('a.thumb img');
    let poster = imgEl?.src || '';
    
    // [보안/강화] 만약 추출된 이미지가 인물(people) 경로이거나, 비정상적으로 작을 경우 혹은 포스터 느낌이 아닐 경우
    // '포스터/스틸' 탭을 강제로 눌러서 극장용 포스터를 가져옵니다.
    if (poster.includes('/people/') || poster.includes('/staff/') || !poster.includes('/movie/')) {
        const tabs = Array.from(popup.querySelectorAll('.tab_type01 li a, .tab_menu li a'));
        const posterTab = tabs.find(a => a.textContent.includes('포스터') || a.textContent.includes('스틸') || a.textContent.includes('갤러리'));
        if (posterTab instanceof HTMLElement) {
            posterTab.click();
            await wait(800);
            // 갤러리 내의 첫 번째 이미지를 포스터로 간주 (보통 첫 번째가 메인 포스트)
            const galleryImg = popup.querySelector('.poster_list img, .gallery_list img, .thumb_list img');
            if (galleryImg instanceof HTMLImageElement && galleryImg.src) {
                poster = galleryImg.src;
            }
        }
    }

    if (poster.includes('thumb_x192')) {
        poster = poster.replace('thumb_x192/', '').replace('thn_', '');
    }
    res.highResPoster = poster;

    // Advanced Extraction: Look for official high-res poster link in tabs
    // KOBIS often has a "Poster/Still" tab
    const tabs = Array.from(popup.querySelectorAll('.item_tab ul li a, .tab_type01 li a'));
    const posterTab = tabs.find(a => a.textContent?.includes('포스터') || a.textContent?.includes('스틸컷'));
    if (posterTab) {
        posterTab.click();
        await wait(1000); // 갤러리 로딩 대기
        
        // [강화] 현재 팝업 내의 갤러리 리스트에서만 링크를 추출
        const posterLinks = Array.from(popup.querySelectorAll('.poster_list a[href*="/common/mast/movie/"], .gallery_list a[href*="/common/mast/movie/"]'));
        
        let bestHref = '';
        for (const link of posterLinks) {
            const href = (link instanceof HTMLAnchorElement) ? link.href : '';
            if (href && href.match(/\\d{4}\\/\\d{2}\\/[a-f0-9]{32,}\\.(jpg|png|webp|jpeg)/i)) {
                // 특정 영화 코드 폴더 내에 있는지 확인하고 싶으나 KOBIS URL 구조상 날짜 기반임.
                // 대신 'thumb'나 'thn_'이 없는 원본 우선
                if (!href.includes('thumb_') && !href.includes('thn_')) {
                    bestHref = href;
                    break;
                }
                if (!bestHref) bestHref = href;
            }
        }
        if (bestHref) res.highResPoster = bestHref;
    }

    // [강화] 추출된 포스터가 여전히 비어있거나 KOBIS 기본 No Image면 빈 값으로 리턴하여 
    // 이전 루프의 데이터가 섞이지 않도록 보장
    if (res.highResPoster.includes('noimg_') || !res.highResPoster.startsWith('http')) {
        res.highResPoster = '';
    }
    
    // Cast logic: get first 8 names
    const cast = [];
    const castEls = popup.querySelectorAll('dl.staff dd');
    castEls.forEach(el => {
        const role = el.previousElementSibling?.textContent || '';
        if (role.includes('배우') || role.includes('주연')) {
            const names = el.textContent?.split(',').map(n => n.trim()).filter(Boolean) || [];
            cast.push(...names);
        }
    });
    res.cast = cast.slice(0, 8);

    // Close popup
    const closeBtn = document.querySelector('.ui-dialog-titlebar-close');
    if (closeBtn) closeBtn.click();
    
    return res;
}
`;

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
                    if (idx >= 30) return; // Top 30 for Box Office
                    const titleLink = row.querySelector('td.tal > span.ellip.per90 > a');
                    if (titleLink) {
                        let title = titleLink.textContent?.trim() || '';
                        title = title.replace(/\s+D-\d+$/g, '').trim(); // Clean D-day suffix
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
                    // Updated selector based on subagent findings: div.list_type01 ul li
                    const items = document.querySelectorAll('div.list_type01 ul li, .item');
                    items.forEach(el => {
                        const titleEl = el.querySelector('strong.tit');
                        let title = titleEl?.getAttribute('title') || titleEl?.textContent?.trim() || '';
                        title = title.replace(/\s+D-\d+$/g, '').trim(); // Clean D-day suffix

                        // Extract movie code from onclick: mstView('movie','20250523')
                        // [강화] 인물('people')이나 스태프가 아닌 'movie' 태그가 명시된 것만 수집하도록 엄격히 필터링
                        const linkEl = el.querySelector('a.thumb, strong.tit a');
                        const onclick = linkEl?.getAttribute('onclick') || '';
                        const codeMatch = onclick.match(/mstView\s*\(\s*['"]movie['"]\s*,\s*['"](\d+)['"]\s*\)/);

                        // 만약 'movie'가 아니면 건너뜀 (인물 사진 수집 방지)
                        if (!codeMatch && onclick.includes('people')) {
                            return;
                        }

                        const movieCode = codeMatch ? codeMatch[1] : '';

                        const allSpans = Array.from(el.querySelectorAll('span, dd'));
                        let dateRaw = '';
                        for (const span of allSpans) {
                            const txt = span.textContent?.trim() || '';
                            if (/\d{4}-\d{2}-\d{2}/.test(txt)) {
                                dateRaw = txt.match(/\d{4}-\d{2}-\d{2}/)![0];
                                break;
                            }
                            if (/^\d{4}-\d{2}$/.test(txt)) {
                                const [year, month] = txt.split('-').map(Number);
                                const lastDay = new Date(year, month, 0).getDate();
                                dateRaw = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                                break;
                            }
                        }

                        const imgEl = el.querySelector('img');
                        let kobisPoster = imgEl?.getAttribute('src') || '';
                        if (kobisPoster && !kobisPoster.startsWith('http')) kobisPoster = 'https://www.kobis.or.kr' + kobisPoster;

                        if (title && title.length > 1) {
                            results.push({
                                title: title.trim(),
                                dateRaw,
                                kobisPoster: kobisPoster,
                                movieCode
                            });
                        }
                    });
                    return results;
                });
            };

            // Iterate through all months (current to December 2026)
            for (let monthIdx = 0; monthIdx < totalMonths; monthIdx++) {
                const monthLabel = await upcomingPage.evaluate(() => {
                    const yearEl = document.querySelector('.year');
                    const monthEl = document.querySelector('#currentMonth');
                    return `${yearEl?.textContent?.trim() || ''} ${monthEl?.textContent?.trim() || ''}`;
                }).catch(() => 'Unknown');

                scheduleBar.update(monthIdx + 1, { month: monthLabel.substring(0, 15), count: upcomingMovies.length });

                let pageNum = 1;
                let hasNextPage = true;
                while (hasNextPage) {
                    await sleep(2000); // Wait for AJAX

                    const pageMovies = await extractMovies();

                    // Detail Scraping: Open each movie's detail popup
                    for (const m of pageMovies) {
                        if (m.movieCode) {
                            try {
                                const detail: any = await upcomingPage.evaluate(`(${extractKobisDetailStr})("${m.movieCode}")`);

                                if (detail) {
                                    if (detail.highResPoster) m.kobisPoster = detail.highResPoster;
                                    if (detail.director) m.director = detail.director;
                                    if (detail.cast && detail.cast.length > 0) m.cast = detail.cast;
                                    if (detail.titleEn) m.titleEn = detail.titleEn;
                                }
                            } catch (e) {
                                console.warn(`Failed detail for ${m.title}: ${e}`);
                            }
                            await sleep(500);
                        }
                    }

                    upcomingMovies.push(...pageMovies);

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
                    if (pageNum > 30) break;
                }

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
                    await sleep(3000);
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
                            let title = titleEl?.textContent?.trim() || '';
                            title = title.replace(/\s+D-\d+$/g, '').trim(); // Clean D-day suffix

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
                            let title = item.querySelector('a, .tit')?.textContent?.trim() || item.textContent?.trim() || '';
                            title = title.replace(/\s+D-\d+$/g, '').trim(); // Clean D-day suffix
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
            let existing = existingMap.get(m.title);
            const hasFallbackPoster = existing?.posterFallback === true;

            // Year Mismatch detection
            const existingYear = existing?.date?.match(/\d{4}/)?.[0];
            const kobisYear = m.dateRaw?.match(/\d{4}/)?.[0];
            const yearMismatch = existingYear && kobisYear && existingYear !== kobisYear;

            if (yearMismatch && existing) {
                console.log(`[Year Mismatch] ${m.title}: Clearing old data (${existingYear} -> ${kobisYear})`);
                // Clear existing data to avoid mixing with new release
                existing = { id: existing.id, title: existing.title };
            }

            if (existing && existing.venue && existing.image && existing.cast && existing.director && !hasFallbackPoster && !yearMismatch) {
                // Skip if it has good data AND a real (non-fallback) poster AND years match.
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
        await context.addInitScript('window.__name = (f, n) => f;');

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

            // Include year and director/English title in search to avoid mismatches
            let yearSearch = '';
            if (m.dateRaw) {
                const yearMatch = m.dateRaw.match(/\d{4}/);
                if (yearMatch) yearSearch = ` ${yearMatch[0]}년`;
            }

            let extraSearch = '';
            // Only add director if it looks like a Korean name for Korean movies to avoid mismatches
            if (m.director && (m.title.match(/[가-힣]/) && m.director.match(/[가-힣]/))) {
                extraSearch += ` ${m.director}`;
            } else if (m.titleEn && m.titleEn.length > 2) {
                extraSearch += ` ${m.titleEn}`;
            }

            // Optimization for extremely long titles (like Gundam)
            let queryTitle = m.title;
            if (queryTitle.length > 25) {
                // Truncate to first meaningful part if it has - or : or (
                const cutIdx = queryTitle.search(/[-:(]/);
                if (cutIdx > 10) {
                    queryTitle = queryTitle.substring(0, cutIdx).trim();
                }
            }

            const searchUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(`${queryTitle}${yearSearch}${extraSearch} 영화`)}`;

            const item: any = {
                id,
                title: m.title,
                date: date, // Will update with precise date if found
                region: '전국', // Default
                genre: 'movie',
                rank: m.rank ? parseInt(m.rank) : undefined,
                director: m.director || undefined,
                cast: m.cast || undefined,
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

                // Poster Selection: Prioritize high-res KOBIS, then Naver, then fallbacks
                const FALLBACK_PATTERNS = [
                    'no_img_people',
                    'sstatic.naver.net/people/',
                    'static.naver.net/people/',
                    'no_img_movie',
                    'placeholder',
                    'default_image'
                ];

                const TARGET_POSTERS: Record<string, string> = {
                    "김~치!": "https://www.kobis.or.kr/common/mast/movie/2026/03/08cf3dbe09c349c29e5d38ac6c805501.jpg",
                    "열여덟 청춘": "https://www.kobis.or.kr/common/mast/movie/2026/03/215a8ae8859341fc9c01de40e6ba7f61.jpg",
                    "장수탕 선녀님": "https://www.kobis.or.kr/common/mast/movie/2026/03/1f04f7eb91c343a899881cfa5a829027.jpg",
                    "내 이름은": "https://www.kobis.or.kr/common/mast/movie/2026/01/68ed6cf505d24ee68f4d4f0a44ee0457.jpg",
                    "굿윌 헌팅": "https://www.kobis.or.kr/common/mast/movie/2026/01/170a4a8d3e234327bd7e77ae0357609a.jpg",
                    "신의악단": "https://www.kobis.or.kr/common/mast/movie/2025/11/46f981246f3442068ddcdde8e2a2ff06.jpg"
                };

                let selectedPoster = '';
                let isFallback = true;

                // 0. Priority: User-provided explicit high-res targets
                const targetKey = Object.keys(TARGET_POSTERS).find(k => item.title.includes(k) || k.includes(item.title));
                if (targetKey) {
                    selectedPoster = TARGET_POSTERS[targetKey];
                    isFallback = false;
                    console.log(`[Target Poster] Using user-provided poster for ${item.title}`);
                }
                // 1. Legitimate KOBIS high-res (explicitly mentioned by user)
                else if (m.kobisPoster && m.kobisPoster.includes('/common/mast/movie/')) {
                    selectedPoster = m.kobisPoster;
                    isFallback = false;
                    console.log(`[High-Res KOBIS] Using official poster for ${item.title}`);
                }
                // 2. Naver Poster (if not fallback)
                else if (item.poster && !FALLBACK_PATTERNS.some(p => item.poster.includes(p))) {
                    selectedPoster = item.poster;
                    isFallback = false;
                }
                // 3. KOBIS Thumbnail cleaned
                else if (m.kobisPoster) {
                    selectedPoster = m.kobisPoster;
                    isFallback = false;
                }
                // 4. Naver Fallback
                else if (item.poster) {
                    selectedPoster = item.poster;
                    isFallback = true;
                }

                if (selectedPoster) {
                    item.posterUrl = selectedPoster;
                    item.poster = selectedPoster;
                    item.backupPoster = selectedPoster;
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

            // NEW RETENTION POLICY: 
            // 1. Keep all newly scraped movies.
            // 2. Keep existing movies if their release date is in the future (today or later).
            const todayStr = new Date().toISOString().split('T')[0].replace(/-/g, '.');

            const processedTitles = new Set();

            for (const newMovie of finalMovies) {
                const existing = movieMap.get(newMovie.title);
                const merged = {
                    ...existing,
                    ...newMovie,
                    lastCollected: now
                };
                synchronizedMovies.push(merged);
                processedTitles.add(newMovie.title);
            }

            // Retention: Keep existing future movies
            for (const [title, existing] of movieMap.entries()) {
                if (processedTitles.has(title)) continue;

                // If it's a future movie, keep it even if not in current scrape
                const releaseDate = existing.date || '';
                if (releaseDate >= todayStr) {
                    console.log(`[Retaining Future Movie] ${title} (${releaseDate})`);
                    synchronizedMovies.push(existing);
                }
            }

            const allMovies = synchronizedMovies;

            // Sort: Ranked items (1-10) first, then by date descending
            allMovies.sort((a, b) => {
                const rankA = a.rank ? parseInt(a.rank) : 999;
                const rankB = b.rank ? parseInt(b.rank) : 999;

                // Both are top ranked (1-10)
                if (rankA <= 10 && rankB <= 10) return rankA - rankB;
                // Only A is top ranked
                if (rankA <= 10) return -1;
                // Only B is top ranked
                if (rankB <= 10) return 1;

                // Neither are top ranked: Sort by Release Date (date) descending
                // date format is "YYYY.MM.DD."
                const dateA = a.date || '0000.00.00.';
                const dateB = b.date || '0000.00.00.';

                if (dateA !== dateB) {
                    return dateA.localeCompare(dateB);
                }

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
