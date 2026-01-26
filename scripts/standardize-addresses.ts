
import fs from 'fs';
import path from 'path';

const VENUES_FILE = path.resolve(process.cwd(), 'src/data/venues.json');

// Mappings for Province Normalization
const PROVINCE_MAP: Record<string, string> = {
    '강원도': '강원',
    '강원특별자치도': '강원',
    '경기도': '경기',
    '경상남도': '경남',
    '경상북도': '경북',
    '전라남도': '전남',
    '전라북도': '전북',
    '전북특별자치도': '전북',
    '충청남도': '충남',
    '충청북도': '충북',
    '제주도': '제주',
    '제주특별자치도': '제주',
    '서울특별시': '서울',
    '서울시': '서울',
    '부산광역시': '부산',
    '부산시': '부산',
    '대구광역시': '대구',
    '대구시': '대구',
    '인천광역시': '인천',
    '인천시': '인천',
    '광주광역시': '광주',
    '광주시': '광주', // Warning: Could be Gyeonggi Gwangju? usually "경기 광주시"
    '대전광역시': '대전',
    '대전시': '대전',
    '울산광역시': '울산',
    '울산시': '울산',
    '세종특별자치시': '세종',
    '세종시': '세종'
};

// Mappings for City -> Correct Province (Fixing misclassifications)
// Key: City Name, Value: Provincd
const CITY_CORRECTION: Record<string, string> = {
    '과천시': '경기',
    '광명시': '경기',
    '부천시': '경기',
    '성남시': '경기',
    '수원시': '경기',
    '안양시': '경기',
    '용인시': '경기',
    '의왕시': '경기',
    '하남시': '경기',
    '고양시': '경기',
    '구리시': '경기',
    '남양주시': '경기',
    '오산시': '경기',
    '시흥시': '경기',
    '군포시': '경기',
    '파주시': '경기',
    '김포시': '경기',
    '화성시': '경기',
    '양주시': '경기',
    '포천시': '경기',
    '여주시': '경기',
    '춘천시': '강원',
    '원주시': '강원',
    '강릉시': '강원',
    '동해시': '강원',
    '태백시': '강원',
    '속초시': '강원',
    '삼척시': '강원',
    '홍천군': '강원',
    '횡성군': '강원',
    '영월군': '강원',
    '평창군': '강원',
    '정선군': '강원',
    '철원군': '강원',
    '화천군': '강원',
    '양구군': '강원',
    '인제군': '강원',
    '고성군': '강원',
    '양양군': '강원'
};

// Ambiguous Cities handling
// '광주시' -> If address does not start with '광주' (Gwangju Metro), mapped to '경기' if normalized context implies it.
// Actually 'Gwangju City' in Gyeonggi is '경기 광주시'. 'Gwangju Metro' is '광주 ...'.

async function run() {
    console.log('Starting Address Standardization...');

    if (!fs.existsSync(VENUES_FILE)) {
        console.error('Venues file not found.');
        return;
    }

    const venues = JSON.parse(fs.readFileSync(VENUES_FILE, 'utf-8'));
    let fixedCount = 0;

    for (const key of Object.keys(venues)) {
        const v = venues[key];
        let addr = v.address || '';

        // Skip empty
        if (!addr || addr === '정보 없음') continue;

        // 1. Split Address
        let parts = addr.split(' ');
        if (parts.length < 2) continue;

        let province = parts[0];
        let city = parts[1];

        // 2. Normalize Province
        if (PROVINCE_MAP[province]) {
            province = PROVINCE_MAP[province];
        }

        // 3. Check City Correction (e.g. User wrote "Seoul Gwacheon-si")
        // If the city exists in our correction map, FORCE the province.
        if (CITY_CORRECTION[city]) {
            const correctProvince = CITY_CORRECTION[city];
            if (province !== correctProvince) {
                // console.log(`[Correction] ${key}: ${province} ${city} -> ${correctProvince} ${city}`);
                province = correctProvince;
            }
        }

        // 3.5 Handle Gwangju ambiguity
        if (parts[0] === '광주시' || parts[1] === '광주시') {
            // Need heurisitics or manual check. 
            // If original address had "경기도", it's Gyeonggi.
            // If "광주광역시", it's Gwangju.
            // If just "광주시", assuming Gyeonggi if not explicitly Metro format?
            // Actually, Gwangju Metro is usually "광주". Gyeonggi Gwangju is "경기 광주시".
            if (v.address.includes('경기도')) province = '경기';
            else if (v.address.includes('광주광역시')) province = '광주';
        }

        // 4. Reconstruct Standard Address
        // But preserve the rest (parts[2...])
        // If normalized province is different from original part[0], replace it.

        // Update parts
        parts[0] = province;
        // Ensure city is correct in parts[1] (it is, unless we shifted?)

        const newAddress = parts.join(' ');
        const newDistrict = city; // Default District/City is the 2nd token

        // 5. Update Venue Object if changed
        if (newAddress !== v.address || newDistrict !== v.district) {
            venues[key] = {
                ...v,
                address: newAddress,
                district: newDistrict
            };
            fixedCount++;
        }
    }

    if (fixedCount > 0) {
        console.log(`Updated dictionary for ${fixedCount} venues.`);
        fs.writeFileSync(VENUES_FILE, JSON.stringify(venues, null, 2));
    } else {
        console.log('No address changes needed.');
    }
}

run();
