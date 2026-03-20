import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

const outputPath = path.resolve(process.cwd(), 'src/data/interpark.json');

async function fixPrices() {
    const raw = fs.readFileSync(outputPath, 'utf-8');
    const data = JSON.parse(raw);

    const targets = data.filter((p: any) => (!p.price || !/[0-9]/.test(p.price)) || (p.price === "" && (p.runningTime !== "" || p.ageRating !== "")));
    console.log(`총 ${targets.length}건의 가격 누락 항목이 발견되었습니다.`);
    if (targets.length === 0) return;

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    let fixedCount = 0;
    const CONCURRENCY = 10;

    for (let i = 0; i < targets.length; i += CONCURRENCY) {
        const chunk = targets.slice(i, i + CONCURRENCY);

        const promises = chunk.map(async (p: any) => {
            const page = await browser.newPage();
            try {
                await page.setViewport({ width: 1440, height: 900 });
                await page.goto(p.link, { waitUntil: 'domcontentloaded', timeout: 30000 });
                try { await page.waitForSelector('.infoList, .infoItem.infoPrice', { timeout: 3000 }); } catch (e) { }

                const dataExt = await page.evaluate(function () {
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
                        const dlPriceText = document.querySelector('.infoItem.infoPrice .infoDesc')?.textContent?.trim() || '';
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

                    return { price, originalPrice, discount };
                });

                if (dataExt && dataExt.price) {
                    p.price = dataExt.price;
                    if (dataExt.originalPrice) p.originalPrice = dataExt.originalPrice;
                    if (dataExt.discount) p.discount = dataExt.discount;
                    return p.id;
                }
                return null;
            } catch (e: any) {
                return null;
            } finally {
                await page.close();
            }
        });

        const results = await Promise.all(promises);
        const chunkSuccess = results.filter(r => r !== null).length;
        fixedCount += chunkSuccess;
        console.log(`Processed batch ${i / CONCURRENCY + 1}/${Math.ceil(targets.length / CONCURRENCY)}. Fixed ${chunkSuccess} items.`);

        fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    }

    await browser.close();
    console.log(`Fixed ${fixedCount} out of ${targets.length} missing prices.`);
}

fixPrices();
