
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

        // Scrape items
        const travelItems = await page.evaluate(() => {
            // Updated selector strategy based on observation (it's likely a list LI)
            const items = document.querySelectorAll('ul > li'); // Broad selector, filter inside
            const data: any[] = [];


            items.forEach((item) => {
                try {
                    // Check if it's a valid product item
                    const infoDiv = item.querySelector('.information');
                    if (!infoDiv) return;

                    // Thumbnail
                    const imgEl = item.querySelector('figure img') || item.querySelector('img');
                    const thumb = imgEl?.getAttribute('src') || '';

                    // Title
                    const titleEl = infoDiv.querySelector('strong') || infoDiv.querySelector('[class*="title"]');
                    const title = titleEl?.textContent?.trim() || infoDiv.textContent?.trim().substring(0, 50) + '...';

                    // Agent (often in a specific class or just text)
                    const agentEl = item.querySelector('.agent') || item.querySelector('[class*="agent"]');
                    const agent = agentEl?.textContent?.trim() || '여행사';

                    // Price
                    const priceDiv = item.querySelector('.price') || item.querySelector('[class*="price"]');
                    const priceStrong = priceDiv?.querySelector('strong') || priceDiv;
                    const price = priceStrong?.textContent?.trim() || '';

                    // Options / Sub Info
                    const optionsEl = infoDiv.querySelector('.options') || infoDiv.querySelector('[class*="options"]');
                    const options = optionsEl?.textContent?.trim() || '';

                    // Period / Date
                    // User mentioned div:nth-child(3) in information
                    const divs = infoDiv.querySelectorAll('div');
                    let period = '';
                    if (divs.length > 2) {
                        period = divs[2]?.textContent?.trim() || '';
                    }

                    // Link
                    const linkEl = item.querySelector('a');
                    let link = linkEl?.getAttribute('href') || '';
                    if (link && !link.startsWith('http')) {
                        link = 'https://pkgtour.naver.com' + link;
                    }

                    if (title && price) {
                        data.push({
                            title,
                            image: thumb,
                            price,
                            agent,
                            options,
                            period,
                            link
                        });
                    }

                } catch (e) { }
            });
            return data;
        });

        console.log(`Found ${travelItems.length} items.`);

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
                date: item.period || '날짜 미정',
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
