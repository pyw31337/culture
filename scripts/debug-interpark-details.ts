import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const TARGET_URL = 'https://tickets.interpark.com/goods/26001154';

async function verifyDetailLogic() {
    console.log(`Verifying Detail Logic on: ${TARGET_URL}`);

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
            let runningTime = '';
            let ageRating = '';

            // 1. Selector Strategy (Mimic existing)
            const infoItems = Array.from(document.querySelectorAll('.infoList .infoItem, li.infoItem'));
            if (infoItems.length > 0) {
                infoItems.forEach(item => {
                    const label = item.querySelector('.infoLabel')?.textContent?.trim() || '';
                    const text = item.querySelector('.infoText')?.textContent?.trim() || '';

                    if (label.includes('공연시간') || label.includes('관람시간')) runningTime = text;
                    if (label.includes('관람연령') || label.includes('이용등급')) ageRating = text;
                });
            }

            // 2. Regex Fallback
            if (!runningTime || !ageRating) {
                const bodyText = document.body.innerText;

                if (!runningTime) {
                    const timeMatch = bodyText.match(/공연시간\s*\n*([0-9]+분)/);
                    if (timeMatch) runningTime = timeMatch[1];
                }

                if (!ageRating) {
                    const ageMatch = bodyText.match(/관람연령\s*\n*(.*?관람가능|.*?\s이상)/);
                    if (ageMatch) ageRating = ageMatch[1].trim();
                }
            }

            return { runningTime, ageRating };
        });

        console.log('--- EXTRACTION RESULT ---');
        console.log(JSON.stringify(result, null, 2));

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}

verifyDetailLogic();
