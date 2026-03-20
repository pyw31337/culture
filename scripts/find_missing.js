const fs = require('fs');
const path = require('path');

const VENUE_FILE = path.join(process.cwd(), 'src/data/venues.json');
const OUT_FILE = path.join(process.cwd(), 'missing_venues.txt');

try {
    const venues = JSON.parse(fs.readFileSync(VENUE_FILE, 'utf8'));
    const missing = [];

    // Check specific user example
    if (venues['AK아트홀']) {
        console.log('AK아트홀 found:', venues['AK아트홀']);
    } else {
        console.log('AK아트홀 NOT found in venues.json keys');
    }

    for (const key of Object.keys(venues)) {
        const v = venues[key];
        // Condition for "missing info"
        if (!v.address || v.address === '정보 없음' || !v.lat || !v.lng) {
            missing.push(v.name);
        }
    }

    console.log(`Found ${missing.length} missing venues.`);
    fs.writeFileSync(OUT_FILE, missing.join('\n'), 'utf8');
    console.log(`Wrote list to ${OUT_FILE}`);

} catch (e) {
    console.error('Error:', e);
}
