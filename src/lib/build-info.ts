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

export interface DataBuildInfo {
    generatedAt: string;
    version: string;
    itemCount: number;
    sourceCounts: Record<string, number>;
    genreCounts: Record<string, number>;
    qualitySummary: DataQualitySummary | null;
    sourceSummaries: DataSourceSummary[];
    sourceHealthSummary: DataSourceHealthSummary | null;
}

export function getAvailableGenreCount(genreCounts?: Record<string, number>) {
    return Object.values(genreCounts ?? {}).filter((count) => typeof count === 'number' && count > 0).length;
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
