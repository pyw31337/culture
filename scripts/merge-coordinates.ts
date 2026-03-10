import fs from 'fs';
import path from 'path';

const VENUES_PATH = 'src/data/venues.json';
const KOPIS_PATH = 'src/data/kopis-performances.json';
const MOCHA_PATH = 'src/data/mochaclass.json';
const YES24_PATH = 'src/data/yes24-performances.json';

function mergeCoordinates(filePath: string, venues: any, cleanVenueMap: any) {
    if (!fs.existsSync(filePath)) return;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    let count = 0;
    
    const updated = data.map((item: any) => {
        const venueName = item.venue || '';
        if (!venueName) return item;
        
        let venueData = venues[venueName];
        
        // Smarter matching for KOPIS style halls: "Venue Name (Hall Name)"
        if (!venueData) {
            const cleanName = venueName.split(/[\(\[\{]/)[0].trim();
            venueData = venues[cleanName] || cleanVenueMap[cleanName];
        }
        
        if (venueData && venueData.lat && venueData.lng) {
            count++;
            return {
                ...item,
                lat: venueData.lat,
                lng: venueData.lng,
                address: venueData.address || item.address,
                district: venueData.district || item.district,
                region: venueData.region || item.region
            };
        }
        return item;
    });
    
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));
    console.log(`Merged coordinates for ${count}/${data.length} items in ${filePath}`);
}

function main() {
    if (!fs.existsSync(VENUES_PATH)) {
        console.error('venues.json not found');
        return;
    }
    const venues = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf-8'));
    
    // Build a lookup map of cleaned venue names
    const cleanVenueMap: any = {};
    Object.keys(venues).forEach(name => {
        const cleanName = name.split(/[\(\[\{]/)[0].trim();
        if (!cleanVenueMap[cleanName]) {
            cleanVenueMap[cleanName] = venues[name];
        }
    });

    const dataFiles = fs.readdirSync('src/data')
        .filter(f => f.endsWith('.json') && 
                     !['venues.json', 'venuedictionary.json', 'venue-dictionary.json', 'korean_address_hierarchy.json', 'bad-venues.json', 'mommom-debug.json', 'venues.backup.json', 'mommom.json'].includes(f) &&
                     !f.includes('.bak.'));

    dataFiles.forEach(file => {
        mergeCoordinates(path.join('src/data', file), venues, cleanVenueMap);
    });
}

main();
