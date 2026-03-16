// Test script for Mom-Mom price extraction fix
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const TEST_URLS = [
    'https://mom-mom.net/travel/places/6368a9ee94baf0f2c37c8ddc', // 경산시립박물관
    'https://mom-mom.net/travel/places/66a9933df24354583a0239db'  // 경기도어린이식품안전체험관 이천센터
];

(async () => {
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    for (const TEST_URL of TEST_URLS) {
        const page = await browser.newPage();
        console.log(`\nTesting extraction on: ${TEST_URL}`);
        await page.goto(TEST_URL, { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for content (specifically the section with the data)
        await page.waitForSelector('section', { timeout: 10000 }).catch(() => { });

        // Click toggles if any (mimicking scrape-mommom.ts)
        await page.evaluate(async () => {
            const toggles = Array.from(document.querySelectorAll('.toggle-title'));
            for (const toggle of toggles) {
                (toggle as HTMLElement).click();
                await new Promise(res => setTimeout(res, 200));
            }
        });

        const result = await page.evaluate(() => {
            let feesAndPrograms = '';
            let priceDetail = '';
            let operatingHours = '';
            
            // Re-implement the same logic from scrape-mommom.ts
            const allHeadings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, dt, span, b, p'));
            const feeHeader = allHeadings.find(h => h.textContent?.includes('요금 및 프로그램'));
            
            if (feeHeader) {
                const section = feeHeader.closest('section') || feeHeader.parentElement?.closest('div');
                if (section) {
                    const items = Array.from(section.querySelectorAll('li')).map(li => li.innerText.trim());
                    if (items.length > 0) {
                        feesAndPrograms = items.join('\n');
                        const feeIndex = items.findIndex(it => it.includes('[요금]'));
                        if (feeIndex !== -1 && items[feeIndex + 1]) {
                            priceDetail = items[feeIndex + 1];
                        }
                        const hoursIndex = items.findIndex(it => it.includes('[이용안내]'));
                        if (hoursIndex !== -1 && items[hoursIndex + 1]) {
                            operatingHours = items[hoursIndex + 1];
                        }
                    } else {
                        feesAndPrograms = (section as HTMLElement).innerText?.trim() || '';
                    }
                }
            }
            
            return { feesAndPrograms, priceDetail, operatingHours };
        });

        console.log('--- Result ---');
        console.log('Price Detail:', result.priceDetail);
        console.log('Operating Hours:', result.operatingHours);
        console.log('Fees and Programs (First 100 chars):', result.feesAndPrograms.substring(0, 100) + '...');
        await page.close();
    }

    await browser.close();
})();
