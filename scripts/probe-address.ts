
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

    // Evaluate and dump potential address containers
    const data = await page.evaluate(() => {
        // 1. Try to find the text "주소 :" anywhere
        const bodyText = document.body.innerText;
        const addressMatch = bodyText.match(/주소\s*[:]\s*([^\n]+)/);

        // 2. Dump specific elements that might contain it
        // The user mentioned "장소: ... · 주소: ..."
        // This suggests it might be in the same line or block.

        // Let's look for elements containing "주소"
        const elementsWithAddress = [];
        const all = document.body.getElementsByTagName('*');
        for (let i = 0; i < all.length; i++) {
            if (all[i].children.length === 0 && all[i].textContent?.includes('주소')) {
                elementsWithAddress.push({
                    tag: all[i].tagName,
                    class: all[i].className,
                    text: all[i].textContent,
                    parentClass: all[i].parentElement?.className
                });
            }
        }

        return {
            fullTextMatch: addressMatch ? addressMatch[0] : 'No regex match',
            elements: elementsWithAddress.slice(0, 5) // Top 5
        };
    });

    console.log('Probe Result:', JSON.stringify(data, null, 2));
    await browser.close();
}

probe();
