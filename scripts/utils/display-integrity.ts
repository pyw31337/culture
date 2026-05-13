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

const WINTER_KEYWORDS = ['스키', '보드', '스노우', '눈썰매', '리프트', '리프트권', '스키장', '렌탈샵', '겨울'];
const SUMMER_KEYWORDS = ['워터파크', '수영장', '해수욕', '서핑', '물놀이', '계곡', '래프팅'];
const EVERGREEN_DATES = new Set(['상시', 'OPEN RUN', '오픈런', '연중무휴']);
const PRICE_OPTIONAL_GENRES = new Set(['movie', 'soccer', 'baseball', 'basketball', 'volleyball', 'handball', 'tourism']);
const REGION_HINTS = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '부천', '수원', '성남', '고양', '용인', '안양', '전주', '전북', '제주', '강원', '충북', '충남', '전남', '경북', '경남'];

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
    return matches.find((value) => REGION_HINTS.some((hint) => value.includes(hint))) || null;
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
    return parts.every((part) => target.includes(part));
}

function isEvergreenDate(value?: string) {
    const normalized = clean(value).toUpperCase();
    return EVERGREEN_DATES.has(normalized) || normalized.includes('상시') || normalized.includes('OPEN RUN');
}

function hasInvalidDate(performance: Performance) {
    if (!clean(performance.date) && !clean(performance.dateRaw)) return true;
    if (isEvergreenDate(performance.date) || isEvergreenDate(performance.dateRaw)) return false;
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

    if (WINTER_KEYWORDS.some((keyword) => text.includes(keyword)) && ![11, 12, 1, 2, 3].includes(month)) return true;
    if (SUMMER_KEYWORDS.some((keyword) => text.includes(keyword)) && ![6, 7, 8, 9].includes(month)) return true;
    return false;
}

function isSuspiciousFreePrice(performance: Performance) {
    const priceText = clean([performance.price, performance.priceDetail].filter(Boolean).join(' '));
    if (!priceText) return false;
    const extracted = extractFirstPrice(priceText);
    if (extracted?.price !== '무료') return false;

    const hasWonPrice = /\d[\d,]*\s*원/.test(priceText);
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
    const warningIssueCount = bracketLocationMismatchCount + unknownPriceCount + invalidDateCount + duplicateTimeCount + outOfSeasonCount;

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
