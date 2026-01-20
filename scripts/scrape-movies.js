
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Naver Mobile Search - "Current Movies"
const SCRAPE_URL = 'https://m.search.naver.com/search.naver?query=%ED%98%84%EC%9E%AC%EC%83%81%EC%98%81%EC%98%84%ED%99%94';

async function scrapeMovies() {
    console.log('Starting Naver Movie Scraper (Mobile)...');
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    // Forward logs
    // page.on('console', msg => console.log('PAGE:', msg.text()));

    const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    // Set Mobile UA for Naver List
    await page.setUserAgent(MOBILE_UA);

    try {
        await page.setViewport({ width: 390, height: 844 });
        await page.goto(SCRAPE_URL, { waitUntil: 'networkidle2' });

        console.log('Page loaded. waiting for movie list...');

        const listSelector = '.card_content .card_item';

        try {
            await page.waitForSelector(listSelector, { timeout: 10000 });
            await new Promise(r => setTimeout(r, 2000));
        } catch (e) {
            console.log('Mobile list selector not found.');
            throw e;
        }

        // Initial Load
        let totalMovies = [];
        let pageNum = 1;
        const MAX_PAGES = 5;

        while (pageNum <= MAX_PAGES) {
            console.log(`Scraping page ${pageNum}...`);

            const newItems = await page.evaluate(() => {
                const items = document.querySelectorAll('.card_content .card_item');
                const data = [];
                items.forEach((item, idx) => {
                    try {
                        const titleEl = item.querySelector('.data_box .this_text') || item.querySelector('strong.this_text');
                        const imageEl = item.querySelector('.img_box img');
                        const linkEl = item.querySelector('a.data_area');
                        const dateEl = item.querySelector('.info_group dd');

                        let grade = '';
                        const gradeEl = item.querySelector('.ico_grade') || item.querySelector('.c_grade');
                        if (gradeEl) grade = gradeEl.textContent?.trim() || '';

                        if (titleEl && linkEl) {
                            let title = titleEl.textContent?.trim() || '';
                            title = title.replace(/^\[영화\]\s*/, '');
                            let image = imageEl?.getAttribute('src') || '';
                            let link = linkEl.getAttribute('href') || '';
                            let date = dateEl?.textContent?.trim() || '';

                            if (link && !link.startsWith('http')) {
                                if (link.startsWith('/')) {
                                    link = 'https://m.search.naver.com' + link;
                                } else if (link.startsWith('?')) {
                                    link = 'https://m.search.naver.com/search.naver' + link;
                                } else {
                                    link = 'https://m.search.naver.com/' + link;
                                }
                            }
                            data.push({ title, image, link, date, grade });
                        }
                    } catch (e) { }
                });
                return data;
            });

            console.log(`Found ${newItems.length} items on page ${pageNum}`);

            for (const item of newItems) {
                if (!totalMovies.find(m => m.title === item.title)) {
                    totalMovies.push(item);
                }
            }

            const nextBtn = await page.$('.pg_next.on');
            if (!nextBtn) {
                console.log('No more pages.');
                break;
            }

            console.log('Clicking Next page...');
            await nextBtn.click();
            await new Promise(r => setTimeout(r, 2000));
            pageNum++;
        }

        const rawMovies = totalMovies;

        console.log(`Found ${rawMovies.length} movies. Processing details...`);

        const movies = [];
        const MAX_ITEMS = 20;

        function cleanGrade(g) {
            if (!g) return "등급 미정";
            g = g.replace("관람등급", "").trim();
            if (g.includes("12세")) return "12세 관람가";
            if (g.includes("15세")) return "15세 관람가";
            if (g.includes("청소년") || g.includes("불가")) return "청소년 관람불가";
            if (g.includes("전체")) return "전체 관람가";
            return "등급 미정";
        }

        for (let i = 0; i < Math.min(rawMovies.length, MAX_ITEMS); i++) {
            const raw = rawMovies[i];
            console.log(`[${i + 1}/${Math.min(rawMovies.length, MAX_ITEMS)}] Processing: ${raw.title}`);

            let grade = raw.grade || "등급 미정";

            let daumCast = [];
            let daumDirector = "";
            let daumInfo = "";

            try {
                // Switch to Desktop UA for robust Daum scraping
                await page.setUserAgent(DESKTOP_UA);

                const daumUrl = `https://search.daum.net/search?w=tot&q=${encodeURIComponent(raw.title + ' 영화')}`;

                await page.goto(daumUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
                try { await page.waitForSelector('dt', { timeout: 3000 }); } catch (e) { }

                const daumData = await page.evaluate(() => {
                    const result = { cast: [], director: '', info: '', grade: '' };

                    // const dts = Array.from(document.querySelectorAll('dt'));

                    function getDDText(key) {
                        const dts = Array.from(document.querySelectorAll('dt'));
                        const target = dts.find(dt => dt.textContent && dt.textContent.indexOf(key) !== -1);
                        if (target && target.nextElementSibling && target.nextElementSibling.tagName === 'DD') {
                            return target.nextElementSibling;
                        }
                        return null;
                    }

                    const castEl = getDDText('출연');
                    if (castEl) {
                        const anchors = Array.from(castEl.querySelectorAll('a'));
                        if (anchors.length > 0) {
                            result.cast = anchors.map(a => a.textContent?.trim() || '')
                                .filter(s => s && s !== '더보기' && s !== '확장하기');
                        } else {
                            result.cast = (castEl.textContent?.trim() || '').split(',').map(s => s.trim()).filter(Boolean);
                        }
                    }

                    const dirEl = getDDText('감독');
                    if (dirEl) {
                        result.director = dirEl.textContent?.trim() || '';
                    }

                    const infoEl = getDDText('개요');
                    if (infoEl) {
                        let fullText = infoEl.textContent?.trim() || '';
                        fullText = fullText.replace(/(전체|12세|15세|청소년)\s*(?:이상)?\s*(관람가|관람불가)/, '').trim();

                        const timeMatch = fullText.match(/([0-9]+분)/);
                        if (timeMatch) {
                            const timePart = timeMatch[0];
                            const parts = fullText.split(timePart);
                            const front = parts[0].trim();
                            result.info = `${front} / ${timePart}`;
                        } else {
                            result.info = fullText;
                        }
                    }

                    const bodyText = document.body.innerText;
                    const match = bodyText.match(/(전체|12세|15세|청소년)\s*(?:이상)?\s*(관람가|관람불가)/);
                    if (match) result.grade = match[0];

                    return result;
                });

                if (daumData.cast) daumCast = daumData.cast;
                if (daumData.director) daumDirector = daumData.director;
                if (daumData.info) daumInfo = daumData.info;

                if (grade === "등급 미정" && daumData.grade) {
                    grade = cleanGrade(daumData.grade);
                    console.log(`Found grade on Daum: ${grade}`);
                }

            } catch (e) {
                console.log(`Daum metadata failed: ${e}`);
            } finally {
                await page.setUserAgent(MOBILE_UA);
            }

            let highResImage = raw.image;
            try {
                const urlObj = new URL(raw.image);
                const realSrc = urlObj.searchParams.get('src');
                if (realSrc) {
                    highResImage = decodeURIComponent(realSrc);
                    highResImage = highResImage.split('?')[0];
                } else {
                    highResImage = highResImage.split('?')[0];
                }
            } catch (e) {
                highResImage = highResImage.split('?')[0];
            }

            const id = `movie_${raw.date.replace(/[\.\s]/g, '')}_${raw.title.replace(/[\s\(\)]/g, '_').substring(0, 10)}`;

            movies.push({
                id: id,
                title: raw.title,
                image: highResImage,
                date: raw.date,
                venue: grade, // Venue field used for Grade
                gradeIcon: null,
                link: `https://m.search.daum.net/search?w=tot&q=${encodeURIComponent(raw.title + ' 영화')}`,
                region: '전국',
                genre: 'movie',
                cast: daumCast.length > 0 ? daumCast : undefined,
                director: daumDirector || undefined,
                movieInfo: daumInfo || undefined
            });
        }

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
