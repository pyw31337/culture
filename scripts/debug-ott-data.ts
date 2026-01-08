import fs from 'fs';
import path from 'path';

try {
    const raw = fs.readFileSync(path.resolve('src/data/ott.json'), 'utf-8');
    const data = JSON.parse(raw);

    console.log(`Checking ${data.length} items...`);

    let errCount = 0;
    data.forEach((item: any, i: number) => {
        if (!item.title) { console.error(`Item ${i} missing title`); errCount++; }
        if (!item.date) { console.error(`Item ${i} missing date: ${item.title}`); errCount++; }
        if (!item.id) { console.error(`Item ${i} missing id: ${item.title}`); errCount++; }
        if (!Array.isArray(item.platforms)) { console.error(`Item ${i} platforms not array: ${item.title}`); errCount++; }

        // Ensure venue is truly missing (so our default trigger works)
        if (item.venue !== undefined) { console.log(`Item ${i} HAS venue: ${item.venue}`); }
    });

    if (errCount === 0) console.log('All OTT items valid.');
    else console.log(`Found ${errCount} errors.`);

} catch (e) {
    console.error('File read error:', e);
}
