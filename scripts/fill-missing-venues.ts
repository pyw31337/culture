
import * as fs from 'fs';
import * as path from 'path';

const venuePath = path.resolve(process.cwd(), 'src/data/venues.json');
const venueData = JSON.parse(fs.readFileSync(venuePath, 'utf-8'));

// 1. Hardcoded Landmarks (For Top Missing)
// Coordinates sourced from standard maps
const LANDMARKS: Record<string, { lat: number, lng: number, address?: string }> = {
    "롯데월드 민속박물관": { lat: 37.5113, lng: 127.0982, address: "서울 송파구 올림픽로 240" },
    "서울공예박물관": { lat: 37.5772, lng: 126.9836, address: "서울 종로구 율곡로3길 4" },
    "국립고궁박물관": { lat: 37.5764, lng: 126.9749, address: "서울 종로구 효자로 12" },
    "독립기념관": { lat: 36.7836, lng: 127.2234, address: "충남 천안시 동남구 목천읍 독립기념관로 1" },
    "국립해양박물관": { lat: 35.0787, lng: 129.0805, address: "부산 영도구 해양로301번길 45" },
    "국립중앙과학관": { lat: 36.3773, lng: 127.3826, address: "대전 유성구 대덕대로 481" },
    "국립세계문자박물관": { lat: 37.3915, lng: 126.6375, address: "인천 연수구 센트럴로 217" },
    "복천박물관": { lat: 35.2078, lng: 129.0911, address: "부산 동래구 복천로 63" },
    "수원시립만석전시관": { lat: 37.3005, lng: 126.9959, address: "경기 수원시 장안구 송정로 19" },
    "경남문화예술회관": { lat: 35.1843, lng: 128.0934, address: "경남 진주시 강남로 215" }
};

interface Venue {
    name: string;
    address: string;
    district?: string;
    lat: number;
    lng: number;
    mapped_region_id?: string;
}

let fixedAddressCount = 0;
let fixedCoordsCount = 0;

// Regex for extracting address from Name
// e.g. "부산 북구 상리로 65 (만덕동) ..." -> "부산 북구 상리로 65"
// Matches Start with Region -> City/District -> Road/Lot -> Number
const ADDRESS_IN_NAME_REGEX = /((?:서울|경기|부산|대구|인천|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)[a-zA-Z가-힣0-9\s,.-]+(?:로|길|동|가|읍|면|리)\s*\d+(?:-\d+)?)/;

Object.entries(venueData).forEach(([key, value]) => {
    const v = value as Venue;
    let modified = false;

    if (!v.address || v.address.length < 2 || v.address === '주소 정보 없음' || v.address.includes('상세페이지')) {
        // Try relaxed regex (Allow parens)
        const simpleAddress = key.match(/((서울|경기|부산|대구|인천|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주).+?(동|읍|면|가|리|로|길)\s*\d+(?:-\d+)?)/);

        if (simpleAddress && simpleAddress[1]) {
            v.address = simpleAddress[1].trim();
            modified = true;
            fixedAddressCount++;

            const distMatch = v.address.match(/\s(\S+구|\S+시|\S+군)\s/);
            if (distMatch) {
                v.district = distMatch[1];
            }
        } else if (key.length > 5 && !v.address) {
            // Debug print for potential misses
            console.log(`[Missed Candidate] ${key}`);
        }
    }

    // 2. Fix Missing Coordinates using Landmarks
    if (v.lat === 0 || v.lng === 0 || !v.lat) {
        // Exact match
        if (LANDMARKS[key]) {
            v.lat = LANDMARKS[key].lat;
            v.lng = LANDMARKS[key].lng;
            if (!v.address) v.address = LANDMARKS[key].address || "";
            modified = true;
            fixedCoordsCount++;
        }
        // Partial match for famous museums (if safe)
        else {
            for (const [mark, info] of Object.entries(LANDMARKS)) {
                if (key.includes(mark) && key.length < mark.length + 5) {
                    v.lat = info.lat;
                    v.lng = info.lng;
                    if (!v.address) v.address = info.address || "";
                    modified = true;
                    fixedCoordsCount++;
                    break;
                }
            }
        }
    }

    if (modified) {
        venueData[key] = v;
    }
});

fs.writeFileSync(venuePath, JSON.stringify(venueData, null, 2));

console.log(`[Venue Fixer] Report`);
console.log(`- Fixed addresses extracted from name: ${fixedAddressCount}`);
console.log(`- Fixed coordinates using landmarks: ${fixedCoordsCount}`);
console.log(`- Total Venues processed: ${Object.keys(venueData).length}`);
