import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 800 });

        console.log("Navigating to goods/19000923...");
        await page.goto('https://tickets.interpark.com/goods/19000923', { waitUntil: 'networkidle2', timeout: 30000 });

        const result = await page.evaluate(() => {
            try {
                function getOuterHtml(selector: string) {
                    const el = document.querySelector(selector);
                    return el ? el.outerHTML : null;
                }

                const bodyText = document.body ? document.body.innerText : '';

                const priceContainerInfo = getOuterHtml('.infoPrice');
                const infoItems = Array.from(document.querySelectorAll('.infoItem')).map(e => e.textContent?.trim());
                const infoList = getOuterHtml('.infoList');

                const popupBtn1 = getOuterHtml('[data-popup="info-price"]');
                const popupBtn2 = Array.from(document.querySelectorAll('a, button')).find(e => e.textContent?.includes('전체가격보기'))?.outerHTML;

                return {
                    infoItems,
                    infoListSnippet: infoList ? infoList.substring(0, 1000) : 'none',
                    priceContainerInfo,
                    popupBtn1,
                    popupBtn2,
                    hasPriceKeyword: bodyText.includes('가격') || bodyText.includes('원\n') || bodyText.includes('할인특가'),
                    bodySnippet: bodyText.substring(0, 500)
                };
            } catch (err: any) {
                return { error: err.toString() };
            }
        });

        console.log("RESULT:", JSON.stringify(result, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();
