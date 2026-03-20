
import puppeteer from 'puppeteer';

async function testLaunch() {
    console.log('Testing Puppeteer launch...');
    try {
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        console.log('Browser launched successfully!');
        const page = await browser.newPage();
        await page.goto('https://example.com');
        console.log('Page loaded:', await page.title());
        await browser.close();
    } catch (err) {
        console.error('Launch failed:', err);
    }
}

testLaunch();
