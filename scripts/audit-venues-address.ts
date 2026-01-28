import * as fs from 'fs';
import * as path from 'path';

const hierarchyPath = path.resolve(process.cwd(), 'src/data/korean_address_hierarchy.json');
const venuesPath = path.resolve(process.cwd(), 'src/data/venues.json');

const hierarchy = JSON.parse(fs.readFileSync(hierarchyPath, 'utf8'));
const venues = JSON.parse(fs.readFileSync(venuesPath, 'utf8'));

const regionMapping: Record<string, string> = {
    '서울': 'seoul',
    '경기': 'gyeonggi',
    '인천': 'incheon',
    '부산': 'busan',
    '대구': 'daegu',
    '광주': 'gwangju',
    '대전': 'daejeon',
    '울산': 'ulsan',
    '세종': 'sejong',
    '강원': 'gangwon',
    '충북': 'chungbuk',
    '충남': 'chungnam',
    '전북': 'jeonbuk',
    '전남': 'jeonnam',
    '경북': 'gyeongbuk',
    '경남': 'gyeongnam',
    '제주': 'jeju'
};

const regionInverseMapping: Record<string, string> = Object.fromEntries(
    Object.entries(regionMapping).map(([k, v]) => [v, k])
);

const performancesPath = path.resolve(process.cwd(), 'public/data/performances.json');
const performances = JSON.parse(fs.readFileSync(performancesPath, 'utf8'));

console.log('Auditing Venue addresses...');

let fixCount = 0;
let unknownCount = 0;
let newVenueCount = 0;

// 1. Collect all unique venues from performances
const performanceVenues = new Set<string>();
performances.forEach((p: any) => {
    if (p.venue) performanceVenues.add(p.venue);
});

// 2. Add missing venues to venues.json if the venue name looks like an address
performanceVenues.forEach(vName => {
    if (!venues[vName]) {
        // Heuristic: If name starts with common region markers, it's likely an address
        const looksLikeAddress = /^(서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)/.test(vName);

        if (looksLikeAddress) {
            venues[vName] = {
                name: vName,
                address: vName,
                district: '',
                mapped_region_id: ''
            };
            newVenueCount++;
        }
    }
});

for (const key in venues) {
    const venue = venues[key];
    const address = venue.address || '';

    // skip if no address
    if (!address) {
        unknownCount++;
        continue;
    }

    // Identify primary region from address
    let foundRegion = '';
    for (const reg in hierarchy) {
        if (address.startsWith(reg) || address.includes(reg + ' ')) {
            foundRegion = reg;
            break;
        }
    }

    if (!foundRegion) {
        // Fallback: Check if we can infer from current district
        const curDistrict = venue.district;
        if (curDistrict) {
            for (const reg in hierarchy) {
                if (hierarchy[reg].includes(curDistrict)) {
                    foundRegion = reg;
                    fixCount++;
                    break;
                }
            }
        }
    }

    if (foundRegion) {
        const possibleDistricts = hierarchy[foundRegion];
        const curDistrict = venue.district;

        if (curDistrict === '미추홀구' && foundRegion !== '인천') {
            foundRegion = '인천';
            venue.address = address.replace(/경기|서울|인천/, '인천');
            fixCount++;
        }

        if (curDistrict && !possibleDistricts.includes(curDistrict)) {
            let correctRegion = '';
            for (const reg in hierarchy) {
                if (hierarchy[reg].includes(curDistrict)) {
                    correctRegion = reg;
                    break;
                }
            }

            if (correctRegion && correctRegion !== foundRegion) {
                foundRegion = correctRegion;
                fixCount++;
            }
        }

        venue.mapped_region_id = regionMapping[foundRegion];

        if (!venue.district) {
            for (const dist of possibleDistricts) {
                if (address.includes(dist)) {
                    venue.district = dist;
                    break;
                }
            }
        }
    } else {
        unknownCount++;
    }
}

console.log(`Audit complete. Added: ${newVenueCount}, Fixed: ${fixCount}, Unknown: ${unknownCount}`);

fs.writeFileSync(venuesPath, JSON.stringify(venues, null, 2));
console.log('Saved updated venues.json');
