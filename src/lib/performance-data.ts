import type { Performance } from '@/types';
import { safeArray, safePerformanceList } from '@/lib/data-safety';
import type {
    DataBuildInfo,
    DataQualitySummary,
    DataSourceFreshness,
    DataSourceHealthSummary,
    DataSourceSummary,
    DisplayIntegritySummary,
    SourceFunnelSummary,
    OperationsSummary,
    PriceCoverageSummary,
    VenueCanonicalizationSummary,
    VenueMasterSummary,
    VenuePlaceMatchingSummary
} from '@/lib/build-info';
import { formatKoreanDateTime } from '@/lib/build-info';
import { buildPerformanceLocationKey, getPerformanceVenueKey, resolveVenueInfoForPerformance } from '@/lib/location-display';
import { processAndMergePerformances } from '@/lib/performance-merger';
import { transformPerformance, type RawPerformance } from '@/lib/data-transformer';
import { SOURCE_REGISTRY } from '@/lib/source-registry';

import fs from 'fs';
import path from 'path';

const SOURCE_DATA_DIR = ['src', 'data'];
const PUBLIC_DATA_DIR = ['public', 'data'];

export interface CinemaData {
    name: string;
    address: string;
    lat: number;
    lng: number;
    brand: string;
}

export interface VenueData {
    address?: string;
    lat?: number;
    lng?: number;
    latitude?: number | string;
    longitude?: number | string;
}

function parseCoordinate(value: unknown) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseFloat(value);
    return 0;
}

function hydrateLocationIdentity(items: Performance[], venues: Record<string, VenueData>) {
    return items.map((performance) => {
        const resolvedVenue = resolveVenueInfoForPerformance(performance, venues);
        const lat = parseCoordinate(performance.lat || performance.latitude || resolvedVenue.lat || resolvedVenue.latitude);
        const lng = parseCoordinate(performance.lng || performance.longitude || resolvedVenue.lng || resolvedVenue.longitude);
        const address = performance.address || resolvedVenue.address;

        return {
            ...performance,
            address,
            lat: lat || undefined,
            lng: lng || undefined,
            venueKey: performance.venueKey || getPerformanceVenueKey({
                ...performance,
                address,
            }, venues),
            locationKey: performance.locationKey || buildPerformanceLocationKey({
                ...performance,
                address,
                lat: lat || undefined,
                lng: lng || undefined,
            }, venues),
        };
    });
}

function loadJSONFrom(baseDir: string[], filename: string, defaultValue: unknown = []) {
    try {
        const filePath = path.join(process.cwd(), ...baseDir, filename);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content);
        }
    } catch (e) {
        console.error(`[Error] Failed to load ${filename}:`, e);
    }
    return defaultValue;
}

function loadSourceJSON(filename: string, defaultValue: unknown = []) {
    return loadJSONFrom(SOURCE_DATA_DIR, filename, defaultValue);
}

function loadPublicJSON(filename: string, defaultValue: unknown = null) {
    return loadJSONFrom(PUBLIC_DATA_DIR, filename, defaultValue);
}

// Global cache to prevent Next.js from parsing massive JSON files 12,000 times during static build
let cachedRawPerformances: Performance[] | null = null;
let cachedPublicPerformances: Performance[] | null = null;
let cachedBuildInfo: DataBuildInfo | null = null;
let cachedVenues: Record<string, VenueData> | null = null;
let cachedCinemas: CinemaData[] | null = null;
let attemptedPublicPerformancesLoad = false;
let attemptedBuildInfoLoad = false;

function normalizeCountMap(value: unknown): Record<string, number> {
    if (!value || typeof value !== 'object') return {};

    return Object.entries(value as Record<string, unknown>).reduce<Record<string, number>>((acc, [key, entry]) => {
        if (typeof entry === 'number' && Number.isFinite(entry)) {
            acc[key] = entry;
        }
        return acc;
    }, {});
}

