import { buildPerformanceLocationKey, getPerformanceLocationLabel, getPerformanceVenueKey, isSevereAddressMismatch, resolveVenueInfoForPerformance } from '../../src/lib/location-display';
import type { Performance } from '../../src/types';

type VenueRecord = Record<string, {
    address?: string;
    lat?: number;
    lng?: number;
    latitude?: number | string;
    longitude?: number | string;
    district?: string;
    name?: string;
}>;

type LocationAuditRow = {
    id: string;
    title: string;
    genre: string;
    source?: string;
    venue: string;
    venueKey: string;
    venueCanonicalId?: string;
    performanceAddress: string;
    venueDictionaryAddress: string;
    resolvedAddress: string;
    displayLabel: string;
    authoritativeAddress: boolean;
    locationKey: string;
};

function normalizeWhitespace(value?: string) {
    return value?.replace(/\s+/g, ' ').trim() || '';
}

export function hasAuthoritativeAddress(performance: Performance) {
    const address = normalizeWhitespace(performance.address).replace(/지도보기$/g, '');
    if (!address || address === '정보 없음') return false;
    if (address === normalizeWhitespace(performance.venue)) return false;
    return /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/.test(address);
}

export function buildLocationIntegrityReport(
    performances: Performance[],
    venues: VenueRecord
) {
    const rawMismatchRows: LocationAuditRow[] = performances
        .filter((performance) => {
            const venueAddress = venues[performance.venue]?.address;
            return isSevereAddressMismatch(performance.address, venueAddress);
        })
        .map((performance) => {
            const resolved = resolveVenueInfoForPerformance(performance, venues);

            return {
                id: performance.id,
                title: performance.title,
                genre: performance.genre,
                source: performance.source,
                venue: performance.venue,
                venueKey: performance.venueKey || getPerformanceVenueKey(performance, venues),
                venueCanonicalId: performance.venueCanonicalId,
                performanceAddress: performance.address || '',
                venueDictionaryAddress: venues[performance.venue]?.address || '',
                resolvedAddress: resolved.address || '',
                displayLabel: getPerformanceLocationLabel(performance, venues, 3),
                authoritativeAddress: hasAuthoritativeAddress(performance),
                locationKey: buildPerformanceLocationKey(performance, venues),
            };
        });

    const highConfidenceRows = rawMismatchRows.filter((row) => row.authoritativeAddress);
    const resolvedMismatchRows = highConfidenceRows.filter((row) =>
        isSevereAddressMismatch(row.performanceAddress, row.resolvedAddress)
    );

    const byVenue = highConfidenceRows.reduce<Record<string, number>>((acc, row) => {
        acc[row.venue] = (acc[row.venue] || 0) + 1;
        return acc;
    }, {});

    const bySource = highConfidenceRows.reduce<Record<string, number>>((acc, row) => {
        const key = row.source || 'unknown';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    const venueGroups = new Map<string, LocationAuditRow[]>();
    highConfidenceRows.forEach((row) => {
        const group = venueGroups.get(row.venue) || [];
        group.push(row);
        venueGroups.set(row.venue, group);
    });

    const rawAmbiguousVenues = Array.from(venueGroups.entries())
        .map(([venue, rows]) => {
            const locationGroups = new Map<string, LocationAuditRow[]>();
            rows.forEach((row) => {
                const group = locationGroups.get(row.locationKey) || [];
                group.push(row);
                locationGroups.set(row.locationKey, group);
            });

            return {
                venue,
                locationCount: locationGroups.size,
                locations: Array.from(locationGroups.values()).map((group) => ({
                    displayLabel: group[0]?.displayLabel || group[0]?.resolvedAddress || venue,
                    resolvedAddress: group[0]?.resolvedAddress || '',
                    count: group.length,
                    samples: group.slice(0, 3).map((row) => ({
                        id: row.id,
                        title: row.title,
                    })),
                })),
            };
        })
        .filter((row) => row.locationCount > 1)
        .sort((left, right) => right.locationCount - left.locationCount || right.locations.reduce((sum, item) => sum + item.count, 0) - left.locations.reduce((sum, item) => sum + item.count, 0));

    const canonicalVenueGroups = new Map<string, LocationAuditRow[]>();
    highConfidenceRows.forEach((row) => {
        const canonicalKey = row.venueCanonicalId || row.venueKey;
        const group = canonicalVenueGroups.get(canonicalKey) || [];
        group.push(row);
        canonicalVenueGroups.set(canonicalKey, group);
    });

    const canonicalAmbiguousVenues = Array.from(canonicalVenueGroups.entries())
        .map(([venue, rows]) => {
            const locationGroups = new Map<string, LocationAuditRow[]>();
            rows.forEach((row) => {
                const locationKey = normalizeWhitespace(row.displayLabel) || normalizeWhitespace(row.resolvedAddress) || row.locationKey;
                const group = locationGroups.get(locationKey) || [];
                group.push(row);
                locationGroups.set(locationKey, group);
            });

            return {
                venue: rows[0]?.venueKey || venue,
                locationCount: locationGroups.size,
                locations: Array.from(locationGroups.values()).map((group) => ({
                    displayLabel: group[0]?.displayLabel || group[0]?.resolvedAddress || venue,
                    resolvedAddress: group[0]?.resolvedAddress || '',
                    count: group.length,
                    samples: group.slice(0, 3).map((row) => ({
                        id: row.id,
                        title: row.title,
                    })),
                })),
            };
        })
        .filter((row) => row.locationCount > 1)
        .sort((left, right) => right.locationCount - left.locationCount || right.locations.reduce((sum, item) => sum + item.count, 0) - left.locations.reduce((sum, item) => sum + item.count, 0));

    return {
        checkedAt: new Date().toISOString(),
        performanceCount: performances.length,
        rawMismatchCount: rawMismatchRows.length,
        highConfidenceMismatchCount: highConfidenceRows.length,
        resolvedMismatchCount: resolvedMismatchRows.length,
        rawAmbiguousVenueNameCount: rawAmbiguousVenues.length,
        ambiguousVenueCount: canonicalAmbiguousVenues.length,
        highConfidenceBySource: Object.entries(bySource).sort((a, b) => b[1] - a[1]),
        topHighRiskVenues: Object.entries(byVenue).sort((a, b) => b[1] - a[1]).slice(0, 20),
        topRawAmbiguousVenueNames: rawAmbiguousVenues.slice(0, 20),
        topAmbiguousVenues: canonicalAmbiguousVenues.slice(0, 20),
        samples: highConfidenceRows.slice(0, 50),
        unresolvedSamples: resolvedMismatchRows.slice(0, 20),
    };
}
