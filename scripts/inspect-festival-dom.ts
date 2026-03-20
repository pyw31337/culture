
import puppeteer from 'puppeteer';

const URL = 'https://korean.visitkorea.or.kr/kfes/list/wntyFstvlList.do';

async function inspect() {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Anti-bot headers
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://korean.visitkorea.or.kr/',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1'
    });

    console.log(`Navigating to ${URL}...`);
    try {
        await page.goto(URL, { waitUntil: 'load', timeout: 60000 });

        // Search for pagination
        const pagination = await page.evaluate(() => {
            // Common pagination selectors
            const selectors = ['.page_box', '.pagination', '.paging', '#paging', '.paginate', '.page'];
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el) return { selector: sel, html: el.outerHTML };
            }
            return { found: false };
        });

        console.log('Pagination Result:', JSON.stringify(pagination, null, 2));

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}

inspect();
