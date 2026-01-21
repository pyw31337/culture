import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { processImage } from './utils/image-processor.ts';

// KOBIS Daily Box Office
const KOBIS_URL = 'https://www.kobis.or.kr/kobis/business/stat/boxs/findDailyBoxOfficeList.do';
const DATA_DIR = path.join(process.cwd(), 'src', 'data');

// --- Helper: Sleep ---
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// --- Shared Metadata Extraction Logic (From scrape-ott.ts) ---
// This function runs INSIDE the browser context
const extractMetadata = () => {
    const res: any = {};
    // Unified Metadata Extraction (Header + Basic Info + Pattern Matching)
    const metadataSources = [
        ...Array.from(document.querySelectorAll('.title_area .sub_title > span, .cm_top_wrap .sub_title > span')), // Headers
        ...Array.from(document.querySelectorAll('.title_area .sub_title .txt, .title_area .sub_text .txt, .cm_top_wrap .sub_text .txt')), // Headers (new)
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

        // 1. Explicit Parsing (DT/DD)
        const dt = el.previousElementSibling?.tagName === 'DT' ? el.previousElementSibling : null;
        const label = dt?.textContent?.trim() || '';

        if (label === '등급') res.ageRating = text;
        if (label === '국가') res.productionCountry = text;
        if (label === '러닝타임') res.runningTime = text;
        if (label === '장르' || label === '개요') realGenre = text;
        if (label === '원제') res.originalTitle = text;

        // 2. Pattern Matching
        if (!res.ageRating && text.match(patterns.age)) res.ageRating = text.match(patterns.age)![0];
        if (!res.runningTime && text.match(patterns.runtime)) res.runningTime = text.match(patterns.runtime)![0];
        if (!res.productionCountry && text.match(patterns.country)) res.productionCountry = text.match(patterns.country)![0];
        if (!res.subGenre && text.match(patterns.genre) && !text.includes('관람') && !text.match(/\d/)) {
            if (patterns.genre.test(text)) res.subGenre = text;
        }
    });

    // Refine Genre
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

    // Release Date (오픈/개봉)
    const infoGroups = document.querySelectorAll('.info_group');
    infoGroups.forEach(g => {
        const dt = g.querySelector('dt');
        const dd = g.querySelector('dd');
        if (dt && dd) {
            const label = dt.textContent?.trim() || '';
            if (label === '오픈' || label === '개봉') {
                const raw = dd.textContent?.trim() || '';
                const match = raw.match(/(\d{4})\.(\d{2})\.(\d{2})/);
                if (match) res.releaseDate = `${match[1]}-${match[2]}-${match[3]}`;
            }
        }
    });

    // Cast Extraction
    const cast: string[] = [];
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

                // Director check
                if (fullText.includes('감독') || fullText.includes('연출')) {
                    if (!res.director) res.director = name;
                }
                // Cast check - if it's in the cast container, assume it's cast unless it's director
                else {
                    cast.push(name);
                }
            }
        });
    }

    if (cast.length > 0) res.cast = [...new Set(cast)].slice(0, 8);

    // Poster
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
};

// --- Scraper Class ---
async function scrapeMovies() {
    console.log('Starting KOBIS -> Naver Movie Scraper (Playwright)...');

    // Ensure data directory
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    const browser = await chromium.launch({ headless: true });

    // 1. Scrape KOBIS List
    const kobisContext = await browser.newContext();
    const kobisPage = await kobisContext.newPage();
    let movies: any[] = [];

    try {
        console.log(`Navigating to KOBIS: ${KOBIS_URL}`);
        await kobisPage.goto(KOBIS_URL, { waitUntil: 'domcontentloaded' });
        await kobisPage.waitForSelector('.rst_sch');

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

        movies = await kobisPage.evaluate(() => {
            const rows = document.querySelectorAll('#tbody_0 > tr');
            const list: any[] = [];
            rows.forEach((row, idx) => {
                if (idx >= 30) return; // Limit to 30
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
        });
        console.log(`Found ${movies.length} movies from KOBIS.`);

    } catch (e) {
        console.error('KOBIS Scraping Error:', e);
        await browser.close();
        return;
    } finally {
        await kobisPage.close();
    }

    // 2. Enrich with Naver (Sequential with context reuse)
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });

    const finalMovies: any[] = [];

    for (const m of movies) {
        console.log(`Processing: ${m.title}`);
        const page = await context.newPage();

        // Base Item
        let date = m.dateRaw || '';
        if (date.match(/^\d{4}-\d{2}-\d{2}$/)) date = date.replace(/-/g, '.') + '.';
        const id = `movie_${date.replace(/[\.\s]/g, '')}_${m.title.replace(/[\s\(\)]/g, '_')}`;

        const searchUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(`${m.title} 영화`)}`;

        const item: any = {
            id,
            title: m.title,
            date: date, // Will update with precise date if found
            region: '전국', // Default
            genre: 'movie',
            link: searchUrl // Add Link
        };

        try {
            await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

            // Initial Extraction
            let detail = await page.evaluate(extractMetadata);
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
                        const newDetail = await page.evaluate(extractMetadata);
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
                        const newDetail = await page.evaluate(extractMetadata);
                        if (newDetail.director) item.director = newDetail.director;
                        if (newDetail.cast) item.cast = newDetail.cast;
                    }
                } catch (e) { }
            }

            // Final Data Mapping
            if (item.releaseDate) item.date = item.releaseDate; // Prefer precise release date

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

            // Image Processing
            if (item.poster) {
                // Use stable filename: movie_Title
                const safeTitle = item.title.replace(/[^a-zA-Z0-9가-힣]/g, '');
                const stableFilename = `movie_${safeTitle}`;
                const localPath = await processImage(item.poster, stableFilename);
                if (localPath) item.image = localPath;
            } else {
                item.image = '';
            }

            // Cleanup internal fields
            delete item.poster;
            delete item.releaseDate;
            delete item.originalTitle; // Optional: keep if needed, but OTT scraper deletes it often
            delete item.ageRating;     // Mapped to venue

            finalMovies.push(item);
            await sleep(300);

        } catch (e) {
            console.error(`Error processing ${m.title}:`, e);
            finalMovies.push(item); // Push basic info even if failed
        } finally {
            await page.close();
        }
    }

    await browser.close();

    // Save
    fs.writeFileSync(path.join(DATA_DIR, 'movies.json'), JSON.stringify(finalMovies, null, 2));
    console.log(`Saved ${finalMovies.length} movies to movies.json`);
}

scrapeMovies();
