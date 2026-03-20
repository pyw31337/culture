import puppeteer from 'puppeteer';

async function debug() {
    const url = 'https://mochaclass.com/class/69b12178c0b3cebfb126dcc5';
    const browser = await puppeteer.launch({ 
        headless: true,
        args: ['--no-sandbox']
    });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('Navigating to:', url);
    await page.goto(url, { waitUntil: 'networkidle2' });
    
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'mochaclass_step1.png' });
    
    const tabFound = await page.evaluate(async () => {
        const tabs = Array.from(document.querySelectorAll('button, div, span, a, p'));
        const locationTab = tabs.find(t => t.textContent?.trim() === '위치');
        if (locationTab) {
            (locationTab as HTMLElement).click();
            return true;
        }
        return false;
    });
    
    console.log('Tab found and clicked:', tabFound);
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: 'mochaclass_step2.png' });
    
    const extraction = await page.evaluate(() => {
        return {
            innerText: document.body.innerText.substring(0, 1000),
            html: document.body.innerHTML.substring(0, 500)
        };
    });
    
    console.log('Extraction:', extraction);
    
    await browser.close();
}

debug().catch(console.error);
