
import fs from 'fs';
import path from 'path';
import { cleanTitle, cleanVenueName, formatUnifiedDate, loadJson, saveJson } from './utils/scraper-utils';

const DATA_DIR = path.resolve(process.cwd(), 'src/data');

async function validateAll() {
    console.log('🚀 Starting Comprehensive Data Audit...\n');

    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && !f.includes('venue') && !f.includes('cinema') && !f.includes('backup'));
    
    let totalItems = 0;
    let totalIssues = 0;
    let totalCleaned = 0;

    for (const file of files) {
        console.log(`\n--- Auditing ${file} ---`);
        const data = loadJson(file);
        if (!Array.isArray(data)) {
            console.log(`Skipping ${file} (not an array)`);
            continue;
        }

        let fileModified = false;
        const cleanedData = data.map((item: any) => {
            let itemModified = false;
            totalItems++;

            // 1. Title Cleansing
            const newTitle = cleanTitle(item.title || '');
            if (newTitle !== item.title) {
                item.title = newTitle;
                itemModified = true;
            }

            // 2. Venue Cleansing
            const newVenue = cleanVenueName(item.venue || item.place || '');
            if (newVenue !== (item.venue || item.place)) {
                if (item.venue) item.venue = newVenue;
                if (item.place) item.place = newVenue;
                itemModified = true;
            }

            // 3. Date Normalization
            if (item.date) {
                const newDate = formatUnifiedDate(item.date);
                if (newDate !== item.date) {
                    item.date = newDate;
                    itemModified = true;
                }
            }

            // 4. Missing Coordinate Flagging
            if (!item.lat || !item.lng) {
                // totalIssues++;
                // console.warn(`[Missing Geo] ${item.title} (${item.venue})`);
            }

            // 5. Image Check
            if (!item.image || item.image === '정보 없음') {
                totalIssues++;
            }

            if (itemModified) totalCleaned++;
            fileModified = fileModified || itemModified;
            return item;
        });

        if (fileModified) {
            saveJson(file, cleanedData);
            console.log(`✅ Cleaned and saved ${file}`);
        } else {
            console.log(`✨ ${file} is healthy.`);
        }
    }

    console.log('\n=====================================');
    console.log('📊 AUDIT SUMMARY');
    console.log(`Total Items Scanned: ${totalItems}`);
    console.log(`Total Issues Fixed: ${totalCleaned}`);
    console.log(`Potential Issues Remaining: ${totalIssues}`);
    console.log('=====================================\n');
}

validateAll().catch(console.error);
