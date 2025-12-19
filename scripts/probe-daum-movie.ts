
import puppeteer from 'puppeteer';

const QUERY = '무파사: 더 라이온 킹'; // A recent movie likely to have data

async function probe() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Search Daum
    const url = `https://search.daum.net/search?w=tot&q=${encodeURIComponent(QUERY + ' 영화')}`;
    console.log(`Going to ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Save HTML for inspection
    // fs.writeFileSync('debug_daum_movie.html', await page.content());

    // Try to find the grade
    const data = await page.evaluate(() => {
        // Daum usually puts basic info in a summary list or under the title
        // .c-item-content .item-contents dl ...
        // Looking for "등급" or direct values like "12세이상관람가"

        const bodyText = document.body.innerText;
        const gradeMatch = bodyText.match(/(전체|12세|15세|청소년)\s*(?:이상)?\s*(관람가|관람불가)/);

        // Specific selector attempts (based on common Daum mobile/desktop layouts)
        // Desktop often has a side box or top summary
        // Mobile (which puppeteer might trigger if responsive, but usually desktop by default)

        return {
            title: document.title,
            gradeFromRegex: gradeMatch ? gradeMatch[0] : null,
            // Try to find structured element
            infoText: document.querySelector('.c-item-content')?.textContent || ''
        };
    });

    console.log('Probe Result:', data);
    await browser.close();
}

probe();
