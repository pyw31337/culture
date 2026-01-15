
import { firefox } from 'playwright';
import fs from 'fs';

const TARGET_URL = 'https://www.justwatch.com/kr/new';

(async () => {
    const browser = await firefox.launch({ headless: true });
    const page = await browser.newPage();

    await page.goto(TARGET_URL, { waitUntil: 'networkidle' }); // Wait for network idle
    await page.waitForTimeout(5000); // Extra wait for React

    const content = await page.content();
    fs.writeFileSync('justwatch_debug.html', content);
    console.log('Saved HTML to justwatch_debug.html');

    // Quick log of potential classes
    const classes = await page.evaluate(() => {
        const divs = document.querySelectorAll('div');
        const classSet = new Set();
        divs.forEach(d => d.classList.forEach(c => classSet.add(c)));
        return Array.from(classSet).filter(c => (c as string).includes('timeline') || (c as string).includes('item'));
    });
    console.log('Detected Classes:', classes.slice(0, 20));

    await browser.close();
})();
