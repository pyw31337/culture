import * as fs from 'fs';
import * as path from 'path';

const MOCHACLASS_PATH = path.resolve(process.cwd(), 'src/data/mochaclass.json');

function restoreMochaVenues() {
    if (!fs.existsSync(MOCHACLASS_PATH)) {
        console.log('No mochaclass.json found');
        return;
    }

    const data = JSON.parse(fs.readFileSync(MOCHACLASS_PATH, 'utf-8'));
    let updatedCount = 0;

    data.forEach((item: any) => {
        let district = '';

        // Extract District
        if (item.address && item.address.length > 2) {
            const match = item.address.match(/(\S+[구군])/); // Match Gu or Gun (non-whitespace)
            if (match) {
                district = match[1];
            } else {
                // Try words ending in Gu/Si from parts
                const parts = item.address.split(' ');
                for (const p of parts) {
                    if ((p.endsWith('구') || p.endsWith('군') || p.endsWith('시')) && p.length > 1 && !p.includes('서울') && !p.includes('경기')) {
                        district = p;
                        break;
                    }
                }
            }
        }

        // Apply new name if district found
        if (district) {
            // Update even if it has a name, to ensure consistency: 'Mocha Class (District)'
            // Use original title logic? User said "Mocha Class is a platform..."
            // So calling the venue "Mocha Class (District)" is appropriate.
            // But if it was "Leak Detection", changing to "Mocha Class (Seodaemun)" is better.
            item.venue = `모카클래스 (${district})`;
            updatedCount++;
        } else if (item.venue === '모카클래스' || !item.venue) {
            // If still generic and no district, keep generic or mark unknown?
            // "서울" -> "Mocha Class (Seoul)"?
            if (item.address && item.address.includes('서울')) {
                item.venue = '모카클래스 (서울)';
                updatedCount++;
            }
            // Else leave as is (likely '모카클래스' or empty)
        }
    });

    fs.writeFileSync(MOCHACLASS_PATH, JSON.stringify(data, null, 2));
    console.log(`Restored ${updatedCount} Mocha Class venue names.`);
}

restoreMochaVenues();
