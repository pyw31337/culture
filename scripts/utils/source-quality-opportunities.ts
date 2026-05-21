import type { SourceQualityOpportunityRow, SourceQualityOpportunitySummary } from '../../src/lib/build-info';
import { SOURCE_REGISTRY_BY_KEY, getSourceLabel } from '../../src/lib/source-registry';
import type { Performance } from '../../src/types';

type GapKey =
    | 'image'
    | 'detailImage'
    | 'description'
    | 'coordinate'
    | 'address'
    | 'venue'
    | 'link'
    | 'price'
    | 'duplicate';

type SourceBucket = {
    key: string;
    label: string;
    items: Performance[];
    duplicateSignatures: Set<string>;
};

const UNKNOWN_TEXT_PATTERNS = [
    /정보\s*없음/i,
    /확인\s*필요/i,
    /미정/i,
    /^[-–—]+$/,
];

const PLACEHOLDER_IMAGE_PATTERNS = [
    /placeholder/i,
    /no[-_ ]?image/i,
    /noimage/i,
    /fallbacks\/movie\.svg/i,
];

const WEAK_IMAGE_PATTERNS = [
    /fallbacks\//i,
    /placeholder/i,
    /soccer_poster/i,
    /sports_poster/i,
    /baseball\.jpg/i,
    /basketball\.jpg/i,
    /volleyball\.jpg/i,
    /handball\.jpg/i,
];

const TEMPLATE_DESCRIPTION_MARKERS = [
    /에서\s*진행되는/,
    /일정은\s*20\d{2}/,
    /위치는\s*/,
    /기준입니다/,
    /이용\s*정보는/,
    /경기입니다/,
];

const RICH_DESCRIPTION_MARKERS = [
    /유의사항/,
    /상세\s*설명/,
    /행사내용/,
    /프로그램/,
    /할인정보/,
    /공연소개/,
    /여행지\s*정보/,
    /운영\s*시간/,
    /관람\s*포인트/,
    /주요\s*시설/,
    /이용\s*안내/,
    /\n/,
    /[■●ㆍ]/,
];

const MOVIE_GENRE = 'movie';

function compactText(value: unknown) {
    if (typeof value !== 'string') return '';
    return value.replace(/\s+/g, ' ').trim();
}

function hasUsefulText(...values: unknown[]) {
    return values.some((value) => {
        const text = compactText(value);
        return text !== '' && !UNKNOWN_TEXT_PATTERNS.some((pattern) => pattern.test(text));
    });
}

function parseCoordinate(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value) && value !== 0) return value;
    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed) && parsed !== 0) return parsed;
    }
    return null;
}

function hasCoordinates(item: Performance) {
    return parseCoordinate(item.lat ?? item.latitude) !== null && parseCoordinate(item.lng ?? item.longitude) !== null;
}

function getImageCandidate(item: Performance) {
    return compactText(item.image || item.posterUrl || item.poster || item.backupPoster);
}

function isMissingImage(item: Performance) {
    const image = getImageCandidate(item);
    if (!image) return true;
    return PLACEHOLDER_IMAGE_PATTERNS.some((pattern) => pattern.test(image));
}

function isWeakImage(item: Performance) {
    const image = getImageCandidate(item);
    if (!image) return true;
    return WEAK_IMAGE_PATTERNS.some((pattern) => pattern.test(image));
}

function hasDetailImages(item: Performance) {
    return [item.synopsisImages, item.stillImages].some((images) => Array.isArray(images) && images.some((image) => compactText(image)));
}

function getDescriptionText(item: Performance) {
    return compactText([
        item.description,
        item.synopsis,
        item.movieInfo,
        item.bookingNotice,
        item.feesAndPrograms,
    ].filter(Boolean).join('\n'));
}

function isWeakDescription(item: Performance) {
    const text = getDescriptionText(item);
    if (!text) return true;
    if (text.length < 50) return true;

    const markerHits = TEMPLATE_DESCRIPTION_MARKERS.filter((pattern) => pattern.test(text)).length;
    const hasRichMarker = RICH_DESCRIPTION_MARKERS.some((pattern) => pattern.test(text));
    if (markerHits >= 3 && !hasRichMarker) return true;

    const title = compactText(item.title);
    const venue = compactText(item.venue);
    const date = compactText(item.date);
    const repeatedFacts = [title, venue, date].filter((fact) => fact && text.includes(fact)).length;
    return repeatedFacts >= 3 && markerHits >= 2 && !hasRichMarker;
}

function hasReliablePrice(item: Performance) {
    if (item.genre === MOVIE_GENRE) return true;

    const text = compactText([item.price, item.priceDetail, item.feesAndPrograms].filter(Boolean).join(' '));
    if (!text) return false;
    if (/정보\s*없음|미정|문의|예매처\s*확인|가격\s*확인/i.test(text)) return false;
    if (/무료|free/i.test(text)) return true;
    return /\d[\d,]*(?:\s*원|₩|만원|천원)?/i.test(text);
}

