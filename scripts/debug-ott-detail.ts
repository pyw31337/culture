
import { chromium } from 'playwright';

const URLS = [
    'https://www.justwatch.com/kr/TV-%ED%94%84%EB%A1%9C%EA%B7%B8%EB%9E%A8/ceosibe-banhada/%EC%8B%9C%EC%A6%8C-1', // First Love Again (Genre: OTT issue)
    'https://www.justwatch.com/kr/TV-%ED%94%84%EB%A1%9C%EA%B7%B8%EB%9E%A8/idol-i/%EC%8B%9C%EC%A6%8C-1', // Idol I (Genre: OTT issue)
    'https://www.justwatch.com/kr/TV-%ED%94%84%EB%A1%9C%EA%B7%B8%EB%9E%A8/rob-reiner-story-hollywood-tragedy/season-1', // Rob Reiner (Redundant Runtime if any)
    'https://www.justwatch.com/kr/%EC%98%81%ED%99%94/seupeuring-pibeo', // Spring Fever (Poster quality)
];

async function scrapeJWDetail(page: any, url: string) {
    console.log(`\nNavigating to ${url}...`);
    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);

        return await page.evaluate(() => {
            const res: any = {};

            // 1. Hero Details
            const heroDivs = Array.from(document.querySelectorAll('#title-detail-hero-details > div > div > div'));
            res._debugHeroDivs = heroDivs.map(d => d.textContent?.trim());

            heroDivs.forEach(div => {
                const text = div.textContent?.trim() || '';
                if (text === 'ALL' || text === '전체' || text === 'G' || text === 'All') res.ageRating = '전체 관람가';
                else if (text.match(/^\d+$/)) {
                    const num = parseInt(text);
                    if (num > 0 && num < 20) res.ageRating = `${num}세 관람가`;
                }
                else if (text.match(/\d+세/)) res.ageRating = text;
                else if (text.includes('청불') || text.includes('청소년')) res.ageRating = '청소년 관람불가';

                if (text.includes('분') || text.includes('min') || text.match(/\d+h/)) {
                    res.runningTime = text;
                }
            });

            // 2. Sidebar
            const headers = Array.from(document.querySelectorAll('h3, .detail-infos__subheading, .detail-infos__detail--heading'));
            res._debugSidebar = headers.map(h => `${h.textContent?.trim()}: ${h.nextElementSibling?.textContent?.trim()}`);

            headers.forEach(h => {
                const label = h.textContent?.trim().toLowerCase();
                let valueDiv = h.nextElementSibling;
                if (!valueDiv) return;
                let value = valueDiv.textContent?.trim() || '';

                if (label?.includes('genre') || label?.includes('장르')) {
                    if (value.includes('Documentary') || value.includes('다큐멘터리')) res.subGenre = '다큐멘터리';
                    else res.subGenre = value;
                }
                if (label?.includes('runtime') || label?.includes('재생 시간')) {
                    res.runningTime = value;
                }
                if (label?.includes('rating') || label?.includes('등급')) {
                    res.ageRating = value;
                }
            });

            // Poster
            const img = document.querySelector('picture > img');
            if (img) res.poster = img.getAttribute('src') || img.getAttribute('data-src');

            return res;
        });
    } catch (e) {
        console.error(`Error:`, e);
        return {};
    }
}

async function main() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    for (const url of URLS) {
        try {
            const data = await scrapeJWDetail(page, url);
            console.log('Result:', JSON.stringify(data, null, 2));
        } catch (e) {
            console.error(e);
        }
    }

    await browser.close();
}

main();
