import PerformanceList from '@/components/PerformanceList';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { VALID_GENRE_SLUGS, SPORTS_GENRES, GENRES } from '@/lib/constants';
import { getAllPerformances } from '@/lib/performance-data';

// Map URL slugs to actual genre IDs (some differ)
const SLUG_TO_GENRE: Record<string, string> = {
    'theater': 'play', // URL uses 'theater', internal uses 'play'
};

/*
    Helper to filter merged data set by genre.
*/
async function getPerformances(genreFilter: string | string[] | null) {
    const allStable = getAllPerformances();

    const filtered = allStable.filter(p => {
        if (!genreFilter) return true;

        // Match PerformanceList logic for Hotdeal
        if (genreFilter === 'hotdeal') {
            return p.genre === 'hotdeal' || (p.discount && p.discount !== '' && p.discount !== '0');
        }

        if (Array.isArray(genreFilter)) {
            return genreFilter.includes(p.genre);
        }

        // Expanded filter for OTT: Include merged movie items that have platform info
        if (genreFilter === 'ott') {
            return p.genre === 'ott' || (p.platforms && p.platforms.length > 0);
        }

        return p.genre === genreFilter;
    });

    return filtered;
}

// Generate static params for all valid genre slugs
export async function generateStaticParams() {
    return VALID_GENRE_SLUGS.map(genre => ({
        genre: genre,
    }));
}

interface PageProps {
    params: Promise<{ genre: string }>;
}

export default async function GenrePage({ params }: PageProps) {
    const { genre } = await params;

    if (!VALID_GENRE_SLUGS.includes(genre)) {
        notFound();
    }

    let genreFilter: string | string[];
    let initialGenre: string;

    if (genre === 'sports') {
        genreFilter = SPORTS_GENRES;
        initialGenre = 'all';
    } else {
        const internalGenre = SLUG_TO_GENRE[genre] || genre;
        genreFilter = internalGenre;
        initialGenre = internalGenre;
    }

    const performances = await getPerformances(genreFilter);

    // Date formatting (Same as page.tsx)
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
        <main className="min-h-screen bg-gray-900 light:bg-white pb-20">
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">Loading...</div>}>
                <PerformanceList
                    initialPerformances={performances}
                    lastUpdated={lastUpdated}
                    initialGenre={initialGenre}
                    isCategoryPage={true}
                />
            </Suspense>
        </main>
    );
}
