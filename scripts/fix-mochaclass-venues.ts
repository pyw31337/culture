
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const MOCHA_DATA_PATH = path.resolve(process.cwd(), 'src/data/mochaclass.json');
const VENUES_PATH = path.resolve(process.cwd(), 'src/data/venues.json');

// Load data
const mochaData = JSON.parse(fs.readFileSync(MOCHA_DATA_PATH, 'utf-8'));
const venueData = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf-8'));

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrapeDetails(page: any, url: string) {
    try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait a bit for React hydration
        await delay(1000);

        return await page.evaluate(() => {
            // Strategy: Find address text node
            // Address usually starts with "대한민국" or contains "시" "구" "로/길"

            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                null
            );

            let node;
            const addressCandidates = [];

            while (node = walker.nextNode()) {
                const text = node.textContent?.trim();
                // Regex for Korean address approx
                if (text && text.length > 10 && (text.includes('서울특별시') || text.includes('경기도') || text.includes('인천광역시'))) {
                    // Check for detailed address patterns
                    if (/[시도]\s+[가-힣]+[구시군]/.test(text)) {
                        addressCandidates.push(text);
                    }
                }
            }

            // Also try specific selector provided by user just in case
            // #topleft > div:nth-child(11) > div > p
            // Note: nth-child is brittle, let's look for "위치" section

            // Sometimes the studio name is at the end of the address? 
            // "대한민국 서울특별시 관악구 은천동 양녕로1길 48 지하1층 아토우플로어" -> Studio: 아토우플로어

            // Just return the first robust candidate
            // Filter out short non-addresses
            const best = addressCandidates.sort((a, b) => b.length - a.length)[0]; // Longest is usually full address
            return best || null;
        });

    } catch (e) {
        console.error(`Error scraping ${url}:`, e.message);
        return null;
    }
}

async function geocode(page: any, query: string) {
    try {
        await page.goto(`https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`, { waitUntil: 'networkidle2' });

        return await page.evaluate(() => {
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
                    // script fallback
                    const scripts = document.querySelectorAll('script');
                    for (const s of Array.from(scripts)) {
                        const m = s.textContent?.match(/__APOLLO_STATE__\s*=\s*({.+?});/);
                        if (m) { state = JSON.parse(m[1]); break; }
                    }
                }

                if (state) {
                    const placeKeys = Object.keys(state).filter(k => k.startsWith('PlaceSummary'));
                    for (const k of placeKeys) {
                        const p = state[k];
                        if (p.x && p.y) {
                            bestMatch = {
                                lat: parseFloat(p.y),
                                lng: parseFloat(p.x),
                                address: p.fullAddress || p.roadAddress || p.jibunAddress,
                                name: p.name
                            };
                            break;
                        }
                    }
                }
            } catch (e) { }
            return bestMatch;
        });
    } catch (e) {
        console.error(`Geocode error for ${query}:`, e.message);
        return null;
    }
}

async function run() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Filter for generic venues or force all "모카클래스" venues
    const targets = mochaData.filter((item: any) => item.venue === '모카클래스' || item.venue === 'Mocha Class');
    console.log(`Found ${targets.length} items to fix.`);

    let processed = 0;

    for (const item of targets) {
        if (!item.link) continue;

        console.log(`[${processed + 1}/${targets.length}] Processing ${item.title}...`);

        // 1. Scrape Address from Detail Page
        const fullAddress = await scrapeDetails(page, item.link);

        if (fullAddress) {
            console.log(`  Found Address: ${fullAddress}`);

            // Clean address for geocoding (remove trailing studio name if it confuses map?)
            // Naver search usually handles it well or we can strip specific suffix?
            // "대한민국" prefix usually ok.

            // 2. Geocode
            const geo = await geocode(page, fullAddress);

            if (geo) {
                console.log(`  Geocoded: ${geo.lat}, ${geo.lng} (${geo.name})`);

                // 3. Update Data
                // Construct a Unique Venue Name
                // We'll use "Mocha Class: [Studio Name]" if available, or fallback to Title/ID
                const studioName = geo.name || `Studio ${item.id.split('_')[1]}`;
                const newVenueName = `모카클래스 - ${studioName}`;

                // Update Performance Item
                item.venue = newVenueName;
                item.address = geo.address; // Normalized address

                // Update Venue DB
                venueData[newVenueName] = {
                    name: newVenueName,
                    address: geo.address,
                    lat: geo.lat,
                    lng: geo.lng,
                    mapped_region_id: 'auto-mochaclass'
                };

                // Periodically save
                if (processed % 10 === 0) {
                    fs.writeFileSync(MOCHA_DATA_PATH, JSON.stringify(mochaData, null, 2));
                    fs.writeFileSync(VENUES_PATH, JSON.stringify(venueData, null, 2));
                }
            } else {
                console.log(`  Failed to geocode address: ${fullAddress}`);
            }
        } else {
            console.log(`  Failed to extract address from page.`);
        }

        processed++;
        await delay(1000); // Politeness
    }

    // Final Save
    fs.writeFileSync(MOCHA_DATA_PATH, JSON.stringify(mochaData, null, 2));
    fs.writeFileSync(VENUES_PATH, JSON.stringify(venueData, null, 2));

    await browser.close();
    console.log("Done.");
}

run().catch(console.error);
