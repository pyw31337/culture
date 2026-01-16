
import fs from 'fs';
import path from 'path';

const OUTPUT_FILE = path.resolve(process.cwd(), 'src/data/ott.json');
const banned = ['인도', '터키', '태국', 'India', 'Turkey', 'Thailand', 'Indian', 'Turkish', 'Thai'];

// Load Data
const rawData = fs.readFileSync(OUTPUT_FILE, 'utf-8');
const data = JSON.parse(rawData);

console.log(`Original Items: ${data.length}`);

const validItems = data.filter((i: any) => {
    const title = (i.title || '').toLowerCase();
    const country = (i.productionCountry || '').toLowerCase();

    // 1. Country Check
    if (country && banned.some(b => country.includes(b.toLowerCase()))) {
        console.log(`[Filter-Country] Removing: ${i.title} (${i.productionCountry})`);
        return false;
    }

    // 2. Title Fallback (If Country Missing OR Title explicitly contains banned keyword)
    if (banned.some(b => title.includes(b.toLowerCase()))) {
        console.log(`[Filter-Title] Removing: ${i.title} (Title Match: ${title})`);
        return false;
    }

    // 3. China Check (Show/Season/!Movie)
    if (country.includes('중국') || country.includes('china')) {
        const isMovie = i.runningTime && i.runningTime.match(/\d+분/) && parseInt(i.runningTime.replace(/\D/g, '')) < 240;
        const hasSeason = title.includes('시즌') || title.includes('season');
        if (!isMovie || hasSeason) {
            console.log(`[Filter-China] Removing: ${i.title}`);
            return false;
        }
    }

    return true;
});

console.log(`Filtered Items: ${validItems.length}`);
console.log(`Removed: ${data.length - validItems.length}`);

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(validItems, null, 2));
