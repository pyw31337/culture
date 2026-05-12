import { Performance } from '@/types';

/**
 * Safe array extractor.
 * Returns the input if it's an array.
 * Returns an empty array if input is null/undefined/object/primitive.
 * Useful for preventing "is not iterable" errors when spreading imported JSONs.
 */
export function safeArray<T>(data: any): T[] {
    if (Array.isArray(data)) return data;
    // Check if it's wrapped in { items: [] }
    if (data && typeof data === 'object' && Array.isArray(data.items)) return data.items;
    return [];
}

/**
 * Ensures a performance object has all required fields and safe defaults for optional ones.
 * This prevents client-side crashes (e.g., "Cannot read property 'includes' of undefined").
 */
export function safePerformance(data: any): Performance | null {
    if (!data || typeof data !== 'object') return null;

    // Critical fields - if missing, drop the item
    if (!data.title || typeof data.title !== 'string') return null;

    // Fallback for ID if missing (though page.tsx usually generates it)
    let id = data.id;
    if (!id || typeof id !== 'string') {
        // Create a temporary ID if absolutely needed, but better to rely on upstream
        id = `fallback_${Math.random().toString(36).slice(2)}`;
    }

    return {
        id: String(id),
        title: String(data.title),
        date: typeof data.date === 'string' ? data.date : '날짜 미정',
        venue: typeof data.venue === 'string' ? data.venue : '정보 없음', // "venue" is critical for filtering
        venueKey: typeof data.venueKey === 'string' ? data.venueKey : undefined,
        locationKey: typeof data.locationKey === 'string' ? data.locationKey : undefined,
        image: typeof data.image === 'string' ? data.image : '', // Fallback to empty string, UI handles fallback
        link: typeof data.link === 'string' && data.link.trim()
            ? data.link
            : (typeof data.website === 'string' && data.website.trim() ? data.website : '#'),
        region: typeof data.region === 'string' ? data.region : 'etc', // Default to 'etc' if unknown
        genre: typeof data.genre === 'string' ? data.genre : 'other',

        // Optional safe defaults
        description: typeof data.description === 'string' && data.description.trim()
            ? data.description
            : (data.synopsis ? String(data.synopsis) : undefined),
        discount: typeof data.discount === 'string' ? data.discount : undefined,
        originalPrice: typeof data.originalPrice === 'string' ? data.originalPrice : undefined,
        price: typeof data.price === 'string' ? data.price : undefined,
        gradeIcon: typeof data.gradeIcon === 'string' ? data.gradeIcon : undefined,

        // Movie metadata fields
        ageRating: typeof data.ageRating === 'string' ? data.ageRating : undefined,
        subGenre: typeof data.subGenre === 'string' ? data.subGenre : undefined,
        runningTime: typeof data.runningTime === 'string' ? data.runningTime : undefined,
        originalTitle: typeof data.originalTitle === 'string' ? data.originalTitle : undefined,
        productionCountry: typeof data.productionCountry === 'string' ? data.productionCountry : undefined,
        productionYear: typeof data.productionYear === 'string' || typeof data.productionYear === 'number' ? String(data.productionYear) : undefined,

        // Arrays

        cast: Array.isArray(data.cast) ? data.cast.filter((c: any) => typeof c === 'string') : [],

        // Other optionals
        director: typeof data.director === 'string' ? data.director : undefined,
        movieInfo: typeof data.movieInfo === 'string' ? data.movieInfo : undefined,
        homeTeam: typeof data.homeTeam === 'string' ? data.homeTeam : undefined,
        awayTeam: typeof data.awayTeam === 'string' ? data.awayTeam : undefined,
        homeTeamLogo: typeof data.homeTeamLogo === 'string' ? data.homeTeamLogo : undefined,
        awayTeamLogo: typeof data.awayTeamLogo === 'string' ? data.awayTeamLogo : undefined,
        backupPoster: typeof data.backupPoster === 'string'
            ? data.backupPoster
            : (typeof data.posterUrl === 'string' ? data.posterUrl : undefined),
        posterUrl: typeof data.posterUrl === 'string' ? data.posterUrl : undefined,
        category: typeof data.category === 'string' ? data.category : undefined,

        // Ranking & Enhanced Date
        rank: (typeof data.rank === 'number') ? data.rank : (typeof data.rank === 'string' && !isNaN(parseInt(data.rank)) ? parseInt(data.rank) : undefined),
        dateRaw: typeof data.dateRaw === 'string' ? data.dateRaw : undefined,

        // Location
        lat: typeof data.lat === 'number' ? data.lat : undefined,
        lng: typeof data.lng === 'number' ? data.lng : undefined,
        address: typeof data.address === 'string' ? data.address : undefined,
        source: typeof data.source === 'string' ? data.source : undefined,

        // Tourism & Enhanced Metadata
        website: typeof data.website === 'string' ? data.website : undefined,
        parking: typeof data.parking === 'string' ? data.parking : undefined,
        parkingFee: typeof data.parkingFee === 'string' ? data.parkingFee : undefined,
        facilities: typeof data.facilities === 'string' ? data.facilities : undefined,
        restrooms: typeof data.restrooms === 'string' ? data.restrooms : undefined,
        performanceTime: typeof data.performanceTime === 'string' ? data.performanceTime : undefined,
        bookingNotice: typeof data.bookingNotice === 'string' ? data.bookingNotice : undefined,
        ageDetail: typeof data.ageDetail === 'string' ? data.ageDetail : undefined,
        
        // MomMom & Detailed Metadata
        feesAndPrograms: typeof data.feesAndPrograms === 'string' ? data.feesAndPrograms : undefined,
        targetAudience: typeof data.targetAudience === 'string' ? data.targetAudience : undefined,
        operatingHours: typeof data.operatingHours === 'string' ? data.operatingHours : undefined,
        priceDetail: typeof data.priceDetail === 'string' ? data.priceDetail : undefined,
        closedDays: typeof data.closedDays === 'string' ? data.closedDays : undefined,
        contact: typeof data.contact === 'string' ? data.contact : undefined,
        
        // Movie & Meta Stats
        synopsis: data.synopsis ? String(data.synopsis) : undefined,
        trailer: data.trailer ? String(data.trailer) : undefined,
        roi: (data.roi !== undefined && data.roi !== null) ? String(data.roi) : undefined,
        reservationRate: data.reservationRate ? String(data.reservationRate) : undefined,
        audienceCount: data.audienceCount ? String(data.audienceCount) : undefined,
        budget: (data.budget !== undefined && data.budget !== null) ? String(data.budget) : undefined,
        revenue: (data.revenue !== undefined && data.revenue !== null) ? String(data.revenue) : undefined,
        budgetKRW: (data.budgetKRW !== undefined && data.budgetKRW !== null) ? String(data.budgetKRW) : undefined,
        revenueKRW: (data.revenueKRW !== undefined && data.revenueKRW !== null) ? String(data.revenueKRW) : undefined,
        statsCollectedAt: typeof data.statsCollectedAt === 'string'
            ? data.statsCollectedAt
            : (typeof data.lastCollected === 'string' ? data.lastCollected : undefined),
    };
}

/**
 * Safe list processor
 */
export function safePerformanceList(list: any[]): Performance[] {
    if (!Array.isArray(list)) return [];
    return list.map(safePerformance).filter((p): p is Performance => p !== null);
}
