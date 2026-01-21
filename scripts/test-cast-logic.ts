
import { chromium } from 'playwright';

async function testCastLogic() {
    const browser = await chromium.launch({ headless: false });
    const targets = [
        {
            name: '경도를 기다리며 (Waiting for Gyeong-do)',
            url: 'https://search.naver.com/search.naver?where=nexearch&sm=tab_etc&mra=bkEw&pkid=57&os=36344374&qvt=0&query=%EA%B2%BD%EB%8F%84%EB%A5%BC%20%EA%B8%B0%EB%8B%A4%EB%A6%AC%EB%A9%B0'
        },
        {
            name: '러브 미 (Love Me)',
            url: 'https://search.naver.com/search.naver?where=nexearch&sm=tab_etc&mra=bkEw&pkid=57&os=31998595&qvt=0&query=%EB%9F%AC%EB%B8%8C%20%EB%AF%B8'
        },
        {
            name: '나는 SOLO (I AM SOLO)',
            url: 'https://search.naver.com/search.naver?where=nexearch&sm=tab_etc&mra=bkEw&pkid=57&os=23974400&qvt=0&query=%EB%82%98%EB%8A%94%20SOLO'
        }
    ];

    for (const t of targets) {
        const page = await browser.newPage();
        console.log(`\nTesting ${t.name}...`);
        await page.goto(t.url, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2000);

        // 1. Try generic extraction first
        let cast = await page.evaluate(() => {
            const members = document.querySelectorAll('.sec_scroll_cast_member .card_item, ._actor_wrap .card_item, .cm_content_area._cast_area .card_item, .cast_box .name, .detail_info .name');
            const list: string[] = [];
            members.forEach(m => {
                let name = m.querySelector('.name')?.textContent?.trim() || m.querySelector('a._text')?.textContent?.trim() || m.textContent?.trim() || '';
                if (name && !name.includes('출연') && name.length < 20) list.push(name);
            });
            return list;
        });

        console.log('Initial Cast:', cast);

        // 2. Try clicking tabs if empty
        if (cast.length === 0) {
            console.log('Cast empty, looking for tabs...');
            const clicked = await page.evaluate(() => {
                const tabs = Array.from(document.querySelectorAll('a, div[role="tab"], span[role="button"]'));
                // Look for '출연', '등장인물', '제작'
                const t = tabs.find(el => {
                    const txt = el.textContent?.trim() || '';
                    return txt.includes('출연') || txt.includes('등장인물') || txt.includes('제작') || txt.includes('참가');
                });
                if (t) {
                    (t as HTMLElement).click();
                    return t.textContent?.trim();
                }
                return false;
            });

            if (clicked) {
                console.log(`Clicked tab: ${clicked}`);
                await page.waitForTimeout(2000);

                // Inspect DOM after click
                const debugData = await page.evaluate(() => {
                    const castArea = document.querySelector('.api_subject_bx .cm_content_area');
                    return {
                        htmlPreview: castArea ? castArea.innerHTML.substring(0, 500) : 'No cm_content_area found',
                        possibleNames: Array.from(document.querySelectorAll('strong, .name, .title')).slice(0, 10).map(e => e.textContent?.trim())
                    };
                });
                console.log('Debug DOM:', debugData);

                // Try extraction again with broad selector
                const newCast = await page.evaluate(() => {
                    const members = document.querySelectorAll('.cast_box .name, .detail_info .name, ._actor_wrap .card_item, li .name a, .area_card .title');
                    const list: string[] = [];
                    members.forEach(m => {
                        const txt = m.textContent?.trim();
                        if (txt && txt.length < 20) list.push(txt);
                    });
                    return list;
                });
                console.log('Post-Click Cast:', newCast);
            } else {
                console.log('No Cast tab found.');
            }
        }

        await page.close();
    }
    await browser.close();
}

testCastLogic();
