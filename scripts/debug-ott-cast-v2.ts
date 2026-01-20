
import { chromium } from 'playwright';

async function debugCast() {
    const targets = [
        'https://www.justwatch.com/kr/TV-프로그램/cagane/시즌-1',
        'https://www.justwatch.com/kr/TV-프로그램/korean-pork-belly-rhapsody/시즌-1',
        'https://www.justwatch.com/kr/TV-프로그램/deocyi-jeonjaeng/시즌-1'
    ];

    const browser = await chromium.launch({ headless: true }); // Headless true for speed, change if needed
    const page = await browser.newPage();

    for (const url of targets) {
        console.log(`\nChecking: ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000); // Hydration

        // Simulate Scroll
        await page.mouse.wheel(0, 1000);
        await page.waitForTimeout(1000);

        const castData = await page.evaluate(() => {
            const castItems: any[] = [];

            // Selector 1: Presentation Actor Card
            const cards = document.querySelectorAll('.title-credits__actors .presentation-actor-card');
            cards.forEach(card => {
                const name = card.querySelector('.presentation-actor-card__name')?.textContent?.trim();
                if (name) castItems.push({ type: 'presentation', name });
            });

            // Selector 2: Credits Actor Item (hidden credits)
            const credits = document.querySelectorAll('.credits .credits__actor-item');
            credits.forEach(item => {
                const name = item.querySelector('.credits__actor-item-name')?.textContent?.trim();
                if (name) castItems.push({ type: 'credits', name });
            });

            // Selector 3: Headings Fallback
            const allH = Array.from(document.querySelectorAll('h2, h3'));
            const castH = allH.find(h => h.textContent?.includes('출연진') || h.textContent?.includes('Cast'));
            let headingCast: any[] = [];
            if (castH && castH.nextElementSibling) {
                const links = castH.nextElementSibling.querySelectorAll('a');
                links.forEach(a => {
                    const name = a.querySelector('.presentation-actor-card__name')?.textContent?.trim() || a.textContent?.trim();
                    if (name) headingCast.push({ type: 'heading', name });
                });
            }

            return {
                presentationCount: cards.length,
                creditsCount: credits.length,
                headingFound: !!castH,
                headingCastCount: headingCast.length,
                items: [...castItems, ...headingCast]
            };
        });

        console.log('Result:', JSON.stringify(castData, null, 2));
    }

    await browser.close();
}

debugCast().catch(console.error);
