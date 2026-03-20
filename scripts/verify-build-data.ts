import fs from 'fs';
import path from 'path';

// MOCK DATA LOADING
const loadJSON = (filename: string) => {
    try {
        const raw = fs.readFileSync(path.resolve(`src/data/${filename}`), 'utf-8');
        return JSON.parse(raw);
    } catch (e) {
        console.error(`Failed to load ${filename}`, e);
        return [];
    }
};

const ottData = loadJSON('ott.json');
const venuesData = loadJSON('venues.json');

// MOCK CONSTANTS
const validRegions = ['seoul', 'gyeonggi', 'incheon', 'etc', 'ott'];
const BLOCKLIST = ['블루마린 스쿠버 다이브', '광주 조선대학교 해오름관'];

// MOCK PAGE.TSX LOGIC
function testGetPerformances(genreFilter: string) {
    console.log(`[Test] Testing getPerformances for genre: ${genreFilter}`);
    console.log(`[Test] Loaded ${ottData.length} OTT items.`);

    // 1. Map and Default Venue
    const allPerformances = [
        ...ottData,
        // ... (other data omitted for this specific test)
    ].map((p: any) => ({
        ...p,
        venue: p.venue || 'Online',
        id: String(p.id)
    }));

    const now = new Date();

    // 2. Filter Function
    const filtered = allPerformances.filter((p: any) => {
        // Line 125 Exemption
        if (p.genre === 'movie' || p.genre === 'travel' || p.genre === 'kids' || p.genre === 'class' || p.genre === 'ott') {
            // console.log(`[Test] Keeping excluded genre item: ${p.title}`);
            return true;
        }

        // ... Standard checks (which should be skipped) ...
        if (!validRegions.includes(p.region)) {
            console.log(`[Test] Dropped by region: ${p.title} (${p.region})`);
            return false;
        }

        return true;
    });

    console.log(`[Test] Post-Exemption Filter Count: ${filtered.length}`);

    // 3. Genre Filter
    let genreFiltered = filtered;
    if (genreFilter && genreFilter !== 'all') {
        genreFiltered = filtered.filter((p: any) => p.genre === genreFilter);
    }

    console.log(`[Test] Post-Genre Filter Count: ${genreFiltered.length}`);

    // 4. Print Sample
    if (genreFiltered.length > 0) {
        console.log('[Test] Success! Sample item:', genreFiltered[0]);
    } else {
        console.error('[Test] FAILURE: No items returned!');
    }
}

testGetPerformances('ott');
