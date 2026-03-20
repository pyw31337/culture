const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://search.naver.com/search.naver?query=넷플릭스 신작');
    
    // Get the first item's link
    const firstLink = await page.$eval('li.info_box a._text', el => el.href);
    console.log("Found link:", firstLink);
    
    await page.goto(firstLink);
    
    // Dump all info_groups
    const infos = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.info_group, .detail_info dl, .cm_content_area .info_group')).map(g => {
            const dt = g.querySelector('dt');
            const dd = g.querySelector('dd');
            return {
                dt: dt ? dt.textContent.trim() : null,
                dd: dd ? dd.textContent.trim() : null
            };
        });
    });
    
    console.log("Extracted Infos:", infos);
    await browser.close();
})();
