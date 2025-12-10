import fs from 'fs';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';
import { fetchPerformances, Performance } from '../src/lib/interpark';

// Define Venue Data Structure
interface VenueData {
    name: string;
    address: string;
    lat?: number;
    lng?: number;
    district?: string;
}

const VENUE_FILE = path.join(process.cwd(), 'src/data/venues.json');

// Ensure data dir exists
if (!fs.existsSync(path.dirname(VENUE_FILE))) {
    fs.mkdirSync(path.dirname(VENUE_FILE), { recursive: true });
}

// Fallback coordinates for Districts (Seoul/Gyeonggi/Incheon)
const DISTRICT_COORDS: Record<string, { lat: number, lng: number }> = {
    '강남구': { lat: 37.5172, lng: 127.0473 },
    '강동구': { lat: 37.5301, lng: 127.1238 },
    '강북구': { lat: 37.6396, lng: 127.0257 },
    '강서구': { lat: 37.5509, lng: 126.8497 },
    '관악구': { lat: 37.4784, lng: 126.9516 },
    '광진구': { lat: 37.5385, lng: 127.0824 },
    '구로구': { lat: 37.4954, lng: 126.8874 },
    '금천구': { lat: 37.4565, lng: 126.8954 },
    '노원구': { lat: 37.6542, lng: 127.0568 },
    '도봉구': { lat: 37.6688, lng: 127.0471 },
    '동대문구': { lat: 37.5744, lng: 127.0400 },
    '동작구': { lat: 37.5124, lng: 126.9393 },
    '마포구': { lat: 37.5665, lng: 126.9018 },
    '서대문구': { lat: 37.5791, lng: 126.9368 },
    '서초구': { lat: 37.4837, lng: 127.0324 },
    '성동구': { lat: 37.5633, lng: 127.0371 },
    '성북구': { lat: 37.5891, lng: 127.0182 },
    '송파구': { lat: 37.5145, lng: 127.1066 },
    '양천구': { lat: 37.5169, lng: 126.8660 },
    '영등포구': { lat: 37.5264, lng: 126.8962 },
    '용산구': { lat: 37.5323, lng: 126.9906 },
    '은평구': { lat: 37.6027, lng: 126.9291 },
    '종로구': { lat: 37.5730, lng: 126.9794 },
    '중구': { lat: 37.5637, lng: 126.9975 },
    '중랑구': { lat: 37.6066, lng: 127.0924 },
    // A few Gyeonggi/Incheon
    '수원시': { lat: 37.2636, lng: 127.0286 },
    '성남시': { lat: 37.4386, lng: 127.1378 },
    '고양시': { lat: 37.6584, lng: 126.8320 },
    '용인시': { lat: 37.2410, lng: 127.1775 },
    '부천시': { lat: 37.5034, lng: 126.7660 },
    '안산시': { lat: 37.368, lng: 126.836 },
    '인천': { lat: 37.4563, lng: 126.7052 },
    '연수구': { lat: 37.4102, lng: 126.6782 },
    '남동구': { lat: 37.4473, lng: 126.7314 },
    '부평구': { lat: 37.5074, lng: 126.7217 }
};

async function getVenueAddress(performanceId: string): Promise<string> {
    const url = `https://ticket.interpark.com/TIKI/Main/TikiGoodsInfo.asp?GoodsCode=${performanceId}`;
    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const decoded = iconv.decode(response.data, 'euc-kr');
        const $ = cheerio.load(decoded);

        // Currently the address is often in a popup but also sometimes in the 'place' info.
        // Let's look for "장소 :" or similar in the text.
        // Or specific selector.
        // Based on analysis, clicking venue opens popup.
        // The popup URL is TPPlace_Detail.asp?PlaceCode=...
        // Finding PlaceCode is key.

        // Search for PlaceCode in the page logic or links
        // often found in scripts like: javascript:fnPlacePopup('12345')
        // or <a href="#" onclick="fnPlacePopup('...')">

        const html = $.html();
        const placeCodeMatch = html.match(/PlaceCode=(\w+)/) || html.match(/fnPlacePopup\('(\w+)'\)/);

        if (placeCodeMatch) {
            const placeCode = placeCodeMatch[1];
            return await fetchAddressFromPlacePopup(placeCode);
        }

        return '';
    } catch (e) {
        return '';
    }
}

