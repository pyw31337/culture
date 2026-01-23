
import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

const OLD_URL = 'https://korean.visitkorea.or.kr/list/travelinfo.do?service=show';
const NEW_URL = 'https://korean.visitkorea.or.kr/kfes/list/wntyFstvlList.do';

async function debug() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1024 });

    console.log(`Checking OLD_URL: ${OLD_URL}`);
    try {
        await page.goto(OLD_URL, { waitUntil: 'networkidle0', timeout: 30000 });
        await page.screenshot({ path: 'debug_old_url.png' });
        const oldItems = await page.evaluate(() => {
            return document.querySelectorAll('.list_thum_type > li').length;
        });
        console.log(`Items found on OLD_URL with .list_thum_type > li: ${oldItems}`);
    } catch (e) {
        console.error('Error checking OLD_URL:', e);
    }

    console.log(`Checking NEW_URL: ${NEW_URL}`);
    try {
        await page.goto(NEW_URL, { waitUntil: 'networkidle0', timeout: 30000 });
        await page.screenshot({ path: 'debug_new_url.png' });

        // Analyze DOM on new URL
        const analysis = await page.evaluate(() => {
            const potentialLists = [
                '.fest_list > li',
                '.list_thum_type > li',
                'ul.list_type01 > li',
                '.fst_list > li'
            ];

            const results: any = {};
            potentialLists.forEach(sel => {
                results[sel] = document.querySelectorAll(sel).length;
            });
            return results;
        });
        console.log('DOM Analysis on NEW_URL:', analysis);

    } catch (e) {
        console.error('Error checking NEW_URL:', e);
    }

    await browser.close();
}

debug();
