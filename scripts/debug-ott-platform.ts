import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function debugOTT() {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });

    console.log('Navigating...');
    await page.goto('https://m.kinolights.com/new?tab=upcoming', { waitUntil: 'networkidle2' });

    // Log all platform headers
    const debugInfo = await page.evaluate(() => {
        const wraps = document.querySelectorAll('.contents-wrap');
        return Array.from(wraps).map(wrap => {
            const icon = wrap.querySelector('.streaming-info .kino-icon');
            const title = wrap.querySelector('.streaming-info h3')?.textContent?.trim();
            const items = wrap.querySelectorAll('.MovieItem').length;
            return {
                iconClass: icon ? icon.className : 'NO ICON',
                title,
                itemCount: items
            };
        });
    });

    console.log('Debug Info:', JSON.stringify(debugInfo, null, 2));
    await browser.close();
}

debugOTT();
