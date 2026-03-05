import { chromium } from 'playwright';
import fs from 'fs';

async function dumpKobisHtml() {
    const browser = await chromium.launch({ headless: true });
    try {
        const page = await browser.newPage();
        const url = 'https://www.kobis.or.kr/kobis/business/mast/mvie/findOpenScheduleList.do';
        await page.goto(url, { waitUntil: 'networkidle' });
        const html = await page.content();
        fs.writeFileSync('/Users/pyw31337/Developer/CultureFlow-New/scripts/kobis.html', html);
        console.log("HTML saved.");
    } finally {
        await browser.close();
    }
}

dumpKobisHtml();
