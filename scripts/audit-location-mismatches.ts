import fs from 'fs';
import path from 'path';
import { getPerformanceLocationLabel, isSevereAddressMismatch, resolveVenueInfoForPerformance } from '../src/lib/location-display';
import type { Performance } from '../src/types';

type VenueRecord = Record<string, {
    address?: string;
    lat?: number;
    lng?: number;
    latitude?: number | string;
    longitude?: number | string;
    district?: string;
    name?: string;
}>;

const PERFORMANCES_PATH = path.join(process.cwd(), 'public', 'data', 'performances.json');
const VENUES_PATH = path.join(process.cwd(), 'public', 'data', 'venues.json');

function readJson<T>(filePath: string): T {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function normalizeWhitespace(value?: string) {
    return value?.replace(/\s+/g, ' ').trim() || '';
}

function hasAuthoritativeAddress(performance: Performance) {
    const address = normalizeWhitespace(performance.address).replace(/지도보기$/g, '');
    if (!address || address === '정보 없음') return false;
    if (address === normalizeWhitespace(performance.venue)) return false;
    return /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/.test(address);
}

function main() {
    const performances = readJson<Performance[]>(PERFORMANCES_PATH);
    const venues = readJson<VenueRecord>(VENUES_PATH);

    const rawMismatchRows = performances
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
                performanceAddress: performance.address,
                venueDictionaryAddress: venues[performance.venue]?.address || '',
                resolvedAddress: resolved.address || '',
                displayLabel: getPerformanceLocationLabel(performance, venues, 3),
                authoritativeAddress: hasAuthoritativeAddress(performance),
            };
        });

    const highConfidenceRows = rawMismatchRows.filter((row) => row.authoritativeAddress);

    const byVenue = highConfidenceRows.reduce<Record<string, number>>((acc, row) => {
        acc[row.venue] = (acc[row.venue] || 0) + 1;
        return acc;
    }, {});

    const bySource = highConfidenceRows.reduce<Record<string, number>>((acc, row) => {
        const key = row.source || 'unknown';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    const report = {
        checkedAt: new Date().toISOString(),
        performanceCount: performances.length,
        rawMismatchCount: rawMismatchRows.length,
        highConfidenceMismatchCount: highConfidenceRows.length,
        highConfidenceBySource: Object.entries(bySource).sort((a, b) => b[1] - a[1]),
        topHighRiskVenues: Object.entries(byVenue).sort((a, b) => b[1] - a[1]).slice(0, 20),
        samples: highConfidenceRows.slice(0, 50),
    };

    console.log(JSON.stringify(report, null, 2));
}

main();
