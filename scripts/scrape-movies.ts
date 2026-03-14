import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { processImage } from './utils/image-processor.js';
import axios from 'axios';
import cliProgress from 'cli-progress';

// API Keys
const KOBIS_API_KEY = '1225e1bd404fa561ed37a396619860aa';
const TMDB_API_KEY = '9544743f9acc5bb30f74830ea89b2c7b';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'movies.json');

// --- Helper Functions ---

function slugify(text: string): string {
    return text
        .replace(/ D-\d+/g, '') 
        .replace(/\s+/g, '')    
        .replace(/[^a-zA-Z0-9가-힣]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// --- Source Clients ---

async function fetchKobisBoxOffice() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0].replace(/-/g, '');
    const url = `http://www.kobis.or.kr/kobisopenapi/webservice/rest/boxoffice/searchDailyBoxOfficeList.json?key=${KOBIS_API_KEY}&targetDt=${dateStr}`;
    const res = await axios.get(url);
    return res.data.boxOfficeResult?.dailyBoxOfficeList || [];
}

async function fetchKobisUpcoming() {
    // Fetch a broad list of potential upcoming movies
    const currentYear = new Date().getFullYear();
    const url = `http://www.kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieList.json?key=${KOBIS_API_KEY}&itemPerPage=500&prdtStartYear=${currentYear - 1}`;
    const res = await axios.get(url);
    return res.data.movieListResult?.movieList || [];
}

async function fetchKobisDetail(movieCd: string) {
    const url = `http://www.kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieInfo.json?key=${KOBIS_API_KEY}&movieCd=${movieCd}`;
    try {
        const res = await axios.get(url);
        return res.data.movieInfoResult?.movieInfo;
    } catch (e) { return null; }
}

async function fetchTmdbData(title: string, year: string) {
    try {
        const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&language=ko-KR&primary_release_year=${year.substring(0, 4)}`;
        let searchRes = await axios.get(searchUrl);
        let results = searchRes.data.results;
        
        // Fallback: If no results with year, try without year
        if (!results || results.length === 0) {
            const fallbackUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&language=ko-KR`;
            searchRes = await axios.get(fallbackUrl);
            results = searchRes.data.results;
        }

        if (!results || results.length === 0) return null;

        const movieId = results[0].id;
        const detailUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${TMDB_API_KEY}&language=ko-KR&append_to_response=videos,credits`;
        const detailRes = await axios.get(detailUrl);
        return detailRes.data;
    } catch (e) { return null; }
}

/**
 * MovieChart Crawler for Reservation Rate / Audience Count
 */
async function scrapeMovieChart(page: any, title: string) {
    try {
        const searchUrl = `https://m.moviechart.co.kr/rank/realtime/index/image`;
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        
        const metrics = await page.evaluate((t: string) => {
            const items = Array.from(document.querySelectorAll('.movieBox-item'));
            const match = items.find(item => {
                const itemTitle = item.querySelector('.movie-title a')?.textContent?.trim() || '';
                // Flexible match for varying title formats
                const cleanT = t.replace(/\s+/g, '');
                const cleanItemT = itemTitle.replace(/\s+/g, '');
                return cleanItemT.includes(cleanT) || cleanT.includes(cleanItemT);
            });

            if (match) {
                const detailLink = (match.querySelector('.movie-title a') as HTMLAnchorElement)?.href;
                return { detailLink };
            }
            return null;
        }, title);

        if (metrics && metrics.detailLink) {
            await page.goto(metrics.detailLink, { waitUntil: 'domcontentloaded', timeout: 20000 });
            return await page.evaluate(() => {
                const infoItems = Array.from(document.querySelectorAll('.movie_info_renew23 li'));
                let resRate = '';
                let audience = '';
                
                infoItems.forEach(li => {
                    const label = li.querySelector('dd')?.textContent?.trim() || li.querySelector('span')?.textContent?.trim() || '';
                    const value = li.querySelector('dt')?.textContent?.trim() || li.querySelector('p')?.textContent?.trim() || '';
                    if (label.includes('예매율')) resRate = value;
                    if (label.includes('관객수')) audience = value;
                });

                const synopsis = document.querySelector('.synopsis_renew23')?.textContent?.trim() || '';
                const trailer = document.querySelector('.trailer_renew23 iframe')?.getAttribute('src') || '';
                return { resRate, audience, synopsis, trailer };
            });
        }
    } catch (e) { }
    return null;
}

// --- Main Scraper ---

