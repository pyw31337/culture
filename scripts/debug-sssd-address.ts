import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

// Try sssd-0 which is showing 상세페이지 참조
const TARGET_URL = 'https://www.sssd.co.kr/m/class/detail/54262';

async function debug() {
    console.log('Starting Debug SSSD Address (problematic item sssd-0)...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=ko-KR']
    });

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        await page.setExtraHTTPHeaders({
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
        });

        await page.setCookie({
            name: 'SSSD_MW_LANG',
            value: 'ko-KR',
            domain: '.sssd.co.kr'
        });

        console.log(`Navigating to ${TARGET_URL}...`);
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for summary area
        try {
            await page.waitForSelector('.class-detail-summery-area', { timeout: 10000 });
        } catch (e) {
            console.log('.class-detail-summery-area NOT FOUND');
        }

        // Wait a bit more
        await new Promise(r => setTimeout(r, 2000));

        const info = await page.evaluate(() => {
            // 1. Check #placeCopy
            const placeCopy = document.querySelector('#placeCopy');
            const placeCopyInfo = placeCopy ? {
                html: placeCopy.outerHTML,
                dataClipboardText: placeCopy.getAttribute('data-clipboard-text')
            } : null;

            // 2. Check .detail-place
            const detailPlace = document.querySelector('.detail-place');
            const detailPlaceInfo = detailPlace ? {
                html: detailPlace.outerHTML,
                text: (detailPlace as HTMLElement).innerText.trim()
            } : null;

            // 3. Check .class-detail-summery-area
            const summaryArea = document.querySelector('.class-detail-summery-area');
            const summaryDivs = summaryArea ? Array.from(summaryArea.querySelectorAll(':scope > div')).map((d, i) => ({
                index: i,
                text: (d as HTMLElement).innerText.trim().substring(0, 100)
            })) : [];

            return { placeCopyInfo, detailPlaceInfo, summaryDivs };
        });

        console.log('Debug Info:', JSON.stringify(info, null, 2));

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

debug();
