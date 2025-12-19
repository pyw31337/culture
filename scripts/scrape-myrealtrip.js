
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const TARGET_URL = 'https://www.myrealtrip.com/search?tab=tour&per=200&selected=category%3Akids%5Ekids_history&q=%EB%A7%88%EB%A6%AC%ED%8A%B8%ED%82%A4%EC%A6%88';
const OUTPUT_FILE = path.join(__dirname, '../src/data/myrealtrip-kids.json');

// Mobile UA for potentially lighter pages, but Desktop is probably safer for MyRealTrip structure which looks complex
// User's selectors look like Desktop structure.
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function scrape() {
    console.log('launching browser...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent(USER_AGENT);
        await page.setViewport({ width: 1280, height: 800 });

        console.log(`Navigating to ${TARGET_URL}...`);
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2' });

        // Wait for list to load
        await page.waitForSelector('a[href*="/products/"]', { timeout: 10000 });

        // Get Links
        const links = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a[href*="/products/"]'));
            // Filter out duplicates and non-product links if any
            return Array.from(new Set(anchors.map(a => a.href).filter(h => h.includes('/products/'))));
        });

        console.log(`Found ${links.length} products.`);

        const results = [];
        const MAX_ITEMS = 300; // scrape all items (approx 200)

        for (let i = 0; i < Math.min(links.length, MAX_ITEMS); i++) {
            const url = links[i];
            console.log(`[${i + 1}/${Math.min(links.length, MAX_ITEMS)}] Scraping ${url}...`);

            try {
                const pPage = await browser.newPage();
                await pPage.setUserAgent(USER_AGENT);
                await pPage.goto(url, { waitUntil: 'domcontentloaded' });

                // Wait a bit for dynamic content
                await new Promise(r => setTimeout(r, 1000));

                const data = await pPage.evaluate(() => {
                    const getText = (sel) => document.querySelector(sel)?.innerText?.trim() || '';
                    const getSrc = (sel) => document.querySelector(sel)?.getAttribute('src') || '';

                    // User provided selectors
                    // Date: #USAGE_TIME > div > div > div > div > p
                    // Place: #USAGE_PLACE > div > div > div > p
                    // Price: #__next > main > div.css-1aij17q > div.css-9gwt02 > div > div > div > span
                    // Image: #__next > main > div.css-1aij17q > section > div.css-7h42y0 > div > div > div > div.swiper-slide.css-8wtcr7.swiper-slide-active > div > div > div > div > img

                    // Fallback selectors based on inspection
                    const dateText = getText('#USAGE_TIME > div > div > div > div > p') || getText('#USAGE_TIME p') || '상시/예약';
                    const placeText = getText('#USAGE_PLACE > div > div > div > p') || getText('#USAGE_PLACE p') || '장소 정보 없음';

                    // Price is tricky, looking for "원"
                    let priceText = '';
                    const priceSpans = Array.from(document.querySelectorAll('span'));
                    const priceSpan = priceSpans.find(s => s.innerText.includes('원') && s.innerText.replace(/[^0-9]/g, '').length > 3);
                    if (priceSpan) priceText = priceSpan.innerText;

                    // Image
                    const imgSrc = getSrc('.swiper-slide-active img') || getSrc('.product-image img') || getSrc('img[alt*="상품"]');
                    const titleText = getText('h1');

                    return {
                        title: titleText,
                        date: dateText,
                        venue: placeText,
                        price: priceText,
                        poster: imgSrc
                    };
                });

                await pPage.close();

                if (data.title) {
                    results.push({
                        id: `mrt-${url.split('/products/')[1].split('?')[0]}`,
                        title: data.title,
                        date: data.date.replace(/[\n\r]+/g, ' '), // Clean newlines
                        venue: data.venue,
                        price: data.price,
                        image: data.poster,
                        link: url,
                        genre: 'kids',
                        source: 'myrealtrip',
                        // Special flag for "Open Run" / "Always Available" logic
                        status: 'OPEN'
                    });
                }

            } catch (err) {
                console.error(`Failed to scrape ${url}:`, err.message);
            }
        }

        console.log(`Scraped ${results.length} items.`);
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));

    } catch (e) {
        console.error('Scraping failed:', e);
    } finally {
        await browser.close();
    }
}

scrape();
