import type { Performance } from '@/types';
import { collapseDuplicateLeadingLocationToken, normalizeLocationWhitespace } from '@/lib/location-text';

type VenueLike = {
    address?: string;
    lat?: number | null;
    lng?: number | null;
    latitude?: number | string;
    longitude?: number | string;
    district?: string;
    name?: string;
};

type VenueEntryMatch = {
    key: string;
    venue: VenueLike;
};

type VenueLookup = Record<string, VenueLike>;

type VenueLookupCache = {
    entries: VenueEntryMatch[];
    candidateEntriesByVenueName: Map<string, VenueEntryMatch[]>;
    resolvedVenueByPerformance: Map<string, VenueLike>;
};

const venueLookupCaches = new WeakMap<VenueLookup, VenueLookupCache>();
const MAX_RESOLVED_VENUE_CACHE_SIZE = 30000;

function getVenueLookupCache(venues: VenueLookup) {
    let cache = venueLookupCaches.get(venues);
    if (cache) return cache;

    cache = {
        entries: Object.entries(venues).map(([key, venue]) => ({ key, venue })),
        candidateEntriesByVenueName: new Map(),
        resolvedVenueByPerformance: new Map(),
    };
    venueLookupCaches.set(venues, cache);
    return cache;
}

const REGION_ALIASES: Record<string, string> = {
    서울특별시: '서울',
    서울시: '서울',
    부산광역시: '부산',
    부산시: '부산',
    대구광역시: '대구',
    대구시: '대구',
    인천광역시: '인천',
    인천시: '인천',
    광주광역시: '광주',
    광주시: '광주',
    대전광역시: '대전',
    대전시: '대전',
    울산광역시: '울산',
    울산시: '울산',
    세종특별자치시: '세종',
    경기도: '경기',
    강원특별자치도: '강원',
    강원도: '강원',
    충청북도: '충북',
    충청남도: '충남',
    전북특별자치도: '전북',
    전라북도: '전북',
    전라남도: '전남',
    경상북도: '경북',
    경상남도: '경남',
    제주특별자치도: '제주',
    제주도: '제주',
};

const KNOWN_REGION_TOKENS = new Set<string>([
    ...Object.keys(REGION_ALIASES),
    ...Object.values(REGION_ALIASES),
]);
const KNOWN_SELLER_ADDRESS_PATTERNS = [
    /제주특별자치도\s*제주시\s*청사로\s*11/,
    /서울특별시\s*동작구\s*사당로29가길\s*26/,
    /서울특별시\s*강남구\s*언주로\s*415/,
    /서울특별시\s*강남구\s*논현로149길\s*64/,
    /서울특별시\s*강남구\s*남부순환로\s*2732/,
    /서울특별시\s*강남구\s*영동대로96길\s*34/,
    /서울특별시\s*마포구\s*큰우물로\s*76/,
];

function normalizeWhitespace(value?: string) {
    return normalizeLocationWhitespace(value);
}

function isKnownSellerAddress(value?: string) {
    const address = normalizeWhitespace(value);
    return Boolean(address && KNOWN_SELLER_ADDRESS_PATTERNS.some((pattern) => pattern.test(address)));
}

function normalizeRegionToken(token?: string) {
    if (!token) return '';
    return REGION_ALIASES[token] || token;
}

function sanitizeAddress(value?: string) {
    return collapseDuplicateLeadingLocationToken(value)
        .replace(/지도보기$/g, '')
        .replace(/\s*\|\s*/g, ' ')
        .trim();
}

function normalizeAddressFingerprint(value?: string) {
    return sanitizeAddress(value).toLowerCase();
}

function extractAddressTokens(address?: string) {
    const cleaned = sanitizeAddress(address);
    const parts = cleaned.split(' ').filter(Boolean);
    return parts.map((part, index) => (index === 0 ? normalizeRegionToken(part) : part));
}

function parseCoordinate(value?: number | string | null) {
    if (typeof value === 'number' && Number.isFinite(value) && value !== 0) return value;
    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed) && parsed !== 0) return parsed;
    }
    return undefined;
}

function buildVenueResolutionCacheKey(
    performance: Pick<Performance, 'venue' | 'address' | 'lat' | 'lng' | 'latitude' | 'longitude' | 'bracketRegion'>
) {
    return [
        normalizeWhitespace(performance.venue),
        sanitizeAddress(performance.address),
        normalizeWhitespace(performance.bracketRegion),
        parseCoordinate(performance.lat ?? performance.latitude) ?? '',
        parseCoordinate(performance.lng ?? performance.longitude) ?? '',
    ].join('::');
}

function hasUsableAddress(value?: string) {
    const cleaned = sanitizeAddress(value);
    return Boolean(cleaned && cleaned !== '정보 없음');
}

