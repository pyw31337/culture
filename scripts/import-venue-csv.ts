
import fs from 'fs';
import path from 'path';
// @ts-ignore
import { parse } from 'csv-parse/sync';

const VENUES_FILE = path.resolve(process.cwd(), 'src/data/venues.json');
const CSV_FILE = path.resolve(process.cwd(), 'venue_report.csv');

async function run() {
    console.log('Starting venue import from CSV...');

    if (!fs.existsSync(CSV_FILE)) {
        console.error('CSV File not found:', CSV_FILE);
        return;
    }

    const fileContent = fs.readFileSync(CSV_FILE, 'utf-8');
    // Remove BOM if present
    const cleanContent = fileContent.replace(/^\uFEFF/, '');

    const records = parse(cleanContent, {
        columns: true,
        skip_empty_lines: true,
        relax_quotes: true,
    }) as any[];

    const venues = JSON.parse(fs.readFileSync(VENUES_FILE, 'utf-8'));
    let updatedCount = 0;

    for (const record of records) {
        // CSV Headers: Name, Key, Region, District, Address, Latitude, Longitude, region_id
        // The user wants 'Name' from CSV to be the authority.
        const key = record.Key || record.Name;
        if (!key) continue;

        // If venue doesn't exist, create it or log? User said "apply my CSV".
        // Let's assume we initialize it if missing.
        if (!venues[key]) {
            venues[key] = {
                name: record.Name || key,
                address: record.Address || '정보 없음',
                district: record.District || '',
                lat: parseFloat(record.Latitude) || 0,
                lng: parseFloat(record.Longitude) || 0,
                mapped_region_id: record.mapped_region_id || record.Region || 'etc'
            };
            updatedCount++;
            continue;
        }

        const v = venues[key];
        let modified = false;

        // Name Enforcement
        if (record.Name && record.Name !== v.name) {
            v.name = record.Name;
            modified = true;
        }

        // Address
        if (record.Address && record.Address !== v.address) {
            v.address = record.Address;
            modified = true;
        }

        // District
        if (record.District && record.District !== v.district) {
            v.district = record.District;
            modified = true;
        }

        // Region ID (mapped_region_id is the system field)
        const regionId = record.mapped_region_id || record.Region;
        if (regionId && regionId !== v.mapped_region_id) {
            v.mapped_region_id = regionId;
            modified = true;
        }

        // Coords
        const lat = parseFloat(record.Latitude);
        const lng = parseFloat(record.Longitude);

        if (!isNaN(lat) && lat !== 0 && v.lat !== lat) {
            v.lat = lat;
            modified = true;
        }
        if (!isNaN(lng) && lng !== 0 && v.lng !== lng) {
            v.lng = lng;
            modified = true;
        }

        if (modified) {
            updatedCount++;
        }
    }

    fs.writeFileSync(VENUES_FILE, JSON.stringify(venues, null, 2));
    console.log(`Import complete. Updated ${updatedCount} venues.`);
}

run().catch(console.error);
