
import path from 'path';
import fs from 'fs';
import { getAllPerformances } from '../src/lib/performance-data';

// Mock venues data import since we can't easily import JSON with 'assert' in tsx/node sometimes depending on config
// We'll read it manually to be safe or rely on the lib's internal logic if possible.
// Actually getAllPerformances already does the filtering! 
// So if we run getAllPerformances(), it returns the FILTERED list.

// We want to check:
// 1. Total items vs Filtered items (implied).
// 2. But we can't see what was filtered out unless we bypass the filter.
// Instead, let's load the data sources directly or just check the output file 'public/data/performances.json'
// and verify that NO item (except movie/ott) has missing geo data.

// Actually, `generate-performance-json.ts` uses getAllPerformances().
// So checking `public/data/performances.json` is the best validation of the FINAL output.

async function validate() {
    const jsonPath = path.resolve(process.cwd(), 'public/data/performances.json');
    if (!fs.existsSync(jsonPath)) {
        console.error('❌ performances.json not found. Run "npm run generate-data" first.');
        process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    console.log(`🔍 Validating ${data.length} items in performances.json...`);

    let passed = true;
    let errors = 0;
    let movieCount = 0;
    let ottCount = 0;
    let otherCount = 0;

    // We also need venues.json to check if the venue implies valid geo check
    const venuesPath = path.resolve(process.cwd(), 'src/data/venues.json');
    const venues = JSON.parse(fs.readFileSync(venuesPath, 'utf-8'));

    for (const item of data) {
        if (item.genre === 'movie') {
            movieCount++;
            continue;
        }
        if (item.genre === 'ott') {
            ottCount++;
            continue;
        }

        otherCount++;

        // For others, check venue geo
        // The item.venue is the key.
        const v = venues[item.venue];

        if (!v) {
            console.error(`❌ [${item.id}] Venue not found in dictionary: ${item.venue} (${item.title})`);
            passed = false;
            errors++;
            continue;
        }

        if (!v.lat || !v.lng || v.address === '정보 없음' || !v.address) {
            console.error(`❌ [${item.id}] Venue missing geo data: ${item.venue} (${item.title})`);
            passed = false;
            errors++;
        }
    }

    console.log('--- Stats ---');
    console.log(`Movie: ${movieCount}`);
    console.log(`OTT: ${ottCount}`);
    console.log(`Other (Location-based): ${otherCount}`);

    if (passed) {
        console.log('✅ Validation PASSED: All location-based content has valid geo data.');
    } else {
        console.error(`❌ Validation FAILED: Found ${errors} items with missing/invalid location data.`);
        process.exit(1);
    }
}

validate();
