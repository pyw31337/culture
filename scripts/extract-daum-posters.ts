import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';
import path from 'path';

puppeteer.use(StealthPlugin());

const TARGETS = [
    { title: '시스터', type: '영화', rename: '시스터' },
    { title: '망내인 얼굴 없는 살인자들', type: '드라마', rename: '망내인__얼굴_없는_살인자들' },
    { title: '보스', type: '영화', rename: '보스' },
    { title: '어쩔수가없다', type: '영화', rename: '어쩔수가없다' },
    { title: '얼굴', type: '영화', rename: '얼굴' },
    { title: '좀비탕', type: '영화', rename: '좀비탕' },
    { title: '사흘', type: '영화', rename: '사흘' }
];

async function run() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    const DIR = path.join(process.cwd(), 'public', 'images', 'posters', 'ott');
    if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

    for (const target of TARGETS) {
        try {
            console.log(`Processing ${target.title}...`);
            const query = encodeURIComponent(`${target.title} ${target.type}`);
            await page.goto(`https://search.daum.net/search?w=tot&q=${query}`, { waitUntil: 'load' });

            // Wait for Daum Movie/TV poster thumb
            const thumbSelector = '.wrap_thumb img.thumb_g';
            const thumbSrc = await page.evaluate((sel: string) => {
                const img = document.querySelector(sel);
                return img?.getAttribute('src');
            }, thumbSelector);

            if (thumbSrc) {
                const viewSource = await page.goto(thumbSrc);
                if (viewSource) {
                    const buffer = await viewSource.buffer();
                    const absolutePath = path.join(DIR, `${target.rename}.webp`);

                    // Convert to WebP & Resize
                    const sharp = require('sharp');
                    await sharp(buffer)
                        .resize(300, 430, { fit: 'cover' })
                        .webp({ quality: 80 })
                        .toFile(absolutePath);

                    console.log(`✅ Saved ${target.title} -> ${absolutePath}`);
                }
            } else {
                console.log(`❌ Poster not found via Daum for ${target.title}`);
            }

        } catch (e: any) {
            console.error(`⚠️ Error during ${target.title}: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 1500));
    }
    await browser.close();
}

run();
