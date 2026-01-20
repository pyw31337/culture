
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    const url = 'https://tickets.interpark.com/goods/25018267';

    // Matches scraper logic
    await page.setRequestInterception(true);
    page.on('request', (req: any) => {
        if (['image', 'media'].includes(req.resourceType())) {
            req.abort();
        } else {
            req.continue();
        }
    });

    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    console.log(`Navigating to ${url}...`);
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        console.log('Navigated.');

        await page.waitForSelector('ul.info', { timeout: 10000 });
        console.log('Selector found!');

        const info = await page.evaluate(() => {
            const list = document.querySelector('div.summaryBody > ul');
            return list ? list.innerHTML.length : 'No list';
        });
        console.log('Info length:', info);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
})();
