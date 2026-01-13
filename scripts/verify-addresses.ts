
import fs from 'fs';
import path from 'path';
import axios from 'axios';
// import venueData from '../src/data/venues.json';
const venueData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/data/venues.json'), 'utf-8'));
const VENUES_PATH = path.join(process.cwd(), 'src/data/venues.json');
const KAKAO_API_KEY = '0236cfffa7cfef34abacd91a6d7c73c0';

interface Venue {
    name: string;
    address: string;
    description?: string;
    lat?: number;
    lng?: number;
    district?: string; // We will add/verify this
}

// Regex mapping for regions
const REGION_MAP: Record<string, string> = {
    '서울': 'seoul', '서울특별시': 'seoul',
    '경기': 'gyeonggi', '경기도': 'gyeonggi',
    '인천': 'incheon', '인천광역시': 'incheon',
    '부산': 'busan', '부산광역시': 'busan',
    '대구': 'daegu', '대구광역시': 'daegu',
    '광주': 'gwangju', '광주광역시': 'gwangju',
    '대전': 'daejeon', '대전광역시': 'daejeon',
    '울산': 'ulsan', '울산광역시': 'ulsan',
    '세종': 'sejong', '세종특별자치시': 'sejong',
    '강원': 'gangwon', '강원도': 'gangwon', '강원특별자치도': 'gangwon',
    '충북': 'chungbuk', '충청북도': 'chungbuk',
    '충남': 'chungnam', '충청남도': 'chungnam',
    '전북': 'jeonbuk', '전라북도': 'jeonbuk', '전북특별자치도': 'jeonbuk',
    '전남': 'jeonnam', '전라남도': 'jeonnam',
    '경북': 'gyeongbuk', '경상북도': 'gyeongbuk',
    '경남': 'gyeongnam', '경상남도': 'gyeongnam',
    '제주': 'jeju', '제주도': 'jeju', '제주특별자치도': 'jeju'
};

function parseAddress(address: string) {
    if (!address) return null;
    const parts = address.trim().split(/\s+/);
    if (parts.length < 2) return null;

    const regionKor = parts[0];
    const district = parts[1];

    let regionId = REGION_MAP[regionKor] || null;
    if (!regionId) {
        // Try finding partially
        const found = Object.keys(REGION_MAP).find(k => regionKor.startsWith(k));
        if (found) regionId = REGION_MAP[found];
    }

    return {
        region_1depth: regionId, // mapped ID 'seoul', 'incheon'...
        region_1depth_name: regionKor,
        district: district
    };
}

async function verifyAddress(venueName: string, currentData: Venue) {
    // Priority 1: Parse existing address
    if (currentData.address) {
        const parsed = parseAddress(currentData.address);
        if (parsed && parsed.region_1depth) {
            console.log(`[Parsed] ${venueName}: ${parsed.region_1depth} -> ${parsed.district}`);
            return {
                ...currentData,
                district: parsed.district,
                // region_1depth_name: parsed.region_1depth_name, // Optional
                mapped_region_id: parsed.region_1depth
            };
        }
    }

    // Fallback: If no address, we can't do much without API.
    console.warn(`[Skip] Cannot parse address for ${venueName}: ${currentData.address}`);
    return currentData;
}

async function main() {
    const updatedVenues: Record<string, Venue> = {};
    const venues = venueData as Record<string, Venue>;

    // We only want to verify venues that actually exist in the file
    // For this task, let's process ALL of them to ensure consistency

    // Limit concurrency
    const entries = Object.entries(venues);
    // Process in batches
    for (let i = 0; i < entries.length; i += 5) {
        const batch = entries.slice(i, i + 5);
        await Promise.all(batch.map(async ([key, val]) => {
            const verified = await verifyAddress(key, val);
            // Map simplified logic for "valid districts"
            // Ensure District matches our expectation for Region matching

            updatedVenues[key] = verified;
        }));
        // moderate delay
        await new Promise(r => setTimeout(r, 200));
    }

    fs.writeFileSync(VENUES_PATH, JSON.stringify(updatedVenues, null, 4));
    console.log(`Updated ${Object.keys(updatedVenues).length} venues.`);
}

main();
