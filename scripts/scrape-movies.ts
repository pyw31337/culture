
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

        // Initial Load
        let totalMovies: any[] = [];
        let pageNum = 1;
        const MAX_PAGES = 5; // Safety limit

        while (pageNum <= MAX_PAGES) {
            console.log(`Scraping page ${pageNum}...`);

            // Extract items from current view
            const newItems = await page.evaluate(() => {
                const items = document.querySelectorAll('.card_content .card_item');
                const data: any[] = [];
                items.forEach((item, idx) => {
                    try {
                        const titleEl = item.querySelector('.data_box .this_text') || item.querySelector('strong.this_text');
                        const imageEl = item.querySelector('.img_box img');
                        const linkEl = item.querySelector('a.data_area');
                        const dateEl = item.querySelector('.info_group dd');

                        // Try to find grade in list
                        // Common selectors: .ico_grade, or inside .info_group text
                        let grade = '';
                        const gradeEl = item.querySelector('.ico_grade') || item.querySelector('.c_grade'); // hypothetical selectors
                        if (gradeEl) grade = gradeEl.textContent?.trim() || '';

                        // Capture debug HTML for the first item
                        let debugHtml = '';
                        if (idx === 0) debugHtml = item.outerHTML;

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
                                    // Relative query string, usually for search.naver
                                    link = 'https://m.search.naver.com/search.naver' + link;
                                } else {
                                    link = 'https://m.search.naver.com/' + link;
                                }
                            }
                            data.push({ title, image, link, date, grade, debugHtml });
                        }
                    } catch (e) { }
                });
                return data;
            }) as any[];

            console.log(`Found ${newItems.length} items on page ${pageNum}`);

            // Save debug HTML if available
            if (newItems.length > 0 && newItems[0].debugHtml) {
                fs.writeFileSync('debug_list_item.html', newItems[0].debugHtml);
            }

            // Add unique items
            for (const item of newItems) {
                if (!totalMovies.find(m => m.title === item.title)) {
                    totalMovies.push(item);
                }
            }

            // Check for Next Button
            const nextBtn = await page.$('.pg_next.on'); // 'on' class usually means active
            if (!nextBtn) {
                console.log('No more pages (next button not active).');
                break;
            }

            console.log('Clicking Next page...');
            await nextBtn.click();
            await new Promise(r => setTimeout(r, 2000)); // Wait for load
            pageNum++;
        }

        const rawMovies = totalMovies;

        console.log(`Found ${rawMovies.length} movies. Processing details...`);

        if (rawMovies.length === 0) {
            fs.writeFileSync('debug_html_empty_list.txt', await page.content());
        }

        const movies = [];
        const MAX_ITEMS = 20;

        function cleanGrade(g: string): string {
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

            // Use list-scraped grade if available, otherwise default to unknown
            let grade = raw.grade || "등급 미정";

            // Try to fetch detail page for Grade if missed
            // Try to fetch detail page for Grade if missed
            if (grade === "등급 미정" && raw.link) {
                try {
                    // Open in same page to save resources
                    await page.goto(raw.link, { waitUntil: 'domcontentloaded', timeout: 8000 });

                    // Debug: Save first detail page HTML
                    if (i === 0) {
                        fs.writeFileSync('debug_movie_detail.html', await page.content());
                        console.log('Saved debug_movie_detail.html');
                    }

                    let extractedGrade = await page.evaluate(() => {
                        // Strategy 1: Look for specific Description List structure (Naver Mobile standard)
                        const dts = Array.from(document.querySelectorAll('dt'));
                        const gradeDt = dts.find(dt => dt.textContent?.includes('등급'));
                        if (gradeDt && gradeDt.nextElementSibling) {
                            return gradeDt.nextElementSibling.textContent?.trim();
                        }
                        return null;
                    });

                    // Strategy 2: Regex on Page Content (Robust Fallback)
                    if (!extractedGrade) {
                        const html = await page.content();
                        const kobisMatch = html.match(/관람등급\s*([0-9]+세|전체|청소년)(?:이상)?\s*(관람가|관람불가)/);
                        if (kobisMatch) {
                            extractedGrade = kobisMatch[0];
                        } else {
                            const generalMatch = html.match(/(전체|12세|15세|청소년)\s*(?:이상)?\s*(관람가|관람불가)/);
                            if (generalMatch) extractedGrade = generalMatch[0];
                        }
                    }

                    if (extractedGrade) {
                        grade = cleanGrade(extractedGrade);
                    }
                } catch (e) {
                    console.log(`Error fetching details for ${raw.title}`);
                }
            } else {
                grade = cleanGrade(grade);
            }

            // High-res Image
            // Extract the real 'src' from the query param if wrapped
            // e.g. https://search.pstatic.net/common?src=https%3A%2F%2F...&type=...
            let highResImage = raw.image;
            try {
                const urlObj = new URL(raw.image);
                const realSrc = urlObj.searchParams.get('src');
                if (realSrc) {
                    highResImage = decodeURIComponent(realSrc);
                    // Remove type parameters from the extracted URL if present
                    highResImage = highResImage.split('?')[0];
                } else {
                    // Fallback cleanup if not wrapped
                    highResImage = highResImage.split('?')[0];
                }
            } catch (e) {
                // Invalid URL, keep original or basic cleanup
                highResImage = highResImage.split('?')[0];
            }

            // Construct final movie object
            const id = `movie_${raw.date.replace(/[\.\s]/g, '')}_${raw.title.replace(/[\s\(\)]/g, '_').substring(0, 10)}`;

            movies.push({
                id: id,
                title: raw.title, // Removed [영화] prefix
                image: highResImage,
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
