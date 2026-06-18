import fs from 'fs';
import path from 'path';
import type { Performance } from '../src/types';

type CompletenessRule = {
    source: string;
    label: string;
    genres?: string[];
    sampleLimit: number;
    maxMissingPrice: number;
    maxMissingAge: number;
    maxMissingRunningTime: number;
};

const PUBLIC_PERFORMANCES_PATH = path.join(process.cwd(), 'public', 'data', 'performances.json');
const LIVE_GENRES = ['musical', 'play', 'concert', 'classic_tradition'];

function envInt(name: string, fallback: number) {
    const parsed = Number.parseInt(process.env[name] || '', 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

const RULES: CompletenessRule[] = [
    {
        source: 'interpark',
        label: '인터파크 공연',
        genres: LIVE_GENRES,
        sampleLimit: envInt('INTERPARK_DETAIL_COMPLETENESS_SAMPLE', 80),
        maxMissingPrice: envInt('INTERPARK_DETAIL_MAX_MISSING_PRICE', 60),
        maxMissingAge: envInt('INTERPARK_DETAIL_MAX_MISSING_AGE', 60),
        maxMissingRunningTime: envInt('INTERPARK_DETAIL_MAX_MISSING_RUNTIME', 60),
    },
    {
        source: 'kopis',
        label: 'KOPIS 공연',
        genres: LIVE_GENRES,
        sampleLimit: envInt('KOPIS_DETAIL_COMPLETENESS_SAMPLE', 120),
        maxMissingPrice: envInt('KOPIS_DETAIL_MAX_MISSING_PRICE', 0),
        maxMissingAge: envInt('KOPIS_DETAIL_MAX_MISSING_AGE', 5),
        maxMissingRunningTime: envInt('KOPIS_DETAIL_MAX_MISSING_RUNTIME', 20),
    },
];

function parseDateValue(dateText?: string) {
    const match = String(dateText || '').match(/(20\d{2})[.-](\d{1,2})[.-](\d{1,2})/);
    if (!match) return Number.POSITIVE_INFINITY;
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime();
}

function hasUsefulText(value: unknown) {
    return typeof value === 'string'
        && value.trim().length > 0
        && !/정보\s*없음|미정|문의|예매처\s*확인|가격\s*확인|가격정보없음/i.test(value);
}

function hasUsefulPrice(item: Performance) {
    if (Array.isArray(item.priceList) && item.priceList.length > 0) return true;
    return hasUsefulText(item.price);
}

function readPerformances() {
    if (!fs.existsSync(PUBLIC_PERFORMANCES_PATH)) {
        throw new Error('public/data/performances.json 파일이 없습니다. npm run generate-data 이후 실행하세요.');
    }
    const parsed = JSON.parse(fs.readFileSync(PUBLIC_PERFORMANCES_PATH, 'utf8'));
    if (!Array.isArray(parsed)) {
        throw new Error('public/data/performances.json 형식이 올바르지 않습니다.');
    }
    return parsed as Performance[];
}

const performances = readPerformances();
const errors: string[] = [];

for (const rule of RULES) {
    const sourceItems = performances
        .filter((item) => item.source === rule.source)
        .filter((item) => !rule.genres || rule.genres.includes(item.genre))
        .sort((a, b) => parseDateValue(a.date) - parseDateValue(b.date));
    const sample = sourceItems.slice(0, rule.sampleLimit);

    if (sample.length === 0) {
        errors.push(`[detail][${rule.label}] 검사 대상이 없습니다.`);
        continue;
    }

    const missingPrice = sample.filter((item) => !hasUsefulPrice(item)).length;
    const missingAge = sample.filter((item) => !hasUsefulText(item.ageRating || item.age)).length;
    const missingRunningTime = sample.filter((item) => !hasUsefulText(item.runningTime)).length;

    console.log(`[detail][${rule.label}] sample=${sample.length} missingPrice=${missingPrice}/${rule.maxMissingPrice} missingAge=${missingAge}/${rule.maxMissingAge} missingRuntime=${missingRunningTime}/${rule.maxMissingRunningTime}`);

    if (missingPrice > rule.maxMissingPrice) {
        errors.push(`[detail][${rule.label}] 가격 누락 ${missingPrice}건이 임계값 ${rule.maxMissingPrice}건을 초과했습니다.`);
    }
    if (missingAge > rule.maxMissingAge) {
        errors.push(`[detail][${rule.label}] 관람연령 누락 ${missingAge}건이 임계값 ${rule.maxMissingAge}건을 초과했습니다.`);
    }
    if (missingRunningTime > rule.maxMissingRunningTime) {
        errors.push(`[detail][${rule.label}] 관람시간 누락 ${missingRunningTime}건이 임계값 ${rule.maxMissingRunningTime}건을 초과했습니다.`);
    }
}

if (errors.length > 0) {
    errors.forEach((error) => console.error(error));
    process.exit(1);
}

console.log('[detail] 상세정보 커버리지 검증 통과');
