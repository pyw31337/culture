import fs from 'fs';
import path from 'path';

type PerformanceRecord = {
    id?: string;
    title?: string;
    genre?: string;
    venue?: string;
    venueKey?: string;
    locationKey?: string;
    address?: string;
    lat?: number | string;
    lng?: number | string;
};

type MapVenueRecord = {
    groupKey?: string;
    venueName?: string;
    venueKey?: string;
    address?: string;
    lat?: number | string;
    lng?: number | string;
    performances?: PerformanceRecord[];
};

function readJson<T>(filePath: string, fallback: T): T {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function parseCoordinate(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return undefined;
}

function compact(value?: string) {
    return (value || '').replace(/[()\[\]{}"'“”‘’·ㆍ,./\\\-_:|\s]/g, '').toLowerCase();
}

function compactDisplay(value?: string) {
    return (value || '').replace(/\s+/g, ' ').trim();
}

function isGenericVenueName(value?: string) {
    const text = compactDisplay(value);
    if (!text) return true;
    if (/^[·ㆍ]\s*[가-힣]+[구군시읍면동]$/.test(text)) return true;
    if (/[·ㆍ]/.test(text) && !/\d/.test(text)) return true;
    if (/^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)\s+[가-힣]+[구군시]$/.test(text)) return true;
    if (/^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)$/.test(text)) return true;
    return /집결지|장소 확인|위치 확인|검사대|계단 앞|인근에 전용|외 \d+곳|12개점|전용|출강/.test(text);
}

function coordinateKey(lat?: number, lng?: number) {
    if (!lat || !lng) return '';
    return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function isDomesticCoordinate(lat?: number, lng?: number) {
    if (!lat || !lng) return false;
    return lat >= 32 && lat <= 39.5 && lng >= 124 && lng <= 132;
}

function getNavigationKey(performance: PerformanceRecord) {
    const lat = parseCoordinate(performance.lat);
    const lng = parseCoordinate(performance.lng);
    return performance.locationKey
        || `${performance.venueKey || performance.venue || 'unknown'}::${coordinateKey(lat, lng) || performance.address || ''}`;
}

function main() {
    const root = process.cwd();
    const dataDir = path.join(root, 'public', 'data');
    const performances = readJson<PerformanceRecord[]>(path.join(dataDir, 'performances.json'), []);
    const mapItems = readJson<PerformanceRecord[]>(path.join(dataDir, 'map-items.json'), []);
    const mapVenues = readJson<MapVenueRecord[]>(path.join(dataDir, 'map-venues.json'), []);

    const mapItemIds = new Set(mapItems.map((item) => item.id).filter(Boolean));
    const mapVenueKeys = new Set(mapVenues.map((venue) => venue.groupKey).filter(Boolean));
    const mapVenueNameIndex = new Map<string, MapVenueRecord[]>();

    mapVenues.forEach((venue) => {
        [venue.venueName, venue.venueKey].filter(Boolean).forEach((name) => {
            const key = compact(name);
            if (!key) return;
            const current = mapVenueNameIndex.get(key) || [];
            current.push(venue);
            mapVenueNameIndex.set(key, current);
        });
    });

    const checked = performances.filter((performance) => (
        performance.genre !== 'movie' &&
        Boolean(performance.venue) &&
        !['장소 확인 필요', '정보 없음'].includes(performance.venue || '')
    ));

    const missingCoordinates: PerformanceRecord[] = [];
    const actionableMissingCoordinates: PerformanceRecord[] = [];
    const invalidCoordinates: PerformanceRecord[] = [];
    const missingMapItems: PerformanceRecord[] = [];
    const missingMapVenueGroups: PerformanceRecord[] = [];
    const ambiguousVenueNames: Array<{ venueName: string; count: number; sampleGroupKeys: string[] }> = [];

    checked.forEach((performance) => {
        const lat = parseCoordinate(performance.lat);
        const lng = parseCoordinate(performance.lng);
        if (!lat || !lng) {
            missingCoordinates.push(performance);
            if (!isGenericVenueName(performance.venue) && !isGenericVenueName(performance.venueKey)) {
                actionableMissingCoordinates.push(performance);
            }
            return;
        }

        if (!isDomesticCoordinate(lat, lng)) {
            invalidCoordinates.push(performance);
        }

        if (performance.id && !mapItemIds.has(performance.id)) {
            missingMapItems.push(performance);
        }

        if (!mapVenueKeys.has(getNavigationKey(performance))) {
            const candidates = mapVenueNameIndex.get(compact(performance.venue));
            if (!candidates || candidates.length === 0) {
                missingMapVenueGroups.push(performance);
            }
        }
    });

    mapVenueNameIndex.forEach((venues, key) => {
        if (venues.length < 2 || !key || isGenericVenueName(venues[0]?.venueName || venues[0]?.venueKey)) return;

        const uniqueByGroupKey = Array.from(new Map(
            venues.map((venue) => [venue.groupKey || `${venue.venueName}-${venue.lat}-${venue.lng}`, venue])
        ).values());
        if (uniqueByGroupKey.length < 2) return;

        const coordinateSet = new Set(uniqueByGroupKey.map((venue) => coordinateKey(parseCoordinate(venue.lat), parseCoordinate(venue.lng))));
        const coordinates = uniqueByGroupKey
            .map((venue) => ({ lat: parseCoordinate(venue.lat), lng: parseCoordinate(venue.lng) }))
            .filter((coordinate): coordinate is { lat: number; lng: number } => Boolean(coordinate.lat && coordinate.lng));
        const hasMeaningfullyDifferentCoordinates = coordinates.some((left, leftIndex) => (
            coordinates.slice(leftIndex + 1).some((right) => {
                const latDiff = Math.abs(left.lat - right.lat);
                const lngDiff = Math.abs(left.lng - right.lng);
                return latDiff > 0.003 || lngDiff > 0.003;
            })
        ));

        if (coordinateSet.size > 1 && hasMeaningfullyDifferentCoordinates) {
            ambiguousVenueNames.push({
                venueName: uniqueByGroupKey[0]?.venueName || uniqueByGroupKey[0]?.venueKey || key,
                count: uniqueByGroupKey.length,
                sampleGroupKeys: uniqueByGroupKey.slice(0, 5).map((venue) => venue.groupKey || '').filter(Boolean),
            });
        }
    });

    const report = {
        checkedAt: new Date().toISOString(),
        summary: {
            checkedPerformanceCount: checked.length,
            mapItemCount: mapItems.length,
            mapVenueGroupCount: mapVenues.length,
            missingCoordinateCount: missingCoordinates.length,
            actionableMissingCoordinateCount: actionableMissingCoordinates.length,
            invalidCoordinateCount: invalidCoordinates.length,
            missingMapItemCount: missingMapItems.length,
            missingMapVenueGroupCount: missingMapVenueGroups.length,
            ambiguousVenueNameCount: ambiguousVenueNames.length,
            status: actionableMissingCoordinates.length + invalidCoordinates.length + missingMapVenueGroups.length === 0 ? 'pass' : 'warn',
        },
        samples: {
            missingCoordinates: missingCoordinates.slice(0, 50),
            actionableMissingCoordinates: actionableMissingCoordinates.slice(0, 50),
            invalidCoordinates: invalidCoordinates.slice(0, 50),
            missingMapItems: missingMapItems.slice(0, 50),
            missingMapVenueGroups: missingMapVenueGroups.slice(0, 50),
            ambiguousVenueNames: ambiguousVenueNames.slice(0, 50),
        },
    };

    const outPath = path.join(dataDir, 'map-navigation-report.json');
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`Map navigation integrity: ${report.summary.status}`);
    console.log(JSON.stringify(report.summary, null, 2));
    console.log(`Wrote ${outPath}`);
}

main();
