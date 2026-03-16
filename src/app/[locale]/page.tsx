import { getAllPerformances } from '@/lib/performance-data';
import PerformanceList from '@/components/PerformanceList';
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';

// This function runs at build time on the server
async function getPerformances() {
    return getAllPerformances();
}

interface PageProps {
    params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'Metadata' });

    return {
        title: t('home_title'),
        description: t('home_description'),
    };
}

export async function generateStaticParams() {
    return [{ locale: 'en' }, { locale: 'ko' }];
}

export default async function Home({ params }: PageProps) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: 'Common' });
    const allPerformances = await getPerformances();
    
    // Optimization: Only pass the first 24 items to the client for initial render
    const performaceFilter = await import('@/lib/performance-filter');
    const sorted = performaceFilter.sortPerformances(allPerformances, 'all');
    const performances = sorted.slice(0, 24);

    const now = new Date();
    const formatter = new Intl.DateTimeFormat(locale === 'ko' ? 'ko-KR' : 'en-US', {
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

    const formattedTime = locale === 'ko' 
        ? `${year}.${month}.${day}.(${weekday}) ${hour}:${minute}`
        : `${month}/${day}/${year} (${weekday}) ${hour}:${minute}`;

    const lastUpdated = t('last_updated', { time: formattedTime });

    return (
        <main className="min-h-screen bg-gray-900 light:bg-white pb-20">
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">Loading...</div>}>
                <PerformanceList initialPerformances={performances} lastUpdated={lastUpdated} />
            </Suspense>
        </main>
    );
}
