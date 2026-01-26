import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

// Target URL with detailed pricing
const TARGET_URL = 'https://tickets.interpark.com/goods/25018004';

async function verifyPricingLogic() {
    console.log(`Verifying Logic on: ${TARGET_URL}`);

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    try {
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 30000 });
        console.log('Page loaded.');

        // Wait for dynamic content
        await new Promise(r => setTimeout(r, 2000));

        // Inject and run the EXACT logic we added to scrape-interpark.ts
        const result = await page.evaluate(() => {
            let price = '';
            let originalPrice = '';
            let discount = '';

            // 1. Try finding detailed text list first
            const detailContainer = document.querySelector('.prdPriceDetail');

            if (detailContainer) {
                const text = detailContainer.textContent || '';
                const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

                let normalPrice = 0;
                let salePrice = 0;

                lines.forEach(line => {
                    // Adjusted regex to match what's in the DOM (often LI elements text)
                    const match = line.match(/(.*?)\s*([0-9,]+)원/);
                    if (match) {
                        const label = match[1];
                        const val = parseInt(match[2].replace(/,/g, ''), 10);

                        if (label.includes('정상가')) {
                            normalPrice = val;
                        } else if (label.includes('예매가') || label.includes('할인가')) {
                            salePrice = val;
                        } else if (!salePrice && !normalPrice) {
                            salePrice = val;
                        }
                    }
                });

                if (normalPrice > 0 && salePrice > 0) {
                    originalPrice = normalPrice.toLocaleString() + '원';
                    price = salePrice.toLocaleString() + '원';
                    const rateVal = Math.round((1 - (salePrice / normalPrice)) * 100);
                    discount = `${rateVal}%`;
                } else if (salePrice > 0) {
                    price = salePrice.toLocaleString() + '원';
                }
            }

            return { price, originalPrice, discount, rawText: detailContainer?.textContent };
        });

        console.log('--- EXTRACTION RESULT ---');
        console.log(JSON.stringify(result, null, 2));

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}

verifyPricingLogic();