function normalizeQualitySummary(value: unknown): DataQualitySummary | null {
    if (!value || typeof value !== 'object') return null;

    const candidate = value as Partial<DataQualitySummary>;

    return {
        checkedAt: typeof candidate.checkedAt === 'string' ? candidate.checkedAt : new Date().toISOString(),
        status: candidate.status === 'warn' ? 'warn' : 'pass',
        missingLinkCount: typeof candidate.missingLinkCount === 'number' ? candidate.missingLinkCount : 0,
        missingDescriptionCount: typeof candidate.missingDescriptionCount === 'number' ? candidate.missingDescriptionCount : 0,
        missingImageCount: typeof candidate.missingImageCount === 'number' ? candidate.missingImageCount : 0,
        brokenLocalImageCount: typeof candidate.brokenLocalImageCount === 'number' ? candidate.brokenLocalImageCount : 0,
        movieMissingLinkCount: typeof candidate.movieMissingLinkCount === 'number' ? candidate.movieMissingLinkCount : 0,
        movieMissingDescriptionCount: typeof candidate.movieMissingDescriptionCount === 'number' ? candidate.movieMissingDescriptionCount : 0,
        movieBrokenImageCount: typeof candidate.movieBrokenImageCount === 'number' ? candidate.movieBrokenImageCount : 0,
        warningsByGenre: {
            missingLinks: normalizeCountMap(candidate.warningsByGenre?.missingLinks),
            missingDescriptions: normalizeCountMap(candidate.warningsByGenre?.missingDescriptions),
            missingImages: normalizeCountMap(candidate.warningsByGenre?.missingImages),
        },
    };
}

function normalizeDisplayIntegritySummary(value: unknown): DisplayIntegritySummary | null {
    if (!value || typeof value !== 'object') return null;

    const candidate = value as Partial<DisplayIntegritySummary>;
    const status = candidate.status === 'fail' || candidate.status === 'warn' ? candidate.status : 'pass';
    return {
        checkedAt: typeof candidate.checkedAt === 'string' ? candidate.checkedAt : new Date().toISOString(),
        status,
        itemCount: typeof candidate.itemCount === 'number' ? candidate.itemCount : 0,
        blockingIssueCount: typeof candidate.blockingIssueCount === 'number' ? candidate.blockingIssueCount : 0,
        locationMismatchCount: typeof candidate.locationMismatchCount === 'number' ? candidate.locationMismatchCount : 0,
        bracketLocationMismatchCount: typeof candidate.bracketLocationMismatchCount === 'number' ? candidate.bracketLocationMismatchCount : 0,
        suspiciousFreePriceCount: typeof candidate.suspiciousFreePriceCount === 'number' ? candidate.suspiciousFreePriceCount : 0,
        unknownPriceCount: typeof candidate.unknownPriceCount === 'number' ? candidate.unknownPriceCount : 0,
        invalidDateCount: typeof candidate.invalidDateCount === 'number' ? candidate.invalidDateCount : 0,
        duplicateTimeCount: typeof candidate.duplicateTimeCount === 'number' ? candidate.duplicateTimeCount : 0,
        outOfSeasonCount: typeof candidate.outOfSeasonCount === 'number' ? candidate.outOfSeasonCount : 0,
    };
}

function normalizeSourceFreshness(value: unknown): DataSourceFreshness {
    if (value === 'fresh' || value === 'aging' || value === 'stale' || value === 'offseason') {
        return value;
    }

    return 'unknown';
}

function normalizeSourceSummaries(value: unknown): DataSourceSummary[] {
    if (!Array.isArray(value)) return [];

    return value.reduce<DataSourceSummary[]>((acc, entry) => {
        if (!entry || typeof entry !== 'object') return acc;

        const candidate = entry as Partial<DataSourceSummary>;
        if (typeof candidate.key !== 'string' || typeof candidate.file !== 'string') return acc;

        acc.push({
            key: candidate.key,
            label: typeof candidate.label === 'string' ? candidate.label : candidate.key,
            file: candidate.file,
            itemCount: typeof candidate.itemCount === 'number' ? candidate.itemCount : 0,
            updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : null,
            ageDays: typeof candidate.ageDays === 'number' ? candidate.ageDays : null,
            freshness: normalizeSourceFreshness(candidate.freshness),
            seasonal: candidate.seasonal === true,
        });

        return acc;
    }, []);
}

