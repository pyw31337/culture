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

console.log('Auditing Venue addresses...');

let fixCount = 0;
let unknownCount = 0;

for (const key in venues) {
    const venue = venues[key];
    const address = venue.address || '';

    // 1. Identify primary region from address
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
                    // console.log(`Fixed unknown region for ${venue.name} using district ${curDistrict} -> ${reg}`);
                    fixCount++;
                    break;
                }
            }
        }
    }

    if (foundRegion) {
        // 2. Validate/Fix District
        const possibleDistricts = hierarchy[foundRegion];
        const curDistrict = venue.district;

        // Specific fix for Michuhol-gu: If it's Michuhol-gu, foundRegion MUST be Incheon
        if (curDistrict === '미추홀구' && foundRegion !== '인천') {
            console.log(`Mismatch: ${venue.name} has Michuhol-gu but region is ${foundRegion}. Fixing to 인천.`);
            foundRegion = '인천';
            venue.address = address.replace(/경기|서울|인천/, '인천'); // Rough fix
            fixCount++;
        }

        // Check if district is in the allowed list for this region
        if (curDistrict && !possibleDistricts.includes(curDistrict)) {
            // Try to find correct region for this district
            let correctRegion = '';
            for (const reg in hierarchy) {
                if (hierarchy[reg].includes(curDistrict)) {
                    correctRegion = reg;
                    break;
                }
            }

            if (correctRegion && correctRegion !== foundRegion) {
                // console.log(`Inconsistent: ${venue.name} District ${curDistrict} belongs to ${correctRegion} but address says ${foundRegion}. Updating region id.`);
                foundRegion = correctRegion;
                fixCount++;
            }
        }

        // Update venue properties
        venue.mapped_region_id = regionMapping[foundRegion];

        // If address starts with region but district is missing, try to extract it
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
        // console.warn(`Could not determine region for: ${venue.name} (${address})`);
    }
}

console.log(`Audit complete. Fixed: ${fixCount}, Unknown: ${unknownCount}`);

fs.writeFileSync(venuesPath, JSON.stringify(venues, null, 2));
console.log('Saved updated venues.json');
