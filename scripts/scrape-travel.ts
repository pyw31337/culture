
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
            departure: 'ICN,GMP',
            shoppingCount: '0,0' // Enforce No Shopping
        });

        const targetUrl = `${baseUrl}?${params.toString()}`;
        console.log('Navigating to:', targetUrl);

        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 30000 });

        // Check for loading spinner and wait
        try {
            await page.waitForSelector('.commons_loading', { hidden: true, timeout: 15000 });
        } catch (e) {
            console.log('Loading spinner wait timeout or not found.');
        }

        // Wait for list to load
        try {
            await page.waitForSelector('.products .item', { timeout: 10000 });
        } catch (e) {
            console.log('Timeout waiting for .products .item');
            // Take screenshot to debug
            await page.screenshot({ path: 'debug_travel_timeout.png' });
            fs.writeFileSync('debug_travel_timeout.html', await page.content());
            throw new Error('Timeout waiting for travel list');
        }

        // Initialize results array
        const travelItems: any[] = [];
        const maxItems = 50; // Increased limit

        // Loop to scrape items one by one via navigation
        for (let i = 0; i < maxItems; i++) {
            try {
                // Re-query items after every navigation/back
                await page.waitForSelector('.products .item', { timeout: 10000 });

                // Check if we need to scroll to find the ith item
                let items = await page.$$('.products .item');
                if (i >= items.length) {
                    console.log(`Index ${i} out of range (found ${items.length}). Scrolling down...`);
                    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                    await new Promise(r => setTimeout(r, 2000)); // Wait for lazy load
                    items = await page.$$('.products .item');
                    console.log(`New item count: ${items.length}`);
                }

                if (i >= items.length) {
                    console.log('No more items to scrape even after scroll.');
                    break;
                }

                const itemElement = items[i];

                // 1. Scrape Basic Info from List Item BEFORE clicking
                const basicInfo = await itemElement.evaluate((el) => {
                    let title = el.querySelector('.information .name')?.textContent?.trim() || '';
                    // Remove prefixes like [여행] if present
                    title = title.replace(/^\[.*?\]\s*/, '').trim();

                    const price = el.querySelector('.price .final .value')?.textContent?.trim() || '';
                    const img = el.querySelector('figure img')?.getAttribute('src') || '';
                    const options = el.querySelector('.options.as_sub')?.textContent?.trim() || '';
                    return { title, price, image: img, options };
                });

                console.log(`[${i + 1}/${maxItems}] scrap processing: ${basicInfo.title.substring(0, 20)}...`);

                if (!basicInfo.title) {
                    console.log('  Skipping empty title item');
                    continue;
                }

                // 2. Click and Navigate to Detail
                // Click the anchor or the title
                const anchor = await itemElement.$('a.anchor');
                if (anchor) {
                    await Promise.all([
                        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
                        anchor.click()
                    ]);
                } else {
                    console.log('  No anchor found, trying button...');
                    const btn = await itemElement.$('button.reserve');
                    if (btn) {
                        await Promise.all([
                            page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
                            btn.click()
                        ]);
                    } else {
                        console.log('  No clickable element found. Skipping.');
                        continue;
                    }
                }

                // 3. Scrape Detail Page
                const detailData = await page.evaluate(() => {
                    const infoDiv = document.querySelector('.DetailProductInfo');
                    const agentStats = document.querySelector('.AgentStatistics');
                    const peoplePanel = document.querySelector('.DetailSelectPeople');

                    if (!infoDiv) return null;

                    let title = infoDiv.querySelector('.name')?.textContent?.trim() || '';
                    // Clean title in detail too
                    title = title.replace(/^\[.*?\]\s*/, '').trim();

                    const dateEls = Array.from(document.querySelectorAll('.DetailProductInfo .row .desc .date') || []);
                    const dateEl = dateEls.find(el => el.textContent?.includes('출발'));
                    const date = dateEl?.textContent?.replace('출발', '').trim() || '';

                    const durationEl = dateEls.find(el => el.textContent?.includes('박'));
                    const duration = durationEl?.textContent?.trim() || '';

                    const agentName = agentStats?.querySelector('.title b')?.textContent?.trim() || '';

                    const finalPriceEl = peoplePanel?.querySelector('.final .amount');
                    const finalPrice = finalPriceEl?.textContent?.trim() || '';

                    const originalPriceEl = peoplePanel?.querySelector('.deleted .amount');
                    const originalPrice = originalPriceEl?.textContent?.trim() || '';

                    const discountEl = peoplePanel?.querySelector('.final .sale .rate');
                    const discount = discountEl?.textContent?.trim() || '';

                    // Try to get high res image
                    const mainImg = document.querySelector('.DetailPhotoGrid .images .img');
                    const imgSrc = mainImg?.getAttribute('src') || '';

                    return { title, date, duration, agentName, finalPrice, originalPrice, discount, imgSrc };
                });

                // 4. Merge Data
                const finalItem = {
                    title: detailData?.title || basicInfo.title,
                    price: detailData?.finalPrice || basicInfo.price,
                    originalPrice: detailData?.originalPrice,
                    discount: detailData?.discount,
                    date: detailData?.date || '',
                    agent: detailData?.agentName || '여행사',
                    image: detailData?.imgSrc || basicInfo.image,
                    link: page.url(), // Capture the current URL!
                    options: basicInfo.options,
                    venue: ''
                };

                // Construct Venue
                const dur = detailData?.duration || '';
                finalItem.venue = `${finalItem.agent} ${dur ? '| ' + dur : ''}`;

                travelItems.push(finalItem);
                console.log(`  > Done. Date: ${finalItem.date}, Price: ${finalItem.price}`);

                // 5. Go Back to List
                await page.goBack({ waitUntil: 'networkidle2' });

            } catch (e) {
                console.log(`Error processing item ${i}: ${e}`);
                // Try to recover by going back if we are not on list page?
                // Or just continue, but if we are on detail page, next loop selector will fail.
                // Safest to force go back if URL suggests we are deep.
                if (!page.url().includes('/list')) {
                    try { await page.goBack({ waitUntil: 'networkidle2' }); } catch (err) { }
                }
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
                title: item.title,
                image: item.image,
                date: item.date || '날짜 미정',
                venue: item.venue,
                link: item.link,
                genre: 'travel',
                price: item.price + '원',
                originalPrice: item.originalPrice ? item.originalPrice + '원' : undefined,
                discount: item.discount,
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