function normalizeSourceHealthSummary(value: unknown): DataSourceHealthSummary | null {
    if (!value || typeof value !== 'object') return null;

    const candidate = value as Partial<DataSourceHealthSummary>;
    return {
        totalSources: typeof candidate.totalSources === 'number' ? candidate.totalSources : 0,
        freshCount: typeof candidate.freshCount === 'number' ? candidate.freshCount : 0,
        agingCount: typeof candidate.agingCount === 'number' ? candidate.agingCount : 0,
        staleCount: typeof candidate.staleCount === 'number' ? candidate.staleCount : 0,
        offseasonCount: typeof candidate.offseasonCount === 'number' ? candidate.offseasonCount : 0,
        unknownCount: typeof candidate.unknownCount === 'number' ? candidate.unknownCount : 0,
    };
}

function normalizeSourceFunnelSummary(value: unknown): SourceFunnelSummary | null {
    if (!value || typeof value !== 'object') return null;

    const candidate = value as Partial<SourceFunnelSummary>;
    return {
        checkedAt: typeof candidate.checkedAt === 'string' ? candidate.checkedAt : new Date().toISOString(),
        status: candidate.status === 'warn' ? 'warn' : 'pass',
        rawItemCount: typeof candidate.rawItemCount === 'number' ? candidate.rawItemCount : 0,
        finalItemCount: typeof candidate.finalItemCount === 'number' ? candidate.finalItemCount : 0,
        registeredSourceCount: typeof candidate.registeredSourceCount === 'number' ? candidate.registeredSourceCount : 0,
        activeSourceCount: typeof candidate.activeSourceCount === 'number' ? candidate.activeSourceCount : 0,
        missingRegisteredFileCount: typeof candidate.missingRegisteredFileCount === 'number' ? candidate.missingRegisteredFileCount : 0,
        unregisteredDataFileCount: typeof candidate.unregisteredDataFileCount === 'number' ? candidate.unregisteredDataFileCount : 0,
        workflowOnlyScraperCount: typeof candidate.workflowOnlyScraperCount === 'number' ? candidate.workflowOnlyScraperCount : 0,
        registeredWithoutWorkflowCount: typeof candidate.registeredWithoutWorkflowCount === 'number' ? candidate.registeredWithoutWorkflowCount : 0,
        highLossSourceCount: typeof candidate.highLossSourceCount === 'number' ? candidate.highLossSourceCount : 0,
        noFinalOutputSourceCount: typeof candidate.noFinalOutputSourceCount === 'number' ? candidate.noFinalOutputSourceCount : 0,
        topUnregisteredDataFiles: Array.isArray(candidate.topUnregisteredDataFiles) ? candidate.topUnregisteredDataFiles : [],
        topHighLossSources: Array.isArray(candidate.topHighLossSources) ? candidate.topHighLossSources : [],
    };
}

