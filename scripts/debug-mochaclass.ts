
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const TARGET_URLS = [
    'https://mochaclass.com/class/619f98cca6f0394e051b47b7',
    'https://mochaclass.com/class/5fb7793a97a6250df96b1584'
];

async function debugMochaAddress() {
    console.log(`Debugging Mocha Class Address Extraction...`);

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    for (const url of TARGET_URLS) {
        console.log(`\nNavigating to: ${url}`);
        try {
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
            await new Promise(r => setTimeout(r, 2000)); // Wait for render

            const result = await page.evaluate(() => {
                // User suggested: #topleft > div:nth-child(11) > div > p...
                // This seems very brittle. Let's look for "위치" or "주소" text context.

                // Strategy 1: User's suggestion (approximate)
                // We'll search for elements containing address-like text

                const allParagraphs = Array.from(document.querySelectorAll('p, div, span'));
                const addressCandidates = allParagraphs
                    .map(p => p.textContent?.trim() || '')
                    .filter(text => text.includes('서울특별시') || text.includes('경기도') || text.includes('인천광역시') || (text.includes('구') && text.includes('동') && text.includes('로')));

                // Strategy 2: Look for '위치' Label
                // Usually these sites have a "Location" or "Place" section header

                const bodyText = document.body.innerText;
                const locationMatch = bodyText.match(/위치\s*\n*(.+)/);

                return {
                    candidates: [...new Set(addressCandidates)].slice(0, 5), // Top 5 unique
                    match: locationMatch ? locationMatch[1] : null,
                    // url
                };
            });

            console.log('Extraction Result:', JSON.stringify(result, null, 2));

        } catch (e) {
            console.error(`Error processing ${url}:`, e);
        }
    }

    await browser.close();
}

debugMochaAddress();
