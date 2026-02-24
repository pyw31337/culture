import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('https://www.umclass.com/classInfo/1932', { waitUntil: 'networkidle2' });

    const result = await page.evaluate(() => {
        // Look for any text containing "대한민국" or generic Korean address patterns
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div'));
        let address = '';

        for (let i = 0; i < headings.length; i++) {
            if (headings[i].textContent?.trim() === '클래스 장소') {
                const container = headings[i].closest('div')?.parentElement;
                if (container) {
                    const text = container.textContent || '';
                    if (text.includes('복사')) {
                        const parts = text.split('복사');
                        if (parts[0]) {
                            address = parts[0].replace('클래스 장소', '').trim();
                        }
                    } else {
                        address = text.replace('클래스 장소', '').trim();
                    }
                }
                break;
            }
            if (headings[i].textContent?.trim() === '장소') {
                const nextSibling = headings[i].nextElementSibling;
                if (nextSibling) {
                    address = nextSibling.textContent?.trim() || '';
                }
                break;
            }
        }

        if (!address) {
            // Find map or something? Let's just dump paragraphs that look like addresses.
            for (const el of Array.from(document.querySelectorAll('div, p, span'))) {
                const text = el.textContent?.trim() || '';
                if ((text.includes('대한민국') || text.includes('동구') || text.includes('중구') || text.includes('서구') || text.includes('남구') || text.includes('북구') || text.includes('시 ') || text.includes('도 ') || text.includes('로 ') || text.includes('길 ')) && text.length > 10 && text.length < 100) {
                    if (text.match(/([가-힣]+(도|시|구|군|동|로|길)\s*)+/)) {
                        // Very likely an address
                        address = text;
                        if (text.includes('대한민국')) break;
                    }
                }
            }
        }

        // Let's also grab script tags to see if there's _NEXT_DATA_
        const nextData = document.getElementById('__NEXT_DATA__')?.textContent || '';
        let nextDataAddr = '';
        if (nextData) {
            try {
                const json = JSON.parse(nextData);
                // Umclass might use Next.js
                // need to explore json
            } catch (e) { }
        }

        return {
            address,
            nextDataExists: !!nextData
        };
    });

    console.log(JSON.stringify(result, null, 2));
    await browser.close();
})();
