
import { chromium } from 'playwright';

async function testJustWatchPoster(title: string) {
    console.log(`Testing JustWatch Poster Extraction for: ${title}`);
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        const sUrl = `https://www.justwatch.com/kr/검색?q=${encodeURIComponent(title)}`;
        await page.goto(sUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });

        // Click first result
        const first = await page.$('.title-list-row__row__header');
        if (first) {
            await first.click();
            await page.waitForTimeout(2000);

            const data = await page.evaluate(() => {
                const res: any = {};
                // Poster
                const ogImg = document.querySelector('meta[property="og:image"]');
                if (ogImg) {
                    res.poster = ogImg.getAttribute('content');
                    res.source = 'og:image';
                } else {
                    const img = document.querySelector('picture.picture-comp img');
                    if (img) {
                        res.poster = img.getAttribute('data-src') || img.getAttribute('src');
                        res.source = 'picture';
                    }
                }
                return res;
            });
            console.log('Result:', data);
        } else {
            console.log('No results found.');
            const content = await page.textContent('body');
            console.log('Body Text Snippet:', content?.substring(0, 500));
        }

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

testJustWatchPoster('오징어게임');
