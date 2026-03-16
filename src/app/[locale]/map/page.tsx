import MapView from '@/components/MapView';
import { getAllPerformances } from '@/lib/performance-data';
import { Suspense } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: '지도 보기 | Culture Flow',
    description: '전국 문화 공연/행사를 지도에서 확인하세요. 주변 공연장, 영화관, 경기장을 한눈에 볼 수 있습니다.',
};

export default async function MapPage() {
    const allPerformances = getAllPerformances();

    // Load cinemas data if available
    let cinemas: any[] = [];
    try {
        const fs = await import('fs');
        const path = await import('path');
        const cinemasPath = path.resolve(process.cwd(), 'src/data/cinemas.json');
        if (fs.existsSync(cinemasPath)) {
            cinemas = JSON.parse(fs.readFileSync(cinemasPath, 'utf-8'));
        }
    } catch (e) {
        // cinemas are optional
    }

    return (
        <main className="min-h-screen bg-gray-900 light:bg-white">
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">Loading Map...</div>}>
                <MapView
                    initialPerformances={allPerformances}
                    initialCinemas={cinemas}
                />
            </Suspense>
        </main>
    );
}