function looksLikeDetailedAddress(value?: string) {
    const tokens = extractAddressTokens(value);
    if (tokens.length < 2) return false;

    const [first, second] = tokens;
    if (KNOWN_REGION_TOKENS.has(first)) return true;
    if (/(시|도|군|구)$/.test(first)) return true;
    if (/(시|군|구)$/.test(second)) return true;
    return false;
}

function isGenericAddressEcho(value?: string, venue?: string) {
    const cleaned = sanitizeAddress(value);
    const venueName = normalizeWhitespace(venue);
    if (!cleaned || !venueName) return false;
    return cleaned === venueName;
}

export function isSevereAddressMismatch(left?: string, right?: string) {
    if (!hasUsableAddress(left) || !hasUsableAddress(right)) return false;

    const [leftRegion, leftDistrict] = extractAddressTokens(left);
    const [rightRegion, rightDistrict] = extractAddressTokens(right);

    if (!leftRegion || !rightRegion) return false;
    if (leftRegion !== rightRegion) return true;

    return Boolean(leftDistrict && rightDistrict && leftDistrict !== rightDistrict);
}

function findRegionalVenueMatch(
    performance: Pick<Performance, 'venue' | 'address' | 'bracketRegion'>,
    venues: VenueLookup
): VenueEntryMatch | undefined {
    const bracketRegion = normalizeWhitespace(performance.bracketRegion);
    const performanceAddress = sanitizeAddress(performance.address);
    const cleanVenueName = normalizeWhitespace(performance.venue);

    if (!cleanVenueName) return undefined;

    const lookupCache = getVenueLookupCache(venues);
    let venueEntries = lookupCache.candidateEntriesByVenueName.get(cleanVenueName);
    if (!venueEntries) {
        venueEntries = lookupCache.entries.filter(({ key }) => key.includes(cleanVenueName));
        lookupCache.candidateEntriesByVenueName.set(cleanVenueName, venueEntries);
    }
    if (venueEntries.length === 0) return undefined;

    const byBracket = bracketRegion
        ? venueEntries.find(({ key, venue }) => {
            const address = sanitizeAddress(venue.address);
            return key.includes(`[${bracketRegion}]`) || key.includes(bracketRegion) || address.includes(bracketRegion);
        })
        : undefined;

    if (byBracket) {
        return {
            key: byBracket.key,
            venue: byBracket.venue,
        };
    }

    if (performanceAddress) {
        const [perfRegion, perfDistrict] = extractAddressTokens(performanceAddress);
        const addressMatch = venueEntries.find(({ venue }) => {
            const address = sanitizeAddress(venue.address);
            const [venueRegion, venueDistrict] = extractAddressTokens(address);
            if (!venueRegion) return false;
            if (perfRegion && perfRegion !== venueRegion) return false;
            if (perfDistrict && venueDistrict && perfDistrict !== venueDistrict) return false;
            return true;
        });

        if (addressMatch) {
            return {
                key: addressMatch.key,
                venue: addressMatch.venue,
            };
        }
    }

    return undefined;
}

function resolveVenueEntryForPerformance(
    performance: Pick<Performance, 'venue' | 'address' | 'bracketRegion'>,
    venues: VenueLookup
) {
    const cleanVenueName = normalizeWhitespace(performance.venue);
    const bracketRegion = normalizeWhitespace(performance.bracketRegion);
    const performanceAddress = sanitizeAddress(performance.address);
    const [perfRegion] = extractAddressTokens(performanceAddress);
    const exactMatch = cleanVenueName && venues[cleanVenueName]
        ? { key: cleanVenueName, venue: venues[cleanVenueName] }
        : undefined;
    const regionalMatch = findRegionalVenueMatch(performance, venues);
    const safeRegionalMatch = regionalMatch && exactMatch && looksLikeDetailedAddress(regionalMatch.key)
        ? undefined
        : regionalMatch;
    const preferredMatch = safeRegionalMatch || exactMatch;
    const fallbackRegionalKey =
        cleanVenueName && (bracketRegion || perfRegion) && (
            !exactMatch ||
            isSevereAddressMismatch(performanceAddress, sanitizeAddress(exactMatch.venue.address))
        )
            ? `${cleanVenueName} [${bracketRegion || perfRegion}]`
            : '';
    const shouldPreferDerivedRegionalKey = !regionalMatch && Boolean(fallbackRegionalKey);

    return {
        venueKey: safeRegionalMatch?.key || (shouldPreferDerivedRegionalKey ? fallbackRegionalKey : exactMatch?.key) || cleanVenueName || 'unknown-venue',
        preferredVenue: preferredMatch?.venue || {},
    };
}

export function getPerformanceVenueKey(
    performance: Pick<Performance, 'venue' | 'address' | 'bracketRegion'>,
    venues: VenueLookup
) {
    return resolveVenueEntryForPerformance(performance, venues).venueKey;
}

