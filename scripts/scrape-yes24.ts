import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

// Type definition matching the project's Performance interface
// (Redefined here to avoid import issues if not shared cleanly in scripts)
export interface Performance {
    id: string;
    title: string;
    image: string;
    date: string;
    venue: string;
    link: string;
    region: string;
    genre: string;
}

const SEARCH_URL = 'https://ticket.yes24.com/Search/단독';
const OUTPUT_PATH = path.resolve(process.cwd(), 'src/data/yes24.json');

// Helper to determine region from venue/address (Simple mapping for now)
function classifyRegion(venue: string): string | null {
    if (venue.includes('서울') || venue.includes('예스24') || venue.includes('디큐브') || venue.includes('세종문화회관') || venue.includes('롯데콘서트홀')) return 'seoul';
    if (venue.includes('경기') || venue.includes('성남') || venue.includes('수원') || venue.includes('고양') || venue.includes('킨텍스')) return 'gyeonggi';
    if (venue.includes('인천')) return 'incheon';
    return null; // Will need manual check or smarter mapping later
}

function cleanDateString(dateStr: string): string {
    // "2025.12.20 ~ 2025.12.21" -> "2025.12.20~2025.12.21" (Remove spaces around tilde)
    return dateStr.replace(/\s*~\s*/g, '~');
}

async function scrapeYes24() {
    console.log(`Using executablePath: ${process.env.PUPPETEER_EXECUTABLE_PATH || 'Bundled'}`);
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1024 });
    // User Agent is still good to have, even with Stealth
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    console.log(`Navigating to ${SEARCH_URL}...`);
    await page.goto(SEARCH_URL, { waitUntil: 'networkidle2', timeout: 90000 }); // Increased timeout

    // 1. Click "공연" (Performances) Tab
    console.log('Clicking "Performance" tab...');
    try {
        await page.evaluate(() => {
            const tabs = Array.from(document.querySelectorAll('.srch-division a'));
            const performanceTab = tabs.find(t => t.textContent?.includes('공연'));
            if (performanceTab) (performanceTab as HTMLElement).click();
        });
        await new Promise(r => setTimeout(r, 5000)); // Wait for tab switch
    } catch (e) {
        console.warn('Could not click Performance tab, might already be on it or selector changed.');
    }

    // 2. Click "판매마감 제외" (Exclude Sold Out) - This might be dynamic
    console.log('Activating "Exclude Sold Out"...');
    try {
        await page.evaluate(() => {
            // Check if filter exists
            const filters = Array.from(document.querySelectorAll('.category > div, .srch-option a'));
            const soldOutFilter = filters.find(f => f.textContent?.includes('판매마감 제외'));
            if (soldOutFilter && !soldOutFilter.classList.contains('on')) {
                (soldOutFilter as HTMLElement).click();
            }
        });
        await new Promise(r => setTimeout(r, 3000));
    } catch (e) {
        console.warn('Could not set Sold Out filter (might not be present).');
    }

    // 3. Scroll to load more items
    console.log('Loading more items...');
    try {
        for (let i = 0; i < 5; i++) {
            await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
            await new Promise(r => setTimeout(r, 2000));
            // Also click "more" button if exists
            await page.evaluate(() => {
                const moreBtn = document.querySelector('.srch-more a');
                if (moreBtn) (moreBtn as HTMLElement).click();
            });
            await new Promise(r => setTimeout(r, 2000));
        }
    } catch (e) {
        console.warn('Error during scrolling/loading more.');
    }

    // 4. Extract Items (Updated Selector Logic)
    console.log('Extracting items...');
    const items = await page.evaluate(() => {
        const results: any[] = [];
        const containerItems = Array.from(document.querySelectorAll('.srch-list-item'));

        containerItems.forEach((el) => {
            try {
                // Check Exclusive Badge
                const stateEl = el.querySelector('.item-state');
                const isExclusive = stateEl && (stateEl.textContent?.includes('단독'));

                // If we want ONLY exclusive items
                if (!isExclusive) return;

                const linkEl = el.querySelector('.item-tit a');
                if (!linkEl) return;

                const link = linkEl.getAttribute('href');
                const fullLink = link ? (link.startsWith('http') ? link : 'http://ticket.yes24.com' + link) : '';

                const title = linkEl.textContent?.trim() || '';
                const imageEl = el.querySelector('img');
                const image = imageEl?.getAttribute('src') || '';

                // Date is usually 3rd div (index 2)
                const divs = el.querySelectorAll('div');
                // div[0] = img container, div[1] = content(title/state), div[2] = date, div[3] = venue
                let date = '';
                let venue = '';

                // Iterate divs to match date pattern if structure varies
                // But strict structure is usually reliable in this list
                if (divs.length >= 4) {
                    const candidateDate = divs[2].textContent?.trim() || '';
                    if (candidateDate.match(/202\d\.\d{2}\.\d{2}/)) {
                        date = candidateDate;
                    }
                    venue = divs[3].textContent?.trim() || '';
                }

                if (title && date && fullLink) {
                    results.push({
                        title,
                        image,
                        date,
                        venue,
                        link: fullLink
                    });
                }
            } catch (err) { }
        });

        return results;
    });

    console.log(`Found ${items.length} exclusive items.`);

    const uniqueItems: Performance[] = [];
    const seenTitles = new Set();

    for (const item of items) {
        if (seenTitles.has(item.title)) continue;

        // Skip dummy/test items if any
        if (item.title.includes('예스24') && item.title.includes('단독')) {
            // Keep it if it's legit, but some are ads. 
            // The HTML showed "예스24 ... 단독 사은품" which are magazines.
            // But those were in `viewArticle`. `.srch-list-item` seems to be strictly `viewPerf`.
        }

        let region = classifyRegion(item.venue);
        if (!region) region = 'unknown';

        seenTitles.add(item.title);

        const idMatch = item.link.match(/\/Perf\/(\d+)/);
        const id = idMatch ? `yes24_${idMatch[1]}` : `yes24_${Math.random().toString(36).substr(2, 9)}`;

        uniqueItems.push({
            id,
            title: item.title,
            image: item.image,
            date: cleanDateString(item.date),
            venue: item.venue,
            link: item.link,
            region: region,
            genre: 'concert'
        });
    }

    console.log(`Processed ${uniqueItems.length} unique exclusive items.`);

    await browser.close();

    // Preserve existing file if we found 0 items to avoid wiping data on failure, or overwrite?
    // User wants it repaired. If it returns 0, it's safer not to save empty.
    if (uniqueItems.length > 0) {
        fs.writeFileSync(OUTPUT_PATH, JSON.stringify(uniqueItems, null, 2));
        console.log(`Saved to ${OUTPUT_PATH}`);
    } else {
        console.warn('No items found. Skipping save.');
    }
}

scrapeYes24().catch(console.error);
