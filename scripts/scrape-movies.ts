
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// Using a dedicated scraper for KOBIS
const SCRAPE_URL = 'https://www.kobis.or.kr/kobis/business/stat/boxs/findDailyBoxOfficeList.do';

async function scrapeMovies() {
    console.log('Starting KOBIS Movie Scraper...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    try {
        await page.setViewport({ width: 1280, height: 800 });
        await page.goto(SCRAPE_URL, { waitUntil: 'networkidle0' });

        // 1. Click "More" button to ensure we have 20 items (default is 10)
        console.log('Clicking "More" button...');
        const moreBtnSelector = '#btn_0';
        try {
            await page.waitForSelector(moreBtnSelector, { visible: true, timeout: 3000 });
            await page.click(moreBtnSelector);
            // Wait for table to update/expand. 
            // KOBIS loads via AJAX. We can wait for a bit or wait for row 11 to appear.
            await page.waitForFunction(() => document.querySelectorAll('#tbody_0 > tr').length > 10, { timeout: 5000 });
            console.log('"More" button clicked and rows expanded.');
        } catch (e: any) {
            console.log('Could not click "More" button or already showing all items:', e.message);
        }

        const movies: any[] = [];
        const MAX_ITEMS = 20;

        // Get the list of rows. We need to re-query this if the DOM updates, 
        // but for clicking we should re-query strictly inside the loop to avoid stale elements.

        for (let i = 0; i < MAX_ITEMS; i++) {
            console.log(`Processing movie rank #${i + 1}...`);

            // Re-evaluate rows to get fresh reference
            // Selector for the title link: #tbody_0 > tr:nth-child(INDEX+1) > td.tal > span.ellip.per90 > a
            const rowSelector = `#tbody_0 > tr:nth-child(${i + 1})`;
            const titleLinkSelector = `${rowSelector} > td.tal > span.ellip.per90 > a`;
            const dateSelector = `${rowSelector} > td:nth-child(3)`;

            // Extract basic info from the table row first
            const basicInfo = await page.evaluate((rowSel, titleSel, dateSel) => {
                const titleEl = document.querySelector(titleSel);
                const dateEl = document.querySelector(dateSel);
                return {
                    title: titleEl ? titleEl.textContent?.trim() : null,
                    date: dateEl ? dateEl.textContent?.trim() : null
                };
            }, rowSelector, titleLinkSelector, dateSelector);

            if (!basicInfo.title) {
                console.log(`Skipping row ${i + 1} (No title found)`);
                continue;
            }

            // Click to open popup
            try {
                // Scroll to title and click via evaluate (more robust)
                await page.evaluate((sel: string) => {
                    const el = document.querySelector(sel) as HTMLElement;
                    if (el) {
                        el.scrollIntoView({ block: 'center' });
                        el.click(); // Direct JS click
                    }
                }, titleLinkSelector);

                await new Promise(r => setTimeout(r, 1000)); // Pause after click

                // Wait for popup to appear (generic selector in case ID changes)
                const popupSelector = '.ui-dialog-content';
                await page.waitForSelector(popupSelector, { visible: true, timeout: 5000 });

                // Extract details
                const details = await page.evaluate((popupSel) => {
                    const popup = document.querySelector(popupSel);
                    if (!popup) return null;

                    const imgEl = popup.querySelector('a.fl.thumb img');
                    const posterPath = imgEl ? imgEl.getAttribute('src') : null;
                    const poster = posterPath ? `https://www.kobis.or.kr${posterPath}` : null;

                    const dts = Array.from(popup.querySelectorAll('div.ovf.info.info1 dl dt'));
                    let grade = "전체관람가";

                    const gradeDt = dts.find(dt => dt.textContent?.includes('관람등급'));
                    if (gradeDt && gradeDt.nextElementSibling) {
                        grade = gradeDt.nextElementSibling.textContent?.trim() || "";
                    } else {
                        const fallbackEl = popup.querySelector('div.ovf.info.info1 dl dd:nth-child(8)');
                        if (fallbackEl) grade = fallbackEl.textContent?.trim() || "";
                    }

                    return { poster, grade };
                }, popupSelector);

                // Close popup - Robust method
                // Try pressing Escape first, it's usually cleaner for modal dialogs
                await page.keyboard.press('Escape');

                // Check if still visible, then try clicking close
                try {
                    await page.waitForSelector(popupSelector, { hidden: true, timeout: 1000 });
                } catch {
                    const closeBtnSelector = 'div.ui-dialog-titlebar a.close';
                    await page.evaluate((sel: string) => {
                        const el = document.querySelector(sel) as HTMLElement;
                        if (el) el.click();
                    }, closeBtnSelector);
                    await page.waitForSelector(popupSelector, { hidden: true, timeout: 2000 });
                }

                // FORCE REMOVE ANY OVERLAYS (Crucial for KOBIS or jQuery UI)
                await page.evaluate(() => {
                    document.querySelectorAll('.ui-widget-overlay').forEach(el => el.remove());
                });

                await new Promise(r => setTimeout(r, 500)); // Pause after close

                // Construct Movie Object
                // ID Construction: movie_YYYYMMDD_Title
                const cleanDate = basicInfo.date?.replace(/-/g, '') || '00000000';
                const id = `movie_${cleanDate}_${basicInfo.title.replace(/\s+/g, '_')}`;

                movies.push({
                    id: id,
                    title: `[영화] ${basicInfo.title}`,
                    image: details?.poster || "", // Will be remote URL
                    date: basicInfo.date, // Release Date
                    venue: details?.grade || "정보없음", // Mapping Grade to Venue field for now
                    link: `https://search.daum.net/search?w=tot&q=${encodeURIComponent(basicInfo.title)}`, // Daum Search Link
                    region: 'all', // Movies are nationwide
                    genre: 'movie' // New Genre
                });

            } catch (err: any) {
                console.error(`Error processing row ${i + 1}:`, err.message);
                try {
                    await page.screenshot({ path: `error_row_${i + 1}.png` });
                } catch { }

                // Attempt to close popup if stuck open via Escape
                try { await page.keyboard.press('Escape'); } catch (e: any) { }
            }
        }

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
        console.error('Scraping failed:', error);
    } finally {
        await browser.close();
    }
}

scrapeMovies();
