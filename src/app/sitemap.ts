import { MetadataRoute } from 'next';
import { VALID_GENRE_SLUGS } from '@/lib/constants';
import { getAvailableGenreSlugs } from '@/lib/genre-availability';
import { getAllPerformances, getDataBuildInfo } from '@/lib/performance-data';
import { pickDetailPageExportCandidates } from '@/lib/detail-page-export';

export const dynamic = 'force-static';

const BASE_URL = 'https://pyw31337.github.io/culture';
// next.config uses trailingSlash: true, so canonical URLs end with '/'.
const SITEMAP_URL_LIMIT = 50000;

export default function sitemap(): MetadataRoute.Sitemap {
    const buildInfo = getDataBuildInfo();
    const lastModified = buildInfo?.generatedAt ? new Date(buildInfo.generatedAt) : new Date();
    const genreSlugs = buildInfo ? getAvailableGenreSlugs(buildInfo.genreCounts) : VALID_GENRE_SLUGS;

    const genreRoutes = genreSlugs.map(genre => ({
        url: `${BASE_URL}/${genre}/`,
        lastModified,
        changeFrequency: 'daily' as const,
        priority: 0.8,
    }));

    // Special static routes
    const staticRoutes = [
        {
            url: `${BASE_URL}/`,
            lastModified,
            changeFrequency: 'daily' as const,
            priority: 1,
        },
        {
            url: `${BASE_URL}/map/`,
            lastModified,
            changeFrequency: 'daily' as const,
            priority: 0.7,
        },
        {
            url: `${BASE_URL}/calendar/`,
            lastModified,
            changeFrequency: 'daily' as const,
            priority: 0.7,
        },
        {
            url: `${BASE_URL}/status/`,
            lastModified,
            changeFrequency: 'daily' as const,
            priority: 0.6,
        },
    ];

    // Only the detail pages that are actually exported (same picker as /p/[id]).
    const detailRoutes = pickDetailPageExportCandidates(getAllPerformances()).map((performance) => ({
        url: `${BASE_URL}/p/${encodeURIComponent(performance.id)}/`,
        lastModified,
        changeFrequency: 'daily' as const,
        priority: 0.5,
    }));

    // A single sitemap file may hold at most 50,000 URLs; the export limit keeps us far below.
    return [...staticRoutes, ...genreRoutes, ...detailRoutes].slice(0, SITEMAP_URL_LIMIT);
}
