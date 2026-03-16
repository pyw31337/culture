
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const TARGET_URL = 'https://mom-mom.net/search?q=%EB%B0%95%EB%AC%BC%EA%B4%80/%EC%B2%B4%ED%97%98%EA%B4%80&hl=places';

async function checkList() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    try {
        console.log(`Navigating to ${TARGET_URL}...`);
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        // Scroll a bit to load more
        console.log('Scrolling...');
        await page.evaluate(async () => {
            for (let i = 0; i < 20; i++) {
                window.scrollBy(0, 1000);
                await new Promise(r => setTimeout(r, 200));
            }
        });

        const items = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a[href*="/travel/places/"]')).map((a: any) => ({
                href: a.href,
                text: a.innerText.trim()
            }));
        });

        const targetFound = items.find(it => it.href.includes('6507a66e53e91cf1df2b57f2') || it.text.includes('hy팩토리'));
        
        console.log('Total items in list:', items.length);
        console.log('Target Found:', targetFound);
        
        if (!targetFound) {
            console.log('Sample of items found:');
            console.log(items.slice(0, 10));
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}

checkList();
