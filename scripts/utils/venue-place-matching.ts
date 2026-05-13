import type { VenueMasterEntry } from './venue-master';

export type VenuePlaceProvider = 'kakao' | 'naver';

export type VenuePlaceCandidate = {
    provider: VenuePlaceProvider;
    providerPlaceId: string;
    name: string;
    roadAddressName?: string;
    addressName?: string;
    lat?: number | null;
    lng?: number | null;
    phone?: string;
    url?: string;
    categoryName?: string;
};

export type VenuePlaceCacheEntry = {
    venueId: string;
    status: 'matched' | 'needs_review' | 'not_found';
    provider?: VenuePlaceProvider;
    providerPlaceId?: string;
    officialName?: string;
    roadAddressName?: string;
    addressName?: string;
    lat?: number | null;
    lng?: number | null;
    phone?: string;
    url?: string;
    categoryName?: string;
    confidence: number;
    matchedAt: string;
    checkedAt: string;
    query: string;
    reason: string;
};

export type VenuePlaceCache = Record<string, VenuePlaceCacheEntry>;

export type VenuePlaceLookupQueueItem = {
    venueId: string;
    officialName: string;
    address: string;
    query: string;
    priority: number;
    performanceCount: number;
    reviewFlags: string[];
    sampleTitles: string[];
};

export type VenuePlaceMatchingReport = {
    checkedAt: string;
    status: 'pass' | 'warn';
    venueCount: number;
    matchedCount: number;
    highConfidenceMatchCount: number;
    needsReviewCount: number;
    notFoundCount: number;
    pendingLookupCount: number;
    insufficientIdentityCount: number;
    lookupReady: boolean;
    providersConfigured: VenuePlaceProvider[];
    queue: VenuePlaceLookupQueueItem[];
    insufficientIdentityQueue: VenuePlaceLookupQueueItem[];
    staleCacheCount: number;
    topNeedsReview: VenuePlaceCacheEntry[];
    summary: VenuePlaceMatchingSummary;
};

export type VenuePlaceMatchingSummary = {
    checkedAt: string;
    status: 'pass' | 'warn';
    venueCount: number;
    matchedCount: number;
    highConfidenceMatchCount: number;
    needsReviewCount: number;
    notFoundCount: number;
    pendingLookupCount: number;
    insufficientIdentityCount: number;
    lookupReady: boolean;
    providersConfigured: VenuePlaceProvider[];
    staleCacheCount: number;
    topQueue: VenuePlaceLookupQueueItem[];
    topInsufficientIdentityQueue: VenuePlaceLookupQueueItem[];
    topNeedsReview: Array<Pick<VenuePlaceCacheEntry, 'venueId' | 'officialName' | 'query' | 'confidence' | 'reason'>>;
};

function compactText(value?: string) {
    return value?.replace(/\s+/g, ' ').trim() || '';
}

function normalizeText(value?: string) {
    return compactText(value)
        .replace(/\[[^\]]+\]/g, '')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[·ㆍ,./\\\-_:|"'“”‘’\s]/g, '')
        .toLowerCase();
}

function normalizeAddress(value?: string) {
    return compactText(value)
        .replace(/서울특별시|서울시/g, '서울')
        .replace(/부산광역시|부산시/g, '부산')
        .replace(/대구광역시|대구시/g, '대구')
        .replace(/인천광역시|인천시/g, '인천')
        .replace(/광주광역시|광주시/g, '광주')
        .replace(/대전광역시|대전시/g, '대전')
        .replace(/울산광역시|울산시/g, '울산')
        .replace(/경기도/g, '경기')
        .replace(/강원특별자치도|강원도/g, '강원')
        .replace(/전북특별자치도|전라북도/g, '전북')
        .replace(/전라남도/g, '전남')
        .replace(/경상북도/g, '경북')
        .replace(/경상남도/g, '경남')
        .replace(/제주특별자치도|제주도/g, '제주')
        .toLowerCase();
}

