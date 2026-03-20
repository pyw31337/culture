
import * as fs from 'fs';
import * as path from 'path';

// Load venues
const venuesPath = path.resolve(__dirname, '../src/data/venues.json');
const venues = JSON.parse(fs.readFileSync(venuesPath, 'utf-8'));

// Suspicious Default: 2号 Euljiro 4-ga Station (Approx 37.567, 126.997) 
// or City Hall default.
// Let's look for extensive duplicates.

const COORD_COUNTS: Record<string, string[]> = {};

Object.entries(venues).forEach(([name, data]: [string, any]) => {
    if (!data.lat || !data.lng) return;
    const key = `${data.lat.toFixed(6)},${data.lng.toFixed(6)}`;

    if (!COORD_COUNTS[key]) COORD_COUNTS[key] = [];
    COORD_COUNTS[key].push(name);
});

console.log('--- SUSPICIOUS COORDINATE CLUSTERS (Count > 5) ---');
const badVenues: string[] = [];

Object.entries(COORD_COUNTS).forEach(([coord, names]) => {
    if (names.length > 5) {
        console.log(`\n[${coord}] Count: ${names.length}`);
        // Show first 5 examples
        console.log(`Examples: ${names.slice(0, 5).join(', ')}...`);
        badVenues.push(...names);
    }
});

fs.writeFileSync(path.resolve(__dirname, '../src/data/bad-venues.json'), JSON.stringify(badVenues, null, 2));
console.log(`\nSaved ${badVenues.length} suspicious venues to src/data/bad-venues.json`);

// Check specifically for "와일드벅스 곤충탐험대"
if (venues["와일드벅스 곤충탐험대"]) {
    console.log('\n--- TARGET CHECK: 와일드벅스 곤충탐험대 ---');
    console.log(venues["와일드벅스 곤충탐험대"]);
}
