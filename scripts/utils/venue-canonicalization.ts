import type { Performance } from '../../src/types';
import { isCompatibleVenueDisplayName } from './venue-name-quality';

type VenueRecordValue = {
    address?: string;
    lat?: number | string | null;
    lng?: number | string | null;
    latitude?: number | string | null;
    longitude?: number | string | null;
    district?: string;
    name?: string;
    kakaoPlaceId?: string;
    naverPlaceId?: string;
    aliases?: string[];
};

export type VenueRecordMap = Record<string, VenueRecordValue>;

type VenueSnapshot = {
    key: string;
    name: string;
    normalizedName: string;
    parentName: string;
    address: string;
    normalizedAddress: string;
    lat: number | null;
    lng: number | null;
    coordinateKey: string;
    usageCount: number;
    sourceCount: number;
    sources: string[];
    sampleTitles: string[];
    hasExternalPlaceId: boolean;
};

export type VenueCanonicalCandidate = {
    type: 'exact-address-alias' | 'parent-child' | 'coordinate-name-similar' | 'coordinate-risk';
    confidence: 'high' | 'medium' | 'low';
    reason: string;
    recommendedAction: string;
    groupKey: string;
    itemCount: number;
    usageCount: number;
    venues: Array<{
        key: string;
        name: string;
        address: string;
        lat: number | null;
        lng: number | null;
        usageCount: number;
        sources: string[];
        sampleTitles: string[];
    }>;
};

export type VenueCanonicalizationReport = {
    checkedAt: string;
    status: 'pass' | 'warn';
    usedVenueCount: number;
    usedPerformanceCount: number;
    invalidCoordinateVenues: VenueSnapshot[];
    missingAddressVenues: VenueSnapshot[];
    exactAddressAliasCandidates: VenueCanonicalCandidate[];
    parentChildCandidates: VenueCanonicalCandidate[];
    coordinateNameSimilarCandidates: VenueCanonicalCandidate[];
    coordinateRiskGroups: VenueCanonicalCandidate[];
    externalLookup: {
        kakaoConfigured: boolean;
        naverConfigured: boolean;
        mode: 'offline-audit' | 'lookup-ready';
    };
    summary: VenueCanonicalizationSummary;
};

export type VenueCanonicalizationSummary = {
    checkedAt: string;
    status: 'pass' | 'warn';
    usedVenueCount: number;
    usedPerformanceCount: number;
    invalidCoordinateVenueCount: number;
    missingAddressVenueCount: number;
    exactAddressAliasCandidateCount: number;
    parentChildCandidateCount: number;
    coordinateNameSimilarCandidateCount: number;
    coordinateRiskGroupCount: number;
    highConfidenceMergeCandidateCount: number;
    reviewCandidateCount: number;
    externalLookupMode: 'offline-audit' | 'lookup-ready';
    topHighConfidenceCandidates: Array<Pick<VenueCanonicalCandidate, 'type' | 'reason' | 'groupKey' | 'itemCount' | 'usageCount'>>;
    topCoordinateRiskGroups: Array<Pick<VenueCanonicalCandidate, 'reason' | 'groupKey' | 'itemCount' | 'usageCount'>>;
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
    '대극장',
    '소극장',
    '중극장',
    '콘서트홀',
    '리사이틀홀',
    '아트홀',
    '챔버홀',
    '오페라극장',
    '전시장',
    '미술관',
    '1관',
    '2관',
    '3관',
    '4관',
    '홀',
];

const NON_PHYSICAL_GENRES = new Set(['movie', 'ott']);

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

    if (tokens.length > 0 && REGION_ALIASES[tokens[0]]) {
        tokens[0] = REGION_ALIASES[tokens[0]];
    }

    return tokens.join(' ').toLowerCase();
}

function normalizeName(value?: string) {
    return compactText(value)
        .replace(/\[[^\]]+\]/g, '')
        .replace(/\([^)]*\)/g, '')
        .replace(/[·ㆍ,./\\\-_:|"'“”‘’\s]/g, '')
        .toLowerCase();
}

function getParentVenueName(value?: string) {
    let name = compactText(value)
        .replace(/\[[^\]]+\]/g, '')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    HALL_TOKENS.forEach((token) => {
        name = name.replace(new RegExp(`\\s*${token}\\s*$`, 'g'), '').trim();
    });

    return normalizeName(name || value);
}

