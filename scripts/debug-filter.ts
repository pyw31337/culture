
import path from 'path';
import fs from 'fs';

const load = (name: string) => {
    try {
        const p = path.join(__dirname, '../src/data', name);
        const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
        return Array.isArray(data) ? data : [];
    } catch (e: any) {
        console.log(`Failed to load ${name}: ${e.message}`);
        return [];
    }
}

// Logic from page.tsx
function isPerformanceActive(dateStr: string, today: Date): boolean {
    if (!dateStr) return false;

    try {
        let targetDate: Date | null = null;

        // Type 1: Range "YYYY.MM.DD ~ YYYY.MM.DD"
        if (dateStr.includes('~')) {
            const parts = dateStr.split('~');
            const endStr = parts[1].trim();
            const [y, m, d] = endStr.split('.').map(Number);
            targetDate = new Date(y, m - 1, d);
            targetDate.setHours(23, 59, 59, 999);
        }
        // Type 2: Single "YYYY-MM-DD HH:mm" (KOVO style)
        else if (dateStr.includes('-') && dateStr.includes(':')) {
            const [datePart] = dateStr.split(' ');
            const [y, m, d] = datePart.split('-').map(Number);
            targetDate = new Date(y, m - 1, d);
            targetDate.setHours(23, 59, 59, 999);
        }
        // Fallback
        else {
            targetDate = new Date(dateStr);
        }

        if (!targetDate || isNaN(targetDate.getTime())) return true; // Keep if unparseable

        return targetDate.getTime() >= today.getTime();

    } catch (e) {
        return true;
    }
}

const main = () => {
    const interpark = load('interpark.json');
    const timeticket = load('timeticket.json');
    const kovo = load('kovo.json');
    const kbl = load('kbl.json');
    const yes24 = load('yes24.json');
    const festivals = load('festivals.json');
    const movies = load('movies.json');
    const travel = load('travel.json');

    console.log('Loaded counts:');
    console.log('Interpark:', interpark.length);
    console.log('TimeTicket:', timeticket.length);
    console.log('KOVO:', kovo.length);
    console.log('KBL:', kbl.length);
    console.log('Yes24:', yes24.length);

    const allPerformances = [
        ...interpark,
        ...yes24,
        ...timeticket,
        ...festivals,
        ...kovo,
        ...kbl,
        ...movies,
        ...travel
    ].map(p => ({
        ...p,
        id: String(p.id)
    }));

    console.log('Total Raw:', allPerformances.length);

    const now = new Date();
    console.log('Current Time (Server):', now.toString());

    const validRegions = ['seoul', 'gyeonggi', 'incheon'];
    const BLOCKLIST = ['블루마린 스쿠버 다이브', '광주 조선대학교 해오름관'];

    let failActive = 0;
    let failRegion = 0;
    let failVenue = 0;
    let failBlock = 0;
    let passed = 0;

    const filtered = allPerformances.filter(p => {
        if (p.genre === 'movie' || p.genre === 'travel') {
            passed++;
            return true;
        }

        if (!isPerformanceActive(p.date, now)) {
            failActive++;
            // if (failActive <= 5) console.log('Expired:', p.title, p.date);
            return false;
        }
        if (!validRegions.includes(p.region)) {
            failRegion++;
            // if (failRegion <= 5) console.log('Bad Region:', p.title, p.region);
            return false;
        }
        if (p.venue === '예매하기') {
            failVenue++;
            return false;
        }
        if (BLOCKLIST.some(b => p.venue.includes(b))) {
            failBlock++;
            return false;
        }
        passed++;
        return true;
    });

    console.log('Filtering Stats:');
    console.log('Expired:', failActive);
    console.log('Bad Region:', failRegion);
    console.log('Bad Venue:', failVenue);
    console.log('Blocked:', failBlock);
    console.log('Passed Filter:', passed);
    console.log('Filtered Count:', filtered.length);

    // Deduplication
    const uniqueMap = new Map();
    filtered.forEach(p => {
        let key = p.title.replace(/[\s\(\)\[\]\-\_\!\~\.\,]/g, '').toLowerCase();
        if (p.genre === 'travel') {
            key += `_${p.date}`;
        }

        if (uniqueMap.has(key)) {
            const existing = uniqueMap.get(key);
            if (!existing.price && p.price) {
                uniqueMap.set(key, p);
            }
        } else {
            uniqueMap.set(key, p);
        }
    });

    console.log('Final Unique Count:', uniqueMap.size);

    // Sample output
    if (uniqueMap.size > 0) {
        console.log('First 5 items:');
        console.log(Array.from(uniqueMap.values()).slice(0, 5).map(p => `${p.title} (${p.genre}) - ${p.date}`));
    }
}

main();
