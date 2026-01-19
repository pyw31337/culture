
import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    const url = 'https://culture.seoul.go.kr/culture/culture/cultureEvent/view.do?cultcode=156108&menuNo=200110';

    await page.goto(url, { waitUntil: 'domcontentloaded' });

    const info = await page.evaluate(() => {
        const ul = document.querySelector('.type-box > ul');
        if (!ul) return null;

        return Array.from(ul.querySelectorAll('li')).map((li, i) => {
            const label = li.querySelector('.type-th')?.textContent?.trim();
            const value = li.querySelector('.type-td')?.textContent?.trim();
            return { i: i + 1, label, value };
        });
    });

    console.log(JSON.stringify(info, null, 2));
    await browser.close();
})();
