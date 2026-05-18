function slugify(text: string): string {
    return text
        .replace(/[^a-zA-Z0-9가-힣]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

function hasUsableLink(value: unknown): value is string {
    return typeof value === 'string' && value.trim() !== '' && value.trim() !== '#';
}

function hasUsableImage(value: unknown): value is string {
    return typeof value === 'string' && value.trim() !== '' && !value.includes('default');
}

function hasNonEmptyArray(value: unknown): value is unknown[] {
    return Array.isArray(value) && value.length > 0;
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
            const dateOnly = p.date?.split(' ')[0].replace(/[-.]/g, '') || '00000000';
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
            'festival': 'fest'
        };

        const prefix = prefixMap[category] || category;
        let stableId = `${prefix}_${safeTitle}`;

        if (SPORTS_GENRES.includes(category)) {
            const dateOnly = p.date?.split(' ')[0].replace(/[-.]/g, '') || '00000000';
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

    // Price & Discount (Important: Movie might have price)
    if (!merged.price && loser.price) {
        merged.price = loser.price;
        // If we duplicate price, we should probably check originalPrice too
        if (!merged.originalPrice) merged.originalPrice = loser.originalPrice;
        if (!merged.discount) merged.discount = loser.discount;
    }
    if (!hasUsableLink(merged.link) && hasUsableLink(loser.link)) merged.link = loser.link;
    if (!hasUsableLink(merged.website) && hasUsableLink(loser.website)) merged.website = loser.website;

    // Enriched arrays
    if (!hasNonEmptyArray(merged.platforms) && hasNonEmptyArray(loser.platforms)) merged.platforms = loser.platforms;
    if (!hasNonEmptyArray(merged.stillImages) && hasNonEmptyArray(loser.stillImages)) merged.stillImages = loser.stillImages;
    if (!hasNonEmptyArray(merged.keywords) && hasNonEmptyArray(loser.keywords)) merged.keywords = loser.keywords;
    if (!hasNonEmptyArray(merged.synopsisImages) && hasNonEmptyArray(loser.synopsisImages)) merged.synopsisImages = loser.synopsisImages;
    if (!hasNonEmptyArray(merged.priceList) && hasNonEmptyArray(loser.priceList)) merged.priceList = loser.priceList;
    if (!hasNonEmptyArray(merged.venueAmenities) && hasNonEmptyArray(loser.venueAmenities)) merged.venueAmenities = loser.venueAmenities;

    // Metadata (Cast, Director, Runtime, etc.)
    if (!merged.cast && loser.cast) merged.cast = loser.cast;
    if (!merged.director && loser.director) merged.director = loser.director;
    if (!merged.runningTime && loser.runningTime) merged.runningTime = loser.runningTime;
    if (!merged.ageRating && loser.ageRating) merged.ageRating = loser.ageRating;
    if (!merged.originalTitle && loser.originalTitle) merged.originalTitle = loser.originalTitle;
    if (!merged.productionCountry && loser.productionCountry) merged.productionCountry = loser.productionCountry;
    if (!merged.productionYear && loser.productionYear) merged.productionYear = loser.productionYear;
    if (!merged.movieInfo && loser.movieInfo) merged.movieInfo = loser.movieInfo;
    if (!merged.subGenre && loser.subGenre) merged.subGenre = loser.subGenre;
    if (!merged.rank && loser.rank) merged.rank = loser.rank;
    if (!merged.reservationRate && loser.reservationRate) merged.reservationRate = loser.reservationRate;
    if (!merged.audienceCount && loser.audienceCount) merged.audienceCount = loser.audienceCount;
    if (!merged.budget && loser.budget) merged.budget = loser.budget;
    if (!merged.revenue && loser.revenue) merged.revenue = loser.revenue;
    if (!merged.budgetKRW && loser.budgetKRW) merged.budgetKRW = loser.budgetKRW;
    if (!merged.revenueKRW && loser.revenueKRW) merged.revenueKRW = loser.revenueKRW;
    if (!merged.description && loser.description) merged.description = loser.description;
    if (!merged.synopsis && loser.synopsis) merged.synopsis = loser.synopsis;
    if (!merged.roi && loser.roi) merged.roi = loser.roi;
    if (!merged.trailer && loser.trailer) merged.trailer = loser.trailer;
    if (!merged.statsCollectedAt && loser.statsCollectedAt) merged.statsCollectedAt = loser.statsCollectedAt;
    if (!merged.tagline && loser.tagline) merged.tagline = loser.tagline;
    if (!merged.voteAverage && loser.voteAverage) merged.voteAverage = loser.voteAverage;
    if (!merged.voteCount && loser.voteCount) merged.voteCount = loser.voteCount;
    if (!merged.popularity && loser.popularity) merged.popularity = loser.popularity;
    if (!merged.openRun && loser.openRun) merged.openRun = loser.openRun;
    if (!merged.performanceState && loser.performanceState) merged.performanceState = loser.performanceState;
    if (!merged.lastModifiedAt && loser.lastModifiedAt) merged.lastModifiedAt = loser.lastModifiedAt;
    if (!merged.dataCollectedAt && loser.dataCollectedAt) merged.dataCollectedAt = loser.dataCollectedAt;
    if (!merged.production && loser.production) merged.production = loser.production;
    if (!merged.host && loser.host) merged.host = loser.host;
    if (!merged.organizer && loser.organizer) merged.organizer = loser.organizer;
    if (!merged.planner && loser.planner) merged.planner = loser.planner;
    if (!merged.producer && loser.producer) merged.producer = loser.producer;
    if (!merged.sponsor && loser.sponsor) merged.sponsor = loser.sponsor;
    if (!merged.venuePhone && loser.venuePhone) merged.venuePhone = loser.venuePhone;
    if (!merged.venueHomepage && loser.venueHomepage) merged.venueHomepage = loser.venueHomepage;
    if (!merged.venueFacilityType && loser.venueFacilityType) merged.venueFacilityType = loser.venueFacilityType;
    if (!merged.venueSeatScale && loser.venueSeatScale) merged.venueSeatScale = loser.venueSeatScale;
    if (!merged.venueTheaterCount && loser.venueTheaterCount) merged.venueTheaterCount = loser.venueTheaterCount;
    if (!merged.venueOpenedAt && loser.venueOpenedAt) merged.venueOpenedAt = loser.venueOpenedAt;
    if (!merged.placeProvider && loser.placeProvider) merged.placeProvider = loser.placeProvider;
    if (!merged.placeId && loser.placeId) merged.placeId = loser.placeId;
    if (!merged.placeUrl && loser.placeUrl) merged.placeUrl = loser.placeUrl;
    if (!merged.placeCategory && loser.placeCategory) merged.placeCategory = loser.placeCategory;

    // MomMom & Detailed Metadata
    if (!merged.feesAndPrograms && loser.feesAndPrograms) merged.feesAndPrograms = loser.feesAndPrograms;
    if (!merged.targetAudience && loser.targetAudience) merged.targetAudience = loser.targetAudience;
    if (!merged.operatingHours && loser.operatingHours) merged.operatingHours = loser.operatingHours;
    if (!merged.priceDetail && loser.priceDetail) merged.priceDetail = loser.priceDetail;
    if (!merged.facilities && loser.facilities) merged.facilities = loser.facilities;
    if (!hasUsableLink(merged.website) && hasUsableLink(loser.website)) merged.website = loser.website;
    if (!merged.parking && loser.parking) merged.parking = loser.parking;
    if (!merged.parkingFee && loser.parkingFee) merged.parkingFee = loser.parkingFee;
    if (!merged.restrooms && loser.restrooms) merged.restrooms = loser.restrooms;
    if (!merged.closedDays && loser.closedDays) merged.closedDays = loser.closedDays;
    if (!merged.address && loser.address) merged.address = loser.address;
    if (!merged.latitude && loser.latitude) merged.latitude = loser.latitude;
    if (!merged.longitude && loser.longitude) merged.longitude = loser.longitude;
    if (!merged.contact && loser.contact) merged.contact = loser.contact;
    if (!merged.reservationInfo && loser.reservationInfo) merged.reservationInfo = loser.reservationInfo;
    if (!merged.bookingNotice && loser.bookingNotice) merged.bookingNotice = loser.bookingNotice;
    if (!merged.ageDetail && loser.ageDetail) merged.ageDetail = loser.ageDetail;
    if (!merged.sourceUpdatedAt && loser.sourceUpdatedAt) merged.sourceUpdatedAt = loser.sourceUpdatedAt;
    if (!merged.instagram && loser.instagram) merged.instagram = loser.instagram;
    if (!merged.foodInfo && loser.foodInfo) merged.foodInfo = loser.foodInfo;
    if (!merged.venueKey && loser.venueKey) merged.venueKey = loser.venueKey;
    if (!merged.locationKey && loser.locationKey) merged.locationKey = loser.locationKey;

    // Poster/Image
    // If winner has no valid image, try loser's
    if (!hasUsableImage(merged.image) && hasUsableImage(loser.image)) {
        merged.image = loser.image;
    }
    if (!hasUsableImage(merged.poster) && hasUsableImage(loser.poster)) {
        merged.poster = loser.poster;
    }
    if (!merged.backupPoster && loser.backupPoster) merged.backupPoster = loser.backupPoster;
    if (!merged.posterUrl && loser.posterUrl) merged.posterUrl = loser.posterUrl;
    if (!merged.backupPoster && typeof loser.image === 'string' && loser.image.startsWith('http')) {
        merged.backupPoster = loser.image;
    }
    if (!hasUsableLink(merged.link) && hasUsableLink(merged.website)) {
        merged.link = merged.website;
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
    if (item.ageRating) score += 1;
    if (item.originalTitle) score += 1;
    if (hasNonEmptyArray(item.keywords)) score += 1;
    if (hasNonEmptyArray(item.stillImages)) score += 1;
    if (item.performanceState) score += 1;
    if (hasNonEmptyArray(item.venueAmenities)) score += 1;
    if (item.venueSeatScale) score += 1;

    // Price is good, but shouldn't override metadata (unless metadata is equal)
    if (item.price) score += 1;

    // Prefer items with real posters over placeholders
    if (hasUsableImage(item.image) && item.image.startsWith('http')) score += 1;

    return score;
}
