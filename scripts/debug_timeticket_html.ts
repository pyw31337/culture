
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

puppeteer.use(StealthPlugin());

async function debugHtml() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1024 });

    const url = 'https://timeticket.co.kr/list.php?category=2096&area=114';
    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2' });

    const html = await page.evaluate(() => {
        const item = document.querySelector('section.wrap_1100 > div.ticket_list_wrap > a');
        return item ? item.outerHTML : 'Item not found';
    });

    console.log('--- HTML DUMP START ---');
    console.log(html);
    console.log('--- HTML DUMP END ---');

    fs.writeFileSync('timeticket_item_dump.html', html);

    await browser.close();
}

debugHtml();
