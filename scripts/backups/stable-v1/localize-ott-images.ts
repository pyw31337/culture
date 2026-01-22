import fs from 'fs';
import path from 'path';
import { processImage } from './utils/image-processor';

const OTT_FILE = path.resolve(process.cwd(), 'src/data/ott.json');

async function localizeImages() {
    console.log('Starting OTT Image Localization...');

    if (!fs.existsSync(OTT_FILE)) {
        console.error('ott.json not found!');
        return;
    }

    const items = JSON.parse(fs.readFileSync(OTT_FILE, 'utf-8'));
    let updatedCount = 0;

    console.log(`Processing ${items.length} items...`);

    for (const item of items) {
        if (!item.poster) continue;

        // Check if remote (http/https) and NOT already localized (doesn't start with /images/posters)
        const isRemote = item.poster.startsWith('http');
        const isAlreadyLocal = item.poster.startsWith('/images/posters');

        if (isRemote && !isAlreadyLocal) {
            try {
                // Use stable filename logic
                const safeTitle = item.title.replace(/[^a-zA-Z0-9가-힣]/g, '');
                const filenameBase = `ott_${safeTitle}`;
                const localPath = await processImage(item.poster, filenameBase);

                if (localPath) {
                    item.image = localPath;
                    updatedCount++;
                    process.stdout.write('.');
                }
            } catch (e) {
                console.error(`\nFailed to localize poster for ${item.title}:`, e);
            }
        }
    }

    console.log(`\nLocalization complete. Updated ${updatedCount} items.`);
    fs.writeFileSync(OTT_FILE, JSON.stringify(items, null, 2));
}

localizeImages();
