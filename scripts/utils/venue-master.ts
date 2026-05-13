import type { Performance } from '../../src/types';
import type { VenueRecordMap } from './venue-canonicalization';
import { isCompatibleVenueDisplayName } from './venue-name-quality';

export type VenueMasterEntry = {
    id: string;
    officialName: string;
    displayName: string;
    address: string;
    normalizedAddress: string;
    lat: number | null;
    lng: number | null;
    coordinateKey: string;
    aliases: string[];
    halls: string[];
    sources: string[];
    performanceCount: number;
    sampleTitles: string[];
    confidence: 'high' | 'medium' | 'low';
    reviewFlags: string[];
    placeIds: {
        kakao?: string;
        naver?: string;
        kopisVenueIds?: string[];
    };
};

export type VenueMasterReport = {
    checkedAt: string;
    status: 'pass' | 'warn';
    entryCount: number;
    performanceCount: number;
    highConfidenceCount: number;
    mediumConfidenceCount: number;
    lowConfidenceCount: number;
    needsOfficialLookupCount: number;
    missingAddressCount: number;
    invalidCoordinateCount: number;
    coordinateFallbackRiskCount: number;
    parentChildGroupCount: number;
    aliasMergedGroupCount: number;
    topReviewEntries: VenueMasterEntry[];
    summary: VenueMasterSummary;
};

export type VenueMasterSummary = {
    checkedAt: string;
    status: 'pass' | 'warn';
    entryCount: number;
    performanceCount: number;
    highConfidenceCount: number;
    mediumConfidenceCount: number;
    lowConfidenceCount: number;
    needsOfficialLookupCount: number;
    missingAddressCount: number;
    invalidCoordinateCount: number;
    coordinateFallbackRiskCount: number;
    parentChildGroupCount: number;
    aliasMergedGroupCount: number;
    topReviewEntries: Array<Pick<VenueMasterEntry, 'id' | 'officialName' | 'address' | 'performanceCount' | 'reviewFlags'>>;
};

export type VenueMasterBuildResult = {
    entries: VenueMasterEntry[];
    report: VenueMasterReport;
    performanceVenueIndex: Record<string, {
        canonicalId: string;
        hallName?: string;
    }>;
};

type WorkingVenueGroup = {
    id: string;
    address: string;
    normalizedAddress: string;
    lat: number | null;
    lng: number | null;
    coordinateKey: string;
    nameUsage: Map<string, number>;
    aliases: Set<string>;
    halls: Set<string>;
    sources: Set<string>;
    sampleTitles: string[];
    performanceIds: Set<string>;
    reviewFlags: Set<string>;
    kopisVenueIds: Set<string>;
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

const HALL_TOKENS = [
    'CJ 토월극장',
    'IBK챔버홀',
    '자유소극장',
    '콘서트홀',
    '리사이틀홀',
    '오페라극장',
    '세종대극장',
    '세종체임버홀',
    '대극장',
    '소극장',
    '중극장',
    '소공연장',
    '대공연장',
    '전시장',
    '전시관',
    '아트홀',
    '챔버홀',
    '홀',
    '1관',
    '2관',
    '3관',
    '4관',
];

const MEETING_POINT_TOKENS = [
    '로비',
    '기념품점',
    '뮤지엄샵',
    '스크린 앞',
    '안내데스크',
    '상설전시실',
    '상설전시관',
    '세계문화관',
    '역사관',
    '앞',
];

function compactText(value?: string) {
    return value?.replace(/\s+/g, ' ').trim() || '';
}

function sanitizeAddress(value?: string) {
    return compactText(value)
        .replace(/지도보기$/g, '')
        .replace(/\s*\|\s*/g, ' ')
        .trim();
}

function normalizeAddress(value?: string) {
    const cleaned = sanitizeAddress(value);
    if (!cleaned || cleaned === '정보 없음' || cleaned === '주소 정보 없음') return '';

    const tokens = cleaned.split(' ').filter(Boolean);
    if (tokens.length < 3) return '';
    if (REGION_ALIASES[tokens[0]]) tokens[0] = REGION_ALIASES[tokens[0]];

    return tokens.join(' ').toLowerCase();
}

function normalizeName(value?: string) {
    return compactText(value)
        .replace(/\[[^\]]+\]/g, '')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/[·ㆍ,./\\\-_:|"'“”‘’\s]/g, '')
        .toLowerCase();
}

function slugify(value: string) {
    return normalizeName(value)
        .replace(/[^a-z0-9가-힣]/gi, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 32) || 'unknown';
}

function stableHash(value: string) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36).padStart(6, '0');
}

