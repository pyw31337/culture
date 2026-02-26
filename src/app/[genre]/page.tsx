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



        if (Array.isArray(genreFilter)) {
            return genreFilter.includes(p.genre);
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

export async function generateMetadata({ params }: PageProps) {
    const { genre } = await params;

    // Resolve Genre Logic
    let genreFilter: string | string[];
    let genreLabel: string = genre;

    // Find label
    const matchedGenre = GENRES.find(g => g.id === genre);
    if (matchedGenre) genreLabel = matchedGenre.label;

    // Custom Label for Sports aggregate
    if (genre === 'sports') genreLabel = '스포츠 (전체)';

    if (!VALID_GENRE_SLUGS.includes(genre)) {
        return {
            title: '페이지를 찾을 수 없습니다 - CultureFlow',
        };
    }

    if (genre === 'sports') {
        genreFilter = SPORTS_GENRES;
    } else {
        const internalGenre = SLUG_TO_GENRE[genre] || genre;
        genreFilter = internalGenre;
    }

    const performances = await getPerformances(genreFilter);
    const count = performances.length;

    const title = `${genreLabel} 정보 및 예매 (${count}건) | CultureFlow`;
    const description = `현재 예매/관람 가능한 ${genreLabel} 콘텐츠 ${count}개를 확인하세요. 최저가, 일정, 인기 순위를 한눈에 비교할 수 있습니다.`;

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            type: 'website',
            images: [
                {
                    url: '/culture/images/og-default.png', // Fallback or dynamic if possible
                    width: 1200,
                    height: 630,
                    alt: `${genreLabel} 목록`,
                },
            ],
        },
    };
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

    // JSON-LD Structured Data (ItemList with Events)
    // Limit to top 20 to avoid excessive HTML size
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        'itemListElement': performances.slice(0, 20).map((p, index) => ({
            '@type': 'ListItem',
            'position': index + 1,
            'item': {
                '@type': 'Event',
                'name': p.title,
                'startDate': p.date, // Needs proper ISO formatting if possible, but string is okay for now
                'location': {
                    '@type': 'Place',
                    'name': p.venue,
                    'address': (p as any).address || p.venue // Fallback
                },
                'image': p.image,
                'offers': {
                    '@type': 'Offer',
                    'price': p.price ? p.price.replace(/[^0-9]/g, '') : '0',
                    'priceCurrency': 'KRW',
                    'url': p.link
                }
            }
        }))
    };

    return (
        <main className="min-h-screen bg-gray-900 light:bg-white pb-20">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
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
