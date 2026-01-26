
import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 375, height: 812 });

    const url = 'https://www.sssd.co.kr/m/class/detail/17572';
    console.log(`Visiting ${url}...`);
    await page.goto(url, { waitUntil: 'networkidle2' });

    // Dump HTML of the class_info area
    const html = await page.content();
    console.log('Page Content Length:', html.length);

    // Check specific selectors
    const addressSelector = '#class_info > div.address-info-box.info-area.p-t-30.p-l-15.p-r-15.m-b-30 > div > div.info-address-text-area > span';
    const exists = await page.$(addressSelector);
    console.log(`Selector "${addressSelector}" exists:`, !!exists);

    if (exists) {
        const text = await page.$eval(addressSelector, el => el.textContent);
        console.log('Text content:', text);
    } else {
        // Broad Search for address-like text
        console.log('Searching for "서울" in body...');
        const bodyText = await page.$eval('body', el => el.innerText);
        const lines = bodyText.split('\n').filter(l => l.includes('서울') || l.includes('성동구'));
        console.log('Relevant lines:', lines);

        // Dump nearby HTML classes
        const classInfoHtml = await page.evaluate(() => {
            const el = document.querySelector('#class_info');
            return el ? el.innerHTML : 'NULL';
        });
        console.log('Class Info HTML fragment:', classInfoHtml.slice(0, 500));
    }

    await browser.close();
})();