function parseCoordinate(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value) && value !== 0) return value;
    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed) && parsed !== 0) return parsed;
    }
    return null;
}

function isCoordinateInKorea(lat: number | null, lng: number | null) {
    return lat !== null && lng !== null && lat >= 33 && lat <= 43 && lng >= 124 && lng <= 132;
}

function coordinateKey(lat: number | null, lng: number | null) {
    if (!isCoordinateInKorea(lat, lng)) return '';
    return `${lat!.toFixed(4)},${lng!.toFixed(4)}`;
}

function extractHallName(value?: string) {
    const text = compactText(value);
    if (!text) return '';

    const parenthesized = Array.from(text.matchAll(/\(([^)]*(?:관|홀|극장|무대|전시장)[^)]*)\)/g))
        .map((match) => compactText(match[1]))
        .find(Boolean);
    if (parenthesized) return parenthesized;

    return HALL_TOKENS
        .filter((token) => text.includes(token))
        .sort((left, right) => right.length - left.length)[0] || '';
}

function stripHallAndMeetingPoint(value?: string) {
    let name = compactText(value)
        .replace(/\[[^\]]+\]/g, '')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    [...HALL_TOKENS, ...MEETING_POINT_TOKENS]
        .sort((left, right) => right.length - left.length)
        .forEach((token) => {
            name = name.replace(new RegExp(`\\s*${token}\\s*$`, 'g'), '').trim();
        });

    return name || compactText(value);
}

function chooseOfficialName(nameUsage: Map<string, number>) {
    const names = Array.from(nameUsage.entries()).filter(([name]) => Boolean(compactText(name)));
    if (names.length === 0) return '정보 없음';

    return names.sort(([leftName, leftCount], [rightName, rightCount]) => {
        if (rightCount !== leftCount) return rightCount - leftCount;

        const leftHasHall = Boolean(extractHallName(leftName));
        const rightHasHall = Boolean(extractHallName(rightName));
        if (leftHasHall !== rightHasHall) return leftHasHall ? 1 : -1;

        return leftName.length - rightName.length;
    })[0][0];
}

function getNameBase(performance: Performance, venueRecord?: VenueRecordMap[string]) {
    const venue = compactText(performance.venue);
    const venueKey = compactText(performance.venueKey);
    const recordName = compactText(venueRecord?.name);
    const safeRecordName = isCompatibleVenueDisplayName(venue || venueKey, recordName) ? recordName : '';
    return stripHallAndMeetingPoint(safeRecordName || venue || venueKey || 'unknown');
}

function getVenueRecord(performance: Performance, venues: VenueRecordMap) {
    return venues[performance.venueKey || ''] || venues[performance.venue] || {};
}

function getVenueAddress(performance: Performance, venueRecord?: VenueRecordMap[string]) {
    return sanitizeAddress(performance.address || venueRecord?.address);
}

function getVenueLatLng(performance: Performance, venueRecord?: VenueRecordMap[string]) {
    const lat = parseCoordinate(performance.lat ?? performance.latitude ?? venueRecord?.lat ?? venueRecord?.latitude);
    const lng = parseCoordinate(performance.lng ?? performance.longitude ?? venueRecord?.lng ?? venueRecord?.longitude);
    return { lat, lng };
}

function createGroupId(baseName: string, normalizedAddress: string, lat: number | null, lng: number | null) {
    if (normalizedAddress) return `venue_${slugify(baseName)}_${stableHash(normalizedAddress)}`;
    const coords = coordinateKey(lat, lng);
    if (coords) return `venue_${slugify(baseName)}_${stableHash(coords)}`;
    return `venue_${slugify(baseName)}_${stableHash(baseName)}`;
}