export function resolveVenueInfoForPerformance(
    performance: Pick<Performance, 'venue' | 'address' | 'lat' | 'lng' | 'latitude' | 'longitude' | 'bracketRegion'>,
    venues: VenueLookup
): VenueLike {
    const lookupCache = getVenueLookupCache(venues);
    const cacheKey = buildVenueResolutionCacheKey(performance);
    const cachedVenue = lookupCache.resolvedVenueByPerformance.get(cacheKey);
    if (cachedVenue) return cachedVenue;

    const { preferredVenue } = resolveVenueEntryForPerformance(performance, venues);

    const performanceLat = parseCoordinate(performance.lat ?? performance.latitude);
    const performanceLng = parseCoordinate(performance.lng ?? performance.longitude);
    const performanceHasGeo = Boolean(performanceLat && performanceLng);
    const performanceAddress = sanitizeAddress(performance.address);
    const venueAddress = sanitizeAddress(preferredVenue.address);

    const shouldPreferPerformanceAddress =
        hasUsableAddress(performanceAddress) &&
        !isKnownSellerAddress(performanceAddress) &&
        !isGenericAddressEcho(performanceAddress, performance.venue) &&
        (
            performanceHasGeo ||
            looksLikeDetailedAddress(performanceAddress) ||
            isSevereAddressMismatch(performanceAddress, venueAddress) ||
            !hasUsableAddress(venueAddress)
        );

    const resolvedVenue = {
        ...preferredVenue,
        address: shouldPreferPerformanceAddress ? performanceAddress : venueAddress,
        lat: performanceHasGeo ? performanceLat : parseCoordinate(preferredVenue.lat ?? preferredVenue.latitude),
        lng: performanceHasGeo ? performanceLng : parseCoordinate(preferredVenue.lng ?? preferredVenue.longitude),
        latitude: performanceHasGeo ? performanceLat : parseCoordinate(preferredVenue.latitude ?? preferredVenue.lat),
        longitude: performanceHasGeo ? performanceLng : parseCoordinate(preferredVenue.longitude ?? preferredVenue.lng),
    };

    if (lookupCache.resolvedVenueByPerformance.size > MAX_RESOLVED_VENUE_CACHE_SIZE) {
        lookupCache.resolvedVenueByPerformance.clear();
    }
    lookupCache.resolvedVenueByPerformance.set(cacheKey, resolvedVenue);
    return resolvedVenue;
}

export function buildPerformanceLocationKey(
    performance: Pick<Performance, 'venue' | 'address' | 'lat' | 'lng' | 'latitude' | 'longitude' | 'bracketRegion'>,
    venues: Record<string, VenueLike>
) {
    const venueKey = getPerformanceVenueKey(performance, venues);
    const resolvedVenue = resolveVenueInfoForPerformance(performance, venues);
    const lat = parseCoordinate(resolvedVenue.lat ?? resolvedVenue.latitude);
    const lng = parseCoordinate(resolvedVenue.lng ?? resolvedVenue.longitude);

    if (lat && lng) {
        return `${venueKey}::${lat.toFixed(5)},${lng.toFixed(5)}`;
    }

    const addressKey = normalizeAddressFingerprint(resolvedVenue.address);
    if (addressKey) {
        return `${venueKey}::${addressKey}`;
    }

    return venueKey;
}

export function getRepresentativeVenueInfoForName(
    venueName: string,
    performances: Array<Pick<Performance, 'venue' | 'address' | 'lat' | 'lng' | 'latitude' | 'longitude' | 'bracketRegion'>>,
    venues: Record<string, VenueLike>
) {
    const baseVenue = venues[venueName] || {};
    const matchingPerformances = performances.filter((performance) => normalizeWhitespace(performance.venue) === normalizeWhitespace(venueName));

    if (matchingPerformances.length === 0) {
        return {
            venueName,
            ...baseVenue,
        };
    }

    const grouped = new Map<string, { count: number; firstIndex: number; venue: VenueLike }>();

    matchingPerformances.forEach((performance, index) => {
        const key = buildPerformanceLocationKey(performance, venues);
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

    const bestMatch = Array.from(grouped.values()).sort((left, right) => {
        if (right.count !== left.count) return right.count - left.count;
        return left.firstIndex - right.firstIndex;
    })[0];

    return {
        venueName,
        ...baseVenue,
        ...bestMatch?.venue,
    };
}

export function getPerformanceLocationLabel(
    performance: Pick<Performance, 'venue' | 'address' | 'lat' | 'lng' | 'latitude' | 'longitude' | 'bracketRegion'>,
    venues: Record<string, VenueLike>,
    maxParts = 3
) {
    const resolvedVenue = resolveVenueInfoForPerformance(performance, venues);
    const address = sanitizeAddress(resolvedVenue.address);

    if (!hasUsableAddress(address)) {
        return normalizeWhitespace(performance.venue);
    }

    const parts = extractAddressTokens(address);
    return parts.slice(0, Math.max(1, maxParts)).join(' ');
}