function hasDetailedAddress(value?: string) {
    const address = normalizeAddress(value);
    return Boolean(address && address.split(' ').filter(Boolean).length >= 3);
}

function isClearlyNonVenueName(value?: string) {
    const text = compactText(value);
    const normalized = normalizeText(text);
    if (!normalized || normalized.length < 2) return true;
    if (/^[0-9:/\-\s]+$/.test(text)) return true;
    if (text.includes('/')) return true;
    return [
        '전국출강',
        '개인레슨',
        '원데이클래스',
        '회차',
        '과정',
        '정규반',
        '서울경기',
        '수원동탄',
        '송파잠실',
        '의왕안양',
    ].some((keyword) => normalized.includes(normalizeText(keyword)));
}

function extractAddressRegion(value?: string) {
    return normalizeAddress(value).split(' ').filter(Boolean).slice(0, 2).join(' ');
}

function nameSimilarity(left?: string, right?: string) {
    const normalizedLeft = normalizeText(left);
    const normalizedRight = normalizeText(right);
    if (!normalizedLeft || !normalizedRight) return 0;
    if (normalizedLeft === normalizedRight) return 1;
    if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) {
        return Math.min(normalizedLeft.length, normalizedRight.length) / Math.max(normalizedLeft.length, normalizedRight.length);
    }

    const leftChars = new Set(Array.from(normalizedLeft));
    const rightChars = new Set(Array.from(normalizedRight));
    const intersection = Array.from(leftChars).filter((char) => rightChars.has(char)).length;
    const union = new Set([...leftChars, ...rightChars]).size;
    return union > 0 ? intersection / union : 0;
}

function addressSimilarity(left?: string, right?: string) {
    const normalizedLeft = normalizeAddress(left);
    const normalizedRight = normalizeAddress(right);
    if (!normalizedLeft || !normalizedRight) return 0;
    if (normalizedLeft === normalizedRight) return 1;
    if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) return 0.88;

    const leftRegion = extractAddressRegion(normalizedLeft);
    const rightRegion = extractAddressRegion(normalizedRight);
    if (leftRegion && rightRegion && leftRegion === rightRegion) return 0.55;
    return 0;
}

