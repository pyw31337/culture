
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';

puppeteer.use(StealthPlugin());

const DATA_DIR = path.resolve(process.cwd(), 'src/data');

async function geocodeFile(filename: string) {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${filePath}`);
        return;
    }

    console.log(`\n>>> Processing ${filename}...`);
    const items = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    // Identify targets (Missing lat or lng)
    const targets = items.filter((item: any) => {
        const lat = item.lat || item.latitude;
        const lng = item.lng || item.longitude;
        return !lat || !lng || isNaN(parseFloat(lat)) || parseFloat(lat) === 0;
    });

    console.log(`Found ${targets.length}/${items.length} items missing geodata.`);

    if (targets.length === 0) return;

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 375, height: 812, isMobile: true });

    let processedCount = 0;
    const saveFrequency = 10;

    for (const item of targets) {
        processedCount++;
        // Use title + address for better accuracy, or just address if available
        const query = item.address && item.address !== '정보 없음' ? item.address : item.title;

        if (!query || query.length < 2) {
            console.log(`[${processedCount}/${targets.length}] Skipping: ${item.title} (Invalid query)`);
            continue;
        }

        console.log(`[${processedCount}/${targets.length}] Searching: ${item.title} (${query})`);

        try {
            await page.goto(`https://m.map.naver.com/search2/search.naver?query=${encodeURIComponent(query)}`, { 
                waitUntil: 'networkidle2', 
                timeout: 10000 
            });

            // Wait for content
            try {
                await page.waitForFunction(() => {
                    return document.querySelector('a[href*="longitude"]') || 
                           document.querySelector('body')?.innerText.includes('검색결과가 없습니다');
                }, { timeout: 4000 });
            } catch (e) {}

            const data = await page.evaluate(() => {
                const allLinks = Array.from(document.querySelectorAll('a'));
                const directionLink = allLinks.find(a => a.href.includes('longitude') && a.href.includes('latitude'));

                let lat = null;
                let lng = null;

                if (directionLink) {
                    const href = directionLink.href;
                    const decoded = decodeURIComponent(href);
                    const lngMatch = decoded.match(/longitude\^([\d\.]+)/);
                    const latMatch = decoded.match(/latitude\^([\d\.]+)/);
                    if (lngMatch && latMatch) {
                        lng = lngMatch[1];
                        lat = latMatch[1];
                    }
                }

                let address = null;
                const regions = ['서울', '경기', '인천', '강원', '제주', '부산', '대구', '광주', '대전', '울산', '세종', '충남', '충북', '전남', '전북', '경남', '경북'];
                const candidates = Array.from(document.querySelectorAll('button, span, div'));
                const addressEl = candidates.find(el => {
                    const text = el.textContent?.trim();
                    if (!text) return false;
                    return regions.some(r => text.startsWith(r) && text.length > 5 && text.includes(' '));
                });
                if (addressEl) address = addressEl.textContent!.trim();

                return { address, lat, lng };
            });

            if (data && data.lat && data.lng) {
                const latNum = parseFloat(data.lat);
                const lngNum = parseFloat(data.lng);
                
                if (latNum > 33 && latNum < 43 && lngNum > 124 && lngNum < 132) {
                    console.log(`  -> Success: ${latNum}, ${lngNum}`);
                    // Update original item in the array
                    if (item.lat !== undefined) item.lat = latNum;
                    if (item.latitude !== undefined) item.latitude = latNum;
                    if (item.lng !== undefined) item.lng = lngNum;
                    if (item.longitude !== undefined) item.longitude = lngNum;
                    
                    if (data.address && (!item.address || item.address === '정보 없음')) {
                        item.address = data.address;
                    }
                }
            } else {
                console.log(`  -> No results.`);
            }

            // Throttling
            await new Promise(r => setTimeout(r, 300));

            // Frequent saving
            if (processedCount % saveFrequency === 0) {
                fs.writeFileSync(filePath, JSON.stringify(items, null, 2));
                console.log(`  (Saved progress to ${filename})`);
            }

        } catch (e) {
            console.error(`  -> Error: ${e}`);
        }
    }

    // Final save
    fs.writeFileSync(filePath, JSON.stringify(items, null, 2));
    await browser.close();
    console.log(`Completed geocoding for ${filename}.`);
}

async function main() {
    await geocodeFile('mommom.json');
    await geocodeFile('museum.json');
    console.log('\n--- ALL FILES PROCESSED ---');
}

main().catch(console.error);
