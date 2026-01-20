
import { firefox } from 'playwright';

async function debugScraper() {
    const browser = await firefox.launch({ headless: true }); // headless: true for server environment
    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    console.log('--- DEBUG START ---');

    // 1. JustWatch Debug
    const jwUrl = 'https://www.justwatch.com/kr/TV-프로그램/ceos-beonjjae-namja/시즌-1';
    console.log(`\nVisiting JustWatch: ${jwUrl}`);
    await page.goto(jwUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const jwData = await page.evaluate(() => {
        const res: any = {};
        // Cast Selector Check
        const cards = document.querySelectorAll('.title-credits__actors .presentation-actor-card, .credits .credits__actor-item');
        res.castCount = cards.length;
        res.castSample = Array.from(cards).slice(0, 3).map(c => c.textContent?.trim());

        // Age Rating Check
        const heroDivs = Array.from(document.querySelectorAll('#title-detail-hero-details > div > div > div, .title-info > div'));
        res.heroTexts = heroDivs.map(d => d.textContent?.trim());

        return res;
    });
    console.log('JustWatch Data:', JSON.stringify(jwData, null, 2));


    // 2. Naver Debug
    const query = '첫 번째 남자 정보';
    const naverUrl = `https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(query)}`;
    console.log(`\nVisiting Naver: ${naverUrl}`);
    await page.goto(naverUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const naverData = await page.evaluate(() => {
        const res: any = {};
        res.hasInfoBox = !!document.querySelector('.cm_info_box');

        // Age Rating
        const dts = document.querySelectorAll('.cm_info_box dt');
        res.dtTexts = Array.from(dts).map(dt => dt.textContent?.trim());

        // Cast
        const castBox = document.querySelector('.cast_box');
        res.hasCastBox = !!castBox;
        if (castBox) {
            res.castSample = Array.from(castBox.querySelectorAll('.name')).map(n => n.textContent?.trim()).slice(0, 3);
        }

        // Tab Check
        const castTab = document.querySelector('li[data-tab-name="cast"] a, a[href*="cast"]');
        res.hasCastTab = !!castTab;

        return res;
    });
    console.log('Naver Data:', JSON.stringify(naverData, null, 2));

    await browser.close();
}

debugScraper();
