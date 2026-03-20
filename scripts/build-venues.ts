import fs from 'fs';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';
import { fetchPerformances, type Performance } from '../src/lib/interpark.js';
import { normalizeVenueName } from './utils/data-cleaner';

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
// Valid Administrative Divisions
const SEOUL_DISTRICTS = [
    '강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구', '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구', '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구'
];

const INCHEON_DISTRICTS = [
    '계양구', '남동구', '동구', '미추홀구', '부평구', '서구', '연수구', '중구', '강화군', '옹진군'
];

const GYEONGGI_CITIES = [
    '가평군', '고양시', '과천시', '광명시', '광주시', '구리시', '군포시', '김포시', '남양주시', '동두천시', '부천시', '성남시', '수원시', '시흥시', '안산시', '안성시', '안양시', '양주시', '양평군', '여주시', '연천군', '오산시', '용인시', '의왕시', '의정부시', '이천시', '파주시', '평택시', '포천시', '하남시', '화성시'
];

// Combine for lookup
const ALL_VALID_DISTRICTS = [...SEOUL_DISTRICTS, ...INCHEON_DISTRICTS, ...GYEONGGI_CITIES];

// Fallback coordinates for key districts (representative point)
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
    // Gyeonggi/Incheon Representatives
    '수원시': { lat: 37.2636, lng: 127.0286 },
    '성남시': { lat: 37.4386, lng: 127.1378 },
    '고양시': { lat: 37.6584, lng: 126.8320 },
    '용인시': { lat: 37.2410, lng: 127.1775 },
    '부천시': { lat: 37.5034, lng: 126.7660 },
    '안산시': { lat: 37.368, lng: 126.836 },
    '인천': { lat: 37.4563, lng: 126.7052 }, // Generic Incheon
    '연수구': { lat: 37.4102, lng: 126.6782 },
    '남동구': { lat: 37.4473, lng: 126.7314 },
    '부평구': { lat: 37.5074, lng: 126.7217 }
};

