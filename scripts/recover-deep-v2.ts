
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import pLimit from 'p-limit';

const KAKAO_API_KEY = 'e18ee199818819d830c3fe479aa1ca71';
const DATA_DIR = path.join(process.cwd(), 'src/data');
const VENUES_PATH = path.join(DATA_DIR, 'venues.json');

const EXCLUDE_KEYWORDS = ['투어', '온라인', '플랫폼', '예매', '상시', '모카클래스 서울'];

async function searchKakao(query: string) {
    try {
        // Try Keyword Search first
        let res = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json', {
            headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` },
            params: { query, size: 1 }
        });

        if (res.data.documents && res.data.documents.length > 0) {
            const doc = res.data.documents[0];
            return {
                address: doc.road_address_name || doc.address_name,
                lat: parseFloat(doc.y),
                lng: parseFloat(doc.x)
            };
        }

        // Try Address Search
        res = await axios.get('https://dapi.kakao.com/v2/local/search/address.json', {
            headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` },
            params: { query, size: 1 }
        });

        if (res.data.documents && res.data.documents.length > 0) {
            const doc = res.data.documents[0];
            return {
                address: doc.road_address?.address_name || doc.address?.address_name,
                lat: parseFloat(doc.y),
                lng: parseFloat(doc.x)
            };
        }
        return null;
    } catch (e: any) {
        return null;
    }
}

async function run() {
    console.log('🚀 Starting Deep Coordinate Recovery...');
    const venues = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf-8'));

    const missing = Object.keys(venues).filter(k => {
        if (venues[k].lat && venues[k].lng) return false;
        if (EXCLUDE_KEYWORDS.some(kw => k.includes(kw))) return false;
        return true;
    });

    console.log(`Found ${missing.length} venues needing coordinates.`);
    if (missing.length === 0) return;

    const limit = pLimit(5);
    let successCount = 0;
    let processedCount = 0;

    const tasks = missing.map(name => limit(async () => {
        // Use name for better accuracy
        const query = (venues[name].address && venues[name].address !== '정보 없음')
            ? venues[name].address
            : name;

        const result = await searchKakao(query);
        processedCount++;

        if (result) {
            venues[name].lat = result.lat;
            venues[name].lng = result.lng;
            venues[name].address = result.address;
            successCount++;
            process.stdout.write('✅');
        } else {
            process.stdout.write('❌');
        }

        if (processedCount % 50 === 0) {
            fs.writeFileSync(VENUES_PATH, JSON.stringify(venues, null, 2), 'utf-8');
            console.log(`\n💾 Saved progress (${successCount} recovered)`);
        }

        await new Promise(r => setTimeout(r, 100));
    }));

    await Promise.all(tasks);

    fs.writeFileSync(VENUES_PATH, JSON.stringify(venues, null, 2), 'utf-8');
    console.log(`\n\nDone! Recovered ${successCount} coordinates.`);
}

run();
