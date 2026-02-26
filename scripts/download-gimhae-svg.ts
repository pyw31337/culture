import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

async function run() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
        console.log('Navigating to specific Namuwiki SVG URL...');
        const url = 'https://i.namu.wiki/i/cdtKgpVe4cMYUaPxG9C7PtbVyLPtsMjFcq1GzgMpAZFxyElMvTJSBMxXM_7hkB3XqhPtUhRNDTHB0nhLmiUt6g.svg';

        const viewSource = await page.goto(url);
        if (viewSource) {
            const buffer = await viewSource.buffer();
            const savePath = path.join(process.cwd(), 'public', 'images', 'logos', 'kleague', '김해.svg');
            fs.writeFileSync(savePath, buffer);
            console.log(`✅ Downloaded successfully to ${savePath}`);
        } else {
            console.log('❌ Could not load image source.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await browser.close();
    }
}

run();
