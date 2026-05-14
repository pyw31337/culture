export interface DataQualitySummary {
    checkedAt: string;
    status: 'pass' | 'warn';
    missingLinkCount: number;
    missingDescriptionCount: number;
    missingImageCount: number;
    brokenLocalImageCount: number;
    movieMissingLinkCount: number;
    movieMissingDescriptionCount: number;
    movieBrokenImageCount: number;
    warningsByGenre: {
        missingLinks: Record<string, number>;
        missingDescriptions: Record<string, number>;
        missingImages: Record<string, number>;
    };
}

export interface DisplayIntegritySummary {
    checkedAt: string;
    status: 'pass' | 'warn' | 'fail';
    itemCount: number;
    blockingIssueCount: number;
    locationMismatchCount: number;
    bracketLocationMismatchCount: number;
    suspiciousFreePriceCount: number;
    unknownPriceCount: number;
    invalidDateCount: number;
    duplicateTimeCount: number;
    outOfSeasonCount: number;
}

export type DataSourceFreshness = 'fresh' | 'aging' | 'stale' | 'offseason' | 'unknown';

export interface DataSourceSummary {
    key: string;
    label: string;
    file: string;
    itemCount: number;
    updatedAt: string | null;
    ageDays: number | null;
    freshness: DataSourceFreshness;
    seasonal: boolean;
}

export interface DataSourceHealthSummary {
    totalSources: number;
    freshCount: number;
    agingCount: number;
    staleCount: number;
    offseasonCount: number;
    unknownCount: number;
}

export interface SourceFunnelSummary {
    checkedAt: string;
    status: 'pass' | 'warn';
    rawItemCount: number;
    finalItemCount: number;
    registeredSourceCount: number;
    activeSourceCount: number;
    missingRegisteredFileCount: number;
    unregisteredDataFileCount: number;
    workflowOnlyScraperCount: number;
    registeredWithoutWorkflowCount: number;
    highLossSourceCount: number;
    noFinalOutputSourceCount: number;
    topUnregisteredDataFiles: Array<{
        file: string;
        itemCount: number;
        note: string;
    }>;
    topHighLossSources: Array<{
        key: string;
        label: string;
        rawItemCount: number;
        finalItemCount: number;
        conversionRate: number;
    }>;
}

export interface VenueCanonicalizationSummary {
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
    topHighConfidenceCandidates: Array<{
        type: string;
        reason: string;
        groupKey: string;
        itemCount: number;
        usageCount: number;
    }>;
    topCoordinateRiskGroups: Array<{
        reason: string;
        groupKey: string;
        itemCount: number;
        usageCount: number;
    }>;
}

export interface VenueMasterSummary {
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
    topReviewEntries: Array<{
        id: string;
        officialName: string;
        address: string;
        performanceCount: number;
        reviewFlags: string[];
    }>;
}

export interface VenuePlaceMatchingSummary {
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
    providersConfigured: string[];
    staleCacheCount: number;
    topQueue: Array<{
        venueId: string;
        officialName: string;
        address: string;
        query: string;
        priority: number;
        performanceCount: number;
        reviewFlags: string[];
        sampleTitles: string[];
    }>;
    topInsufficientIdentityQueue: Array<{
        venueId: string;
        officialName: string;
        address: string;
        query: string;
        priority: number;
        performanceCount: number;
        reviewFlags: string[];
        sampleTitles: string[];
    }>;
    topNeedsReview: Array<{
        venueId: string;
        officialName?: string;
        query: string;
        confidence: number;
        reason: string;
    }>;
}

export interface PriceCoverageSummary {
    checkedAt: string;
    itemCount: number;
    pricedCount: number;
    unknownCount: number;
    optionalUnknownCount: number;
    actionableUnknownCount: number;
    coverageRate: number;
    topUnknownBySource: Array<{
        key: string;
        label: string;
        unknownCount: number;
        actionableUnknownCount: number;
        itemCount: number;
    }>;
}

export interface OperationsSummary {
    checkedAt: string;
    localUpdateLogCount: number;
    latestLocalUpdateLog: string | null;
    latestLocalUpdateAt: string | null;
    lastFailureCount: number;
    lastFailures: string[];
    schedulerConfigured: boolean;
}

