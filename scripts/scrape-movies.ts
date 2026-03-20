import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { processImage } from './utils/image-processor';
import axios from 'axios';
import cliProgress from 'cli-progress';
import { withErrorHandling } from './utils/scraper-utils';

// API Keys
const KOBIS_API_KEY = process.env.KOBIS_API_KEY || '';
const TMDB_API_KEY = process.env.TMDB_API_KEY || '';

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

function getLastDayOfMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
}

// --- Source Clients ---

async function fetchKobisBoxOffice() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0].replace(/-/g, '');
    const url = `http://www.kobis.or.kr/kobisopenapi/webservice/rest/boxoffice/searchDailyBoxOfficeList.json?key=${KOBIS_API_KEY}&targetDt=${dateStr}`;
    const res = await axios.get(url);
    return res.data.boxOfficeResult?.dailyBoxOfficeList || [];
}

async function fetchKobisUpcoming(page = 1) {
    const currentYear = new Date().getFullYear();
    const url = `http://www.kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieList.json?key=${KOBIS_API_KEY}&itemPerPage=100&prdtStartYear=${currentYear - 1}&curPage=${page}`;
    const res = await axios.get(url);
    return res.data.movieListResult?.movieList || [];
}

async function fetchKobisDetail(movieCd: string) {
    if (!movieCd) return null;
    const url = `http://www.kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieInfo.json?key=${KOBIS_API_KEY}&movieCd=${movieCd}`;
    try {
        const res = await axios.get(url);
        return res.data.movieInfoResult?.movieInfo;
    } catch (e) { return null; }
}

