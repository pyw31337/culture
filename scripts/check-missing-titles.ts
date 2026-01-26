
import fs from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), 'src/data');

const files = fs.readdirSync(dataDir).filter(file => file.endsWith('.json'));

let totalMissing = 0;

files.forEach(file => {
    const filePath = path.join(dataDir, file);
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);

        let fileMissingCount = 0;
        let items = [];

        if (Array.isArray(data)) {
            items = data;
        } else if (typeof data === 'object' && data !== null) {
            // Check if it's a dict like venues.json
            items = Object.values(data);
        }

        items.forEach((item: any) => {
            // Check for missing title
            // Some files might be dictionaries of venues, so check structure
            if (item && typeof item === 'object') {
                if ('title' in item) {
                    if (!item.title || item.title.trim() === '') {
                        console.log(`[${file}] Empty Title: ID=${item.id || 'Unknown'}, Source=${item.source || 'Unknown'}`);
                        fileMissingCount++;
                    }
                } else {
                    // No title key found
                    // Check if it's likely a venue file (has name, address) or specific files known to be venues
                    const isVenueFile = file.includes('venue') || file.includes('bad-') || file === 'mochaclass.json';
                    // mochaclass.json has 'title' usually? Let's check.
                    // Actually, let's just log it if it doesn't have 'name' either.
                    if (!('name' in item)) {
                        console.log(`[${file}] MISSING KEY 'title': ID=${item.id || 'Unknown'}`);
                        fileMissingCount++;
                    }
                }
            }
        });

        if (fileMissingCount > 0) {
            console.log(`=> ${file}: ${fileMissingCount} items with missing titles.`);
            totalMissing += fileMissingCount;
        }

    } catch (error) {
        console.error(`Error reading ${file}:`, error);
    }
});

console.log(`\nTotal items with missing titles: ${totalMissing}`);
