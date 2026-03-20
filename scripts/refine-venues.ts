
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

const CSV_PATH = '/Users/pyw31337/Desktop/작업/venue_export.csv';
const VENUES_JSON_PATH = path.resolve(process.cwd(), 'src/data/venues.json');
const DICT_OUTPUT_PATH = path.resolve(process.cwd(), 'src/data/venue-dictionary.json');
const MISSING_LOG_PATH = path.resolve(process.cwd(), 'src/data/venue-missing-geo.csv');

// Regex patterns discovered
const REGIONS = ['서울', '경기', '충남', '충북', '경남', '경북', '전남', '전북', '제주', '강원', '인천', '대구', '대전', '광주', '부산', '울산', '세종'];
const SUFFIXES = ['대공연장', '대극장', '소공연장', '콘서트홀', '대강당', '소강당', '전시실', '전시관', '체육관', '운동장', '아트센터', '문화회관', '예술회관', '구민회관', '시민회관', '안내데스크 앞', '로비', '2층', '3층', '4층', '5층', 'B1', '지하'];
// Not all suffixes should be blindly removed (e.g. "예술의전당" ends in "전당" but we shouldn't strip it if it's the whole name).
// The user pattern showed stripping specific hall names to get the base venue.

interface VenueRow {
    name: string;
    key: string;
    mapped_region_id: string;
    district: string;
    address: string;
    lat: string;
    lng: string;
}

interface VenueData {
    name: string; // The "Dirty" name (key in venues.json)
    refined_name: string; // The "Clean" name (key column)
    address: string;
    district: string;
    mapped_region_id: string;
    lat: number | null;
    lng: number | null;
}

function processVenues() {
    console.log('Loading data...');
    const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const csvRecords: VenueRow[] = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
    });

    let existingVenues: Record<string, any> = {};
    if (fs.existsSync(VENUES_JSON_PATH)) {
        existingVenues = JSON.parse(fs.readFileSync(VENUES_JSON_PATH, 'utf-8'));
    }

    const dictionary: Record<string, VenueData> = {};
    const missingGeo: VenueRow[] = [];

    console.log(`Processing ${csvRecords.length} records...`);

    for (const row of csvRecords) {
        const dirtyName = row.name;
        const refinedName = row.key || row.name; // Fallback to name if key is empty
        let address = row.address;
        let district = row.district;
        let region = row.mapped_region_id;
        let lat = parseFloat(row.lat);
        let lng = parseFloat(row.lng);

        // 1. Fill from existing venues.json if missing in CSV
        if (existingVenues[dirtyName]) {
            const v = existingVenues[dirtyName];
            if (!address) address = v.address || '';
            if (!district) district = v.district || '';
            if (!region) region = v.mapped_region_id || '';
            if (isNaN(lat) && v.lat) lat = parseFloat(v.lat);
            if (isNaN(lng) && v.lng) lng = parseFloat(v.lng);
        }

        // 2. Derive region/district from address if still missing
        if (address && (!district || !region)) {
            const parts = address.split(' ');
            if (parts.length > 1) {
                // Very basic heuristic, can optionally improve with korean_address_hierarchy.json
                const r = parts[0];
                const d = parts[1];
                if (!region && REGIONS.some(reg => r.startsWith(reg))) {
                    // Map basic korean regions to IDs (simplified)
                    if (r.startsWith('서울')) region = 'seoul';
                    else if (r.startsWith('경기')) region = 'gyeonggi';
                    else if (r.startsWith('인천')) region = 'incheon';
                    else if (r.startsWith('부산')) region = 'busan';
                    else if (r.startsWith('대구')) region = 'daegu';
                    else if (r.startsWith('광주')) region = 'gwangju';
                    else if (r.startsWith('대전')) region = 'daejeon';
                    else if (r.startsWith('울산')) region = 'ulsan';
                    else if (r.startsWith('세종')) region = 'sejong';
                    else if (r.startsWith('강원')) region = 'gangwon';
                    else if (r.startsWith('충남')) region = 'chungnam';
                    else if (r.startsWith('충북')) region = 'chungbuk';
                    else if (r.startsWith('전남')) region = 'jeonnam';
                    else if (r.startsWith('전북')) region = 'jeonbuk';
                    else if (r.startsWith('경남')) region = 'gyeongnam';
                    else if (r.startsWith('경북')) region = 'gyeongbuk';
                    else if (r.startsWith('제주')) region = 'jeju';
                }
                if (!district && d.endsWith('구') || d.endsWith('시') || d.endsWith('군')) {
                    district = d;
                }
            }
        }

        // 3. Store valid data
        dictionary[dirtyName] = {
            name: dirtyName,
            refined_name: refinedName,
            address: address,
            district: district,
            mapped_region_id: region,
            lat: isNaN(lat) ? null : lat,
            lng: isNaN(lng) ? null : lng,
        };

        if (isNaN(lat) || isNaN(lng)) {
            missingGeo.push({ ...row, address, district, mapped_region_id: region });
        }
    }

    // Save Dictionary
    fs.writeFileSync(DICT_OUTPUT_PATH, JSON.stringify(dictionary, null, 2), 'utf-8');
    console.log(`Saved dictionary to ${DICT_OUTPUT_PATH}`);

    // Log missing geo for user review (or future automated fill)
    if (missingGeo.length > 0) {
        const csvOutput = stringify(missingGeo, { header: true });
        fs.writeFileSync(MISSING_LOG_PATH, csvOutput, 'utf-8');
        console.log(`Saved ${missingGeo.length} records with missing lat/lng to ${MISSING_LOG_PATH}`);
    }
}

processVenues();
