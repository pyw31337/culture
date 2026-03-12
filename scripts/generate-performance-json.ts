
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

            // 2. Fix Category for National Dance Company 2026 Festival
            if (p.title.includes('국립무용단 [2026 축제]')) {
                p.genre = '무용';
            }
        });

        // Overseas Filtering Logic (User Request)
        const KR_LAT_MIN = 33.0;
        const KR_LAT_MAX = 43.0;
        const KR_LNG_MIN = 124.0;
        const KR_LNG_MAX = 132.0;

        const isOverseas = (p: any) => {
            // 1. Specific title exclusion
            if (p.title.includes('일본 스페이스 일일캠프') || p.title.includes('JAXA츠크바우주센터')) return true;

            // 2. Address keywords
            const overseasKeywords = ['일본', '미국', '중국', '유럽', 'France', 'USA', 'Japan', 'China', '츠쿠바역'];
            if (overseasKeywords.some(kw => p.address?.includes(kw) || p.venue?.includes(kw))) return true;

            // 3. Coordinate check (if available)
            // Note: coordinates come from venues.json usually via p.venue mapping
            // In generate-performance-json, we have 'performances' array.
            // Let's check coordinates if they exist on the performance object (some sources have them)
            if (p.lat && p.lng) {
                if (p.lat < KR_LAT_MIN || p.lat > KR_LAT_MAX || p.lng < KR_LNG_MIN || p.lng > KR_LNG_MAX) return true;
            }

            return false;
        };

        // Filter out expired performances
        // Use a safe buffer (e.g., allow items ending yesterday to show until today's build runs, but 1 month ago is definitely out)
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let movieCount = 0;
        let ottCount = 0;
        let dateCount = 0;

        const activePerformances = performances.filter(p => {
            // 0. EXCLUDE OTT from this specific JSON 
            // because they are loaded separately in the frontend (ott.json)
            // to avoid duplicates.
            if (p.genre === 'ott') {
                ottCount++;
                return false;
            }

            // Exclude Overseas Content
            if (isOverseas(p)) return false;

            if (!p.date || p.date.trim() === '') return true; // Treat as active if no date (Museums/Activities)

            try {
                let endDate: Date | null = null;
                const d = p.date.replace(/\./g, '-'); // Normalize dots to dashes for better parsing

                if (d.includes('~')) {
                    const parts = d.split('~');
                    if (parts.length >= 2) {
                        let endStr = parts[1].trim();
                        // Clean up junk like "]" or " ("
                        endStr = endStr.split('[')[0].split('(')[0].trim();

                        // Handle "2026-01-04" or "26-01-04"
                        if (endStr.match(/^\d{2}-\d{2}-\d{2}$/)) {
                            endStr = '20' + endStr;
                        }

                        // Robust parsing for YYYYMMDD
                        if (endStr.match(/^\d{8}$/)) {
                            const y = parseInt(endStr.substring(0, 4));
                            const m = parseInt(endStr.substring(4, 6));
                            const dParts = parseInt(endStr.substring(6, 8));
                            endDate = new Date(y, m - 1, dParts);
                        } else {
                            endDate = new Date(endStr);
                        }
                    }
                } else if (d.trim() !== '') {
                    let endStr = d.trim();
                    endStr = endStr.split('[')[0].split('(')[0].trim();
                    if (endStr.match(/^\d{2}-\d{2}-\d{2}$/)) {
                        endStr = '20' + endStr;
                    }

                    if (endStr.match(/^\d{8}$/)) {
                        const y = parseInt(endStr.substring(0, 4));
                        const m = parseInt(endStr.substring(4, 6));
                        const dParts = parseInt(endStr.substring(6, 8));
                        endDate = new Date(y, m - 1, dParts);
                    } else {
                        endDate = new Date(endStr);
                    }
                }

                if (!endDate || isNaN(endDate.getTime())) {
                    return true;
                }

                // Set end date to end of day
                endDate.setHours(23, 59, 59, 999);
                // Bypass date check for movies
                if (p.genre === 'movie') return true;

                const isActive = endDate >= today;
                if (!isActive) {
                    dateCount++;
                    if (p.source === 'museum') console.log(`[DEBUG] Museum ${p.title} filtered by date: ${p.date} (EndDate: ${endDate.toISOString()})`);
                }
                return isActive;

            } catch (e) {
                if (p.source === 'museum') console.log(`[DEBUG] Museum ${p.title} error in date parsing:`, e);
                return true;
            }
        });

        if (performances.some(p => p.source === 'museum')) {
             const museumRemained = activePerformances.filter(p => p.source === 'museum').length;
             console.log(`[DEBUG] Museum Items: Total ${performances.filter(p => p.source === 'museum').length}, Remaining After Filter: ${museumRemained}`);
        }

        console.log(`[Filtering Stats]`);
        console.log(`- Movies Filtered: ${movieCount}`);
        console.log(`- OTT Filtered: ${ottCount}`);
        console.log(`- Expired/Date Filtered: ${dateCount}`);

        console.log(`Filtered ${performances.length - activePerformances.length} items (Expired or Duplicate Type).`);

        // Sort by default (Date Ascending) to match previous API behavior
        const sorted = sortPerformances(activePerformances, 'all');

        // [New: Data Pruning for payload optimization]
        const pruned = sorted.map((p: any) => {
            const { posterUrl, description, ...rest } = p;
            // Also prune empty arrays/objects to save bytes
            if (Array.isArray(rest.cast) && rest.cast.length === 0) delete rest.cast;
            if (Array.isArray(rest.platforms) && rest.platforms.length === 0) delete rest.platforms;
            rest.source = p.source; // Keep the source for statistics
            return rest;
        });

        const outputPath = path.join(process.cwd(), 'public', 'data', 'performances.json');

        // Ensure directory exists
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(outputPath, JSON.stringify(pruned));
        console.log(`Successfully generated ${pruned.length} items to ${outputPath}`);

        // [New: Sync critical data files to public/data]
        const dataDir = path.join(process.cwd(), 'src', 'data');
        const filesToSync = ['cinemas.json', 'movies.json', 'ott.json', 'venues.json'];

        filesToSync.forEach(filename => {
            const srcPath = path.join(dataDir, filename);
            const destPath = path.join(dir, filename);

            if (fs.existsSync(srcPath)) {
                if (filename === 'venues.json') {
                    // Smart Pruning for venues.json
                    const venues = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
                    const usedVenueNames = new Set(pruned.map(p => p.venue));
                    const prunedVenues: Record<string, any> = {};

                    Object.entries(venues).forEach(([key, v]: [string, any]) => {
                        if (usedVenueNames.has(key)) {
                            const { name, ...rest } = v;
                            // Only keep name if it differs from the key
                            if (name && name !== key) {
                                rest.name = name;
                            }
                            prunedVenues[key] = rest;
                        }
                    });

                    fs.writeFileSync(destPath, JSON.stringify(prunedVenues));
                    console.log(`Optimized venues.json to ${destPath} (Kept ${Object.keys(prunedVenues).length}/${Object.keys(venues).length} used venues)`);
                } else {
                    fs.copyFileSync(srcPath, destPath);
                    console.log(`Synced ${filename} to ${destPath}`);
                }
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
