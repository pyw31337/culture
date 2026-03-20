import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const VENUES_PATH = path.resolve(process.cwd(), 'src/data/venues.json');
const BACKUP_PATH = path.resolve(process.cwd(), 'src/data/venues.backup.json');

// Ensure backup exists (extra safety)
if (!fs.existsSync(BACKUP_PATH)) {
    fs.copyFileSync(VENUES_PATH, BACKUP_PATH);
}

// Load venues
let venueData = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf-8'));

function normalizeName(name: string): string {
    let clean = name;

    // Remove text in parentheses/brackets at the end or middle
    // e.g. "OOO (Seoul)" -> "OOO"
    clean = clean.replace(/\s*[\(\[].*?[\)\]]/g, '');

    // Remove suffixes like 대극장, 소극장, etc.
    const suffixes = [
        '대극장', '소극장', '중극장', '대공연장', '소공연장', '야외무대', '야외공연장',
        '민속극장', '연지홀', '모악당', '사랑당', '대강당', '소강당', '전관', '본관', '별관'
    ];
    // Regex for suffixes at end of string
    const suffixRegex = new RegExp(`\\s+(${suffixes.join('|')})$`);
    clean = clean.replace(suffixRegex, '');

    // Remove numbered halls: 1관, 2관, 제1전시장
    clean = clean.replace(/\s+제?\d+(관|전시장|홀|호)?$/, '');

    // Trim
    clean = clean.trim();

    return clean;
}

// ---------------------------------------------------------
// Reused Search Logic (Simplified)
// ---------------------------------------------------------
async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeAddressAndCoords(page: any, venueName: string): Promise<{ address: string, lat?: number, lng?: number } | null> {
    try {
        await page.goto(`https://search.naver.com/search.naver?query=${encodeURIComponent(venueName + ' 주소')}`, { waitUntil: 'networkidle2', timeout: 30000 });

        const result = await page.evaluate(() => {
            let best = null;

            // JSON extraction
            try {
                // @ts-ignore
                const state = window.__APOLLO_STATE__ || (window.naver && window.naver.search && window.naver.search.ext && window.naver.search.ext.loc && window.naver.search.ext.loc.salt && window.naver.search.ext.loc.salt.__APOLLO_STATE__);

                if (state) {
                    const keys = Object.keys(state).filter(k => k.startsWith('PlaceSummary'));
                    for (const k of keys) {
                        const p = state[k];
                        if (p.fullAddress && p.x && p.y) {
                            best = { address: p.fullAddress, lat: parseFloat(p.y), lng: parseFloat(p.x) };
                            break;
                        }
                    }
                }
            } catch (e) { }

            return best;
        });

        if (result) return result;

        // Fallback DOM
        const domResult = await page.evaluate(() => {
            let addr = document.querySelector('.pz7wy')?.textContent?.trim();
            if (!addr) {
                const label = Array.from(document.querySelectorAll('.place_blind')).find(l => l.textContent === '주소');
                addr = label?.closest('.O8qbU')?.querySelector('.vV_z_')?.textContent?.trim();
            }
            // Map link
            const link = document.querySelector('a[href*="map.naver.com"]');
            const href = link?.getAttribute('href');
            let lat, lng;
            if (href) {
                const lm = href.match(/lat=([\d.]+)/);
                const nm = href.match(/lng=([\d.]+)/);
                if (lm && nm) { lat = parseFloat(lm[1]); lng = parseFloat(nm[1]); }
            }
            return { addr, lat, lng };
        });

        if (domResult.addr) {
            return {
                address: domResult.addr,
                lat: domResult.lat || 0,
                lng: domResult.lng || 0
            };
        }

        return null;

    } catch (e) {
        return null;
    }
}

