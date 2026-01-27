
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
        // CSV Headers: Name, Key, Region, District, Address, Latitude, Longitude
        const key = record.Key || record.Name;

        if (!key) continue;

        if (!venues[key]) {
            // New venue? For now, let's only update existing unless it's clearly a new valid one.
            // But if the key is in the report, it likely exists or existed.
            // If the user *renamed* it in the Name column but Key is preserved... 
            // The report generates Key column usually comparable to the JSON key.
            console.log(`[Warning] JSON missing key from CSV: ${key}. Skipping creation to avoid junk.`);
            continue;
        }

        const v = venues[key];
        let modified = false;

        // Update Fields
        if (record.Address && record.Address !== '정보 없음' && record.Address !== v.address) {
            v.address = record.Address;
            modified = true;
        }

        if (record.District && record.District !== v.district) {
            v.district = record.District;
            modified = true;
        }

        if (record.Region && record.Region !== v.region) {
            // Map common regions if CSV has friendly names
            v.region = record.Region;
            modified = true;
        }

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
            // console.log(`Updated ${key}`);
        }
    }

    fs.writeFileSync(VENUES_FILE, JSON.stringify(venues, null, 2));
    console.log(`Import complete. Updated ${updatedCount} venues.`);
}

run().catch(console.error);
