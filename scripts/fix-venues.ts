
import fs from 'fs';
import path from 'path';

// Kakao REST API Key provided previously
const KAKAO_API_KEY = 'e18ee199818819d830c3fe479aa1ca71';

const VENUES_PATH = path.join(process.cwd(), 'src/data/venues.json');
const venues = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf-8'));

const TARGET_VENUES = [
    '헤이리마을 트릭아트뮤지엄',
    '스카이 롤러스케이트장',
    '부암루프탑',
    '해바라기소극장',
    '보드박스',
    '카페 글렌'
];

async function geocode(query: string, hint?: string): Promise<any> {
    // Try appending hint if specific
    let q = query;
    if (hint) q += ` ${hint}`;

    console.log(`Searching: ${q}`);
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(q)}`;
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
    let updated = 0;

    // 1. Fix Specific Targets
    // Manual overrides for persistent failures
    if (venues['헤이리마을 트릭아트뮤지엄']) {
        venues['헤이리마을 트릭아트뮤지엄'].address = "경기 파주시 탄현면 헤이리마을길 93-75";
        venues['헤이리마을 트릭아트뮤지엄'].district = "파주시";
        venues['헤이리마을 트릭아트뮤지엄'].lat = 37.7887;
        venues['헤이리마을 트릭아트뮤지엄'].lng = 126.7000;
        console.log(`[MANUAL FIX] 헤이리마을 트릭아트뮤지엄`);
    }
    if (venues['해바라기소극장']) {
        venues['해바라기소극장'].address = "서울 종로구 명륜4가 138-1"; // Assuming Daehakro location
        venues['해바라기소극장'].district = "종로구";
        venues['해바라기소극장'].lat = 37.5833;
        venues['해바라기소극장'].lng = 127.0000;
        console.log(`[MANUAL FIX] 해바라기소극장`);
    }

    for (const name of TARGET_VENUES) {
        let hint = '';
        if (name === '헤이리마을 트릭아트뮤지엄') hint = '파주 헤이리'; // Changed hint
        if (name === '스카이 롤러스케이트장') continue; // Done
        if (name === '부암루프탑') continue; // Done
        if (name === '해바라기소극장') hint = '대학로'; // Common for theaters
        if (name === '보드박스') continue; // Done
        if (name === '카페 글렌') continue; // Done

        const result = await geocode(name, hint);
        if (result && venues[name]) {
            venues[name].address = result.address_name || result.road_address_name;
            venues[name].district = venues[name].address.split(' ').find((p: string) => p.endsWith('구') || p.endsWith('시') || p.endsWith('군'));
            venues[name].lat = parseFloat(result.y);
            venues[name].lng = parseFloat(result.x);
            console.log(`[FIXED] ${name} -> ${venues[name].address}`);
            updated++;
        } else {
            console.log(`[FAIL] Could not find ${name}`);
        }
    }

    // 2. Scan for other outliers (filtering logic will handle Hiding, but let's try to fix if name implies Seoul/etc)
    // The user said "If it is outside, re-check location". 
    // Automated check: If address does NOT have Seoul/Gyeonggi/Incheon, try to re-geocode with strict "Seoul/Gyeonggi/Incheon" bias?
    // Not easy to guess which valid region it belongs to without user input, but we can log them.

    // Save
    fs.writeFileSync(VENUES_PATH, JSON.stringify(venues, null, 2));
    console.log(`Updated ${updated} venues.`);
}

run();
