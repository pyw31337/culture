
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

const MOCHA_DATA_PATH = path.resolve(process.cwd(), 'src/data/mochaclass.json');
const VENUES_PATH = path.resolve(process.cwd(), 'src/data/venues.json');

const mochaData = JSON.parse(fs.readFileSync(MOCHA_DATA_PATH, 'utf-8'));
const venueData = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf-8'));

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function geocode(page: any, query: string) {
    try {
        await page.goto(`https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`, { waitUntil: 'networkidle2', timeout: 30000 });

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
        console.error(`Geocode error for ${query}:`, (e as any).message);
        return null;
    }
}

async function run() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    // Candidates: Venue contains address-like strings or starts with "위치"
    const targets = mochaData.filter((item: any) => {
        const v = item.venue || '';
        return v.startsWith('위치') || v.includes('광역') || v.includes('특별') || v.includes('경기도') || v.includes('서울특별시') || (v.length > 20 && v.includes(' '));
    });

    console.log(`Found ${targets.length} targets for reclamation.`);

    let processed = 0;
    let fixed = 0;

    // Limit to 100 for this run to be safe and fast
    const batch = targets.slice(0, 50);

    for (const item of batch) {
        processed++;
        const rawVenue = item.venue;

        // Clean query: Remove "위치", "대한민국", "공간 소개" etc.
        let query = rawVenue.replace(/^위치/, '').replace(/^대한민국\s+/, '').replace(/공간\s*소개$/, '').trim();

        console.log(`[${processed}/${batch.length}] Reclaiming: ${query}`);

        const geo = await geocode(page, query);

        if (geo) {
            const newVenueName = `모카클래스 - ${geo.name}`;
            console.log(`  -> Fixed: ${newVenueName} (${geo.lat}, ${geo.lng})`);

            item.venue = newVenueName;
            item.address = geo.address;

            venueData[newVenueName] = {
                name: newVenueName,
                address: geo.address,
                lat: geo.lat,
                lng: geo.lng,
                mapped_region_id: 'auto-mochaclass'
            };
            fixed++;
        } else {
            console.log(`  -> Failed to geocode.`);
        }

        if (fixed % 10 === 0) {
            fs.writeFileSync(MOCHA_DATA_PATH, JSON.stringify(mochaData, null, 2));
            fs.writeFileSync(VENUES_PATH, JSON.stringify(venueData, null, 2));
        }

        await delay(1000);
    }

    fs.writeFileSync(MOCHA_DATA_PATH, JSON.stringify(mochaData, null, 2));
    fs.writeFileSync(VENUES_PATH, JSON.stringify(venueData, null, 2));

    await browser.close();
    console.log(`Reclamation complete. Fixed ${fixed}/${processed} items.`);
}

run().catch(console.error);
