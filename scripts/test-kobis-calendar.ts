import { chromium } from 'playwright';

async function scrapeKobisCalendar() {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        const url = 'https://www.kobis.or.kr/kobis/business/mast/mvie/findOpenScheduleList.do';
        console.log(`Navigating to ${url}`);

        await page.goto(url, { waitUntil: 'domcontentloaded' });

        const allMovies = new Map();

        // Target: March to December
        // The calendar starts at the current month (March 2026 probably)

        for (let month = 0; month < 10; month++) {
            // Wait for calendar to be visible
            await page.waitForSelector('.board_cal', { timeout: 10000 });

            // Extract current month header to verify where we are
            const header = await page.evaluate(() => {
                return document.querySelector('.board_cal th[colspan="7"]')?.textContent?.trim() || '';
            });
            console.log(`Processing month: ${header}`);

            // Extract movies
            const movies = await page.evaluate(() => {
                const results: any[] = [];
                const cells = document.querySelectorAll('.board_cal td');

                // Usually the header is YYYY.MM
                const headerText = document.querySelector('.board_cal th[colspan="7"]')?.textContent?.trim() || '';
                const match = headerText.match(/(\d{4})\.(\d{2})/);
                let year = '2026';
                let mo = '03';
                if (match) {
                    year = match[1];
                    mo = match[2];
                }

                cells.forEach(td => {
                    // Dates are usually in <strong> or just text
                    const dateNode = td.querySelector('div, strong'); // KOBIS usually puts date in div > strong or similar
                    let dateStr = dateNode?.textContent?.trim() || '';
                    if (!dateStr) {
                        const rawTxt = td.textContent || '';
                        const m = rawTxt.match(/^\s*(\d{1,2})/);
                        if (m) dateStr = m[1];
                    }

                    if (!dateStr) return; // Empty cell

                    const dayFull = `${year}-${mo}-${dateStr.padStart(2, '0')}`;

                    const links = td.querySelectorAll('a');
                    links.forEach(a => {
                        const title = a.getAttribute('title') || a.textContent?.trim();
                        if (title) {
                            results.push({ date: dayFull, title: title.replace('상세정보', '').trim() });
                        }
                    });
                });
                return results;
            });

            movies.forEach(m => allMovies.set(m.title, m));
            console.log(`  Found ${movies.length} movies this month.`);

            // Stop if we reached December
            if (header.includes('12')) break;

            // Click next month
            const clicked = await page.evaluate(() => {
                const aNext = document.querySelector('a.next_mon, .btn_nxt, .next') as HTMLElement;
                if (aNext) {
                    aNext.click();
                    return true;
                }
                return false;
            });

            if (clicked) {
                await page.waitForTimeout(2000); // Wait for AJAX reload
            } else {
                console.log("Next button not found.");
                break;
            }
        }

        console.log(`Total upcoming movies found: ${allMovies.size}`);
        console.log(Array.from(allMovies.values()).slice(0, 10));

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

scrapeKobisCalendar();
