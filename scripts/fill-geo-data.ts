
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';
import * as path from 'path';

puppeteer.use(StealthPlugin());

const VENUES_PATH = path.resolve(process.cwd(), 'src/data/venues.json');
const ADDRESS_HIERARCHY_PATH = path.resolve(process.cwd(), 'src/data/korean_address_hierarchy.json');

// Simple region mapping reverse lookup could be useful, or just use the keys from hierarchy
const REGION_MAP: Record<string, string> = {
    '서울': 'seoul', '경기': 'gyeonggi', '인천': 'incheon', '강원': 'gangwon',
    '제주': 'jeju', '부산': 'busan', '대구': 'daegu', '광주': 'gwangju',
    '대전': 'daejeon', '울산': 'ulsan', '세종': 'sejong',
    '충북': 'chungbuk', '충청북': 'chungbuk',
    '충남': 'chungnam', '충청남': 'chungnam',
    '전북': 'jeonbuk', '전라북': 'jeonbuk',
    '전남': 'jeonnam', '전라남': 'jeonnam',
    '경북': 'gyeongbuk', '경상북': 'gyeongbuk',
    '경남': 'gyeongnam', '경상남': 'gyeongnam'
};

function getRegionId(address: string): string | null {
    for (const [key, id] of Object.entries(REGION_MAP)) {
        if (address.includes(key)) return id;
    }
    return null;
}

function getDistrict(address: string): string | null {
    // Basic regex for district (Gu/Gun/Si)
    // Matches "Example-si", "Example-gu", "Example-gun"
    // But be careful with "Si" being the region itself for Sejong
    const parts = address.split(' ');
    if (parts.length >= 2) {
        const candidate = parts[1]; // usually Region City/Gu
        if (candidate.endsWith('시') || candidate.endsWith('구') || candidate.endsWith('군')) {
            return candidate;
        }
    }
    return null;
}

async function run() {
    console.log('Starting Geocoding Script...');
    const venues = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf-8'));

    // Identify targets
    const targets = Object.entries(venues).filter(([key, v]: [string, any]) => {
        return !v.lat || !v.lng || v.lat === 'null' || isNaN(parseFloat(v.lat));
    }) as [string, any][];

    console.log(`Found ${targets.length} venues missing geodata.`);

    // Chunking to avoid overwhelming or long-running uncommitted states
    const BATCH_SIZE = 50;

    const browser = await puppeteer.launch({
        headless: process.env.HEADLESS !== 'false',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 375, height: 812, isMobile: true }); // Mobile view

    let processed = 0;

    for (const [key, venue] of targets) {
        processed++;
        const query = venue.address || venue.name;

        // Skip invalid queries
        if (!query || query.includes("정보 없음") || query.includes("장소 미정") || query.includes("상세 페이지") || query.length < 2) {
            console.log(`[${processed}/${targets.length}] Skipping: ${venue.name} (Invalid query: ${query})`);
            continue;
        }

        console.log(`[${processed}/${targets.length}] Processing: ${venue.name} (Query: ${query})`);

        try {
            await page.goto(`https://m.map.naver.com/search2/search.naver?query=${encodeURIComponent(query)}`, { waitUntil: 'networkidle2', timeout: 10000 });

            // Wait for ANY content - list or single result
            try {
                await page.waitForFunction(() => {
                    return document.querySelector('a[href*="longitude"]') || document.querySelector('body')?.innerText.includes('검색결과가 없습니다');
                }, { timeout: 5000 });
            } catch (e) {
                // Timeout waiting
            }

            // Extract data using reliable checks
            const data = await page.evaluate(() => {
                // Global search for the magic link
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

                // Address Finding: Look for buttons/spans that start with a region name
                let address = null;
                // Regions to look for
                const regions = ['서울', '경기', '인천', '강원', '제주', '부산', '대구', '광주', '대전', '울산', '세종', '충남', '충북', '전남', '전북', '경남', '경북'];

                const candidates = Array.from(document.querySelectorAll('button, span, div'));
                const addressEl = candidates.find(el => {
                    const text = el.textContent?.trim();
                    if (!text) return false;
                    // Address usually starts with Region
                    return regions.some(r => text.startsWith(r) && text.length > 5 && text.includes(' '));
                });

                if (addressEl) address = addressEl.textContent!.trim();

                return { address, lat, lng };
            });

            if (data && data.lat && data.lng) {
                // Filter out non-korea coords if valid
                if (parseFloat(data.lat) > 30 && parseFloat(data.lat) < 40 && parseFloat(data.lng) > 120 && parseFloat(data.lng) < 135) {
                    console.log(`  -> Found: ${data.lat}, ${data.lng} (${data.address})`);

                    venues[key].lat = parseFloat(data.lat);
                    venues[key].lng = parseFloat(data.lng);

                    if (data.address) {
                        // Only update address if original was name-only or incomplete
                        // Actually, map address is canonical, better to use it.
                        venues[key].address = data.address;

                        // Note: evaluate cannot use outer scope functions directly like getRegionId. 
                        // But we update venues[key] in outer scope using data.address.
                    }

                    // Post-process region/district in outer scope
                    if (venues[key].address) {
                        const rId = getRegionId(venues[key].address);
                        if (rId) venues[key].mapped_region_id = rId;
                        const dist = getDistrict(venues[key].address);
                        if (dist) venues[key].district = dist;
                    }

                } else {
                    console.log(`  -> Invalid coords: ${data.lat}, ${data.lng}`);
                }
            } else {
                console.log(`  -> No coordinate data found in result.`);
                // Debug: specific failure
                if (processed <= 5) {
                    await page.screenshot({ path: `debug_geo_fail_${processed}.png` });
                    console.log(`  -> Saved debug screenshot: debug_geo_fail_${processed}.png`);
                }
            }

            await new Promise(r => setTimeout(r, 500));

        } catch (e) {
            console.error(`  -> Error processing ${venue.name}: ${e}`);
        }

        if (processed % 10 === 0) {
            fs.writeFileSync(VENUES_PATH, JSON.stringify(venues, null, 2));
            console.log('  (Saved progress)');
        }
    }

    fs.writeFileSync(VENUES_PATH, JSON.stringify(venues, null, 2));
    await browser.close();
    console.log('Geocoding Complete.');
}

run();
