
import { chromium } from 'playwright';

async function inspect() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
        // Search for a known movie
        await page.goto('https://www.justwatch.com/kr/검색?q=오징어게임');
        await page.waitForTimeout(2000);

        // Click first result
        const first = await page.$('.title-list-row__row__header');
        if (first) {
            await first.click();
            await page.waitForTimeout(2000);

            // Inspect image
            const img = await page.$('picture.picture-comp img');
            if (img) {
                const src = await img.getAttribute('src');
                const dataSrc = await img.getAttribute('data-src');
                const alt = await img.getAttribute('alt');
                console.log('Found Image:', { src, dataSrc, alt });
            } else {
                console.log('Image selector failed. Dumping picture HTML:');
                const pic = await page.$('picture.picture-comp');
                if (pic) console.log(await pic.innerHTML());
                else console.log('No picture element found.');
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

inspect();
