function slugify(text: string): string {
    return text
        .replace(/[^a-zA-Z0-9가-힣]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

export function processAndMergePerformances(items: any[]): any[] {
    const uniqueMap = new Map<string, any>();
    const SPORTS_GENRES = ['baseball', 'basketball', 'volleyball', 'soccer', 'handball'];

    items.forEach(p => {
        // 1. Generate Merge Key
        const safeTitle = slugify(p.title);
        let category = p.genre;

        // Grouping for Merge: 
        // We want to merge the same title if they are in similar categories
        // e.g. 'musical' vs 'performance' (historical)
        let mergeCategory = category;
        if (['musical', 'play', 'classic', 'classic_tradition', 'opera', 'concert', 'exhibition', 'dance'].includes(category)) {
            mergeCategory = 'live';
        }

        let key = `${mergeCategory}_${safeTitle}`;

        // Exception for Sports: Include Date in key to allow same teams playing on different days
        if (SPORTS_GENRES.includes(p.genre)) {
            const dateOnly = p.date?.split(' ')[0].replace(/-/g, '') || '00000000';
            key = `${p.genre}_${dateOnly}_${safeTitle}`;
        }

        if (uniqueMap.has(key)) {
            const existing = uniqueMap.get(key);
            const merged = mergeItems(existing, p);
            uniqueMap.set(key, merged);
        } else {
            uniqueMap.set(key, p);
        }
    });

    // 2. Final ID Generation
    return Array.from(uniqueMap.values()).map(p => {
        const safeTitle = slugify(p.title);
        let category = p.genre;

        // Map internal genres to public shared link prefixes
        const prefixMap: Record<string, string> = {
            'musical': 'perf',
            'play': 'perf',
            'classic_tradition': 'perf',
            'exhibition': 'perf',
            'concert': 'perf',
            'activity': 'perf',
            'leisure': 'perf',
            'movie': 'movie',
            'ott': 'ott',
            'festival': 'fest'
        };

        const prefix = prefixMap[category] || category;
        let stableId = `${prefix}_${safeTitle}`;

        if (SPORTS_GENRES.includes(category)) {
            const dateOnly = p.date?.split(' ')[0].replace(/-/g, '') || '00000000';
            stableId = `${category}_${dateOnly}_${safeTitle}`;
        }

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
    if (!merged.rank && loser.rank) merged.rank = loser.rank;

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
