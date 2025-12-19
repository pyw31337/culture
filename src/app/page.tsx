import { fetchPerformances } from '@/lib/interpark';
import PerformanceList from '@/components/PerformanceList';

import interparkData from '@/data/interpark.json';
import kovoData from '@/data/kovo.json';
import kblData from '@/data/kbl.json';
import travelData from '@/data/travel.json';
import festivalsData from '@/data/festivals.json';
import yes24Data from '@/data/yes24.json';
import timeticketData from '@/data/timeticket.json';
import moviesData from '@/data/movies.json';
import kidsData from '@/data/myrealtrip-kids.json';
import classData from '@/data/klook-class.json';

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
        // Fallback
        else {
            targetDate = new Date(dateStr);
        }

        if (!targetDate || isNaN(targetDate.getTime())) return true;

        return targetDate.getTime() >= today.getTime();

    } catch (e) {
        return true;
    }
}

// This function runs at build time on the server (or revalidation)
async function getPerformances() {
    const interpark = interparkData as unknown as any[];
    const volleyball = kovoData as unknown as any[];
    const basketball = kblData as unknown as any[];
    const festivals = festivalsData as unknown as any[];
    const yes24 = yes24Data as unknown as any[];
    const timeticket = timeticketData as unknown as any[];
    const movies = moviesData as unknown as any[];
    const travels = travelData as unknown as any[];
    const kids = kidsData as unknown as any[];
    const classes = classData as unknown as any[];

    // Aggregate Data
    const allPerformances = [
        ...interpark,
        ...yes24,
        ...timeticket,
        ...festivals,
        ...volleyball, // KOVO
        ...basketball, // KBL
        ...movies,   // Movies
        ...travels, // Travel
        ...kids,     // Kids (MyRealTrip)
        ...classes,  // Class (Klook)
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
    // Valid regions - Added 'etc' to allow showing items with mapped region 'etc'
    const validRegions = ['seoul', 'gyeonggi', 'incheon', 'etc'];

    // 3. Bad Data / Blocklist Check
    const BLOCKLIST = ['블루마린 스쿠버 다이브', '광주 조선대학교 해오름관'];

    const filtered = allPerformances.filter(p => {
        // Movies & Travel & Kids & Class: Always show regardless of region/date logic
        if (p.genre === 'movie' || p.genre === 'travel' || p.genre === 'kids' || p.genre === 'class') return true;

        if (!isPerformanceActive(p.date, now)) return false;

        // Sports (Volleyball/Basketball): Strict Region Filter (Seoul, Gyeonggi, Incheon only)
        if (p.genre === 'volleyball' || p.genre === 'basketball') {
            if (!['seoul', 'gyeonggi', 'incheon'].includes(p.region)) return false;
        }

        // Allow 'etc' but maybe we want to visualize it differently? 
        // For now, just allow it so the list isn't empty.
        if (!validRegions.includes(p.region)) return false;

        // Filter out bad venues
        if (p.venue === '예매하기') return false;
        // Check for venue names that are actually dates (e.g., "12.18(목) 19:00") - Parsing Error Cleaning
        if (/^\d{1,2}\.\d{1,2}/.test(p.venue)) return false;

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
