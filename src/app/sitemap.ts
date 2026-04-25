import { MetadataRoute } from 'next';
import { VALID_GENRE_SLUGS } from '@/lib/constants';
import { getAvailableGenreSlugs } from '@/lib/genre-availability';
import { getDataBuildInfo } from '@/lib/performance-data';

export const dynamic = 'force-static';

const BASE_URL = 'https://pyw31337.github.io/culture';

export default function sitemap(): MetadataRoute.Sitemap {
    const buildInfo = getDataBuildInfo();
    const lastModified = buildInfo?.generatedAt ? new Date(buildInfo.generatedAt) : new Date();
    const genreSlugs = buildInfo ? getAvailableGenreSlugs(buildInfo.genreCounts) : VALID_GENRE_SLUGS;

    const genreRoutes = genreSlugs.map(genre => ({
        url: `${BASE_URL}/${genre}`,
        lastModified,
        changeFrequency: 'daily' as const,
        priority: 0.8,
    }));

    // Special static routes
    const staticRoutes = [
        {
            url: BASE_URL,
            lastModified,
            changeFrequency: 'daily' as const,
            priority: 1,
        },
        {
            url: `${BASE_URL}/map`,
            lastModified,
            changeFrequency: 'daily' as const,
            priority: 0.7,
        },
        {
            url: `${BASE_URL}/calendar`,
            lastModified,
            changeFrequency: 'daily' as const,
            priority: 0.7,
        },
        {
            url: `${BASE_URL}/status`,
            lastModified,
            changeFrequency: 'daily' as const,
            priority: 0.6,
        },
    ];

    return [...staticRoutes, ...genreRoutes];
}
