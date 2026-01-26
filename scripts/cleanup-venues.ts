
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const DATA_DIR = path.resolve(process.cwd(), 'src/data');
const VENUES_PATH = path.join(DATA_DIR, 'venues.json');

// Keywords to filter out
const INVALID_KEYWORDS = [
    '베트남', 'Vietnam',
    '싱가포르', 'Singapore',
    '미국', 'USA', 'United States',
    '일본', 'Japan', 'Tokyo', 'Osaka',
    '관람가', // "12세 관람가" etc.
    '관람불가',
    '예매',
    '취소'
];

// Valid Korea Coordinate Bounds (Roughly)
const LAT_MIN = 33.0; // Jeju is ~33.1
const LAT_MAX = 39.0; // DMZ is ~38.x
const LNG_MIN = 124.0;
const LNG_MAX = 132.0; // Liancourt Rocks ~131.8

function isForeignOrInvalid(venue: any): boolean {
    const addr = (venue.address || '').toLowerCase();
    const name = (venue.name || '').toLowerCase();

    // Check Keywords
    for (const kw of INVALID_KEYWORDS) {
        const lowerKw = kw.toLowerCase();
        if (addr.includes(lowerKw) || name.includes(lowerKw)) {
            return true;
        }
    }

    // Check Coordinates if they exist and are not 0,0 (0,0 might be just missing, not necessarily foreign, but let's check outliers)
    if (venue.lat && venue.lng) {
        if (venue.lat < LAT_MIN || venue.lat > LAT_MAX || venue.lng < LNG_MIN || venue.lng > LNG_MAX) {
            // Keep 0,0 for now as "unknown"? Or remove? 
            // If it's exactly 0,0 it's likely unmapped.
            // If it's roughly valid, keep.
            // If it's clearly foreign (e.g. Lat 10, Lng 106 for Vietnam), remove.

            // Allow strict 0,0 (unmapped) just in case, unless we want to purge unmapped?
            // User asked to remove foreign.
            if (venue.lat !== 0 || venue.lng !== 0) {
                return true;
            }
        }
    }

    return false;
}

async function run() {
    console.log('Starting Venue Cleanup...');

    const venues = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf-8'));
    const initialCount = Object.keys(venues).length;

    const validVenues: Record<string, any> = {};
    const invalidVenueNames: Set<string> = new Set();

    Object.entries(venues).forEach(([key, val]: [string, any]) => {
        if (isForeignOrInvalid(val)) {
            console.log(`[REMOVE] ${key} (Addr: ${val.address}, Lat: ${val.lat}, Lng: ${val.lng})`);
            invalidVenueNames.add(key);
        } else {
            validVenues[key] = val;
        }
    });

    const removedCount = invalidVenueNames.size;
    console.log(`Removed ${removedCount} venues. Remaining: ${Object.keys(validVenues).length}`);

    // Save Venues
    if (removedCount > 0) {
        fs.writeFileSync(VENUES_PATH, JSON.stringify(validVenues, null, 2));
    }

    // Cleaning Data Files
    if (removedCount > 0) {
        const files = glob.sync(path.join(DATA_DIR, '*.json'));

        for (const file of files) {
            if (file === VENUES_PATH) continue;

            try {
                const content = JSON.parse(fs.readFileSync(file, 'utf-8'));
                if (!Array.isArray(content)) continue;

                const before = content.length;
                const filtered = content.filter((item: any) => {
                    const vName = item.venue;
                    // If venue was removed, filter out this item
                    if (invalidVenueNames.has(vName)) return false;
                    return true;
                });

                const after = filtered.length;
                if (before !== after) {
                    console.log(`Update ${path.basename(file)}: ${before} -> ${after}`);
                    fs.writeFileSync(file, JSON.stringify(filtered, null, 2));
                }
            } catch (e) {
                // Ignore non-array jsons
            }
        }
    }

    console.log('Cleanup Complete.');
}

run();
