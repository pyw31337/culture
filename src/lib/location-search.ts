import type { Performance } from '@/types';
import { collapseDuplicateLeadingLocationToken } from '@/lib/location-text';

export type LocationSearchCandidate = {
    type: 'location';
    name: string;
    address?: string;
    lat: number;
    lng: number;
    venueId?: string;
    category?: string;
    source: 'kakao' | 'local';
};

function normalize(value: unknown) {
    return String(value || '').replace(/\s+/g, '').toLowerCase().normalize('NFC');
}

function tokenizeLocationText(value: unknown) {
    return String(value || '')
        .normalize('NFC')
        .toLowerCase()
        .split(/[\s,./\\\-_:|"'“”‘’()[\]{}<>]+/u)
        .map((token) => token.trim())
        .filter(Boolean);
}

function shareCommonPrefixOfLength(a: string, b: string, minLength: number): boolean {
    const limit = Math.min(a.length, b.length);
    if (limit < minLength) return false;
    for (let i = 0; i < minLength; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

function matchesLocationField(value: unknown, query: string) {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return false;

    const collapsedValue = collapseDuplicateLeadingLocationToken(String(value || ''));
    const normalizedValue = normalize(collapsedValue);
    if (
        normalizedValue === normalizedQuery ||
        normalizedValue.startsWith(normalizedQuery) ||
        shareCommonPrefixOfLength(normalizedValue, normalizedQuery, 2)
    ) {
        return true;
    }

    return tokenizeLocationText(collapsedValue).some((token) => {
        const normalizedToken = normalize(token);
        return (
            normalizedToken === normalizedQuery ||
            normalizedToken.startsWith(normalizedQuery) ||
            shareCommonPrefixOfLength(normalizedToken, normalizedQuery, 2)
        );
    });
}

function toFiniteNumber(value: unknown) {
    const next = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(next) && next !== 0 ? next : null;
}

const MAJOR_OFFICES: Record<string, { lat: number, lng: number, address: string }> = {
    '구리': { lat: 37.5944, lng: 127.1296, address: '경기 구리시 아차산로 439' },
    '서울': { lat: 37.5665, lng: 126.9780, address: '서울 중구 세종대로 110' },
    '인천': { lat: 37.4563, lng: 126.7052, address: '인천 남동구 정각로 29' },
    '부산': { lat: 35.1801, lng: 129.0749, address: '부산 연제구 중앙대로 1001' },
    '대구': { lat: 35.8711, lng: 128.6014, address: '대구 중구 공평로 88' },
    '광주': { lat: 35.1595, lng: 126.8526, address: '광주 서구 내방로 111' },
    '대전': { lat: 36.3504, lng: 127.3848, address: '대전 서구 둔산로 100' },
    '울산': { lat: 35.5389, lng: 129.3114, address: '울산 남구 중앙로 201' },
    '세종': { lat: 36.4801, lng: 127.2890, address: '세종특별자치시 한누리대로 2130' },
    '강남': { lat: 37.5172, lng: 127.0473, address: '서울 강남구 학동로 426' },
    '서초': { lat: 37.4836, lng: 127.0327, address: '서울 서초구 남부순환로 2584' },
    '송파': { lat: 37.5145, lng: 127.1058, address: '서울 송파구 올림픽로 326' },
    '마포': { lat: 37.5662, lng: 126.9016, address: '서울 마포구 월드컵로 212' },
    '용산': { lat: 37.5323, lng: 126.9906, address: '서울 용산구 녹사평대로 150' },
    '영등포': { lat: 37.5263, lng: 126.8962, address: '서울 영등포구 당산로 123' },
    '성남': { lat: 37.4200, lng: 127.1265, address: '경기 성남시 중원구 성남대로 997' },
    '수원': { lat: 37.2636, lng: 127.0286, address: '경기 수원시 팔달구 효원로 241' },
    '고양': { lat: 37.6583, lng: 126.8320, address: '경기 고양시 덕양구 고양시청로 10' },
    '용인': { lat: 37.2410, lng: 127.1775, address: '경기 용인시 처인구 중부대로 1199' },
    '창원': { lat: 35.2281, lng: 128.6811, address: '경남 창원시 성산구 중앙대로 151' },
    '청주': { lat: 36.6424, lng: 127.4890, address: '충북 청주시 상당구 상당로 155' },
    '전주': { lat: 35.8242, lng: 127.1480, address: '전북 전주시 완산구 기린대로 213' },
    '천안': { lat: 36.8151, lng: 127.1139, address: '충남 천안시 서북구 번영로 156' },
    '포항': { lat: 36.0190, lng: 129.3434, address: '경북 포항시 남구 시청로 1' },
    '제주': { lat: 33.4996, lng: 126.5312, address: '제주 제주시 광양9길 10' },
};

export function buildLocalLocationCandidates(
    performances: Performance[],
    query: string,
    limit = 12,
): LocationSearchCandidate[] {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return [];

    const seen = new Set<string>();
    const candidates: Array<LocationSearchCandidate & { score: number }> = [];

    // Synthesize district office/center fallback candidate if the query is a region/landmark
    const queryEndsWithOffice = /시청$|구청$|군청$|도청$|주민센터$|동사무소$/.test(normalizedQuery);
    const baseName = normalizedQuery.replace(/시청$|구청$|군청$|도청$|주민센터$|동사무소$|시$|구$|군$|도$/, '');

    if (baseName.length >= 2) {
        let synthLat: number | null = null;
        let synthLng: number | null = null;
        let synthAddress = '';
        let synthName = query;

        const matchedKey = Object.keys(MAJOR_OFFICES).find(k => baseName === k || baseName.startsWith(k) || k.startsWith(baseName));
        if (matchedKey) {
            const office = MAJOR_OFFICES[matchedKey];
            synthLat = office.lat;
            synthLng = office.lng;
            synthAddress = office.address;
            synthName = query;
        } else {
            const match = performances.find(p => {
                const district = normalize(p.district);
                const region = normalize(p.region);
                const address = normalize(p.address);
                return (
                    (district && (district.includes(baseName) || baseName.includes(district))) ||
                    (region && (region.includes(baseName) || baseName.includes(region))) ||
                    (address && address.includes(baseName))
                );
            });
            if (match) {
                const lat = toFiniteNumber(match.lat ?? match.latitude);
                const lng = toFiniteNumber(match.lng ?? match.longitude);
                if (lat !== null && lng !== null) {
                    synthLat = lat;
                    synthLng = lng;
                    synthAddress = match.address || `${match.region || ''} ${match.district || ''}`;
                    synthName = query;
                }
            }
        }

        if (synthLat !== null && synthLng !== null) {
            candidates.push({
                type: 'location',
                name: synthName,
                address: synthAddress || '지역 중심부',
                lat: synthLat,
                lng: synthLng,
                venueId: `center_${baseName}`,
                category: '지명/행정기관',
                source: 'local',
                score: 10000,
            });
            seen.add(normalize(synthName) + ':' + normalize(synthAddress || ''));
        }
    }

    for (const performance of performances) {
        const lat = toFiniteNumber(performance.lat ?? performance.latitude);
        const lng = toFiniteNumber(performance.lng ?? performance.longitude);
        if (lat === null || lng === null) continue;

        const name = collapseDuplicateLeadingLocationToken(performance.venue);
        if (!name) continue;

        const address = collapseDuplicateLeadingLocationToken(performance.address);
        const district = performance.district?.trim();
        const region = performance.region?.trim();
        const nameKey = normalize(name);
        const addressKey = normalize(address);
        const districtKey = normalize(district);
        const regionKey = normalize(region);

        const matchedByLocation =
            matchesLocationField(name, query) ||
            matchesLocationField(address, query) ||
            matchesLocationField(district, query) ||
            matchesLocationField(region, query);
        if (!matchedByLocation) continue;

        const dedupeKey = `${nameKey}:${addressKey}:${lat.toFixed(5)}:${lng.toFixed(5)}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const score =
            (nameKey === normalizedQuery ? 100 : 0) +
            (matchesLocationField(name, query) ? 70 : 0) +
            (matchesLocationField(address, query) ? 35 : 0) +
            (districtKey === normalizedQuery || matchesLocationField(district, query) ? 25 : 0) +
            (regionKey === normalizedQuery || matchesLocationField(region, query) ? 10 : 0);

        candidates.push({
            type: 'location',
            name,
            address,
            lat,
            lng,
            venueId: performance.venueCanonicalId || performance.venueKey || performance.id,
            category: district || region || '공연장',
            source: 'local',
            score,
        });
    }

    return candidates
        .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'ko'))
        .slice(0, limit)
        .map((candidate) => {
            const { score, ...result } = candidate;
            void score;
            return result;
        });
}

export function performanceMatchesLocationQuery(
    performance: Performance,
    query: string,
    resolvedVenue?: { name?: string; address?: string; district?: string; mapped_region_id?: string } | null,
) {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return false;

    const fields = [
        performance.venue,
        performance.address,
        performance.district,
        performance.region,
        resolvedVenue?.name,
        resolvedVenue?.address,
        resolvedVenue?.district,
        resolvedVenue?.mapped_region_id,
    ];

    return fields.some((field) => matchesLocationField(field, normalizedQuery));
}
