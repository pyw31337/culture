
import { firefox } from 'playwright';

(async () => {
    const browser = await firefox.launch({ headless: true });

    const targets = [
        { name: 'JustWatch', url: 'https://www.justwatch.com/kr/new' },
        { name: 'Naver Search (Netflix)', url: 'https://search.naver.com/search.naver?query=%EB%84%B7%ED%94%8C%EB%A6%AD%EC%8A%A4+%EC%8B%A0%EC%9E%91' },
        { name: 'Daum Search', url: 'https://search.daum.net/search?w=tot&DA=YZR&t__nil_searchbox=btn&sug=&sugo=&sq=&o=&q=%EB%84%B7%ED%94%8C%EB%A6%AD%EC%8A%A4+%EC%8B%A0%EC%9E%91' },
        { name: 'TMDB', url: 'https://www.themoviedb.org/?language=ko' }
    ];

    console.log('--- Probing Alternative Sources ---');

    for (const target of targets) {
        process.stdout.write(`Testing ${target.name}... `);
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        const page = await context.newPage();

        try {
            const response = await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: 15000 });
            const status = response?.status();
            console.log(`Status: ${status}`);

            if (status === 200) {
                // Quick content check
                const title = await page.title();
                console.log(`  -> Title: ${title}`);

                // For JustWatch, check if we see content items
                if (target.name === 'JustWatch') {
                    const selector = '.timeline__item, .horizontal-title-list__item';
                    try {
                        const count = await page.evaluate((s) => document.querySelectorAll(s).length, selector);
                        console.log(`  -> Items found: ${count}`);
                    } catch (e) { console.log('  -> Could not count items'); }
                }
            } else {
                console.log('  -> Blocked or Error');
            }
        } catch (e) {
            if (e instanceof Error) console.log(`Error: ${e.message}`);
        }
        await context.close();
    }

    await browser.close();
})();
