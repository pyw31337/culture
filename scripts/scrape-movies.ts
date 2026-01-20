import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// KOBIS Daily Box Office
const SCRAPE_URL = 'https://www.kobis.or.kr/kobis/business/stat/boxs/findDailyBoxOfficeList.do';

async function scrapeMovies() {
    console.log('Starting KOBIS Movie Scraper...');
    const browser = await puppeteer.launch({
        headless: true, // Set to false for debugging if needed
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,800']
    });
    const page = await browser.newPage();

    // Set Desktop UA
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    try {
        console.log(`Navigating to ${SCRAPE_URL}...`);
        await page.goto(SCRAPE_URL, { waitUntil: 'networkidle2' });

        // Wait for table to load
        await page.waitForSelector('.rst_sch');

        // Click "Load More" button (#btn_0) to ensure we see enough items (usually top 10 is shown, button loads more)
        const loadMoreBtn = await page.$('#btn_0');
        if (loadMoreBtn) {
            console.log('Clicking "Load More" button...');
            try {
                // Ensure button is visible/clickable
                await page.evaluate((btn) => (btn as HTMLElement).click(), loadMoreBtn);
                // Wait for potential network request or DOM update.
                // KOBIS often just reveals rows or does a quick fetch. 
                // Let's rely on waiting for network idle or a short pause.
                await new Promise(r => setTimeout(r, 2000));
            } catch (e) {
                console.log('Error clicking load more:', e);
            }
        } else {
            console.log('"Load More" button not found, checking if list is already expanded...');
        }

        // Get list of movies
        // Selector: #tbody_0 > tr
        const rows = await page.$$('#tbody_0 > tr');
        console.log(`Found ${rows.length} rows in the list.`);

        const movies: any[] = [];
        const MAX_ITEMS = 30; // User requested ~30 items

        // Phase 1: Iterate through rows to extract basic info and movie codes
        for (let i = 0; i < Math.min(rows.length, MAX_ITEMS); i++) {
            const currentRow = (await page.$$('#tbody_0 > tr'))[i];
            if (!currentRow) continue;

            const titleLink = await currentRow.$('td.tal > span.ellip.per90 > a');
            if (!titleLink) {
                console.log(`No title link found for row ${i}. Skipping.`);
                continue;
            }

            const title = await page.evaluate(el => el.textContent?.trim(), titleLink);
            const rankText = await currentRow.$eval('td:nth-child(1)', el => el.textContent?.trim());
            const openDateRaw = await currentRow.$eval('td:nth-child(2)', el => el.textContent?.trim());

            // Extract Movie Code from "onclick" or "href"
            // Example: <a href="#" onclick="mstView('movie','20247693');return false;">...</a>
            // Or: <a href="javascript:voild(0)" onclick="jeongboView('20247693')">...</a>
            const attr = await page.evaluate(el => {
                return el.getAttribute('onclick') || el.getAttribute('href');
            }, titleLink);

            let movieCode = '';
            if (attr) {
                // Try to match 'movie', '123456' or similar
                const match = attr.match(/['"]([0-9]{8})['"]/); // Match 8 digit code usually
                if (match) {
                    movieCode = match[1];
                }
            }

            if (!movieCode) {
                console.log(`Could not extract movie code from attribute: ${attr}. Skipping ${title}.`);
                continue;
            }

            console.log(`Found Movie Code: ${movieCode}. Preparing for detail scrape...`);

            // Open detail in a new tab or same tab?
            // Since we need to go back to list, maybe new page is better?
            // Actually, we can just construct the URL and visit it.
            // But we have the list loop. 
            // Better strategy: Collect all codes first, then visit them one by one.
            // This avoids "stale element" issues if we navigate away and back.
            movies.push({ // Temporary push to store code
                tempCode: movieCode,
                title: title,
                rank: rankText,
                openDateRaw: openDateRaw
            });
        }

        // Phase 2: Visit each movie detail page
        const finalMovies = [];
        for (const m of movies) {
            if (!m.tempCode) continue;

            console.log(`Scraping details for ${m.title} (${m.tempCode})...`);
            try {
                // Direct Detail URL
                // https://www.kobis.or.kr/kobis/business/mast/mvie/searchMovieDtl.do?code=20247693
                const detailUrl = `https://www.kobis.or.kr/kobis/business/mast/mvie/searchMovieDtl.do?code=${m.tempCode}`;

                await page.goto(detailUrl, { waitUntil: 'domcontentloaded' });
                await page.waitForSelector('.ovf.info.info1', { timeout: 5000 });

                const details = await page.evaluate(() => {
                    const infoContainer = document.querySelector('.ovf.info.info1');
                    if (!infoContainer) return null;

                    // Image selector: try .thumb_img img, or just any img in the left side
                    let imageEl = infoContainer.querySelector('.thumb_img img');
                    if (!imageEl) imageEl = infoContainer.querySelector('a.thumb_img img');

                    const poster = imageEl ? imageEl.getAttribute('src') : '';

                    const data: any = {};

                    // Parse DL/DT/DD
                    const dts = Array.from(infoContainer.querySelectorAll('dl > dt'));
                    dts.forEach(dt => {
                        const key = dt.textContent?.trim();
                        const dd = dt.nextElementSibling;
                        if (dd && dd.tagName === 'DD') {
                            const val = (dd as HTMLElement).innerText.trim();
                            if (key?.includes('요약정보')) data.summary = val;
                            if (key?.includes('개봉일')) data.openDate = val;
                            if (key?.includes('등급')) data.grade = val;
                        }
                    });

                    return { poster, ...data };
                });

                if (details) {
                    // Normalize
                    let normalizedDate = details.openDate || m.openDateRaw || '';
                    normalizedDate = normalizedDate.replace(/-/g, '.').replace(/[^\d\.]/g, '');
                    if (!normalizedDate.endsWith('.') && normalizedDate.length > 0) normalizedDate += '.';

                    // Clean Poster
                    let image = details.poster || '';
                    if (image && !image.startsWith('http')) {
                        image = 'https://www.kobis.or.kr' + image;
                    }
                    if (image.includes('common/point_icon')) image = ''; // Avoid collecting rating icons as poster

                    // Grade fallback from summary
                    // Summary text example: "장편 | 일반영화 | 멜로/로맨스 | 114분 37초 | 15세이상관람가 | 한국"
                    let grade = details.grade || '';
                    if (!grade && details.summary) {
                        if (details.summary.includes('15세')) grade = '15세 관람가';
                        else if (details.summary.includes('12세')) grade = '12세 관람가';
                        else if (details.summary.includes('전체')) grade = '전체 관람가';
                        else if (details.summary.includes('청소년') || details.summary.includes('불가')) grade = '청소년 관람불가';
                    }

                    // Standardize Grade
                    if (grade.includes('15세')) grade = '15세 관람가';
                    else if (grade.includes('12세')) grade = '12세 관람가';
                    else if (grade.includes('전체')) grade = '전체 관람가';
                    else if (grade.includes('청소년') || grade.includes('불가')) grade = '청소년 관람불가';
                    else grade = '등급 미정';

                    const id = `movie_${normalizedDate.replace(/[\.\s]/g, '')}_${m.title?.replace(/[\s\(\)]/g, '_')}`;

                    finalMovies.push({
                        id,
                        title: m.title || '',
                        image,
                        date: normalizedDate,
                        venue: grade,
                        gradeIcon: null,
                        link: detailUrl,
                        region: '전국',
                        genre: 'movie',
                        movieInfo: details.summary || ''
                    });
                }
            } catch (e) {
                console.log(`Failed to scrape detail for ${m.title}: ${e}`);
                // Add basic info if detail fails?
            }
            // Small delay
            await new Promise(r => setTimeout(r, 500));
        }

        // Replace movies array with finalMovies for saving
        movies.length = 0;
        movies.push(...finalMovies);

        // Save Data
        const outputDir = path.join(process.cwd(), 'src', 'data');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        fs.writeFileSync(
            path.join(outputDir, 'movies.json'),
            JSON.stringify(movies, null, 2)
        );
        console.log(`Saved ${movies.length} movies to src/data/movies.json`);

    } catch (error) {
        console.error('Fatal Scraper Error:', error);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

scrapeMovies();
