import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import https from 'https';

// KOBIS Daily Box Office
const SCRAPE_URL = 'https://www.kobis.or.kr/kobis/business/stat/boxs/findDailyBoxOfficeList.do';
const IMAGE_DIR = path.join(process.cwd(), 'public', 'images', 'posters', 'movies');

// Helper: Enrich with Daum
async function enrichWithDaum(page: any, title: string): Promise<any> {
    try {
        const q = `${title} 영화`;
        const daumUrl = `https://search.daum.net/search?w=tot&q=${encodeURIComponent(q)}`;
        // console.log(`   > Searching Daum: ${daumUrl}`);
        await page.goto(daumUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });

        return await page.evaluate(() => {
            const res: any = {};
            res.detailLink = document.location.href;

            // Helper to find DD based on DT text
            function getDDText(key: string) {
                const dts = Array.from(document.querySelectorAll('dt'));
                const target = dts.find(dt => dt.textContent && dt.textContent.includes(key));
                if (target && target.nextElementSibling && target.nextElementSibling.tagName === 'DD') {
                    return target.nextElementSibling;
                }
                return null;
            }

            // 1. Overview (Rating, Runtime, Genre, Country)
            // Example: "이탈리아 외 110분 15세이상관람가" or "일본 애니메이션 외 105분 전체관람가"
            const infoEl = getDDText('개요');
            if (infoEl) {
                const text = infoEl.textContent?.trim() || '';
                res.infoRaw = text;

                // Extract Rating
                if (text.includes('전체관람가')) res.ageRating = '전체관람가';
                else if (text.includes('12세')) res.ageRating = '12세이상관람가';
                else if (text.includes('15세')) res.ageRating = '15세이상관람가';
                else if (text.includes('청소년관람불가') || text.includes('19세')) res.ageRating = '청소년관람불가';

                // Extract Runtime
                const timeMatch = text.match(/(\d+)분/);
                if (timeMatch) res.runningTime = `${timeMatch[1]}분`;
            }

            // 2. Release Date
            const openEl = getDDText('개봉');
            if (openEl) {
                res.openDate = openEl.textContent?.trim();
            }

            // 3. Director
            const dirEl = getDDText('감독');
            if (dirEl) {
                res.director = dirEl.textContent?.trim();
                // Link?
                const dirLink = dirEl.querySelector('a');
                if (dirLink) {
                    // Make absolute if relative? Daum usually absolute or relative to host
                    // For now just get href
                    res.directorLink = dirLink.getAttribute('href');
                }
            }

            // 4. Cast
            const castEl = getDDText('출연');
            if (castEl) {
                res.castStr = castEl.textContent?.trim(); // "Name, Name, Name ..."
                const links = Array.from(castEl.querySelectorAll('a'));
                res.castList = links.map((a: any) => ({
                    name: a.textContent?.trim(),
                    link: a.getAttribute('href')
                })).filter((c: any) => c.name !== '더보기');
            }

            // 5. Poster (Validation/Fallback if needed, though KOBIS/Naver might be primary)
            // c-thumb usually
            const posterImg = document.querySelector('c-thumb img');
            if (posterImg) {
                res.poster = posterImg.getAttribute('src');
            } else {
                const legacyImg = document.querySelector('.thumb_img');
                if (legacyImg) res.poster = legacyImg.getAttribute('src');
            }

            return res;
        });

    } catch (e) {
        console.log(`   > Daum enrichment failed for ${title}:`, e);
        return {};
    }
}

