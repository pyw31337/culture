
import fs from 'fs';
import path from 'path';

const dataPath = path.resolve(process.cwd(), 'src/data/ott.json');
const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

const titleMap = new Map<string, any[]>();
const normalizedMap = new Map<string, any[]>();

function normalize(str: string) {
    return str.toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
}

data.forEach((item: any) => {
    // Exact match
    if (!titleMap.has(item.title)) titleMap.set(item.title, []);
    titleMap.get(item.title)?.push(item);

    // Normalized match
    const norm = normalize(item.title);
    if (!normalizedMap.has(norm)) normalizedMap.set(norm, []);
    normalizedMap.get(norm)?.push(item);
});

console.log('--- Exact Title Duplicates ---');
for (const [title, items] of titleMap) {
    if (items.length > 1) {
        console.log(`"${title}": ${items.length} count`);
    }
}

console.log('\n--- Normalized Title Duplicates ---');
for (const [norm, items] of normalizedMap) {
    if (items.length > 1) {
        const titles = items.map(i => i.title).join(' vs ');
        console.log(`[${norm}] ${titles}: ${items.length} count`);
    }
}