function normalizeVenueCanonicalizationSummary(value: unknown): VenueCanonicalizationSummary | null {
    if (!value || typeof value !== 'object') return null;

    const candidate = value as Partial<VenueCanonicalizationSummary>;
    return {
        checkedAt: typeof candidate.checkedAt === 'string' ? candidate.checkedAt : new Date().toISOString(),
        status: candidate.status === 'warn' ? 'warn' : 'pass',
        usedVenueCount: typeof candidate.usedVenueCount === 'number' ? candidate.usedVenueCount : 0,
        usedPerformanceCount: typeof candidate.usedPerformanceCount === 'number' ? candidate.usedPerformanceCount : 0,
        invalidCoordinateVenueCount: typeof candidate.invalidCoordinateVenueCount === 'number' ? candidate.invalidCoordinateVenueCount : 0,
        missingAddressVenueCount: typeof candidate.missingAddressVenueCount === 'number' ? candidate.missingAddressVenueCount : 0,
        exactAddressAliasCandidateCount: typeof candidate.exactAddressAliasCandidateCount === 'number' ? candidate.exactAddressAliasCandidateCount : 0,
        parentChildCandidateCount: typeof candidate.parentChildCandidateCount === 'number' ? candidate.parentChildCandidateCount : 0,
        coordinateNameSimilarCandidateCount: typeof candidate.coordinateNameSimilarCandidateCount === 'number' ? candidate.coordinateNameSimilarCandidateCount : 0,
        coordinateRiskGroupCount: typeof candidate.coordinateRiskGroupCount === 'number' ? candidate.coordinateRiskGroupCount : 0,
        highConfidenceMergeCandidateCount: typeof candidate.highConfidenceMergeCandidateCount === 'number' ? candidate.highConfidenceMergeCandidateCount : 0,
        reviewCandidateCount: typeof candidate.reviewCandidateCount === 'number' ? candidate.reviewCandidateCount : 0,
        externalLookupMode: candidate.externalLookupMode === 'lookup-ready' ? 'lookup-ready' : 'offline-audit',
        topHighConfidenceCandidates: Array.isArray(candidate.topHighConfidenceCandidates) ? candidate.topHighConfidenceCandidates : [],
        topCoordinateRiskGroups: Array.isArray(candidate.topCoordinateRiskGroups) ? candidate.topCoordinateRiskGroups : [],
    };
}

function normalizeVenueMasterSummary(value: unknown): VenueMasterSummary | null {
    if (!value || typeof value !== 'object') return null;

    const candidate = value as Partial<VenueMasterSummary>;
    return {
        checkedAt: typeof candidate.checkedAt === 'string' ? candidate.checkedAt : new Date().toISOString(),
        status: candidate.status === 'warn' ? 'warn' : 'pass',
        entryCount: typeof candidate.entryCount === 'number' ? candidate.entryCount : 0,
        performanceCount: typeof candidate.performanceCount === 'number' ? candidate.performanceCount : 0,
        highConfidenceCount: typeof candidate.highConfidenceCount === 'number' ? candidate.highConfidenceCount : 0,
        mediumConfidenceCount: typeof candidate.mediumConfidenceCount === 'number' ? candidate.mediumConfidenceCount : 0,
        lowConfidenceCount: typeof candidate.lowConfidenceCount === 'number' ? candidate.lowConfidenceCount : 0,
        needsOfficialLookupCount: typeof candidate.needsOfficialLookupCount === 'number' ? candidate.needsOfficialLookupCount : 0,
        missingAddressCount: typeof candidate.missingAddressCount === 'number' ? candidate.missingAddressCount : 0,
        invalidCoordinateCount: typeof candidate.invalidCoordinateCount === 'number' ? candidate.invalidCoordinateCount : 0,
        coordinateFallbackRiskCount: typeof candidate.coordinateFallbackRiskCount === 'number' ? candidate.coordinateFallbackRiskCount : 0,
        parentChildGroupCount: typeof candidate.parentChildGroupCount === 'number' ? candidate.parentChildGroupCount : 0,
        aliasMergedGroupCount: typeof candidate.aliasMergedGroupCount === 'number' ? candidate.aliasMergedGroupCount : 0,
        topReviewEntries: Array.isArray(candidate.topReviewEntries) ? candidate.topReviewEntries : [],
    };
}

