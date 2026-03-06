import fs from 'fs';
import path from 'path';

const KAKAO_API_KEY = 'e18ee199818819d830c3fe479aa1ca71';

const INTERPARK_PATH = path.join(process.cwd(), 'src/data/interpark.json');
const VENUES_PATH = path.join(process.cwd(), 'src/data/venues.json');
const DICT_PATH = path.join(process.cwd(), 'src/data/venue-dictionary.json');

const TARGET_VENUE_NAMES = ['OK 레저 ATV', '［제주］ OK레저 ATV'];
const CORRECT_ADDRESS = '제주특별자치도 서귀포시 표선면 번영로 2595';
const CORRECT_REGION = 'jeju';

async function geocode(address: string) {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`;
    try {
        const res = await fetch(url, { headers: { 'Authorization': `KakaoAK ${KAKAO_API_KEY}` } });
        const data = await res.json();
        if (data.documents && data.documents.length > 0) {
            return data.documents[0];
        }
    } catch (e) {
        console.error(`Error geocoding ${address}`, e);
    }
    return null;
}

async function run() {
    console.log('Fetching correct coordinates for Jeju ATV...');
    const result = await geocode(CORRECT_ADDRESS);

    if (!result) {
        console.error('Failed to geocode the correct address.');
        return;
    }

    const lat = parseFloat(result.y);
    const lng = parseFloat(result.x);
    const district = '서귀포시';

    console.log(`Geocoded Result: ${lat}, ${lng} (${district})`);

    // 1. Patch VENUES.JSON
    console.log('\n--- Patching venues.json ---');
    if (fs.existsSync(VENUES_PATH)) {
        const venues = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf-8'));
        let modified = false;

        for (const name of TARGET_VENUE_NAMES) {
            if (venues[name]) {
                venues[name].address = CORRECT_ADDRESS;
                venues[name].district = district;
                venues[name].lat = lat;
                venues[name].lng = lng;
                console.log(`[Fixed] venues.json -> ${name}`);
                modified = true;
            }
        }

        // Also check if any venue contains the wrong address, replace it entirely
        for (const [vName, vData] of Object.entries<any>(venues)) {
            if (vData.address && vData.address.includes('당산로 83')) {
                console.log(`[Rogue Venue Found] ${vName} has 당산로 83! Reassigning...`);
                // Only reassign if it matches ATV or something similar
                if (vName.includes('OK') || vName.includes('레저') || vName.includes('ATV')) {
                    vData.address = CORRECT_ADDRESS;
                    vData.district = district;
                    vData.lat = lat;
                    vData.lng = lng;
                    modified = true;
                }
            }
        }

        if (modified) {
            fs.writeFileSync(VENUES_PATH, JSON.stringify(venues, null, 2));
            console.log('Saved venues.json');
        } else {
            console.log('No changes needed in venues.json');
        }
    }

    // 2. Patch VENUE-DICTIONARY.JSON
    console.log('\n--- Patching venue-dictionary.json ---');
    if (fs.existsSync(DICT_PATH)) {
        const dict = JSON.parse(fs.readFileSync(DICT_PATH, 'utf-8'));
        let dictModified = false;

        for (const name of TARGET_VENUE_NAMES) {
            if (dict[name]) {
                dict[name].address = CORRECT_ADDRESS;
                dict[name].district = district;
                dict[name].lat = lat;
                dict[name].lng = lng;
                dict[name].mapped_region_id = CORRECT_REGION;
                console.log(`[Fixed] venue-dictionary.json -> ${name}`);
                dictModified = true;
            }
        }

        if (dictModified) {
            fs.writeFileSync(DICT_PATH, JSON.stringify(dict, null, 2));
            console.log('Saved venue-dictionary.json');
        } else {
            console.log('No changes needed in venue-dictionary.json');
        }
    }

    // 3. Patch INTERPARK.JSON
    console.log('\n--- Patching interpark.json ---');
    if (fs.existsSync(INTERPARK_PATH)) {
        const items = JSON.parse(fs.readFileSync(INTERPARK_PATH, 'utf-8'));
        let itemsModified = false;

        for (const item of items) {
            const isATV = item.id === 'perf_제주_OK레저_ATV' || TARGET_VENUE_NAMES.includes(item.venue) || (item.title && item.title.includes('OK레저 ATV'));
            if (isATV) {
                console.log(`[Found Item] ${item.title}`);
                if (item.region !== CORRECT_REGION || item.address?.includes('당산로')) {
                    item.region = CORRECT_REGION;
                    item.address = CORRECT_ADDRESS;
                    item.venue = 'OK 레저 ATV'; // Normalize venue name
                    item.district = district; // Optional helper
                    console.log(`[Fixed] interpark.json -> Changed region to ${CORRECT_REGION} and address to ${CORRECT_ADDRESS}`);
                    itemsModified = true;
                }
            }
        }

        if (itemsModified) {
            fs.writeFileSync(INTERPARK_PATH, JSON.stringify(items, null, 2));
            console.log('Saved interpark.json');
        } else {
            console.log('No changes needed in interpark.json');
        }
    }
}

run();
