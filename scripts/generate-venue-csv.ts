
import * as fs from 'fs';
import * as path from 'path';

const VENUE_PATH = path.resolve(process.cwd(), 'src/data/venues.json');
const OUTPUT_PATH = path.resolve(process.cwd(), 'venue_report.csv');

const venueData = JSON.parse(fs.readFileSync(VENUE_PATH, 'utf-8'));

interface Venue {
    key: string;
    name: string;
    address: string;
    district?: string;
    lat?: number;
    lng?: number;
    mapped_region_id?: string;
}

const venues: Venue[] = Object.entries(venueData).map(([key, value]: [string, any]) => ({
    key,
    ...value
}));

// Sort by Name (Hangul)
venues.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

let csvContent = '\uFEFF'; // BOM for Excel encoding support
csvContent += "Name,Key,Region,District,Address,Latitude,Longitude\n";

venues.forEach(v => {
    // Escape quotes for CSV
    const name = `"${v.name.replace(/"/g, '""')}"`;
    const key = `"${v.key.replace(/"/g, '""')}"`;
    const region = `"${v.mapped_region_id || ''}"`;
    const district = `"${v.district || ''}"`;
    const address = `"${(v.address || '').replace(/"/g, '""')}"`; // Raw address might still have junk, but user asked for KEY/NAME cleanup primarily?
    // Actually user complain about Address in Key, but Address column is Address column.

    // Check if address also needs some basic display cleaning? 
    // User said "how come address is Japan?" -> We removed those venues.

    csvContent += `${name},${key},${region},${district},${address},${v.lat || ''},${v.lng || ''}\n`;
});

fs.writeFileSync(OUTPUT_PATH, csvContent);
console.log(`CSV Report generated at: ${OUTPUT_PATH}`);
