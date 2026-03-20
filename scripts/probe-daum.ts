import puppeteer from 'puppeteer';
import fs from 'fs';



const URL = 'https://movie.daum.net/ranking/reservation';

async function probe() {
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    await page.setViewport({ width: 1280, height: 800 });

    // Go to URL
    await page.goto(URL, { waitUntil: 'networkidle2' });

    fs.writeFileSync('debug_daum_ranking.html', await page.content());
    console.log('Saved debug_daum_ranking.html');

    await browser.close();
}

probe();
