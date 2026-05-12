import { getAllPerformances, getDataBuildInfo, getLastUpdatedLabel } from '@/lib/performance-data';
import { buildGenreCounts } from '@/lib/genre-availability';
import PerformanceList from '@/components/PerformanceList';
import { Suspense } from 'react';

// This function runs at build time on the server
async function getPerformances() {
    return getAllPerformances();
}

export default async function Home() {
    const allPerformances = await getPerformances();
    const buildInfo = getDataBuildInfo();
    // Optimization: Only pass the first 24 items to the client for initial render
    // The rest will be fetched via Infinite Scroll API
    // We sort by Date Ascending (Upcoming) by default for consistency with API default
    const performaceFilter = await import('@/lib/performance-filter');
    const sorted = performaceFilter.sortPerformancesForHomeFeed(allPerformances);
    const performances = sorted.slice(0, 24);
    const genreCounts = buildInfo?.genreCounts ?? buildGenreCounts(allPerformances);

    const lastUpdated = getLastUpdatedLabel();

    return (
        <main className="min-h-screen bg-gray-900 light:bg-white pb-20">
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">Loading...</div>}>
                <PerformanceList
                    initialPerformances={performances}
                    lastUpdated={lastUpdated}
                    initialGenreCounts={genreCounts}
                    buildInfo={buildInfo}
                />
            </Suspense>
        </main>
    );
}
