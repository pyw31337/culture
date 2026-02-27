import { getAllPerformances } from '@/lib/performance-data';
import PerformanceList from '@/components/PerformanceList';
import { Suspense } from 'react';

// This function runs at build time on the server
async function getPerformances() {
    return getAllPerformances();
}

export default async function Home() {
    const allPerformances = await getPerformances();
    // Optimization: Only pass the first 24 items to the client for initial render
    // The rest will be fetched via Infinite Scroll API
    // We sort by Date Ascending (Upcoming) by default for consistency with API default
    const performaceFilter = await import('@/lib/performance-filter');
    const sorted = performaceFilter.sortPerformances(allPerformances, 'all');
    const performances = sorted.slice(0, 24);

    const now = new Date();
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

    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value;

    const year = getPart('year');
    const month = getPart('month');
    const day = getPart('day');
    const weekday = getPart('weekday');
    const hour = getPart('hour');
    const minute = getPart('minute');

    const lastUpdated = `${year}.${month}.${day}.(${weekday}) ${hour}:${minute} `;

    return (
        <main className="min-h-screen bg-black light:bg-white pb-20">
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">Loading...</div>}>
                <PerformanceList initialPerformances={performances} lastUpdated={lastUpdated} />
            </Suspense>
        </main>
    );
}
