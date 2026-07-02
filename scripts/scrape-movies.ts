import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { processImage } from './utils/image-processor.js';
import axios from 'axios';
import cliProgress from 'cli-progress';
import { atomicWriteJson } from './utils/scraper-utils';

// API Keys
const KOBIS_API_KEY = process.env.KOBIS_API_KEY || '1225e1bd404fa561ed37a396619860aa';
const TMDB_API_KEY = process.env.TMDB_API_KEY || '9544743f9acc5bb30f74830ea89b2c7b';

const DATA_DIR = path.join(process.cwd(), 'src', 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'movies.json');
const httpClient = axios.create({ timeout: 12000 });

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

function buildMovieDescription(params: {
    title: string;
    genreText?: string;
    dateText?: string;
    director?: string;
    cast?: string[];
}) {
    const parts: string[] = [];

    if (params.genreText) {
        parts.push(`${params.title}은 ${params.genreText} 장르 작품입니다.`);
    } else {
        parts.push(`${params.title}은 현재 상영 정보를 수집 중인 영화입니다.`);
    }

    if (params.dateText) {
        parts.push(`${params.dateText} 개봉 예정입니다.`);
    }

    if (params.director) {
        parts.push(`감독은 ${params.director}입니다.`);
    }

    if (params.cast && params.cast.length > 0) {
        parts.push(`주요 출연진은 ${params.cast.slice(0, 3).join(', ')}입니다.`);
    }

    return parts.join(' ');
}

// --- Source Clients ---

async function fetchKobisBoxOffice() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0].replace(/-/g, '');
    const url = `http://www.kobis.or.kr/kobisopenapi/webservice/rest/boxoffice/searchDailyBoxOfficeList.json?key=${KOBIS_API_KEY}&targetDt=${dateStr}`;
    const res = await httpClient.get(url);
    return res.data.boxOfficeResult?.dailyBoxOfficeList || [];
}

async function fetchKobisUpcoming(page = 1) {
    // Fetch a broad list of potential upcoming movies
    const currentYear = new Date().getFullYear();
    const url = `http://www.kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieList.json?key=${KOBIS_API_KEY}&itemPerPage=100&prdtStartYear=${currentYear - 1}&curPage=${page}`;
    const res = await httpClient.get(url);
    return res.data.movieListResult?.movieList || [];
}

async function fetchKobisDetail(movieCd: string) {
    const url = `http://www.kobis.or.kr/kobisopenapi/webservice/rest/movie/searchMovieInfo.json?key=${KOBIS_API_KEY}&movieCd=${movieCd}`;
    try {
        const res = await httpClient.get(url);
        return res.data.movieInfoResult?.movieInfo;
    } catch (e) { return null; }
}