function normalizeVenuePlaceMatchingSummary(value: unknown): VenuePlaceMatchingSummary | null {
    if (!value || typeof value !== 'object') return null;

    const candidate = value as Partial<VenuePlaceMatchingSummary>;
    return {
        checkedAt: typeof candidate.checkedAt === 'string' ? candidate.checkedAt : new Date().toISOString(),
        status: candidate.status === 'warn' ? 'warn' : 'pass',
        venueCount: typeof candidate.venueCount === 'number' ? candidate.venueCount : 0,
        matchedCount: typeof candidate.matchedCount === 'number' ? candidate.matchedCount : 0,
        highConfidenceMatchCount: typeof candidate.highConfidenceMatchCount === 'number' ? candidate.highConfidenceMatchCount : 0,
        needsReviewCount: typeof candidate.needsReviewCount === 'number' ? candidate.needsReviewCount : 0,
        notFoundCount: typeof candidate.notFoundCount === 'number' ? candidate.notFoundCount : 0,
        pendingLookupCount: typeof candidate.pendingLookupCount === 'number' ? candidate.pendingLookupCount : 0,
        insufficientIdentityCount: typeof candidate.insufficientIdentityCount === 'number' ? candidate.insufficientIdentityCount : 0,
        lookupReady: candidate.lookupReady === true,
        providersConfigured: Array.isArray(candidate.providersConfigured) ? candidate.providersConfigured.filter((value): value is string => typeof value === 'string') : [],
        staleCacheCount: typeof candidate.staleCacheCount === 'number' ? candidate.staleCacheCount : 0,
        topQueue: Array.isArray(candidate.topQueue) ? candidate.topQueue : [],
        topInsufficientIdentityQueue: Array.isArray(candidate.topInsufficientIdentityQueue) ? candidate.topInsufficientIdentityQueue : [],
        topNeedsReview: Array.isArray(candidate.topNeedsReview) ? candidate.topNeedsReview : [],
    };
}

function normalizePriceCoverageSummary(value: unknown): PriceCoverageSummary | null {
    if (!value || typeof value !== 'object') return null;

    const candidate = value as Partial<PriceCoverageSummary>;
    return {
        checkedAt: typeof candidate.checkedAt === 'string' ? candidate.checkedAt : new Date().toISOString(),
        itemCount: typeof candidate.itemCount === 'number' ? candidate.itemCount : 0,
        pricedCount: typeof candidate.pricedCount === 'number' ? candidate.pricedCount : 0,
        unknownCount: typeof candidate.unknownCount === 'number' ? candidate.unknownCount : 0,
        optionalUnknownCount: typeof candidate.optionalUnknownCount === 'number' ? candidate.optionalUnknownCount : 0,
        actionableUnknownCount: typeof candidate.actionableUnknownCount === 'number' ? candidate.actionableUnknownCount : 0,
        coverageRate: typeof candidate.coverageRate === 'number' ? candidate.coverageRate : 0,
        topUnknownBySource: Array.isArray(candidate.topUnknownBySource) ? candidate.topUnknownBySource : [],
    };
}

function normalizeOperationsSummary(value: unknown): OperationsSummary | null {
    if (!value || typeof value !== 'object') return null;

    const candidate = value as Partial<OperationsSummary>;
    return {
        checkedAt: typeof candidate.checkedAt === 'string' ? candidate.checkedAt : new Date().toISOString(),
        localUpdateLogCount: typeof candidate.localUpdateLogCount === 'number' ? candidate.localUpdateLogCount : 0,
        latestLocalUpdateLog: typeof candidate.latestLocalUpdateLog === 'string' ? candidate.latestLocalUpdateLog : null,
        latestLocalUpdateAt: typeof candidate.latestLocalUpdateAt === 'string' ? candidate.latestLocalUpdateAt : null,
        latestLocalUpdateCompleted: candidate.latestLocalUpdateCompleted !== false,
        lastFailureUpdatedAt: typeof candidate.lastFailureUpdatedAt === 'string' ? candidate.lastFailureUpdatedAt : null,
        lastFailureAgeHours: typeof candidate.lastFailureAgeHours === 'number' ? candidate.lastFailureAgeHours : null,
        lastFailureCount: typeof candidate.lastFailureCount === 'number' ? candidate.lastFailureCount : 0,
        lastFailures: Array.isArray(candidate.lastFailures) ? candidate.lastFailures.filter((value): value is string => typeof value === 'string') : [],
        schedulerConfigured: candidate.schedulerConfigured === true,
    };
}