function hasHallToken(value?: string) {
    const text = compactText(value);
    return HALL_TOKENS.some((token) => text.includes(token)) || /\([^)]*(관|홀|극장|무대|전시장)[^)]*\)/.test(text);
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

function coordinateKey(lat: number | null, lng: number | null, precision = 4) {
    if (!isCoordinateInKorea(lat, lng)) return '';
    return `${lat!.toFixed(precision)},${lng!.toFixed(precision)}`;
}

function toVenueCandidateItem(snapshot: VenueSnapshot) {
    return {
        key: snapshot.key,
        name: snapshot.name,
        address: snapshot.address,
        lat: snapshot.lat,
        lng: snapshot.lng,
        usageCount: snapshot.usageCount,
        sources: snapshot.sources,
        sampleTitles: snapshot.sampleTitles,
    };
}

function charBigrams(value: string) {
    const chars = Array.from(value);
    if (chars.length <= 1) return new Set(chars);

    const bigrams = new Set<string>();
    for (let index = 0; index < chars.length - 1; index += 1) {
        bigrams.add(`${chars[index]}${chars[index + 1]}`);
    }
    return bigrams;
}

function nameSimilarity(left: string, right: string) {
    if (!left || !right) return 0;
    if (left === right) return 1;
    if (left.includes(right) || right.includes(left)) {
        return Math.min(left.length, right.length) / Math.max(left.length, right.length);
    }

    const leftBigrams = charBigrams(left);
    const rightBigrams = charBigrams(right);
    const intersection = Array.from(leftBigrams).filter((value) => rightBigrams.has(value)).length;
    const union = new Set([...leftBigrams, ...rightBigrams]).size;
    return union > 0 ? intersection / union : 0;
}

function hasSimilarNamePair(items: VenueSnapshot[], threshold = 0.62) {
    for (let leftIndex = 0; leftIndex < items.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < items.length; rightIndex += 1) {
            const left = items[leftIndex];
            const right = items[rightIndex];
            const parentSimilarity = nameSimilarity(left.parentName, right.parentName);
            const directSimilarity = nameSimilarity(left.normalizedName, right.normalizedName);
            if (parentSimilarity >= threshold || directSimilarity >= threshold) return true;
        }
    }
    return false;
}

function summarizeCandidate(
    type: VenueCanonicalCandidate['type'],
    confidence: VenueCanonicalCandidate['confidence'],
    reason: string,
    recommendedAction: string,
    groupKey: string,
    items: VenueSnapshot[]
): VenueCanonicalCandidate {
    const sortedItems = [...items].sort((left, right) => right.usageCount - left.usageCount || left.name.localeCompare(right.name));
    return {
        type,
        confidence,
        reason,
        recommendedAction,
        groupKey,
        itemCount: sortedItems.length,
        usageCount: sortedItems.reduce((sum, item) => sum + item.usageCount, 0),
        venues: sortedItems.slice(0, 12).map(toVenueCandidateItem),
    };
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
    return items.reduce<Map<string, T[]>>((acc, item) => {
        const key = getKey(item);
        if (!key) return acc;
        const group = acc.get(key) || [];
        group.push(item);
        acc.set(key, group);
        return acc;
    }, new Map<string, T[]>());
}

function clusterSimilarVenueNames(items: VenueSnapshot[], threshold = 0.68) {
    const clusters: VenueSnapshot[][] = [];

    [...items].sort((left, right) => right.usageCount - left.usageCount).forEach((item) => {
        const matchingCluster = clusters.find((cluster) => cluster.some((member) => (
            member.parentName === item.parentName ||
            nameSimilarity(member.parentName, item.parentName) >= threshold ||
            nameSimilarity(member.normalizedName, item.normalizedName) >= threshold
        )));

        if (matchingCluster) {
            matchingCluster.push(item);
            return;
        }

        clusters.push([item]);
    });

    return clusters.filter((cluster) => cluster.length > 1);
}

