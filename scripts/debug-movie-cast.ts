
import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const q = '아바타: 불과 재 영화';
    const url = `https://search.naver.com/search.naver?query=${encodeURIComponent(q)}`;

    console.log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // 1. Check for tab
    const tabFound = await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('a, div[role="tab"], li[role="tab"]'));
        return tabs.map(t => t.textContent?.trim()).filter(t => t && t.includes('출연'));
    });
    console.log('Tabs found:', tabFound);

    // 2. Click tab logic
    const clicked = await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('a, div[role="tab"], li[role="tab"]'));
        const t = tabs.find(el => {
            const txt = el.textContent?.trim() || '';
            return txt.includes('출연') || txt.includes('등장인물');
        });
        if (t) {
            (t as HTMLElement).click();
            return true;
        }
        return false;
    });
    console.log('Tab clicked:', clicked);

    if (clicked) await page.waitForTimeout(2000);

    // 3. Inspect Content Areas
    const debug = await page.evaluate(() => {
        const areas = Array.from(document.querySelectorAll('.cm_content_area, .api_subject_bx'));
        return areas.map(a => {
            const title = a.querySelector('h2, h3, .cm_title')?.textContent?.trim();
            const items = Array.from(a.querySelectorAll('.card_item, .area_card, li, .item'));
            // If it's the cast section, print item details
            if (title && (title.includes('출연') || title.includes('감독'))) {
                return {
                    title,
                    itemCount: items.length,
                    sampleItems: items.slice(0, 3).map(i => i.textContent?.trim())
                };
            }
            return { title, itemCount: items.length };
        });
    });
    console.log('Content Areas:', JSON.stringify(debug, null, 2));

    await browser.close();
})();
