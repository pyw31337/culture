
import fs from 'fs';
import path from 'path';

// Define paths manually since we can't reliably resolve aliases in standalone ESM ts-node easily without config
const DATA_DIR = path.resolve(process.cwd(), 'src/data');

// List of data files to audit
const DATA_FILES = [
    'interpark.json',
    'yes24.json',
    'timeticket.json',
    'festivals.json',
    'kovo.json',
    'kbl.json',
    'kbo.json',
    'handball.json',
    'movies.json',
    'travel.json',
    'myrealtrip-kids.json',
    'sssd-class.json',
    'umclass.json',
    'mochaclass.json',
    'ott.json',
    'mommom.json',
    'mommom-food.json',
    'mommom-products.json',
    'museum.json',
    'seoul-culture.json'
];

interface Venue {
    name: string;
    address: string;
    district?: string;
    lat?: number;
    lng?: number;
}

// Load Venue DB
const venuePath = path.join(DATA_DIR, 'venues.json');
const venueData: Record<string, Venue> = JSON.parse(fs.readFileSync(venuePath, 'utf-8'));

async function auditVenues() {
    console.log("Starting venue audit (Direct JSON Mode)...");

    // Aggregate venue usage
    const venueStats: Record<string, { count: number, genres: Set<string>, examples: string[] }> = {};
    let totalItems = 0;

    for (const filename of DATA_FILES) {
        try {
            const filePath = path.join(DATA_DIR, filename);
            if (!fs.existsSync(filePath)) {
                console.warn(`Warning: Data file not found: ${filename}`);
                continue;
            }

            const content = fs.readFileSync(filePath, 'utf-8');
            let data = JSON.parse(content);
            if (!Array.isArray(data)) {
                // Handle wrapped objects if any? Most are arrays.
                // KBL might be wrapped?
                if (data.matches) data = data.matches; // heuristic
                else if (data.data) data = data.data;
                else if (typeof data === 'object') data = Object.values(data);
                else continue;
            }

            // Normalize array
            const items = Array.isArray(data) ? data : [];

            items.forEach((p: any) => {
                let vName = p.venue || p.place; // Handle seoul-culture 'place'
                if (!vName) {
                    // Special case for OTT
                    if (filename === 'ott.json' || p.genre === 'ott') vName = 'OTT';
                    else return;
                }

                // Exclude OTT/Online
                if (vName === 'OTT' || vName === 'Online') return;

                totalItems++;

                if (!venueStats[vName]) {
                    venueStats[vName] = { count: 0, genres: new Set(), examples: [] };
                }
                venueStats[vName].count++;
                if (p.genre) venueStats[vName].genres.add(p.genre);

                const title = p.title || p.svcnm; // seoul-culture 'svcnm'
                if (title && venueStats[vName].examples.length < 3) {
                    venueStats[vName].examples.push(title);
                }
            });

        } catch (e) {
            console.error(`Error processing ${filename}:`, e);
        }
    }

    console.log(`Analyzed ${totalItems} items across files.`);

    // 3. Compare with known venues
    const reportRows: string[] = [];
    // Header (Added BOM for Excel utf-8)
    reportRows.push('\uFEFF' + ['Venue Name', 'Status', 'Address', 'Latitude', 'Longitude', 'Usage Count', 'Genres', 'Examples'].join(','));

    // Sort by usage count descending
    const sortedVenues = Object.keys(venueStats).sort((a, b) => venueStats[b].count - venueStats[a].count);

    let missingCount = 0;
    let incompleteCount = 0;
    let okCount = 0;

    for (const vName of sortedVenues) {
        const stats = venueStats[vName];
        const known: Venue | undefined = venueData[vName];

        let status = 'OK';
        let address = '';
        let lat = '';
        let lng = '';

        if (!known) {
            status = 'MISSING_ENTRY'; // Not in venues.json
            missingCount++;
        } else {
            address = known.address || '';
            lat = known.lat ? String(known.lat) : '';
            lng = known.lng ? String(known.lng) : '';

            // Check completeness
            const isAddressMissing = !known.address || known.address === '정보 없음';
            const isCoordMissing = !known.lat || !known.lng;

            if (isAddressMissing || isCoordMissing) {
                status = 'INCOMPLETE_DATA';
                if (isAddressMissing && isCoordMissing) status += ' (Both)';
                else if (isAddressMissing) status += ' (Address)';
                else status += ' (Coords)';

                incompleteCount++;
            } else {
                okCount++;
            }
        }

        // CSV Escape
        const escape = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;

        const row = [
            escape(vName),
            status,
            escape(address),
            lat,
            lng,
            stats.count,
            escape(Array.from(stats.genres).join('|')),
            escape(stats.examples.join('; '))
        ].join(',');

        reportRows.push(row);
    }

    // 4. Write CSV
    const outputPath = path.resolve(process.cwd(), 'venue_audit.csv');
    fs.writeFileSync(outputPath, reportRows.join('\n'), 'utf-8');

    console.log(`Audit complete.`);
    console.log(`Total Unique Venues Used: ${sortedVenues.length}`);
    console.log(`- OK: ${okCount}`);
    console.log(`- Missing Entry (New): ${missingCount}`);
    console.log(`- Incomplete Data: ${incompleteCount}`);
    console.log(`Report saved to: ${outputPath}`);
}

auditVenues().catch(console.error);
