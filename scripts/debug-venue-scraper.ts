import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs';

puppeteer.use(StealthPlugin());

async function runDebug() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Use specific long name that failed
    const searchName = '잠실종합운동장잠실야구장 주소';
    console.log(`Searching for: ${searchName}`);
    await page.goto(`https://search.naver.com/search.naver?query=${encodeURIComponent(searchName)}`, { waitUntil: 'domcontentloaded' });

    // Save HTML for inspection
    const html = await page.content();
    fs.writeFileSync('debug_search_2.html', html);
    await page.screenshot({ path: 'debug_search_2.png', fullPage: true });

    // Test Valid Extraction
    const extraction = await page.evaluate(() => {
        let addr = null;
        let mapUrl = null;

        // 1. Try specific class .pz7wy
        const el = document.querySelector('.pz7wy');
        if (el && el.textContent) addr = el.textContent.trim();

        // 2. Fallback Address via "주소" label
        if (!addr) {
            const labels = Array.from(document.querySelectorAll('.place_blind'));
            const addrLabel = labels.find(l => l.textContent === '주소');
            if (addrLabel) {
                const container = addrLabel.closest('.O8qbU');
                if (container) {
                    const content = container.querySelector('.vV_z_');
                    if (content && content.textContent) addr = content.textContent.trim();
                }
            }
        }

        // 3. Map Link
        const links = Array.from(document.querySelectorAll('a[href*="map.naver.com"]'));
        for (const link of links) {
            const href = link.getAttribute('href');
            if (href && (href.includes('lng=') || href.includes('x='))) {
                mapUrl = href;
                break;
            }
        }

        return { addr, mapUrl };
    });

    console.log('Extraction Result:', extraction);
    await browser.close();
}

runDebug().catch(console.error);
