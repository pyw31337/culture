
const puppeteer = require('puppeteer');

const QUERY = '나우 유 씨 미 3';

async function probe() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Search Daum
    const url = `https://search.daum.net/search?w=tot&q=${encodeURIComponent(QUERY + ' 영화')}`;
    console.log(`Going to ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2' });

    const data = await page.evaluate(() => {
        const result = {};

        function getDDText(key) {
            const dts = Array.from(document.querySelectorAll('dt'));
            const target = dts.find(dt => dt.textContent && dt.textContent.includes(key));
            if (target && target.nextElementSibling && target.nextElementSibling.tagName === 'DD') {
                return target.nextElementSibling;
            }
            return null;
        }

        const castEl = getDDText('출연');
        if (castEl) {
            result.cast = castEl.textContent.trim();
            // Get anchors
            result.castList = Array.from(castEl.querySelectorAll('a')).map(a => a.textContent.trim()).filter(Boolean);
        }

        const dirEl = getDDText('감독');
        if (dirEl) {
            result.director = dirEl.textContent.trim();
        }

        const infoEl = getDDText('개요');
        if (infoEl) {
            result.infoRaw = infoEl.textContent.trim();
        }

        return result;
    });

    console.log('Probe Result:', data);
    await browser.close();
}

probe();
