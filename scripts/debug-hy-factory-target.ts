
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

async function testDetail(url: string) {
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    try {
        console.log(`Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Click all toggles just in case
        await page.evaluate(async () => {
            const toggles = Array.from(document.querySelectorAll('.toggle-title, [class*="toggle"], button'));
            for (const t of toggles) {
                if (t.textContent?.includes('요금') || t.textContent?.includes('이용') || t.textContent?.includes('정보')) {
                    (t as HTMLElement).click();
                }
            }
            await new Promise(r => setTimeout(r, 1000));
        });

        // Extract structured info
        const info = await page.evaluate(() => {
            const results: any = [];
            
            // Look for any elements containing [요금] or [이용안내]
            const walkers = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
            let node;
            while (node = walkers.nextNode()) {
                const text = node.textContent?.trim();
                if (text?.includes('[요금]') || text?.includes('[이용안내]')) {
                    let parent = node.parentElement;
                    results.push({
                        marker: text,
                        parentTag: parent?.tagName,
                        parentText: parent?.innerText,
                        allContent: (parent?.closest('section, div[class*="content"], article') as any)?.innerText
                    });
                }
            }
            return results;
        });

        console.log('--- Found Info ---');
        console.log(JSON.stringify(info, null, 2));

        // Let's also just dump the HTML of any section containing "요금"
        const htmlDump = await page.evaluate(() => {
            const sections = Array.from(document.querySelectorAll('section, div'));
            return sections
                .filter(s => s.textContent?.includes('요금') && s.children.length > 0)
                .map(s => ({ tag: s.tagName, class: s.className, html: s.outerHTML.slice(0, 500) }))
                .slice(0, 5);
        });
        console.log('\n--- HTML Dumps ---');
        console.log(htmlDump);

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}

testDetail('https://mom-mom.net/travel/places/6507a66e53e91cf1df2b57f2');
