import { chromium } from 'playwright';

async function testNextData() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const url = 'https://tickets.interpark.com/goods/Y5000741';

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        const address = await page.evaluate(() => {
            const nextDataScript = document.getElementById('__NEXT_DATA__');
            if (nextDataScript) {
                try {
                    const data = JSON.parse(nextDataScript.textContent || '{}');
                    // We can just stringify and search for '제주' to see if it's there
                    const str = JSON.stringify(data);
                    const match = str.match(/.{0,50}제주.{0,50}/g);
                    return match ? match.join('\n') : 'No 제주 found in NEXT_DATA';
                } catch (e) { }
            }
            return 'No __NEXT_DATA__ found';
        });

        console.log("Desktop NEXT_DATA Check:", address);
    } finally {
        await browser.close();
    }
}

testNextData();
