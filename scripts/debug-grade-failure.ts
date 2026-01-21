
import { chromium } from 'playwright';

async function debugGradeFailure() {
    const browser = await chromium.launch({ headless: false }); // Headless false to see what happens
    const page = await browser.newPage();

    // User provided URL
    const url = 'https://search.naver.com/search.naver?where=nexearch&sm=tab_etc&mra=bkEw&pkid=68&os=35046360&qvt=0&query=%EC%98%81%ED%99%94%20%EC%96%BC%EA%B5%B4';

    console.log('Visiting:', url);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // 1. Initial Check
    let initialData = await page.evaluate(() => {
        const text = document.body.innerText;
        return {
            hasAge: text.includes('15세 이상 관람가'),
            infoGroups: document.querySelectorAll('.info_group').length
        };
    });
    console.log('Initial Data:', initialData);

    // 2. Click "기본정보" Tab
    console.log('Attempting to find and click "기본정보" tab...');

    const clicked = await page.evaluate(async () => {
        const tabs = Array.from(document.querySelectorAll('a, span[role="button"]'));
        const targetTab = tabs.find(el => {
            const t = el.textContent?.trim();
            return t === '기본정보' || t === '정보';
        });

        if (targetTab) {
            (targetTab as HTMLElement).click();
            return true;
        }
        return false;
    });

    if (clicked) {
        console.log('Clicked tab. Waiting...');
        await page.waitForTimeout(2000);

        // 3. Check Data again
        let afterClickData = await page.evaluate(() => {
            const patterns = {
                age: /(전체\s*관람가|전체\s*시청가|\d{1,2}세\s*(?:이상)?\s*(?:관람가|시청가)?|청소년\s*관람불가|청불|미성년자\s*관람불가)/,
            };
            const text = document.body.innerText;
            const match = text.match(patterns.age);

            // Check structure
            const detailInfo = document.querySelector('.detail_info');
            return {
                hasAge: text.includes('15세 이상 관람가'),
                matchedAge: match ? match[0] : null,
                detailHTML: detailInfo ? detailInfo.innerHTML : 'No .detail_info found',
                structure: detailInfo ? {
                    hasDL: !!detailInfo.querySelector('dl'),
                    hasDT: !!detailInfo.querySelector('dt'),
                    hasDD: !!detailInfo.querySelector('dd'),
                    childTags: Array.from(detailInfo.children).map(c => c.tagName)
                } : null
            };
        });
        console.log('After Click Data:', afterClickData);
    } else {
        console.log('Failed to find "기본정보" tab.');
    }

    await browser.close();
}

debugGradeFailure();
