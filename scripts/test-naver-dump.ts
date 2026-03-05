import { chromium } from 'playwright';

async function dumpNaverControls() {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        const url = 'https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=%EA%B0%9C%EB%B4%89+%EC%98%88%EC%A0%95+%EC%98%81%ED%99%94&ackey=xhksrakn';
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        const dump = await page.evaluate(() => {
            const controls = document.querySelector('.pg_btn, .cm_paging, .nav, .list_control, .api_subject_bx');
            return controls ? controls.outerHTML : 'Not found';
        });

        console.log(dump.substring(0, 1500));
    } finally {
        await browser.close();
    }
}

dumpNaverControls();