function isPerformanceActive(dateStr: string, today: Date): boolean {
    if (!dateStr || dateStr.trim() === '') return true; // Lenient: Treat items without dates as active (e.g., Museums)

    try {
        // Strip day-of-week suffixes (e.g., "(목)") to prevent Invalid Date errors
        const cleanDate = dateStr.replace(/\s*\([가-힣]\)/g, '').trim();
        let targetDate: Date | null = null;

        // Type 1: Range "YYYY.MM.DD ~ YYYY.MM.DD"
        if (cleanDate.includes('~')) {
            const parts = cleanDate.split('~');
            const endStr = parts[1].trim();
            // Support both dots and dashes in ranges
            const [y, m, d] = endStr.split(/[-.]/).map(Number);
            targetDate = new Date(y, m - 1, d);
            targetDate.setHours(23, 59, 59, 999);
        }
        // Type 2: Single "YYYY-MM-DD HH:mm" (KOVO style)
        else if (dateStr.includes('-') && dateStr.includes(':')) {
            const [datePart] = dateStr.split(' ');
            const [y, m, d] = datePart.split('-').map(Number);
            targetDate = new Date(y, m - 1, d);
            targetDate.setHours(23, 59, 59, 999);
        }
        // Type 3: Simple "YYYY-MM-DD" (Mommom/General)
        else if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
            const [y, m, d] = cleanDate.split('-').map(Number);
            targetDate = new Date(y, m - 1, d);
            targetDate.setHours(23, 59, 59, 999);
        }
        // Type 4: Numeric "YYYYMMDD"
        else if (/^\d{8}$/.test(cleanDate)) {
            const y = parseInt(cleanDate.substring(0, 4));
            const m = parseInt(cleanDate.substring(4, 6));
            const d = parseInt(cleanDate.substring(6, 8));
            targetDate = new Date(y, m - 1, d);
            targetDate.setHours(23, 59, 59, 999);
        }
        // Fallback
        else {
            targetDate = new Date(cleanDate);
            if (targetDate && !isNaN(targetDate.getTime())) {
                targetDate.setHours(23, 59, 59, 999);
            }
        }

        if (!targetDate || isNaN(targetDate.getTime())) return true;

        return targetDate.getTime() >= today.getTime();

    } catch {
        return true;
    }
}

function getPrebuiltPerformances(): Performance[] | null {
    if (attemptedPublicPerformancesLoad) return cachedPublicPerformances;

    attemptedPublicPerformancesLoad = true;
    const data = loadPublicJSON('performances.json', null);
    if (data === null) {
        cachedPublicPerformances = null;
        return null;
    }

    const publicVenues = (cachedVenues || loadPublicJSON('venues.json', loadSourceJSON('venues.json', {}))) as Record<string, VenueData>;
    cachedPublicPerformances = hydrateLocationIdentity(
        safePerformanceList(safeArray<Performance>(data)),
        publicVenues,
    );
    return cachedPublicPerformances;
}

export function getDataBuildInfo(): DataBuildInfo | null {
    if (attemptedBuildInfoLoad) return cachedBuildInfo;

    attemptedBuildInfoLoad = true;
    const data = loadPublicJSON('build-info.json', null);
    if (!data || typeof data !== 'object') {
        cachedBuildInfo = null;
        return null;
    }

    const candidate = data as Partial<DataBuildInfo>;
    cachedBuildInfo = {
        generatedAt: typeof candidate.generatedAt === 'string' ? candidate.generatedAt : new Date().toISOString(),
        version: typeof candidate.version === 'string' ? candidate.version : 'unknown',
        itemCount: typeof candidate.itemCount === 'number' ? candidate.itemCount : 0,
        sourceCounts: normalizeCountMap(candidate.sourceCounts),
        genreCounts: normalizeCountMap(candidate.genreCounts),
        qualitySummary: normalizeQualitySummary(candidate.qualitySummary),
        displayIntegritySummary: normalizeDisplayIntegritySummary(candidate.displayIntegritySummary),
        sourceSummaries: normalizeSourceSummaries(candidate.sourceSummaries),
        sourceHealthSummary: normalizeSourceHealthSummary(candidate.sourceHealthSummary),
        sourceFunnelSummary: normalizeSourceFunnelSummary(candidate.sourceFunnelSummary),
        venueCanonicalizationSummary: normalizeVenueCanonicalizationSummary(candidate.venueCanonicalizationSummary),
        venueMasterSummary: normalizeVenueMasterSummary(candidate.venueMasterSummary),
        venuePlaceMatchingSummary: normalizeVenuePlaceMatchingSummary(candidate.venuePlaceMatchingSummary),
        priceCoverageSummary: normalizePriceCoverageSummary(candidate.priceCoverageSummary),
        operationsSummary: normalizeOperationsSummary(candidate.operationsSummary),
    };
    return cachedBuildInfo;
}

