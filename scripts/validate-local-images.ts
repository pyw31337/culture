
import fs from 'fs';
import path from 'path';

const DATA_FILES = [
    'festivals.json',
    'movies.json',
    'ott.json',
    'performances.json'
];

const PUBLIC_DIR = path.join(process.cwd(), 'public');
const DATA_DIR = path.join(process.cwd(), 'src', 'data');

function checkImages() {
    let totalErrors = 0;
    let totalMissing = 0;

    console.log('Starting Image Validation...');

    DATA_FILES.forEach(filename => {
        const filePath = path.join(DATA_DIR, filename);
        if (!fs.existsSync(filePath)) {
            console.warn(`Skipping ${filename} (not found)`);
            return;
        }

        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            let fileErrors = 0;
            let fileMissing = 0;

            console.log(`\nChecking ${filename} (${data.length} items)...`);

            data.forEach((item: any) => {
                if (!item.image) return;

                // Check if it's a local path
                if (item.image.startsWith('/images/')) {
                    const localPath = path.join(PUBLIC_DIR, item.image);
                    if (!fs.existsSync(localPath)) {
                        console.error(`[MISSING] ${filename} | ${item.title} (${item.id}): ${item.image}`);
                        fileMissing++;
                    }
                } else if (item.image.startsWith('http')) {
                    // Optional: Warning for non-local images if strict mode
                    // console.warn(`[EXTERNAL] ${filename} | ${item.title}: ${item.image}`);
                }
            });

            if (fileMissing > 0) {
                console.log(`  -> ${fileMissing} missing local images.`);
            } else {
                console.log(`  -> All local images exist.`);
            }

            totalMissing += fileMissing;

        } catch (e) {
            console.error(`Error reading ${filename}:`, e);
            totalErrors++;
        }
    });

    console.log('\nValidation Complete.');
    console.log(`Total Missing Images: ${totalMissing}`);
    console.log(`Total Read Errors: ${totalErrors}`);

    if (totalMissing > 0 || totalErrors > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

checkImages();
