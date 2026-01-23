import fs from 'fs';
import path from 'path';

const DATA_PATH = path.resolve(process.cwd(), 'src/data/mommom.json');

interface MomMomItem {
    id: string;
    title: string;
    description?: string;
    [key: string]: any;
}

function validateMomMom() {
    if (!fs.existsSync(DATA_PATH)) {
        console.error('mommom.json not found!');
        process.exit(1);
    }

    const data: MomMomItem[] = JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
    console.log(`Loaded ${data.length} items from mommom.json`);

    let missingDescription = 0;
    const targetId = 'mommom_청암민속박물관'; // Target item ID from earlier analysis
    let targetFound = false;

    data.forEach(item => {
        if (!item.description || item.description.length < 5) {
            missingDescription++;
        }
        if (item.id === targetId || item.link.includes('655ac8ff7befcfe324f22e26')) {
            targetFound = true;
            console.log(`\n[Target Item Check]: ${item.title}`);
            console.log(`- Description Present: ${!!item.description}`);
            if (item.description) {
                console.log(`- Content:\n${item.description}\n`);
                // Validation of specific fields requested by user
                if (!item.description.includes('[특징]')) console.warn('  [Warning] Missing [특징]');
                if (!item.description.includes('[대상]')) console.warn('  [Warning] Missing [대상]');
                if (!item.description.includes('[운영]')) console.warn('  [Warning] Missing [운영]');
            } else {
                console.error('  [Error] Description is missing!');
            }
        }
    });

    console.log(`\nValidation Summary:`);
    console.log(`- Total Items: ${data.length}`);
    console.log(`- Missing Description: ${missingDescription}`);

    if (targetFound) {
        console.log(`- Target Item found and checked.`);
    } else {
        console.error(`- Target Item (655ac8ff7befcfe324f22e26) NOT FOUND in data file!`);
    }

    if (missingDescription > data.length * 0.5) {
        console.warn(`\n[Warning] detailed description is missing for more than 50% of items.`);
    }
}

validateMomMom();
