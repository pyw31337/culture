
import path from 'path';
import fs from 'fs';

// Helper to check if performance is effectively expired (End Date < Today)
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
        else {
            targetDate = new Date(dateStr);
        }

        if (!targetDate || isNaN(targetDate.getTime())) return true;

        return targetDate.getTime() >= today.getTime();

    } catch (e) {
        return true;
    }
}

function loadJson(filename: string) {
    try {
        const filePath = path.resolve(process.cwd(), 'src/data', filename);
        const data = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        console.log(`Failed to load ${filename}`);
        return [];
    }
}

async function verify() {
    console.log('--- STARTING VERIFICATION ---');

    const interpark = loadJson('interpark.json');
    const kovo = loadJson('kovo.json');
    const kbl = loadJson('kbl.json');
    const festivals = loadJson('festivals.json');
    const yes24 = loadJson('yes24.json');
    const timeticket = loadJson('timeticket.json');
    const movies = loadJson('movies.json');
    const travels = loadJson('travel.json');

    console.log(`Loaded Counts:
    Interpark: ${interpark.length}
    KOVO: ${kovo.length}
    KBL: ${kbl.length}
    Festivals: ${festivals.length}
    Yes24: ${yes24.length}
    TimeTicket: ${timeticket.length}
    Movies: ${movies.length}
    Travels: ${travels.length}
    `);

    const allPerformances = [
        ...interpark,
        ...yes24,
        ...timeticket,
        ...festivals,
        ...kovo,
        ...kbl,
        ...movies,
        ...travels
    ].map(p => ({
        ...p,
        id: String(p.id)
    }));

    console.log(`Total Aggregated: ${allPerformances.length}`);

    const now = new Date(); // Represents Build Time
    console.log(`Build Time (Now): ${now.toISOString()}`);

    const validRegions = ['seoul', 'gyeonggi', 'incheon'];
    const BLOCKLIST = ['블루마린 스쿠버 다이브', '광주 조선대학교 해오름관'];

    const filtered = allPerformances.filter(p => {
        if (p.genre === 'movie' || p.genre === 'travel') return true;

        if (!isPerformanceActive(p.date, now)) return false;
        if (!validRegions.includes(p.region)) return false;
        if (p.venue === '예매하기') return false;
        if (BLOCKLIST.some(b => p.venue.includes(b))) return false;
        return true;
    });

    console.log(`After Filtering: ${filtered.length}`);

    // Group by source (heuristic using ID)
    const breakdown: Record<string, number> = {};
    filtered.forEach((p: any) => {
        const prefix = p.id.split('_')[0];
        breakdown[prefix] = (breakdown[prefix] || 0) + 1;
    });

    console.log('Breakdown by Source (Post-Filter):', breakdown);

    if (filtered.length === 0) {
        console.error('CRITICAL: All items filtered out!');
    } else {
        console.log('SUCCESS: Items survived filtering.');
        console.log('Sample Item:', filtered[0]);
    }
}

verify();
