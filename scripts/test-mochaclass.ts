import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('https://mochaclass.com/class/63148cfbf5301a7e91d9bb9f', { waitUntil: 'networkidle2' });

    const result = await page.evaluate(() => {
        // Find the element containing exactly "위치"
        const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span'));
        let address = '';

        for (let i = 0; i < headings.length; i++) {
            if (headings[i].textContent?.trim() === '위치') {
                // The address is usually the next sibling or somewhere nearby
                // Let's check the next few elements in the DOM tree, or just the parent's text
                let current: Element | null = headings[i];
                // Go up one or two levels
                const container = headings[i].closest('div')?.parentElement;
                if (container) {
                    const text = container.textContent || '';
                    // text will be like "위치대한민국 울산광역시 동구 전하2동 691-6 1F 해도방 도예카페찾아오는 길울산..."
                    // We can extract everything between "위치" and "찾아오는 길"
                    const match = text.match(/위치(.*?)찾아오는 길/);
                    if (match && match[1]) {
                        address = match[1].trim();
                        break;
                    } else {
                        // If no "찾아오는 길", just take everything after "위치" up to the next heading?
                        const match2 = text.match(/위치(대한민국.*?(구|동|시|군|로|길)\b.*?)/);
                        if (match2) {
                            address = match2[1].trim();
                            break;
                        }
                    }
                }
            }
        }

        // Alternative method: just find the string starting with 대한민국
        if (!address) {
            const allElements = Array.from(document.querySelectorAll('p, span'));
            for (const el of allElements) {
                const text = el.textContent?.trim() || '';
                if (text.startsWith('대한민국') && text.length > 10) {
                    address = text;
                    break;
                }
            }
        }

        return { address };
    });

    console.log(JSON.stringify(result, null, 2));
    await browser.close();
})();
