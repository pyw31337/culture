import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'src/data');

// List of critical files that MUST have data
// (Some files like festivals.json might legitimately be empty seasonally, but let's be strict for now or use a separate list)
const CRITICAL_FILES = [
    'interpark.json',
    'kovo.json',
    'kbl.json',
    'kbo.json',
    'handball.json',
    'hockey.json',
    'ott.json',
    'mochaclass.json',
    'sssd-class.json',
    'myrealtrip-kids.json',
    'seoul-culture.json',
    'timeticket.json',
    'movies.json'
];

// Optional: Define minimum thresholds
const EXCEPTION_THRESHOLDS: Record<string, number> = {
    'festivals.json': 0, // Can be empty
    'yes24.json': 0,     // Often low count
    'soomgo.json': 0,
    'travel.json': 0,
    'umclass.json': 0
};

async function validateData() {
    console.log('🔍 Starting Data Validation...');
    let hasError = false;

    // Get all JSON files in data dir
    const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json') && f !== 'venues.json');

    for (const file of files) {
        const filePath = path.join(DATA_DIR, file);
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const data = JSON.parse(content);

            if (!Array.isArray(data)) {
                console.error(`❌ [${file}] Invalid format: Root is not an array.`);
                hasError = true;
                continue;
            }

            const count = data.length;
            const threshold = EXCEPTION_THRESHOLDS[file] !== undefined ? EXCEPTION_THRESHOLDS[file] : 1;

            if (count < threshold) {
                console.error(`❌ [${file}] Data count too low: ${count} (Expected >= ${threshold})`);
                hasError = true;
            } else {
                console.log(`✅ [${file}] Valid: ${count} items`);
            }

        } catch (e) {
            console.error(`❌ [${file}] Error reading or parsing:`, e);
            hasError = true;
        }
    }

    if (hasError) {
        console.error('\n🚨 Validation Failed! Some data sources are empty or invalid.');
        process.exit(1); // Fail the job
    } else {
        console.log('\n✨ Validation Passed! All critical data sources look good.');
    }
}

validateData().catch(e => {
    console.error('Validation Script Error:', e);
    process.exit(1);
});
