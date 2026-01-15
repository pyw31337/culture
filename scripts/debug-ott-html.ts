
import { chromium } from 'playwright';
import fs from 'fs';

const TARGETS = [
    '최애의 아이 - 시즌 3',
    '메이크 어 걸'
];

async function debugHtml() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    for (const title of TARGETS) {
        console.log(`\n--- Debugging HTML: ${title} ---`);
        const query = `${title.replace(/\s-\s.*$/, '')} 정보`;
        const url = `https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(query)}`;
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        const data = await page.evaluate(() => {
            const infoBox = document.querySelector('.cm_info_box')?.outerHTML || 'NO INFO BOX';
            const detailInfo = document.querySelector('.detail_info')?.outerHTML || 'NO DETAIL INFO';
            const castBox = document.querySelector('.cast_box')?.outerHTML || 'NO CAST BOX';
            return { infoBox, detailInfo, castBox };
        });

        const filename = `debug_html_${title.replace(/[^a-z0-9]/gi, '')}.html`;
        const content = `<!-- URL: ${url} -->\n\n<h1>Info Box</h1>\n${data.infoBox}\n\n<h1>Detail Info</h1>\n${data.detailInfo}\n\n<h1>Cast Box</h1>\n${data.castBox}`;
        fs.writeFileSync(filename, content);
        console.log(`Saved HTML dump to ${filename}`);
    }

    await browser.close();
}

debugHtml();
