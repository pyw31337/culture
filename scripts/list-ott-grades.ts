
import fs from 'fs';
import path from 'path';

const file = path.resolve(process.cwd(), 'src/data/ott.json');
const data = JSON.parse(fs.readFileSync(file, 'utf-8'));

console.log(`Total collected items: ${data.length}`);
console.log('---------------------------------------------------');
console.log('Title | Age Rating');
console.log('---------------------------------------------------');

let missingCount = 0;
data.forEach((item: any) => {
    if (!item.ageRating) {
        missingCount++;
        console.log(`[MISSING] ${item.title}`);
    } else {
        console.log(`${item.title} | ${item.ageRating}`);
    }
});
console.log('---------------------------------------------------');
console.log(`Total missing age rating: ${missingCount}`);
