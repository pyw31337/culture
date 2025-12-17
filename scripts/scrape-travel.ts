
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

async function scrapeTravel() {
    console.log('Starting Naver Travel Scraper...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1440, height: 900 });

    try {
        // Calculate Dynamic Dates
        const today = new Date();
        const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        const nextNextMonth15 = new Date(today.getFullYear(), today.getMonth() + 2, 15);

        const formatDate = (date: Date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            return `${y}.${m}.${d}.`;
        };

        const depDateStart = formatDate(nextMonth);
        const depDateEnd = formatDate(nextNextMonth15);

        console.log(`Target Date Range: ${depDateStart} ~ ${depDateEnd}`);

        // Construct URL
        // destination=ASIA_10007 (Southeast Asia)
        // excludeCategories=TKPS,GDTR (No Shopping / No Tip) - User requested check this
        // departure=ICN,GMP (Incheon, Gimpo)
        const baseUrl = 'https://pkgtour.naver.com/list';
        const params = new URLSearchParams({
            destination: 'ASIA_10007',
            adultCnt: '1',
            excludeCategories: 'TKPS,GDTR',
            price: '70000,550000',
            page: '1',
            order: 'pra', // Price Ascending? or 'pra' might be recommendation? User URL used this.
            imminent: 'true',
            shortCut: '8wmdot',
            departureDate: `${depDateStart},${depDateEnd}`,
            departure: 'ICN,GMP'
        });

        const targetUrl = `${baseUrl}?${params.toString()}`;
        console.log('Navigating to:', targetUrl);

        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

        // Check for loading spinner and wait
        try {
            await page.waitForSelector('.commons_loading', { hidden: true, timeout: 15000 });
        } catch (e) {
            console.log('Loading spinner did not disappear or wasnt found. Proceeding...');
        }

        // Wait for list to load
        // Try waiting for any list item or the main container
        try {
            await page.waitForSelector('ul > li div.information', { timeout: 20000 });
        } catch (e) {
            console.log('List selector timeout. Taking debug screenshot...');
            await page.screenshot({ path: 'debug_travel_timeout.png' });
            fs.writeFileSync('debug_travel_timeout.html', await page.content());
            throw new Error('Timeout waiting for travel list');
        }

        // Scrape items (Basic Info from List)
        const basicItems = await page.evaluate(() => {
            const items = document.querySelectorAll('ul > li'); // Broad selector
            const data: any[] = [];

            items.forEach((item) => {
                try {
                    const infoDiv = item.querySelector('.information');
                    if (!infoDiv) return;

                    // Title
                    const titleEl = infoDiv.querySelector('strong') || infoDiv.querySelector('[class*="title"]');
                    const title = titleEl?.textContent?.trim() || '';

                    // Link
                    const linkEl = item.querySelector('a');
                    let link = linkEl?.getAttribute('href') || '';
                    if (link && !link.startsWith('http')) {
                        link = 'https://pkgtour.naver.com' + link;
                    }

                    // Price (Clean extraction)
                    // Usually in .price strong. If multiple numbers exist, we need to be careful.
                    const priceDiv = item.querySelector('.price');
                    const priceStrong = priceDiv?.querySelector('strong');
                    // Get only the text of the strong tag, not children if any?
                    let price = priceStrong?.textContent?.trim() || '';
                    // Fallback cleanup if it contains garbage
                    const priceMatch = price.match(/[\d,]+/);
                    if (priceMatch) price = priceMatch[0];

                    // Agent
                    const agentEl = item.querySelector('.agent');
                    const agent = agentEl?.textContent?.trim() || '여행사';

                    // Options (from list for now, might be moved)
                    const optionsEl = infoDiv.querySelector('.options');
                    const options = optionsEl?.textContent?.trim() || '';

                    // Image
                    const imgEl = item.querySelector('figure img') || item.querySelector('img');
                    const thumb = imgEl?.getAttribute('src') || '';

                    if (title && price && link) {
                        data.push({ title, price, agent, options, image: thumb, link, date: '' });
                    }
                } catch (e) { }
            });
            return data;
        });

        console.log(`Found ${basicItems.length} basic items. Fetching details...`);

        // Limit to 20 to avoid timeout
        const travelItems = basicItems.slice(0, 20);

        // Fetch Details (Date)
        for (let i = 0; i < travelItems.length; i++) {
            const item = travelItems[i];
            try {
                // Navigate to detail page
                // Optimization: Don't need to load everything.
                await page.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 10000 });

                // Scrape Date
                // Selector: #app > div > div > div.Detail_information > div > div.DetailProductInfo > div.row > span > i:nth-child(2)
                // Simplified: .DetailProductInfo .row span i:nth-child(2)? 
                // Let's use evaluate to be flexible
                const dateText = await page.evaluate(() => {
                    try {
                        // Try various selectors as the specific path might vary slightly
                        const target = document.querySelector('.DetailProductInfo .row span i:nth-child(2)'); // User's hint
                        // Fallback: look for text pattern matching date 'MM.DD'
                        if (target) return target.textContent?.trim();

                        // Fallback 2: Look for '출발' text
                        const spans = document.querySelectorAll('span');
                        for (const s of spans) {
                            if (s.textContent?.includes('출발')) return s.textContent.trim();
                        }
                        return '';
                    } catch (e) { return ''; }
                });

                if (dateText) {
                    item.date = dateText.replace('출발', '').trim();
                } else {
                    item.date = '날짜 확인 필요';
                }

                // Also Check Price again if list was messy? 
                // List price is usually sufficient if regexed.

                console.log(`[${i + 1}/${travelItems.length}] Scraped Date: ${item.date}`);

            } catch (e) {
                console.log(`Failed to scrape detail for ${item.title}: ${e}`);
                item.date = '상세페이지 참조';
            }
        }

        // Transform to App Format
        const performances = travelItems.map(item => {
            // "title": item.title,
            // "venue": Use Agent + Options
            // "date": Period
            // "price": item.price

            return {
                id: `travel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                title: `[여행] ${item.title}`,
                image: item.image,
                date: item.date || '날짜 미정',
                venue: `${item.agent} | ${item.options}`, // Storing Agent & Options in Venue for UI
                link: item.link,
                genre: 'travel',
                price: item.price + '원',
                region: 'overseas'
            };
        });

        // Save
        const outputDir = path.join(process.cwd(), 'src', 'data');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        if (performances.length > 0) {
            fs.writeFileSync(
                path.join(outputDir, 'travel.json'),
                JSON.stringify(performances, null, 2)
            );
            console.log(`Saved ${performances.length} travel items to src/data/travel.json`);
        } else {
            console.log('No travel items found. Skipping file save to preserve existing data.');
        }

    } catch (error) {
        console.error('Scraping Error:', error);
        // Take screenshot
        await page.screenshot({ path: 'debug_travel_error.png' });
    } finally {
        await browser.close();
    }
}

scrapeTravel();
