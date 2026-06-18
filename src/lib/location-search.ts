import type { Performance } from '@/types';

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

function toFiniteNumber(value: unknown) {
    const next = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(next) && next !== 0 ? next : null;
}

export function buildLocalLocationCandidates(
    performances: Performance[],
    query: string,
    limit = 12,
): LocationSearchCandidate[] {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return [];

    const seen = new Set<string>();
    const candidates: Array<LocationSearchCandidate & { score: number }> = [];

    for (const performance of performances) {
        const lat = toFiniteNumber(performance.lat ?? performance.latitude);
        const lng = toFiniteNumber(performance.lng ?? performance.longitude);
        if (lat === null || lng === null) continue;

        const name = performance.venue?.trim();
        if (!name) continue;

        const address = performance.address?.trim();
        const district = performance.district?.trim();
        const region = performance.region?.trim();
        const nameKey = normalize(name);
        const addressKey = normalize(address);
        const districtKey = normalize(district);
        const regionKey = normalize(region);

        const matchedByLocation =
            nameKey.includes(normalizedQuery) ||
            addressKey.includes(normalizedQuery) ||
            districtKey.includes(normalizedQuery) ||
            regionKey.includes(normalizedQuery);
        if (!matchedByLocation) continue;

        const dedupeKey = `${nameKey}:${addressKey}:${lat.toFixed(5)}:${lng.toFixed(5)}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        const score =
            (nameKey === normalizedQuery ? 100 : 0) +
            (nameKey.startsWith(normalizedQuery) ? 70 : 0) +
            (nameKey.includes(normalizedQuery) ? 45 : 0) +
            (addressKey.includes(normalizedQuery) ? 35 : 0) +
            (districtKey.includes(normalizedQuery) ? 25 : 0) +
            (regionKey.includes(normalizedQuery) ? 10 : 0);

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
        .map(({ score: _score, ...candidate }) => candidate);
}
