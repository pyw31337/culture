
export function processAndMergePerformances(items: any[]): any[] {
    const uniqueMap = new Map<string, any>();
    const VIDEO_GENRES = ['movie', 'ott'];
    const LIVE_GENRES = ['musical', 'play', 'classic', 'opera', 'concert', 'exhibition', 'festival', 'museum', 'dance', 'korean_music'];

    items.forEach(p => {
        // 1. Generate Key
        // Normalize title: remove spaces, special chars, lowercase to match duplicates
        const normalizedTitle = p.title.replace(/[\s\(\)\[\]\-\_\!\~\.\,]/g, '').toLowerCase();

        // Determine Merge Group to prevent cross-type merging (e.g. Musical "Wicked" vs Movie "Wicked")
        let groupPrefix = 'misc_';
        if (VIDEO_GENRES.includes(p.genre)) {
            groupPrefix = 'video_';
        } else if (LIVE_GENRES.includes(p.genre)) {
            groupPrefix = 'live_';
        } else {
            // Keep others separate by genre (e.g. sports, travel, class, etc.)
            groupPrefix = p.genre + '_';
        }

        let key = `${groupPrefix}${normalizedTitle}`;

        // Exception for Travel & Sports: Include Date in key to allow same title with different dates
        if (p.genre === 'travel' || ['baseball', 'basketball', 'volleyball', 'soccer', 'handball'].includes(p.genre)) {
            key += `_${p.date}`;
        }

        if (uniqueMap.has(key)) {
            const existing = uniqueMap.get(key);
            const merged = mergeItems(existing, p);
            uniqueMap.set(key, merged);
        } else {
            uniqueMap.set(key, p);
        }
    });

    // 2. Stable ID Generation
    return Array.from(uniqueMap.entries()).map(([key, p]) => {
        // Simple hash function for ID
        let hash = 0;
        const str = key + (p.date?.split('~')[0] || '');
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        const stableId = `perf_${Math.abs(hash).toString(16)}`;

        return {
            ...p,
            id: stableId,
            originalId: p.id // Keep original for reference
        };
    });
}

function mergeItems(a: any, b: any): any {
    const scoreA = getRichnessScore(a);
    const scoreB = getRichnessScore(b);

    // Prefer stricter score, if equal, prefer A (existing/earlier in list)
    const winner = scoreA >= scoreB ? a : b;
    const loser = scoreA >= scoreB ? b : a;

    // Base on winner, but absorb valuable fields from loser if missing in winner
    const merged = { ...winner };

    // Price & Discount (Important: Movie might have price, OTT might not)
    if (!merged.price && loser.price) {
        merged.price = loser.price;
        // If we duplicate price, we should probably check originalPrice too
        if (!merged.originalPrice) merged.originalPrice = loser.originalPrice;
        if (!merged.discount) merged.discount = loser.discount;
    }

    // Platforms (OTT Providers)
    if ((!merged.platforms || merged.platforms.length === 0) && (loser.platforms && loser.platforms.length > 0)) {
        merged.platforms = loser.platforms;
    }

    // Metadata (Cast, Director, Runtime, etc.)
    if (!merged.cast && loser.cast) merged.cast = loser.cast;
    if (!merged.director && loser.director) merged.director = loser.director;
    if (!merged.runningTime && loser.runningTime) merged.runningTime = loser.runningTime;
    if (!merged.ageRating && loser.ageRating) merged.ageRating = loser.ageRating;
    if (!merged.originalTitle && loser.originalTitle) merged.originalTitle = loser.originalTitle;
    if (!merged.productionCountry && loser.productionCountry) merged.productionCountry = loser.productionCountry;
    if (!merged.productionYear && loser.productionYear) merged.productionYear = loser.productionYear;
    if (!merged.subGenre && loser.subGenre) merged.subGenre = loser.subGenre;

    // Poster/Image
    // If winner has no valid image, try loser's
    if ((!merged.image || merged.image.includes('default') || merged.image === '') && (loser.image && !loser.image.includes('default'))) {
        merged.image = loser.image;
    }
    if ((!merged.poster || merged.poster.includes('default') || merged.poster === '') && (loser.poster && !loser.poster.includes('default'))) {
        merged.poster = loser.poster;
    }

    // Venue
    // If winner has generic venue 'OTT' or 'Online' but loser has specific venue, keep specific?
    // Case: Movie (OTT) vs Movie (Cinema). 
    // If scores favor OTT (rich metadata), venue becomes 'OTT'. 
    // But if we have Cinema price, maybe we want Cinema venue?
    // But 'venue' is often used for grouping. 
    // Let's stick to Winner's venue unless it's empty.
    if (!merged.venue && loser.venue) merged.venue = loser.venue;

    return merged;
}

function getRichnessScore(item: any): number {
    let score = 0;

    // Metadata is king
    if (item.cast && (Array.isArray(item.cast) ? item.cast.length > 0 : !!item.cast)) score += 3;
    if (item.director) score += 2;
    if (item.runningTime) score += 1;
    if (item.ageRating) score += 1;
    if (item.originalTitle) score += 1;

    // OTT Platform info is valuable
    if (item.platforms && item.platforms.length > 0) score += 2;

    // Price is good, but shouldn't override metadata (unless metadata is equal)
    if (item.price) score += 1;

    // Prefer items with real posters over placeholders
    if (item.image && !item.image.includes('default') && item.image.startsWith('http')) score += 1;

    return score;
}
