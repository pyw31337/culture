
import { firefox } from 'playwright';

(async () => {
    const browser = await firefox.launch({ headless: true });
    const page = await browser.newPage();

    // Test Case: Ghost Doctor (User provided example)
    const URL = 'https://www.justwatch.com/kr/TV-프로그램/goseuteu-dagteo/시즌-1';

    console.log(`Navigating to ${URL}...`);
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const debugData = await page.evaluate(() => {
        const results: any = {};

        // 1. Age Rating (User: #title-detail-hero-details > div > div > div:nth-child(4))
        const heroDetails = document.querySelector('#title-detail-hero-details');
        if (heroDetails) {
            // Log all children text to see where rating is
            const children = Array.from(heroDetails.querySelectorAll('div > div > div')).map(d => d.textContent?.trim());
            results.heroChildren = children;
            // Best guess for rating (usually short, e.g. "15", "12")
        }

        // 2. Director (User: .poster-detail--below > div:nth-child(1) ...)
        const detailRows = document.querySelectorAll('.poster-detail.poster-detail--below > div');
        results.detailRowCount = detailRows.length;

        detailRows.forEach((row, idx) => {
            const label = row.querySelector('.detail-infos__subheading')?.textContent?.trim();
            const value = row.querySelector('.detail-infos__value')?.textContent?.trim();
            if (label) results[`row_${idx}_${label}`] = value;
        });

        // 3. Cast (User: .credits)
        const credits = document.querySelector('.credits');
        if (credits) {
            const names = Array.from(credits.querySelectorAll('.title-credit-name')).map(n => n.textContent?.trim());
            results.cast = names.slice(0, 5);
        }

        // 4. Runtime (User didn't specify, but we need it)
        // Usually in hero details too

        return results;
    });

    console.log('--- Detail Selector Debug Results ---');
    console.log(JSON.stringify(debugData, null, 2));

    await browser.close();
})();
