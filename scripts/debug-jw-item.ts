
import { firefox } from 'playwright';

const URL = 'https://www.justwatch.com/kr/TV-프로그램/ossomae-bulgeun-ggeutdong/시즌-1';

(async () => {
    const browser = await firefox.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: 'domcontentloaded' });

    // Dump HTML
    const data = await page.evaluate(() => {
        return {
            title: document.title,
            url: window.location.href,
            html: document.querySelector('.title-detail')?.innerHTML || 'No .title-detail found',
            bodyClass: document.body.className
        };
    });

    console.log(JSON.stringify(data, null, 2));
    await browser.close();
})();
