
import fs from 'fs';
import path from 'path';

const INPUT_FILE = path.resolve(process.cwd(), 'src/data/venues.json');
const OUTPUT_FILE = path.resolve(process.cwd(), 'venues_export.csv');

function escapeCsv(value: any): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

async function exportVenues() {
    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`Input file not found: ${INPUT_FILE}`);
        process.exit(1);
    }

    const rawData = fs.readFileSync(INPUT_FILE, 'utf-8');
    const venuesMap = JSON.parse(rawData);
    const venues = Object.values(venuesMap);

    console.log(`Found ${venues.length} venues.`);

    const headers = ['name', 'address', 'district', 'lat', 'lng', 'mapped_region_id'];
    const csvRows = [headers.join(',')];

    for (const venue of venues as any[]) {
        const row = [
            escapeCsv(venue.name),
            escapeCsv(venue.address),
            escapeCsv(venue.district),
            escapeCsv(venue.lat),
            escapeCsv(venue.lng),
            escapeCsv(venue.mapped_region_id)
        ];
        csvRows.push(row.join(','));
    }

    fs.writeFileSync(OUTPUT_FILE, csvRows.join('\n'), 'utf-8');
    console.log(`Successfully exported ${venues.length} venues to ${OUTPUT_FILE}`);
}

exportVenues();
