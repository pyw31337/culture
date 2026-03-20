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
        if (!vInfo.address || vInfo.address === '정보 없음' || vInfo.address.includes('서울특별시 송파구')) return true; // 송파구 is often a partial address fallback
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

    const venueCounts = missingCoords.reduce((acc: any, d: any) => {
        const v = d.venue || 'No Venue Listed';
        acc[v] = (acc[v] || 0) + 1;
        return acc;
    }, {});

    const sortedVenues = Object.entries(venueCounts).sort((a: any, b: any) => b[1] - a[1]);

    const reportData = sortedVenues.map(([venue, count]) => ({
        venue,
        count
    }));

    fs.writeFileSync(path.resolve(process.cwd(), 'missing_venues_report.json'), JSON.stringify(reportData, null, 2));

    console.log(`Total non-media items: ${nonMedia.length}`);
    console.log(`Items missing coordinates: ${missingCoords.length}`);
    console.log(`Unique venues missing coordinates: ${missingVenues.size}`);
    console.log(`Report written to missing_venues_report.json`);
}

checkMissing();
