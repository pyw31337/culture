import { getAllPerformances } from '@/lib/performance-data';
import ShareRedirect from '@/components/ShareRedirect';
import { Metadata } from 'next';
import ContentDetailView from '@/components/ContentDetailView';
import RainbowBackground from '@/components/ui/RainbowBackground';

interface PageProps {
    params: Promise<{ id: string }>;
}

export const dynamicParams = false;

export async function generateStaticParams() {
    const performances = await getAllPerformances();
    return performances.map((p) => ({
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
    const cleanPosterPath = posterUrl.startsWith('/') ? posterUrl : `/${posterUrl}`;
    const absolutePosterUrl = posterUrl.startsWith('http')
        ? posterUrl
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
                    secureUrl: absolutePosterUrl,
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
            images: [absolutePosterUrl],
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
        <main className="relative min-h-screen py-8 px-4 sm:py-12 sm:px-6 flex flex-col items-center justify-center overflow-x-hidden selection:bg-emerald-500/30">
            {/* Premium Animated Background */}
            <RainbowBackground />

            {/* Content Container */}
            <div className="relative z-10 w-full max-w-2xl">
                <ContentDetailView performance={p} mode="standalone" />
            </div>

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