async function fetchTmdbData(title: string, year: string) {
    if (!TMDB_API_KEY) return null;
    try {
        const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&language=ko-KR&primary_release_year=${year.substring(0, 4)}`;
        let searchRes = await axios.get(searchUrl);
        let results = searchRes.data.results;
        
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

async function scrapeMovieChart(page: any, title: string) {
    try {
        const searchUrl = `https://m.moviechart.co.kr/rank/realtime/index/image`;
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        
        const metrics = await page.evaluate((t: string) => {
            const items = Array.from(document.querySelectorAll('.movieBox-item'));
            const match = items.find(item => {
                const itemTitle = item.querySelector('.movie-title a')?.textContent?.trim() || '';
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
    console.log('Starting Optimized Multi-Source Enrichment Scraper...');

    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

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

    const prevMonth = new Date();
    prevMonth.setMonth(prevMonth.getMonth() - 2);
    const validStartDtNum = parseInt(`${prevMonth.getFullYear()}${String(prevMonth.getMonth() + 1).padStart(2, '0')}01`);
    const validEndDtNum = openEndDtNum;

    const discoveryList: any[] = [];
    try {
        console.log('Discovery Phase: Fetching KOBIS API (Box Office + 5 pages of Upcoming)...');
        const bo = await fetchKobisBoxOffice();
        bo.slice(0, 10).forEach((m: any) => discoveryList.push({ title: m.movieNm, movieCd: m.movieCd, rank: parseInt(m.rank), dateRaw: m.openDt, type: 'boxoffice' }));
        
        for (let p = 1; p <= 5; p++) {
            const up = await fetchKobisUpcoming(p);
            up.forEach((m: any) => {
                const odt = parseInt(m.openDt || '0');
                const prdtYear = parseInt(m.prdtYear || '0');
                const isLikelyFuture = (m.prdtStatNm === '개봉예정' || m.prdtStatNm === '개봉준비') && prdtYear >= startYear;

                if (!discoveryList.find(d => d.movieCd === m.movieCd)) {
                    if ((odt >= openStartDtNum && odt <= openEndDtNum) || (odt === 0 && isLikelyFuture)) {
                        discoveryList.push({ title: m.movieNm, movieCd: m.movieCd, dateRaw: m.openDt, prdtYear: m.prdtYear, type: 'upcoming' });
                    }
                }
            });
            if (up.length < 100) break;
        }
    } catch (e: any) {
        console.error('API Discovery failed:', e.message);
    }

    const browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false' });
    const context = await browser.newContext();

    const progressBar = new cliProgress.SingleBar({
        format: '영화 정보 보강 | {bar} | {percentage}% | {value}/{total} | {movie}',
        hideCursor: true
    }, cliProgress.Presets.shades_classic);

    progressBar.start(discoveryList.length, 0, { movie: '시작' });
    const finalMovies: any[] = [];
    const CONCURRENCY = 5;
    const DIRTY_KEYWORDS = ['에로', '성인', '포르노', '섹스', '정사', '유부녀', '사모님', '정원사', '여대생', '박음', '새엄마', '여사친', '꼭지', '공략', '구멍', '젖었다', '거유', '침대', '속옷', '치마', '빨간', '비밀', '은밀한', '관음', '교사', '며느리', '시아버지', '장모', '사위', '형수', '처제', '조이는', '넣어', '만지', '벌려', '빨아', '맛본', '절륜', '섹파', '조건', '만남', '여관', '가정부', '번식', '노천탕', '도우미', '동창', '여직원', '몸매', '가슴'];

    for (let i = 0; i < discoveryList.length; i += CONCURRENCY) {
        const chunk = discoveryList.slice(i, i + CONCURRENCY);
        await Promise.all(chunk.map(async (m) => {
            progressBar.update({ movie: m.title.substring(0, 15) });
            const existing = existingMap.get(m.title);

            if (existing && existing.image && existing.cast && existing.director && 
                existing.venue !== '등급 미정' && existing.budget && existing.budgetKRW && 
                existing.reservationRate && existing.audienceCount && existing.roi && !existing.posterFallback) {
                
                const movieDt = parseInt(existing.dateRaw?.replace(/-/g, '') || '0');
                if (movieDt > 0 && (movieDt < validStartDtNum || movieDt > validEndDtNum)) {
                    progressBar.increment();
                    return;
                }
                existing.rank = m.rank;
                finalMovies.push(existing);
                progressBar.increment();
                return;
            }

            if (DIRTY_KEYWORDS.some(k => m.title.includes(k))) {
                progressBar.increment();
                return;
            }

            try {
                const searchYear = m.dateRaw || m.prdtYear || (m.type === 'manual' ? '2026' : '');
                const tmdb = await fetchTmdbData(m.title, searchYear);
                const kobisDetail = await fetchKobisDetail(m.movieCd);
                let chartData = null;
                if (m.rank || m.type === 'boxoffice' || m.type === 'megahit' || !m.dateRaw) {
                    const page = await context.newPage();
                    chartData = await scrapeMovieChart(page, m.title);
                    await page.close();
                }

                const rating = kobisDetail?.audits?.[0]?.watchGradeNm || existing?.venue || '등급 미정';
                const kobisGenres = kobisDetail?.genres?.map((g: any) => g.genreNm) || [];
                const isEroticGenre = kobisGenres.some((g: string) => g.includes('에로')) || tmdb?.adult === true;

                if (isEroticGenre) {
                    progressBar.increment();
                    return;
                }

                const finalBudget = tmdb?.budget || existing?.budget;
                const finalRevenue = tmdb?.revenue || existing?.revenue;
                let rawDate = (kobisDetail?.openDt || m.dateRaw || tmdb?.release_date?.replace(/-/g, '') || existing?.dateRaw || '').replace(/-/g, '');
                
                if (m.title.includes('오만과 편견') && (!rawDate || parseInt(rawDate) < 20260101)) rawDate = '20260311';

                if (rawDate.length === 6) {
                    const y = parseInt(rawDate.substring(0, 4));
                    const mIdx = parseInt(rawDate.substring(4, 6));
                    const lastDay = getLastDayOfMonth(y, mIdx);
                    rawDate = `${rawDate}${String(lastDay).padStart(2, '0')}`;
                }

                const item: any = {
                    id: existing?.id || `movie_${slugify(m.title)}`,
                    title: m.title,
                    date: (rawDate && rawDate.length === 8) 
                        ? `${rawDate.substring(0, 4)}.${rawDate.substring(4, 6)}.${rawDate.substring(6, 8)}.` 
                        : (rawDate && rawDate.length === 4 ? `${rawDate} 예정` : (existing?.date || m.dateRaw || '')),
                    dateRaw: rawDate,
                    region: '전국',
                    genre: 'movie',
                    subGenre: kobisGenres.join(', ') || existing?.subGenre || '영화',
                    rank: m.rank,
                    director: tmdb?.credits?.crew?.find((c: any) => c.job === 'Director')?.name || kobisDetail?.directors?.[0]?.peopleNm || existing?.director,
                    cast: tmdb?.credits?.cast?.slice(0, 10).map((c: any) => c.name) || kobisDetail?.actors?.slice(0, 10).map((a: any) => a.peopleNm) || existing?.cast,
                    venue: rating,
                    ageRating: rating,
                    runningTime: tmdb?.runtime ? `${tmdb.runtime}분` : (existing?.runningTime || (kobisDetail?.showTm ? `${kobisDetail.showTm}분` : '')),
                    budget: finalBudget,
                    revenue: finalRevenue,
                    budgetKRW: finalBudget ? Math.round(finalBudget * 1400) : existing?.budgetKRW,
                    revenueKRW: finalRevenue ? Math.round(finalRevenue * 1400) : existing?.revenueKRW,
                    synopsis: chartData?.synopsis || tmdb?.overview || existing?.synopsis,
                    reservationRate: chartData?.resRate || existing?.reservationRate,
                    audienceCount: chartData?.audience || existing?.audienceCount,
                    roi: (finalBudget && finalRevenue && finalBudget > 0) ? Math.round(((finalRevenue - finalBudget) / finalBudget) * 100) + '%' : existing?.roi,
                    lastCollected: new Date().toISOString()
                };

                const movieDtCheck = parseInt(item.dateRaw || '0');
                if (movieDtCheck > 0 && (movieDtCheck < validStartDtNum || movieDtCheck > validEndDtNum)) {
                    progressBar.increment();
                    return;
                }

                const tmdbTrailer = tmdb?.videos?.results?.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube');
                item.trailer = chartData?.trailer || (tmdbTrailer ? `https://www.youtube.com/watch?v=${tmdbTrailer.key}` : existing?.trailer);

                const tmdbPoster = tmdb?.poster_path ? `https://image.tmdb.org/t/p/original${tmdb?.poster_path}` : null;
                const posterUrl = tmdbPoster || existing?.posterUrl;
                if (posterUrl) {
                    const cleanId = m.title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9가-힣_]/g, '');
                    const localImage = await processImage(posterUrl, `movie_${cleanId}`, 'posters/movies');
                    if (localImage) { item.image = localImage; item.posterUrl = posterUrl; }
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
        }));
    }

    progressBar.stop();
    await browser.close();

    if (finalMovies.length >= 10) {
        finalMovies.sort((a, b) => {
            const rankA = a.rank || 999;
            const rankB = b.rank || 999;
            if (rankA <= 10 || rankB <= 10) { if (rankA !== rankB) return rankA - rankB; }
            return (b.dateRaw || '').localeCompare(a.dateRaw || '');
        });
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalMovies, null, 2));
        fs.copyFileSync(OUTPUT_FILE, path.resolve(process.cwd(), 'public/data/movies.json'));
        console.log(`Saved ${finalMovies.length} movies.`);
    }
}

withErrorHandling('movies', scrapeMovies);
