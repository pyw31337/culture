
import fs from 'fs';
import path from 'path';

// --- Configuration ---
const DATA_DIR = path.join(process.cwd(), 'src/data');
const REGIONS = ['seoul', 'gyeonggi', 'incheon', 'busan', 'daegu', 'gwangju', 'etc'];

// --- Helper Functions ---
function safeArray(data: any): any[] {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.performances)) return data.performances;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
}

// Replicate page.tsx isPerformanceActive
function isPerformanceActive(dateStr: string, today: Date): boolean {
    if (!dateStr) return false;
    try {
        let targetDate: Date | null = null;
        if (dateStr.includes('~')) {
            const parts = dateStr.split('~');
            const endStr = parts[1].trim();
            const [y, m, d] = endStr.split('.').map(Number);
            targetDate = new Date(y, m - 1, d);
            targetDate.setHours(23, 59, 59, 999);
        } else if (dateStr.includes('-') && dateStr.includes(':')) {
            const [datePart] = dateStr.split(' ');
            const [y, m, d] = datePart.split('-').map(Number);
            targetDate = new Date(y, m - 1, d);
            targetDate.setHours(23, 59, 59, 999);
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const [y, m, d] = dateStr.split('-').map(Number);
            targetDate = new Date(y, m - 1, d);
            targetDate.setHours(23, 59, 59, 999);
        } else {
            targetDate = new Date(dateStr);
            if (targetDate && !isNaN(targetDate.getTime())) {
                targetDate.setHours(23, 59, 59, 999);
            }
        }
        if (!targetDate || isNaN(targetDate.getTime())) return true;
        return targetDate.getTime() >= today.getTime();
    } catch (e) {
        return true;
    }
}

// Load Venues
const venuesRaw = fs.readFileSync(path.join(DATA_DIR, 'venues.json'), 'utf8');
const venues = JSON.parse(venuesRaw);

// --- Main Analysis ---
const SOURCES = [
    { name: 'interpark.json', genre: 'musical' }, // Mixed genres actually
    { name: 'festivals.json', genre: 'festival' },
    { name: 'kbo.json', genre: 'baseball' },
    { name: 'kbl.json', genre: 'basketball' },
    { name: 'kovo.json', genre: 'volleyball' },
    { name: 'handball.json', genre: 'handball' },
    { name: 'movies.json', genre: 'movie' },
    { name: 'timeticket.json', genre: 'play' }, // Mixed
    { name: 'seoul-culture.json', genre: 'exhibition' }, // Mixed
    { name: 'ott.json', genre: 'ott' },
    { name: 'yes24.json', genre: 'musical' }, // Mixed
    { name: 'travel.json', genre: 'travel' },
    { name: 'myrealtrip-kids.json', genre: 'kids' },
    { name: 'sssd-class.json', genre: 'class' },
    { name: 'umclass.json', genre: 'class' },
    { name: 'mochaclass.json', genre: 'class' },
    { name: 'mommom.json', genre: 'kids' },
    { name: 'museum.json', genre: 'museum' },
    { name: 'soccer.json', genre: 'soccer' },
];

const now = new Date(); // Use current time
const BLOCKLIST = ['블루마린 스쿠버 다이브', '광주 조선대학교 해오름관'];

const results: any[] = [];

SOURCES.forEach(source => {
    try {
        const filePath = path.join(DATA_DIR, source.name);
        if (!fs.existsSync(filePath)) {
            results.push({ source: source.name, collected: 0, displayed: 0, note: 'File not found' });
            return;
        }

        const rawData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const items = safeArray(rawData);
        const collectedCount = items.length;

        // Apply Server-Side Filters (page.tsx)
        const displayedItems = items.filter((p: any) => {
            // Mock some missing fields if necessary, or rely on raw data structure
            // Note: Some JSONs might have different field names before aggregation in page.tsx
            // e.g., seoul-culture uses 'place' instead of 'venue'. 
            // We need to handle this mapping if we want accuracy.

            let genre = p.genre || source.genre;
            let venue = p.venue;
            let region = p.region;
            let date = p.date;

            // Mapping logic from page.tsx (Aggregation Step)
            if (source.name === 'seoul-culture.json') {
                venue = p.place;
                region = 'seoul';
                // date is p.date
            }
            if (source.name === 'ott.json') {
                venue = 'OTT';
            }

            // --- Filter Logic ---

            // 1. Exempt Genres
            if (['movie', 'travel', 'kids', 'class', 'ott', 'museum', 'leisure', 'hotdeal'].includes(genre)) return true;

            // 2. Date Filter
            if (!isPerformanceActive(date, now)) return false;

            // 3. Sports Region
            if (['volleyball', 'basketball', 'baseball', 'handball'].includes(genre)) {
                if (!['seoul', 'gyeonggi', 'incheon', 'busan', 'daegu', 'gwangju', 'etc'].includes(region)) return false;
            }

            // 4. Region Validity
            if (!REGIONS.includes(region)) return false;

            // 5. Venue Checks
            if (venue === '예매하기') return false;
            if (/^\d{1,2}\.\d{1,2}/.test(venue)) return false;

            // 6. Address Filter (Capital Area Only)
            if (venues[venue]) {
                const addr = venues[venue].address;
                if (addr && addr !== '정보 없음') {
                    const isServiceArea = addr.startsWith('서울') || addr.startsWith('경기') || addr.startsWith('인천');
                    if (!isServiceArea) return false;
                }
            }

            // 7. Blocklist
            if (BLOCKLIST.some(b => venue && venue.includes(b))) return false;

            return true;
        });

        // --- Apply Frontend OTT Filter (PerformanceList.tsx) ---
        let finalDisplayed = displayedItems;
        if (source.name === 'ott.json' || source.genre === 'ott') {
            finalDisplayed = displayedItems.filter((p: any) => {
                // [Same logic as PerformanceList.tsx]
                if (p.id === 'debug_fail') return true; // Just in case

                const country = p.productionCountry ? p.productionCountry.replace(/\s+/g, '') : '';
                const denylist = ['중국', 'China', '태국', 'Thailand', '인도', 'India', '브라질', 'Brazil'];
                if (denylist.some(c => country.includes(c))) return false;

                const allowlist = ['한국', '대한민국', '일본', '미국', 'UnitedStates'];
                if (allowlist.some(c => country.includes(c))) return true;

                const titleHasSeason = p.title.includes('시즌') || p.title.toLowerCase().includes('season');
                const isDrama = p.subGenre === '드라마';

                if (titleHasSeason || isDrama) return false;
                return true;
            });
        }


        results.push({
            source: source.name,
            collected: collectedCount,
            displayed: finalDisplayed.length
        });

    } catch (e: any) {
        results.push({ source: source.name, error: e.message });
    }
});

console.table(results);
