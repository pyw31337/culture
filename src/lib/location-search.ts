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

function matchesLocationField(value: unknown, query: string) {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery) return false;

    const collapsedValue = collapseDuplicateLeadingLocationToken(String(value || ''));
    const normalizedValue = normalize(collapsedValue);
    if (normalizedValue === normalizedQuery || normalizedValue.startsWith(normalizedQuery)) return true;

    return tokenizeLocationText(collapsedValue).some((token) => {
        const normalizedToken = normalize(token);
        return normalizedToken === normalizedQuery || normalizedToken.startsWith(normalizedQuery);
    });
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
