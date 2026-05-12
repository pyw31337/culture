import type { FavoriteVenuePreference, Performance } from '@/types';
import { buildPerformanceLocationKey, getPerformanceVenueKey, getRepresentativeVenueInfoForName, resolveVenueInfoForPerformance } from './location-display';

type VenueLike = {
    address?: string;
    lat?: number | null;
    lng?: number | null;
    latitude?: number | string;
    longitude?: number | string;
    district?: string;
    name?: string;
};

function normalizeWhitespace(value?: string | null) {
    return (value || '').replace(/\s+/g, ' ').trim();
}

function normalizeIdentity(value?: string | null) {
    return normalizeWhitespace(value).toLowerCase().normalize('NFC');
}

function parseCoordinate(value?: number | string | null) {
    if (typeof value === 'number' && Number.isFinite(value) && value !== 0) return value;
    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed) && parsed !== 0) return parsed;
    }
    return undefined;
}

function hasUsableValue(value?: string | null) {
    return Boolean(normalizeWhitespace(value));
}

function scoreFavoriteVenueEntry(entry: FavoriteVenuePreference) {
    let score = 0;
    if (entry.locationKey) score += 4;
    if (entry.venueKey) score += 3;
    if (entry.address) score += 2;
    if (entry.lat && entry.lng) score += 2;
    if (entry.venueName) score += 1;
    return score;
}

export function buildFavoriteVenueId(input: Pick<FavoriteVenuePreference, 'venueName' | 'venueKey' | 'locationKey'>) {
    const locationKey = normalizeIdentity(input.locationKey);
    if (locationKey) return `location:${locationKey}`;

    const venueKey = normalizeIdentity(input.venueKey);
    if (venueKey) return `venue:${venueKey}`;

    const venueName = normalizeIdentity(input.venueName);
    return `name:${venueName || 'unknown'}`;
}

export function normalizeFavoriteVenuePreference(value: unknown): FavoriteVenuePreference | null {
    if (typeof value === 'string') {
        const venueName = normalizeWhitespace(value);
        if (!venueName) return null;

        return {
            id: buildFavoriteVenueId({ venueName }),
            venueName,
        };
    }

    if (!value || typeof value !== 'object') return null;

    const candidate = value as Partial<FavoriteVenuePreference> & {
        name?: string;
        venue?: string;
    };

    const venueName = normalizeWhitespace(candidate.venueName || candidate.name || candidate.venue);
    if (!venueName) return null;

    const normalized: FavoriteVenuePreference = {
        id: buildFavoriteVenueId({
            venueName,
            venueKey: candidate.venueKey,
            locationKey: candidate.locationKey,
        }),
        venueName,
    };

    if (hasUsableValue(candidate.venueKey)) normalized.venueKey = normalizeWhitespace(candidate.venueKey);
    if (hasUsableValue(candidate.locationKey)) normalized.locationKey = normalizeWhitespace(candidate.locationKey);
    if (hasUsableValue(candidate.address)) normalized.address = normalizeWhitespace(candidate.address);

    const lat = parseCoordinate(candidate.lat);
    const lng = parseCoordinate(candidate.lng);
    if (lat && lng) {
        normalized.lat = lat;
        normalized.lng = lng;
    }

    return normalized;
}

export function dedupeFavoriteVenuePreferences(items: FavoriteVenuePreference[]) {
    const byId = new Map<string, FavoriteVenuePreference>();

    items.forEach((item) => {
        const existing = byId.get(item.id);
        if (!existing || scoreFavoriteVenueEntry(item) > scoreFavoriteVenueEntry(existing)) {
            byId.set(item.id, item);
        }
    });

    return Array.from(byId.values());
}

export function createFavoriteVenuePreference(input: Omit<FavoriteVenuePreference, 'id'>) {
    const normalized = normalizeFavoriteVenuePreference(input);
    if (!normalized) {
        throw new Error('유효하지 않은 favorite venue 입력입니다.');
    }
    return normalized;
}

