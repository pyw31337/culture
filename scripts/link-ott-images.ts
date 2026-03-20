import fs from 'fs';
import path from 'path';

const OTT_FILE = path.resolve(process.cwd(), 'src/data/ott.json');
const POSTERS_DIR = path.resolve(process.cwd(), 'public/images/posters');

function sanitizeTitle(title: string): string {
    return title.replace(/[^a-zA-Z0-9가-힣]/g, '');
}

function linkImages() {
    console.log('Linking existing OTT images...');

    if (!fs.existsSync(OTT_FILE)) {
        console.error('ott.json not found');
        return;
    }

    const items = JSON.parse(fs.readFileSync(OTT_FILE, 'utf-8'));
    const files = fs.readdirSync(POSTERS_DIR);

    // Map sanitized title to array of files (sorted by potential freshness/name)
    const fileMap = new Map<string, string[]>();

    files.forEach(file => {
        if (!file.endsWith('.webp') && !file.endsWith('.jpg')) return;
        if (!file.startsWith('ott_')) return;

        // Pattern: ott_YYYYMMDD_Title.webp OR ott_Title.webp
        // Extract title part... tough because title can have underscores?
        // Actually, we generally construct it as ott_SAFE-TITLE.webp or ott_DATE_SAFE-TITLE.webp

        // Let's rely on checking if the file *contains* the sanitized title of the item
        // But better to build a map from the filesystem side if possible?
        // No, let's iterate items and search files.
    });

    let updated = 0;

    for (const item of items) {
        // if (item.image) continue; // Skip if already has image? No, might want to fix broken ones.

        const safeTitle = sanitizeTitle(item.title);
        if (!safeTitle) continue;

        // strategies for finding image:
        // 1. Exact match: ott_{safeTitle}.webp
        // 2. Date match: ott_\d{8}_{safeTitle}.webp
        // 3. Suffix match: _{safeTitle}.webp

        // Find matching files
        const matches = files.filter(f => {
            // Check provided stable name
            if (f === `ott_${safeTitle}.webp`) return true;

            // Check date pattern
            // ott_20260120_Title.webp
            // Regex: ^ott_\d{8}_Title.webp
            // We need to be careful about not matching "Title2" when looking for "Title"
            // So we check if the file ends with `_${safeTitle}.webp` or `ott_${safeTitle}.webp`

            if (f.includes(`_${safeTitle}.webp`)) return true;
            if (f.includes(`ott_${safeTitle}.webp`)) return true;

            return false;
        });

        if (matches.length > 0) {
            // Pick "best" match. 
            // Prefer one without " 2" (duplicate indicator) if possible?
            // Prefer most recent date?

            matches.sort().reverse(); // lexicographical reverse sort puts later dates first (usually)

            const best = matches[0];
            const imagePath = `/images/posters/${best}`;

            if (item.image !== imagePath) {
                item.image = imagePath;
                updated++;
                // console.log(`Linked ${item.title} -> ${best}`);
            }
        }
    }

    console.log(`Updated ${updated} items with existing local images.`);
    fs.writeFileSync(OTT_FILE, JSON.stringify(items, null, 2));
}

linkImages();
