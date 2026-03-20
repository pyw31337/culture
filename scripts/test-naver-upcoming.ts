import { chromium } from 'playwright';

async function testNaverUpcoming() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const url = 'https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=%EA%B0%9C%EB%B4%89+%EC%98%88%EC%A0%95+%EC%98%81%ED%99%94&ackey=xhksrakn';
    console.log(`Navigating to ${url}`);

    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Naver upcoming movies are usually in a carousel `._panel` or something similar.
    // Let's dump the text content of the visible cards.
    const movies = await page.evaluate(() => {
        const results = [];
        // Look for the movie list cards
        const cards = document.querySelectorAll('.card_item, .data_area, .title_box');
        results.push(`Found ${cards.length} cards`);

        const validCards = Array.from(document.querySelectorAll('.info_box, .card_item, .movie_info'));
        validCards.forEach((c) => {
            const title = c.querySelector('strong, .name, .title')?.textContent?.trim() || '';
            const date = c.querySelector('.sub_text, .info_txt, dd')?.textContent?.trim() || '';
            if (title) results.push({ title, date });
        });

        return results;
    });

    console.log(movies);
    await browser.close();
}

testNaverUpcoming();
