
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    // const url = 'https://tickets.interpark.com/goods/21001949';
    // const url = 'https://tickets.interpark.com/goods/24017373'; // Original
    // const url = 'https://tickets.interpark.com/goods/25018267'; // User reported failure
    const url = 'https://tickets.interpark.com/goods/25018451'; // User reported missing price (Package)

    console.log(`Navigating to ${url}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    try {
        await page.waitForSelector('ul.info', { timeout: 5000 });
        console.log('Found ul.info');
    } catch (e) {
        console.log('ul.info not found instantly, waiting a bit...');
        await new Promise(r => setTimeout(r, 3000));
    }

    // Search for any "Price" related buttons if standard one fails
    console.log('Searching for Price buttons...');
    const buttons = await page.evaluate(() => {
        const candidates: { tag: string; text: string; class: string; outerHTML: string }[] = [];
        const all = document.querySelectorAll('button, a, .btn');
        all.forEach(el => {
            const txt = el.textContent?.trim() || '';
            if (txt.includes('전체가격') || txt.includes('가격') || txt.includes('자세히')) {
                candidates.push({
                    tag: el.tagName,
                    text: txt,
                    class: el.className,
                    outerHTML: el.outerHTML
                });
            }
        });
        return candidates;
    });
    console.log('--- Potential Price Buttons ---');
    console.log(JSON.stringify(buttons, null, 2));

    // Try to find 140,000 again globally
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log(`Body text contains '140,000': ${bodyText.includes('140,000')}`);
    console.log(`Body text contains '패키지': ${bodyText.includes('패키지')}`);

    // Scroll down to check for Discount Info
    await page.evaluate(() => window.scrollTo(0, 1000));
    await new Promise(r => setTimeout(r, 1000));

    const discountInfo = await page.evaluate(() => {
        // Look for "할인정보" text or header
        const headers = Array.from(document.querySelectorAll('h3, strong, div.title'));
        const discountHeader = headers.find(h => h.textContent?.includes('할인정보') || h.textContent?.includes('할인'));

        // Search for specific text user mentioned
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
        let node;
        const priceNodes = [];
        while (node = walker.nextNode()) {
            if (node.textContent?.includes('140,000')) {
                priceNodes.push({
                    text: node.textContent,
                    parentClass: node.parentElement?.className,
                    grandParentClass: node.parentElement?.parentElement?.className,
                    html: node.parentElement?.outerHTML
                });
            }
        }

        return {
            found: !!discountHeader,
            priceNodes
        };
    });
    console.log('--- Text Search Info ---');
    console.log(JSON.stringify(discountInfo, null, 2));

    const data = await page.evaluate(() => {
        const info = document.querySelector('div.summaryBody');
        return {
            html: info ? info.innerHTML : 'SummaryBody not found',
            text: info ? (info as HTMLElement).innerText : '',
            // Dump specific list items
            items: Array.from(document.querySelectorAll('ul.info > li')).map(li => ({
                label: li.querySelector('.label')?.textContent?.trim(),
                desc: li.querySelector('.desc')?.textContent?.trim(),
                html: li.innerHTML
            }))
        };
    });

    console.log('--- Inspector Output ---');
    console.log(JSON.stringify(data, null, 2));

    await browser.close();
})();
