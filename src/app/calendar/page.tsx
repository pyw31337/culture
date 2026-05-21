import CalendarView from '@/components/CalendarView';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getDataBuildInfo, getLastUpdatedLabel } from '@/lib/performance-data';

export const metadata: Metadata = {
    title: '달력 보기 | Culture Flow',
    description: '전국 문화 공연/행사 달력 보기. 일간, 주간, 월간 보기로 문화 일정을 확인하세요.',
};

export default async function CalendarPage() {
    const buildInfo = getDataBuildInfo();
    const genreCounts = buildInfo?.genreCounts ?? {};
    const lastUpdated = getLastUpdatedLabel();
    return (
        <main className="min-h-screen bg-gray-900 light:bg-white">
            {/* Invisible fallback - see app/page.tsx for rationale. */}
            <Suspense fallback={<div className="min-h-screen" aria-hidden="true" />}>
                <CalendarView
                    performances={[]}
                    initialGenreCounts={genreCounts}
                    buildInfo={buildInfo}
                    lastUpdated={lastUpdated}
                />
            </Suspense>
        </main>
    );
}
