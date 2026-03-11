import fs from 'fs';
import path from 'path';

// This script ensures all unique venue names from all data sources are present in venues.json
// so that refine-kakao-coords.ts can find them and add coordinates.

const DATA_DIR = path.join(process.cwd(), 'src/data');
const VENUES_FILE = path.join(DATA_DIR, 'venues.json');

const SOURCES = [
    'interpark.json',
    'kovo.json',
    'kbl.json',
    'kbo.json',
    'festivals.json',
    'timeticket.json',
    'myrealtrip-kids.json',
    'sssd-class.json',
    'handball.json',
    'kleague.json',
    'umclass.json',
    'seoul-culture.json',
    'culture-portal.json',
    'mochaclass.json',
    'mommom.json',
    'mommom-activities.json',
    'mommom-products.json',
    'museum.json',
    'kopis-performances.json'
];

async function sync() {
    console.log('🔄 Synchronizing venue names from all sources...');
    
    let venues: Record<string, any> = {};
    if (fs.existsSync(VENUES_FILE)) {
        venues = JSON.parse(fs.readFileSync(VENUES_FILE, 'utf8'));
    }

    const uniqueVenues = new Set<string>();

    for (const source of SOURCES) {
        const filePath = path.join(DATA_DIR, source);
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️ Source not found: ${source}`);
            continue;
        }

        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const items = Array.isArray(data) ? data : [];
            
            items.forEach((item: any) => {
                // venue logic matching transformPerformance
                let venueName = item.venue || item.place || (source === 'museum.json' ? item.title : '');
                if (!venueName) return;

                // Basic normalization (removing [Seoul] markers like in normalizeVenueName)
                venueName = venueName.replace(/\s*\[[가-힣]+\]/g, '').trim();
                
                if (venueName) {
                    uniqueVenues.add(venueName);
                }
            });
            console.log(`✅ Processed ${source} (${items.length} items)`);
        } catch (e) {
            console.error(`❌ Failed to process ${source}:`, e);
        }
    }

    console.log(`\nFound ${uniqueVenues.size} unique venue names across all sources.`);
    
    let addedCount = 0;
    for (const name of uniqueVenues) {
        if (!venues[name]) {
            venues[name] = {
                name: name,
                address: '정보 없음',
                district: '',
                lat: null,
                lng: null
            };
            addedCount++;
        }
    }

    if (addedCount > 0) {
        fs.writeFileSync(VENUES_FILE, JSON.stringify(venues, null, 2));
        console.log(`✨ Added ${addedCount} new venue names to venues.json.`);
    } else {
        console.log('ℹ️ No new venue names found.');
    }

    console.log('🚀 Ready for refine-kakao-coords.ts!');
}

sync();
