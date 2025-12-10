import { fetchPerformances } from '@/lib/interpark';
import PerformanceList from '@/components/PerformanceList';

import kovoData from '@/data/kovo.json';
import kblData from '@/data/kbl.json';

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

    const allPerformances = [...seoul, ...gyeonggi, ...incheon, ...volleyball, ...basketball];

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

    return allPerformances.filter(p => {
        // 1. Expiration Check
        if (!isPerformanceActive(p.date, now)) return false;

        // 2. Sports Venue/Region Check
        // If it's KOVO or KBL (based on ID prefix or generally just apply to all "etc" regions?)
        // The problem is Interpark data might use 'etc' if we had such logic, but Interpark fetcher usually returns specific regions.
        // Let's rely on p.region for now.
        if (p.region === 'etc') return false;

        // 3. Bad Data Check
        if (p.venue === '예매하기') return false;

        return true;
    });
}

export default async function Home() {
    const performances = await getPerformances();

    return (
        <main className="min-h-screen bg-gray-900 pb-20">
            <PerformanceList initialPerformances={performances} />
        </main>
    );
}