async function fetchTmdbData(title: string, year: string) {
    try {
        const searchUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&language=ko-KR&primary_release_year=${year.substring(0, 4)}`;
        let searchRes = await httpClient.get(searchUrl);
        let results = searchRes.data.results;
        
        // Fallback: If no results with year, try without year
        if (!results || results.length === 0) {
            const fallbackUrl = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(title)}&language=ko-KR`;
            searchRes = await httpClient.get(fallbackUrl);
            results = searchRes.data.results;
        }

        if (!results || results.length === 0) return null;

        const movieId = results[0].id;
        const detailUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${TMDB_API_KEY}&language=ko-KR&append_to_response=videos,credits,images,keywords,watch/providers`;
        const detailRes = await httpClient.get(detailUrl);
        return detailRes.data;
    } catch (e) { return null; }
}

/**
 * MovieChart Crawler for Reservation Rate / Audience Count
 */
async function scrapeMovieChart(page: any, title: string) {
    // Skip if page is null or Playwright is unavailable
    if (!page) return null;
    try {
        const searchUrl = `https://m.moviechart.co.kr/rank/realtime/index/image`;
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        
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
            await page.goto(metrics.detailLink, { waitUntil: 'domcontentloaded', timeout: 15000 });
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
    } catch (e) {
        console.warn(`[WARN] MovieChart scrape failed for ${title}:`, (e as any).message);
    }
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

    // Strict Valid Range for final output (Allow current - 2 months to current + 1 year)
    const prevMonth = new Date();
    prevMonth.setMonth(prevMonth.getMonth() - 2);
    const validStartDtNum = parseInt(`${prevMonth.getFullYear()}${String(prevMonth.getMonth() + 1).padStart(2, '0')}01`);
    const validEndDtNum = openEndDtNum;

    console.log(`Enforcing discovery range: ${openStartDtNum} to ${openEndDtNum}`);
    console.log(`Strict validation range: ${validStartDtNum} to ${validEndDtNum}`);

    const discoveryList: any[] = [];
    try {
        console.log('Discovery Phase: Fetching KOBIS API (Box Office + 20 pages of Upcoming)...');
        const bo = await fetchKobisBoxOffice();
        bo.slice(0, 10).forEach((m: any) => discoveryList.push({ 
            title: m.movieNm, 
            movieCd: m.movieCd, 
            rank: parseInt(m.rank), 
            dateRaw: m.openDt, 
            audiAcc: m.audiAcc,
            type: 'boxoffice' 
        }));
        
        // Fetch 20 pages (2000 items) to ensure we reach far-future major titles like Avengers
        for (let p = 1; p <= 20; p++) {
            const up = await fetchKobisUpcoming(p);
            up.forEach((m: any) => {
                const odt = parseInt(m.openDt || '0');
                const prdtYear = parseInt(m.prdtYear || '0');
                // Include if date is in range OR if date is missing but status is upcoming for current/future year
                const isLikelyFuture = (m.prdtStatNm === '개봉예정' || m.prdtStatNm === '개봉준비') && prdtYear >= startYear;

                if (!discoveryList.find(d => d.movieCd === m.movieCd)) {
                    if ((odt >= openStartDtNum && odt <= openEndDtNum) || (odt === 0 && isLikelyFuture)) {
                        discoveryList.push({ 
                            title: m.movieNm, 
                            movieCd: m.movieCd, 
                            dateRaw: m.openDt, 
                            prdtYear: m.prdtYear,
                            type: 'upcoming' 
                        });
                    }
                }
            });
            if (up.length < 100) break; // End of results
        }
        
        // Manual Discovery for confirmed re-releases if not found in KOBIS
        const RECONFIRMED_TITLES = ['오만과 편견', '킬 빌: 더 홀 블러디 어페어'];
        for (const title of RECONFIRMED_TITLES) {
            if (!discoveryList.find(d => d.title.includes(title))) {
                console.log(`[DISCOVERY] Manually adding reconfirmed title: ${title}`);
                discoveryList.push({ title, movieCd: '', type: 'manual' });
            }
        }

        console.log(`Discovered ${discoveryList.length} movies via API.`);
    } catch (e: any) {
        console.error('API Discovery failed:', e.message);
    }

    let browser: any = null;
    let context: any = null;
    try {
        browser = await chromium.launch({ headless: process.env.HEADLESS !== 'false' });
        context = await browser.newContext();
        console.log('[INFO] Playwright launched successfully for enrichment.');
    } catch (e) {
        console.warn('[WARN] Playwright launch failed (common in sandbox). Skipping MovieChart enrichment step.');
    }

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

        // Determine if this movie needs daily real-time updates (box office ranked, or recently released within 30 days)
        const movieOpenDt = existing?.dateRaw || m.dateRaw || '';
        let isRealTimeTarget = false;

        if (m.rank && m.rank <= 10) {
            isRealTimeTarget = true;
        } else if (movieOpenDt) {
            try {
                const openDate = new Date(
                    parseInt(movieOpenDt.substring(0, 4)),
                    parseInt(movieOpenDt.substring(4, 6)) - 1,
                    parseInt(movieOpenDt.substring(6, 8) || '01')
                );
                const today = new Date();
                const diffTime = Math.abs(today.getTime() - openDate.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                // If released within last 30 days or is upcoming (future release)
                if (diffDays <= 30 || openDate.getTime() > today.getTime()) {
                    isRealTimeTarget = true;
                }
            } catch (e) {}
        }

        // Optimization: Only skip if we have EVERYTHING AND it is NOT a real-time update target (which requires fresh stats daily)
        if (!isRealTimeTarget && existing && existing.image && existing.cast && existing.director && 
            existing.venue !== '등급 미정' && existing.budget && existing.budgetKRW && 
            existing.reservationRate && existing.audienceCount && existing.roi &&
            existing.description && existing.link && !existing.posterFallback &&
            existing.platforms && existing.keywords && existing.stillImages &&
            existing.voteAverage !== undefined && existing.voteCount !== undefined && existing.popularity !== undefined) {
            
            // --- DATA VALIDITY CHECK ---
            const movieDt = parseInt(existing.dateRaw?.replace(/-/g, '') || '0');
            if (movieDt > 0 && (movieDt < validStartDtNum || movieDt > validEndDtNum)) {
                console.log(`[VALIDITY] Removing stale existing movie: ${existing.title} (${existing.date})`);
                progressBar.increment();
                continue;
            }

            // If it's already in the data and valid, just update rank and move on
            existing.rank = m.rank;
            finalMovies.push(existing);
            progressBar.increment();
            continue;
        }

        try {
            // A. TMDB API (Base Metadata + Global Visuals)
            // Use 2026 as preferred year for reconfirmation discovery
            const searchYear = m.dateRaw || m.prdtYear || (m.type === 'manual' ? '2026' : '');
            const tmdb = await fetchTmdbData(m.title, searchYear);
            
            // B. KOBIS Detail API (Official Rating)
            const kobisDetail = await fetchKobisDetail(m.movieCd);

            // C. MovieChart (Specific Metrics for Top 10 / Box Office)
            let chartData = null;
            if (m.rank || m.type === 'boxoffice' || !m.dateRaw) {
                const page = context ? await context.newPage() : null;
                chartData = await scrapeMovieChart(page, m.title);
                await page?.close();
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
            const movieSearchUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(`${m.title} 상영시간표`)}`;
            const productionCountries = tmdb?.production_countries?.map((country: any) => country.name)?.filter(Boolean);
            const productionYear = kobisDetail?.prdtYear || tmdb?.release_date?.slice(0, 4) || existing?.productionYear;
            const providers = tmdb?.['watch/providers']?.results?.KR;
            const platformNames = [
                ...(providers?.flatrate || []),
                ...(providers?.rent || []),
                ...(providers?.buy || []),
            ].map((provider: any) => provider.provider_name).filter(Boolean);
            const stillImages = (tmdb?.images?.backdrops || [])
                .slice(0, 8)
                .map((image: any) => image.file_path ? `https://image.tmdb.org/t/p/w780${image.file_path}` : '')
                .filter(Boolean);
            const keywords = (tmdb?.keywords?.keywords || [])
                .map((keyword: any) => keyword.name)
                .filter(Boolean)
                .slice(0, 12);
            
            // Refined Date Logic: Prioritize KOBIS openDt (theatrical) over TMDB (production/global)
            // If date is only YYYYMM, append the last day of that month.
            // For manual discovery like Pride and Prejudice, override with known re-release date if stale.
            let rawDate = (kobisDetail?.openDt || m.dateRaw || tmdb?.release_date?.replace(/-/g, '') || existing?.dateRaw || '').replace(/-/g, '');
            
            if (m.title.includes('오만과 편견') && (!rawDate || parseInt(rawDate) < 20260101)) {
                rawDate = '20260311'; // Confirmed re-release date
            }

            if (rawDate.length === 6) {
                const y = parseInt(rawDate.substring(0, 4));
                const mIdx = parseInt(rawDate.substring(4, 6));
                const lastDay = getLastDayOfMonth(y, mIdx);
                rawDate = `${rawDate}${String(lastDay).padStart(2, '0')}`;
            }

            const directorName = tmdb?.credits?.crew?.find((c: any) => c.job === 'Director')?.name || kobisDetail?.directors?.[0]?.peopleNm || existing?.director;
            const castNames = tmdb?.credits?.cast?.slice(0, 10).map((c: any) => c.name) || kobisDetail?.actors?.slice(0, 10).map((a: any) => a.peopleNm) || existing?.cast || [];
            const movieDescription = chartData?.synopsis
                || tmdb?.overview
                || existing?.description
                || existing?.synopsis
                || buildMovieDescription({
                    title: m.title,
                    genreText: kobisGenres.join(', ') || existing?.subGenre,
                    dateText: (rawDate && rawDate.length === 8)
                        ? `${rawDate.substring(0, 4)}년 ${rawDate.substring(4, 6)}월 ${rawDate.substring(6, 8)}일`
                        : undefined,
                    director: directorName,
                    cast: castNames
                });

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
                director: directorName,
                cast: castNames,
                venue: rating,
                ageRating: rating,
                runningTime: tmdb?.runtime ? `${tmdb.runtime}분` : (existing?.runningTime || (kobisDetail?.showTm ? `${kobisDetail.showTm}분` : '')),
                budget: finalBudget,
                revenue: finalRevenue,
                budgetKRW: finalBudget ? Math.round(finalBudget * 1400) : existing?.budgetKRW,
                revenueKRW: finalRevenue ? Math.round(finalRevenue * 1400) : existing?.revenueKRW,
                description: movieDescription,
                synopsis: chartData?.synopsis || tmdb?.overview || existing?.synopsis || movieDescription,
                link: existing?.link || movieSearchUrl,
                website: tmdb?.homepage || existing?.website,
                originalTitle: tmdb?.original_title && tmdb.original_title !== m.title ? tmdb.original_title : existing?.originalTitle,
                productionCountry: productionCountries?.join(', ') || existing?.productionCountry,
                productionYear,
                movieInfo: existing?.movieInfo,
                platforms: [...new Set(platformNames)].slice(0, 8).length > 0 ? [...new Set(platformNames)].slice(0, 8) : existing?.platforms,
                stillImages: stillImages.length > 0 ? stillImages : existing?.stillImages,
                keywords: keywords.length > 0 ? keywords : existing?.keywords,
                tagline: tmdb?.tagline || existing?.tagline,
                voteAverage: typeof tmdb?.vote_average === 'number' ? Number(tmdb.vote_average.toFixed(1)) : existing?.voteAverage,
                voteCount: tmdb?.vote_count || existing?.voteCount,
                popularity: typeof tmdb?.popularity === 'number' ? Number(tmdb.popularity.toFixed(1)) : existing?.popularity,
                reservationRate: chartData?.resRate || existing?.reservationRate,
                audienceCount: m.audiAcc 
                    ? (parseInt(m.audiAcc) > 10000 
                        ? (parseInt(m.audiAcc) / 10000).toFixed(1) + '만' 
                        : parseInt(m.audiAcc).toLocaleString())
                    : (chartData?.audience || existing?.audienceCount),
                roi: (finalBudget && finalRevenue && finalBudget > 0) 
                    ? Math.round(((finalRevenue - finalBudget) / finalBudget) * 100) + '%'
                    : existing?.roi,
                lastCollected: new Date().toISOString(),
                statsCollectedAt: new Date().toISOString()
            };

            // --- DATA VALIDITY CHECK ---
            const movieDt = parseInt(item.dateRaw || '0');
            if (movieDt > 0 && (movieDt < validStartDtNum || movieDt > validEndDtNum)) {
                console.log(`[VALIDITY] Skipping stale new movie: ${item.title} (${item.date})`);
                progressBar.increment();
                continue;
            }

            // Hybrid Trailers
            const tmdbTrailer = tmdb?.videos?.results?.find((v: any) => v.type === 'Trailer' && v.site === 'YouTube');
            item.trailer = chartData?.trailer || (tmdbTrailer ? `https://www.youtube.com/watch?v=${tmdbTrailer.key}` : existing?.trailer);

            // Poster Processing
            const tmdbPoster = tmdb?.poster_path ? `https://image.tmdb.org/t/p/original${tmdb?.poster_path}` : null;
            const posterUrl = tmdbPoster || existing?.posterUrl || existing?.backupPoster;
            
            if (posterUrl) {
                const cleanId = m.title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9가-힣_]/g, '');
                const localImage = await processImage(posterUrl, `movie_${cleanId}`, 'posters/movies');
                if (localImage) {
                    item.image = localImage;
                    item.posterUrl = posterUrl;
                    item.backupPoster = posterUrl;
                    item.posterFallback = false;
                }
            }

            if (!item.image) {
                item.image = posterUrl || existing?.image || '';
                item.posterUrl = posterUrl || existing?.posterUrl;
                item.backupPoster = posterUrl || existing?.backupPoster;
                item.posterFallback = !!posterUrl;
            }

            finalMovies.push(item);

        } catch (e: any) {
            console.error(`[Enrich Error] ${m.title}: ${e.message}`);
            if (existing) finalMovies.push(existing);
        }

        progressBar.increment();
    }

    progressBar.stop();
    await context?.close();
    await browser?.close();

    // 4. Sort and Save
    if (finalMovies.length >= 20) {
        finalMovies.sort((a, b) => {
            const rankA = a.rank || 999;
            const rankB = b.rank || 999;
            // Prioritize rank for top 10, then sort others by date DESC (recent/future first)
            if (rankA <= 10 || rankB <= 10) {
                if (rankA !== rankB) return rankA - rankB;
            }
            return (b.dateRaw || '').localeCompare(a.dateRaw || '');
        });

        atomicWriteJson(OUTPUT_FILE, finalMovies);
        fs.copyFileSync(OUTPUT_FILE, path.resolve(process.cwd(), 'public/data/movies.json'));
        console.log(`Saved ${finalMovies.length} movies.`);
    }
}

scrapeMovies().then(() => process.exit(0)).catch(e => process.exit(1));