async function scrapeMovies() {
    console.log('Starting Multi-Source Enrichment Scraper (KOBIS + TMDB + MovieChart)...');

    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    // Load Existing Data
    const existingMap = new Map<string, any>();
    if (fs.existsSync(OUTPUT_FILE)) {
        try {
            const loaded = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
            loaded.forEach((m: any) => existingMap.set(m.title, m));
        } catch (e) { }
    }

    const now = new Date();
    const startYear = now.getFullYear();
    const startMonth = now.getMonth() + 1;
    const openStartDtNum = parseInt(`${startYear}${String(startMonth).padStart(2, '0')}01`);
    
    const endYear = startYear + 1;
    const openEndDtNum = parseInt(`${endYear}${String(startMonth).padStart(2, '0')}31`);

    console.log(`Enforcing range: ${openStartDtNum} to ${openEndDtNum}`);

    const discoveryList: any[] = [];
    try {
        console.log('Discovery Phase: Fetching KOBIS...');
        const bo = await fetchKobisBoxOffice();
        bo.slice(0, 10).forEach((m: any) => discoveryList.push({ title: m.movieNm, movieCd: m.movieCd, rank: parseInt(m.rank), dateRaw: m.openDt, type: 'boxoffice' }));
        
        const up = await fetchKobisUpcoming();
        up.forEach((m: any) => {
            if (!discoveryList.find(d => d.title === m.movieNm)) {
                // Filter upcoming movies by the requested 1-year window
                const odt = parseInt(m.openDt || '0');
                if (odt >= openStartDtNum && odt <= openEndDtNum) {
                    discoveryList.push({ title: m.movieNm, movieCd: m.movieCd, dateRaw: m.openDt, type: 'upcoming' });
                }
            }
        });
        
        // Also add existing upcoming movies if they are still within the window and not already in discovery
        Array.from(existingMap.values()).forEach((e: any) => {
            if (e.genre === 'movie' && !discoveryList.find(d => d.title === e.title)) {
                const odt = parseInt(e.dateRaw?.replace(/-/g, '') || '0');
                if (odt >= openStartDtNum && odt <= openEndDtNum) {
                    // Keep it as upcoming
                    discoveryList.push({ title: e.title, movieCd: e.movieCd, dateRaw: e.dateRaw?.replace(/-/g, ''), type: 'upcoming' });
                }
            }
        });

        console.log(`Discovered ${discoveryList.length} movies in range.`);
    } catch (e: any) {
        console.error('Discovery failed:', e.message);
        return;
    }

    const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false' });
    const context = await browser.newContext();

    const progressBar = new cliProgress.SingleBar({
        format: '영화 정보 보강 | {bar} | {percentage}% | {value}/{total} | {movie}',
        hideCursor: true
    }, cliProgress.Presets.shades_classic);

    progressBar.start(discoveryList.length, 0, { movie: '시작' });
    const finalMovies: any[] = [];
    for (const m of discoveryList) {
        progressBar.update({ movie: m.title.substring(0, 15) });
        
        const existing = existingMap.get(m.title);

        // Content Filter Configuration
        // We only filter if title contains dirty keywords or if genre is explicitly "에로"
        const DIRTY_KEYWORDS = [
            '에로', '성인', '포르노', '섹스', '정사', '유부녀', '사모님', '정원사',
            '여대생', '박음', '새엄마', '여사친', '꼭지', '공략', '구멍', '젖었다',
            '거유', '침대', '속옷', '치마', '빨간', '비밀', '은밀한', '관음', '교사',
            '며느리', '시아버지', '장모', '사위', '형수', '처제', '조이는', '넣어',
            '만지', '벌려', '빨아', '맛본', '절륜', '섹파', '조건', '만남', '여관',
            '가정부', '번식', '노천탕', '도우미', '동창', '여직원', '몸매', '가슴'
        ];
        const hasBadTitle = DIRTY_KEYWORDS.some(k => m.title.includes(k));

        if (hasBadTitle) {
            console.log(`[FILTER] Skipping bad title: ${m.title}`);
            progressBar.increment();
            continue;
        }

        // Optimization: Only skip if we have EVERYTHING (including new fields)
        // Optimization: Skip if we have ALL metrics
        if (existing && existing.image && existing.cast && existing.director && 
            existing.venue !== '등급 미정' && existing.budget && existing.budgetKRW && 
            existing.reservationRate && existing.audienceCount && existing.roi && !existing.posterFallback) {
            
            // If it's already in the data, just update rank and move on
            existing.rank = m.rank;
            finalMovies.push(existing);
            progressBar.increment();
            continue;
        }

        try {
            // A. TMDB API (Base Metadata + Global Visuals)
            const tmdb = await fetchTmdbData(m.title, m.dateRaw || '');
            
            // B. KOBIS Detail API (Official Rating)
            const kobisDetail = await fetchKobisDetail(m.movieCd);

            // C. MovieChart (Specific Metrics for Top 10 / Box Office)
            let chartData = null;
            if (m.rank || m.type === 'boxoffice' || !m.dateRaw) {
                const page = await context.newPage();
                chartData = await scrapeMovieChart(page, m.title);
                await page.close();
            }

            const rating = kobisDetail?.audits?.[0]?.watchGradeNm || existing?.venue || '등급 미정';
            const kobisGenres = kobisDetail?.genres?.map((g: any) => g.genreNm) || [];
            
            // Refined Filter: 18+ is OK unless it's "에로" genre or TMDB marks it as adult
            const isEroticGenre = kobisGenres.some((g: string) => g.includes('에로')) || 
                                DIRTY_KEYWORDS.some(k => m.title.includes(k)) ||
                                tmdb?.adult === true;

            if (isEroticGenre) {
                console.log(`[FILTER] Skipping erotic movie: ${m.title} (Genres: ${kobisGenres.join(',')}, TMDB Adult: ${tmdb?.adult})`);
                progressBar.increment();
                continue;
            }

            const finalBudget = tmdb?.budget || existing?.budget;
            const finalRevenue = tmdb?.revenue || existing?.revenue;

            const item: any = {
                id: existing?.id || `movie_${slugify(m.title)}`,
                title: m.title,
                date: (m.dateRaw && m.dateRaw.length === 8) 
                    ? `${m.dateRaw.substring(0, 4)}.${m.dateRaw.substring(4, 6)}.${m.dateRaw.substring(6, 8)}.` 
                    : (existing?.date || ''),
                dateRaw: m.dateRaw,
                region: '전국',
                genre: 'movie',
                subGenre: kobisGenres.join(', '),
                rank: m.rank,
                director: tmdb?.credits?.crew?.find((c: any) => c.job === 'Director')?.name || kobisDetail?.directors?.[0]?.peopleNm || existing?.director,
                cast: tmdb?.credits?.cast?.slice(0, 10).map((c: any) => c.name) || kobisDetail?.actors?.slice(0, 10).map((a: any) => a.peopleNm) || existing?.cast,
                venue: rating,
                ageRating: rating,
                runningTime: tmdb?.runtime ? `${tmdb.runtime}분` : (existing?.runningTime || existing?.runtime ? `${existing?.runtime || existing?.runtime}분` : ''),
                budget: finalBudget,
                revenue: finalRevenue,
                budgetKRW: finalBudget ? Math.round(finalBudget * 1400) : existing?.budgetKRW,
                revenueKRW: finalRevenue ? Math.round(finalRevenue * 1400) : existing?.revenueKRW,
                synopsis: chartData?.synopsis || tmdb?.overview || existing?.synopsis,
                reservationRate: chartData?.resRate || existing?.reservationRate,
                audienceCount: chartData?.audience || existing?.audienceCount,
                roi: (finalBudget && finalRevenue && finalBudget > 0) 
                    ? Math.round(((finalRevenue - finalBudget) / finalBudget) * 100) + '%'
                    : existing?.roi,
                lastCollected: new Date().toISOString()
            };

            // Hybrid Trailers
            const tmdbTrailer = tmdb?.videos?.results?.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube');
            item.trailer = chartData?.trailer || (tmdbTrailer ? `https://www.youtube.com/watch?v=${tmdbTrailer.key}` : existing?.trailer);

            // Poster Processing
            const tmdbPoster = tmdb?.poster_path ? `https://image.tmdb.org/t/p/original${tmdb?.poster_path}` : null;
            const posterUrl = tmdbPoster || existing?.posterUrl;
            
            if (posterUrl) {
                const cleanId = m.title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9가-힣_]/g, '');
                const localImage = await processImage(posterUrl, `movie_${cleanId}`, 'posters/movies');
                if (localImage) {
                    item.image = localImage;
                    item.posterUrl = posterUrl;
                }
            }

            if (!item.image) {
                const cleanId = m.title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9가-힣_]/g, '');
                item.image = `/images/posters/movies/movie_${cleanId}.webp`;
            }

            finalMovies.push(item);

        } catch (e: any) {
            console.error(`[Enrich Error] ${m.title}: ${e.message}`);
            if (existing) finalMovies.push(existing);
        }

        progressBar.increment();
    }

    progressBar.stop();
    await browser.close();

    // 4. Sort and Save
    if (finalMovies.length >= 20) {
        finalMovies.sort((a, b) => {
            const rankA = a.rank || 999;
            const rankB = b.rank || 999;
            if (rankA !== rankB) return rankA - rankB;
            return (b.dateRaw || '').localeCompare(a.dateRaw || '');
        });

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalMovies, null, 2));
        fs.copyFileSync(OUTPUT_FILE, path.resolve(process.cwd(), 'public/data/movies.json'));
        console.log(`Saved ${finalMovies.length} movies.`);
    }
}

scrapeMovies().then(() => process.exit(0)).catch(e => process.exit(1));
