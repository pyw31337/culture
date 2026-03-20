import { chromium } from 'playwright';

async function testNaverCarousel() {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        const url = 'https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=%EA%B0%9C%EB%B4%89+%EC%98%88%EC%A0%95+%EC%98%81%ED%99%94&ackey=xhksrakn';
        console.log(`Navigating to ${url}`);

        await page.goto(url, { waitUntil: 'domcontentloaded' });

        const allMovies = new Map();

        // Check if there is a next button in the carousel
        let hasNext = true;
        let clicks = 0;

        while (hasNext && clicks < 30) {
            // Extract visible items
            const newMovies = await page.evaluate(() => {
                const results: any[] = [];
                const cards = document.querySelectorAll('.info_box, .card_item');
                cards.forEach(c => {
                    const title = c.querySelector('strong, .name, .title')?.textContent?.trim();
                    const info = c.querySelector('.sub_text, .info_txt, dd')?.textContent?.trim();
                    const dDayMatch = c.textContent?.match(/D-(\d+)/);
                    if (title) {
                        results.push({
                            title,
                            info,
                            dDay: dDayMatch ? parseInt(dDayMatch[1]) : null
                        });
                    }
                });
                return results;
            });

            newMovies.forEach(m => allMovies.set(m.title, m));

            // Try to click Next
            hasNext = await page.evaluate(() => {
                const nextBtn = document.querySelector('a.pg_next, .btn_next, button.next');
                if (nextBtn && !nextBtn.hasAttribute('aria-disabled') && !nextBtn.classList.contains('disabled')) {
                    const el = nextBtn as HTMLElement;
                    if (window.getComputedStyle(el).display !== 'none') {
                        el.click();
                        return true;
                    }
                }
                return false;
            });

            if (hasNext) {
                await page.waitForTimeout(500);
            }
            clicks++;
        }

        console.log(`Found ${allMovies.size} upcoming movies.`);
        console.log(Array.from(allMovies.values()).slice(0, 5));
        console.log("...");
        console.log(Array.from(allMovies.values()).slice(-5));

    } finally {
        await browser.close();
    }
}

testNaverCarousel();
