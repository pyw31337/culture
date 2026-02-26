
import fs from 'fs';
import path from 'path';
import { getAllPerformances } from '../src/lib/performance-data';
import { sortPerformances } from '../src/lib/performance-filter';

// Helper to ensure directory exists
const ensureDirectoryExistence = (filePath: string) => {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
        return true;
    }
    ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
};

async function generate() {
    console.log('Generating static performance data...');
    try {
        const performances = await getAllPerformances();

        // [Data Quality Override]
        // Manual fixes for specific items requested by user
        performances.forEach(p => {
            // 1. Hardcode specific festival posters
            if (p.title.includes('양평빙송어축제')) {
                p.posterUrl = '/images/posters/festivals/yangpyeong_ice_trout.png';
            } else if (p.title.includes('온천천 빛 축제')) {
                p.posterUrl = '/images/posters/festivals/oncheoncheon_light.png';
            } else if (p.title.includes('포천백운계곡 동장군축제')) {
                p.posterUrl = '/images/posters/festivals/pocheon_dongjanggun.jpg';
            }

            // 2. Fix Category for National Dance Company 2026 Festival (it's a performance, not a festival)
            if (p.title.includes('국립무용단 [2026 축제]')) {
                p.category = 'NON_COMMERCIAL'; // Or 'MUSICAL' / 'PLAY' depending on mapping. 'NON_COMMERCIAL' often maps to '국악/무용' or similar. 
                // Let's assume we want it in 'Performing Arts' general bucket.
                // If the user said "It's a performance", we should ensure it's not 'FESTIVAL'.
                // If we check categories... 
                // Let's check what genres we have. '무용' (Dance) usually falls under specific types.
                p.genre = '무용';
            }
        });

        // Filter out expired performances
        // Use a safe buffer (e.g., allow items ending yesterday to show until today's build runs, but 1 month ago is definitely out)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let movieCount = 0;
        let ottCount = 0;
        let dateCount = 0;

        const activePerformances = performances.filter(p => {
            // 0. EXCLUDE Movies and OTT from this specific JSON 
            // because they are loaded separately in the frontend (movies.json, ott.json)
            // to avoid duplicates.
            if (p.genre === 'movie') {
                movieCount++;
                return false;
            }
            if (p.genre === 'ott') {
                ottCount++;
                return false;
            }

            if (!p.date) return false; // No date = active? No, safety first.

            try {
                let endDate: Date | null = null;
                const d = p.date.replace(/\./g, '-'); // Normalize dots to dashes for better parsing

                if (d.includes('~')) {
                    const parts = d.split('~');
                    let endStr = parts[1].trim();
                    // Clean up junk like "]" or " ("
                    endStr = endStr.split('[')[0].split('(')[0].trim();

                    // Handle "2026-01-04" or "26-01-04"
                    if (endStr.match(/^\d{2}-\d{2}-\d{2}$/)) {
                        endStr = '20' + endStr;
                    }

                    endDate = new Date(endStr);
                } else {
                    let endStr = d.trim();
                    endStr = endStr.split('[')[0].split('(')[0].trim();
                    if (endStr.match(/^\d{2}-\d{2}-\d{2}$/)) {
                        endStr = '20' + endStr;
                    }
                    endDate = new Date(endStr);
                }

                if (!endDate || isNaN(endDate.getTime())) {
                    return true;
                }

                // Set end date to end of day
                endDate.setHours(23, 59, 59, 999);
                const isActive = endDate >= today;
                if (!isActive) dateCount++;
                return isActive;

            } catch (e) {
                return true;
            }
        });

        console.log(`[Filtering Stats]`);
        console.log(`- Movies Filtered: ${movieCount}`);
        console.log(`- OTT Filtered: ${ottCount}`);
        console.log(`- Expired/Date Filtered: ${dateCount}`);

        console.log(`Filtered ${performances.length - activePerformances.length} items (Expired or Duplicate Type).`);

        // Sort by default (Date Ascending) to match previous API behavior
        const sorted = sortPerformances(activePerformances, 'all');

        const outputPath = path.join(process.cwd(), 'public', 'data', 'performances.json');

        // Ensure directory exists
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(outputPath, JSON.stringify(sorted));
        console.log(`Successfully generated ${sorted.length} items to ${outputPath}`);

        // [New: Sync critical data files to public/data]
        const dataDir = path.join(process.cwd(), 'src', 'data');
        const filesToSync = ['cinemas.json', 'movies.json', 'ott.json', 'venues.json'];

        filesToSync.forEach(filename => {
            const srcPath = path.join(dataDir, filename);
            const destPath = path.join(dir, filename);

            if (fs.existsSync(srcPath)) {
                fs.copyFileSync(srcPath, destPath);
                console.log(`Synced ${filename} to ${destPath}`);
            } else {
                console.warn(`Warning: ${filename} not found in src/data, skipping sync.`);
            }
        });

    } catch (error) {
        console.error('Error generating performance data:', error);
        process.exit(1);
    }
}

generate();
