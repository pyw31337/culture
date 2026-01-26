
import * as fs from 'fs';
import * as path from 'path';

const venuePath = path.resolve(process.cwd(), 'src/data/venues.json');
const venueData = JSON.parse(fs.readFileSync(venuePath, 'utf-8'));

interface VenueData {
    name: string;
    address?: string;
    district?: string;
    lat?: number;
    lng?: number;
    mapped_region_id?: string;
}

const missingAddress: string[] = [];
const missingCoords: string[] = [];
const missingBoth: string[] = [];

Object.entries(venueData).forEach(([key, value]) => {
    const v = value as VenueData;
    const hasAddr = v.address && v.address.length > 5;
    const hasCoords = v.lat && v.lng && v.lat !== 0 && v.lng !== 0;

    if (!hasAddr && !hasCoords) {
        missingBoth.push(key);
    } else if (!hasAddr) {
        missingAddress.push(key);
    } else if (!hasCoords) {
        missingCoords.push(key);
    }
});

console.log(`Total Venues: ${Object.keys(venueData).length}`);
console.log(`Missing Both: ${missingBoth.length}`);
console.log(`Missing Address Only: ${missingAddress.length}`);
console.log(`Missing Coordinates Only: ${missingCoords.length}`);

if (missingBoth.length > 0) {
    console.log('\n[Sample Missing Both]');
    console.log(missingBoth.slice(0, 10).join('\n'));
}
if (missingAddress.length > 0) {
    console.log('\n[Sample Missing Address]');
    console.log(missingAddress.slice(0, 10).join('\n'));
}
if (missingCoords.length > 0) {
    console.log('\n[Sample Missing Coordinates]');
    console.log(missingCoords.slice(0, 10).join('\n'));
}
