
import { chromium } from 'playwright';

async function debugEnrichment() {
    const browser = await chromium.launch({ headless: true }); // Headless true to match env
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 1080 }
    });
    const page = await context.newPage();

    const item = {
        title: "러브 미",
        link: "https://search.naver.com/search.naver?where=nexearch&sm=tab_etc&mra=bjkw&pkid=57&os=36526619&qvt=0&query=%EB%9F%AC%EB%B8%8C%20%EB%AF%B8"
    };

    console.log(`--- DEBUG: ${item.title} ---`);
    console.log(`Link: ${item.link}`);

    try {
        await page.goto(item.link, { waitUntil: 'domcontentloaded' });

        // 1. Naver Basic
        const basicData = await page.evaluate(() => {
            const res: any = {};
            // Check Cast Section Existence
            const members = document.querySelectorAll('.sec_scroll_cast_member .card_item, ._actor_wrap .card_item, .cm_content_area._cast_area .card_item');
            res.castCount = members.length;
            res.membersHtmlSample = members.length > 0 ? members[0].outerHTML : 'none';
            return res;
        });
        console.log('Naver Basic:', basicData);

        // 2. Interactive Naver
        console.log('Trying Interactive Naver Tab...');
        const foundTab = await page.evaluate(() => {
            const tabs = Array.from(document.querySelectorAll('a, div[role="tab"]'));
            const t = tabs.find(el => el.textContent?.includes('출연진') || el.textContent?.includes('등장인물'));
            if (t) { (t as HTMLElement).click(); return true; }
            return false;
        });
        console.log(`Tab Clicked: ${foundTab}`);

        if (foundTab) {
            await page.waitForTimeout(2000);
            const castData = await page.evaluate(() => {
                const newCast: string[] = [];
                const members = document.querySelectorAll('.card_item, .area_link_box li, .list_info .item');
                members.forEach(m => {
                    const name = m.querySelector('strong.name, .name')?.textContent?.trim() || '';
                    if (name) newCast.push(name);
                });
                return newCast;
            });
            console.log('Naver Interactive Cast:', castData.slice(0, 5));
        }

        // 3. JustWatch Fallback
        console.log('Trying JustWatch Fallback...');
        const jwPage = await context.newPage();
        const sUrl = `https://www.justwatch.com/kr/검색?q=${encodeURIComponent(item.title)}`;
        await jwPage.goto(sUrl, { waitUntil: 'domcontentloaded' });

        const first = await jwPage.$('.title-list-row__row__header');
        if (first) {
            console.log('Clicked first JW result');
            await first.click();
            await jwPage.waitForTimeout(2000);

            const jwData = await jwPage.evaluate(() => {
                const cast: string[] = [];
                const newCards = document.querySelectorAll('.title-credits__actor');
                newCards.forEach(card => {
                    const img = card.querySelector('img');
                    const name = img?.getAttribute('alt') || img?.getAttribute('title');
                    if (name) cast.push(name);
                });
                return cast;
            });
            console.log('JustWatch Cast:', jwData.slice(0, 5));
        } else {
            console.log('No JW result found');
        }
        await jwPage.close();

    } catch (e) {
        console.error(e);
    }

    await browser.close();
}

debugEnrichment();
