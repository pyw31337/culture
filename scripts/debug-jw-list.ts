
import { firefox } from 'playwright';

(async () => {
    const browser = await firefox.launch({ headless: true });
    const page = await browser.newPage();

    // JustWatch New Releases
    const URL = 'https://www.justwatch.com/kr/new';

    console.log(`Navigating to ${URL}...`);
    await page.goto(URL, { waitUntil: 'domcontentloaded' });

    // Scroll a bit
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(2000);

    // Test User Selectors
    const debugData = await page.evaluate(() => {
        const results: any = {};

        // 1. Release Date (User Selector)
        // #base > div:nth-child(4) > div.container-fluid.container-max-width.new-page__content > div > div > div.timeline__timeframe.timeline__timeframe--2026-01-15 > span > span > span
        // Note: The ID #base might change or be #root. The date suffix changes.
        // We will try to find *ANY* timeframe matching the structure.

        const timeframes = document.querySelectorAll('.timeline__timeframe');
        results.timeframesFound = timeframes.length;

        if (timeframes.length > 0) {
            const firstFrame = timeframes[0];
            results.firstFrameClass = firstFrame.className;

            // Check Date Text
            const dateEl = firstFrame.querySelector('span > span > span');
            results.dateText = dateEl ? dateEl.textContent : 'Not Found';

            // Check Provider Block
            // .timeline__provider-block
            const providerBlock = firstFrame.querySelector('.timeline__provider-block');
            if (providerBlock) {
                // User Selector: .timeline__provider-block... > div > div.provider-timeline > picture > img
                const icon = providerBlock.querySelector('.provider-timeline img');
                results.platformIcon = icon ? icon.getAttribute('alt') || icon.getAttribute('title') : 'Not Found';

                // Items
                const items = providerBlock.querySelectorAll('.horizontal-title-list__item');
                results.itemsCount = items.length;

                if (items.length > 0) {
                    const firstItem = items[0];
                    const titleImg = firstItem.querySelector('img');
                    results.firstItemTitle = titleImg ? titleImg.getAttribute('alt') : 'Not Found';
                    results.firstItemPoster = titleImg ? titleImg.getAttribute('data-src') || titleImg.getAttribute('src') : 'Not Found';
                }
            }
        }

        return results;
    });

    console.log('--- Selector Debug Results ---');
    console.log(JSON.stringify(debugData, null, 2));

    await browser.close();
})();
