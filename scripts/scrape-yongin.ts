import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

async function run() {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    await page.setViewport({ width: 1280, height: 800 });

    try {
        console.log('Navigating to Namuwiki 용인 FC...');
        await page.goto('https://namu.wiki/w/%EC%9A%A9%EC%9D%B8%20FC', { waitUntil: 'networkidle2' });

        // Find the infobox image. Usually it's an img tag inside a specific table.
        // .app_c class or table containing '용인 FC' and 'Yongin FC'

        const imgSrc = await page.evaluate(() => {
            // Find the first SVG or WebP image in the main content area that looks like a logo
            // Typically the first large image in the infobox
            const images = Array.from(document.querySelectorAll('img'));
            for (const img of images) {
                if (img.src && typeof img.src === 'string' && img.src.includes('namu.wiki/i/')) {
                    // Usually the logo is the first high-res image
                    return img.src;
                }
            }
            return null;
        });

        if (imgSrc) {
            console.log(`Found logo URL: ${imgSrc}`);

            // Let's use page.goto to that image and get buffer, bypassing cloudflare
            const viewSource = await page.goto(imgSrc);
            const buffer = await viewSource.buffer();

            fs.writeFileSync(path.join(process.cwd(), 'public', 'images', 'logos', 'kleague', '용인.webp'), buffer);
            console.log('✅ Downloaded 용인.webp successfully!');
        } else {
            console.log('❌ Could not find logo URL on the page.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

run();
