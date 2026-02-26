import { getAllPerformances } from '@/lib/performance-data';
import { Metadata } from 'next';
import ShareRedirect from '@/components/ShareRedirect';

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
    const performances = await getAllPerformances();
    const p = performances.find((perf) => perf.id === id);

    if (!p) {
        return {
            title: 'Culture Flow - 전국 통합 문화 검색',
            description: '전국 모든 문화 정보를 한눈에 확인하세요.',
        };
    }

    const title = `${p.title} - Culture Flow`;
    const description = `${p.date} | ${p.venue} | 전국 통합 문화 검색 Culture Flow`;

    // Ensure base path is included if in production
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const imageUrl = p.image.startsWith('http') ? p.image : `${basePath}${p.image}`;

    return {
        title,
        description,
        openGraph: {
            title,
            description,
            images: [
                {
                    url: imageUrl,
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
    const performances = await getAllPerformances();
    const p = performances.find((perf) => perf.id === id);

    if (!p) return <ShareRedirect id={id} />;

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const imageUrl = p.image.startsWith('http') ? p.image : `${basePath}${p.image}`;

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
        <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 relative overflow-hidden">
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            {/* Background Blur Poster */}
            <div
                className="absolute inset-0 opacity-20 blur-3xl scale-110 pointer-events-none"
                style={{
                    backgroundImage: `url(${imageUrl})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                }}
            />

            <div className="relative z-10 w-full max-w-sm flex flex-col items-center animate-pulse">
                <div className="w-48 h-64 rounded-2xl shadow-2xl mb-8 overflow-hidden bg-gray-800 border border-white/10">
                    <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                </div>

                <h1 className="text-xl font-bold text-white text-center mb-2 line-clamp-2 px-4 italic opacity-80">
                    {p.title}
                </h1>
                <p className="text-gray-400 text-sm mb-8">{p.date}</p>

                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-emerald-500/50 border-t-emerald-500 rounded-full animate-spin"></div>
                    <p className="text-xs text-emerald-500/70 font-medium tracking-widest uppercase">Redirecting to Culture Flow</p>
                </div>
            </div>

            <ShareRedirect id={id} />
        </div>
    );
}
