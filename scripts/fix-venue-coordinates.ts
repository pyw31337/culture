import fs from 'fs';
import path from 'path';

const VENUES_PATH = path.join(process.cwd(), 'src/data/venues.json');
const CSV_PATH = path.join(process.cwd(), 'venue_coordinate_mismatches.csv');

interface Venue {
    address: string;
    lat?: number;
    lng?: number;
}

async function main() {
    console.log('Starting venue coordinate fix (Lookup approach)...');

    if (!fs.existsSync(CSV_PATH)) {
        console.error('CSV file not found:', CSV_PATH);
        process.exit(1);
    }

    let csvContent = fs.readFileSync(CSV_PATH, 'utf-8');

    // Read current venues
    const venuesContent = fs.readFileSync(VENUES_PATH, 'utf-8');
    const venues: Record<string, Venue> = JSON.parse(venuesContent);

    let updatedCount = 0;

    const entries = Object.entries(venues);
    console.log(`Scanning ${entries.length} venues against CSV data...`);

    for (const [name, data] of entries) {
        if (!data.address || !data.lat || !data.lng) continue;

        // Exact string written by the audit script: "Name","Address",StoredLat,StoredLng,
        const searchString = `"${name}","${data.address}",${data.lat},${data.lng},`;
        const index = csvContent.indexOf(searchString);

        if (index !== -1) {
            const remaining = csvContent.substring(index + searchString.length);
            // Match the next 3 fields: Kakao_Lat,Kakao_Lng,Diff_Km
            // They don't contain commas and are followed by \n or end of file.
            const match = remaining.match(/^([^,]+),([^,]+),([^\n\r]+)/);
            if (match) {
                const kakaoLatStr = match[1];
                const kakaoLngStr = match[2];
                // diffKm is match[3]

                if (kakaoLatStr === 'NOT_FOUND' || kakaoLngStr === 'NOT_FOUND') {
                    continue;
                }

                const newLat = parseFloat(kakaoLatStr);
                const newLng = parseFloat(kakaoLngStr);

                if (!isNaN(newLat) && !isNaN(newLng)) {
                    venues[name].lat = newLat;
                    venues[name].lng = newLng;
                    updatedCount++;
                }
            }
        }
    }

    console.log(`Updated ${updatedCount} venues with new coordinates.`);

    fs.writeFileSync(VENUES_PATH, JSON.stringify(venues, null, 2), 'utf8');
    console.log(`Successfully wrote updated venues to ${VENUES_PATH}`);
}

main().catch(console.error);
