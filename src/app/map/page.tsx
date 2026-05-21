import MapView from '@/components/MapView';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getAllCinemas, getDataBuildInfo, getLastUpdatedLabel } from '@/lib/performance-data';

export const metadata: Metadata = {
    title: '지도 보기 | Culture Flow',
    description: '전국 문화 공연/행사를 지도에서 확인하세요. 주변 공연장, 영화관, 경기장을 한눈에 볼 수 있습니다.',
};

export default function MapPage() {
    const cinemas = getAllCinemas();
    const buildInfo = getDataBuildInfo();
    const genreCounts = buildInfo?.genreCounts ?? {};
    const lastUpdated = getLastUpdatedLabel();
    return (
        <main className="min-h-screen bg-gray-900 light:bg-white">
            {/* Invisible fallback - see app/page.tsx for rationale. */}
            <Suspense fallback={<div className="min-h-screen" aria-hidden="true" />}>
                <MapView
                    initialPerformances={[]}
                    initialCinemas={cinemas}
                    initialGenreCounts={genreCounts}
                    buildInfo={buildInfo}
                    lastUpdated={lastUpdated}
                />
            </Suspense>
        </main>
    );
}
