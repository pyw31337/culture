
import { firefox } from 'playwright';

async function verifyFixes() {
    const browser = await firefox.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('--- VERIFICATION START ---');

    // 1. JustWatch New Selector Test
    const jwUrl = 'https://www.justwatch.com/kr/TV-프로그램/ceos-beonjjae-namja/시즌-1';
    console.log(`\nVisiting JW: ${jwUrl}`);
    await page.goto(jwUrl, { waitUntil: 'domcontentloaded' });

    const jwCast = await page.evaluate(() => {
        const items: any[] = [];
        const newCards = document.querySelectorAll('.title-credits__actor');
        newCards.forEach(card => {
            const img = card.querySelector('img');
            const nameFromImg = img?.getAttribute('alt') || img?.getAttribute('title');
            if (nameFromImg) {
                items.push(nameFromImg);
            } else {
                let text = card.textContent?.trim() || '';
                const roleEl = card.querySelector('.title-credits__actor--role');
                if (roleEl && roleEl.textContent) {
                    text = text.replace(roleEl.textContent, '').trim();
                }
                if (text) items.push(text);
            }
        });
        return items;
    });
    console.log('JustWatch Cast Found:', jwCast.slice(0, 5));


    // 2. Naver New Tab Logic Test
    const query = '첫 번째 남자 정보';
    const naverUrl = `https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(query)}`;
    console.log(`\nVisiting Naver: ${naverUrl}`);
    await page.goto(naverUrl, { waitUntil: 'domcontentloaded' });

    // Test logic similar to scraper
    const castCount = await page.evaluate(async () => {
        const links = Array.from(document.querySelectorAll('.tab_area a, .api_subject_bx a, .menu_group a'));
        const castTab = links.find(a => a.textContent?.includes('출연') || a.textContent?.includes('제작'));

        if (castTab) {
            castTab.click();
            // We can't wait in evaluate easily without a promise wrapper or setTimeout logic, 
            // but for this test we'll assume click triggers.
            return 'CLICKED_TAB';
        }
        return 'TAB_NOT_FOUND';
    });

    if (castCount === 'CLICKED_TAB') {
        console.log('Tab clicked. Waiting...');
        await page.waitForTimeout(2000);
        const names = await page.evaluate(() => {
            const els = Array.from(document.querySelectorAll('.cast_box .name, .detail_info .name'));
            return els.map(e => e.textContent?.trim());
        });
        console.log('Naver Cast Found:', names.slice(0, 5));
    } else {
        console.log('Naver Tab Logic Failed');
    }

    await browser.close();
}

verifyFixes();
