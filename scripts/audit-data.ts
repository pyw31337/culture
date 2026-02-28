import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'src/data');
const PUBLIC_DIR = path.join(process.cwd(), 'public');

const DATA_FILES = [
    'interpark.json', 'kovo.json', 'kbl.json', 'kbo.json',
    'festivals.json', 'yes24.json', 'timeticket.json',
    'movies.json', 'myrealtrip-kids.json', 'sssd-class.json',
    'handball.json', 'kleague.json', 'umclass.json',
    'seoul-culture.json', 'mochaclass.json', 'mommom.json',
    'mommom-products.json', 'museum.json'
];

async function audit() {
    console.log('--- CultureFlow Data Health Audit ---');
    let totalErrors = 0;
    let totalItems = 0;

    for (const file of DATA_FILES) {
        const filePath = path.join(DATA_DIR, file);
        if (!fs.existsSync(filePath)) {
            console.warn(`[MISSING FILE] ${file}`);
            continue;
        }

        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const items = Array.isArray(data) ? data : [];
        totalItems += items.length;

        let fileErrors = 0;
        items.forEach((item: any, idx: number) => {
            const img = item.image || item.poster || item.posterUrl;
            const title = item.title || `Item ${idx}`;

            // 1. Image Check
            if (!img) {
                // console.error(`[${file}] Missing Image: ${title}`);
                fileErrors++;
            } else if (img.startsWith('/')) {
                const fullPath = path.join(PUBLIC_DIR, img);
                if (!fs.existsSync(fullPath)) {
                    // console.error(`[${file}] Broken Local Path: ${img} (${title})`);
                    fileErrors++;
                }
            }

            // 2. Venue Check (Basic)
            if (!item.venue && item.genre !== 'movie' && !item.place) {
                fileErrors++;
            }
        });

        if (fileErrors > 0) {
            console.log(`[${file}] Found ${fileErrors} issues in ${items.length} items.`);
            totalErrors += fileErrors;
        }
    }

    console.log('---');
    console.log(`Total Items Audited: ${totalItems}`);
    console.log(`Total Potential Issues: ${totalErrors}`);
    console.log('--------------------------------------');
}

audit().catch(console.error);
