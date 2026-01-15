
import fs from 'fs';
import path from 'path';

const ottPath = path.join(process.cwd(), 'src/data/ott.json');
const ottData = JSON.parse(fs.readFileSync(ottPath, 'utf-8'));

console.log(`Total OTT Items: ${ottData.length}`);

const poorItems = ottData.filter((item: any) => {
    // Define "Poor" as missing key metadata OR missing poster
    const missingPoster = !item.image || item.image.startsWith('data:image');
    if (missingPoster) return true;
    return !item.ageRating || !item.runningTime || !item.productionCountry || !item.subGenre;
});

console.log(`Poor Quality Items: ${poorItems.length}`);
poorItems.forEach((item: any) => {
    const missingPoster = !item.image || item.image.startsWith('data:image');
    console.log(`- [${item.title}] Missing: ${!item.ageRating ? 'Rating ' : ''}${!item.runningTime ? 'Time ' : ''}${!item.productionCountry ? 'Country ' : ''}${!item.subGenre ? 'Genre ' : ''}${missingPoster ? 'POSTER' : ''}`);
});