function parseDistrict(address: string): string {
    if (!address || address === '정보 없음') return '';

    // Normalize address
    const normalized = address.replace(/\s+/g, ' ');

    // 1. Check Gyeonggi Cities first (since they end in Si/Gun)
    for (const city of GYEONGGI_CITIES) {
        if (normalized.includes(city)) return city;
    }

    // 2. Check Seoul/Incheon Districts (Gu/Gun)
    // Note: 'Jung-gu' exists in both, but we can't distinguish purely by 'Jung-gu' without context.
    // However, for valid list generation, returning 'Jung-gu' is fine.
    // We prioritize based on order or context if needed, but simple inclusion is better than strict regex.
    for (const dist of SEOUL_DISTRICTS) {
        if (normalized.includes(dist)) return dist;
    }
    for (const dist of INCHEON_DISTRICTS) {
        if (normalized.includes(dist)) return dist;
    }

    return '';
}

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

        // Sanitize loaded venues: Correct invalid districts
        // Sanitize: Clear potentially invalid districts
        for (const key of Object.keys(venues)) {
            if (venues[key].district && !ALL_VALID_DISTRICTS.includes(venues[key].district)) {
                // console.log(`Clearing invalid district "${venues[key].district}" from venue "${key}"`);
                venues[key].district = '';
            }
        }
    }

    // Read Interpark Data (from local file, respects clean-data.ts cleaning)
    let interparkItems: any[] = [];
    const INTERPARK_FILE = path.join(process.cwd(), 'src/data/interpark.json');
    if (fs.existsSync(INTERPARK_FILE)) {
        try {
            interparkItems = JSON.parse(fs.readFileSync(INTERPARK_FILE, 'utf-8'));
            console.log(`Loaded ${interparkItems.length} Interpark items.`);
        } catch (e) {
            console.error('Failed to load Interpark data', e);
        }
    } else {
        // Fallback: Fetch live (not ideal, may contain dirty data)
        console.log('Interpark JSON not found, fetching live data...');
        const { fetchPerformances } = await import('../src/lib/interpark');
        const [seoul, gyeonggi, incheon] = await Promise.all([
            fetchPerformances('seoul'),
            fetchPerformances('gyeonggi'),
            fetchPerformances('incheon'),
        ]);
        interparkItems = [...seoul, ...gyeonggi, ...incheon];
        console.log(`Fetched ${interparkItems.length} Interpark items (live).`);
    }

    // Read TimeTicket Data
    let timeticketItems: any[] = [];
    const TIMETICKET_FILE = path.join(process.cwd(), 'src/data/timeticket.json');
    if (fs.existsSync(TIMETICKET_FILE)) {
        try {
            timeticketItems = JSON.parse(fs.readFileSync(TIMETICKET_FILE, 'utf-8'));
            console.log(`Loaded ${timeticketItems.length} TimeTicket items.`);
        } catch (e) {
            console.error('Failed to load TimeTicket data', e);
        }
    }

    // Read MyRealTrip Data
    let myrealtripItems: any[] = [];
    const MYREALTRIP_FILE = path.join(process.cwd(), 'src/data/myrealtrip-kids.json');
    if (fs.existsSync(MYREALTRIP_FILE)) {
        try {
            myrealtripItems = JSON.parse(fs.readFileSync(MYREALTRIP_FILE, 'utf-8'));
            console.log(`Loaded ${myrealtripItems.length} MyRealTrip items.`);
        } catch (e) {
            console.error('Failed to load MyRealTrip data', e);
        }
    }

    // Read Klook Data
    let klookItems: any[] = [];
    const KLOOK_FILE = path.join(process.cwd(), 'src/data/klook-class.json');
    if (fs.existsSync(KLOOK_FILE)) {
        try {
            klookItems = JSON.parse(fs.readFileSync(KLOOK_FILE, 'utf-8'));
            console.log(`Loaded ${klookItems.length} Klook items.`);
        } catch (e) {
            console.error('Failed to load Klook data', e);
        }
    }

    // Read UmClass Data
    let umclassItems: any[] = [];
    const UMCLASS_FILE = path.join(process.cwd(), 'src/data/umclass.json');
    if (fs.existsSync(UMCLASS_FILE)) {
        try {
            umclassItems = JSON.parse(fs.readFileSync(UMCLASS_FILE, 'utf-8'));
            console.log(`Loaded ${umclassItems.length} UmClass items.`);
        } catch (e) {
            console.error('Failed to load UmClass data', e);
        }
    }

    // Read MochaClass Data
    let mochaclassItems: any[] = [];
    const MOCHACLASS_FILE = path.join(process.cwd(), 'src/data/mochaclass.json');
    if (fs.existsSync(MOCHACLASS_FILE)) {
        try {
            mochaclassItems = JSON.parse(fs.readFileSync(MOCHACLASS_FILE, 'utf-8'));
            console.log(`Loaded ${mochaclassItems.length} MochaClass items.`);
        } catch (e) {
            console.error('Failed to load MochaClass data', e);
        }
    }

    // Read SSSD Class Data
    let sssdItems: any[] = [];
    const SSSD_FILE = path.join(process.cwd(), 'src/data/sssd-class.json');
    if (fs.existsSync(SSSD_FILE)) {
        try {
            sssdItems = JSON.parse(fs.readFileSync(SSSD_FILE, 'utf-8'));
            console.log(`Loaded ${sssdItems.length} SSSD items.`);
        } catch (e) {
            console.error('Failed to load SSSD data', e);
        }
    }

    // Read Mommom Data
    let mommomItems: any[] = [];
    for (const file of ['mommom.json', 'mommom-products.json']) {
        const filePath = path.join(process.cwd(), 'src/data', file);
        if (fs.existsSync(filePath)) {
            try {
                const items = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                mommomItems = [...mommomItems, ...items];
                console.log(`Loaded ${items.length} items from ${file}.`);
            } catch (e) {
                console.error(`Failed to load ${file}`, e);
            }
        }
    }

    // Read Museum Data
    let museumItems: any[] = [];
    const MUSEUM_FILE = path.join(process.cwd(), 'src/data/museum.json');
    if (fs.existsSync(MUSEUM_FILE)) {
        try {
            museumItems = JSON.parse(fs.readFileSync(MUSEUM_FILE, 'utf-8'));
            // Missing venues in museum are usually the museum themselves
            museumItems.forEach(m => {
                if (!m.venue) m.venue = m.title;
            });
            console.log(`Loaded ${museumItems.length} Museum items.`);
        } catch (e) {
            console.error('Failed to load Museum data', e);
        }
    }

    const all = [...interparkItems, ...timeticketItems, ...myrealtripItems, ...klookItems, ...umclassItems, ...mochaclassItems, ...sssdItems, ...mommomItems, ...museumItems];

    console.log(`Total items: ${all.length}`);

    // 2. Identify Unique Venues
    const uniqueVenues = new Set(all.map(p => normalizeVenueName(p.venue)));
    console.log(`Unique venues: ${uniqueVenues.size}`);

    // 2.5 Heuristic: Extract District from Name (Fast pass)
    for (const venueName of uniqueVenues) {
        if (!venues[venueName]) {
            venues[venueName] = { name: venueName, address: '정보 없음', district: '' };
        }

        // If District is missing, try to find it in the Name
        if (!venues[venueName].district) {
            // Dictionary-based check
            const extracted = parseDistrict(venues[venueName].name);
            if (extracted) {
                venues[venueName].district = extracted;
                // Set coords if missing and available
                if (!venues[venueName].lat && DISTRICT_COORDS[extracted]) {
                    venues[venueName].lat = DISTRICT_COORDS[extracted].lat;
                    venues[venueName].lng = DISTRICT_COORDS[extracted].lng;
                }
            }
        }
    }
    console.log("Heuristic pass complete.");

    // 3. Process new venues and update with coordinates (Slow pass)
    let processedCount = 0;
    const MAX_PROCESS = 2000;

    // Sort to prioritize '트릭아이' for immediate check
    const sortedVenues = Array.from(uniqueVenues).sort((a, b) => {
        if (a.includes('트릭아이') && !b.includes('트릭아이')) return -1;
        if (b.includes('트릭아이') && !a.includes('트릭아이')) return 1;
        return 0;
    });

    for (const venueName of sortedVenues) {
        // Skip if we already have district AND lat/lng
        if (venues[venueName]?.district && venues[venueName]?.lat) continue;

        // Also skip if we have address?
        if (venues[venueName]?.address && venues[venueName]?.address !== '정보 없음') continue;

        if (processedCount >= MAX_PROCESS) break;

        // Ensure entry exists
        if (!venues[venueName]) {
            venues[venueName] = { name: venueName, address: '정보 없음', district: '' };

            // Smart Inheritance: Check if this new venue name contains a known venue name
            // e.g. "Seoul Arts Center Opera House" contains "Seoul Arts Center"
            // This prevents data loss when scrapers output slightly different names
            const knownVenues = Object.keys(venues).sort((a, b) => b.length - a.length);
            for (const existingKey of knownVenues) {
                if (existingKey.length < 2) continue; // Skip short keys
                // Verify inclusion AND that the existing key has valid data
                // EXCEPTION: Do not inherit for MochaClass / generic chains if they are distinct
                if ((venueName.includes('모카클래스') && existingKey === '모카클래스')) continue;

                if (venueName.includes(existingKey) && venues[existingKey].address && venues[existingKey].address !== '정보 없음') {
                    console.log(`   -> Inheriting data from parent venue: "${existingKey}" for "${venueName}"`);
                    venues[venueName].address = venues[existingKey].address;
                    venues[venueName].district = venues[existingKey].district;
                    venues[venueName].lat = venues[existingKey].lat;
                    venues[venueName].lng = venues[existingKey].lng;
                    break;
                }
            }
        }

        // ... rest of loop
        const perf = all.find(p => normalizeVenueName(p.venue) === venueName);
        if (!perf) continue;

        console.log(`[${processedCount + 1}/${MAX_PROCESS}] Processing: ${venueName}`);

        let address = venues[venueName]?.address || '';
        let district = venues[venueName]?.district || '';
        let lat = venues[venueName]?.lat;
        let lng = venues[venueName]?.lng;

        // 3.0 Always extract native coordinates if this is a mommom item
        if ((perf as any).platform === 'mommom' || (perf as any).source === 'mommom') {
            if ((perf as any).latitude && (perf as any).longitude) {
                lat = (perf as any).latitude;
                lng = (perf as any).longitude;
            }
        }

        // 3a. Fetch Address if missing
        if (!address || address === '정보 없음') {
            // Check explicitly for source/platform instead of just checking the address field
            if ((perf as any).platform === 'mommom' || (perf as any).source === 'mommom') {
                if (perf.address) address = perf.address;
                if ((perf as any).latitude && (perf as any).longitude) {
                    lat = (perf as any).latitude;
                    lng = (perf as any).longitude;
                    console.log(`   -> Using Mommom Coords: ${lat}, ${lng}`);
                }
            } else if ((perf as any).address) {
                // @ts-ignore
                address = perf.address;
                console.log(`   -> Using Provided Address: ${address}`);
            } else if ((perf as any).source === 'myrealtrip') {
                // MyRealTrip venues are often "Name (Address)" or just "Address" in venue field
                // Use venue as address
                address = perf.venue;
                console.log(`   -> Using MyRealTrip Venue as Address: ${address}`);
            } else if ((perf as any).source === 'klook') {
                address = perf.venue;
                console.log(`   -> Using Klook Venue as Address: ${address}`);
            } else if ((perf as any).source === 'mochaclass') {
                address = perf.venue; // Mochaclass name often has enough info? No, mochaclass item has address.
                // @ts-ignore
                if (perf.address) address = perf.address;
            } else {
                address = await getVenueAddress(perf.id);
            }
        }

        if (address) {
            // Extract district (Gu/Si/Gun) using robust parser
            district = parseDistrict(address);

            // 3b. Geocode if missing lat/lng
            if (!lat || !lng) {
                /*
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
                     console.error('   -> Geocoding failed', e);
                }
                */

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
                // await new Promise(r => setTimeout(r, 1000));
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

        // Incremental Save
        if (processedCount % 20 === 0) {
            fs.writeFileSync(VENUE_FILE, JSON.stringify(venues, null, 2));
            console.log(`[Autosave] Saved up to ${processedCount} items.`);
        }
    }

    // 3.5 Prune Orphaned Venues
    // DISABLED to prevent data loss of manual inputs.
    // If we prune, we lose venues that were manually corrected but might be temporarily missing from the scrape.
    /*
    let prunedCount = 0;
    for (const key of Object.keys(venues)) {
        if (!uniqueVenues.has(key)) {
            // console.log(`Pruning orphaned venue: ${key}`);
            delete venues[key];
            prunedCount++;
        }
    }
    if (prunedCount > 0) {
        console.log(`Pruned ${prunedCount} orphaned venues.`);
    }
    */

    // 4. Save Final
    fs.writeFileSync(VENUE_FILE, JSON.stringify(venues, null, 2));
    console.log(`Saved ${Object.keys(venues).length} venues to ${VENUE_FILE}`);
}

buildVenues();
