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

export interface DataBuildInfo {
    generatedAt: string;
    version: string;
    itemCount: number;
    sourceCounts: Record<string, number>;
    genreCounts: Record<string, number>;
    qualitySummary: DataQualitySummary | null;
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