function ensureGroup(
    groups: Map<string, WorkingVenueGroup>,
    baseName: string,
    address: string,
    normalizedAddress: string,
    lat: number | null,
    lng: number | null
) {
    const groupKey = normalizedAddress
        ? `${normalizeName(baseName)}::${normalizedAddress}`
        : `${normalizeName(baseName)}::${coordinateKey(lat, lng) || 'no-location'}`;
    const existing = groups.get(groupKey);
    if (existing) return existing;

    const group: WorkingVenueGroup = {
        id: createGroupId(baseName, normalizedAddress, lat, lng),
        address,
        normalizedAddress,
        lat,
        lng,
        coordinateKey: coordinateKey(lat, lng),
        nameUsage: new Map(),
        aliases: new Set(),
        halls: new Set(),
        sources: new Set(),
        sampleTitles: [],
        performanceIds: new Set(),
        reviewFlags: new Set(),
        kopisVenueIds: new Set(),
    };
    groups.set(groupKey, group);
    return group;
}

function addReviewFlags(group: WorkingVenueGroup) {
    if (!group.normalizedAddress) group.reviewFlags.add('missing_detailed_address');
    if (!isCoordinateInKorea(group.lat, group.lng)) group.reviewFlags.add('invalid_coordinate');
}

function materializeEntry(group: WorkingVenueGroup, coordinateRiskKeys: Set<string>): VenueMasterEntry {
    addReviewFlags(group);
    if (group.coordinateKey && coordinateRiskKeys.has(group.coordinateKey)) {
        group.reviewFlags.add('coordinate_fallback_risk');
    }
    if (group.aliases.size > 1) group.reviewFlags.add('alias_merge_candidate');
    if (group.halls.size > 1) group.reviewFlags.add('parent_child_halls');
    group.reviewFlags.add('needs_official_place_lookup');

    const officialName = chooseOfficialName(group.nameUsage);
    const confidence: VenueMasterEntry['confidence'] =
        group.reviewFlags.has('invalid_coordinate') || group.reviewFlags.has('missing_detailed_address')
            ? 'low'
            : group.reviewFlags.has('coordinate_fallback_risk')
                ? 'medium'
                : 'high';

    return {
        id: group.id,
        officialName,
        displayName: officialName,
        address: group.address,
        normalizedAddress: group.normalizedAddress,
        lat: group.lat,
        lng: group.lng,
        coordinateKey: group.coordinateKey,
        aliases: Array.from(group.aliases).sort((left, right) => left.localeCompare(right)),
        halls: Array.from(group.halls).sort((left, right) => left.localeCompare(right)),
        sources: Array.from(group.sources).sort((left, right) => left.localeCompare(right)),
        performanceCount: group.performanceIds.size,
        sampleTitles: group.sampleTitles,
        confidence,
        reviewFlags: Array.from(group.reviewFlags).sort((left, right) => left.localeCompare(right)),
        placeIds: {
            kopisVenueIds: group.kopisVenueIds.size > 0 ? Array.from(group.kopisVenueIds).sort() : undefined,
        },
    };
}

