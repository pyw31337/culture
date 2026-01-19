
import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    // I AM BOXER URL
    const url = 'https://search.naver.com/search.naver?where=nexearch&sm=tab_etc&mra=bjkw&pkid=57&os=36905286&qvt=0&query=%EC%95%84%EC%9D%B4%20%EC%97%A0%20%EB%B3%B5%EC%84%9C';
    console.log('Navigating to:', url);
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Test Click
    const castTabSelector = 'a[href*="cast"], a:has-text("출연진"), ._main_tab a:has-text("출연진")';
    const castTab = await page.$(castTabSelector);

    if (castTab) {
        console.log('Found Cast Tab. Clicking...');
        await castTab.click();
        await page.waitForTimeout(3000); // Wait longer for debug

        console.log('Checking DOM after click...');

        const debug = await page.evaluate(() => {
            const cmArea = document.querySelector('.cm_content_area');
            const items = document.querySelectorAll('.item');
            const cardItems = document.querySelectorAll('.card_item');
            const areaLinks = document.querySelectorAll('.area_link_box');

            return {
                hasCmArea: !!cmArea,
                cmAreaClasses: cmArea?.className,
                itemCount: items.length,
                cardItemCount: cardItems.length,
                areaLinkCount: areaLinks.length,
                // Sample first item structure if exists
                firstItemHTML: items[0]?.outerHTML.substring(0, 200) || 'N/A'
            };
        });
        console.log('DOM Debug:', debug);

        // Try Extraction
        const cast = await page.evaluate(() => {
            const newCast: string[] = [];
            // Try very broad selector
            const members = document.querySelectorAll('.cm_content_area .item, .cm_content_area .card_item');
            members.forEach(m => {
                const name = m.querySelector('.name')?.textContent?.trim() || m.querySelector('a._text')?.textContent?.trim();
                if (name) newCast.push(name);
            });
            return newCast;
        });
        console.log('Extracted Cast:', cast);

    } else {
        console.log('Cast Tab NOT FOUND');
    }

    await browser.close();
})();
