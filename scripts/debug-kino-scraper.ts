
import puppeteer from 'puppeteer';

const TARGET_URL = 'https://m.kinolights.com/content/new';

(async () => {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });
    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Referer': 'https://m.kinolights.com/',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1'
    });

    try {
        console.log(`Navigating to ${TARGET_URL}...`);
        await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });

        // Wait for *any* content to verify load
        try {
            await page.waitForSelector('body', { timeout: 10000 });
            await new Promise(r => setTimeout(r, 3000)); // Wait for hydration
        } catch (e) { }

        const debugInfo = await page.evaluate(() => {
            // Get all unique classes to help identify structure
            const classes = new Set();
            document.querySelectorAll('*').forEach(el => {
                el.classList.forEach(c => classes.add(c));
            });

            // Get links
            const links = Array.from(document.querySelectorAll('a')).map(a => ({
                text: a.innerText.replace(/\n/g, ' ').trim().substring(0, 50),
                href: a.href,
                class: a.className
            })).slice(0, 20);

            return {
                title: document.title,
                classes: Array.from(classes).slice(0, 50),
                links
            };
        });

        console.log('Page Title:', debugInfo.title);
        console.log('Classes (First 50):', debugInfo.classes);
        console.log('Links Sample:', JSON.stringify(debugInfo.links, null, 2));

        const items = await page.evaluate(() => {
            const results: any[] = [];
            // Selectors might need adjustment. Based on common class names.
            // Looking for generic list items.
            // Try identifying by link structure if classes are obfuscated.
            const candidates = document.querySelectorAll('a[href^="/title/"]');

            candidates.forEach(a => {
                const titleEl = a.querySelector('.name') || a.querySelector('.title');
                const title = titleEl ? titleEl.textContent?.trim() : '';

                // Usually an image inside
                const img = a.querySelector('img');
                const poster = img ? img.getAttribute('src') : '';

                if (title) {
                    results.push({
                        title,
                        link: a.getAttribute('href'),
                        poster
                    });
                }
            });
            return results;
        });

        console.log(`Found ${items.length} items.`);
        if (items.length > 0) {
            console.log('Sample:', items.slice(0, 3));
        }

    } catch (error) {
        console.error('Error during scraping:', error);
    } finally {
        await browser.close();
    }
})();