function buildDuplicateSignature(item: Performance) {
    const title = compactText(item.title).toLowerCase();
    const venue = compactText(item.venue || item.address).toLowerCase();
    const date = compactText(item.date || item.dateRaw).toLowerCase();
    if (!title || !venue || !date) return null;
    return `${title}|${venue}|${date}`;
}

function buildAction(row: Omit<SourceQualityOpportunityRow, 'recommendedAction' | 'priority'>) {
    const gaps: Array<{ key: GapKey; count: number; weight: number; action: string }> = [
        {
            key: 'image',
            count: row.missingImageCount + row.weakImageCount,
            weight: 1.6,
            action: '대표 이미지와 No Image fallback을 먼저 보강하세요. 상세페이지 원본 이미지, OG 이미지, 예매처 포스터 순으로 후보를 넓히면 체감 품질이 가장 빨리 좋아집니다.',
        },
        {
            key: 'coordinate',
            count: row.missingCoordinateCount,
            weight: 1.4,
            action: '공식 장소 검색 캐시를 우선 채우세요. 좌표가 안정되면 주변검색, 지도, 장소명 병합 품질이 함께 좋아집니다.',
        },
        {
            key: 'address',
            count: row.missingAddressCount,
            weight: 1.25,
            action: '장소명과 주소를 분리해 다시 매칭하세요. 판매처 주소가 섞이는 소스는 공식 장소명 기준의 주소 재검색이 필요합니다.',
        },
        {
            key: 'description',
            count: row.weakDescriptionCount,
            weight: 1.15,
            action: '상세본문, 유의사항, 프로그램 소개, 관람 포인트처럼 상단 요약과 중복되지 않는 본문을 더 수집하세요.',
        },
        {
            key: 'detailImage',
            count: row.missingDetailImageCount,
            weight: 0.9,
            action: '상세 이미지와 소개 이미지를 추가 수집하세요. 관광지/체험/공연 소스는 하단 썸네일 갤러리까지 확보하면 페이지 체류 품질이 좋아집니다.',
        },
        {
            key: 'price',
            count: row.unknownPriceCount,
            weight: 0.9,
            action: '가격 또는 공식 예매처를 보강하세요. 가격이 없으면 사용자가 바로 결정을 못 하므로 예매처 링크와 가격 후보를 함께 확보하는 편이 좋습니다.',
        },
        {
            key: 'link',
            count: row.missingLinkCount,
            weight: 0.85,
            action: '원수집 상세 URL을 보존하세요. 출처 링크가 안정되면 원문 확인과 이미지 재수집도 쉬워집니다.',
        },
        {
            key: 'duplicate',
            count: row.duplicateSignatureCount,
            weight: 0.65,
            action: '제목, 장소, 일정 기준의 중복 병합 규칙을 보강하세요. 같은 행사가 소스별로 중복 노출되지 않게 source priority를 적용하면 좋습니다.',
        },
    ];

    gaps.sort((left, right) => right.count * right.weight - left.count * left.weight);
    return gaps.find((gap) => gap.count > 0)?.action || '현재 소스는 큰 누락이 적습니다. 신규 페이지 범위 확장과 업데이트 주기 안정화를 다음 목표로 두면 좋습니다.';
}

function buildPriority(score: number): SourceQualityOpportunityRow['priority'] {
    if (score >= 45) return 'high';
    if (score >= 22) return 'medium';
    return 'low';
}

function rate(covered: number, total: number) {
    if (total <= 0) return 1;
    return Number((covered / total).toFixed(4));
}

