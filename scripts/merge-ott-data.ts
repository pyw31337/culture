
import fs from 'fs';
import path from 'path';

const MAIN_FILE = path.resolve(process.cwd(), 'src/data/ott-naver.json');
const TARGETS_FILE = path.resolve(process.cwd(), 'src/data/ott-targets.json');
const OUTPUT_FILE = path.resolve(process.cwd(), 'src/data/ott.json');

try {
    const mainData = JSON.parse(fs.readFileSync(MAIN_FILE, 'utf-8'));
    const targetData = JSON.parse(fs.readFileSync(TARGETS_FILE, 'utf-8'));

    // Map by ID or Title to deduplicate
    const map = new Map();

    mainData.forEach((item: any) => {
        // Ensure ID
        if (!item.id) item.id = `ott_naver_${item.title.replace(/\s+/g, '')}`;
        map.set(item.id, item);
    });

    targetData.forEach((item: any) => {
        if (!item.id) item.id = `ott_naver_${item.title.replace(/\s+/g, '')}`;
        // Overwrite main data with targeted (verified) data
        map.set(item.id, item);
    });

    const merged = Array.from(map.values());
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(merged, null, 2));

    console.log(`Merged ${mainData.length} main items and ${targetData.length} target items.`);
    console.log(`Total Unique Items: ${merged.length}`);
} catch (e) {
    console.error('Merge failed:', e);
    process.exit(1);
}
