import fs from 'fs';
import path from 'path';

const KAKAO_API_KEY = process.env.KAKAO_REST_API_KEY || '';
const VENUES_PATH = path.join(__dirname, '../src/data/venues.json');
const REPORT_PATH = path.join(__dirname, '../venue_coordinate_mismatches.csv');

interface Venue {
    address: string;
    lat?: number;
    lng?: number;
}

// Distance calculation
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
    console.log('Starting venue coordinate audit...');
    const rawData = fs.readFileSync(VENUES_PATH, 'utf-8');
    const venues: Record<string, Venue> = JSON.parse(rawData);

    const mismatches: any[] = [];
    const entries = Object.entries(venues);
    console.log(`Total venues to check: ${entries.length}`);

    let processed = 0;

    for (const [name, data] of entries) {
        processed++;
        if (processed % 50 === 0) console.log(`Processed ${processed}/${entries.length}...`);

        if (!data.address || !data.lat || !data.lng) continue;

        // Exclude foreign or special locations which are not in Korea
        if (!data.address.match(/(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/)) {
            continue;
        }

        try {
            const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(data.address)}`;
            const res = await fetch(url, { headers: { 'Authorization': `KakaoAK ${KAKAO_API_KEY}` } });
            if (!res.ok) {
                console.error(`Kakao API Error for ${name}: ${res.status}`);
                continue;
            }
            const json = await res.json();

            if (json.documents && json.documents.length > 0) {
                const kakaoLat = parseFloat(json.documents[0].y);
                const kakaoLng = parseFloat(json.documents[0].x);

                const distance = getDistanceFromLatLonInKm(data.lat, data.lng, kakaoLat, kakaoLng);

                // If distance > 0.5 km (500 meters), log it
                if (distance > 0.5) {
                    mismatches.push({
                        name,
                        address: data.address,
                        storedLat: data.lat,
                        storedLng: data.lng,
                        kakaoLat,
                        kakaoLng,
                        diffKm: distance.toFixed(2)
                    });
                }
            } else {
                // Address not found by Kakao
                mismatches.push({
                    name,
                    address: data.address,
                    storedLat: data.lat,
                    storedLng: data.lng,
                    kakaoLat: 'NOT_FOUND',
                    kakaoLng: 'NOT_FOUND',
                    diffKm: 'N/A'
                });
            }

            // Wait 100ms to avoid rate limiting
            await sleep(50);
        } catch (error) {
            console.error(`Failed to geocode ${name}:`, error);
        }
    }

    // Sort by diff descending
    mismatches.sort((a, b) => {
        if (a.diffKm === 'N/A') return 1;
        if (b.diffKm === 'N/A') return -1;
        return parseFloat(b.diffKm) - parseFloat(a.diffKm);
    });

    console.log(`Found ${mismatches.length} mismatches.`);

    // Write CSV
    let csv = "Name,Address,Stored_Lat,Stored_Lng,Kakao_Lat,Kakao_Lng,Diff_Km\\n";
    for (const m of mismatches) {
        csv += `"${m.name}","${m.address}",${m.storedLat},${m.storedLng},${m.kakaoLat},${m.kakaoLng},${m.diffKm}\\n`;
    }

    fs.writeFileSync(REPORT_PATH, csv, 'utf8');
    console.log(`Report generated at ${REPORT_PATH}`);
}

main().catch(console.error);
