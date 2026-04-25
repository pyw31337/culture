import type { DataQualitySummary } from '../../src/lib/build-info';

export type ContentQualityItem = {
    genre?: string;
    image?: string;
    link?: string;
    website?: string;
    description?: string;
    synopsis?: string;
    backupPoster?: string;
    posterUrl?: string;
};

type AnalyzeContentQualityOptions = {
    checkedAt?: string;
    hasLocalAsset?: (assetPath?: string) => boolean;
};

function hasUsableLink(value?: string) {
    return Boolean(value && value.trim() && value.trim() !== '#');
}

function summarizeMissingByGenre(items: ContentQualityItem[], predicate: (item: ContentQualityItem) => boolean) {
    return items.reduce<Record<string, number>>((summary, item) => {
        if (!predicate(item)) return summary;
        const genre = item.genre || 'unknown';
        summary[genre] = (summary[genre] ?? 0) + 1;
        return summary;
    }, {});
}

function hasUsableImage(item: ContentQualityItem) {
    return Boolean(item.image || item.backupPoster || item.posterUrl);
}

export function analyzeContentQuality(
    items: ContentQualityItem[],
    { checkedAt = new Date().toISOString(), hasLocalAsset }: AnalyzeContentQualityOptions = {}
): DataQualitySummary {
    const movies = items.filter((item) => item.genre === 'movie');

    const missingLinks = items.filter((item) => !hasUsableLink(item.link) && !hasUsableLink(item.website));
    const missingDescriptions = items.filter((item) => !(item.description || item.synopsis));
    const missingImages = items.filter((item) => !hasUsableImage(item));
    const brokenLocalImages = items.filter((item) => {
        if (!item.image || !item.image.startsWith('/')) return false;
        if (!hasLocalAsset) return false;
        if (hasLocalAsset(item.image)) return false;
        return !(item.backupPoster || item.posterUrl);
    });

    const movieMissingLinks = movies.filter((item) => !hasUsableLink(item.link) && !hasUsableLink(item.website));
    const movieMissingDescriptions = movies.filter((item) => !(item.description || item.synopsis));
    const movieBrokenImages = movies.filter((item) => {
        if (!item.image) return !item.backupPoster && !item.posterUrl;
        if (!item.image.startsWith('/')) return false;
        if (!hasLocalAsset) return false;
        if (hasLocalAsset(item.image)) return false;
        return !(item.backupPoster || item.posterUrl);
    });

    const warningsByGenre = {
        missingLinks: summarizeMissingByGenre(items, (item) => !hasUsableLink(item.link) && !hasUsableLink(item.website)),
        missingDescriptions: summarizeMissingByGenre(items, (item) => !(item.description || item.synopsis)),
        missingImages: summarizeMissingByGenre(items, (item) => !hasUsableImage(item)),
    };

    const status = (
        missingLinks.length === 0 &&
        missingDescriptions.length === 0 &&
        missingImages.length === 0 &&
        brokenLocalImages.length === 0 &&
        movieMissingLinks.length === 0 &&
        movieMissingDescriptions.length === 0 &&
        movieBrokenImages.length === 0
    ) ? 'pass' : 'warn';

    return {
        checkedAt,
        status,
        missingLinkCount: missingLinks.length,
        missingDescriptionCount: missingDescriptions.length,
        missingImageCount: missingImages.length,
        brokenLocalImageCount: brokenLocalImages.length,
        movieMissingLinkCount: movieMissingLinks.length,
        movieMissingDescriptionCount: movieMissingDescriptions.length,
        movieBrokenImageCount: movieBrokenImages.length,
        warningsByGenre,
    };
}
