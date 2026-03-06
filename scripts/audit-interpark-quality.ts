
import fs from 'fs';
import path from 'path';

const interparkPath = path.resolve(process.cwd(), 'src/data/interpark.json');
const venuesPath = path.resolve(process.cwd(), 'src/data/venues.json');

if (!fs.existsSync(interparkPath)) {
    console.error('interpark.json not found');
    process.exit(1);
}

const interparkData = JSON.parse(fs.readFileSync(interparkPath, 'utf-8'));
const venuesData = fs.existsSync(venuesPath) ? JSON.parse(fs.readFileSync(venuesPath, 'utf-8')) : {};

const total = interparkData.length;
const etcItems = interparkData.filter((i: any) => i.genre === 'etc');
const missingPrice = interparkData.filter((i: any) => !i.price || i.price === '가격정보없음' || i.price === '');
const missingAddress = interparkData.filter((i: any) => !i.address || i.address === '정보 없음' || i.address === '');
const missingPoster = interparkData.filter((i: any) => !i.image);

// Check if venue data exists but interpark.json doesn't have address
const missingAddrButVenueHasOne = interparkData.filter((i: any) => {
    const hasNoAddr = !i.address || i.address === '정보 없음' || i.address === '';
    const venueInfo = venuesData[i.venue];
    return hasNoAddr && venueInfo && venueInfo.address && venueInfo.address !== '정보 없음';
});

console.log('=== Interpark Data Quality Audit ===');
console.log(`Total items: ${total}`);
console.log(`ETC items: ${etcItems.length} (${((etcItems.length / total) * 100).toFixed(1)}%)`);
console.log(`Missing price: ${missingPrice.length} (${((missingPrice.length / total) * 100).toFixed(1)}%)`);
console.log(`Missing address in interpark.json: ${missingAddress.length} (${((missingAddress.length / total) * 100).toFixed(1)}%)`);
console.log(`Missing poster: ${missingPoster.length}`);
console.log(`Missing address but venues.json has it: ${missingAddrButVenueHasOne.length}`);

console.log('\n--- ETC Examples ---');
etcItems.slice(0, 10).forEach((i: any) => console.log(`- [${i.genre}] ${i.title} (${i.link})`));

console.log('\n--- Missing Price Examples ---');
missingPrice.slice(0, 10).forEach((i: any) => console.log(`- ${i.title} (${i.link})`));

if (missingAddrButVenueHasOne.length > 0) {
    console.log('\n--- Missing Address but Venue has one (Examples) ---');
    missingAddrButVenueHasOne.slice(0, 10).forEach((i: any) => {
        console.log(`- ${i.title} | Venue: ${i.venue} | Venue Addr: ${venuesData[i.venue].address}`);
    });
}
