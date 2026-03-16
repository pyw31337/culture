import { getAllPerformances } from '@/lib/performance-data';
import CalendarView from '@/components/CalendarView';
import { Suspense } from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: '달력 보기 | Culture Flow',
    description: '전국 문화 공연/행사 달력 보기. 일간, 주간, 월간 보기로 문화 일정을 확인하세요.',
};

export async function generateStaticParams() {
    return [{ locale: 'ko' }, { locale: 'en' }, { locale: 'zh' }, { locale: 'ja' }];
}

export default async function CalendarPage() {
    const allPerformances = getAllPerformances();

    return (
        <main className="min-h-screen bg-gray-900 light:bg-white">
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">Loading Calendar...</div>}>
                <CalendarView performances={allPerformances} />
            </Suspense>
        </main>
    );
}
