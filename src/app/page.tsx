import { fetchPerformances } from '@/lib/interpark';
import PerformanceList from '@/components/PerformanceList';

import kovoData from '@/data/kovo.json';
import kblData from '@/data/kbl.json';
import travelData from '@/data/travel.json';

// Festival data - will be empty array if file doesn't exist yet
let festivalData: any[] = [];
try {
    festivalData = require('@/data/festivals.json');
} catch (e) {
    console.log('No festivals.json found, using empty array');
}

// Yes24 Exclusive data
let yes24Data: any[] = [];
try {
    yes24Data = require('@/data/yes24.json');
} catch (e) {
    console.log('No yes24.json found, using empty array');
}

// TimeTicket data
let timeticketData: any[] = [];
try {
    timeticketData = require('@/data/timeticket.json');
} catch (e) {
    console.log('No timeticket.json found, using empty array');
}

// Movie data
let movieData: any[] = [];
try {
    movieData = require('@/data/movies.json');
} catch (e) {
    console.log('No movies.json found, using empty array');
}

// Helper to check if performance is effectively expired (End Date < Today)
function isPerformanceActive(dateStr: string, today: Date): boolean {
    if (!dateStr) return false;

    try {
        let targetDate: Date | null = null;

        // Type 1: Range "YYYY.MM.DD ~ YYYY.MM.DD"
        if (dateStr.includes('~')) {
            const parts = dateStr.split('~');
            const endStr = parts[1].trim(); // "2025.12.31"
            // Replace dots with dashes for parsing if needed, or simple parse
            // YYYY.MM.DD is standard enough for new Date() in many envs but safely:
            const [y, m, d] = endStr.split('.').map(Number);
            targetDate = new Date(y, m - 1, d);
            targetDate.setHours(23, 59, 59, 999); // End of that day
        }
        // Type 2: Single "YYYY-MM-DD HH:mm" (KOVO style)
        else if (dateStr.includes('-') && dateStr.includes(':')) {
            // "2025-12-10 19:00"
            const [datePart] = dateStr.split(' ');
            const [y, m, d] = datePart.split('-').map(Number);
            targetDate = new Date(y, m - 1, d);
            targetDate.setHours(23, 59, 59, 999); // End of that day (keep active if it's today)
        }
        // Fallback for other single dates if any? 
        else {
            // Try generic parse
            targetDate = new Date(dateStr);
        }

        if (!targetDate || isNaN(targetDate.getTime())) return true; // Keep if unparseable

        // Check if targetDate is strictly before today (start of today)
        // actually user said: "if today date has passed" -> if EndDate < Today (Date only comparison)

        // Let's normalize "today" to start of day for strict comparison?
        // Or generic: if TargetDate (End of Day) < Now -> Expired.

        // If Today is Dec 10, Now is Dec 10 10:00.
        // Event Dec 9 (End Dec 9 23:59) < Now -> Expired. 
        // Event Dec 10 (End Dec 10 23:59) > Now -> Active.

        return targetDate.getTime() >= today.getTime();

    } catch (e) {
        return true; // Fail safe
    }
}

