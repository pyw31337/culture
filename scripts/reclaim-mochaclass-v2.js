
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { progressLogger } = require('./utils/progress-logger.js');

// Bypassing .env.local EPERM by hardcoding
const KAKAO_API_KEY = 'e18ee199818819d830c3fe479aa1ca71';
const MOCHA_DATA_PATH = path.resolve(process.cwd(), 'src/data/mochaclass.json');
const VENUES_PATH = path.resolve(process.cwd(), 'src/data/venues.json');

async function searchKakao(query) {
    if (!KAKAO_API_KEY) return null;
    try {
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
    } catch (e) { return null; }
}

function cleanVenueString(v) {
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
    console.log('🚀 MochaClass Geocoding Cleanup v2 (JS) starting...');
    const mochaData = JSON.parse(fs.readFileSync(MOCHA_DATA_PATH, 'utf-8'));
    const venueData = fs.existsSync(VENUES_PATH) ? JSON.parse(fs.readFileSync(VENUES_PATH, 'utf-8')) : {};

    const targets = mochaData.filter((item) => {
        const v = item.venue || '';
        const hasJunk = v.includes('위치') || v.includes('대한민국') || v.includes('공간 소개');
        const lat = item.lat !== undefined ? item.lat : item.latitude;
        const lng = item.lng !== undefined ? item.lng : item.longitude;
        const missingCoords = lat === undefined || lng === undefined || lat === 0 || (lat === 0 && lng === 12);
        return hasJunk || missingCoords;
    });

    if (targets.length === 0) {
        console.log('✅ No items needing fix found.');
        return;
    }

    const mainBar = progressLogger.createBar('main', targets.length, 'Initializing...');
    
    let fixed = 0;
    let failed = 0;

    for (let i = 0; i < targets.length; i++) {
        const item = targets[i];
        const rawVenue = item.venue || '';
        const cleaned = cleanVenueString(rawVenue);
        
        progressLogger.update('main', i, `Geocoding: ${cleaned.substring(0, 30)}...`);

        const result = await searchKakao(cleaned);

        if (result) {
            item.venue = `모카클래스 - ${result.name}`;
            item.address = result.address;
            item.lat = result.lat;
            item.lng = result.lng;
            venueData[item.venue] = {
                name: item.venue,
                address: result.address,
                lat: result.lat,
                lng: result.lng,
                source: 'kakao-cleanup-v2'
            };
            fixed++;
        } else {
            item.venue = cleaned;
            failed++;
        }
        
        progressLogger.increment('main');

        if (fixed % 20 === 0) {
            fs.writeFileSync(MOCHA_DATA_PATH, JSON.stringify(mochaData, null, 2));
            fs.writeFileSync(VENUES_PATH, JSON.stringify(venueData, null, 2));
        }
        await new Promise(r => setTimeout(r, 60));
    }

    fs.writeFileSync(MOCHA_DATA_PATH, JSON.stringify(mochaData, null, 2));
    fs.writeFileSync(VENUES_PATH, JSON.stringify(venueData, null, 2));

    progressLogger.stop();
    console.log(`\n✨ Cleanup Complete! Fixed: ${fixed}, Failed: ${failed}`);
}

run().catch(console.error);