export function buildVenueMaster(
    performances: Performance[],
    venues: VenueRecordMap,
    coordinateRiskKeys: Set<string> = new Set(),
    checkedAt = new Date().toISOString()
): VenueMasterBuildResult {
    const groups = new Map<string, WorkingVenueGroup>();
    const performanceVenueIndex: VenueMasterBuildResult['performanceVenueIndex'] = {};

    performances.forEach((performance) => {
        const venueRecord = getVenueRecord(performance, venues);
        const baseName = getNameBase(performance, venueRecord);
        const address = getVenueAddress(performance, venueRecord);
        const normalizedAddress = normalizeAddress(address);
        const { lat, lng } = getVenueLatLng(performance, venueRecord);
        const group = ensureGroup(groups, baseName, address, normalizedAddress, lat, lng);
        const alias = compactText(performance.venueKey || performance.venue);
        const recordName = compactText(venueRecord?.name);
        const safeRecordName = isCompatibleVenueDisplayName(alias || performance.venue, recordName) ? recordName : '';
        const hallName = extractHallName(performance.venue) || extractHallName(alias);

        if (safeRecordName) group.nameUsage.set(safeRecordName, (group.nameUsage.get(safeRecordName) || 0) + 1);
        if (baseName) group.nameUsage.set(baseName, (group.nameUsage.get(baseName) || 0) + 1);
        if (alias) group.aliases.add(alias);
        if (compactText(performance.venue)) group.aliases.add(compactText(performance.venue));
        if (hallName) group.halls.add(hallName);
        if (performance.source) group.sources.add(performance.source);
        if (performance.title && group.sampleTitles.length < 5) group.sampleTitles.push(performance.title);
        if (performance.id) group.performanceIds.add(performance.id);

        const rawVenueId = (performance as Performance & { venueId?: unknown }).venueId;
        if (typeof rawVenueId === 'string' && rawVenueId.startsWith('FC')) {
            group.kopisVenueIds.add(rawVenueId);
        }

        performanceVenueIndex[performance.id] = {
            canonicalId: group.id,
            hallName: hallName || undefined,
        };
    });

    const entries = Array.from(groups.values())
        .map((group) => materializeEntry(group, coordinateRiskKeys))
        .sort((left, right) => right.performanceCount - left.performanceCount || left.officialName.localeCompare(right.officialName));
    const highConfidenceCount = entries.filter((entry) => entry.confidence === 'high').length;
    const mediumConfidenceCount = entries.filter((entry) => entry.confidence === 'medium').length;
    const lowConfidenceCount = entries.filter((entry) => entry.confidence === 'low').length;
    const needsOfficialLookupCount = entries.filter((entry) => entry.reviewFlags.includes('needs_official_place_lookup')).length;
    const missingAddressCount = entries.filter((entry) => entry.reviewFlags.includes('missing_detailed_address')).length;
    const invalidCoordinateCount = entries.filter((entry) => entry.reviewFlags.includes('invalid_coordinate')).length;
    const coordinateFallbackRiskCount = entries.filter((entry) => entry.reviewFlags.includes('coordinate_fallback_risk')).length;
    const parentChildGroupCount = entries.filter((entry) => entry.reviewFlags.includes('parent_child_halls')).length;
    const aliasMergedGroupCount = entries.filter((entry) => entry.reviewFlags.includes('alias_merge_candidate')).length;
    const status: VenueMasterReport['status'] = (
        missingAddressCount > 0 ||
        invalidCoordinateCount > 0 ||
        coordinateFallbackRiskCount > 0 ||
        needsOfficialLookupCount > 0
    ) ? 'warn' : 'pass';
    const topReviewEntries = entries
        .filter((entry) => entry.reviewFlags.length > 0)
        .sort((left, right) => {
            const leftRisk = left.reviewFlags.includes('coordinate_fallback_risk') ? 1 : 0;
            const rightRisk = right.reviewFlags.includes('coordinate_fallback_risk') ? 1 : 0;
            if (rightRisk !== leftRisk) return rightRisk - leftRisk;
            return right.performanceCount - left.performanceCount;
        })
        .slice(0, 20);

    const report: VenueMasterReport = {
        checkedAt,
        status,
        entryCount: entries.length,
        performanceCount: performances.length,
        highConfidenceCount,
        mediumConfidenceCount,
        lowConfidenceCount,
        needsOfficialLookupCount,
        missingAddressCount,
        invalidCoordinateCount,
        coordinateFallbackRiskCount,
        parentChildGroupCount,
        aliasMergedGroupCount,
        topReviewEntries,
        summary: {
            checkedAt,
            status,
            entryCount: entries.length,
            performanceCount: performances.length,
            highConfidenceCount,
            mediumConfidenceCount,
            lowConfidenceCount,
            needsOfficialLookupCount,
            missingAddressCount,
            invalidCoordinateCount,
            coordinateFallbackRiskCount,
            parentChildGroupCount,
            aliasMergedGroupCount,
            topReviewEntries: topReviewEntries.slice(0, 8).map((entry) => ({
                id: entry.id,
                officialName: entry.officialName,
                address: entry.address,
                performanceCount: entry.performanceCount,
                reviewFlags: entry.reviewFlags,
            })),
        },
    };

    return { entries, report, performanceVenueIndex };
}
