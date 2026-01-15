
import { chromium } from 'playwright';

const FAILED_TITLES = [
    '【최애의 아이】 - 시즌 3',
    '귀족 전생 ~축복받은 태생으로 최강의 힘을 손에 넣다~ - 시즌 1',
    'WWE NXT - 시즌 20',
    '현역가왕 - 시즌 1',
    '가치아쿠타 - 시즌 1'
];

async function debugQueries() {
    const browser = await chromium.launch({ headless: true });

    for (const fullTitle of FAILED_TITLES) {
        console.log(`\n\n=== Debugging: ${fullTitle} ===`);
        const page = await browser.newPage();

        // Strategy 1: Full Title + ' 정보'
        // Strategy 2: Simple Title (remove season/special chars) + ' 정보'
        // Strategy 3: Simple Title + ' 애니' or ' 드라마' or ' 예능'

        const simpleTitle = fullTitle.split('-')[0].replace(/[【】~]/g, '').trim();
        const strategies = [
            `${fullTitle} 정보`,
            `${simpleTitle} 정보`,
            `${simpleTitle} 기본정보`,
            simpleTitle
        ];

        for (const query of strategies) {
            console.log(`  > Testing Query: "${query}"`);
            const url = `https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(query)}`;
            await page.goto(url, { waitUntil: 'domcontentloaded' });

            const hasInfoBox = await page.$('.cm_info_box');
            const hasKnowledge = await page.$('.api_subject_bx');

            console.log(`    - InfoBox: ${!!hasInfoBox}, KnowledgeGraph: ${!!hasKnowledge}`);

            if (hasInfoBox) {
                const text = await page.$eval('.cm_info_box', el => el.textContent?.substring(0, 50));
                console.log(`    - Content Sample: ${text}`);
                break; // Found it!
            }
        }
        await page.close();
    }

    await browser.close();
}

debugQueries();
