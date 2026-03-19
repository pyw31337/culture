
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { progressLogger } from './utils/progress-logger';
try {
    const envLocal = fs.readFileSync('.env.local', 'utf-8');
    envLocal.split('\n').filter(line => line.includes('=')).forEach(line => {
        const [key, ...valueParts] = line.split('=');
        process.env[key.trim()] = valueParts.join('=').trim();
    });
} catch (e) { }

const KAKAO_API_KEY = process.env.KAKAO_REST_API_KEY || '';
const MOCHA_DATA_PATH = path.resolve(process.cwd(), 'src/data/mochaclass.json');
const VENUES_PATH = path.resolve(process.cwd(), 'src/data/venues.json');

async function searchKakao(query: string) {
    if (!KAKAO_API_KEY) return null;
    try {
        // Try Address Search (usually more accurate for full address strings)
        let res = await axios.get('https://dapi.kakao.com/v2/local/search/address.json', {
            headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` },
            params: { query, size: 1 }
        });

        if (res.data.documents && res.data.documents.length > 0) {
            const doc = res.data.documents[0];
            return {
                address: doc.road_address?.address_name || doc.address?.address_name,
                lat: parseFloat(doc.y),
                lng: parseFloat(doc.x),
                name: doc.road_address?.building_name || query.split(' ').slice(-1)[0]
            };
        }

        // Try Keyword Search as fallback
        res = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json', {
            headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` },
            params: { query, size: 1 }
        });

        if (res.data.documents && res.data.documents.length > 0) {
            const doc = res.data.documents[0];
            return {
                address: doc.road_address_name || doc.address_name,
                lat: parseFloat(doc.y),
                lng: parseFloat(doc.x),
                name: doc.place_name
            };
        }

        return null;
    } catch (e) {
        return null;
    }
}

function cleanVenueString(v: string) {
    if (!v) return '';
    return v
        .replace(/^위치대한민국\s*/, '')
        .replace(/^위치\s*/, '')
        .replace(/^대한민국\s*/, '')
        .replace(/공간\s*소개$/, '')
        .replace(/공간소개$/, '')
        .replace(/찾아오는\s*길$/, '')
        .trim();
}

async function run() {
    console.log('🚀 MochaClass Geocoding Cleanup v2 starting...');
    
    if (!fs.existsSync(MOCHA_DATA_PATH)) {
        console.error('Error: mocha data file not found');
        return;
    }

    const mochaData = JSON.parse(fs.readFileSync(MOCHA_DATA_PATH, 'utf-8'));
    const venueData = fs.existsSync(VENUES_PATH) ? JSON.parse(fs.readFileSync(VENUES_PATH, 'utf-8')) : {};

    // Filter items that need fixing:
    // 1. Venue string contains junk ("위치", "대한민국")
    // 2. Latitude is missing or invalid (0, 12, etc.)
    const targets = mochaData.filter((item: any) => {
        const v = item.venue || '';
        const hasJunk = v.includes('위치') || v.includes('대한민국') || v.includes('공간 소개');
        const hasJunkCoords = !item.lat || !item.lng || (item.lat === 0 && item.lng === 12) || (item.latitude === 0 && item.longitude === 12);
        return hasJunk || hasJunkCoords;
    });

    if (targets.length === 0) {
        console.log('✅ No items needing fix found.');
        return;
    }

    const mainBar = progressLogger.createBar(`Cleaning MochaClass Data`, targets.length);
    
    let fixed = 0;
    let failed = 0;

    for (const item of targets) {
        const rawVenue = item.venue || '';
        const cleaned = cleanVenueString(rawVenue);
        
        mainBar.update(fixed + failed, { status: `Geocoding: ${cleaned.substring(0, 30)}...` });

        const result = await searchKakao(cleaned);

        if (result) {
            item.venue = `모카클래스 - ${result.name}`;
            item.address = result.address;
            item.lat = result.lat;
            item.lng = result.lng;
            // Also update the unified venue database
            venueData[item.venue] = {
                name: item.venue,
                address: result.address,
                lat: result.lat,
                lng: result.lng,
                source: 'kakao-cleanup-v2'
            };
            fixed++;
        } else {
            // If API fails, at least clean the venue string if it had junk
            item.venue = cleaned;
            failed++;
        }
        
        mainBar.increment();

        // Save progress every 20 items internally
        if (fixed % 20 === 0) {
            fs.writeFileSync(MOCHA_DATA_PATH, JSON.stringify(mochaData, null, 2));
            fs.writeFileSync(VENUES_PATH, JSON.stringify(venueData, null, 2));
        }
        
        // Anti-rate limit
        await new Promise(r => setTimeout(r, 50));
    }

    // Final save
    fs.writeFileSync(MOCHA_DATA_PATH, JSON.stringify(mochaData, null, 2));
    fs.writeFileSync(VENUES_PATH, JSON.stringify(venueData, null, 2));

    progressLogger.stop();
    console.log(`\n✨ Cleanup Complete!`);
    console.log(`- Fixed: ${fixed}`);
    console.log(`- Failed: ${failed}`);
}

run().catch(err => {
    progressLogger.stop();
    console.error('Fatal error:', err);
});
