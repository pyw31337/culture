
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { processImage } from './utils/image-processor';

const DATA_DIR = path.join(process.cwd(), 'src/data');
const PUBLIC_DIR = path.join(process.cwd(), 'public');

const TARGETS = [
    { file: 'ott.json', type: 'ott' },
    { file: 'movies.json', type: 'movie' }
];

async function validateImages() {
    console.log('Starting Image Validation...');
    let totalIssues = 0;

    for (const target of TARGETS) {
        const filePath = path.join(DATA_DIR, target.file);
        if (!fs.existsSync(filePath)) {
            console.warn(`File not found: ${target.file}`);
            continue;
        }

        console.log(`\nChecking ${target.file}...`);
        const items = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        let changed = false;

        for (const item of items) {
            // Check if item has a local image path
            if (item.image && item.image.startsWith('/images/posters/')) {
                const localPath = path.join(PUBLIC_DIR, item.image);

                if (!fs.existsSync(localPath)) {
                    console.log(`[Missing] ${item.title} -> ${item.image} not found.`);

                    // Attempt to recover if source poster URL is available
                    if (item.poster && item.poster.startsWith('http')) {
                        console.log(`   Attempting recovery from: ${item.poster}`);
                        try {
                            // Use stable filename logic matches the new scraper logic
                            const safeTitle = item.title.replace(/[^a-zA-Z0-9가-힣]/g, '');
                            const stableFilename = `${target.type}_${safeTitle}`;

                            const newPath = await processImage(item.poster, stableFilename);
                            if (newPath && newPath !== item.image) {
                                item.image = newPath;
                                changed = true;
                                console.log(`   -> Recovered: ${newPath}`);
                            } else if (!newPath) {
                                console.log(`   -> Recovery failed (download error).`);
                                item.image = ''; // Clear broken link
                                changed = true;
                            }
                        } catch (e) {
                            console.error(`   -> Recovery error:`, e);
                        }
                    } else {
                        console.log(`   -> No recovery source. Clearing image.`);
                        item.image = '';
                        changed = true;
                    }
                    totalIssues++;
                }
            }
        }

        if (changed) {
            console.log(`Saving updates to ${target.file}...`);
            fs.writeFileSync(filePath, JSON.stringify(items, null, 2));
        }
    }

    console.log(`\nValidation complete. Total issues found & addressed: ${totalIssues}`);
}

validateImages();
