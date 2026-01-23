import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const VENUES_PATH = path.resolve(process.cwd(), 'src/data/venues.json');
const AUDIT_PATH = path.resolve(process.cwd(), 'venue_audit.csv');

// Load existing venues
let venueData: Record<string, any> = {};
if (fs.existsSync(VENUES_PATH)) {
    venueData = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf-8'));
}

async function saveVenues() {
    fs.writeFileSync(VENUES_PATH, JSON.stringify(venueData, null, 2), 'utf-8');
}

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeAddressAndCoords(browser: any, venueName: string): Promise<{ address: string, lat?: number, lng?: number, foundName?: string } | null> {
    const page = await browser.newPage();
    let result: { address: string, lat?: number, lng?: number, foundName?: string } | null = null;

    try {
        let searchName = venueName;
        const maxRetries = 3;
        let attempts = 0;

        while (attempts <= maxRetries) {
            console.log(`Searching for: ${searchName} (Attempt ${attempts + 1})`);

            // Append " 주소" to trigger the specific place/address card more reliably
            // Wait for networkidle2 to ensure hydration scripts run
            await page.goto(`https://search.naver.com/search.naver?query=${encodeURIComponent(searchName + ' 주소')}`, { waitUntil: 'networkidle2' });

            // Strategy 1: Extract from JSON (__APOLLO_STATE__)
            const jsonResult = await page.evaluate(() => {
                let bestMatch = null;
                let state = null;

                try {
                    // Try global access
                    // @ts-ignore
                    if (window.__APOLLO_STATE__) state = window.__APOLLO_STATE__;
                    // @ts-ignore
                    else if (window.naver && window.naver.search && window.naver.search.ext && window.naver.search.ext.loc && window.naver.search.ext.loc.salt && window.naver.search.ext.loc.salt.__APOLLO_STATE__) {
                        // @ts-ignore
                        state = window.naver.search.ext.loc.salt.__APOLLO_STATE__;
                    }

                    // Fallback: Regex scripts
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
                        // Filter logic: In strict mode we might want to check name similarity, 
                        // but Naver Search already filtered by our query.
                        // The top result is usually the best.

                        // Sort keys by numerical ID if necessary? No, just take first valid one.
                        for (const k of placeKeys) {
                            const p = state[k];
                            if (p.fullAddress && p.x && p.y) {
                                bestMatch = {
                                    address: p.fullAddress,
                                    lat: parseFloat(p.y), // Naver uses y for lat? Yes (37.x)
                                    lng: parseFloat(p.x), // x for lng (127.x)
                                    foundName: p.name ? p.name.replace(/<[^>]*>/g, '') : ''
                                };
                                break; // Take first valid
                            }
                        }
                    }
                } catch (e) {
                    // console.error(e);
                }
                return bestMatch;
            });

            if (jsonResult) {
                console.log(`Found Data via JSON: ${jsonResult.address} (${jsonResult.lat}, ${jsonResult.lng})`);
                result = jsonResult;
                break;
            }

            // Strategy 2: Fallback DOM Scraping (Previous Logic)
            const scrapedData = await page.evaluate(() => {
                let addr = null;
                let mapUrl = null;

                // 1. Address via .pz7wy
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

                // 3. Find Map Link for coordinates
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

            if (scrapedData.addr) {
                console.log(`Found Address (DOM): ${scrapedData.addr}`);
                result = { address: scrapedData.addr, foundName: searchName };

                if (scrapedData.mapUrl) {
                    console.log(`Found Map Link: ${scrapedData.mapUrl}`);
                    const lngMatch = scrapedData.mapUrl.match(/lng=([0-9.]+)/);
                    const latMatch = scrapedData.mapUrl.match(/lat=([0-9.]+)/);
                    if (lngMatch && latMatch) {
                        result.lng = parseFloat(lngMatch[1]);
                        result.lat = parseFloat(latMatch[1]);
                    }
                }
                break;
            }

            // Retry logic
            const parts = searchName.split(' ');
            if (parts.length <= 1) break;
            parts.pop();
            searchName = parts.join(' ');
            attempts++;
            await delay(1000);
        }

    } catch (e) {
        console.error(`Error scraping ${venueName}:`, e);
    } finally {
        await page.close();
    }

    return result;
}

async function run() {
    if (!fs.existsSync(AUDIT_PATH)) {
        console.error("Audit file not found. Run audit-venues.ts first.");
        return;
    }

    const csvContent = fs.readFileSync(AUDIT_PATH, 'utf-8');
    const rows = csvContent.split('\n').map(r => r.split(','));

    // Filter target venues
    const targets = rows.slice(1).filter(r => {
        const name = r[0]?.replace(/"/g, '');
        const status = r[1];
        if (!name || status === 'OK' || !status) return false;

        // Skip already processed/complete venues in JSON
        if (venueData[name] && venueData[name].lat && venueData[name].lng && venueData[name].address) return false;

        return true;
    }).map(r => r[0].replace(/"/g, ''));

    console.log(`Found ${targets.length} venues to process.`);

    const browser = await puppeteer.launch({ headless: true });

    let processed = 0;
    // Process in smaller batches due to potential instability? 
    // Naver might block if too fast.
    for (const name of targets) {
        if (processed >= 1000) {
            console.log("Batch limit reached (1000). Stopping for review.");
            break;
        }

        console.log(`Processing [${processed + 1}/${targets.length}]: ${name}`);
        const data = await scrapeAddressAndCoords(browser, name);

        if (data && data.address) {
            venueData[name] = {
                name: name,
                address: data.address,
                district: data.address.split(' ')[1] || '',
                lat: data.lat || 0,
                lng: data.lng || 0,
                mapped_region_id: 'auto-filled'
            };
            console.log(`Saved: ${name} -> ${data.address} (${data.lat}, ${data.lng})`);
            await saveVenues();
        } else {
            console.log(`Failed to find data for: ${name}`);
        }

        processed++;
        await delay(2000 + Math.random() * 2000);
    }

    await browser.close();
    console.log("Done.");
}

run().catch(console.error);
