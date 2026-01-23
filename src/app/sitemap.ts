import { MetadataRoute } from 'next';
import { VALID_GENRE_SLUGS } from '@/lib/constants';

export const dynamic = 'force-static';

const BASE_URL = 'https://pyw31337.github.io/culture';

export default function sitemap(): MetadataRoute.Sitemap {
    const genreRoutes = VALID_GENRE_SLUGS.map(genre => ({
        url: `${BASE_URL}/${genre}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.8,
    }));

    // Special static routes
    const staticRoutes = [
        {
            url: BASE_URL,
            lastModified: new Date(),
            changeFrequency: 'daily' as const,
            priority: 1,
        },
    ];

    return [...staticRoutes, ...genreRoutes];
}
