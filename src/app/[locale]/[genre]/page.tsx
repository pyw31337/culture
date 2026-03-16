import PerformanceList from '@/components/PerformanceList';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { VALID_GENRE_SLUGS, SPORTS_GENRES, GENRES } from '@/lib/constants';
import { getAllPerformances } from '@/lib/performance-data';
import { getTranslations } from 'next-intl/server';

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

// Generate static params for all valid genre slugs and locales
export async function generateStaticParams() {
    const locales = ['en', 'ko'];
    const params: { locale: string; genre: string }[] = [];

    locales.forEach(locale => {
        VALID_GENRE_SLUGS.forEach(genre => {
            params.push({ locale, genre });
        });
    });

    return params;
}

interface PageProps {
    params: Promise<{ locale: string; genre: string }>;
}

export async function generateMetadata({ params }: PageProps) {
    const { locale, genre } = await params;
    const mt = await getTranslations({ locale, namespace: 'Metadata' });
    const tc = await getTranslations({ locale, namespace: 'Categories' });

    if (!VALID_GENRE_SLUGS.includes(genre)) {
        return {
            title: mt('not_found'),
        };
    }

    // Resolve Genre Logic
    let genreFilter: string | string[];
    let genreLabel: string = tc(genre);

    // Map slug to internal ID for label lookup
    const internalGenre = SLUG_TO_GENRE[genre] || genre;

    // Custom Label for Sports aggregate
    if (genre === 'sports') genreLabel = mt('genre_sports');

    if (genre === 'sports') {
        genreFilter = SPORTS_GENRES;
    } else {
        const internalGenre = SLUG_TO_GENRE[genre] || genre;
        genreFilter = internalGenre;
    }

    const performances = await getPerformances(genreFilter);
    const count = performances.length;

    const title = mt('genre_title', { genre: genreLabel });
    const description = mt('genre_description', { genre: genreLabel, count });

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            type: 'website',
            images: [
                {
                    url: '/culture/images/og-default.png',
                    width: 1200,
                    height: 630,
                    alt: genreLabel,
                },
            ],
        },
    };
}

export default async function GenrePage({ params }: PageProps) {
    const { locale, genre } = await params;
    const t = await getTranslations({ locale, namespace: 'Common' });

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

    // Date formatting using dynamic locale
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

    // JSON-LD Structured Data
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        'itemListElement': performances.slice(0, 20).map((p, index) => ({
            '@type': 'ListItem',
            'position': index + 1,
            'item': {
                '@type': 'Event',
                'name': p.title,
                'startDate': p.date, 
                'location': {
                    '@type': 'Place',
                    'name': p.venue,
                    'address': (p as any).address || p.venue 
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
