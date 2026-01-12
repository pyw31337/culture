
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    const URL = 'https://www.koreabaseball.com/Futures/Schedule/GameList.aspx';

    console.log(`Navigating to ${URL}...`);
    await page.goto(URL, { waitUntil: 'networkidle2' });

    // User selector: #cphContents_cphContents_cphContents_udpRecord > ul
    const data = await page.evaluate(() => {
        const ul = document.querySelector('#cphContents_cphContents_cphContents_udpRecord > ul');
        if (!ul) return { error: 'UL not found' };

        const items = Array.from(ul.querySelectorAll('li'));
        const entries = items.map(li => {
            const img = li.querySelector('img');
            const span = li.querySelector('span');
            return {
                name: span?.textContent?.trim(),
                logo: img?.src
            };
        });

        // Also check for table
        const table = document.querySelector('.tbl-schedule');
        // Note: KBO usually uses tblScheduleList id, or class tbl-schedule?
        // Let's check common selectors
        const tblId = document.querySelector('#tblScheduleList');
        const tblClass = document.querySelector('.tbl-schedule');

        return {
            logos: entries,
            hasTableId: !!tblId,
            hasTableClass: !!tblClass,
            firstRow: tblId ? tblId.querySelector('tbody tr')?.innerHTML : null
        };
    });

    console.log('Extracted Data:', JSON.stringify(data, null, 2));
    await browser.close();
})();