function buildRow(bucket: SourceBucket): SourceQualityOpportunityRow {
    const itemCount = bucket.items.length;
    const missingImageCount = bucket.items.filter(isMissingImage).length;
    const weakImageCount = bucket.items.filter((item) => !isMissingImage(item) && isWeakImage(item)).length;
    const missingDetailImageCount = bucket.items.filter((item) => item.genre !== MOVIE_GENRE && !hasDetailImages(item)).length;
    const locationRelevantItems = bucket.items.filter((item) => item.genre !== MOVIE_GENRE);
    const locationRelevantCount = Math.max(locationRelevantItems.length, 1);
    const missingCoordinateCount = locationRelevantItems.filter((item) => !hasCoordinates(item)).length;
    const missingAddressCount = locationRelevantItems.filter((item) => !hasUsefulText(item.address)).length;
    const missingVenueCount = locationRelevantItems.filter((item) => !hasUsefulText(item.venue)).length;
    const missingLinkCount = bucket.items.filter((item) => !hasUsefulText(item.link, item.website)).length;
    const unknownPriceCount = bucket.items.filter((item) => !hasReliablePrice(item)).length;
    const weakDescriptionCount = bucket.items.filter(isWeakDescription).length;
    const duplicateSignatureCount = bucket.duplicateSignatures.size;

    const imageGap = (missingImageCount + weakImageCount * 0.55) / Math.max(itemCount, 1);
    const detailImageGap = missingDetailImageCount / Math.max(itemCount, 1);
    const descriptionGap = weakDescriptionCount / Math.max(itemCount, 1);
    const coordinateGap = missingCoordinateCount / locationRelevantCount;
    const addressGap = missingAddressCount / locationRelevantCount;
    const venueGap = missingVenueCount / locationRelevantCount;
    const linkGap = missingLinkCount / Math.max(itemCount, 1);
    const priceGap = unknownPriceCount / Math.max(itemCount, 1);
    const duplicateGap = duplicateSignatureCount / Math.max(itemCount, 1);
    const volumeBoost = itemCount >= 100 ? 1.18 : itemCount >= 30 ? 1.08 : itemCount >= 8 ? 1 : 0.82;
    const opportunityScore = Math.min(100, Math.round((
        imageGap * 20 +
        coordinateGap * 18 +
        addressGap * 12 +
        descriptionGap * 16 +
        detailImageGap * 10 +
        priceGap * 11 +
        venueGap * 8 +
        linkGap * 8 +
        duplicateGap * 7
    ) * volumeBoost));

    const rowWithoutAction = {
        key: bucket.key,
        label: bucket.label,
        itemCount,
        opportunityScore,
        missingImageCount,
        weakImageCount,
        missingDetailImageCount,
        missingCoordinateCount,
        missingAddressCount,
        missingVenueCount,
        missingLinkCount,
        unknownPriceCount,
        weakDescriptionCount,
        duplicateSignatureCount,
        imageCoverageRate: rate(itemCount - missingImageCount - weakImageCount, itemCount),
        coordinateCoverageRate: rate(locationRelevantItems.length - missingCoordinateCount, locationRelevantItems.length),
        descriptionCoverageRate: rate(itemCount - weakDescriptionCount, itemCount),
        detailImageCoverageRate: rate(itemCount - missingDetailImageCount, itemCount),
        priceCoverageRate: rate(itemCount - unknownPriceCount, itemCount),
    };

    return {
        ...rowWithoutAction,
        priority: buildPriority(opportunityScore),
        recommendedAction: buildAction(rowWithoutAction),
    };
}

export function buildSourceQualityOpportunitySummary(
    items: Performance[],
    checkedAt = new Date().toISOString(),
): SourceQualityOpportunitySummary {
    const buckets = items.reduce<Record<string, SourceBucket>>((acc, item) => {
        const key = item.source || 'unknown';
        const registryEntry = SOURCE_REGISTRY_BY_KEY[key];
        acc[key] = acc[key] || {
            key,
            label: registryEntry?.label || getSourceLabel(key),
            items: [],
            duplicateSignatures: new Set<string>(),
        };
        acc[key].items.push(item);
        return acc;
    }, {});

    const signatureCounts = items.reduce<Record<string, number>>((acc, item) => {
        const signature = buildDuplicateSignature(item);
        if (signature) acc[signature] = (acc[signature] || 0) + 1;
        return acc;
    }, {});

    items.forEach((item) => {
        const signature = buildDuplicateSignature(item);
        if (!signature || signatureCounts[signature] < 2) return;
        const key = item.source || 'unknown';
        buckets[key]?.duplicateSignatures.add(signature);
    });

    const rows = Object.values(buckets)
        .map(buildRow)
        .sort((left, right) => right.opportunityScore - left.opportunityScore || right.itemCount - left.itemCount);

    const totals = rows.reduce((acc, row) => {
        acc.missingImageCount += row.missingImageCount;
        acc.weakImageCount += row.weakImageCount;
        acc.missingDetailImageCount += row.missingDetailImageCount;
        acc.missingCoordinateCount += row.missingCoordinateCount;
        acc.missingAddressCount += row.missingAddressCount;
        acc.unknownPriceCount += row.unknownPriceCount;
        acc.weakDescriptionCount += row.weakDescriptionCount;
        acc.duplicateSignatureCount += row.duplicateSignatureCount;
        return acc;
    }, {
        missingImageCount: 0,
        weakImageCount: 0,
        missingDetailImageCount: 0,
        missingCoordinateCount: 0,
        missingAddressCount: 0,
        unknownPriceCount: 0,
        weakDescriptionCount: 0,
        duplicateSignatureCount: 0,
    });

    const highOpportunitySourceCount = rows.filter((row) => row.priority === 'high').length;
    const status: SourceQualityOpportunitySummary['status'] = highOpportunitySourceCount > 0 ? 'warn' : 'pass';

    return {
        checkedAt,
        status,
        itemCount: items.length,
        sourceCount: rows.length,
        highOpportunitySourceCount,
        topSourceOpportunities: rows.slice(0, 10),
        ...totals,
    };
}