// Helper: Download Image
async function downloadImage(url: string, filename: string): Promise<string | null> {
    if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR, { recursive: true });

    // If invalid URL, skip
    if (!url || !url.startsWith('http')) return null;

    // Force HTTPS
    if (url.startsWith('http:')) {
        url = url.replace('http:', 'https:');
    }

    // const dir = path.join(__dirname, '../public/images/posters/movies'); // Removed redundant/error-prone line
    const filepath = path.join(IMAGE_DIR, filename);


    return new Promise((resolve) => {
        const file = fs.createWriteStream(filepath);
        const request = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://search.naver.com/'
            }
        }, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve(`/images/posters/movies/${filename}`); // Return web path
                });
            } else {
                fs.unlink(filepath, () => { }); // Delete partial
                resolve(null);
            }
        });

        request.on('error', (err) => {
            fs.unlink(filepath, () => { });
            resolve(null);
        });
    });
}

// Helper: Clean old images
function cleanImages(validIds: string[]) {
    if (!fs.existsSync(IMAGE_DIR)) return;
    const files = fs.readdirSync(IMAGE_DIR);
    let deleted = 0;
    files.forEach(file => {
        // Filename format: [id].jpg (approx) or just match id in filename
        // My implementation uses `[id].jpg`
        const id = path.parse(file).name;
        if (!validIds.includes(id)) {
            try {
                fs.unlinkSync(path.join(IMAGE_DIR, file));
                deleted++;
            } catch (e) { }
        }
    });
    console.log(`[Cleanup] Deleted ${deleted} old movie posters.`);
}

