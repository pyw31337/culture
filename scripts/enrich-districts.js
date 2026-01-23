// Script to enrich venues.json with district data parsed from address
const fs = require('fs');

const VENUES_PATH = 'src/data/venues.json';
const data = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf8'));

// Korean district patterns
// Special cities (특별시/광역시) have 구 (district)
// Provinces (도) have 시/군/구 (city/county/district)
function extractDistrict(address) {
    if (!address) return null;

    // Pattern 1: "구" type (서울, 부산, 대구, 인천, 광주, 대전, 울산)
    // e.g., "서울시 강남구" -> "강남구"
    const guMatch = address.match(/([가-힣]+구)/);

    // Pattern 2: "시" type for provinces (경기도 수원시, 경상남도 창원시)
    // e.g., "경기도 수원시 팔달구" -> "수원시"
    const siMatch = address.match(/([가-힣]+시)/g);

    // Pattern 3: "군" type (군 areas)
    // e.g., "충남 홍성군" -> "홍성군"
    const gunMatch = address.match(/([가-힣]+군)/);

    // For special cities (서울, 부산, 대구, 인천, 광주, 대전, 울산)
    const specialCities = ['서울', '부산', '대구', '인천', '광주', '대전', '울산'];
    const isSpecialCity = specialCities.some(c => address.includes(c));

    if (isSpecialCity && guMatch) {
        return guMatch[1]; // Return 구
    }

    // For provinces - return city (시) or county (군)
    if (siMatch && siMatch.length > 0) {
        // Skip special city names that end with 시 (e.g., 서울특별시, 부산광역시)
        const validSi = siMatch.find(m =>
            !m.includes('특별') &&
            !m.includes('광역') &&
            !['서울시', '부산시', '대구시', '인천시', '광주시', '대전시', '울산시'].includes(m)
        );
        if (validSi) return validSi;
    }

    if (gunMatch) {
        return gunMatch[1];
    }

    return null;
}

function getRegion(address) {
    if (!address) return null;
    if (address.includes('서울')) return 'seoul';
    if (address.includes('경기')) return 'gyeonggi';
    if (address.includes('인천')) return 'incheon';
    if (address.includes('부산')) return 'busan';
    if (address.includes('대구')) return 'daegu';
    if (address.includes('광주')) return 'gwangju';
    if (address.includes('대전')) return 'daejeon';
    if (address.includes('울산')) return 'ulsan';
    if (address.includes('세종')) return 'sejong';
    if (address.includes('강원')) return 'gangwon';
    if (address.includes('충북') || address.includes('충청북도')) return 'chungbuk';
    if (address.includes('충남') || address.includes('충청남도')) return 'chungnam';
    if (address.includes('전북') || address.includes('전라북도') || address.includes('전북특별자치도')) return 'jeonbuk';
    if (address.includes('전남') || address.includes('전라남도')) return 'jeonnam';
    if (address.includes('경북') || address.includes('경상북도')) return 'gyeongbuk';
    if (address.includes('경남') || address.includes('경상남도')) return 'gyeongnam';
    if (address.includes('제주')) return 'jeju';
    return null;
}

let updated = 0;
let regionUpdated = 0;

Object.keys(data).forEach(key => {
    const venue = data[key];
    const addr = venue.address || '';

    // Enrich district if missing
    if (!venue.district) {
        const district = extractDistrict(addr);
        if (district) {
            venue.district = district;
            updated++;
        }
    }

    // Also set mapped_region_id if not set
    if (!venue.mapped_region_id) {
        const region = getRegion(addr);
        if (region) {
            venue.mapped_region_id = region;
            regionUpdated++;
        }
    }
});

// Save
fs.writeFileSync(VENUES_PATH, JSON.stringify(data, null, 2));

console.log(`Updated ${updated} venues with district data.`);
console.log(`Updated ${regionUpdated} venues with mapped_region_id.`);
console.log(`Saved to ${VENUES_PATH}`);
