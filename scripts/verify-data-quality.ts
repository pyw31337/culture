
import fs from 'fs';
import path from 'path';

const ottPath = path.resolve(process.cwd(), 'src/data/ott.json');
const data = JSON.parse(fs.readFileSync(ottPath, 'utf8'));

// Check for entries with missing critical metadata after the scrape
const incomplete = data.filter((item: any) =>
    (!item.runningTime || item.runningTime === '') &&
    (!item.originalTitle || item.originalTitle === '') &&
    (!item.grade || item.grade === '' || item.grade === 'OTT' || item.grade === '전체')
);

console.log(`Total items: ${data.length}`);
console.log(`Items missing RunTime AND OriginalTitle AND Grade: ${incomplete.length}`);

// Sample incomplete items to see if they are just minor things or major failures
if (incomplete.length > 0) {
    console.log('Sample incomplete items:', incomplete.slice(0, 5).map((i: any) => i.title));
}
