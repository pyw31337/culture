
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function probe() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    const url = 'https://timeticket.co.kr/product/5938'; // Trick Eye Museum

    console.log(`Visiting ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    const data = await page.evaluate(() => {
        const boxes = document.querySelectorAll('.viewpage_text.radius_box');

        return Array.from(boxes).map((box, idx) => ({
            index: idx,
            text: (box as HTMLElement).innerText
        }));
    });

    console.log('Probe Result:', JSON.stringify(data, null, 2));
    await browser.close();
}

probe();
