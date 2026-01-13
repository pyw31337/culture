import { fetchPerformances } from '@/lib/interpark';
import { safeArray, safePerformanceList } from '@/lib/data-safety';
import PerformanceList from '@/components/PerformanceList';
import { Suspense } from 'react';

import interparkData from '@/data/interpark.json';
import kovoData from '@/data/kovo.json';
import kblData from '@/data/kbl.json';
import kboData from '@/data/kbo.json';
import travelData from '@/data/travel.json';
import festivalsData from '@/data/festivals.json';
import yes24Data from '@/data/yes24.json';
import timeticketData from '@/data/timeticket.json';
import moviesData from '@/data/movies.json';
import kidsData from '@/data/myrealtrip-kids.json';
import classData from '@/data/sssd-class.json';
import soccerData from '@/data/soccer.json';

import ottData from '@/data/ott.json';

import handballData from '@/data/handball.json';
// import hockeyData from '@/data/hockey.json'; // Removed
import umclassData from '@/data/umclass.json';
import seoulData from '@/data/seoul-culture.json';

import mochaclassData from '@/data/mochaclass.json';
import mommomData from '@/data/mommom.json';
import museumData from '@/data/museum.json';
import musicalData from '@/data/musical.json';
import venueData from '@/data/venues.json';

const venues = venueData as Record<string, { address: string }>;

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
        // Type 3: Simple "YYYY-MM-DD" (Mommom/General)
        else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const [y, m, d] = dateStr.split('-').map(Number);
            targetDate = new Date(y, m - 1, d);
            targetDate.setHours(23, 59, 59, 999);
        }
        // Fallback
        else {
            targetDate = new Date(dateStr);
            // If valid, assume end of day to be safe? 
            // Or leave as is for unexpected formats.
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

// This function runs at build time on the server (or revalidation)
async function getPerformances() {
    const interpark = safeArray<any>(interparkData);
    const volleyball = safeArray<any>(kovoData);
    const basketball = safeArray<any>(kblData);
    const baseball = safeArray<any>(kboData);
    const handball = safeArray<any>(handballData);
    // const hockey = safeArray<any>(hockeyData);
    const festivals = safeArray<any>(festivalsData);
    const yes24 = safeArray<any>(yes24Data);
    const timeticket = safeArray<any>(timeticketData);
    const movies = safeArray<any>(moviesData);
    const travels = safeArray<any>(travelData);
    const kids = safeArray<any>(kidsData);
    const classes = safeArray<any>(classData);
    const umclasses = safeArray<any>(umclassData);
    const mochaclasses = safeArray<any>(mochaclassData);
    const ott = safeArray<any>(ottData);
    const mommom = safeArray<any>(mommomData);
    const museum = safeArray<any>(museumData);
    const musical = safeArray<any>(musicalData);

    // Debug: Trace SangSang Item
    const sangSangItem = mommom.find(p => p.title.includes('상상체험'));
    console.log('[Page Debug] SangSang in Raw Data?', !!sangSangItem, sangSangItem ? `${sangSangItem.title} (${sangSangItem.genre}) region:${sangSangItem.region}` : '');

    const seoulCulture = safeArray<any>(seoulData).map((p: any) => ({
        ...p,
        venue: p.place,
        region: 'seoul',
        image: p.poster, // Map 'poster' from JSON to 'image' expected by Performance type
        price: p.cost,   // Map 'cost' from JSON to 'price'
        date: p.time ? `${p.date} (${p.time})` : p.date // Append time to date for display
    }));

    // 1. Initial Data Aggregation
    const allPerformances = [
        ...interpark,
        ...yes24,
        ...timeticket,
        ...festivals,
        ...volleyball,
        ...basketball,
        ...baseball,
        ...handball,
        ...soccerData, // Imported directly
        ...ott.map(p => ({ ...p, venue: 'OTT' })),
        ...movies,
        ...travels,
        ...kids,
        ...classes,
        ...umclasses,
        ...mochaclasses,
        ...seoulCulture,
        ...mommom,
        ...museum,
        ...musical,
    ].map(p => ({
        ...p,
        // Ensure consistent ID type
        id: String(p.id)
    }));

    // Debug: Trace SangSang after aggregation
    const sangSangAgg = allPerformances.find(p => p.title.includes('상상체험'));
    console.log('[Page Debug] SangSang after Aggregation?', !!sangSangAgg);


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
    // Valid regions - Added 'etc' and 'busan', 'daegu', 'gwangju' for broader sports support
    const validRegions = ['seoul', 'gyeonggi', 'incheon', 'busan', 'daegu', 'gwangju', 'etc'];

    // 3. Bad Data / Blocklist Check
    const BLOCKLIST = ['블루마린 스쿠버 다이브', '광주 조선대학교 해오름관'];

    const filtered = allPerformances.filter(p => {
        // Movies & Travel & Kids & Class & Leisure & Hotdeal: Always show regardless of region/date logic
        if (p.genre === 'movie' || p.genre === 'travel' || p.genre === 'kids' || p.genre === 'class' || p.genre === 'ott' || p.genre === 'museum' || p.genre === 'leisure' || p.genre === 'hotdeal') return true;

        if (!isPerformanceActive(p.date, now)) return false;

        // Hockey filter removed


        // Sports: Strict Region Filter
        if (p.genre === 'volleyball' || p.genre === 'basketball' || p.genre === 'baseball' || p.genre === 'handball') {
            // Allow verified regions
            if (!['seoul', 'gyeonggi', 'incheon', 'busan', 'daegu', 'gwangju', 'etc'].includes(p.region)) return false;
        }

        // Allow 'etc' but maybe we want to visualize it differently? 
        // For now, just allow it so the list isn't empty.
        if (!validRegions.includes(p.region)) return false;

        // Filter out bad venues
        if (p.venue === '예매하기') return false;
        // Check for venue names that are actually dates (e.g., "12.18(목) 19:00") - Parsing Error Cleaning
        if (/^\d{1,2}\.\d{1,2}/.test(p.venue)) return false;

        // Address-based Filtering (Stronger than region tag)
        // If we know the address, and it's NOT in Seoul/Gyeonggi/Incheon, hide it.
        if (venues[p.venue]) {
            const addr = venues[p.venue].address;
            if (addr && addr !== '정보 없음') {
                const isServiceArea = addr.startsWith('서울') || addr.startsWith('경기') || addr.startsWith('인천');
                if (!isServiceArea) return false;
            }
        }

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




    // 5. Assign Stable IDs based on Normalized Title (Key)
    // This ensures Deep Links allow sharing even if source ID changes or provider shifts
    // Warn: This will invalidate existing localStorage likes if they used source IDs.
    // Given the stage (Development), this is acceptable for consistency.
    const stablePerformances = Array.from(uniqueMap.entries()).map(([key, p]) => {
        // Simple hash function for ID
        let hash = 0;
        const str = key + (p.date?.split('~')[0] || ''); // Combine title + start date for collision resistance
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        const stableId = `perf_${Math.abs(hash).toString(16)}`; // Hex format

        return {
            ...p,
            id: stableId,
            originalId: p.id // Keep original for reference
        };
    });

    return safePerformanceList(stablePerformances);
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
        <main className="min-h-screen bg-gray-900 light:bg-white pb-20">
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">Loading...</div>}>
                <PerformanceList initialPerformances={performances} lastUpdated={lastUpdated} />
            </Suspense>
        </main>
    );
}
