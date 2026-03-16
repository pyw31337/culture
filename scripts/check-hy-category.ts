
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function checkCategory(url: string) {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    try {
        await page.goto(url, { waitUntil: 'networkidle2' });
        const info = await page.evaluate(() => {
            const crumbs = Array.from(document.querySelectorAll('.breadcrumb, [class*="category"], [class*="tag"]'));
            return {
                text: document.body.innerText.includes('박물관/체험관'),
                allTags: Array.from(document.querySelectorAll('span, a')).map(el => el.innerText.trim()).filter(t => t.length > 0 && t.length < 20).slice(0, 50)
            };
        });
        console.log(JSON.stringify(info, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

checkCategory('https://mom-mom.net/travel/places/6507a66e53e91cf1df2b57f2');
