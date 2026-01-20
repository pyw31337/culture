
import { firefox } from 'playwright';

async function debugScraper() {
    const browser = await firefox.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log('--- DEBUG 2 START ---');

    // 1. JustWatch DOM Inspection
    const jwUrl = 'https://www.justwatch.com/kr/TV-프로그램/ceos-beonjjae-namja/시즌-1';
    console.log(`\nVisiting JW: ${jwUrl}`);
    await page.goto(jwUrl, { waitUntil: 'domcontentloaded' });

    const jwDump = await page.evaluate(() => {
        // Find any element containing "출연" or "Cast" or actor names
        // Let's dump class names of sections
        const sections = Array.from(document.querySelectorAll('div[class*="credits"], div[class*="title-info"]'));
        return sections.map(s => ({
            className: s.className,
            textSample: s.textContent?.substring(0, 50)
        }));
    });
    console.log('JW Sections:', JSON.stringify(jwDump, null, 2));


    // 2. Naver Interaction Test
    const query = '첫 번째 남자 정보';
    const naverUrl = `https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(query)}`;
    console.log(`\nVisiting Naver: ${naverUrl}`);
    await page.goto(naverUrl, { waitUntil: 'domcontentloaded' });

    // Find tab
    const tabSelector = 'div.api_subject_bx .tab_area a[href*="cast"], li[data-tab-name="cast"] a';
    const tab = await page.$(tabSelector);
    if (tab) {
        console.log('Found Cast Tab. Clicking...');
        await tab.click();
        await page.waitForTimeout(2000); // 2s wait

        // Check for cast box now
        const castCount = await page.evaluate(() => {
            return document.querySelectorAll('.cast_box .name').length;
        });
        console.log(`Cast names found after click: ${castCount}`);

        if (castCount === 0) {
            const htmlDump = await page.content();
            console.log('Dump close to cast box:', htmlDump.substring(htmlDump.indexOf('cast_box') - 100, htmlDump.indexOf('cast_box') + 500));
        }
    } else {
        console.log('Cast Tab NOT found with selector: ' + tabSelector);
    }

    await browser.close();
}

debugScraper();
