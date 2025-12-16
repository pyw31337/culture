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
    // The tab index might vary, best to click by text content or specific class if stable.
    console.log('Clicking "Performance" tab...');
    try {
        await page.evaluate(() => {
            const tabs = Array.from(document.querySelectorAll('.srch-tab a'));
            const performanceTab = tabs.find(t => t.textContent?.includes('공연'));
            if (performanceTab) (performanceTab as HTMLElement).click();
        });
        await new Promise(r => setTimeout(r, 3000)); // Wait for tab switch
    } catch (e) {
        console.warn('Could not click Performance tab, might already be on it or selector changed.');
    }

    // 2. Click "판매마감 제외" (Exclude Sold Out)
    console.log('Activating "Exclude Sold Out"...');
    try {
        await page.evaluate(() => {
            const filters = Array.from(document.querySelectorAll('.category > div'));
            const soldOutFilter = filters.find(f => f.textContent?.includes('판매마감 제외'));
            if (soldOutFilter && !soldOutFilter.classList.contains('on')) {
                (soldOutFilter as HTMLElement).click();
            }
        });
        await new Promise(r => setTimeout(r, 3000)); // Wait for filter
    } catch (e) {
        console.warn('Could not set Sold Out filter.');
    }

    // 3. Scroll to load more items
    console.log('Loading more items...');
    try {
        for (let i = 0; i < 3; i++) {
            await page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
            await new Promise(r => setTimeout(r, 2000));
        }
    } catch (e) {
        console.warn('Error during scrolling/loading more:', e);
    }

    // 4. Extract Items (Robust Link-Based Method)
    console.log('Extracting items...');
    const items = await page.evaluate(() => {
        const results: any[] = [];
        const seenLinks = new Set();

        // Find links
        const links = Array.from(document.querySelectorAll('a[href*="/Perf/"]'));

        links.forEach((linkEl) => {
            const href = linkEl.getAttribute('href');
            if (!href || seenLinks.has(href)) return;
            seenLinks.add(href);

            let container = linkEl.parentElement;
            let found = false;
            for (let i = 0; i < 5; i++) {
                if (!container) break;

                const img = container.querySelector('img');
                // Title (any text that isn't date/venue)
                const titleEl = container.querySelector('.tit') || container.querySelector('.name') || container.querySelector('p.tit');

                if (img && (titleEl || container.innerText.length > 5)) {
                    // Check Exclusive
                    const stateTag = container.querySelector('.item-state') || container.querySelector('.state');
                    const isExclusive = stateTag && (stateTag.textContent?.includes('단독') || stateTag.textContent?.includes('단독판매'));

                    if (isExclusive) {
                        try {
                            const fullLink = href.startsWith('http') ? href : 'http://ticket.yes24.com' + href;
                            const image = img.getAttribute('src') || '';

                            let title = '';
                            if (titleEl) title = titleEl.textContent?.trim() || '';
                            else {
                                const lines = container.innerText.split('\n');
                                title = lines[0].trim();
                            }

                            const dateMatch = container.innerText.match(/202\d\.\d{2}\.\d{2}(\s*~\s*202\d\.\d{2}\.\d{2})?/);
                            const date = dateMatch ? dateMatch[0] : '';

                            // Venue?
                            const hallEl = container.querySelector('.hall');
                            let venue = '';
                            if (hallEl) venue = hallEl.textContent?.trim() || '';

                            if (!venue) {
                                // Fallback: text analysis
                                // split by newlines, filter empty
                                const lines = container.innerText.split(/\n/).map((l: string) => l.trim()).filter((l: string) => l);
                                // Expected: Title, Date, Venue
                                // Find line that looks like date
                                const dateIndex = lines.findIndex((l: string) => l.match(/202\d\.\d{2}\.\d{2}/));
                                if (dateIndex !== -1 && dateIndex + 1 < lines.length) {
                                    venue = lines[dateIndex + 1];
                                }
                            }

                            if (title && date) {
                                results.push({
                                    title,
                                    image,
                                    date,
                                    venue,
                                    link: fullLink
                                });
                                found = true;
                            }
                        } catch (e) { }
                    }
                    if (found) break;
                }
                container = container.parentElement;
            }
        });

        return results;
    });

    console.log(`Found ${items.length} exclusive items.`);

    const uniqueItems: Performance[] = [];
    const seenTitles = new Set();

    for (const item of items) {
        if (seenTitles.has(item.title)) continue;

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

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(uniqueItems, null, 2));
    console.log(`Saved to ${OUTPUT_PATH}`);
}

scrapeYes24().catch(console.error);
