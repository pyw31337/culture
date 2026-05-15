import fs from 'fs';
import path from 'path';
import type { Performance } from '../../src/types';
import { extractFirstPrice } from '../../src/lib/utils';
import { extractScheduleDates, getKoreanReferenceDate } from '../../src/lib/performance-filter';
import { buildLocationIntegrityReport } from './location-integrity';

type VenueRecord = Record<string, {
    address?: string;
    lat?: number;
    lng?: number;
    latitude?: number | string;
    longitude?: number | string;
    district?: string;
    name?: string;
}>;

type IntegritySample = {
    id: string;
    title: string;
    genre?: string;
    venue?: string;
    value?: string;
    reason: string;
};

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
    samples: Record<string, IntegritySample[]>;
}

const WINTER_LEISURE_KEYWORDS = ['눈썰매', '리프트권', '스키장', '스노우파크', '스키렌탈', '보드렌탈', '렌탈샵', '슬로프'];
const WINTER_FALSE_POSITIVE_KEYWORDS = ['차이콥스키', '마이스키', '위스키', '트바르코프스키', '패들보드', '플레이팅보드'];
const SUMMER_KEYWORDS = ['워터파크', '수영장', '해수욕', '서핑', '물놀이', '계곡', '래프팅'];
const EVERGREEN_DATES = new Set(['상시', 'OPEN RUN', '오픈런', '연중무휴']);
const PRICE_OPTIONAL_GENRES = new Set(['movie', 'soccer', 'baseball', 'basketball', 'volleyball', 'handball', 'tourism']);
const FLEXIBLE_SCHEDULE_KEYWORDS = [
    '상품 상세',
    '상세페이지',
    '상세 페이지',
    '예약 확정',
    '일정 조율',
    '시간을 조율',
    '상이',
    '신청 시',
    '참고',
    '문의',
    '상품페이지',
    '일자 별',
    '일자별',
    '날짜 선택',
    '날짜에 따라',
    '옵션',
    '일정별',
    '장소별 일정',
    '행사 시작',
    '수업',
    '전화상담',
    '협의',
    '만남',
];
const REGION_HINTS = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '부천', '수원', '성남', '고양', '용인', '안양', '전주', '전북', '제주', '강원', '충북', '충남', '전남', '경북', '경남'];
const BROAD_REGION_HINTS = new Set(['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '전북', '제주', '강원', '충북', '충남', '전남', '경북', '경남']);

function clean(value?: string | null) {
    return (value || '').replace(/\s+/g, ' ').trim();
}

function compact(value?: string | null) {
    return clean(value).replace(/\s+/g, '');
}

function pushSample(samples: Record<string, IntegritySample[]>, key: string, sample: IntegritySample, limit = 12) {
    const bucket = samples[key] || [];
    if (bucket.length >= limit) return;
    bucket.push(sample);
    samples[key] = bucket;
}

function getBracketLocationHint(title?: string) {
    const matches = [...clean(title).matchAll(/\[([^\]]{1,12})\]/g)].map((match) => match[1]);
    return matches.find((value) => {
        const parts = clean(value)
            .replace(/\([^)]*\)/g, ' ')
            .split(/[\/·, ]+/)
            .map((part) => part.trim())
            .filter(Boolean);
        return parts.some((part) => REGION_HINTS.includes(part));
    }) || null;
}

function normalizeLocationText(value?: string | null) {
    return compact(value)
        .replace(/서울특별시/g, '서울')
        .replace(/부산광역시/g, '부산')
        .replace(/대구광역시/g, '대구')
        .replace(/인천광역시/g, '인천')
        .replace(/광주광역시/g, '광주')
        .replace(/대전광역시/g, '대전')
        .replace(/울산광역시/g, '울산')
        .replace(/경기도/g, '경기')
        .replace(/강원특별자치도|강원도/g, '강원')
        .replace(/충청북도/g, '충북')
        .replace(/충청남도/g, '충남')
        .replace(/전북특별자치도|전라북도/g, '전북')
        .replace(/전라남도/g, '전남')
        .replace(/경상북도/g, '경북')
        .replace(/경상남도/g, '경남')
        .replace(/제주특별자치도/g, '제주');
}

