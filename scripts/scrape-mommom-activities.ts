import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { promisify } from 'util';
import stream from 'stream';

const pipeline = promisify(stream.pipeline);

puppeteer.use(StealthPlugin());

const TARGET_URL = 'https://mom-mom.net/shop/categories/1102241';
const OUTPUT_FILE = path.resolve(process.cwd(), 'src/data/mommom-activities.json');
const IMAGE_DIR = path.resolve(process.cwd(), 'public/images/posters/activity');

// Ensure image dir exists
if (!fs.existsSync(IMAGE_DIR)) {
    fs.mkdirSync(IMAGE_DIR, { recursive: true });
}

async function downloadImage(url: string, filename: string): Promise<string> {
    try {
        const ext = path.extname(url.split('?')[0]) || '.jpg';
        const localFilename = `${filename}${ext}`;
        const localPath = path.join(IMAGE_DIR, localFilename);
        const publicPath = `/images/posters/activity/${localFilename}`;

        if (fs.existsSync(localPath)) return publicPath; // Skip if exists

        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            timeout: 10000
        });

        await pipeline(response.data, fs.createWriteStream(localPath));
        return publicPath;
    } catch (e) {
        console.warn(`Failed to download image ${url}:`, e);
        return url; // Fallback to original URL
    }
}

async function scrapeActivities() {
    console.log('Starting Mom-Mom Activity Scraper...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    try {
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        // Infinite Scroll
        console.log('Loading list...');
        await page.evaluate(async () => {
            await new Promise<void>((resolve) => {
                let totalHeight = 0;
                let noChangeCount = 0;
                const distance = 500;
                const timer = setInterval(() => {
                    const scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;

                    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 200) {
                        if (document.body.scrollHeight > scrollHeight) noChangeCount = 0;
                        else noChangeCount++;
                    } else {
                        noChangeCount = 0;
                    }

                    if (noChangeCount > 50 || totalHeight > 500000) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        // Debug: Log HTML structure of one item to verify selectors
        // const sampleHTML = await page.evaluate(() => document.querySelector('.container main')?.innerHTML);
        // console.log(sampleHTML?.slice(0, 1000));

        const items = await page.evaluate(() => {
            // User provided: body > div.container... > div.sc-28df737d-0.gDuaez ...
            // We'll look for the card container class or structure.
            // The user's selector implies a list of items inside `sc-28df737d-0`.
            // Let's try to find the repeating element that contains `.product-info`.

            const cards = Array.from(document.querySelectorAll('div[class*="sc-"] a[href*="/shop/products/"], div[class*="sc-"] a[href*="/shop/"]'));
            // Broad selection, then filter

            // Actually, let's use the USER's specific selectors to guide us to the *container*.
            // "body > div.container... > main > ... > div.sc-58f6879c-0.fjlsoj > div > div:nth-child(1)" matches one item.
            // So the repeating list is likely `div.sc-58f6879c-0.fjlsoj > div` or similar.

            // Let's try to select all elements that have `.product-info`.
            const productInfos = Array.from(document.querySelectorAll('.product-info'));

            return productInfos.map(info => {
                const parent = info.closest('div[class*="sc-"]') || info.parentElement?.parentElement;

                // Title
                const title = info.querySelector('h4')?.textContent?.trim() || '';

                // Venue
                const venue = info.querySelector('.brand-name')?.textContent?.trim() || '';

                // Price & Discount
                const discountRate = info.querySelector('.rate')?.textContent?.trim() || '';
                const price = info.querySelector('p > span:nth-child(2)')?.textContent?.trim() ||
                    info.querySelector('.price span:not(.rate)')?.textContent?.trim() || '';

                // Image
                // User said: div.sc-fd2f9237-3.repRa (thumbnail)
                // It's likely in a sibling of .product-info or adjacent container
                // Look for image-container
                const imgContainer = parent?.querySelector('.image-container') || parent?.querySelector('div[class*="image-container"]');
                let image = '';
                if (imgContainer) {
                    const img = imgContainer.querySelector('img');
                    if (img) image = img.src;
                    else {
                        // Check background image
                        const divWithBg = imgContainer.querySelector('div[style*="background-image"]');
                        if (divWithBg) {
                            const style = divWithBg.getAttribute('style');
                            const match = style?.match(/url\("?(.+?)"?\)/);
                            if (match) image = match[1];
                        }
                    }
                }

                // Link
                const linkAnchor = parent?.closest('a') || parent?.querySelector('a');
                const link = linkAnchor?.href || '';

                return { title, venue, discountRate, price, image, link };
            });
        });

        console.log(`Found ${items.length} items.`);

        const finalItems = [];
        for (const item of items) {
            if (!item.title) continue;

            // Calculate Original Price if discount exists
            // Price: "22,900원" -> 22900
            // Rate: "36%" -> 0.36
            // Original = Price / (1 - Rate)

            const priceNum = parseInt(item.price.replace(/[^0-9]/g, ''), 10) || 0;
            let originalPrice = '';

            if (item.discountRate.includes('%')) {
                const rate = parseInt(item.discountRate.replace('%', ''), 10);
                if (!isNaN(rate) && rate > 0) {
                    const orig = Math.floor(priceNum / ((100 - rate) / 100));
                    // Round to nearest 100 probably
                    originalPrice = orig.toLocaleString() + '원';
                }
            }

            // Clean Title for ID
            const safeTitle = item.title.replace(/\s/g, '').replace(/[^a-zA-Z0-9가-힣]/g, '').slice(0, 20);
            const id = `mommom_activity_${safeTitle}`;

            // Download Image
            let finalImage = item.image;
            if (item.image) {
                finalImage = await downloadImage(item.image, id);
            }

            finalItems.push({
                id,
                title: item.title,
                image: finalImage,
                link: item.link,
                date: '상시운영', // Default for activities unless we parse date from title
                genre: 'activity',
                region: 'etc', // Can't easily determine from list without deep scrape or venue match
                venue: item.venue,
                address: '', // Skip deep scrape for now unless requested, speed is key
                latitude: 0,
                longitude: 0,
                originalPrice: originalPrice,
                price: item.price,
                rate: parseInt(item.discountRate.replace('%', ''), 10) || 0,
                platform: 'mommom',
                discountRate: item.discountRate // Store raw rate too?
            });
        }

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalItems, null, 2));
        console.log(`Saved ${finalItems.length} items to ${OUTPUT_FILE}`);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}

scrapeActivities();
