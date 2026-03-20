import fs from 'fs';
import path from 'path';

// Load RAW JSON files directly
const RAW_DIR = path.resolve(process.cwd(), 'src/data');
const VENUES_PATH = path.resolve(RAW_DIR, 'venues.json');

const filesToLoad = [
    'interpark.json', 'kovo.json', 'kbl.json', 'kbo.json',
    'festivals.json', 'yes24.json', 'timeticket.json',
    'sssd-class.json', 'handball.json', 'umclass.json',
    'seoul-culture.json', 'mochaclass.json',
    'mommom.json', 'mommom-products.json', 'museum.json'
];

async function checkRawMissing() {
    const rawVenues = fs.readFileSync(VENUES_PATH, 'utf-8');
    const venues = JSON.parse(rawVenues);

    let allItems: any[] = [];

    for (const file of filesToLoad) {
        try {
            const filepath = path.resolve(RAW_DIR, file);
            if (fs.existsSync(filepath)) {
                const data = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
                if (Array.isArray(data)) {
                    // Quick fix for seoul-culture
                    if (file === 'seoul-culture.json') {
                        data.forEach(d => { d.venue = d.place; d._src = file; });
                    } else {
                        data.forEach(d => { d._src = file; });
                    }
                    allItems = allItems.concat(data);
                }
            }
        } catch (e) { }
    }

    // Filter items missing venue, address, lat, or lng
    const missingCoords = allItems.filter((d: any) => {
        if (!d.venue) return true;
        const vInfo = venues[d.venue];
        if (!vInfo) return true;
        if (!vInfo.address || vInfo.address === '정보 없음' || !vInfo.lat || !vInfo.lng) return true;
        return false;
    });

    console.log(`Total raw items (excluding movie/ott): ${allItems.length}`);
    console.log(`Items dropped due to missing coordinates: ${missingCoords.length}`);

    // Output top 50 missing venues
    const venueCounts = missingCoords.reduce((acc: any, d: any) => {
        const v = d.venue ? d.venue : `No Venue Listed (${d._src})`;
        acc[v] = (acc[v] || 0) + 1;
        return acc;
    }, {});

    const sortedVenues = Object.entries(venueCounts).sort((a: any, b: any) => b[1] - a[1]).slice(0, 50);
    console.log('\nTop missing venues:');
    sortedVenues.forEach(([v, c]) => console.log(`- ${v}: ${c} items`));
}

checkRawMissing();
