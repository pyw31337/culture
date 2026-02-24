import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const TARGET_URL = 'https://tickets.interpark.com/goods/26000756';

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

    try { await page.waitForSelector('.infoList', { timeout: 5000 }); } catch (e) { }

    const data = await page.evaluate(() => {
        const getText = (selector: string, parent: Element | Document = document) =>
            parent.querySelector(selector)?.textContent?.trim() || '';

        let price = '';
        const priceItems = Array.from(document.querySelectorAll('.infoList .infoItem .infoDesc .priceList .priceItem, .infoPriceList .infoPriceItem, .infoPriceItem'));
        const detailContainer = document.querySelector('.prdPriceDetail');

        if (detailContainer) {
            const text = detailContainer.textContent || '';
            const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            let normalPrice = 0, salePrice = 0;
            lines.forEach(line => {
                const match = line.match(/(.*?)\s*([0-9,]+)원/);
                if (match) {
                    const label = match[1];
                    const val = parseInt(match[2].replace(/,/g, ''), 10);
                    if (label.includes('정상가')) normalPrice = val;
                    else if (label.includes('예매가') || label.includes('할인가')) salePrice = val;
                    else if (!salePrice && !normalPrice) salePrice = val;
                }
            });
            if (salePrice > 0) price = salePrice.toLocaleString() + '원';
        }

        if (!price && priceItems.length > 0) {
            let bestItem = priceItems.find(i => i.querySelector('.sale') && i.querySelector('.price'));
            if (!bestItem) bestItem = priceItems.find(i => i.querySelector('.sale'));
            if (!bestItem) bestItem = priceItems.find(i => i.querySelector('.price')); // Fallback
            if (!bestItem) bestItem = priceItems[0];

            if (bestItem) {
                const getVal = (cls: string) => bestItem?.querySelector(cls)?.textContent?.trim() || '';
                const sale = getVal('.sale');
                const priceVal = getVal('.price');
                const rate = getVal('.rate');

                if (sale && priceVal && rate) price = sale;
                else if (sale) price = sale;
                else if (priceVal) price = priceVal;
            }
        }

        if (!price) {
            const priceText = getText('.infoItem.infoPrice .infoDesc');
            if (priceText) {
                const match = priceText.match(/([0-9,]+원)/);
                if (match) price = match[1];
                else price = priceText;
            }
        }

        let originalPrice = '';
        let discount = '';

        return { price, priceItemsLen: priceItems.length };
    });

    console.log(data);
    await browser.close();
})();
