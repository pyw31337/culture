
const puppeteer = require('puppeteer');

const QUERY = '나우 유 씨 미 3';

async function probe() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Set Mobile UA
    await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
    await page.setViewport({ width: 390, height: 844 });

    const url = `https://search.daum.net/search?w=tot&q=${encodeURIComponent(QUERY + ' 영화')}`;
    console.log(`Going to ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Debug: screenshot
    // await page.screenshot({ path: 'debug_daum_mobile.png' });

    const data = await page.evaluate(() => {
        const result = {};

        // Debug: list all DTs
        const dts = Array.from(document.querySelectorAll('dt')).map(dt => dt.textContent.trim());
        result.allDTs = dts;

        // Try User Selector
        const userSel = '#em1Coll > div > div.cont_info > div.c-item-exact > div.item-content > dl';
        const dl = document.querySelector(userSel);
        result.dlFound = !!dl;
        if (dl) {
            result.dlHTML = dl.innerHTML;
        }

        return result;
    });

    console.log('Probe Result:', data);
    await browser.close();
}

probe();
