
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    const url = 'https://tickets.interpark.com/goods/21001949';
    // const url = 'https://tickets.interpark.com/goods/24017373'; // Another example if needed

    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    try {
        await page.waitForSelector('ul.info', { timeout: 5000 });
        console.log('Found ul.info');
    } catch (e) {
        console.log('ul.info not found instantly, waiting a bit...');
        await new Promise(r => setTimeout(r, 3000));
    }

    const priceBtn = await page.$('a[data-popup="info-price"]');
    if (priceBtn) {
        console.log('Clicking Price Button...');
        await priceBtn.click();
        await new Promise(r => setTimeout(r, 1000)); // Wait for popup

        // Dump Price Popup
        const pricePopup = await page.evaluate(() => {
            const popup = document.querySelector('#popup-info-price');
            return popup ? popup.innerHTML : 'Price Popup Not Found';
        });
        console.log('--- Price Popup HTML ---');
        console.log(pricePopup);
    } else {
        console.log('Price Button Not Found');
    }

    // Scroll down to check for Discount Info
    await page.evaluate(() => window.scrollTo(0, 1000));
    await new Promise(r => setTimeout(r, 1000));

    const discountInfo = await page.evaluate(() => {
        // Look for "할인정보" text or header
        const headers = Array.from(document.querySelectorAll('h3, strong, div.title'));
        const discountHeader = headers.find(h => h.textContent?.includes('할인정보') || h.textContent?.includes('할인'));
        if (discountHeader) {
            // Try to get content below it
            return {
                found: true,
                text: (discountHeader.parentElement as HTMLElement)?.innerText || 'Header found but no context'
            };
        }
        return { found: false };
    });
    console.log('--- Discount Info ---');
    console.log(JSON.stringify(discountInfo, null, 2));

    const data = await page.evaluate(() => {
        const info = document.querySelector('div.summaryBody');
        return {
            html: info ? info.innerHTML : 'SummaryBody not found',
            text: info ? (info as HTMLElement).innerText : '',
            // Dump specific list items
            items: Array.from(document.querySelectorAll('ul.info > li')).map(li => ({
                label: li.querySelector('.label')?.textContent?.trim(),
                desc: li.querySelector('.desc')?.textContent?.trim(),
                html: li.innerHTML
            }))
        };
    });

    console.log('--- Inspector Output ---');
    console.log(JSON.stringify(data, null, 2));

    await browser.close();
})();