export function favoriteVenueMatchesIdentity(
    favorite: FavoriteVenuePreference,
    candidate: Pick<FavoriteVenuePreference, 'venueName' | 'venueKey' | 'locationKey'>
) {
    if (favorite.locationKey && candidate.locationKey) {
        return normalizeIdentity(favorite.locationKey) === normalizeIdentity(candidate.locationKey);
    }

    if (favorite.venueKey && candidate.venueKey) {
        return normalizeIdentity(favorite.venueKey) === normalizeIdentity(candidate.venueKey);
    }

    return normalizeIdentity(favorite.venueName) === normalizeIdentity(candidate.venueName);
}

export function favoriteVenueMatchesPerformance(
    favorite: FavoriteVenuePreference,
    performance: Pick<Performance, 'venue' | 'venueKey' | 'locationKey' | 'address' | 'lat' | 'lng' | 'latitude' | 'longitude' | 'bracketRegion'>,
    venues?: Record<string, VenueLike>
) {
    const venueKey = performance.venueKey || (venues ? getPerformanceVenueKey(performance, venues) : undefined);
    const locationKey = performance.locationKey || (venues ? buildPerformanceLocationKey(performance, venues) : undefined);

    return favoriteVenueMatchesIdentity(favorite, {
        venueName: performance.venue,
        venueKey,
        locationKey,
    });
}

export function getRepresentativeVenueInfoForFavorite(
    favorite: FavoriteVenuePreference,
    performances: Array<Pick<Performance, 'venue' | 'venueKey' | 'locationKey' | 'address' | 'lat' | 'lng' | 'latitude' | 'longitude' | 'bracketRegion'>>,
    venues: Record<string, VenueLike>
) {
    if (favorite.lat && favorite.lng) {
        return {
            venueName: favorite.venueName,
            address: favorite.address,
            lat: favorite.lat,
            lng: favorite.lng,
            venueKey: favorite.venueKey,
            locationKey: favorite.locationKey,
        };
    }

    const matchingPerformances = performances.filter((performance) => favoriteVenueMatchesPerformance(favorite, performance, venues));
    if (matchingPerformances.length === 0) {
        const representative = getRepresentativeVenueInfoForName(favorite.venueName, performances, venues);
        return {
            ...representative,
            venueName: favorite.venueName,
            venueKey: favorite.venueKey,
            locationKey: favorite.locationKey,
        };
    }

    const grouped = new Map<string, { count: number; firstIndex: number; venue: VenueLike }>();

    matchingPerformances.forEach((performance, index) => {
        const key = performance.locationKey || buildPerformanceLocationKey(performance, venues);
        const existing = grouped.get(key);
        if (existing) {
            existing.count += 1;
            return;
        }

        grouped.set(key, {
            count: 1,
            firstIndex: index,
            venue: resolveVenueInfoForPerformance(performance, venues),
        });
    });

    const bestMatch = Array.from(grouped.entries())
        .sort((left, right) => {
            const leftPreferred = favorite.locationKey && normalizeIdentity(left[0]) === normalizeIdentity(favorite.locationKey);
            const rightPreferred = favorite.locationKey && normalizeIdentity(right[0]) === normalizeIdentity(favorite.locationKey);

            if (leftPreferred !== rightPreferred) return rightPreferred ? 1 : -1;

            if (right[1].count !== left[1].count) return right[1].count - left[1].count;
            return left[1].firstIndex - right[1].firstIndex;
        })[0];

    return {
        venueName: favorite.venueName,
        address: bestMatch?.[1].venue.address || favorite.address,
        lat: bestMatch?.[1].venue.lat || favorite.lat,
        lng: bestMatch?.[1].venue.lng || favorite.lng,
        venueKey: favorite.venueKey,
        locationKey: bestMatch?.[0] || favorite.locationKey,
    };
}
