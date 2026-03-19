import { getAllPerformances } from '@/lib/performance-data';
import CalendarView from '@/components/CalendarView';
import { Suspense } from 'react';
import type { Metadata } from 'next';

import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'Metadata' });

    return {
        title: t('calendar_title'),
        description: t('calendar_description'),
    };
}

export async function generateStaticParams() {
    return [{ locale: 'ko' }, { locale: 'en' }, { locale: 'zh' }, { locale: 'ja' }];
}

export default async function CalendarPage({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const allPerformances = getAllPerformances(locale);

    return (
        <main className="min-h-screen bg-gray-900 light:bg-white">
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">Loading Calendar...</div>}>
                <CalendarView performances={allPerformances} />
            </Suspense>
        </main>
    );
}
