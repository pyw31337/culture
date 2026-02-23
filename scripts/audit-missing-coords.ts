import fs from 'fs';
import path from 'path';

const PERF_PATH = path.resolve(process.cwd(), 'public/data/performances.json');
const VENUES_PATH = path.resolve(process.cwd(), 'src/data/venues.json');

async function checkMissing() {
    const rawPerf = fs.readFileSync(PERF_PATH, 'utf-8');
    const performances = JSON.parse(rawPerf);

    const rawVenues = fs.readFileSync(VENUES_PATH, 'utf-8');
    const venues = JSON.parse(rawVenues);

    const nonMedia = performances.filter((d: any) => d.genre !== 'movie' && d.genre !== 'ott');

    // An item is missing coordinates if it has no venue, or if its venue isn't in venues.json, 
    // or if the venue in venues.json lacks lat/lng.
    const missingCoords = nonMedia.filter((d: any) => {
        if (!d.venue) return true;
        const vInfo = venues[d.venue];
        if (!vInfo) return true;
        if (!vInfo.lat || !vInfo.lng) return true;
        return false;
    });

    console.log(`Total non-media items: ${nonMedia.length}`);
    console.log(`Items missing coordinates: ${missingCoords.length}`);

    const breakdown = missingCoords.reduce((acc: any, d: any) => {
        acc[d.genre] = (acc[d.genre] || 0) + 1;
        return acc;
    }, {});
    console.log('\nMissing items by genre:', breakdown);

    const missingVenues = new Set(missingCoords.map((d: any) => d.venue).filter(Boolean));
    console.log(`\nUnique venues missing coordinates: ${missingVenues.size}`);

    // Output top 30 missing venues
    const venueCounts = missingCoords.reduce((acc: any, d: any) => {
        const v = d.venue || 'No Venue Listed';
        acc[v] = (acc[v] || 0) + 1;
        return acc;
    }, {});

    const sortedVenues = Object.entries(venueCounts).sort((a: any, b: any) => b[1] - a[1]).slice(0, 30);
    console.log('\nTop missing venues:');
    sortedVenues.forEach(([v, c]) => console.log(`- ${v}: ${c} items`));
}

checkMissing();
