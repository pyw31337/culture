import { chromium } from 'playwright';

async function testKobisApi() {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();

        page.on('response', async (response) => {
            const url = response.url();
            if (url.includes('find') && url.includes('.do')) {
                console.log(`[Response] ${url}`);
                if (url.includes('findOpenScheduleList.do') || url.includes('findOpenScheduleajax.do')) {
                    // try {
                    //     const text = await response.text();
                    //     console.log('Body snippet:', text.substring(0, 200));
                    // } catch (e) {}
                }
            }
        });

        const url = 'https://www.kobis.or.kr/kobis/business/mast/mvie/findOpenScheduleList.do';
        console.log(`Navigating to ${url}`);

        await page.goto(url, { waitUntil: 'networkidle' });

        // Let's click "Next Month" to see what request it sends
        console.log("Clicking Next Month...");
        await page.evaluate(() => {
            const nextBtn = document.querySelector('button.next'); // usually '.next' or '.btn_next'
            if (nextBtn) (nextBtn as HTMLElement).click();
            else {
                const aNext = document.querySelector('.btn_next, .next_mon, .btn_nxt');
                if (aNext) (aNext as HTMLElement).click();
            }
        });

        await page.waitForTimeout(3000);

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
}

testKobisApi();
