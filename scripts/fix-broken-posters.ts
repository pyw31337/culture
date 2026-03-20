import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import sharp from 'sharp';

puppeteer.use(StealthPlugin());

const TARGETS = [
    { title: '시스터', type: '영화', rename: '시스터' },
    { title: '망내인', type: '드라마', rename: '망내인__얼굴_없는_살인자들' },
    { title: '보스', type: '영화', rename: '보스' },
    { title: '어쩔수가없다', type: '영화', rename: '어쩔수가없다' },
    { title: '얼굴', type: '영화', rename: '얼굴' },
    { title: '좀비탕', type: '영화', rename: '좀비탕' },
    { title: '사흘', type: '영화', rename: '사흘' }
];

async function run() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    const DIR = path.join(process.cwd(), 'public', 'images', 'posters', 'ott');
    if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

    for (const target of TARGETS) {
        try {
            const query = `${target.title} ${target.type}`;
            const url = `https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(query)}`;
            await page.goto(url, { waitUntil: 'domcontentloaded' });

            // Wait for image container to load in Naver Search
            const imgSelector = '.detail_info img, .cm_info_box img, .info_box img.thumb, .detail_info a.thumb img';
            await page.waitForSelector(imgSelector, { timeout: 3000 }).catch(() => null);

            let posterSrc = await page.evaluate((sel: string) => {
                const img = document.querySelector(sel);
                return img?.getAttribute('src') || img?.getAttribute('data-src') || '';
            }, imgSelector);

            if (posterSrc) {
                // Get high-res version if applicable
                posterSrc = posterSrc.replace(/type=[^&]+/, 'type=o').replace(/size=[^&]+&?/, '');

                console.log(`Downloading ${target.title}...`);
                const response = await axios({
                    url: posterSrc,
                    responseType: 'arraybuffer',
                    timeout: 5000
                });

                const absolutePath = path.join(DIR, `${target.rename}.webp`);
                await sharp(response.data)
                    .resize(300, 430, { fit: 'cover' })
                    .webp({ quality: 80 })
                    .toFile(absolutePath);

                console.log(`✅ Saved ${target.title} -> ${absolutePath}`);
            } else {
                console.log(`❌ No poster image found for ${target.title} on Naver search.`);
            }

        } catch (e: any) {
            console.error(`⚠️ Error during ${target.title}: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 1000)); // sleep preventing rate limit
    }
    await browser.close();
}

run();
