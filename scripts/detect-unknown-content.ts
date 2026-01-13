
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(__dirname, '../src/data');

const FILES_TO_CHECK = [
    'festivals.json',
    'interpark.json',
    'mochaclass.json',
    'sssd-class.json',
    'timeticket.json',
    'seoul-culture.json',
    'yes24.json',
    'travel.json',
    'movies.json',
    'ott.json'
];

interface Performance {
    title: string;
    genre: string;
    id: string;
}

function scanForUnknown() {
    console.log('--- Scanning for Unknown/Etc Content ---');
    let totalUnknown = 0;

    FILES_TO_CHECK.forEach(file => {
        const filePath = path.join(DATA_DIR, file);
        if (!fs.existsSync(filePath)) return;

        try {
            const data: Performance[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            const unknownItems = data.filter(item =>
                !item.genre ||
                item.genre.toLowerCase() === 'etc' ||
                item.genre.toLowerCase() === 'unknown' ||
                item.genre.trim() === ''
            );

            if (unknownItems.length > 0) {
                console.log(`\n📄 File: ${file} (${unknownItems.length} items)`);
                unknownItems.slice(0, 20).forEach(item => { // Limit output
                    console.log(` - [${item.genre || 'EMPTY'}] ${item.title} (ID: ${item.id})`);
                });
                if (unknownItems.length > 20) {
                    console.log(`   ... and ${unknownItems.length - 20} more`);
                }
                totalUnknown += unknownItems.length;
            }
        } catch (e) {
            console.error(`Error reading ${file}:`, e);
        }
    });

    console.log(`\nTotal Unknown Items Found: ${totalUnknown}`);
}

scanForUnknown();
