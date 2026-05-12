import type { Performance } from '@/types';

type VenueLike = {
    address?: string;
    lat?: number | null;
    lng?: number | null;
    latitude?: number | string;
    longitude?: number | string;
    district?: string;
    name?: string;
};

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

function normalizeWhitespace(value?: string) {
    return value?.replace(/\s+/g, ' ').trim() || '';
}

function normalizeRegionToken(token?: string) {
    if (!token) return '';
    return REGION_ALIASES[token] || token;
}

function sanitizeAddress(value?: string) {
    return normalizeWhitespace(value)
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
    venues: Record<string, VenueLike>
) {
    const bracketRegion = normalizeWhitespace(performance.bracketRegion);
    const performanceAddress = sanitizeAddress(performance.address);
    const cleanVenueName = normalizeWhitespace(performance.venue);

    if (!cleanVenueName) return undefined;

    const venueEntries = Object.entries(venues).filter(([key]) => key.includes(cleanVenueName));
    if (venueEntries.length === 0) return undefined;

    const byBracket = bracketRegion
        ? venueEntries.find(([key, venue]) => {
            const address = sanitizeAddress(venue.address);
            return key.includes(`[${bracketRegion}]`) || key.includes(bracketRegion) || address.includes(bracketRegion);
        })
        : undefined;

    if (byBracket) return byBracket[1];

    if (performanceAddress) {
        const [perfRegion, perfDistrict] = extractAddressTokens(performanceAddress);
        return venueEntries.find(([, venue]) => {
            const address = sanitizeAddress(venue.address);
            const [venueRegion, venueDistrict] = extractAddressTokens(address);
            if (!venueRegion) return false;
            if (perfRegion && perfRegion !== venueRegion) return false;
            if (perfDistrict && venueDistrict && perfDistrict !== venueDistrict) return false;
            return true;
        })?.[1];
    }

    return undefined;
}

export function resolveVenueInfoForPerformance(
    performance: Pick<Performance, 'venue' | 'address' | 'lat' | 'lng' | 'latitude' | 'longitude' | 'bracketRegion'>,
    venues: Record<string, VenueLike>
): VenueLike {
    const baseVenue = performance.venue ? venues[performance.venue] : undefined;
    const regionalVenue = findRegionalVenueMatch(performance, venues);
    const preferredVenue = regionalVenue || baseVenue || {};

    const performanceLat = parseCoordinate(performance.lat ?? performance.latitude);
    const performanceLng = parseCoordinate(performance.lng ?? performance.longitude);
    const performanceHasGeo = Boolean(performanceLat && performanceLng);
    const performanceAddress = sanitizeAddress(performance.address);
    const venueAddress = sanitizeAddress(preferredVenue.address);

    const shouldPreferPerformanceAddress =
        hasUsableAddress(performanceAddress) &&
        !isGenericAddressEcho(performanceAddress, performance.venue) &&
        (
            performanceHasGeo ||
            looksLikeDetailedAddress(performanceAddress) ||
            isSevereAddressMismatch(performanceAddress, venueAddress) ||
            !hasUsableAddress(venueAddress)
        );

    return {
        ...preferredVenue,
        address: shouldPreferPerformanceAddress ? performanceAddress : venueAddress,
        lat: performanceHasGeo ? performanceLat : parseCoordinate(preferredVenue.lat ?? preferredVenue.latitude),
        lng: performanceHasGeo ? performanceLng : parseCoordinate(preferredVenue.lng ?? preferredVenue.longitude),
        latitude: performanceHasGeo ? performanceLat : parseCoordinate(preferredVenue.latitude ?? preferredVenue.lat),
        longitude: performanceHasGeo ? performanceLng : parseCoordinate(preferredVenue.longitude ?? preferredVenue.lng),
    };
}

export function buildPerformanceLocationKey(
    performance: Pick<Performance, 'venue' | 'address' | 'lat' | 'lng' | 'latitude' | 'longitude' | 'bracketRegion'>,
    venues: Record<string, VenueLike>
) {
    const resolvedVenue = resolveVenueInfoForPerformance(performance, venues);
    const venueName = normalizeWhitespace(performance.venue) || normalizeWhitespace(resolvedVenue.name) || 'unknown-venue';
    const lat = parseCoordinate(resolvedVenue.lat ?? resolvedVenue.latitude);
    const lng = parseCoordinate(resolvedVenue.lng ?? resolvedVenue.longitude);

    if (lat && lng) {
        return `${venueName}::${lat.toFixed(5)},${lng.toFixed(5)}`;
    }

    const addressKey = normalizeAddressFingerprint(resolvedVenue.address);
    if (addressKey) {
        return `${venueName}::${addressKey}`;
    }

    return venueName;
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