// ---------------------------------------------------------
// Main Optimization
// ---------------------------------------------------------
async function optimize() {
    console.log("Starting Venue Optimization (Incremental)...");

    // Group by normalized name
    const groups: Record<string, string[]> = {};
    Object.keys(venueData).forEach(key => {
        const clean = normalizeName(key);
        if (!groups[clean]) groups[clean] = [];
        groups[clean].push(key);
    });

    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    let updatedCount = 0;
    const groupKeys = Object.keys(groups);
    console.log(`Found ${groupKeys.length} unique venue groups from ${Object.keys(venueData).length} total venues.`);

    for (let i = 0; i < groupKeys.length; i++) {
        const cleanName = groupKeys[i];
        const keys = groups[cleanName];

        let bestData = null;

        // Find best existing data in group
        for (const k of keys) {
            const v = venueData[k];
            // Relaxed check: include '시' and '군' to match non-Seoul addresses
            if (v.address && v.lat && v.lng && (v.address.includes('구') || v.address.includes('시') || v.address.includes('군')) && !v.address.includes('Unknown')) {
                // Heuristic for "good enough" address
                bestData = { address: v.address, lat: v.lat, lng: v.lng };
                break;
            }
        }

        // If no good data found, or we want to force standardization for merged groups
        if (!bestData || keys.length > 1) {
            // Check if we ALREADY optimized it (if we are resuming)
            // If all keys in group already have valid address, skip.
            const allOptimized = keys.every(k => {
                const v = venueData[k];
                // Check if name is consistent (optional) or if address is valid
                // Since this heuristic is same as finding bestData above, if we found bestData, we skip search.
                // But bestData loop above only checks for ONE valid entry.
                // If keys.length > 1, we entered this block to ensure ALL leverage that one entry.
                // But we do that in "Apply to all in group" block.
                // So if bestData exists, we skip search (if block below).
                // Wait.
                // The issue: "if (!bestData || keys.length > 1)"
                // If keys.length > 1, we enter here even if bestData exists.
                // Then `if (!allOptimized)` -> wait.
                // If bestData exists, we don't need to search. We just need to apply bestData to others.
                // So: `if (!bestData)` should trigger search.
                // If `bestData` exists, we use it directly.

                // Refined Logic:
                return v.address && (v.address.includes('구') || v.address.includes('시') || v.address.includes('군'));
            });

            if (!bestData) {
                if (!allOptimized) {
                    console.log(`[${i + 1}/${groupKeys.length}] Optimizing: ${cleanName} (${keys.length} variants)`);
                    const searchRes = await scrapeAddressAndCoords(page, cleanName);
                    if (searchRes) {
                        bestData = searchRes;
                    }
                    await delay(1000); // Rate limit
                }
            }
        }

        // Apply to all in group
        if (bestData) {
            // Clean address
            const districtMatch = bestData.address.match(/([가-힣]+구)/) || bestData.address.match(/([가-힣]+시)/);
            const district = districtMatch ? districtMatch[1] : '';

            let region = 'etc';
            if (bestData.address.includes('서울')) region = 'seoul';
            else if (bestData.address.includes('경기')) region = 'gyeonggi';
            else if (bestData.address.includes('인천')) region = 'incheon';
            else if (bestData.address.includes('부산')) region = 'busan';
            else if (bestData.address.includes('대구')) region = 'daegu';
            else if (bestData.address.includes('광주')) region = 'gwangju';
            else if (bestData.address.includes('대전')) region = 'daejeon';
            else if (bestData.address.includes('울산')) region = 'ulsan';
            else if (bestData.address.includes('세종')) region = 'sejong';
            else if (bestData.address.includes('강원')) region = 'gangwon';
            else if (bestData.address.includes('충북')) region = 'chungbuk';
            else if (bestData.address.includes('충남')) region = 'chungnam';
            else if (bestData.address.includes('전북')) region = 'jeonbuk';
            else if (bestData.address.includes('전남')) region = 'jeonnam';
            else if (bestData.address.includes('경북')) region = 'gyeongbuk';
            else if (bestData.address.includes('경남')) region = 'gyeongnam';
            else if (bestData.address.includes('제주')) region = 'jeju';

            keys.forEach(k => {
                // Update only if changed?
                venueData[k] = {
                    name: cleanName, // Standardized Name
                    address: bestData!.address,
                    district: district,
                    lat: bestData!.lat,
                    lng: bestData!.lng,
                    mapped_region_id: region
                };
            });
            updatedCount += keys.length;
        }

        // Incremental Save (Every 50)
        if (i % 50 === 0) {
            fs.writeFileSync(VENUES_PATH, JSON.stringify(venueData, null, 2));
        }
    }

    await browser.close();

    fs.writeFileSync(VENUES_PATH, JSON.stringify(venueData, null, 2));
    console.log(`Optimization Complete. Updated ${updatedCount} entries.`);
}

optimize().catch(console.error);
