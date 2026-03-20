const fs = require('fs');
const path = require('path');

const VENUES_PATH = path.resolve(__dirname, '../src/data/venues.json');
const OUTPUT_PATH = path.resolve(__dirname, '../venues_for_review.csv');

const venues = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf8'));

// Convert to array
const list = Object.keys(venues).map(key => ({
    key: key,
    ...venues[key]
}));

// Sort by name (Korean/English sensitive)
list.sort((a, b) => {
    return (a.name || a.key).localeCompare(b.name || b.key, 'ko');
});

// CSV Header
const header = ['key', 'name', 'address', 'district', 'mapped_region_id', 'lat', 'lng'];
const rows = list.map(v => {
    return [
        v.key,
        v.name || '',
        v.address || '',
        v.district || '',
        v.mapped_region_id || '',
        v.lat || 0,
        v.lng || 0
    ].map(field => {
        // Escape quotes and wrap in quotes if contains comma
        const str = String(field).replace(/"/g, '""');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str}"`;
        }
        return str;
    }).join(',');
});

const csvContent = '\uFEFF' + [header.join(','), ...rows].join('\n'); // Add BOM for Excel

fs.writeFileSync(OUTPUT_PATH, csvContent, 'utf8');

console.log(`Exported ${list.length} venues to ${OUTPUT_PATH}`);