function distanceMeters(leftLat?: number | null, leftLng?: number | null, rightLat?: number | null, rightLng?: number | null) {
    if (
        typeof leftLat !== 'number' ||
        typeof leftLng !== 'number' ||
        typeof rightLat !== 'number' ||
        typeof rightLng !== 'number'
    ) {
        return null;
    }

    const toRad = (value: number) => value * Math.PI / 180;
    const earthRadius = 6371000;
    const dLat = toRad(rightLat - leftLat);
    const dLng = toRad(rightLng - leftLng);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(leftLat)) * Math.cos(toRad(rightLat)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getVenuePlaceLookupQuery(entry: VenueMasterEntry) {
    const region = extractAddressRegion(entry.address);
    return [entry.officialName, region].filter(Boolean).join(' ');
}

export function scoreVenuePlaceCandidate(entry: VenueMasterEntry, candidate: VenuePlaceCandidate) {
    const nameScore = nameSimilarity(entry.officialName, candidate.name);
    const candidateAddress = candidate.roadAddressName || candidate.addressName || '';
    const addrScore = addressSimilarity(entry.address, candidateAddress);
    const distance = distanceMeters(entry.lat, entry.lng, candidate.lat, candidate.lng);
    const distanceScore = distance === null
        ? 0
        : distance <= 80
            ? 1
            : distance <= 300
                ? 0.78
                : distance <= 1000
                    ? 0.45
                    : 0;
    const confidence = Math.min(1, nameScore * 0.5 + addrScore * 0.35 + distanceScore * 0.15);
    const reason = [
        `name=${nameScore.toFixed(2)}`,
        `address=${addrScore.toFixed(2)}`,
        `distance=${distance === null ? 'unknown' : `${Math.round(distance)}m`}`,
    ].join(', ');

    return { confidence, reason };
}

export function chooseBestVenuePlaceCandidate(entry: VenueMasterEntry, candidates: VenuePlaceCandidate[], checkedAt: string): VenuePlaceCacheEntry {
    const query = getVenuePlaceLookupQuery(entry);
    if (candidates.length === 0) {
        return {
            venueId: entry.id,
            status: 'not_found',
            confidence: 0,
            matchedAt: '',
            checkedAt,
            query,
            reason: 'no candidates returned',
        };
    }

    const ranked = candidates
        .map((candidate) => ({
            candidate,
            score: scoreVenuePlaceCandidate(entry, candidate),
        }))
        .sort((left, right) => right.score.confidence - left.score.confidence);
    const best = ranked[0];
    const status: VenuePlaceCacheEntry['status'] = best.score.confidence >= 0.72 ? 'matched' : 'needs_review';

    return {
        venueId: entry.id,
        status,
        provider: best.candidate.provider,
        providerPlaceId: best.candidate.providerPlaceId,
        officialName: best.candidate.name,
        roadAddressName: best.candidate.roadAddressName,
        addressName: best.candidate.addressName,
        lat: best.candidate.lat,
        lng: best.candidate.lng,
        phone: best.candidate.phone,
        url: best.candidate.url,
        categoryName: best.candidate.categoryName,
        confidence: Number(best.score.confidence.toFixed(4)),
        matchedAt: status === 'matched' ? checkedAt : '',
        checkedAt,
        query,
        reason: best.score.reason,
    };
}

export function applyVenuePlaceCache(entries: VenueMasterEntry[], cache: VenuePlaceCache) {
    return entries.map((entry) => {
        const cached = cache[entry.id];
        if (!cached || cached.status !== 'matched' || cached.confidence < 0.72) return entry;

        const reviewFlags = entry.reviewFlags.filter((flag) => (
            flag !== 'needs_official_place_lookup' &&
            flag !== 'missing_detailed_address' &&
            flag !== 'invalid_coordinate' &&
            flag !== 'coordinate_fallback_risk'
        ));

        return {
            ...entry,
            officialName: cached.officialName || entry.officialName,
            displayName: cached.officialName || entry.displayName,
            address: cached.roadAddressName || cached.addressName || entry.address,
            normalizedAddress: normalizeAddress(cached.roadAddressName || cached.addressName || entry.address),
            lat: typeof cached.lat === 'number' ? cached.lat : entry.lat,
            lng: typeof cached.lng === 'number' ? cached.lng : entry.lng,
            confidence: 'high' as const,
            reviewFlags,
            placeIds: {
                ...entry.placeIds,
                [cached.provider || 'kakao']: cached.providerPlaceId,
            },
        };
    });
}

export function buildVenuePlaceLookupQueue(entries: VenueMasterEntry[], cache: VenuePlaceCache) {
    return entries
        .filter((entry) => {
            const cached = cache[entry.id];
            return !cached || cached.status !== 'matched' || cached.confidence < 0.72;
        })
        .filter((entry) => {
            if (isClearlyNonVenueName(entry.officialName)) return false;
            if (!hasDetailedAddress(entry.address) && entry.reviewFlags.includes('invalid_coordinate')) return false;
            return true;
        })
        .map<VenuePlaceLookupQueueItem>((entry) => {
            const hasInvalidCoordinate = entry.reviewFlags.includes('invalid_coordinate');
            const hasCoordinateRisk = entry.reviewFlags.includes('coordinate_fallback_risk');
            const hasMissingAddress = entry.reviewFlags.includes('missing_detailed_address') || !hasDetailedAddress(entry.address);
            const priority =
                (hasInvalidCoordinate ? 500 : 0) +
                (hasCoordinateRisk ? 420 : 0) +
                (hasMissingAddress ? 320 : 0) +
                Math.min(200, entry.performanceCount * 8) +
                (entry.confidence === 'low' ? 80 : entry.confidence === 'medium' ? 40 : 0);

            return {
                venueId: entry.id,
                officialName: entry.officialName,
                address: entry.address,
                query: getVenuePlaceLookupQuery(entry),
                priority,
                performanceCount: entry.performanceCount,
                reviewFlags: entry.reviewFlags,
                sampleTitles: entry.sampleTitles.slice(0, 3),
            };
        })
        .sort((left, right) => right.priority - left.priority || right.performanceCount - left.performanceCount);
}

export function buildInsufficientVenueIdentityQueue(entries: VenueMasterEntry[], cache: VenuePlaceCache) {
    return entries
        .filter((entry) => {
            const cached = cache[entry.id];
            if (cached?.status === 'matched' && cached.confidence >= 0.72) return false;
            return isClearlyNonVenueName(entry.officialName) || (!hasDetailedAddress(entry.address) && entry.reviewFlags.includes('invalid_coordinate'));
        })
        .map<VenuePlaceLookupQueueItem>((entry) => ({
            venueId: entry.id,
            officialName: entry.officialName,
            address: entry.address,
            query: getVenuePlaceLookupQuery(entry),
            priority: Math.min(200, entry.performanceCount * 8),
            performanceCount: entry.performanceCount,
            reviewFlags: [...new Set([...entry.reviewFlags, 'insufficient_place_identity'])],
            sampleTitles: entry.sampleTitles.slice(0, 3),
        }))
        .sort((left, right) => right.performanceCount - left.performanceCount || left.officialName.localeCompare(right.officialName));
}

export function buildVenuePlaceMatchingReport(
    entries: VenueMasterEntry[],
    cache: VenuePlaceCache,
    providersConfigured: VenuePlaceProvider[] = [],
    checkedAt = new Date().toISOString()
): VenuePlaceMatchingReport {
    const cacheEntries = Object.values(cache);
    const matchedCount = cacheEntries.filter((entry) => entry.status === 'matched').length;
    const highConfidenceMatchCount = cacheEntries.filter((entry) => entry.status === 'matched' && entry.confidence >= 0.86).length;
    const needsReview = cacheEntries
        .filter((entry) => entry.status === 'needs_review')
        .sort((left, right) => left.confidence - right.confidence)
        .slice(0, 20);
    const notFoundCount = cacheEntries.filter((entry) => entry.status === 'not_found').length;
    const queue = buildVenuePlaceLookupQueue(entries, cache);
    const insufficientIdentityQueue = buildInsufficientVenueIdentityQueue(entries, cache);
    const staleCacheCount = cacheEntries.filter((entry) => !entries.some((venue) => venue.id === entry.venueId)).length;
    const status: VenuePlaceMatchingReport['status'] = queue.length > 0 || insufficientIdentityQueue.length > 0 || needsReview.length > 0 || staleCacheCount > 0 ? 'warn' : 'pass';

    return {
        checkedAt,
        status,
        venueCount: entries.length,
        matchedCount,
        highConfidenceMatchCount,
        needsReviewCount: needsReview.length,
        notFoundCount,
        pendingLookupCount: queue.length,
        insufficientIdentityCount: insufficientIdentityQueue.length,
        lookupReady: providersConfigured.length > 0,
        providersConfigured,
        queue: queue.slice(0, 120),
        insufficientIdentityQueue: insufficientIdentityQueue.slice(0, 120),
        staleCacheCount,
        topNeedsReview: needsReview,
        summary: {
            checkedAt,
            status,
            venueCount: entries.length,
            matchedCount,
            highConfidenceMatchCount,
            needsReviewCount: needsReview.length,
            notFoundCount,
            pendingLookupCount: queue.length,
            insufficientIdentityCount: insufficientIdentityQueue.length,
            lookupReady: providersConfigured.length > 0,
            providersConfigured,
            staleCacheCount,
            topQueue: queue.slice(0, 10),
            topInsufficientIdentityQueue: insufficientIdentityQueue.slice(0, 10),
            topNeedsReview: needsReview.slice(0, 8).map((entry) => ({
                venueId: entry.venueId,
                officialName: entry.officialName,
                query: entry.query,
                confidence: entry.confidence,
                reason: entry.reason,
            })),
        },
    };
}
