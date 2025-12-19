import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const TARGET_URL = 'https://www.sssd.co.kr/m/search/class/category?midx=all';

async function debug() {
    console.log('Starting Debug SSSD Image...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=ko-KR']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        await page.setCookie({
            name: 'SSSD_MW_LANG',
            value: 'ko-KR',
            domain: '.sssd.co.kr'
        });

        console.log(`Navigating to ${TARGET_URL}...`);
        await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for list
        const listSelector = '#classCategoryBody > div.search-result-panel > div > div.search-result-list.list-type-1.p-l-0.p-r-0.no-padding > ul > li';
        await page.waitForSelector(listSelector);

        // Analyze the 11th item (index 10)
        console.log('Analyzing 11th item...');
        const debugInfo = await page.evaluate((selector) => {
            const items = document.querySelectorAll(selector);
            const target = items[10]; // 11th item
            if (!target) return 'Item not found';

            const html = target.outerHTML;
            const imgDiv = target.querySelector('div.list-img > div');
            const style = imgDiv ? imgDiv.getAttribute('style') : 'No imgDiv';
            const imgTag = target.querySelector('img');

            return {
                html: html.substring(0, 500), // First 500 chars to avoid huge log
                style: style,
                imgTagSrc: imgTag ? imgTag.src : 'No img tag',
                imgOuterHTML: imgTag ? imgTag.outerHTML : 'No img tag',
                listImgHTML: target.querySelector('.list-img')?.outerHTML
            };
        }, listSelector);

        console.log('Debug Info:', JSON.stringify(debugInfo, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

debug();
