import PerformanceList from '@/components/PerformanceList';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { VALID_GENRE_SLUGS, GENRES } from '@/lib/constants';
import { getAllPerformances, getDataBuildInfo, getLastUpdatedLabel } from '@/lib/performance-data';
import { buildGenreCounts, getAvailableGenreSlugs, getGenreCount, getGenreFilterFromSlug, isGenreAvailable } from '@/lib/genre-availability';
import { sortPerformancesForCategoryFeed } from '@/lib/performance-filter';

function getGenreCounts() {
    const buildInfo = getDataBuildInfo();
    return buildInfo?.genreCounts ?? buildGenreCounts(getAllPerformances());
}

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

    const sportsGenres = ['volleyball', 'basketball', 'baseball', 'handball', 'soccer'];
    if (typeof genreFilter === 'string' && genreFilter !== 'movie' && !sportsGenres.includes(genreFilter)) {
        return sortPerformancesForCategoryFeed(filtered);
    }

    return filtered;
}

// Generate static params for all valid genre slugs
export async function generateStaticParams() {
    const genreCounts = getGenreCounts();
    const availableSlugs = getAvailableGenreSlugs(genreCounts);

    return availableSlugs.map(genre => ({
        genre: genre,
    }));
}

interface PageProps {
    params: Promise<{ genre: string }>;
}

export async function generateMetadata({ params }: PageProps) {
    const { genre } = await params;
    const genreCounts = getGenreCounts();

    // Resolve Genre Logic
    let genreLabel: string = genre;

    const genreFilter = getGenreFilterFromSlug(genre);
    const internalGenre = Array.isArray(genreFilter) ? genre : genreFilter;

    // Find label
    const matchedGenre = GENRES.find(g => g.id === internalGenre);
    if (matchedGenre) genreLabel = matchedGenre.label;

    // Custom Label for Sports aggregate
    if (genre === 'sports') genreLabel = '스포츠';

    if (!VALID_GENRE_SLUGS.includes(genre) || !isGenreAvailable(genreCounts, genre)) {
        return {
            title: '페이지를 찾을 수 없습니다 - CultureFlow',
        };
    }

    const count = getGenreCount(genreCounts, genre);

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
                    url: '/images/og-image.jpg',
                    width: 1200,
                    height: 600,
                    alt: `${genreLabel} 목록`,
                },
            ],
        },
    };
}

export default async function GenrePage({ params }: PageProps) {
    const { genre } = await params;
    const genreCounts = getGenreCounts();
    const buildInfo = getDataBuildInfo();

    if (!VALID_GENRE_SLUGS.includes(genre) || !isGenreAvailable(genreCounts, genre)) {
        notFound();
    }

    const genreFilter = getGenreFilterFromSlug(genre);
    let initialGenre: string;

    if (Array.isArray(genreFilter)) {
        initialGenre = 'all';
    } else {
        initialGenre = genreFilter;
    }

    const performances = await getPerformances(genreFilter);
    if (performances.length === 0) {
        notFound();
    }
    const initialPerformances = performances.slice(0, 24);

    const lastUpdated = getLastUpdatedLabel();

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
                    'address': p.address || p.venue // Fallback
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
            {/* Invisible fallback - see app/page.tsx for rationale. */}
            <Suspense fallback={<div className="min-h-screen" aria-hidden="true" />}>
                <PerformanceList
                    initialPerformances={initialPerformances}
                    lastUpdated={lastUpdated}
                    initialGenre={initialGenre}
                    initialGenreCounts={genreCounts}
                    buildInfo={buildInfo}
                    isCategoryPage={true}
                    initialFilteredCount={performances.length}
                    categoryGenreFilter={genreFilter}
                    performanceDataPath={`/data/categories/${genre}.json`}
                />
            </Suspense>
        </main>
    );
}
