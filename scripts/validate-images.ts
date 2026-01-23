
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const DATA_DIR = path.join(PROJECT_ROOT, 'src/data');
const PUBLIC_DIR = path.join(PROJECT_ROOT, 'public');

const filesToCheck = ['handball.json', 'kbl.json'];

interface GameData {
    id: string;
    homeTeamLogo: string;
    awayTeamLogo: string;
    [key: string]: any; // Allow other properties
}

function checkImages() {
    let hasErrors = false;

    for (const file of filesToCheck) {
        const filePath = path.join(DATA_DIR, file);
        if (!fs.existsSync(filePath)) {
            console.error(`File not found: ${filePath}`);
            continue;
        }

        console.log(`Checking ${file}...`);
        const data: GameData[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

        data.forEach((item, index) => {
            const logos = [item.homeTeamLogo, item.awayTeamLogo];

            logos.forEach(logo => {
                if (!logo) return;

                // Skip external URLs
                if (logo.startsWith('http')) {
                    console.log(`[SKIP] External URL: ${logo}`);
                    return;
                }

                // Remove /culture prefix if present to map to filesystem
                const relativePath = logo.startsWith('/culture') ? logo.replace('/culture', '') : logo;
                const fullPath = path.join(PUBLIC_DIR, relativePath);

                if (!fs.existsSync(fullPath)) {
                    console.error(`[MISSING] File: ${file}, Item Index: ${index}, ID: ${item.id}`);
                    console.error(`  - Image URL: ${logo}`);
                    console.error(`  - Expected Path: ${fullPath}`);
                    hasErrors = true;
                }
            });
        });
    }

    if (hasErrors) {
        console.error('\nValidation FAILED: Missing images found.');
        process.exit(1);
    } else {
        console.log('\nValidation PASSED: All images exist.');
    }
}

checkImages();