function buildSnapshots(performances: Performance[], venues: VenueRecordMap) {
    const snapshotMap = new Map<string, VenueSnapshot>();

    performances.forEach((performance) => {
        if (NON_PHYSICAL_GENRES.has(performance.genre)) return;

        const key = performance.venueKey || performance.venue || 'unknown-venue';
        const venueRecord = venues[key] || venues[performance.venue] || {};
        const recordName = compactText(venueRecord.name);
        const safeRecordName = isCompatibleVenueDisplayName(key || performance.venue, recordName) ? recordName : '';
        const name = safeRecordName || compactText(performance.venue) || key;
        const address = sanitizeAddress(performance.address || venueRecord.address);
        const lat = parseCoordinate(performance.lat ?? performance.latitude ?? venueRecord.lat ?? venueRecord.latitude);
        const lng = parseCoordinate(performance.lng ?? performance.longitude ?? venueRecord.lng ?? venueRecord.longitude);
        const source = performance.source || 'unknown';
        const existing = snapshotMap.get(key);

        if (existing) {
            existing.usageCount += 1;
            existing.sourceCount = existing.sources.includes(source) ? existing.sourceCount : existing.sourceCount + 1;
            if (!existing.sources.includes(source)) existing.sources.push(source);
            if (existing.sampleTitles.length < 4) existing.sampleTitles.push(performance.title);
            if (!existing.address && address) {
                existing.address = address;
                existing.normalizedAddress = normalizeAddress(address);
            }
            if (!existing.lat && lat) existing.lat = lat;
            if (!existing.lng && lng) existing.lng = lng;
            existing.coordinateKey = existing.coordinateKey || coordinateKey(existing.lat, existing.lng);
            return;
        }

        snapshotMap.set(key, {
            key,
            name,
            normalizedName: normalizeName(name || key),
            parentName: getParentVenueName(name || key),
            address,
            normalizedAddress: normalizeAddress(address),
            lat,
            lng,
            coordinateKey: coordinateKey(lat, lng),
            usageCount: 1,
            sourceCount: 1,
            sources: [source],
            sampleTitles: [performance.title],
            hasExternalPlaceId: Boolean(venueRecord.kakaoPlaceId || venueRecord.naverPlaceId),
        });
    });

    return Array.from(snapshotMap.values());
}

