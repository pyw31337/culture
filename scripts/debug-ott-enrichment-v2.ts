
import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    // Test cases from ott.json failures
    const items = [
        { title: "그물" },
        { title: "육사오" } // 6/45 often searched as 육사오. Let's try both or just 육사오 if 6/45 is tricky? JustWatch says "6/45". I will attempt "육사오(6/45)" if needed, but script cleans title. Let's try "육사오" first as it is the Korean title. Actually, in ott.json it is "6/45". Scraper uses item.title. "6/45" might be searched as "6/45" on Naver?
    ];

    for (const item of items) {
        console.log(`\n\n--- Testing: ${item.title} ---`);

        // Cleaning Logic from scraper
        const cleanTitle = item.title
            .split(/[:\–-]\s*시즌|[:\–-]\s*\d+기/)[0]
            .replace(/[:\–-]\s*Season\s*\d+/i, '')
            .replace(/[【】\[\]()~^!]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        console.log(`Cleaned Title: "${cleanTitle}"`);

        const queries = [
            `${cleanTitle} 정보`,
            `${cleanTitle} 드라마`,
            item.title
        ];

        for (const q of queries) {
            console.log(`Searching: ${q}`);
            const searchUrl = `https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(q)}`;
            await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });

            // Wait a bit to see
            await page.waitForTimeout(2000);

            // Check detection
            const found = await page.evaluate(() => {
                const infoBox = document.querySelector('.cm_info_box');
                const detailInfo = document.querySelector('.api_subject_bx .detail_info');
                return {
                    hasInfoBox: !!infoBox,
                    hasDetailInfo: !!detailInfo,
                    // Dump PARENT html (api_subject_bx) to see headers/icons
                    headerHtml: document.querySelector('.api_subject_bx')?.innerHTML.substring(0, 3000) || 'N/A',
                    htmlSnippet: infoBox ? infoBox.innerHTML.substring(0, 2000) : 'N/A',
                    innerText: infoBox ? (infoBox as HTMLElement).innerText : 'N/A',
                    hasGradeInBody: document.body.innerText.includes('관람가') || document.body.innerText.includes('등급'),
                    fullBodyText: document.body.innerText.substring(0, 5000) // snippet
                };
            });

            console.log('Detection:', found);

            if (found.hasInfoBox || found.hasDetailInfo) {
                console.log('SUCCESS: Info box found!');
                // Try Parsing
                const parsed = await page.evaluate(() => {
                    const res: any = {};
                    const infoBox = document.querySelector('.cm_info_box');
                    if (infoBox) {
                        // Pre-process: Replace separators with |
                        // Clone to avoid modifying live DOM if needed, but here it's fine
                        const clone = infoBox.cloneNode(true) as HTMLElement;
                        const separators = clone.querySelectorAll('.cm_bar_info, .cm_bar');
                        separators.forEach(el => el.textContent = '|');

                        const dts = clone.querySelectorAll('dt');
                        dts.forEach(dt => {
                            const k = dt.textContent?.trim() || '';
                            // Next Sibling might be DD. But with clone, use nextElementSibling
                            const vText = dt.nextElementSibling?.textContent?.trim() || '';

                            if (k.includes('장르')) res.subGenre = vText;
                            if (k.includes('국가')) res.productionCountry = vText;
                            if (k.includes('출연')) res.cast = vText;

                            if (k.includes('개요')) {
                                const parts = vText.split('|').map(s => s.trim()).filter(Boolean);
                                parts.forEach(part => {
                                    if (part.match(/\d+분/)) {
                                        res.runningTime = part;
                                    } else if (['한국', '대한민국', '미국', '일본', '중국', '영국', '프랑스', '독일'].some(c => part.includes(c)) && part.length < 10) {
                                        res.productionCountry = part;
                                    } else {
                                        if (!part.match(/\d{4}\.\d{2}\.\d{2}/)) {
                                            res.subGenre = part;
                                        }
                                    }
                                });
                            }
                        });
                    }

                    if (!res.ageRating) {
                        const bodyText = document.body.innerText;
                        const ratingMatch = bodyText.match(/(?:제한|전체|12세|15세|18세|19세)(?:\s*이상)?\s*관람가/);
                        if (ratingMatch) res.ageRating = ratingMatch[0];
                        else if (bodyText.includes('청소년 관람불가')) res.ageRating = '청소년 관람불가';
                    }

                    return res;
                });
                console.log('Parsed partial:', parsed);
                break; // Stop after first success
            }
        }
    }

    await browser.close();
})();
