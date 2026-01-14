
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import cliProgress from 'cli-progress';

// Configuration
const VENUES_PATH = path.join(process.cwd(), 'src/data/venues.json');
const KAKAO_API_KEY = 'e18ee199818819d830c3fe479aa1ca71'; // Using REST API Key from fix-venues.ts

interface Venue {
    name: string;
    address: string;
    description?: string;
    lat?: number;
    lng?: number;
    district?: string;
    mapped_region_id?: string;
}

// Region Map for District Parsing
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

// Helper: Parse Address to get district
function parseAddress(address: string) {
    if (!address) return null;
    const parts = address.trim().split(/\s+/);
    if (parts.length < 2) return null;

    const regionKor = parts[0];
    const district = parts[1];

    let regionId = REGION_MAP[regionKor] || null;
    if (!regionId) {
        const found = Object.keys(REGION_MAP).find(k => regionKor.startsWith(k));
        if (found) regionId = REGION_MAP[found];
    }

    return {
        region_1depth: regionId,
        district: district
    };
}

// Kakao API Helpers
async function searchKeyword(query: string) {
    try {
        const res = await axios.get('https://dapi.kakao.com/v2/local/search/keyword.json', {
            headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` },
            params: { query, size: 1 }
        });
        return res.data.documents[0] || null;
    } catch (e: any) {
        if (query.includes('디큐브')) console.error('Error searching:', query, e.message, e.response?.data);
        return null;
    }
}

async function searchAddress(query: string) {
    try {
        const res = await axios.get('https://dapi.kakao.com/v2/local/search/address.json', {
            headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` },
            params: { query, size: 1 }
        });
        return res.data.documents[0] || null;
    } catch (e: any) {
        if (query.includes('디큐브')) console.error('Error searching:', query, e.message, e.response?.data);
        return null;
    }
}

// Refine address by removing last word iteratively
async function refinedAddressSearch(rawAddress: string) {
    let currentAddr = rawAddress.trim();

    // Try iteratively removing the last token until we match or run out of tokens (keep region + district min 2)
    while (currentAddr.split(/\s+/).length >= 2) {
        const result = await searchAddress(currentAddr);
        if (result) return result;

        // Strip last word
        const parts = currentAddr.split(/\s+/);
        parts.pop();
        currentAddr = parts.join(' ');

        // Safety break if empty
        if (!currentAddr) break;
    }
    return null;
}

async function main() {
    console.log('Loading venue data...');
    const venueData: Record<string, Venue> = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf-8'));
    const venues = Object.entries(venueData);

    // Filter targets: Missing address OR missing coords
    const targets = venues.filter(([_, v]) => !v.address || !v.lat || !v.lng);

    console.log(`Found ${targets.length} venues needing updates out of ${venues.length} total.`);

    if (targets.length === 0) {
        console.log('No updates needed.');
        return;
    }

    // Initialize Progress Bar
    const progressBar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    progressBar.start(targets.length, 0);

    let updatedCount = 0;

    // Process Concurrently (Batch size 5)
    const BATCH_SIZE = 5;
    for (let i = 0; i < targets.length; i += BATCH_SIZE) {
        const batch = targets.slice(i, i + BATCH_SIZE);

        await Promise.all(batch.map(async ([key, venue]) => {
            let result = null;
            let source = 'none';

            // Strategy 1: If we have an address but no coords, try Address Search (with refinement)
            if (venue.address && (!venue.lat || !venue.lng)) {
                result = await searchAddress(venue.address);
                if (result) source = 'address_exact';
                else {
                    result = await refinedAddressSearch(venue.address);
                    if (result) source = 'address_refined';
                }
            }

            // Strategy 2: If Name search needed (no address, or address search failed entirely)
            if (!result) {
                // Try searching by Name
                result = await searchKeyword(venue.name);
                if (result) source = 'keyword_name';

                // If name search failed, maybe try searching "name + address partial"?
                // Often keyword search is best for venue names.
            }

            // Update Logic
            if (result) {
                // Prefer road address, fallback to old address
                const newAddress = result.road_address_name || result.address_name || venue.address;
                const newLat = parseFloat(result.y);
                const newLng = parseFloat(result.x);

                // Parse district
                const parsed = parseAddress(newAddress);

                venueData[key] = {
                    ...venue,
                    address: newAddress,
                    lat: newLat,
                    lng: newLng,
                    district: parsed?.district || venue.district || '',
                    mapped_region_id: parsed?.region_1depth || venue.mapped_region_id
                };
                updatedCount++;
            }
        }));

        progressBar.increment(batch.length);
        // Rate limit delay
        await new Promise(r => setTimeout(r, 200));
    }

    progressBar.stop();

    // Save
    fs.writeFileSync(VENUES_PATH, JSON.stringify(venueData, null, 4));

    console.log('\n=============================================');
    console.log(`[완료] 총 ${targets.length}개 대상 중 ${updatedCount}개 공연장 정보 업데이트 완료.`);
    console.log('빈 주소 및 좌표 정보를 채우고, 검색되지 않는 주소는 키워드/상세주소를 정제하여 재수집했습니다.');
    console.log('=============================================');
}

main().catch(console.error);
