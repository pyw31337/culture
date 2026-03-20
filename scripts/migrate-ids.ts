import * as fs from 'fs';
import * as path from 'path';

const BASE_DIR = process.cwd();

const sources = [
    { file: 'src/data/interpark.json', prefix: 'perf' },
    { file: 'src/data/ott.json', prefix: 'ott' },
    { file: 'src/data/timeticket.json', prefix: 'perf' },
    { file: 'src/data/yes24.json', prefix: 'perf' },
    { file: 'src/data/seoul-culture.json', prefix: 'perf' },
    { file: 'src/data/festivals.json', prefix: 'fest' },
    { file: 'src/data/myrealtrip-kids.json', prefix: 'kids' },
    { file: 'src/data/travel.json', prefix: 'travel' },
    { file: 'src/data/mochaclass.json', prefix: 'class' },
    { file: 'src/data/umclass.json', prefix: 'class' },
    { file: 'src/data/sssd-class.json', prefix: 'class' },
    { file: 'src/data/mommom.json', prefix: 'mommom' },
    { file: 'src/data/museum.json', prefix: 'museum' },
];

// Sports stay as is but we can normalize kbl to use vs
const sports = [
    'src/data/kbo.json',
    'src/data/kovo.json',
    'src/data/kbl.json',
    'src/data/handball.json',
];

function slugify(text: string): string {
    return text
        .replace(/[^a-zA-Z0-9가-힣]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

async function migrate() {
    for (const source of sources) {
        const filePath = path.join(BASE_DIR, source.file);
        if (!fs.existsSync(filePath)) continue;

        console.log(`Migrating ${source.file}...`);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const usedIds = new Set<string>();

        const migrated = data.map((item: any) => {
            const safeTitle = slugify(item.title);
            let newId = `${source.prefix}_${safeTitle}`;

            // Handle duplicates
            let counter = 2;
            let finalId = newId;
            while (usedIds.has(finalId)) {
                finalId = `${newId}_${counter}`;
                counter++;
            }
            usedIds.add(finalId);

            return {
                ...item,
                id: finalId
            };
        });

        fs.writeFileSync(filePath, JSON.stringify(migrated, null, 2));
        console.log(`  Done: ${migrated.length} items`);
    }

    // Generic Sports Migration: normalize IDs while keeping date prefix
    const sportsSources = [
        { file: 'src/data/kbo.json', prefix: 'kbo' },
        { file: 'src/data/kbl.json', prefix: 'kbl' },
        { file: 'src/data/kovo.json', prefix: 'kovo' },
        { file: 'src/data/handball.json', prefix: 'handball' },
    ];

    for (const sport of sportsSources) {
        const filePath = path.join(BASE_DIR, sport.file);
        if (!fs.existsSync(filePath)) continue;

        console.log(`Migrating Sport: ${sport.file}...`);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const migrated = data.map((item: any) => {
            // Find date prefix (YYYYMMDD) in ID
            const dateMatch = item.id.match(/\d{8}/);
            if (dateMatch) {
                const date = dateMatch[0];
                const safeMatchup = slugify(item.title);
                return {
                    ...item,
                    id: `${sport.prefix}_${date}_${safeMatchup}`
                };
            }
            return item;
        });
        fs.writeFileSync(filePath, JSON.stringify(migrated, null, 2));
        console.log(`  Done: ${migrated.length} items`);
    }
}

migrate();