// This function runs at build time on the server (or revalidation)
async function getPerformances() {
    const [seoul, gyeonggi, incheon] = await Promise.all([
        fetchPerformances('seoul'),
        fetchPerformances('gyeonggi'),
        fetchPerformances('incheon'),
    ]);

    // Format KOVO data to match Performance interface if specific fields missing/need adjustment?
    // It already matches since we used the interface in the scraper script.
    // However, JSON import might be typed as any or inferred.
    const volleyball = kovoData as unknown as any[];
    const basketball = kblData as unknown as any[];
    const festivals = festivalData as unknown as any[];
    const yes24 = yes24Data as unknown as any[];
    const timeticket = timeticketData as unknown as any[];
    const movies = movieData as unknown as any[];
    const travels = travelData as unknown as any[];

    // Aggregate Data
    const allPerformances = [
        ...seoul,
        ...gyeonggi,
        ...incheon,
        ...yes24,
        ...timeticket,
        ...festivals,
        ...volleyball, // KOVO
        ...basketball, // KBL
        ...movies,   // Movies
        ...travels // Travel
    ].map(p => ({
        ...p,
        // Ensure ID is string
        id: String(p.id)
    }));

    // Filter expired
    // We use a fixed "now" for static build. 
    // In a real ISR/SSR scenario this would be request time, but for SSG it's build time.
    // If the user wants it to effectively update, they need to rebuild daily or use ISR.
    // We'll calculate 'today' relative to build time.
    const now = new Date();
    // Reset to start of today? User said "if today has passed", usually implies "Yesterday is gone".
    // If today is Dec 10, Dec 9 is gone. Dec 10 is active.
    // So distinct comparison: EndDate < Today(00:00:00).
    // Wait, my `targetDate` is set to 23:59:59.
    // So if I compare Target(Dec 9 23:59) < Now(Dec 10 09:00), it expires. Correct.
    // If Target(Dec 10 23:59) > Now(Dec 10 09:00), it stays. Correct.

    // Strict filter for Sports (Volleyball/Basketball): Must be in 'seoul', 'gyeonggi', 'incheon'
    // Also exclude generic '예매하기' venue name which indicates a parsing error or placeholder
    const validRegions = ['seoul', 'gyeonggi', 'incheon'];

    // 3. Bad Data / Blocklist Check
    const BLOCKLIST = ['블루마린 스쿠버 다이브', '광주 조선대학교 해오름관'];

    const filtered = allPerformances.filter(p => {
        // Movies & Travel: Always show regardless of region/date logic (handle internally or assume active)
        if (p.genre === 'movie' || p.genre === 'travel') return true;

        if (!isPerformanceActive(p.date, now)) return false;
        if (!validRegions.includes(p.region)) return false;
        if (p.venue === '예매하기') return false;
        if (BLOCKLIST.some(b => p.venue.includes(b))) return false;
        return true;
    });

    // 4. Deduplication Logic (Normalize Title & Prioritize Price)
    const uniqueMap = new Map<string, any>();

    filtered.forEach(p => {
        // Normalize title: remove spaces, special chars, lowercase
        let key = p.title.replace(/[\s\(\)\[\]\-\_\!\~\.\,]/g, '').toLowerCase();

        // Exception for Travel: Include Date in key to allow same title with different dates
        if (p.genre === 'travel') {
            key += `_${p.date}`;
        }

        if (uniqueMap.has(key)) {
            const existing = uniqueMap.get(key);
            // Prioritize the one with price/discount info
            if (!existing.price && p.price) {
                uniqueMap.set(key, p);
            }
            // If both have price (unlikely for now) or neither, keep existing or overwrite?
            // TimeTicket usually comes last in spread, so later items might be TimeTicket.
            // If existing is TimeTicket (has price), keep it.
            // If new is TimeTicket (has price), take it (covered by if above).
        } else {
            uniqueMap.set(key, p);
        }
    });

    return Array.from(uniqueMap.values());
}

export default async function Home() {
    const performances = await getPerformances();

    // Generate current time in KST (Korean Standard Time)
    const now = new Date();
    // Timezone offset for KST is UTC+9. 
    // However, build environment might be UTC. 
    // Reliable way:
    const formatter = new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'short',
        hour12: false
    });

    // Default format might be "2024. 12. 10. (수) 13:45" or similar depending on Node version.
    // Let's customize it to ensure exact format: YYYY. MM. DD. (Day) HH:mm 기준
    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value;

    const year = getPart('year');
    const month = getPart('month');
    const day = getPart('day');
    const weekday = getPart('weekday'); // "수"
    const hour = getPart('hour');
    const minute = getPart('minute');

    const lastUpdated = `${year}.${month}.${day}.(${weekday}) ${hour}:${minute} `;

    return (
        <main className="min-h-screen bg-gray-900 pb-20">
            <PerformanceList initialPerformances={performances} lastUpdated={lastUpdated} />
        </main>
    );
}
