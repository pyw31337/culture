
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function testDetail(url: string) {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    try {
        console.log(`Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for dynamic content
        await page.waitForSelector('.toggle-title', { timeout: 10000 }).catch(() => { });

        // Screenshot for visual audit
        await page.screenshot({ path: 'debug_hy_factory.png', fullPage: true });

        // Extract raw hidden content info
        const content = await page.evaluate(() => {
            const results: any = {};
            
            // 1. Toggles
            const toggles = Array.from(document.querySelectorAll('.toggle-title'));
            results.toggles = toggles.map(t => ({
                title: t.textContent?.trim(),
                nextText: t.nextElementSibling?.textContent?.trim()
            }));

            // 2. Headings & Parents
            const allElements = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, dt, span, b, p, section, div, li'));
            results.feeSection = allElements.find(el => el.textContent?.includes('요금 및 프로그램'))?.parentElement?.innerText;
            
            // 3. Specific List Items
            results.listItems = Array.from(document.querySelectorAll('li')).map(li => li.innerText.trim()).filter(t => t.length > 0).slice(0, 50);

            // 4. Raw text of everything
            results.bodyText = document.body.innerText.slice(0, 5000);

            return results;
        });

        console.log('--- Toggle Titles Found ---');
        console.log(content.toggles);
        
        console.log('\n--- Fee Section Found ---');
        console.log(content.feeSection?.slice(0, 500));

        console.log('\n--- Sample List Items ---');
        console.log(content.listItems.slice(0, 20));

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}

testDetail('https://mom-mom.net/travel/places/6507a66e53e91cf1df2b57f2');
