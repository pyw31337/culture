
import { firefox } from 'playwright';

async function debugNaver() {
    const browser = await firefox.launch({ headless: true }); // Headless true for speed, but might need false if blocked
    const page = await browser.newPage({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const query = '영화 기생충 정보';
    const url = `https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(query)}`;

    console.log(`Navigating to ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Naver Knowledge Graph usually has class 'cm_content_area' or 'info_group'
    // Let's dump the text content of specific containers

    const info = await page.evaluate(() => {
        const result: any = {};

        // 1. Basic Info Section (cm_info_box)
        const infoBox = document.querySelector('.cm_info_box');
        if (infoBox) {
            result.infoBoxText = infoBox.textContent;

            // Extract specific DL/DT/DD
            const details: any = {};
            const dts = infoBox.querySelectorAll('dt');
            dts.forEach(dt => {
                const key = dt.textContent?.trim();
                const val = dt.nextElementSibling?.textContent?.trim();
                if (key) details[key] = val;
            });
            result.details = details;
        }

        // 2. Additional Detail Section (often in .detail_info_group or .sh_init)
        const detailSections = document.querySelectorAll('.detail_info dl');
        detailSections.forEach(dl => {
            const dts = dl.querySelectorAll('dt');
            dts.forEach(dt => {
                const key = dt.textContent?.trim();
                const dd = dt.nextElementSibling;
                if (key === '감독') {
                    result.director = dd?.textContent?.trim();
                }
                if (key === '출연') {
                    // Cast names often in spans or separated by commas
                    result.cast = dd?.textContent?.trim();
                }
            });
        });

        // 3. Image (Poster)
        const posterImg = document.querySelector('.detail_info img') || document.querySelector('.cm_content_area img');
        if (posterImg) {
            result.poster = posterImg.getAttribute('src');
        }

        // 2. Cast Section (cast_box) - often loaded dynamically or in a tab
        // Naver often puts Director/Cast in the main summary or a separate tab. 
        // Let's check for '감독' and '출연' text in the body to find containers.

        return result;
    });

    console.log('Extracted Info:', JSON.stringify(info, null, 2));

    // Screenshot to see layout
    await page.screenshot({ path: 'naver_debug_fail.png', fullPage: false });

    // Dump body HTML to file for inspection
    const html = await page.content();
    const fs = require('fs');
    fs.writeFileSync('naver_debug.html', html);

    await browser.close();
}

debugNaver();
