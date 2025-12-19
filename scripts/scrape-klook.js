
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const fs = require('fs');
const path = require('path');

const TARGET_URL = 'https://www.klook.com/ko/search/result/?query=%EC%84%9C%EC%9A%B8%20%ED%81%B4%EB%9E%98%EC%8A%A4';
const OUTPUT_FILE = path.join(__dirname, '../src/data/klook-class.json');

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function scrape() {
    const isCI = process.env.CI === 'true';
    console.log(`launching browser with stealth plugin (Headless: ${isCI ? "new" : "false"})...`);

    const browser = await puppeteer.launch({
        headless: isCI ? "new" : false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--window-size=1920,1080'
        ],
        ignoreDefaultArgs: ['--enable-automation']
    });

    try {
        const page = await browser.newPage();

        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });
        });

        await page.setUserAgent(USER_AGENT.replace('HeadlessChrome', 'Chrome'));
        await page.setViewport({ width: 1920, height: 1080 });

        console.log(`Navigating to ${TARGET_URL}...`);
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for list to load
        try {
            await page.waitForSelector('.result-card-list a', { timeout: 30000 });
        } catch (e) {
            console.error('Selector verification failed. Taking screenshot...');
            await page.screenshot({ path: path.join(__dirname, 'klook-error.png') });
            throw e;
        }

        // Scroll to load more (lazy load)
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 100;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if (totalHeight >= 3000) { // Scroll down a bit
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        // Get List Data
        const items = await page.evaluate(() => {
            const cards = Array.from(document.querySelectorAll('.result-card-list a'));
            return cards.map(card => {
                const title = card.querySelector('.card-title')?.innerText || '';
                const link = card.href;
                const priceMatch = card.querySelector('.atomic-price-info span')?.innerText || '';

                // Image is often bg image
                let image = '';
                const imgDiv = card.querySelector('.klook-image-bg');
                if (imgDiv) {
                    const style = imgDiv.getAttribute('style');
                    if (style && style.includes('url(')) {
                        image = style.match(/url\("?(.+?)"?\)/)?.[1] || '';
                    }
                }

                // Fallback for image
                if (!image) {
                    const imgTag = card.querySelector('img');
                    if (imgTag) image = imgTag.src;
                }

                // Clean tags
                const tags = Array.from(card.querySelectorAll('.general-tag')).map(t => t.innerText);

                return { title, link, price: priceMatch, image, tags };
            }).filter(item => item.title && item.link.includes('/activity/'));
        });

        console.log(`Found ${items.length} potential items.`);

        // Deduplicate by link
        const uniqueItems = Array.from(new Map(items.map(item => [item.link, item])).values());
        console.log(`Processing ${uniqueItems.length} unique items.`);

        const results = [];
        const MAX_ITEMS = 300; // Scrape all

        for (let i = 0; i < Math.min(uniqueItems.length, MAX_ITEMS); i++) {
            const item = uniqueItems[i];
            console.log(`[${i + 1}/${Math.min(uniqueItems.length, MAX_ITEMS)}] Scraping detail for ${item.title}...`);

            try {
                const pPage = await browser.newPage();
                await pPage.setUserAgent(USER_AGENT);

                // Use domcontentloaded for faster/reliable nav
                await pPage.goto(item.link, { waitUntil: 'domcontentloaded', timeout: 30000 });

                // Wait for content (lighter wait)
                await new Promise(r => setTimeout(r, 1500));

                const detailData = await pPage.evaluate(() => {
                    // Try to finding address/location
                    // 1. Selector provided by user
                    let venue = document.querySelector('#score_participants .departure-location-box')?.innerText || '';
                    if (!venue) venue = document.querySelector('#score_participants .location-text')?.innerText || '';

                    // 2. Fallback: Search for "Meeting point" or "위치" headings
                    if (!venue) {
                        const h3s = Array.from(document.querySelectorAll('h3, .section-title'));
                        const locHeader = h3s.find(h => h.innerText.includes('위치') || h.innerText.includes('장소') || h.innerText.includes('Meeting'));
                        if (locHeader) {
                            // Try next sibling or parent's text
                            venue = locHeader.nextElementSibling?.innerText || locHeader.parentElement?.innerText || '';
                        }
                    }

                    // 3. Fallback: Full body text regex (dangerous but useful)
                    if (!venue || venue.length > 200) {
                        const bodyText = document.body.innerText;
                        // Match standard Korean address format: City Gu Dong
                        const match = bodyText.match(/[가-힣]+[구군시] [가-힣]+[동읍면가] \d+([-\d]+)?/);
                        if (match) venue = match[0];
                    }

                    // Clean venue text
                    if (venue) venue = venue.replace(/[\n\r]+/g, ' ').substring(0, 100).trim();

                    return { venue };
                });

                await pPage.close();

                results.push({
                    id: `klook-${item.link.split('/activity/')[1].split('-')[0]}`,
                    title: item.title,
                    date: '상시/예약', // Classes are usually available by booking
                    venue: detailData.venue || '상세페이지 참조',
                    price: item.price,
                    image: item.image,
                    link: item.link,
                    genre: 'class',
                    source: 'klook',
                    tags: item.tags,
                    status: 'OPEN'
                });

            } catch (err) {
                console.error(`Failed to scrape ${item.link}:`, err.message);
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
