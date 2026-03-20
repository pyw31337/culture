
import { firefox } from 'playwright';

(async () => {
    const browser = await firefox.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();

    const testItems = [
        '더 보이프렌드 시즌 2',
        '헬로카봇 12기 붐바',
        '진범인'
    ];

    for (const title of testItems) {
        // Try the same logic as scrape-ott.ts
        const query = `영화 ${title} 정보`; // Try generic first? Or drama?
        // scrape-ott tries: '영화 X 정보', 'X 드라마 정보', 'X 정보'

        console.log(`\n--- Testing Title: ${title} ---`);
        const queries = [`방송 ${title} 정보`, `${title} 정보`, `영화 ${title} 정보`]; // Adjusted for TV likelihood

        for (const q of queries) {
            console.log(`Query: ${q}`);
            await page.goto(`https://search.naver.com/search.naver?query=${encodeURIComponent(q)}`);
            try {
                // Wait for any likely content
                const content = await page.content();
                const hasCm = content.includes('cm_content_area');
                const hasCs = content.includes('cs_common_module');
                console.log(`  -> Has .cm_content_area? ${hasCm}`);
                console.log(`  -> Has .cs_common_module? ${hasCs}`);

                // Try to dump available info keys
                const keys = await page.evaluate(() => {
                    const dtList = Array.from(document.querySelectorAll('dt'));
                    return dtList.map(dt => dt.textContent?.trim());
                });
                console.log(`  -> Found keys: ${keys.slice(0, 10).join(', ')}...`);

            } catch (e) {
                console.log('Error:', e);
            }
        }
    }

    await browser.close();
})();
