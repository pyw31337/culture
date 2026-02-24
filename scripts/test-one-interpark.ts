import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

const outputPath = path.resolve(process.cwd(), 'src/data/interpark.json');

(async () => {
    const raw = fs.readFileSync(outputPath, 'utf-8');
    const data = JSON.parse(raw);
    const p = data.find((x: any) => x.id === '19000923');

    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    try {
        await page.goto(p.link, { waitUntil: 'domcontentloaded', timeout: 30000 });
        try { await page.waitForSelector('.infoList, .infoItem.infoPrice', { timeout: 3000 }); } catch (e) { }

        const dataExt = await page.evaluate(function () {
            function getText(selector: string, parent: Element | Document = document) {
                return parent.querySelector(selector)?.textContent?.trim() || '';
            }

            let price = '';
            let originalPrice = '';
            let discount = '';

            const priceItems = Array.from(document.querySelectorAll('.infoList .infoItem .infoDesc .priceList .priceItem, .infoPriceList .infoPriceItem, .infoPriceItem'));
            const detailContainer = document.querySelector('.prdPriceDetail');

            if (detailContainer) {
                const text = detailContainer.textContent || '';
                const lines = text.split('\n').map(function (l) { return l.trim(); }).filter(function (l) { return l.length > 0; });
                let normalPrice = 0, salePrice = 0;
                lines.forEach(function (line) {
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
                const validPriceItems = priceItems.filter(i => {
                    const text = i.textContent || '';
                    return !text.includes('전체가격보기') && (i.querySelector('.price') || i.querySelector('.sale') || text.includes('원'));
                });

                let bestItem = validPriceItems.find(i => i.querySelector('.sale') && i.querySelector('.price'));
                if (!bestItem) bestItem = validPriceItems.find(i => i.querySelector('.sale'));
                if (!bestItem) bestItem = validPriceItems.find(i => i.querySelector('.price'));
                if (!bestItem && validPriceItems.length > 0) bestItem = validPriceItems[0];

                if (bestItem) {
                    const sale = bestItem.querySelector('.sale')?.textContent?.trim() || '';
                    const priceVal = bestItem.querySelector('.price')?.textContent?.trim() || '';
                    const rate = bestItem.querySelector('.rate')?.textContent?.trim() || '';

                    if (sale && priceVal && rate) {
                        price = sale;
                        originalPrice = priceVal;
                        discount = rate;
                    } else if (sale) {
                        price = sale;
                    } else if (priceVal) {
                        price = priceVal;
                    } else {
                        const text = bestItem.textContent || '';
                        const match = text.match(/([0-9,]+원)/);
                        if (match) price = match[1];
                    }
                }
            }

            if (!price) {
                const dlPriceText = getText('.infoItem.infoPrice .infoDesc');
                if (dlPriceText && !dlPriceText.includes('전체가격보기')) {
                    const match = dlPriceText.match(/([0-9,]+원)/);
                    if (match) price = match[1];
                    else price = dlPriceText;
                }
            }

            if (price && !/[0-9]/.test(price)) {
                price = '';
            }

            if (!price) {
                const genericItems = Array.from(document.querySelectorAll('.infoItem, .infoPriceItem'));
                for (let el of genericItems) {
                    const txt = el.textContent || '';
                    if (!txt.includes('전체가격보기') && txt.match(/[0-9,]{3,}원/)) {
                        const match = txt.match(/([0-9,]{3,}원)/);
                        if (match) {
                            price = match[1];
                            break;
                        }
                    }
                }
            }

            return {
                price, originalPrice, discount, debugValidPriceItems: (() => {
                    return priceItems.filter(i => {
                        const text = i.textContent || '';
                        return !text.includes('전체가격보기') && (i.querySelector('.price') || i.querySelector('.sale') || text.includes('원'));
                    }).map(i => i.textContent);
                })()
            };
        });

        console.log("Data extracted:", dataExt);
    } finally {
        await browser.close();
    }
})();
