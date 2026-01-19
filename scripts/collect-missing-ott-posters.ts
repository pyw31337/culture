
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { processImage } from './utils/image-processor';
import pLimit from 'p-limit';

const OTT_FILE = path.resolve(process.cwd(), 'src/data/ott.json');

async function main() {
    console.log('Starting Missing OTT Poster Collection...');

    if (!fs.existsSync(OTT_FILE)) {
        console.error('OTT data file not found!');
        return;
    }

    const data = JSON.parse(fs.readFileSync(OTT_FILE, 'utf-8'));

    // items that satisfy one of:
    // 1. No poster
    // 2. Poster is empty string
    // 3. Poster is a data URI
    // 4. Poster is a remote NamuWiki URL (should be local)
    const targets = data.filter((item: any) => {
        if (!item.poster) return true;
        if (item.poster.trim() === '') return true;
        if (item.poster.startsWith('data:')) return true;
        if (item.poster.includes('namu.wiki') && !item.poster.startsWith('/images/')) return true;
        return false;
    });

    console.log(`Found ${targets.length} items needing poster attention out of ${data.length} total.`);

    if (targets.length === 0) {
        console.log('No items to process.');
        return;
    }

    const browser = await chromium.launch({ headless: true });
    // Use slightly taller viewport for NamuWiki scrolling
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 1080 }
    });

    const limit = pLimit(3); // Process 3 concurrently
    let processedCount = 0;

    const tasks = targets.map((item: any) => limit(async () => {
        console.log(`[${processedCount + 1}/${targets.length}] Processing: ${item.title}`);

        // If it's a remote NamuWiki URL, just try to process it directly first
        if (item.poster && item.poster.includes('namu.wiki') && !item.poster.startsWith('/images/')) {
            try {
                const localPath = await processImage(item.poster, item.title);
                if (localPath !== item.poster) {
                    item.poster = localPath;
                    item.posterSource = 'namuwiki';
                    console.log(`   -> Downloaded existing remote NamuWiki poster for ${item.title}`);
                    processedCount++;
                    return;
                }
            } catch (e) {
                console.log(`   -> Failed to download existing remote URL, will try searching.`);
            }
        }

        const page = await context.newPage();
        try {
            // Search NamuWiki
            await page.goto(`https://namu.wiki/Go?q=${encodeURIComponent(item.title)}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForTimeout(2000);

            // Check for Search Result Page (if direct redirect didn't happen)
            const searchResultLink = await page.$('.search-item a, .search-result-list a');
            if (searchResultLink) {
                const txt = await searchResultLink.innerText();
                if (!txt.includes('User:') && !txt.includes('Talk:') && !txt.includes('사용자:') && !txt.includes('토론:')) {
                    await searchResultLink.click();
                    await page.waitForTimeout(2000);
                }
            }

            // Scroll specific amounts to trigger lazy loading
            await page.evaluate(() => window.scrollTo(0, 800));
            await page.waitForTimeout(1000);

            const namuPoster = await page.evaluate(() => {
                // 1. Try Table/Infobox images
                const imgs = Array.from(document.querySelectorAll('table img, .wiki-table img, div[class*="wiki-table"] img, .wiki-heading-content img'));
                let candidate = imgs.find(img => {
                    const el = img as HTMLImageElement;
                    // Width > 150 (relaxed) to catch valid posters
                    return el.width > 150 && el.src.includes('namu.wiki') && !el.src.includes('icon') && !el.src.includes('logo');
                });

                // 2. Global fallback (larger images)
                if (!candidate) {
                    const allImgs = Array.from(document.querySelectorAll('img'));
                    candidate = allImgs.find(img => {
                        const el = img as HTMLImageElement;
                        return el.width > 200 && el.height > 250 && el.src.includes('namu.wiki');
                    });
                }

                return candidate ? (candidate as HTMLImageElement).src : null;
            });

            if (namuPoster) {
                const localPath = await processImage(namuPoster, item.title);
                item.poster = localPath;
                item.posterSource = 'namuwiki';
                console.log(`   -> Found & Saved poster for ${item.title}: ${localPath}`);
            } else {
                console.log(`   -> No poster found on NamuWiki for ${item.title}`);
            }

        } catch (e) {
            console.error(`   -> Error processing ${item.title}:`);
        } finally {
            await page.close();
            processedCount++;
        }
    }));

    await Promise.all(tasks);
    await browser.close();

    console.log('Writing updated data to ott.json...');
    fs.writeFileSync(OTT_FILE, JSON.stringify(data, null, 2));
    console.log('Done.');
}

main().catch(console.error);