function hasLocationHintInRecord(performance: Performance, hint: string) {
    const target = normalizeLocationText([performance.venue, performance.address, performance.district, performance.region].filter(Boolean).join(' '));
    const parts = clean(hint)
        .replace(/\([^)]*\)/g, ' ')
        .split(/[\/·, ]+/)
        .map((part) => normalizeLocationText(part))
        .filter((part) => part && !['앵콜', '공연'].includes(part));

    if (parts.length === 0) return true;

    const broadParts = parts.filter((part) => BROAD_REGION_HINTS.has(part));
    if (broadParts.some((part) => target.includes(part))) return true;

    return parts.some((part) => target.includes(part));
}

function isEvergreenDate(value?: string) {
    const normalized = clean(value).toUpperCase();
    return EVERGREEN_DATES.has(normalized) || normalized.includes('상시') || normalized.includes('OPEN RUN');
}

function isFlexibleScheduleLabel(value?: string) {
    const normalized = clean(value);
    if (!normalized) return false;
    if (FLEXIBLE_SCHEDULE_KEYWORDS.some((keyword) => normalized.includes(keyword))) return true;
    const dateLikeText = normalized
        .replace(/\d{4}년\s*\d{1,2}월/g, '')
        .replace(/\d{2,4}[./-]\d{1,2}[./-]\d{1,2}/g, '');
    if (/\d{1,2}\s*시|\d{1,2}:\d{2}|오전|오후/.test(dateLikeText) && !/\d{4}년\s*\d{1,2}월|\d{2,4}[./-]\d{1,2}[./-]\d{1,2}/.test(normalized)) {
        return true;
    }
    return false;
}

function hasInvalidDate(performance: Performance) {
    if (!clean(performance.date) && !clean(performance.dateRaw)) {
        return false;
    }
    if (isEvergreenDate(performance.date) || isEvergreenDate(performance.dateRaw)) return false;
    if (isFlexibleScheduleLabel(performance.date) || isFlexibleScheduleLabel(performance.dateRaw)) return false;
    return extractScheduleDates(performance).length === 0;
}

function sameText(left?: string, right?: string) {
    const a = compact(left);
    const b = compact(right);
    return Boolean(a && b && a === b);
}

