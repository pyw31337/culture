function slugify(text: string): string {
    // Better regex: Allow Alphanumeric and CJK (Korean, Japanese, Chinese)
    // \u3130-\u318F: Hangul Compatibility Jamo
    // \uAC00-\uD7AF: Hangul Syllables
    // \u3040-\u30FF: Hiragana & Katakana
    // \u4E00-\u9FFF: CJK Unified Ideographs
    const slug = text
        .replace(/[^\w\u3130-\u318F\uAC00-\uD7AF\u3040-\u30FF\u4E00-\u9FFF]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
    
    if (slug.length < 2) {
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            hash = (hash << 5) - hash + text.charCodeAt(i);
            hash |= 0;
        }
        return (slug || 'perf') + '_' + Math.abs(hash).toString(36);
    }
    return slug;
}

export function processAndMergePerformances(items: any[]): any[] {
    const uniqueMap = new Map<string, any>();
    const SPORTS_GENRES = ['baseball', 'basketball', 'volleyball', 'soccer', 'handball'];

    // Consistency: Any category that shares a prefix should share a merge key
    const prefixMap: Record<string, string> = {
        'musical': 'perf',
        'play': 'perf',
        'classic_tradition': 'perf',
        'exhibition': 'perf',
        'concert': 'perf',
        'activity': 'perf',
        'leisure': 'perf',
        'movie': 'movie',
        'festival': 'fest'
    };

    items.forEach(p => {
        // 1. Generate Merge Key
        const safeTitle = slugify(p.originalTitle || p.title);
        const category = p.genre || 'activity';
        const prefix = prefixMap[category] || category;

        let key = `${prefix}_${safeTitle}`;

        // Exception for Sports: Include Date in key
        if (SPORTS_GENRES.includes(category)) {
            const dateOnly = p.date?.split(' ')[0].replace(/[-.]/g, '') || '00000000';
            key = `${category}_${dateOnly}_${safeTitle}`;
        }

        if (uniqueMap.has(key)) {
            const existing = uniqueMap.get(key);
            uniqueMap.set(key, mergeItems(existing, p));
        } else {
            uniqueMap.set(key, { ...p });
        }
    });

    // 2. Final ID Generation
    return Array.from(uniqueMap.values()).map(p => {
        const safeTitle = slugify(p.originalTitle || p.title);
        const category = p.genre || 'activity';
        const prefix = prefixMap[category] || category;
        
        let stableId = `${prefix}_${safeTitle}`;

        if (SPORTS_GENRES.includes(category)) {
            const dateOnly = p.date?.split(' ')[0].replace(/[-.]/g, '') || '00000000';
            stableId = `${category}_${dateOnly}_${safeTitle}`;
        }

        return {
            ...p,
            id: stableId,
            originalId: p.id
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

    // Price & Discount (Important: Movie might have price)
    if (!merged.price && loser.price) {
        merged.price = loser.price;
        // If we duplicate price, we should probably check originalPrice too
        if (!merged.originalPrice) merged.originalPrice = loser.originalPrice;
        if (!merged.discount) merged.discount = loser.discount;
    }

    // Platforms
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
    if (!merged.reservationRate && loser.reservationRate) merged.reservationRate = loser.reservationRate;
    if (!merged.audienceCount && loser.audienceCount) merged.audienceCount = loser.audienceCount;
    if (!merged.budget && loser.budget) merged.budget = loser.budget;
    if (!merged.revenue && loser.revenue) merged.revenue = loser.revenue;
    if (!merged.budgetKRW && loser.budgetKRW) merged.budgetKRW = loser.budgetKRW;
    if (!merged.revenueKRW && loser.revenueKRW) merged.revenueKRW = loser.revenueKRW;
    if (!merged.synopsis && loser.synopsis) merged.synopsis = loser.synopsis;
    if (!merged.roi && loser.roi) merged.roi = loser.roi;
    if (!merged.trailer && loser.trailer) merged.trailer = loser.trailer;

    // MomMom & Detailed Metadata
    if (!merged.feesAndPrograms && loser.feesAndPrograms) merged.feesAndPrograms = loser.feesAndPrograms;
    if (!merged.targetAudience && loser.targetAudience) merged.targetAudience = loser.targetAudience;
    if (!merged.operatingHours && loser.operatingHours) merged.operatingHours = loser.operatingHours;
    if (!merged.priceDetail && loser.priceDetail) merged.priceDetail = loser.priceDetail;
    if (!merged.facilities && loser.facilities) merged.facilities = loser.facilities;
    if (!merged.website && loser.website) merged.website = loser.website;
    if (!merged.parking && loser.parking) merged.parking = loser.parking;
    if (!merged.parkingFee && loser.parkingFee) merged.parkingFee = loser.parkingFee;
    if (!merged.restrooms && loser.restrooms) merged.restrooms = loser.restrooms;
    if (!merged.closedDays && loser.closedDays) merged.closedDays = loser.closedDays;
    if (!merged.address && loser.address) merged.address = loser.address;
    if (!merged.latitude && loser.latitude) merged.latitude = loser.latitude;
    if (!merged.longitude && loser.longitude) merged.longitude = loser.longitude;
    if (!merged.contact && loser.contact) merged.contact = loser.contact;

    // Poster/Image
    // If winner has no valid image, try loser's
    if ((!merged.image || merged.image.includes('default') || merged.image === '') && (loser.image && !loser.image.includes('default'))) {
        merged.image = loser.image;
    }
    if ((!merged.poster || merged.poster.includes('default') || merged.poster === '') && (loser.poster && !loser.poster.includes('default'))) {
        merged.poster = loser.poster;
    }

    // Venue
    // Case: Movie (Cinema) vs Movie (Other). 
    // If scores favor the winner, keep it., maybe we want Cinema venue?
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
    if (item.ageRating || item.age) score += 1;
    if (item.originalTitle) score += 1;
    if (item.rank) score += 5; // HIGH Priority for ranked movies

    // Price is good
    if (item.price) score += 1;

    // Prefer items with real posters over placeholders
    if (item.image && !item.image.includes('default') && item.image.startsWith('http')) score += 1;

    return score;
}
