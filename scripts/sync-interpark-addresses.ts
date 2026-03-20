
import fs from 'fs';
import path from 'path';

const interparkPath = path.resolve(process.cwd(), 'src/data/interpark.json');
const venuesPath = path.resolve(process.cwd(), 'src/data/venues.json');

if (!fs.existsSync(interparkPath) || !fs.existsSync(venuesPath)) {
    console.error('Data files missing');
    process.exit(1);
}

const interparkData = JSON.parse(fs.readFileSync(interparkPath, 'utf-8'));
const venuesData = JSON.parse(fs.readFileSync(venuesPath, 'utf-8'));

let updatedCount = 0;

const updatedData = interparkData.map((item: any) => {
    const hasAddress = item.address && item.address !== '정보 없음' && item.address !== '';
    if (!hasAddress) {
        const venueInfo = venuesData[item.venue];
        if (venueInfo && venueInfo.address && venueInfo.address !== '정보 없음') {
            updatedCount++;
            return {
                ...item,
                address: venueInfo.address,
                district: venueInfo.district || item.district
            };
        }
    }
    return item;
});

if (updatedCount > 0) {
    fs.writeFileSync(interparkPath, JSON.stringify(updatedData, null, 2));
    console.log(`Successfully synced ${updatedCount} addresses from venues.json to interpark.json`);
} else {
    console.log('No addresses to sync.');
}
