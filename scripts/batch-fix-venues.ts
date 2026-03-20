
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const VENUES_PATH = path.resolve(process.cwd(), 'src/data/venues.json');
const BAD_VENUES_PATH = path.resolve(process.cwd(), 'src/data/bad-venues.json');

// Load existing data
const venueData = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf-8'));
const badVenues: string[] = JSON.parse(fs.readFileSync(BAD_VENUES_PATH, 'utf-8'));

async function saveVenues() {
    fs.writeFileSync(VENUES_PATH, JSON.stringify(venueData, null, 2), 'utf-8');
}

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeAddressAndCoords(browser: any, venueName: string): Promise<{ address: string, lat?: number, lng?: number, foundName?: string } | null> {
    const page = await browser.newPage();
    let result: { address: string, lat?: number, lng?: number, foundName?: string } | null = null;

    // Address hint from existing data?
    const existing = venueData[venueName];
    const addressHint = existing?.address || '';

    try {
        // Search Query: Name + Address (if available) or just "주소"
        // Try searching with address first if available, as it's more specific
        let query = `${venueName} 주소`;
        if (addressHint && addressHint.length > 5) {
            // Use specific address part (e.g. "Road Name + Number")
            // Try to extract district + road + number
            const match = addressHint.match(/([가-힣]+[시군구]\s+[가-힣]+[로길]\s*\d+(?:-\d+)?)/);
            if (match) {
                query = match[1]; // Use the address directly
            } else {
                query = venueName; // Fallback to name
            }
        }

        console.log(`Searching for: ${query} (Original: ${venueName})`);
        await page.goto(`https://map.naver.com/v5/search/${encodeURIComponent(query)}`, { waitUntil: 'networkidle2', timeout: 20000 });

        // Wait for potential redirect or load
        await delay(2000);

        // Naver Map is complex (iframe).
        // Let's stick to the Search Naver strategy used in fill-missing-venues.ts which is simpler/lighter?
        // Actually, Naver Search (search.naver.com) is better than map.naver.com for scraping JSON state.
        // Let's change target back to search.naver.com

        await page.goto(`https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`, { waitUntil: 'networkidle2' });

        const jsonResult = await page.evaluate(() => {
            let bestMatch = null;
            let state = null;
            try {
                // @ts-ignore
                if (window.__APOLLO_STATE__) state = window.__APOLLO_STATE__;
                // @ts-ignore
                else if (window.naver?.search?.ext?.loc?.salt?.__APOLLO_STATE__) {
                    // @ts-ignore
                    state = window.naver.search.ext.loc.salt.__APOLLO_STATE__;
                }

                if (!state) {
                    const scripts = document.querySelectorAll('script');
                    for (const s of Array.from(scripts)) {
                        const content = s.textContent || '';
                        const match = content.match(/__APOLLO_STATE__\s*=\s*({.+?});/);
                        if (match) {
                            state = JSON.parse(match[1]);
                            break;
                        }
                    }
                }

                if (state) {
                    const placeKeys = Object.keys(state).filter(k => k.startsWith('PlaceSummary'));
                    for (const k of placeKeys) {
                        const p = state[k];
                        if (p.fullAddress && p.x && p.y) {
                            bestMatch = {
                                address: p.fullAddress,
                                lat: parseFloat(p.y),
                                lng: parseFloat(p.x),
                                foundName: p.name
                            };
                            break;
                        }
                    }
                }
            } catch (e) { }
            return bestMatch;
        });

        if (jsonResult) {
            result = jsonResult;
        }

    } catch (e) {
        console.error(`Error scraping ${venueName}:`, e);
    } finally {
        await page.close();
    }

    return result;
}

async function run() {
    console.log(`Loaded ${badVenues.length} bad venues to fix.`);

    // Process top 50 for now or user can run full
    // Let's process a small batch to prove it works
    const targets = badVenues;

    // We only process if we have the venue in our DB (sanity check)
    const validTargets = targets.filter(n => venueData[n]);

    if (validTargets.length === 0) {
        console.log("No valid targets found in venues.json");
        return;
    }

    console.log(`Starting fix for ${validTargets.length} venues...`);
    const browser = await puppeteer.launch({ headless: true });

    let fixedCount = 0;

    for (const name of validTargets) {
        // Skip correct one (Wildbugs) if it's in the list (it shouldn't be as I patched it)
        // Check if existing coordinate is ALREADY fixed (not sure what the 'bad' value is exactly without re-checking)
        // But re-scraping is safe.

        const data = await scrapeAddressAndCoords(browser, name);
        if (data && data.lat && data.lng) {
            // Update
            venueData[name].lat = data.lat;
            venueData[name].lng = data.lng;
            venueData[name].address = data.address; // Update address too just in case
            venueData[name].mapped_region_id = 'auto-fixed';

            console.log(`[FIXED] ${name}: ${data.lat}, ${data.lng} (${data.address})`);
            fixedCount++;

            // Save every 5
            if (fixedCount % 5 === 0) await saveVenues();
        } else {
            console.log(`[FAILED] Could not find better data for ${name}`);
        }

        await delay(1000);
    }

    await saveVenues();
    await browser.close();
    console.log(`Batch fix complete. Fixed ${fixedCount} venues.`);
}

run().catch(console.error);
