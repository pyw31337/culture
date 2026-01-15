
import { chromium } from 'playwright';

const ITEM = { title: "【최애의 아이】 - 시즌 3" };

async function runDebug() {
    const browser = await chromium.launch({ headless: true }); // Headless true for speed, can toggle false to see
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    console.log(`Debugging Item: ${ITEM.title}`);

    // --- COPY OF ENRICHMENT LOGIC ---
    const cleanTitle = ITEM.title
        .split(/[:\–-]\s*시즌|[:\–-]\s*\d+기/)[0]
        .replace(/[:\–-]\s*Season\s*\d+/i, '')
        .replace(/[【】\[\]()~^!]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const queries = [
        `${ITEM.title} 정보`,
        ITEM.title !== cleanTitle ? `${cleanTitle} 정보` : null,
        `${cleanTitle} 영화`,
        `${cleanTitle} 드라마`,
        cleanTitle
    ].filter(Boolean) as string[];

    const uniqueQueries = [...new Set(queries)];
    console.log("Queries:", uniqueQueries);

    let foundPage = false;

    for (const q of uniqueQueries) {
        console.log(`Searching: ${q}`);
        const searchUrl = `https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(q)}`;
        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 5000 });

        const found = await page.evaluate(() => {
            return !!document.querySelector('.cm_info_box') || !!document.querySelector('.api_subject_bx .detail_info');
        });

        if (found) {
            console.log("FOUND InfoBox/DetailInfo!");
            foundPage = true;
            break;
        }
    }

    if (!foundPage) {
        console.log("Failed to find any info page.");
        await browser.close();
        return;
    }

    // --- EXTRACTION LOGIC (Copied from scrape-ott.ts) ---
    const naverData = await page.evaluate(() => {
        const res: any = {};
        const infoBox = document.querySelector('.cm_info_box');

        if (infoBox) {
            console.log("Parsing infoBox..."); // Will log in browser context (needs 'on console' handler or blind trust)
            const dts = infoBox.querySelectorAll('dt');
            dts.forEach(dt => {
                const k = dt.textContent?.trim() || '';
                let vHtml = dt.nextElementSibling?.innerHTML || '';
                vHtml = vHtml.replace(/<span[^>]*class="cm_bar_info"[^>]*>.*?<\/span>/g, ' | ');
                vHtml = vHtml.replace(/<[^>]+>/g, '');
                const v = vHtml.trim();
                const vText = dt.nextElementSibling?.textContent?.trim() || '';

                console.log(`Key Found: [${k}] Value: [${vText}]`); // DEBUG LOG

                if (k === '등급') {
                    res.ageRating = vText;
                    if (res.ageRating.match(/^\d+세$/)) res.ageRating += ' 관람가';
                    if (res.ageRating === '전체') res.ageRating = '전체 관람가';
                }
                if (k === '장르') res.subGenre = vText;
                if (k === '국가') res.productionCountry = vText;
                if (k === '러닝타임') res.runningTime = vText;
                if (k === '개봉') res.productionYear = vText.substring(0, 4);
                if (k === '방송') res.productionYear = vText.substring(0, 4);
                if (k === '원제') res.originalTitle = vText;

                if (k === '개요') {
                    // ... (simplified verification)
                }
            });
        } else {
            console.log("No .cm_info_box found during extraction (found earlier?)");
        }

        return res;
    });

    console.log("Extracted Data:", naverData);

    await browser.close();
}

runDebug();