async function scrapeMovies() {
    console.log('Starting KOBIS Movie Scraper (Local Images + Robust Enrichment)...');

    // Ensure Image Dir Exists
    if (!fs.existsSync(IMAGE_DIR)) fs.mkdirSync(IMAGE_DIR, { recursive: true });

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const naverPage = await browser.newPage();
    await naverPage.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    try {
        console.log(`Navigating to ${SCRAPE_URL}...`);
        await page.goto(SCRAPE_URL, { waitUntil: 'networkidle2' });
        await page.waitForSelector('.rst_sch');

        // Load More
        const loadMoreBtn = await page.$('#btn_0');
        if (loadMoreBtn) {
            try {
                await page.evaluate((btn) => (btn as HTMLElement).click(), loadMoreBtn);
                await new Promise(r => setTimeout(r, 2000));
            } catch (e) { }
        }

        // Get List
        const rows = await page.$$('#tbody_0 > tr');
        console.log(`Found ${rows.length} rows.`);

        const movies: any[] = [];
        const MAX_ITEMS = 30;

        for (let i = 0; i < Math.min(rows.length, MAX_ITEMS); i++) {
            const row = (await page.$$('#tbody_0 > tr'))[i];
            if (!row) continue;

            const titleLink = await row.$('td.tal > span.ellip.per90 > a');
            if (!titleLink) continue;

            const title = await page.evaluate(el => el.textContent?.trim(), titleLink);
            const rankText = await row.$eval('td:nth-child(1)', el => el.textContent?.trim());
            const openDateRaw = await row.$eval('td:nth-child(3)', el => el.textContent?.trim()); // Column 3 verified
            const attr = await page.evaluate(el => el.getAttribute('onclick') || el.getAttribute('href'), titleLink);

            let movieCode = '';
            if (attr) {
                const match = attr.match(/['"]([0-9]{8})['"]/);
                if (match) movieCode = match[1];
            }

            if (movieCode) {
                movies.push({ tempCode: movieCode, title, openDateRaw, rank: rankText });
            }
        }

        const finalMovies = [];
        const validIds: string[] = [];

        for (const m of movies) {
            console.log(`Processing ${m.title}...`);

            let date = m.openDateRaw || '';
            if (date.match(/^\d{4}-\d{2}-\d{2}$/)) date = date.replace(/-/g, '.') + '.';
            else if (date.match(/^\d{4}\.\d{2}\.\d{2}$/)) date = date + '.';

            // ID generation
            const id = `movie_${date.replace(/[\.\s]/g, '')}_${m.title?.replace(/[\s\(\)]/g, '_')}`;
            validIds.push(id);

            let item: any = {
                id,
                title: m.title,
                date: date,
                region: '전국',
                genre: 'movie'
            };

            // Start with placeholders
            let naverData: any = {};

            // DAUM ENRICHMENT (Priority for Details)
            let daumData: any = {};
            try {
                // Reuse naverPage or create new one? reusing naverPage for Daum is fine as we do it sequentially
                daumData = await enrichWithDaum(naverPage, m.title);
            } catch (e) {
                console.log('   > Daum enrichment error:', e);
            }

            // NAVER ENRICHMENT (Secondary/Poster)
            try {
                // console.log(`   > Searching Naver...`);
                const q = `${m.title} 영화`; // Changed query to just 'Movie' for broader hit
                await naverPage.goto(`https://search.naver.com/search.naver?query=${encodeURIComponent(q)}`, { waitUntil: 'domcontentloaded', timeout: 10000 });

                // Allow some time for hydration
                // await naverPage.waitForTimeout(500);

                naverData = await naverPage.evaluate(async () => {
                    const res: any = {};

                    // 1. MAIN VIEW EXTRACTION (Compact or Standard)
                    const infoBox = document.querySelector('.cm_info_box');
                    if (infoBox) {
                        const text = infoBox.textContent || '';

                        // Rating Badge Search (e.g. 12, 15, all)
                        const ratingBadge = infoBox.querySelector('.ico_rating_12, .ico_rating_15, .ico_rating_18, .ico_rating_all, .area_badge .badge');
                        if (ratingBadge) res.grade = ratingBadge.textContent?.trim();

                        // Director/Cast/Intro from DLs if available (Standard View)
                        const dts = Array.from(infoBox.querySelectorAll('dt'));
                        const dirDt = dts.find((dt: any) => dt.textContent?.includes('감독'));
                        if (dirDt) res.director = dirDt.nextElementSibling?.textContent?.trim();

                        const gradeDt = dts.find((dt: any) => dt.textContent?.includes('등급'));
                        if (gradeDt && !res.grade) res.grade = gradeDt.nextElementSibling?.textContent?.trim(); // Use badge if found

                        const castDt = dts.find((dt: any) => dt.textContent?.includes('출연'));
                        if (castDt) res.castStr = castDt.nextElementSibling?.textContent?.trim();

                        const introDt = dts.find((dt: any) => dt.textContent?.includes('소개') || dt.textContent?.includes('줄거리'));
                        if (introDt) res.intro = introDt.nextElementSibling?.textContent?.trim();
                    }

                    // Poster from Main View (works for both)
                    const img = document.querySelector('.detail_info a.thumb img') || document.querySelector('.cm_content_area .thumb img') || document.querySelector('.api_subject_bx .thumb img');
                    if (img) {
                        let src = img.getAttribute('src');
                        if (src) {
                            if (src.includes('search.pstatic.net') && src.includes('src=')) {
                                try {
                                    const urlObj = new URL(src, 'https://search.naver.com');
                                    const realSrc = urlObj.searchParams.get('src');
                                    if (realSrc) src = decodeURIComponent(realSrc);
                                } catch (e) { }
                            }
                            res.poster = src;
                        }
                    }

                    // 2. CHECK IF MISSING DETAILS & CLICK TAB
                    // If director is missing, it's likely a Compact view. Try clicking '출연/제작진' tab.
                    if (!res.director) {
                        const tabs = Array.from(document.querySelectorAll('.tab_list .tab, .tab_menu .tab'));
                        const castTab = tabs.find((t: any) => t.textContent.includes('출연/제작진') || t.textContent.includes('출연'));

                        if (castTab) {
                            (castTab as HTMLElement).click();
                            return { ...res, _idx: 'needs_wait' };
                        }
                    }

                    return res;
                });

                // 3. IF TAB CLICKED, WAIT & RESCRAPE
                if ((naverData as any)?._idx === 'needs_wait') {
                    // Wait for tab content hydration
                    await new Promise(r => setTimeout(r, 1000));

                    const tabData = await naverPage.evaluate(() => {
                        const res: any = {};
                        // Strategy 1: Look for Director in specific containers
                        // Often inside .people_list or .cast_box
                        // Elements might have .role '감독' and .name 'Name'

                        const members = Array.from(document.querySelectorAll('.cast_box li, .people_list li, .detail_list li'));
                        const castNames: string[] = [];

                        members.forEach((m: any) => {
                            const role = m.querySelector('.sub_text, .role')?.textContent?.trim() || '';
                            const name = m.querySelector('.name, .col_title')?.textContent?.trim() || '';

                            if (role.includes('감독')) {
                                res.director = name;
                            } else if (name) {
                                // Assume others are cast if not director
                                castNames.push(name);
                            }
                        });

                        if (castNames.length > 0) res.cast = castNames.slice(0, 8);
                        return res;
                    });

                    // Merge
                    if (tabData.director) naverData.director = tabData.director;
                    if (tabData.cast) naverData.cast = tabData.cast;
                }

            } catch (e) {
                console.log('   > Naver enrichment failed:', e);
            }

            // Merge Naver Data
            if (naverData.poster) {
                // DOWNLOAD IMAGE
                let posterUrl = naverData.poster;
                let ext = path.extname(posterUrl.split('?')[0]) || '.jpg';
                // Handle cases where extension might be missing or invalid
                if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext.toLowerCase())) ext = '.jpg';

                const filename = `${id}${ext}`;
                const localPath = await downloadImage(posterUrl, filename);
                if (localPath) item.image = localPath;
            }

            if (naverData.director) item.director = naverData.director;
            if (naverData.cast && naverData.cast.length > 0) item.cast = naverData.cast;
            else if (naverData.castStr) item.cast = [naverData.castStr]; // Fallback to string

            if (naverData.grade) {
                if (naverData.grade.includes('전체')) item.venue = '전체 관람가';
                else if (naverData.grade.includes('12')) item.venue = '12세 관람가';
                else if (naverData.grade.includes('15')) item.venue = '15세 관람가';
                else if (naverData.grade.includes('청소년')) item.venue = '청소년 관람불가';
                else item.venue = naverData.grade;
            }

            // Merge Daum Data (Overwrite/Fill if available)
            if (daumData.ageRating) item.venue = daumData.ageRating; // Override with Daum if found
            if (daumData.runningTime) item.runningTime = daumData.runningTime;
            if (daumData.director) item.director = daumData.director; // Prefer Daum? Naver might be cleaner, but Daum requested.
            if (daumData.castList && daumData.castList.length > 0) {
                item.cast = daumData.castList.map((c: any) => c.name);
                item.castLinks = daumData.castList; // Store structured cast with links if needed later
            } else if (daumData.castStr && !item.cast) {
                item.cast = [daumData.castStr];
            }
            if (daumData.detailLink) item.timeLink = daumData.detailLink; // Using 'timeLink' (or create new 'daumLink'?) - User asked for detail link.
            // Typically 'timeLink' is used for booking/detail in other scrapers, or we can add `detailLink` property.
            // Let's stick to adding a new property if schema allows, or map to 'link' / 'timeLink'.
            // KOBIS scraper didn't seem to have a main link.
            item.detailLink = daumData.detailLink;

            // Fallbacks
            if (!item.venue) item.venue = '등급 미정';
            if (!item.movieInfo && naverData.intro) item.movieInfo = naverData.intro;

            finalMovies.push(item);
            await new Promise(r => setTimeout(r, 200));
        }

        // Save Data
        const outputDir = path.join(process.cwd(), 'src', 'data');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        fs.writeFileSync(path.join(outputDir, 'movies.json'), JSON.stringify(finalMovies, null, 2));
        console.log(`Saved ${finalMovies.length} movies.`);

        // Final Verification & Cleanup
        cleanImages(validIds);

    } catch (error) {
        console.error('Fatal Error:', error);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

scrapeMovies();
