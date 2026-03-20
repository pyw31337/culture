import MapView from '@/components/MapView';
import { getAllPerformances } from '@/lib/performance-data';
import { Suspense } from 'react';
import type { Metadata } from 'next';

import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'Metadata' });

    return {
        title: t('map_title'),
        description: t('map_description'),
    };
}

export async function generateStaticParams() {
    return [{ locale: 'ko' }, { locale: 'en' }, { locale: 'zh' }, { locale: 'ja' }];
}

export default async function MapPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const allPerformances = getAllPerformances(locale);

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
