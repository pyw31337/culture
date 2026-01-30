
const fs = require('fs');
const path = require('path');

// Read venues.json
const venuePath = path.join(process.cwd(), 'src/data/venues.json');
const rawData = fs.readFileSync(venuePath, 'utf8');
const venues = JSON.parse(rawData);

// Sort keys alphabetically (matches the select box order)
const sortedKeys = Object.keys(venues).sort();

// CSV Header
const header = ['name', 'mapped_region_id', 'district', 'address', 'lat', 'lng'];
const rows = [header.join(',')];

// Generate rows
sortedKeys.forEach(key => {
    const v = venues[key];
    const row = [
        `"${v.name.replace(/"/g, '""')}"`, // Quote and escape quotes
        v.mapped_region_id || '',
        v.district || '',
        `"${(v.address || '').replace(/"/g, '""')}"`,
        v.lat || '',
        v.lng || ''
    ];
    rows.push(row.join(','));
});

// Write CSV
const csvContent = rows.join('\n');
const outputPath = path.join(process.cwd(), 'venue_export.csv');
fs.writeFileSync(outputPath, csvContent, 'utf8');

console.log(`Exported ${sortedKeys.length} venues to ${outputPath}`);
