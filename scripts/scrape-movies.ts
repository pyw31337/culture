
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// Naver Mobile Search - "Current Movies"
const SCRAPE_URL = 'https://m.search.naver.com/search.naver?query=%ED%98%84%EC%9E%AC%EC%83%81%EC%98%81%EC%98%84%ED%99%94';

async function scrapeMovies() {
    console.log('Starting Naver Movie Scraper (Mobile)...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    // Set Mobile UA to ensure we get the mobile layout we analyzed
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');

    try {
        await page.setViewport({ width: 390, height: 844 });
        await page.goto(SCRAPE_URL, { waitUntil: 'networkidle2' });

        console.log('Page loaded. waiting for movie list...');

        // Debug screenshot
        await page.screenshot({ path: 'debug_naver_mobile.png' });

        // Selector based on debug HTML analysis: .card_content .card_item
        const listSelector = '.card_content .card_item';

        try {
            await page.waitForSelector(listSelector, { timeout: 10000 });
            // Wait for lazy-loaded images
            await new Promise(r => setTimeout(r, 2000));
        } catch (e) {
            console.log('Mobile list selector not found. Flushing debug HTML...');
            await page.screenshot({ path: 'naver_scrape_error_mobile.png' });
            fs.writeFileSync('debug_html_mobile_error.txt', await page.content());
            throw e;
        }

        // Extract basic info from the list
        const rawMovies = await page.evaluate(() => {
            const items = document.querySelectorAll('.card_content .card_item');
            const data: any[] = [];

            items.forEach((item) => {
                try {
                    const titleEl = item.querySelector('.data_box .this_text') || item.querySelector('strong.this_text');
                    const imageEl = item.querySelector('.img_box img');
                    const linkEl = item.querySelector('a.data_area');
                    // Date is usually in the first info_group dd
                    const dateEl = item.querySelector('.info_group dd');

                    if (titleEl && linkEl) {
                        let title = titleEl.textContent?.trim() || '';
                        let image = imageEl?.getAttribute('src') || '';
                        let link = linkEl.getAttribute('href') || '';
                        let date = dateEl?.textContent?.trim() || '';

                        // Fix relative links
                        if (link && !link.startsWith('http')) {
                            if (link.startsWith('/')) {
                                link = 'https://m.search.naver.com' + link;
                            } else {
                                link = 'https://m.search.naver.com/' + link;
                            }
                        }

                        data.push({
                            title,
                            image,
                            link,
                            date
                        });
                    }
                } catch (err) {
                    // Start logging errors if needed
                }
            });
            return data;
        }) as any[];

        console.log(`Found ${rawMovies.length} movies. Processing details...`);

        if (rawMovies.length === 0) {
            fs.writeFileSync('debug_html_empty_list.txt', await page.content());
        }

        const movies = [];
        const MAX_ITEMS = 20;

        for (let i = 0; i < Math.min(rawMovies.length, MAX_ITEMS); i++) {
            const raw = rawMovies[i];
            console.log(`[${i + 1}/${Math.min(rawMovies.length, MAX_ITEMS)}] Processing: ${raw.title}`);

            let grade = "전체 관람가"; // Default fallback

            // Try to fetch detail page for Grade
            if (raw.link) {
                try {
                    // Open in same page to save resources
                    await page.goto(raw.link, { waitUntil: 'domcontentloaded', timeout: 8000 });
                    await new Promise(r => setTimeout(r, 500)); // fast wait

                    const extractedGrade = await page.evaluate(() => {
                        const bodyText = document.body.innerText;
                        // Prioritize explicit text
                        if (bodyText.includes('청소년 관람불가')) return '청소년 관람불가';
                        if (bodyText.includes('15세 관람가')) return '15세 관람가';
                        if (bodyText.includes('12세 관람가')) return '12세 관람가';
                        if (bodyText.includes('전체 관람가')) return '전체 관람가';

                        // Look for '등급' label
                        const dts = Array.from(document.querySelectorAll('dt'));
                        const gradeDt = dts.find(dt => dt.textContent?.includes('등급'));
                        if (gradeDt && gradeDt.nextElementSibling) {
                            return gradeDt.nextElementSibling.textContent?.trim();
                        }
                        return null;
                    });

                    if (extractedGrade) {
                        grade = extractedGrade.replace(/도움말/g, '').trim();
                    }
                } catch (e) {
                    console.log(`Error fetching details for ${raw.title}`);
                }
            }

            // Construct final movie object
            const id = `movie_${raw.date.replace(/[\.\s]/g, '')}_${raw.title.replace(/[\s\(\)]/g, '_').substring(0, 10)}`;

            movies.push({
                id: id,
                title: `[영화] ${raw.title}`, // Add prefix for UI clarity if needed, or keep clean
                image: raw.image,
                date: raw.date, // Keep original format (YYYY.MM.DD.)
                venue: grade, // Venue field used for Grade
                gradeIcon: null, // No icon for now
                link: `https://m.search.daum.net/search?w=tot&q=${encodeURIComponent(raw.title + ' 영화')}`,
                region: '전국',
                genre: 'movie'
            });
        }

        // Save
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
