import { getAllPerformances } from '@/lib/performance-data';
import ShareRedirect from '@/components/ShareRedirect';
import { Metadata } from 'next';
import ContentDetailView from '@/components/ContentDetailView';
import RainbowBackground from '@/components/ui/RainbowBackground';
import type { Performance } from '@/types';

interface PageProps {
    params: Promise<{ id: string }>;
}

export const dynamicParams = false;

const DETAIL_PAGE_EXPORT_LIMIT = Number(process.env.DETAIL_PAGE_EXPORT_LIMIT || 1800);
const ONE_DAY = 24 * 60 * 60 * 1000;

function parseFirstEventDate(performance: Performance) {
    const source = `${performance.dateRaw || ''} ${performance.date || ''}`;
    const match = source.match(/(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);
    if (!match) return null;

    const [, year, month, day] = match;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function scoreDetailPagePriority(performance: Performance, now = new Date()) {
    let score = 0;
    const start = parseFirstEventDate(performance);
    const daysUntil = start ? Math.floor((start.getTime() - now.getTime()) / ONE_DAY) : null;

    if (performance.image || performance.poster || performance.backupPoster || performance.posterUrl) score += 60;
    if (performance.description || performance.synopsis) score += 16;
    if (performance.link || performance.website) score += 8;
    if (performance.lat && performance.lng) score += 6;
    if (performance.genre === 'movie') score += 18;
    if (performance.genre === 'musical' || performance.genre === 'concert' || performance.genre === 'play') score += 14;

    if (daysUntil !== null) {
        if (daysUntil >= -7 && daysUntil <= 45) score += 80 - Math.abs(daysUntil);
        else if (daysUntil > 45 && daysUntil <= 120) score += 24;
        else if (daysUntil < -30) score -= 40;
    }

    return score;
}

function pickDetailPageExportCandidates(performances: Performance[]) {
    if (!Number.isFinite(DETAIL_PAGE_EXPORT_LIMIT) || DETAIL_PAGE_EXPORT_LIMIT <= 0) {
        return [];
    }

    if (performances.length <= DETAIL_PAGE_EXPORT_LIMIT) {
        return performances;
    }

    return [...performances]
        .sort((a, b) => scoreDetailPagePriority(b) - scoreDetailPagePriority(a) || a.id.localeCompare(b.id))
        .slice(0, DETAIL_PAGE_EXPORT_LIMIT);
}

export async function generateStaticParams() {
    const performances = await getAllPerformances();
    return pickDetailPageExportCandidates(performances).map((p) => ({
        id: p.id,
    }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { id } = await params;
    const decodedId = decodeURIComponent(id);
    const performances = await getAllPerformances();
    const p = performances.find((perf) => perf.id === decodedId);

    if (!p) {
        return {
            title: 'Culture Flow - 전국 통합 문화 검색',
            description: '전국 모든 문화 정보를 한눈에 확인하세요.',
            openGraph: {
                title: 'Culture Flow',
                description: '전국 모든 문화 정보를 한눈에 확인하세요.',
                url: 'https://pyw31337.github.io/culture/',
                siteName: 'Culture Flow',
                images: [
                    {
                        url: 'https://pyw31337.github.io/culture/images/og-image.jpg',
                        width: 1200,
                        height: 600,
                        alt: 'Culture Flow Preview',
                    },
                ],
                type: 'website',
            },
            twitter: {
                card: 'summary_large_image',
                title: 'Culture Flow',
                description: '전국 모든 문화 정보를 한눈에 확인하세요.',
                images: ['https://pyw31337.github.io/culture/images/og-image.jpg'],
            },
        };
    }

    const productionHost = 'https://pyw31337.github.io';
    const basePath = '/culture';
    const posterUrl = p.image || p.poster || p.backupPoster || '';
    
    // Ensure absolute URL construction is robust
    // If it already has the basePath (like /culture), don't add it again.
    let cleanPosterPath = posterUrl;
    if (!posterUrl.startsWith('http') && !posterUrl.startsWith('data:')) {
        if (!posterUrl.startsWith(basePath) && !posterUrl.startsWith('/')) {
            cleanPosterPath = `/${posterUrl}`;
        }
    }

    const absolutePosterUrl = posterUrl.startsWith('http')
        ? posterUrl
        : posterUrl.startsWith(basePath)
            ? `${productionHost}${posterUrl}`
            : `${productionHost}${basePath}${cleanPosterPath}`;

    return {
        title: `${p.title} - Culture Flow`,
        description: `${p.date} | ${p.venue} | 전국 통합 문화 검색 Culture Flow`,
        openGraph: {
            title: `${p.title} - Culture Flow`,
            description: `${p.date} | ${p.venue} | 전국 통합 문화 검색 Culture Flow`,
            url: `${productionHost}${basePath}/p/${id}/`,
            siteName: 'Culture Flow',
            images: [
                {
                    url: absolutePosterUrl,
                    width: 800,
                    height: 1100,
                    alt: p.title,
                },
            ],
            type: 'article',
        },
        twitter: {
            card: 'summary_large_image',
            title: `${p.title} - Culture Flow`,
            description: `${p.date} | ${p.venue} | 전국 통합 문화 검색 Culture Flow`,
            images: absolutePosterUrl,
        },
    };
}

export default async function PerformanceSharePage({ params }: PageProps) {
    const { id } = await params;
    const decodedId = decodeURIComponent(id);
    const performances = await getAllPerformances();
    const p = performances.find((perf) => perf.id === decodedId);

    if (!p) return <ShareRedirect id={decodedId} />;

    return (
        <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden selection:bg-emerald-500/30 inverted-share-theme transition-colors duration-500">
            {/* Premium Animated Background */}
            <RainbowBackground />
            
            {/* 3D Floating Squares Effect */}
            <div className="bg-squares opacity-30 sm:opacity-50">
                {[...Array(10)].map((_, i) => (
                    <div key={i} className="bg-square" />
                ))}
            </div>

            {/* Content Container */}
            <ContentDetailView performance={p} mode="standalone" />

            {/* SEO Structured Data */}
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        '@context': 'https://schema.org',
                        '@type': 'Event',
                        'name': p.title,
                        'startDate': p.date,
                        'eventStatus': 'https://schema.org/EventScheduled',
                        'eventAttendanceMode': 'https://schema.org/OfflineEventAttendanceMode',
                        'location': {
                            '@type': 'Place',
                            'name': p.venue,
                            'address': {
                                '@type': 'PostalAddress',
                                'streetAddress': p.venue,
                                'addressLocality': 'Seoul',
                                'addressCountry': 'KR'
                            }
                        },
                        'image': [p.image || p.poster || ''],
                        'description': p.description || p.title,
                        'offers': {
                            '@type': 'Offer',
                            'price': p.price === '무료' ? '0' : undefined,
                            'priceCurrency': 'KRW',
                            'url': `https://pyw31337.github.io/culture/p/${id}/`
                        }
                    })
                }}
            />
        </main>
    );
}
