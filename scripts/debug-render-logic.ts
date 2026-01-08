import fs from 'fs';
import path from 'path';

// Mock venues
const venues: any = {};

function simulateRender() {
    console.log('Simulating Client-Side DATA FILTERING Logic...');

    // Load data manually to avoid ESM/JSON import issues
    const ottRaw = fs.readFileSync(path.resolve('src/data/ott.json'), 'utf-8');
    const ottData = JSON.parse(ottRaw);

    // Simulate page.tsx transformation
    const items = ottData.map((p: any) => ({
        ...p,
        venue: p.venue || 'Online',
        id: String(p.id)
    }));

    console.log(`Loaded ${items.length} OTT items from JSON.`);

    // --- CLIENT SIDE FILTERING SIMULATION ---
    // Mimic the exact logic in PerformanceList.tsx

    let filtered = items;

    // 1. GENRE FILTER (Simulate selecting 'ott')
    const selectedGenre: string = 'ott';
    console.log(`[Filter] Genre selected: ${selectedGenre}`);
    if (selectedGenre !== 'all') {
        filtered = filtered.filter((p: any) => p.genre === selectedGenre);
    }
    console.log(`[Filter] After Genre Check: ${filtered.length}`);

    // 2. REGION FILTER (Simulate selecting 'all' or 'ott')
    // In PerformanceList.tsx, logic is:
    /*
        if (selectedRegion !== 'all') {
            filtered = filtered.filter(p => {
                if (p.region === selectedRegion) return true;
                // ... venue checks ...
            });
        }
    */

    // TEST CASE A: selectedRegion = 'all' (Default)
    // Should return all items.

    // TEST CASE B: selectedRegion = 'ott' (User clicked OTT pill?)
    // Wait, does the OTT page invoke handleRegionSelect('ott')?

    // Let's verify what happens if selectedRegion is 'all' (default state)
    // If it's 'all', no region filtering happens.

    // 3. VENUE FILTER
    // selectedVenue = 'all'

    console.log(`[Filter] Final Count with defaults (Genre=ott, Region=all): ${filtered.length}`);

    if (filtered.length > 0) {
        console.log('First item:', filtered[0]);
    } else {
        console.error('ALL ITEMS FILTERED OUT by basic logic!');
    }
}

simulateRender();
