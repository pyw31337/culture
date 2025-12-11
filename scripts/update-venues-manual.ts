
import fs from 'fs';
import path from 'path';

const KAKAO_API_KEY = 'e18ee199818819d830c3fe479aa1ca71';
const VENUES_PATH = path.join(process.cwd(), 'src/data/venues.json');
const venues = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf-8'));

// 1. Manual Updates
const manualUpdates = {
    // Exact keys as per grep
    "헤이리 팝트릭아트 93뮤지엄": "경기 파주시 탄현면 헤이리마을길 93-53",
    "트릭아트뮤지엄": "경기 파주시 탄현면 헤이리마을길 93-53", // In case duplicate
    "해바라기소극장": "서울 종로구 동숭길 76 해바라기소극장",
    "해바라기 소극장": "서울 종로구 동숭길 76 해바라기소극장" // User typed space, file might have it? grep showed "해바라기 소극장" too.
};

async function geocode(address: string) {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`;
    try {
        const res = await fetch(url, { headers: { 'Authorization': `KakaoAK ${KAKAO_API_KEY}` } });
        const data = await res.json();
        return data.documents && data.documents.length > 0 ? data.documents[0] : null;
    } catch (e) {
        console.error(e);
        return null;
    }
}

async function run() {
    // A. Apply Manual Address Updates
    for (const [name, address] of Object.entries(manualUpdates)) {
        if (venues[name]) {
            const result = await geocode(address);
            if (result) {
                venues[name].address = address;
                venues[name].district = address.split(' ').find(p => p.endsWith('구') || p.endsWith('시') || p.endsWith('군')) || "";
                venues[name].lat = parseFloat(result.y);
                venues[name].lng = parseFloat(result.x);
                console.log(`[UPDATED] ${name} -> ${address}`);
            } else {
                console.log(`[FAIL] Could not geocode ${name}`);
            }
        }
    }

    // B. Explicit Hide (Delete from venues.json or rely on page.tsx filter?)
    // User said "Hide Blue Marine and Chosun Univ". 
    // If we delete them here, they might reappear. 
    // But page.tsx filter relies on "Seoul/Gyeonggi/Incheon".
    // Let's check their addresses. 
    // If "Blue Marine" is in target region but needs hiding, we can't just delete it if the scraper brings it back.
    // However, for now, updating the 'venues.json' doesn't stop the scraper from using it if the scraper uses this file as a base (it does).
    // Actually, the page.tsx loads venues.json and performances independently.
    // The safest way to "Hide" is to add an explicit blocklist in page.tsx OR ensure their address doesn't pass the filter.
    // I will inspect their addresses via grep first (done in parallel step).

    // Saving first.
    fs.writeFileSync(VENUES_PATH, JSON.stringify(venues, null, 2));
}

run();
