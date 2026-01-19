import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function debugOTTXPath() {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });

    const targetUrl = 'https://m.kinolights.com/title/148118';
    console.log(`Navigating to ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: 'networkidle2' });

    const data = await page.evaluate(() => {
        function getText(label: string) {
            const dts = Array.from(document.querySelectorAll('dt'));
            const targetDt = dts.find(dt => dt.textContent?.includes(label));
            return targetDt?.nextElementSibling?.textContent?.trim() || '';
        }

        const getCast = () => {
            // Find "출연진/제작진" section
            // Look for names followed by "주연" or "조연"
            // This is trickier depending on DOM. 
            // Let's try to find the "출연진/제작진" header and then look for list items.
            const header = Array.from(document.querySelectorAll('h3, h4, div')).find(el => el.textContent?.trim() === '출연진/제작진');
            if (!header) return ['HEADER_NOT_FOUND'];

            // Assuming a list follows. Collect text of first 5 items.
            // Heuristic strategies...
            // Let's just return the next 500 chars after the header to debug structure if easy selectors fail.
            // Or try to select typical list items.

            // Try specific class if possible (from previous debug? nope)
            // Let's assume standard list.
            return ['Structured extraction requires inspection.'];
        };

        return {
            genre: getText('장르'),
            runtime: getText('러닝타임'),
            grade: getText('연령등급'),
            director: getText('감독'), // Might be tricky if it's in a list
        };
    });

    console.log('XPath Debug:', JSON.stringify(data, null, 2));
    await browser.close();
}

debugOTTXPath();
