
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function probe() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Try Region 115 (Seoul)
    const url = 'https://timeticket.co.kr/list.php?category=2123&area=115';
    console.log(`Visiting ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    const count = await page.evaluate(() => {
        return document.querySelectorAll('.ticket_list_wrap > a').length;
    });
    console.log(`Region 115 Items: ${count}`);

    // Try Region 120 (Gyeonggi)
    const url2 = 'https://timeticket.co.kr/list.php?category=2123&area=120';
    console.log(`Visiting ${url2}...`);
    await page.goto(url2, { waitUntil: 'domcontentloaded' });

    const count2 = await page.evaluate(() => {
        return document.querySelectorAll('.ticket_list_wrap > a').length;
    });
    console.log(`Region 120 Items: ${count2}`);

    // Try Without Area
    const url3 = 'https://timeticket.co.kr/list.php?category=2123';
    console.log(`Visiting ${url3}...`);
    await page.goto(url3, { waitUntil: 'domcontentloaded' });

    const count3 = await page.evaluate(() => {
        return document.querySelectorAll('.ticket_list_wrap > a').length;
    });
    console.log(`No Area Items: ${count3}`);

    await browser.close();
}

probe();
