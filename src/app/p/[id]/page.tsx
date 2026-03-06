import { getAllPerformances } from '@/lib/performance-data';
import { Metadata } from 'next';
import ShareRedirect from '@/components/ShareRedirect';
import RainbowBackground from '@/components/ui/RainbowBackground';

// This is required for static export (output: export)
export async function generateStaticParams() {
    const performances = await getAllPerformances();
    // Return all IDs found in the dataset
    return performances.map((p) => ({
        id: p.id,
    }));
}

interface PageProps {
    params: Promise<{ id: string }>;
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
        };
    }

    const title = `${p.title} - Culture Flow`;
    const description = `${p.date} | ${p.venue} | 전국 통합 문화 검색 Culture Flow`;

    // Production absolute URL for OG tags
    const productionHost = 'https://pyw31337.github.io';
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/culture';
    const imageUrl = p.image.startsWith('http') ? p.image : `${productionHost}${basePath}${p.image}`;

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            images: [
                {
                    url: imageUrl,
                    secureUrl: imageUrl,
                    width: 800,
                    height: 1100,
                    alt: p.title,
                },
            ],
            type: 'article',
            url: `https://pyw31337.github.io/culture/p/${id}/`,
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [imageUrl],
        }
    };
}

export default async function PerformanceSharePage({ params }: PageProps) {
    const { id } = await params;
    const decodedId = decodeURIComponent(id);
    const performances = await getAllPerformances();
    const p = performances.find((perf) => perf.id === decodedId);

    if (!p) return <ShareRedirect id={decodedId} />;

    const productionHost = 'https://pyw31337.github.io';
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/culture';
    const imageUrl = p.image.startsWith('http') ? p.image : `${productionHost}${basePath}${p.image}`;

    // Generate JSON-LD
    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Event',
        'name': p.title,
        'startDate': p.date?.split('~')[0]?.trim()?.replace(/\./g, '-'),
        'endDate': p.date?.includes('~') ? p.date.split('~')[1].trim().replace(/\./g, '-') : undefined,
        'eventStatus': 'https://schema.org/EventScheduled',
        'eventAttendanceMode': 'https://schema.org/OfflineEventAttendanceMode',
        'location': {
            '@type': 'Place',
            'name': p.venue,
            'address': {
                '@type': 'PostalAddress',
                'streetAddress': p.venue,
                'addressLocality': p.region,
                'addressCountry': 'KR'
            }
        },
        'image': [imageUrl],
        'description': p.title,
        'offers': {
            '@type': 'Offer',
            'price': p.price === '무료' ? '0' : undefined,
            'priceCurrency': 'KRW',
            'url': `https://pyw31337.github.io/culture/p/${id}/`
        }
    };

    return (
        <div className="min-h-screen bg-white dark:bg-black flex flex-col items-center justify-center p-4 relative overflow-hidden">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />

            {/* Advanced Rainbow Background */}
            <div className="fixed inset-0 z-0">
                <RainbowBackground />
            </div>

            <div className="relative z-10 w-full max-w-[280px] sm:max-w-sm flex flex-col items-center">
                {/* Compact Card */}
                <div className="w-full aspect-[3/4] rounded-2xl shadow-2xl mb-4 overflow-hidden bg-white/10 backdrop-blur-md border border-white/20">
                    <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                </div>

                <div className="bg-white/40 dark:bg-black/40 backdrop-blur-xl p-4 rounded-2xl w-full border border-white/20 shadow-xl">
                    <h1 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white text-center mb-1 line-clamp-2 leading-tight">
                        {p.title}
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm text-center mb-4">{p.date}</p>

                    <div className="flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold tracking-widest uppercase opacity-70">
                            Redirecting to Culture Flow
                        </p>
                    </div>
                </div>
            </div>

            <ShareRedirect id={id} />
        </div>
    );
}
