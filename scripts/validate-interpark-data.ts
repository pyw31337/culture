// Validation script for Interpark data quality
import fs from 'fs';
import path from 'path';

const filePath = path.resolve(process.cwd(), 'src/data/interpark.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

console.log('=== Interpark Data Quality Validation ===\n');

// 1. Total Items
console.log(`Total Items: ${data.length}`);

// 2. Field Completeness
const fields = ['id', 'title', 'image', 'date', 'venue', 'link', 'region', 'genre', 'runningTime', 'ageRating', 'price', 'originalPrice', 'discount'];
const completeness: Record<string, number> = {};
fields.forEach(f => completeness[f] = 0);

data.forEach((item: any) => {
    fields.forEach(f => {
        if (item[f] && String(item[f]).trim() !== '') {
            completeness[f]++;
        }
    });
});

console.log('\n--- Field Completeness ---');
fields.forEach(f => {
    const pct = ((completeness[f] / data.length) * 100).toFixed(1);
    console.log(`${f.padEnd(15)}: ${completeness[f].toString().padStart(5)} / ${data.length} (${pct}%)`);
});

// 3. Genre Distribution
const genres: Record<string, number> = {};
data.forEach((item: any) => {
    const g = item.genre || 'unknown';
    genres[g] = (genres[g] || 0) + 1;
});
console.log('\n--- Genre Distribution ---');
Object.entries(genres).sort((a, b) => b[1] - a[1]).forEach(([g, c]) => {
    console.log(`${g.padEnd(15)}: ${c}`);
});

// 4. Price Field Analysis
let withPrice = 0;
let withDiscount = 0;
let priceFormats: Record<string, number> = {};

data.forEach((item: any) => {
    if (item.price && String(item.price).trim() !== '') {
        withPrice++;
        // Check format
        if (/[0-9,]+원/.test(item.price)) {
            priceFormats['valid_kr_format'] = (priceFormats['valid_kr_format'] || 0) + 1;
        } else {
            priceFormats['other_format'] = (priceFormats['other_format'] || 0) + 1;
        }
    }
    if (item.discount && String(item.discount).trim() !== '') {
        withDiscount++;
    }
});

console.log('\n--- Price Analysis ---');
console.log(`Items with price: ${withPrice} / ${data.length} (${((withPrice / data.length) * 100).toFixed(1)}%)`);
console.log(`Items with discount info: ${withDiscount}`);
console.log('Price Formats:', priceFormats);

// 5. Recent Enrichment Check
const recentlyEnriched = data.filter((item: any) => {
    if (!item.lastEnriched) return false;
    try {
        const last = new Date(item.lastEnriched);
        const now = new Date();
        const diffHours = (now.getTime() - last.getTime()) / (1000 * 3600);
        return diffHours < 1; // Enriched within last hour
    } catch (e) { return false; }
});
console.log(`\nRecently Enriched (last 1 hour): ${recentlyEnriched.length}`);

// 6. Sample newly enriched items with discount info
const sampleDiscount = data.filter((item: any) => item.discount && item.originalPrice).slice(0, 5);
if (sampleDiscount.length > 0) {
    console.log('\n--- Sample Items with Discount ---');
    sampleDiscount.forEach((item: any) => {
        console.log(`  ${item.title.slice(0, 40)}`);
        console.log(`    Price: ${item.price} (Was: ${item.originalPrice}, -${item.discount})`);
    });
}

console.log('\n=== Validation Complete ===');
