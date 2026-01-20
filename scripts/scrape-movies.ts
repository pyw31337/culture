import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// KOBIS Daily Box Office
const SCRAPE_URL = 'https://www.kobis.or.kr/kobis/business/stat/boxs/findDailyBoxOfficeList.do';

async function scrapeMovies() {
    console.log('Starting KOBIS Movie Scraper (+ Naver Enrichment)...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // Context for Naver
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
            const openDateRaw = await row.$eval('td:nth-child(3)', el => el.textContent?.trim());
            const attr = await page.evaluate(el => el.getAttribute('onclick') || el.getAttribute('href'), titleLink);

            let movieCode = '';
            if (attr) {
                const match = attr.match(/['"]([0-9]{8})['"]/);
                if (match) movieCode = match[1];
            }

            if (movieCode) {
                movies.push({ tempCode: movieCode, title, openDateRaw });
            }
        }

        const finalMovies = [];
        for (const m of movies) {
            console.log(`Processing ${m.title}...`);
            let date = m.openDateRaw || '';
            // Ensure YYYY.MM.DD format
            if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
                date = date.replace(/-/g, '.') + '.';
            } else if (date.match(/^\d{4}\.\d{2}\.\d{2}$/)) {
                date = date + '.';
            }

            let item: any = {
                title: m.title,
                date: date,
                region: '전국',
                genre: 'movie'
            };

            // KOBIS Detail for Summary/Grade (Fast check)
            try {
                const detailUrl = `https://www.kobis.or.kr/kobis/business/mast/mvie/searchMovieDtl.do?code=${m.tempCode}`;
                item.link = detailUrl;

                // We skip checking KOBIS detail for Poster/Director since it failed. 
                // We rely on Naver. But we might need minimal info like Grade if Naver fails.

                // Go to KOBIS just for Summary/Grade check? 
                // It adds time. Let's try Naver FIRST. If Naver succeeds, we might not need KOBIS detail?
                // But KOBIS has the "official" grade and summary often.
                // Let's do a quick KOBIS extraction for summary/grade only.
                await page.goto(detailUrl, { waitUntil: 'domcontentloaded' });
                try {
                    await page.waitForSelector('.ovf.info.info1', { timeout: 3000 });
                    const kobisData = await page.evaluate(() => {
                        const res: any = {};
                        const dts = Array.from(document.querySelectorAll('.ovf.info.info1 dl > dt'));
                        dts.forEach(dt => {
                            const k = dt.textContent;
                            const v = (dt.nextElementSibling as HTMLElement)?.innerText?.trim();
                            if (k?.includes('요약정보')) res.summary = v;
                            if (k?.includes('등급')) res.grade = v;
                        });
                        const img = document.querySelector('.ovf.info.info1 a.thumb img');
                        if (img) res.poster = img.getAttribute('src');
                        return res;
                    });

                    if (kobisData.summary) item.movieInfo = kobisData.summary;
                    if (kobisData.grade) item.venue = kobisData.grade; // Temporary venue holder
                    if (kobisData.poster && !kobisData.poster.includes('noimage')) {
                        item.image = 'https://www.kobis.or.kr' + kobisData.poster;
                    }

                } catch (e) { }
            } catch (e) { }

            // NAVER ENRICHMENT
            try {
                console.log(`   > Searching Naver for ${m.title}...`);
                const q = `${m.title} 영화 정보`;
                await naverPage.goto(`https://search.naver.com/search.naver?query=${encodeURIComponent(q)}`, { waitUntil: 'domcontentloaded', timeout: 10000 });

                const found = await naverPage.evaluate(() => !!document.querySelector('.cm_info_box') || !!document.querySelector('.api_subject_bx .detail_info'));
                if (found) {
                    const nData = await naverPage.evaluate(() => {
                        const res: any = {};
                        // Poster
                        const img = document.querySelector('.detail_info a.thumb img') || document.querySelector('.cm_content_area .thumb img');
                        if (img) res.poster = img.getAttribute('src');

                        // Info Box
                        const infoBox = document.querySelector('.cm_info_box');
                        if (infoBox) {
                            infoBox.querySelectorAll('dt').forEach(dt => {
                                const k = dt.textContent?.trim();
                                const v = dt.nextElementSibling?.textContent?.trim();
                                if (k === '감독') res.director = v;
                                if (k === '등급') res.grade = v; // Naver grade is usually easier to read
                                if (k === '출연') res.castStr = v;
                            });
                        }

                        // Separate Cast Section check
                        const castBox = document.querySelector('.cast_box');
                        if (castBox) {
                            res.cast = Array.from(castBox.querySelectorAll('.name')).map(el => el.textContent?.trim()).slice(0, 8);
                        }
                        return res;
                    });

                    if (nData.poster) item.image = nData.poster; // Naver poster is usually better
                    if (nData.director) item.director = nData.director;
                    if (nData.cast) item.cast = nData.cast;

                    // Grade normalization
                    if (nData.grade) {
                        if (nData.grade.includes('전체')) item.venue = '전체 관람가';
                        else if (nData.grade.includes('12')) item.venue = '12세 관람가';
                        else if (nData.grade.includes('15')) item.venue = '15세 관람가';
                        else if (nData.grade.includes('청소년')) item.venue = '청소년 관람불가';
                    }
                }
            } catch (e) {
                console.log('   > Naver enrichment failed:', e);
            }

            // Fallbacks & Cleanup
            if (!item.venue) item.venue = '등급 미정';
            if (item.venue.includes('15세') && !item.venue.includes('관람가')) item.venue = '15세 관람가';
            if (item.venue.includes('12세') && !item.venue.includes('관람가')) item.venue = '12세 관람가';

            item.id = `movie_${item.date.replace(/[\.\s]/g, '')}_${m.title?.replace(/[\s\(\)]/g, '_')}`;
            finalMovies.push(item);
            await new Promise(r => setTimeout(r, 500));
        }

        // Save
        const outputDir = path.join(process.cwd(), 'src', 'data');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
        fs.writeFileSync(path.join(outputDir, 'movies.json'), JSON.stringify(finalMovies, null, 2));
        console.log(`Saved ${finalMovies.length} movies.`);

    } catch (error) {
        console.error('Fatal Error:', error);
        process.exit(1);
    } finally {
        await browser.close();
    }
}

scrapeMovies();