export interface DataBuildInfo {
    generatedAt: string;
    version: string;
    itemCount: number;
    sourceCounts: Record<string, number>;
    genreCounts: Record<string, number>;
    qualitySummary: DataQualitySummary | null;
    displayIntegritySummary?: DisplayIntegritySummary | null;
    sourceSummaries: DataSourceSummary[];
    sourceHealthSummary: DataSourceHealthSummary | null;
    sourceFunnelSummary?: SourceFunnelSummary | null;
    venueCanonicalizationSummary?: VenueCanonicalizationSummary | null;
    venueMasterSummary?: VenueMasterSummary | null;
    venuePlaceMatchingSummary?: VenuePlaceMatchingSummary | null;
    priceCoverageSummary?: PriceCoverageSummary | null;
    operationsSummary?: OperationsSummary | null;
}

export function getAvailableGenreCount(genreCounts?: Record<string, number>) {
    return Object.values(genreCounts ?? {}).filter((count) => typeof count === 'number' && count > 0).length;
}

export function formatKoreanDateTime(value?: string | null, fallback = '정보 없음') {
    if (!value) return fallback;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return fallback;

    const formatter = new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'short',
        hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => parts.find((part) => part.type === type)?.value ?? '';

    return `${getPart('year')}.${getPart('month')}.${getPart('day')}.(${getPart('weekday')}) ${getPart('hour')}:${getPart('minute')}`;
}

export function formatCompactKoreanDate(value?: string | null, fallback = '정보 없음') {
    if (!value) return fallback;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return fallback;

    const formatter = new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: '2-digit',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
    });

    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => parts.find((part) => part.type === type)?.value ?? '';

    return `${getPart('year')}.${getPart('month')}.${getPart('day')} (${getPart('weekday')})`;
}

export function formatCompactKoreanDateTime(value?: string | null, fallback = '정보 없음') {
    if (!value) return fallback;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return fallback;

    const formatter = new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: '2-digit',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => parts.find((part) => part.type === type)?.value ?? '';

    return `${getPart('year')}.${getPart('month')}.${getPart('day')} (${getPart('weekday')}) ${getPart('hour')}:${getPart('minute')}`;
}

export function getQualityIssueCount(summary?: DataQualitySummary | null) {
    if (!summary) return 0;

    return (
        summary.missingLinkCount +
        summary.missingDescriptionCount +
        summary.missingImageCount +
        summary.brokenLocalImageCount
    );
}

export function getQualityStatusLabel(summary?: DataQualitySummary | null) {
    if (!summary) return '품질 점검 정보 준비 중';
    if (summary.status === 'pass') return '콘텐츠 품질 점검 완료';

    const issueCount = getQualityIssueCount(summary);
    return issueCount > 0 ? `콘텐츠 정보 보강 필요 ${issueCount}건` : '콘텐츠 품질 점검 필요';
}

export function getSourceHealthStatusLabel(summary?: DataSourceHealthSummary | null) {
    if (!summary) return '수집 소스 점검 중';

    const issueCount = summary.staleCount + summary.unknownCount;
    if (issueCount > 0) {
        return `수집 소스 점검 ${issueCount}개`;
    }

    if (summary.agingCount > 0) {
        return `수집 소스 관찰 ${summary.agingCount}개`;
    }

    if (summary.freshCount > 0) {
        return `수집 소스 최신 ${summary.freshCount}개`;
    }

    return '수집 소스 정보 준비 중';
}

export function getSourceFreshnessLabel(freshness: DataSourceFreshness) {
    switch (freshness) {
        case 'fresh':
            return '최신';
        case 'aging':
            return '관찰';
        case 'stale':
            return '점검 필요';
        case 'offseason':
            return '비시즌';
        default:
            return '확인 필요';
    }
}

export function getSourceFreshnessTone(freshness: DataSourceFreshness) {
    switch (freshness) {
        case 'fresh':
            return 'good';
        case 'aging':
            return 'default';
        case 'offseason':
            return 'muted';
        case 'stale':
        case 'unknown':
        default:
            return 'warn';
    }
}
