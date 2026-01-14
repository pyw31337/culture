
import fs from 'fs';
import path from 'path';

const jsonPath = path.resolve(__dirname, '../src/data/ott.json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

let enrichedCount = 0;
let totalCount = data.length;

data.forEach((item: any) => {
    // Check for fields that are only present after enrichment
    if (item.productionYear || item.director || (item.cast && item.cast.length > 0) || item.runningTime) {
        enrichedCount++;
    }
});

console.log(`Total Items: ${totalCount}`);
console.log(`Enriched Items: ${enrichedCount}`);
console.log(`Progress: ${((enrichedCount / totalCount) * 100).toFixed(2)}%`);

// Also check specifically for recent ones to see if it's working NOW
const recentEnriched = data.slice(0, 100).filter((item: any) => item.productionYear || item.director).length;
console.log(`Top 100 Enriched: ${recentEnriched}`);