function isOutOfSeason(performance: Performance, referenceDate: Date) {
    const month = referenceDate.getUTCMonth() + 1;
    const text = [performance.title, performance.venue, performance.subGenre, performance.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    const primaryText = [performance.title, performance.venue, performance.subGenre]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    const hasSeasonKeyword = (keywords: string[]) => keywords.some((keyword) => {
        const target = keyword === '물놀이'
            ? text.replace(/사물놀이/g, '')
            : text;
        return target.includes(keyword);
    });
    const hasWinterLeisureKeyword = () => {
        const target = WINTER_FALSE_POSITIVE_KEYWORDS.reduce((acc, keyword) => acc.replaceAll(keyword, ''), primaryText);
        if (WINTER_LEISURE_KEYWORDS.some((keyword) => target.includes(keyword))) return true;
        if (target.includes('스키') && /(리조트|렌탈|강습|슬로프|스키학교|스키\/보드)/.test(target)) return true;
        if (target.includes('보드') && /(스노우|스키|렌탈)/.test(target)) return true;
        return false;
    };

    if (hasWinterLeisureKeyword() && ![11, 12, 1, 2, 3].includes(month)) return true;
    if (hasSeasonKeyword(SUMMER_KEYWORDS) && ![5, 6, 7, 8, 9].includes(month)) return true;
    return false;
}

function isSuspiciousFreePrice(performance: Performance) {
    const priceText = clean([performance.price, performance.priceDetail].filter(Boolean).join(' '));
    if (!priceText) return false;
    const extracted = extractFirstPrice(priceText);
    if (extracted?.price !== '무료') return false;

    const hasWonPrice = /\d[\d,]*\s*원|\d+\s*만(?:\s*\d+\s*천)?\s*원|\d+\s*천\s*원/.test(priceText);
    return hasWonPrice;
}

export function buildDisplayIntegrityReport(
    performances: Performance[],
    venues: VenueRecord,
    checkedAt = new Date().toISOString(),
): DisplayIntegritySummary {
    const referenceDate = getKoreanReferenceDate();
    const locationReport = buildLocationIntegrityReport(performances, venues);
    const samples: Record<string, IntegritySample[]> = {};

    let bracketLocationMismatchCount = 0;
    let suspiciousFreePriceCount = 0;
    let unknownPriceCount = 0;
    let invalidDateCount = 0;
    let duplicateTimeCount = 0;
    let outOfSeasonCount = 0;

    performances.forEach((performance) => {
        const base = {
            id: performance.id,
            title: performance.title,
            genre: performance.genre,
            venue: performance.venue,
        };

        const hint = getBracketLocationHint(performance.title);
        if (hint && !hasLocationHintInRecord(performance, hint)) {
            bracketLocationMismatchCount += 1;
            pushSample(samples, 'bracketLocationMismatch', {
                ...base,
                value: hint,
                reason: '제목의 지역 힌트가 표시 장소/주소와 맞지 않습니다.',
            });
        }

        if (isSuspiciousFreePrice(performance)) {
            suspiciousFreePriceCount += 1;
            pushSample(samples, 'suspiciousFreePrice', {
                ...base,
                value: clean([performance.price, performance.priceDetail].filter(Boolean).join(' / ')),
                reason: '무료 문구와 유료 금액이 섞여 있어 무료 뱃지 오표기 위험이 있습니다.',
            });
        }

        if (!PRICE_OPTIONAL_GENRES.has(performance.genre) && !extractFirstPrice(performance.price || performance.priceDetail || '')) {
            unknownPriceCount += 1;
            pushSample(samples, 'unknownPrice', {
                ...base,
                value: clean([performance.price, performance.priceDetail].filter(Boolean).join(' / ')),
                reason: '가격 노출 기준으로 해석할 수 있는 금액이 없습니다.',
            });
        }

        if (hasInvalidDate(performance)) {
            invalidDateCount += 1;
            pushSample(samples, 'invalidDate', {
                ...base,
                value: clean(performance.dateRaw || performance.date),
                reason: '일정 문자열에서 표시 가능한 날짜를 추출하지 못했습니다.',
            });
        }

        if (sameText(performance.performanceTime, performance.operatingHours)) {
            duplicateTimeCount += 1;
            pushSample(samples, 'duplicateTime', {
                ...base,
                value: clean(performance.performanceTime),
                reason: '공연 시간과 운영 시간이 같은 값으로 중복 저장되어 있습니다.',
            });
        }

        if (isOutOfSeason(performance, referenceDate)) {
            outOfSeasonCount += 1;
            pushSample(samples, 'outOfSeason', {
                ...base,
                value: clean(performance.date),
                reason: '현재 계절과 맞지 않는 시즌 키워드가 포함되어 있습니다.',
            });
        }
    });

    locationReport.unresolvedSamples.forEach((row) => {
        pushSample(samples, 'locationMismatch', {
            id: row.id,
            title: row.title,
            genre: row.genre,
            venue: row.venue,
            value: `${row.performanceAddress} -> ${row.resolvedAddress}`,
            reason: '표시 기준 주소와 원본 주소가 심하게 충돌합니다.',
        });
    });

    const blockingIssueCount = locationReport.resolvedMismatchCount + suspiciousFreePriceCount;
    const warningIssueCount = bracketLocationMismatchCount + invalidDateCount + duplicateTimeCount + outOfSeasonCount;

    return {
        checkedAt,
        status: blockingIssueCount > 0 ? 'fail' : warningIssueCount > 0 ? 'warn' : 'pass',
        itemCount: performances.length,
        blockingIssueCount,
        locationMismatchCount: locationReport.resolvedMismatchCount,
        bracketLocationMismatchCount,
        suspiciousFreePriceCount,
        unknownPriceCount,
        invalidDateCount,
        duplicateTimeCount,
        outOfSeasonCount,
        samples,
    };
}

export function readPublicDisplayIntegrityInputs() {
    const performancesPath = path.join(process.cwd(), 'public', 'data', 'performances.json');
    const venuesPath = path.join(process.cwd(), 'public', 'data', 'venues.json');

    return {
        performances: JSON.parse(fs.readFileSync(performancesPath, 'utf8')) as Performance[],
        venues: JSON.parse(fs.readFileSync(venuesPath, 'utf8')) as VenueRecord,
    };
}
