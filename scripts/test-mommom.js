const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto("https://mom-mom.net/travel/places/6417cdf0f2f1cef887f0587e");
    
    // Wait for dynamic content
    await new Promise(r => setTimeout(r, 2000));
    
    // Scrape details
    const details = await page.evaluate(() => {
        const pageTitle = document.querySelector('h1')?.textContent?.trim() ||
            document.querySelector('h2')?.textContent?.trim() || '';

        let address = '';
        const allKeyElements = Array.from(document.querySelectorAll('p.key'));
        const addressKey = allKeyElements.find(el => el.textContent?.trim() === '주소');
        if (addressKey) {
            let valueEl = addressKey.nextElementSibling;
            if (valueEl && valueEl.classList.contains('value')) {
                address = valueEl.textContent?.trim() || '';
            }
            if (!address && addressKey.parentElement) {
                const parentValue = addressKey.parentElement.querySelector('p.value');
                if (parentValue) {
                    address = parentValue.textContent?.trim() || '';
                }
            }
            address = address.replace('지도보기', '').trim();
        }

        return { pageTitle, address, allText: document.body.innerText.substring(0, 500) };
    });
    console.log("DETAILS:", details);
    await browser.close();
})();