export function buildVenueCanonicalizationReport(
    performances: Performance[],
    venues: VenueRecordMap,
    checkedAt = new Date().toISOString()
): VenueCanonicalizationReport {
    const physicalPerformanceCount = performances.filter((performance) => !NON_PHYSICAL_GENRES.has(performance.genre)).length;
    const snapshots = buildSnapshots(performances, venues);
    const invalidCoordinateVenues = snapshots
        .filter((snapshot) => !isCoordinateInKorea(snapshot.lat, snapshot.lng))
        .sort((left, right) => right.usageCount - left.usageCount)
        .slice(0, 50);
    const missingAddressVenues = snapshots
        .filter((snapshot) => !snapshot.normalizedAddress)
        .sort((left, right) => right.usageCount - left.usageCount)
        .slice(0, 50);

    const addressGroups = Array.from(groupBy(snapshots, (snapshot) => snapshot.normalizedAddress).values())
        .filter((group) => group.length > 1);
    const exactAddressAliasCandidates = addressGroups
        .flatMap((group) => clusterSimilarVenueNames(group, 0.68).map((cluster) => ({
            address: group[0].normalizedAddress,
            cluster,
        })))
        .filter(({ cluster }) => {
            const normalizedNameCount = new Set(cluster.map((snapshot) => snapshot.normalizedName)).size;
            return normalizedNameCount === 1 || !cluster.some((snapshot) => hasHallToken(snapshot.name));
        })
        .map(({ address, cluster }) => summarizeCandidate(
            'exact-address-alias',
            'high',
            '같은 주소에서 유사한 공연장명이 반복되어 공식명칭/별칭 통합 후보입니다.',
            '카카오/네이버 placeId가 일치하면 canonical venue로 자동 병합하고, 하위 홀명은 alias로 보존합니다.',
            address,
            cluster
        ))
        .sort((left, right) => right.usageCount - left.usageCount)
        .slice(0, 40);

    const parentChildCandidates = addressGroups
        .filter((group) => {
            const parentNames = new Set(group.map((snapshot) => snapshot.parentName).filter(Boolean));
            return parentNames.size < group.length && group.some((snapshot) => hasHallToken(snapshot.name));
        })
        .map((group) => summarizeCandidate(
            'parent-child',
            'medium',
            '같은 주소의 본관/세부홀 관계로 보입니다.',
            '하나로 뭉개지 말고 parentVenueId와 hallName으로 계층화합니다.',
            group[0].normalizedAddress,
            group
        ))
        .sort((left, right) => right.usageCount - left.usageCount)
        .slice(0, 40);

    const coordinateGroups = Array.from(groupBy(snapshots, (snapshot) => snapshot.coordinateKey).values())
        .filter((group) => group.length > 1);
    const coordinateNameSimilarCandidates = coordinateGroups
        .filter((group) => hasSimilarNamePair(group, 0.72))
        .map((group) => summarizeCandidate(
            'coordinate-name-similar',
            'medium',
            '같은 좌표에서 유사한 이름이 반복되어 주소/공식명 확인 후보입니다.',
            '좌표만으로 자동 병합하지 말고 공식 placeId 또는 같은 도로명주소까지 확인합니다.',
            group[0].coordinateKey,
            group
        ))
        .sort((left, right) => right.usageCount - left.usageCount)
        .slice(0, 40);
    const coordinateRiskGroups = coordinateGroups
        .filter((group) => {
            const addressCount = new Set(group.map((snapshot) => snapshot.normalizedAddress).filter(Boolean)).size;
            const sourceCount = new Set(group.flatMap((snapshot) => snapshot.sources)).size;
            const parentCount = new Set(group.map((snapshot) => snapshot.parentName).filter(Boolean)).size;
            return group.length >= 8 && (addressCount >= 4 || (sourceCount >= 3 && parentCount >= 4));
        })
        .map((group) => summarizeCandidate(
            'coordinate-risk',
            'low',
            '서로 다른 주소/소스가 같은 좌표를 공유합니다. 구/시청 중심점 또는 fallback 좌표일 가능성이 있습니다.',
            '공식 장소 검색으로 좌표를 재확인하기 전까지 지도 클러스터 병합에 사용하지 않습니다.',
            group[0].coordinateKey,
            group
        ))
        .sort((left, right) => right.usageCount - left.usageCount)
        .slice(0, 30);

    const kakaoConfigured = Boolean(process.env.KAKAO_REST_API_KEY || process.env.KAKAO_MAP_API_KEY);
    const naverConfigured = Boolean(process.env.NAVER_CLOUD_CLIENT_ID && process.env.NAVER_CLOUD_CLIENT_SECRET);
    const highConfidenceMergeCandidateCount = exactAddressAliasCandidates.length;
    const reviewCandidateCount =
        parentChildCandidates.length +
        coordinateNameSimilarCandidates.length +
        coordinateRiskGroups.length +
        invalidCoordinateVenues.length +
        missingAddressVenues.length;
    const status: VenueCanonicalizationReport['status'] = (
        highConfidenceMergeCandidateCount > 0 ||
        coordinateRiskGroups.length > 0 ||
        invalidCoordinateVenues.length > 0 ||
        missingAddressVenues.length > 0
    ) ? 'warn' : 'pass';

    return {
        checkedAt,
        status,
        usedVenueCount: snapshots.length,
        usedPerformanceCount: physicalPerformanceCount,
        invalidCoordinateVenues,
        missingAddressVenues,
        exactAddressAliasCandidates,
        parentChildCandidates,
        coordinateNameSimilarCandidates,
        coordinateRiskGroups,
        externalLookup: {
            kakaoConfigured,
            naverConfigured,
            mode: kakaoConfigured || naverConfigured ? 'lookup-ready' : 'offline-audit',
        },
        summary: {
            checkedAt,
            status,
            usedVenueCount: snapshots.length,
            usedPerformanceCount: physicalPerformanceCount,
            invalidCoordinateVenueCount: invalidCoordinateVenues.length,
            missingAddressVenueCount: missingAddressVenues.length,
            exactAddressAliasCandidateCount: exactAddressAliasCandidates.length,
            parentChildCandidateCount: parentChildCandidates.length,
            coordinateNameSimilarCandidateCount: coordinateNameSimilarCandidates.length,
            coordinateRiskGroupCount: coordinateRiskGroups.length,
            highConfidenceMergeCandidateCount,
            reviewCandidateCount,
            externalLookupMode: kakaoConfigured || naverConfigured ? 'lookup-ready' : 'offline-audit',
            topHighConfidenceCandidates: exactAddressAliasCandidates.slice(0, 8).map((candidate) => ({
                type: candidate.type,
                reason: candidate.reason,
                groupKey: candidate.groupKey,
                itemCount: candidate.itemCount,
                usageCount: candidate.usageCount,
            })),
            topCoordinateRiskGroups: coordinateRiskGroups.slice(0, 8).map((candidate) => ({
                reason: candidate.reason,
                groupKey: candidate.groupKey,
                itemCount: candidate.itemCount,
                usageCount: candidate.usageCount,
            })),
        },
    };
}
