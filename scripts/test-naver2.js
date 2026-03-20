const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://search.naver.com/search.naver?query=소년시대');
    
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