export function formatLastUpdatedLabel(generatedAt?: string | null): string {
    const fallbackLabel = formatKoreanDateTime(new Date().toISOString(), '정보 없음');
    return `${formatKoreanDateTime(generatedAt, fallbackLabel)} `;
}

export function getLastUpdatedLabel(): string {
    return formatLastUpdatedLabel(getDataBuildInfo()?.generatedAt ?? null);
}

export function getAllCinemas(): CinemaData[] {
    if (cachedCinemas) return cachedCinemas;
    const publicCinemas = safeArray<CinemaData>(loadPublicJSON('cinemas.json', []));
    if (publicCinemas.length > 0) {
        cachedCinemas = publicCinemas;
        return cachedCinemas;
    }

    cachedCinemas = safeArray<CinemaData>(loadSourceJSON('cinemas.json', []));
    return cachedCinemas;
}

export function getAllPerformances(options: { preferPublicData?: boolean } = {}) {
    const { preferPublicData = true } = options;
    if (preferPublicData) {
        const prebuiltPerformances = getPrebuiltPerformances();
        if (prebuiltPerformances) return prebuiltPerformances;
    }
    if (cachedRawPerformances) return cachedRawPerformances;

    // Load static data for filtering
    if (!cachedVenues) cachedVenues = loadSourceJSON('venues.json', {}) as Record<string, VenueData>;
    if (!cachedCinemas) cachedCinemas = safeArray<CinemaData>(loadSourceJSON('cinemas.json', []));
    
    const venues = cachedVenues;
    const cinemas = cachedCinemas;

    // 1. Load and Transform all data sources
    const allSources = SOURCE_REGISTRY.map(({ file, key }) => ({ file, source: key }));

    const allPerformances = allSources.flatMap(({ file, source }) => {
        const data = loadSourceJSON(file);
        const rawItems = safeArray<RawPerformance>(data);
        if (rawItems.length > 0) {
            console.log(`[DEBUG] Source: ${source}, Raw items: ${rawItems.length}`);
        }
        return rawItems.map(p => transformPerformance(p, source));
    });

    // 3. Filter
    const now = new Date();
    const BLOCKLIST = ['블루마린 스쿠버 다이브', '광주 조선대학교 해오름관'];

    const filtered = allPerformances.filter(p => {
        // Filter out deprecated genres eagerly
        if (p.genre === 'popup' || p.genre === 'travel') return false;

        // Always show specific genres (Bypass Date & Region)
        if (p.genre === 'movie') {
            const cinema = cinemas.find((c) => c.name === p.venue);
            if (cinema && cinema.lat && cinema.lng) {
                p.lat = cinema.lat;
                p.lng = cinema.lng;
                p.address = cinema.address;
            }
        }

        if (p.genre !== 'movie' && !isPerformanceActive(p.date, now)) return false;

        // Correct approach: if p.genre === 'movie' return true; for now?
        // "나머지 서울/경기/인천 지역 한정을 전국단위로 범위를 확장했기 때문에, 지역 필터를 사용해서 비노출 시키는 컨텐츠는 없도록 해줘."
        // This implies NO content should be hidden by region filter.

        // Filter out bad venues
        if (p.venue === '예매하기') return false;
        if (/^\d{1,2}\.\d{1,2}/.test(p.venue)) return false;

        // Address/Location Validation (Strict Policy)
        if (p.genre !== 'movie') {
            const lat = parseCoordinate(p.lat || p.latitude);
            const lng = parseCoordinate(p.lng || p.longitude);
            const hasInherentGeo = lat !== 0 && lng !== 0 && !isNaN(lat) && !isNaN(lng);
            const hasAddress = p.address && p.address !== '정보 없음' && p.address !== '';
            const resolvedVenue = resolveVenueInfoForPerformance(p, venues);
            const resolvedLat = parseCoordinate(resolvedVenue.lat || resolvedVenue.latitude);
            const resolvedLng = parseCoordinate(resolvedVenue.lng || resolvedVenue.longitude);
            const hasResolvedGeo = resolvedLat !== 0 && resolvedLng !== 0 && !isNaN(resolvedLat) && !isNaN(resolvedLng);
            const hasResolvedAddress = Boolean(resolvedVenue.address && resolvedVenue.address !== '정보 없음' && resolvedVenue.address !== '');

            if (hasInherentGeo) {
                p.lat = lat;
                p.lng = lng;
                if (!hasAddress) p.address = p.venue || '주소 정보 없음';
            } else if (hasResolvedGeo || hasResolvedAddress) {
                if (hasResolvedGeo) {
                    p.lat = resolvedLat;
                    p.lng = resolvedLng;
                }
                if (hasResolvedAddress) {
                    p.address = resolvedVenue.address;
                } else if (!hasAddress) {
                    p.address = p.venue || '주소 정보 없음';
                }
            } else if (p.source === 'seoul') {
                // Seoul Culture Portal often provides a venue name before a geocoded address.
                // Keep the item visible, then let venue-place enrichment resolve the official address.
                if (!p.address) p.address = p.venue || '서울 문화행사';
            } else if (p.source?.startsWith('mommom')) {
                // Keep MomMom items even if geo fails (Fallback to Seoul/Central or just don't filter)
                if (!p.address) p.address = p.venue;
            } else {
                return false;
            }
        }

        p.venueKey = getPerformanceVenueKey(p, venues);
        p.locationKey = buildPerformanceLocationKey(p, venues);

        if (BLOCKLIST.some(b => p.venue.includes(b))) return false;
        return true;
    });

    console.log(`[DEBUG] Total performances after filter: ${filtered.length}`);
    const sourceCounts: Record<string, number> = {};
    filtered.forEach(p => {
        sourceCounts[p.source || 'unknown'] = (sourceCounts[p.source || 'unknown'] || 0) + 1;
    });
    console.log(`[DEBUG] Source breakdown after filter:`, sourceCounts);

    // 4. Deduplication & Stable ID Logic (Unified via Utility)
    const stablePerformances = hydrateLocationIdentity(processAndMergePerformances(filtered), venues);

    // 5. Custom Movie Sorting
    // Current Rule: Top 10 Ranked first, then Upcoming releases by date, then others.
    const movieItems = stablePerformances.filter(p => p.genre === 'movie');
    const otherItems = stablePerformances.filter(p => p.genre !== 'movie');

    movieItems.sort((a, b) => {
        const rankA = a.rank || 999;
        const rankB = b.rank || 999;
        
        // Priority 1: Ranked 1-10
        if (rankA <= 10 || rankB <= 10) {
            if (rankA !== rankB) return rankA - rankB;
        }

        // Priority 2: Upcoming/Active (Date >= Today)
        const dateA = new Date((a.dateRaw || '00000000').replace(/-/g, '').replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')).getTime();
        const dateB = new Date((b.dateRaw || '00000000').replace(/-/g, '').replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')).getTime();
        const today = new Date().setHours(0, 0, 0, 0);

        const isActiveA = dateA >= today;
        const isActiveB = dateB >= today;

        if (isActiveA && !isActiveB) return -1;
        if (!isActiveA && isActiveB) return 1;
        
        // If both are active/upcoming, sort by date (soonest first)
        if (isActiveA && isActiveB) {
            if (dateA !== dateB) return dateA - dateB;
        }

        // Tie-breaker: Rank (even if > 10) or Alphabetical
        if (rankA !== rankB) return rankA - rankB;
        return a.title.localeCompare(b.title);
    });

    const finalResult = [...otherItems, ...movieItems];

    cachedRawPerformances = safePerformanceList(finalResult);
    return cachedRawPerformances;
}
