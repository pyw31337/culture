import fs from 'fs';
import path from 'path';

const dataDir = 'src/data';
const files = ['kopis-performances.json', 'mochaclass.json', 'yes24-performances.json'];

files.forEach(file => {
    const filePath = path.join(dataDir, file);
    if (!fs.existsSync(filePath)) return;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    let mismatches: any[] = [];
    let missingCoords: any[] = [];
    
    data.forEach((item: any) => {
        // 1. Audit Region Tags
        const titleMatch = item.title.match(/\[(.*?)\]/);
        if (titleMatch) {
            const regionKeyword = titleMatch[1];
            const address = item.address || '';
            const venue = item.venue || '';
            const combined = (address + ' ' + venue + ' ' + (item.region || '')).toLowerCase();
            
            const IGNORE_KEYWORDS = ['전회', '대관', '특가', '얼리버드', '단독', '공유', '이벤트'];
            if (!IGNORE_KEYWORDS.includes(regionKeyword) && !combined.includes(regionKeyword.toLowerCase())) {
                mismatches.push({ title: item.title, regionKeyword, location: `${address} | ${venue}` });
            }
        }
        
        // 2. Audit Missing Coordinates
        if (!item.at && (!item.lat || !item.lng)) {
             // Some items might use 'lat'/'lng' directly, some might have them nested. 
             // KOPIS has them top level now.
             missingCoords.push(item.title);
        }
    });
    
    console.log(`\n### Audit for ${file} ###`);
    console.log(`Total Items: ${data.length}`);
    console.log(`[Region] Title Mismatches: ${mismatches.length}`);
    if (mismatches.length > 0) {
        console.log("Sample mismatches:");
        mismatches.slice(0, 5).forEach(m => console.log(`  - [${m.regionKeyword}] ${m.title} vs ${m.location}`));
    }
    console.log(`Missing Coordinates: ${missingCoords.length}`);
     if (missingCoords.length > 0) {
        console.log("Sample missing coords:");
        missingCoords.slice(0, 5).forEach(m => console.log(`  - ${m}`));
    }
});