async function fetchAddressFromPlacePopup(placeCode: string): Promise<string> {
    const url = `https://ticket.interpark.com/TPPlace/Main/TPPlace_Detail.asp?PlaceCode=${placeCode}`;
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const decoded = iconv.decode(response.data, 'euc-kr');
        const $ = cheerio.load(decoded);

        // Example: Address is often in .play_info or table
        // A common pattern in old ASP sites:
        // Look for "주소" text

        let address = '';
        $('td, li, div').each((i, el) => {
            const text = $(el).text();
            if (text.includes('주소') && text.includes('시') && text.includes('구')) {
                // naive extraction
                // e.g. "주 소 : 서울특별시 종로구 세종대로 175 (세종로)"
                const parts = text.split(':');
                if (parts.length > 1) {
                    address = parts[1].trim();
                    return false; // break
                }
            }
        });

        // Fallback: look for specific class if known
        // .loc_info ?

        return address;
    } catch (e) {
        return '';
    }
}

async function buildVenues() {
    let venues: Record<string, VenueData> = {};
    if (fs.existsSync(VENUE_FILE)) {
        venues = JSON.parse(fs.readFileSync(VENUE_FILE, 'utf-8'));
    }

    // 1. Fetch Lists
    console.log('Fetching performances...');
    const [seoul, gyeonggi, incheon] = await Promise.all([
        fetchPerformances('seoul'),
        fetchPerformances('gyeonggi'),
        fetchPerformances('incheon'),
    ]);
    const all = [...seoul, ...gyeonggi, ...incheon];

    console.log(`Total items: ${all.length}`);

    // 2. Identify Unique Venues
    const uniqueVenues = new Set(all.map(p => p.venue));
    console.log(`Unique venues: ${uniqueVenues.size}`);

    // 2.5 Heuristic: Extract District from Name (Fast pass)
    for (const venueName of uniqueVenues) {
        if (!venues[venueName]) {
            venues[venueName] = { name: venueName, address: '정보 없음', district: '' };
        }

        // If District is missing, try to find it in the Name
        if (!venues[venueName].district) {
            // Check keys in DISTRICT_COORDS
            for (const key of Object.keys(DISTRICT_COORDS)) {
                // If venue name includes "강남" -> assume "강남구"
                // But keys are "강남구", so we check if name includes "강남" or the full key
                const simpleKey = key.replace('구', '').replace('시', '');
                if (venueName.includes(key) || venueName.includes(simpleKey + '구') || venueName.includes(simpleKey + '문화') || venueName.includes(simpleKey + '아트')) {
                    // Be careful with false positives, but for now this is better than empty
                    // "강남" might be in "강남스타일" (rare venue name), but "강남구" is safer.
                    // Let's stick to full key or "Key + something"

                    if (venueName.includes(simpleKey)) {
                        // Check mapping. Key is the full name "강남구"
                        venues[venueName].district = key;

                        // Also set coords if missing
                        if (!venues[venueName].lat) {
                            venues[venueName].lat = DISTRICT_COORDS[key].lat;
                            venues[venueName].lng = DISTRICT_COORDS[key].lng;
                        }
                        break;
                    }
                }
            }
        }
    }
    console.log("Heuristic pass complete.");

    // 3. Process new venues and update with coordinates (Slow pass)
    let processedCount = 0;
    const MAX_PROCESS = 100;

    for (const venueName of uniqueVenues) {
        // Skip if we already have district AND lat/lng
        if (venues[venueName].district && venues[venueName].lat) continue;

        // Also skip if we have address?
        if (venues[venueName].address && venues[venueName].address !== '정보 없음') continue;

        if (processedCount >= MAX_PROCESS) break;

        // ... rest of loop
        const perf = all.find(p => p.venue === venueName);
        if (!perf) continue;

        console.log(`[${processedCount + 1}/${MAX_PROCESS}] Processing: ${venueName}`);

        let address = venues[venueName]?.address || '';
        let district = venues[venueName]?.district || '';
        let lat = venues[venueName]?.lat;
        let lng = venues[venueName]?.lng;

        // 3a. Fetch Address if missing
        if (!address || address === '정보 없음') {
            // ... existing logic ...
            address = await getVenueAddress(perf.id);
        }

        // ... continue logic ...

        if (address) {
            // Extract district (Gu)
            const guMatch = address.match(/(\S+구)/);
            if (guMatch) district = guMatch[1];

            // 3b. Geocode if missing lat/lng
            if (!lat || !lng) {
                try {
                    // Use Nominatim (OpenStreetMap)
                    // Must send User-Agent
                    const query = encodeURIComponent(address.split('(')[0].trim()); // Clean address
                    const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`;

                    const geoRes = await axios.get(geoUrl, {
                        headers: { 'User-Agent': 'InterparkAggregator/1.0 (me@example.com)' }
                    });

                    if (geoRes.data && geoRes.data.length > 0) {
                        lat = parseFloat(geoRes.data[0].lat);
                        lng = parseFloat(geoRes.data[0].lon);

                        // Use Geocoded address if original is missing
                        if (!address || address === '정보 없음') {
                            address = geoRes.data[0].display_name;
                            // Try to extract Gu from new address
                            const guMatch = address.match(/(\S+구)/);
                            if (guMatch) district = guMatch[1];
                        }
                        console.log(`   -> Geocoded: ${lat}, ${lng} (${district})`);
                    } else {
                        // Retry with just Venue Name if address failed
                        const queryName = encodeURIComponent(venueName);
                        const geoUrl2 = `https://nominatim.openstreetmap.org/search?format=json&q=${queryName}&limit=1`;
                        const geoRes2 = await axios.get(geoUrl2, {
                            headers: { 'User-Agent': 'InterparkAggregator/1.0 (me@example.com)' }
                        });
                        if (geoRes2.data && geoRes2.data.length > 0) {
                            lat = parseFloat(geoRes2.data[0].lat);
                            lng = parseFloat(geoRes2.data[0].lon);

                            // Use Geocoded address
                            if (!address || address === '정보 없음') {
                                address = geoRes2.data[0].display_name;
                                const guMatch = address.match(/(\S+구)/);
                                if (guMatch) district = guMatch[1];
                            }
                            console.log(`   -> Geocoded via Name: ${lat}, ${lng} (${district})`);
                        }
                    }
                } catch (e) {
                    // console.error('   -> Geocoding failed');
                }

                // Fallback to District Coords
                if ((!lat || !lng) && district) {
                    const fallback = DISTRICT_COORDS[district] || DISTRICT_COORDS[Object.keys(DISTRICT_COORDS).find(k => district.includes(k)) || ''];
                    if (fallback) {
                        lat = fallback.lat;
                        lng = fallback.lng;
                        // console.log(`   -> Used District Fallback: ${district}`);
                    }
                }

                // Respect Rate Limit (1s) if we tried geocoding
                await new Promise(r => setTimeout(r, 100)); // Faster if we fail fast, but let's keep it safe.
            }
        }

        venues[venueName] = {
            name: venueName,
            address: address || '정보 없음',
            district,
            lat,
            lng
        };
        processedCount++;
    }

    // 4. Save
    fs.writeFileSync(VENUE_FILE, JSON.stringify(venues, null, 2));
    console.log(`Saved ${Object.keys(venues).length} venues to ${VENUE_FILE}`);
}

buildVenues();
