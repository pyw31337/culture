
import * as fs from 'fs';
import * as path from 'path';

const VENUES_PATH = path.resolve(process.cwd(), 'src/data/venues.json');
const HIERARCHY_PATH = path.resolve(process.cwd(), 'src/data/korean_address_hierarchy.json');

// Manual mapping for region ID
const REGION_ID_MAP: Record<string, string> = {
    '서울': 'seoul', '경기': 'gyeonggi', '인천': 'incheon', '강원': 'gangwon',
    '제주': 'jeju', '부산': 'busan', '대구': 'daegu', '광주': 'gwangju',
    '대전': 'daejeon', '울산': 'ulsan', '세종': 'sejong',
    '충북': 'chungbuk', '충청북': 'chungbuk',
    '충남': 'chungnam', '충청남': 'chungnam',
    '전북': 'jeonbuk', '전라북': 'jeonbuk', '전북특별자치도': 'jeonbuk',
    '전남': 'jeonnam', '전라남': 'jeonnam',
    '경북': 'gyeongbuk', '경상북': 'gyeongbuk',
    '경남': 'gyeongnam', '경상남': 'gyeongnam'
};

function run() {
    console.log('Starting Static Region/District Fill...');
    const venues = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf-8'));
    const hierarchy = JSON.parse(fs.readFileSync(HIERARCHY_PATH, 'utf-8'));

    // Flatten hierarchy for easier district lookup if needed, 
    // but usually we match Region first then District.

    let updatedCount = 0;

    for (const key of Object.keys(venues)) {
        const v = venues[key];
        // Target: missing mapped_region_id OR district
        if (v.mapped_region_id && v.district) continue;

        const address = v.address || v.name;
        if (!address) continue;

        let foundRegion = v.mapped_region_id;
        let foundDistrict = v.district;

        // 1. Find Region if missing
        if (!foundRegion) {
            // Check start of address
            for (const [k, id] of Object.entries(REGION_ID_MAP)) {
                if (address.startsWith(k)) {
                    foundRegion = id;
                    break;
                }
            }
        }

        // 2. Find District if missing (requires knowing Region or guessing)
        if (!foundDistrict) {
            // If we know region, look in hierarchy
            if (foundRegion) {
                // Find hierarchy key for this region id
                // (Need to reverse REGION_ID_MAP or just search keys)
                // Hierarchy keys are short: "서울", "경기"...
                // REGION_ID_MAP has '서울' -> 'seoul'.
                // So valid hierarchy keys are keys of REGION_ID_MAP where value == foundRegion

                const hierarchyKey = Object.keys(REGION_ID_MAP).find(k => REGION_ID_MAP[k] === foundRegion && hierarchy[k]);

                if (hierarchyKey && hierarchy[hierarchyKey]) {
                    const districts = hierarchy[hierarchyKey];
                    // Search address for these districts
                    for (const d of districts) {
                        if (address.includes(d)) {
                            foundDistrict = d;
                            break;
                        }
                    }
                }
            } else {
                // Region unknown? Try to find any district match globally (risky but okay for fallback)
                // E.g. "강남구" -> implies Seoul?
                // Let's safe skip if region unknown for now, or match known unique districts.
            }
        }

        if (foundRegion !== v.mapped_region_id || foundDistrict !== v.district) {
            venues[key].mapped_region_id = foundRegion || '';
            venues[key].district = foundDistrict || '';
            updatedCount++;
        }
    }

    fs.writeFileSync(VENUES_PATH, JSON.stringify(venues, null, 2));
    console.log(`Updated ${updatedCount} venues with static region/district data.`);
}

run();
