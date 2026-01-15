
import { chromium } from 'playwright';
import fs from 'fs';

const TARGETS = [
    '최애의 아이 - 시즌 3',
    '메이크 어 걸',
    '귀족 전생 ~축복받은 태생으로 최강의 힘을 손에 넣다~ - 시즌 1',
    'WWE NXT - 시즌 20'
];

async function debugEnrichment() {
    const browser = await chromium.launch({ headless: true }); // Headless but with screenshot
    const page = await browser.newPage();

    for (const title of TARGETS) {
        console.log(`\n--- Debugging: ${title} ---`);

        // 1. Try Default Query
        const query = `${title.replace(/\s-\s.*$/, '')} 정보`;
        console.log(`Query: "${query}"`);

        const url = `https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(query)}`;
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        // Screenshot
        await page.screenshot({ path: `debug_${title.replace(/[^a-z0-9]/gi, '_').substring(0, 10)}.png`, fullPage: true });

        // Evaluate what we see
        const result = await page.evaluate(() => {
            const infoBox = document.querySelector('.cm_info_box');
            const detailInfo = document.querySelector('.detail_info');
            const knowledge = document.querySelector('.api_subject_bx'); // Knowledge graph

            return {
                hasInfoBox: !!infoBox,
                hasDetailInfo: !!detailInfo,
                hasKnowledge: !!knowledge,
                infoBoxText: infoBox?.innerText.substring(0, 100),
                firstDt: document.querySelector('dt')?.innerText,
                firstDd: document.querySelector('dd')?.innerText,
            };
        });
        console.log('Result:', result);
    }

    await browser.close();
}

debugEnrichment();
