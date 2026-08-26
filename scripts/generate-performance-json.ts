
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { getAllPerformances } from '../src/lib/performance-data';
import type {
    DataSourceFreshness,
    DataSourceHealthSummary,
    DataSourceSummary,
    OperationsSummary,
    PriceCoverageSummary
} from '../src/lib/build-info';
import { getExternalContentLink } from '../src/lib/performance-links';
import { getScheduleWindow, sortPerformancesForHomeFeed } from '../src/lib/performance-filter';
import { extractFirstPrice, formatUnifiedDate, normalizeImageUrl } from '../src/lib/utils';
import { SOURCE_REGISTRY } from '../src/lib/source-registry';
import { getGenreFilterFromSlug } from '../src/lib/genre-availability';
import { VALID_GENRE_SLUGS } from '../src/lib/constants';
import type { Performance } from '../src/types';
import { analyzeContentQuality } from './utils/content-quality';
import { buildDisplayIntegrityReport } from './utils/display-integrity';
import { buildSourceFunnelReport } from './utils/source-funnel';
import { buildSourceQualityOpportunitySummary } from './utils/source-quality-opportunities';
import { buildVenueCanonicalizationReport } from './utils/venue-canonicalization';
import { buildVenueMaster } from './utils/venue-master';
import { applyVenuePlaceCache, buildVenuePlaceMatchingReport, type VenuePlaceCache, type VenuePlaceProvider } from './utils/venue-place-matching';
import { isCompatibleVenueDisplayName } from './utils/venue-name-quality';
import { normalizeRegionId } from '../src/lib/region-normalize';

type PrunablePerformance = Performance & {
    platforms?: string[];
};

type PrunedPerformance = Omit<PrunablePerformance, 'posterUrl'>;

type VenueRecord = {
    name?: string;
    address?: string;
    district?: string;
    lat?: number | string;
    lng?: number | string;
    latitude?: number | string;
    longitude?: number | string;
    mapped_region_id?: string;
} & Record<string, unknown>;

type MovieCatalogItem = Performance & {
    lastCollected?: string;
    posterFallback?: boolean;
};

const GENRE_LABELS: Record<string, string> = {
    movie: '영화',
    musical: '뮤지컬',
    concert: '콘서트',
    play: '연극',
    classic_tradition: '공연',
    exhibition: '전시',
    museum: '박물관/체험',
    activity: '체험',
    class: '클래스',
    tourism: '관광지',
    baseball: '야구 경기',
    basketball: '농구 경기',
    volleyball: '배구 경기',
    soccer: '축구 경기',
    handball: '핸드볼 경기',
};

const FALLBACK_IMAGES: Record<string, string> = {
    soccer: '/images/soccer_goal_poster_20260528.jpg',
    baseball: '',
    basketball: '',
    volleyball: '',
    handball: '',
    museum: '',
    exhibition: '',
    classic_tradition: '',
    activity: '',
    movie: '',
    default: ''
};

const SOURCE_FRESH_DAYS = 3;
const SOURCE_STALE_DAYS = 30;
const HOME_FEED_LIMIT = 720;
const PERFORMANCE_PAGE_SIZE = 300;

function writePagedPayload(
    rootDir: string,
    relativeDir: string,
    items: PrunedPerformance[],
) {
    const outputDir = path.join(rootDir, relativeDir);
    fs.rmSync(outputDir, { recursive: true, force: true });
    fs.mkdirSync(outputDir, { recursive: true });

    const pages: string[] = [];
    for (let start = 0; start < items.length; start += PERFORMANCE_PAGE_SIZE) {
        const pageNumber = Math.floor(start / PERFORMANCE_PAGE_SIZE) + 1;
        const filename = `page-${String(pageNumber).padStart(3, '0')}.json`;
        fs.writeFileSync(path.join(outputDir, filename), JSON.stringify(items.slice(start, start + PERFORMANCE_PAGE_SIZE)));
        pages.push(`/data/${relativeDir}/${filename}`);
    }

    const manifest = {
        total: items.length,
        pageSize: PERFORMANCE_PAGE_SIZE,
        pages,
    };
    fs.writeFileSync(path.join(outputDir, 'manifest.json'), JSON.stringify(manifest));
    return manifest;
}
const WINTER_LEISURE_TERMS = ['리프트권', '스키장', '스노우파크', '눈썰매', '눈썰매장', '스키렌탈', '보드렌탈', '렌탈샵', '슬로프'];
const WINTER_LEISURE_FALSE_POSITIVE_TERMS = ['차이콥스키', '마이스키', '위스키', '트바르코프스키', '패들보드', '플레이팅보드'];
const PRICE_OPTIONAL_GENRES = new Set(['movie', 'baseball', 'basketball', 'volleyball', 'soccer', 'handball', 'tourism']);
const NON_VENUE_TEXT_PATTERNS = [
    /위치\s*정보/,
    /상품\s*상세/,
    /상세\s*페이지/,
    /예약\s*후/,
    /집합\s*장소/,
    /사전\s*조율/,
    /만남의\s*장소/,
    /담당\s*강사/,
    /프로그램마다/,
    /장소가\s*상이/,
    /모카\s*클래스/,
    /단체\s*전시회/,
    /전국\s*출강/,
    /무료\s*각인/,
    /커플\/?친구/,
    /기초\s*마스터/,
    /주\s*과정/,
    /원데이\s*클래스/,
    /정규\s*클래스/,
];
const GENERIC_VENUE_EXACTS = new Set([
    '서울',
    '서울특별시',
    '경기도',
    '서울/강남',
    '홍대/신촌/이대',
    '홍대/연남',
    '서울/강서',
    '서울/강서/마곡',
    '강남/역삼',
    '송파/잠실/강남',
    '수원/동탄/오산/평택',
    '홍대/단체/출강',
    '성수/단체/출강',
]);
const GENERIC_OR_FALLBACK_COORDINATE_KEYS = new Set([
    '37.5237,126.8882', // Seoul/Yeongdeungpo fallback frequently attached to Mom-Mom products.
    '37.4138,127.5183', // Gyeonggi centroid fallback.
    '37.5665,126.9780', // Seoul City Hall fallback.
    '35.1796,129.0756', // Busan centroid fallback.
    '35.8714,128.6014', // Daegu centroid fallback.
    '37.8228,128.1555', // Gangwon centroid fallback.
    '36.5753,128.5053', // Gyeongbuk centroid fallback.
    '33.4996,126.5312', // Jeju centroid fallback.
]);
const KNOWN_SELLER_ADDRESS_PATTERNS = [
    /제주특별자치도\s*제주시\s*청사로\s*11/,
    /서울특별시\s*동작구\s*사당로29가길\s*26/,
    /서울특별시\s*강남구\s*언주로\s*415/,
    /서울특별시\s*강남구\s*논현로149길\s*64/,
    /서울특별시\s*강남구\s*남부순환로\s*2732/,
    /서울특별시\s*강남구\s*영동대로96길\s*34/,
    /서울특별시\s*마포구\s*큰우물로\s*76/,
];

function loadLocalEnvFile(fileName: string) {
    const filePath = path.join(process.cwd(), fileName);
    if (!fs.existsSync(filePath)) return;

    fs.readFileSync(filePath, 'utf8')
        .split(/\r?\n/)
        .forEach((line) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;

            const separatorIndex = trimmed.indexOf('=');
            if (separatorIndex <= 0) return;

            const key = trimmed.slice(0, separatorIndex).trim();
            const rawValue = trimmed.slice(separatorIndex + 1).trim();
            if (!key || process.env[key]) return;

            process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
        });
}

loadLocalEnvFile('.env');
loadLocalEnvFile('.env.local');

const KNOWN_BRANCH_VENUE_RULES: Array<{ tokens: string[]; venueKey: string }> = [
    { tokens: ['상록리조트', '아쿠아피아'], venueKey: '천안상록리조트 아쿠아피아' },
    { tokens: ['상록리조트', '상록랜드'], venueKey: '천안상록리조트 상록랜드' },
    { tokens: ['주렁주렁', '하남점'], venueKey: '주렁주렁 하남점' },
    { tokens: ['주렁주렁', '동탄점'], venueKey: '주렁주렁 동탄점' },
    { tokens: ['주렁주렁', '영등포점'], venueKey: '주렁주렁 영등포점' },
    { tokens: ['주렁주렁', '경주점'], venueKey: '주렁주렁 경주보문점' },
    { tokens: ['주렁주렁', '경주보문점'], venueKey: '주렁주렁 경주보문점' },
    { tokens: ['롯데리조트', '부여', '아쿠아가든'], venueKey: '롯데리조트 부여 아쿠아가든' },
    { tokens: ['롯데리조트', '부여'], venueKey: '롯데리조트 부여' },
    { tokens: ['롯데리조트부여', '아쿠아가든'], venueKey: '롯데리조트 부여 아쿠아가든' },
    { tokens: ['롯데리조트부여'], venueKey: '롯데리조트 부여' },
    { tokens: ['스플라스', '리솜'], venueKey: '스플라스 리솜' },
    { tokens: ['아일랜드', '리솜'], venueKey: '아일랜드 리솜' },
    { tokens: ['오아식스', '리솜'], venueKey: '아일랜드 리솜' },
    { tokens: ['포레스트', '리솜'], venueKey: '포레스트 리솜' },
    { tokens: ['레스트리', '리솜'], venueKey: '레스트리 리솜' },
    { tokens: ['해브나인', '리솜'], venueKey: '포레스트 리솜' },
    { tokens: ['삼악산케이블카'], venueKey: '춘천 삼악산 호수 케이블카' },
    { tokens: ['씨라이프', '코엑스'], venueKey: '코엑스 아쿠아리움' },
    { tokens: ['부산', '아쿠아리움'], venueKey: '부산 아쿠아리움' },
    { tokens: ['놀자숲'], venueKey: '놀자숲' },
    { tokens: ['대관령', '삼양라운드힐'], venueKey: '대관령 삼양라운드힐' },
    { tokens: ['대구', '이월드'], venueKey: '대구 이월드' },
    { tokens: ['레노부르크뮤지엄'], venueKey: '레노부르크뮤지엄' },
    { tokens: ['삼방가딸기랜드'], venueKey: '삼방가딸기랜드' },
];

const EXTRA_VENUE_RECORDS: Record<string, VenueRecord> = {
    '모나용평': {
        address: '강원특별자치도 평창군 대관령면 올림픽로 715',
        district: '평창군',
        lat: 37.645263,
        lng: 128.681598,
        mapped_region_id: 'gangwon',
        phone: '033-335-5757',
        homepage: 'https://www.yongpyong.co.kr/',
        facilities: '리조트 · 워터파크 · 관광케이블카 · 키즈 시설',
        restrooms: '있음',
        parking: '가능',
    },
    '디오션리조트': {
        address: '전남 여수시 소호로 295',
        district: '여수시',
        lat: 34.7324505,
        lng: 127.6439655,
        mapped_region_id: 'jeonnam',
        homepage: 'https://www.theoceanresort.co.kr/',
        facilities: '리조트 · 워터파크',
        restrooms: '있음',
        parking: '가능',
    },
    '천안상록리조트 아쿠아피아': {
        address: '충남 천안시 동남구 수신면 수신로 576',
        district: '천안시',
        lat: 36.7404638577393,
        lng: 127.2890757071,
        mapped_region_id: 'chungnam',
        phone: '041-560-9114',
        homepage: 'https://www.sangnokresort.co.kr/M090000',
        facilities: '워터파크 · 실내풀 · 야외 물놀이장',
        restrooms: '있음',
        parking: '가능',
    },
    '천안상록리조트 상록랜드': {
        address: '충남 천안시 동남구 수신면 수신로 576',
        district: '천안시',
        lat: 36.7404638577393,
        lng: 127.2890757071,
        mapped_region_id: 'chungnam',
        phone: '041-560-9114',
        homepage: 'https://www.sangnokresort.co.kr/',
        facilities: '상록리조트 레저 시설',
        restrooms: '있음',
        parking: '가능',
    },
};

function compactText(value?: unknown) {
    if (typeof value !== 'string') {
        if (value === null || value === undefined) return '';
        return String(value).trim();
    }
    return value.replace(/\s+/g, ' ').trim() || '';
}

function isLowValueGeneratedDescription(value?: string) {
    const text = compactText(value);
    if (!text) return false;
    return /장소\s*확인\s*필요에서\s*진행되는\s*(클래스|영화)입니다/u.test(text)
        || (/일정은\s*20\d{2}[.\-]\d{2}[.\-]\d{2}.+기준입니다/u.test(text)
            && /에서\s*진행되는\s*(영화|클래스)입니다/u.test(text))
        || /^.+는\s*(?:지정 장소|현장|전시 공간)에서\s*(?:진행|만날|즐길)/.test(text)
        || /^.+는\s*방문을\s*고려해볼\s*만한\s*관광\/여행입니다/.test(text);
}

function isKnownSellerAddress(value?: string) {
    const address = compactText(value);
    return Boolean(address && KNOWN_SELLER_ADDRESS_PATTERNS.some((pattern) => pattern.test(address)));
}

function compactComparable(value?: string) {
    return compactText(value)
        .replace(/[·ㆍ,./\\\-_:|"'“”‘’()[\]\s]/g, '')
        .toLowerCase();
}

function parseCoordinate(value: unknown) {
    if (typeof value === 'number' && Number.isFinite(value) && value !== 0) return value;
    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value);
        if (Number.isFinite(parsed) && parsed !== 0) return parsed;
    }
    return undefined;
}

function pickDefined<T extends Record<string, unknown>>(value: T) {
    return Object.fromEntries(
        Object.entries(value).filter(([, entry]) => (
            entry !== undefined &&
            entry !== null &&
            entry !== '' &&
            !(Array.isArray(entry) && entry.length === 0)
        ))
    );
}

function buildMapPayloadItem(performance: PrunedPerformance) {
    return pickDefined({
        id: performance.id,
        title: performance.title,
        date: performance.date,
        venue: performance.venue,
        venueKey: performance.venueKey,
        venueCanonicalId: performance.venueCanonicalId,
        locationKey: performance.locationKey,
        address: performance.address,
        district: performance.district,
        region: performance.region,
        genre: performance.genre,
        image: performance.image,
        backupPoster: performance.backupPoster,
        poster: performance.poster,
        link: performance.link,
        price: performance.price,
        lat: performance.lat,
        lng: performance.lng,
        homeTeam: performance.homeTeam,
        awayTeam: performance.awayTeam,
        homeTeamLogo: performance.homeTeamLogo,
        awayTeamLogo: performance.awayTeamLogo,
        openRun: performance.openRun,
        bracketRegion: performance.bracketRegion,
    }) as Partial<PrunedPerformance>;
}

function buildCalendarPayloadItem(performance: PrunedPerformance) {
    return pickDefined({
        id: performance.id,
        title: performance.title,
        date: performance.date,
        venue: performance.venue,
        venueKey: performance.venueKey,
        venueCanonicalId: performance.venueCanonicalId,
        locationKey: performance.locationKey,
        address: performance.address,
        district: performance.district,
        region: performance.region,
        genre: performance.genre,
        image: performance.image,
        backupPoster: performance.backupPoster,
        poster: performance.poster,
        link: performance.link,
        price: performance.price,
        lat: performance.lat,
        lng: performance.lng,
        openRun: performance.openRun,
        bracketRegion: performance.bracketRegion,
    }) as Partial<PrunedPerformance>;
}


function applyCanonicalRegion<T extends { region?: string; address?: string; venue?: string }>(item: T): T {
    const fromFields = [item.region, item.address, item.venue].filter(Boolean).join(' ');
    const id = normalizeRegionId(fromFields || item.region || '');
    if (id && id !== 'etc') {
        return { ...item, region: id };
    }
    if (item.region) {
        const only = normalizeRegionId(item.region);
        if (only) return { ...item, region: only };
    }
    return item;
}

function getCalendarWindowBounds() {
    const now = new Date();
    const min = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const max = new Date(now.getFullYear(), now.getMonth() + 18, 1);
    return { min, max };
}

function isYearMonthInCalendarWindow(yearMonth: string, min: Date, max: Date) {
    const match = yearMonth.match(/^(\d{4})-(\d{2})$/);
    if (!match) return false;
    const d = new Date(Number(match[1]), Number(match[2]) - 1, 1);
    return d >= min && d <= max;
}

function getMonthsForPerformance(performance: Partial<PrunedPerformance>): string[] {
    const months = new Set<string>();
    const { min: windowMin, max: windowMax } = getCalendarWindowBounds();
    const dateStr = String(performance.date || '').replace(/\./g, '-');
    if (!dateStr || dateStr.trim() === '') {
        const now = new Date();
        return [`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`];
    }

    const toYearMonth = (d: Date) => {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    const schedule = getScheduleWindow(performance as any);
    let start: Date | null = null;
    let end: Date | null = null;

    if (schedule.start) start = new Date(schedule.start);
    if (schedule.end) end = new Date(schedule.end);

    if (start && isNaN(start.getTime())) start = null;
    if (end && isNaN(end.getTime())) end = null;

    if (!start) {
        const matches = dateStr.match(/\b(20)?(\d{2})[-/](\d{2})[-/](\d{2})\b/g);
        if (matches && matches.length > 0) {
            const cleanYear = (yStr: string) => yStr.length === 2 ? '20' + yStr : yStr;
            const parts = matches[0].split(/[-/]/);
            start = new Date(`${cleanYear(parts[0])}-${parts[1]}-${parts[2]}`);
            if (matches.length > 1) {
                const partsEnd = matches[1].split(/[-/]/);
                end = new Date(`${cleanYear(partsEnd[0])}-${partsEnd[1]}-${partsEnd[2]}`);
            }
        }
    }

    if (!start || isNaN(start.getTime())) {
        const now = new Date();
        return [toYearMonth(now)];
    }

    // Drop clearly bogus historical/far-future dates from calendar index
    if (start < windowMin && (!end || end < windowMin)) {
        return [];
    }
    if (start > windowMax) {
        return [];
    }

    let limitEnd = new Date(start);
    limitEnd.setMonth(limitEnd.getMonth() + 12);

    let finalEnd = end;
    if (!finalEnd || finalEnd > limitEnd || isNaN(finalEnd.getTime())) {
        finalEnd = limitEnd;
    }
    if (finalEnd > windowMax) finalEnd = windowMax;
    if (start < windowMin) start = windowMin;

    let current = new Date(start.getFullYear(), start.getMonth(), 1);
    const targetEnd = new Date(finalEnd.getFullYear(), finalEnd.getMonth(), 1);

    while (current <= targetEnd) {
        const ym = toYearMonth(current);
        if (isYearMonthInCalendarWindow(ym, windowMin, windowMax)) {
            months.add(ym);
        }
        current.setMonth(current.getMonth() + 1);
    }

    return Array.from(months);
}

function buildMapVenuePayload(items: Array<Partial<PrunedPerformance>>) {
    type MapVenueGroupPayload = {
        groupKey: string;
        venueName: string;
        venueKey: string;
        address?: string;
        lat: number;
        lng: number;
        region?: string;
        district?: string;
        type: 'performance';
        performances: Array<Partial<PrunedPerformance>>;
        firstAppearanceIndex: number;
    };

    const groups = new Map<string, MapVenueGroupPayload>();

    items.forEach((performance, index) => {
        const lat = parseCoordinate(performance.lat);
        const lng = parseCoordinate(performance.lng);
        if (!lat || !lng) return;

        const venueName = compactText(performance.venue) || compactText(performance.venueKey) || '장소 확인 필요';
        const venueKey = compactText(performance.venueKey) || venueName;
        const groupKey = compactText(performance.venueCanonicalId)
            || compactText(performance.locationKey)
            || `${venueKey}::${coordinateKey(lat, lng) || compactText(performance.address)}`;

        const existing = groups.get(groupKey);
        if (existing) {
            if (existing.venueName.includes('|') && !venueName.includes('|')) {
                existing.venueName = venueName;
                existing.venueKey = venueKey;
            }
            if (!existing.address && performance.address) existing.address = performance.address;
            if (!existing.district && performance.district) existing.district = performance.district;
            if (!existing.region && performance.region) existing.region = performance.region;
            existing.performances.push(performance);
            return;
        }

        groups.set(groupKey, pickDefined({
            groupKey,
            venueName,
            venueKey,
            address: performance.address,
            lat,
            lng,
            region: performance.region,
            district: performance.district,
            type: 'performance' as const,
            performances: [performance],
            firstAppearanceIndex: index,
        }) as MapVenueGroupPayload);
    });

    return Array.from(groups.values());
}

function coordinateKey(lat?: number, lng?: number) {
    if (typeof lat !== 'number' || typeof lng !== 'number') return '';
    return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function hasGenericFallbackCoordinate(performance: Performance) {
    return GENERIC_OR_FALLBACK_COORDINATE_KEYS.has(coordinateKey(performance.lat, performance.lng));
}

function hasDetailedAddress(value?: string) {
    const address = compactText(value);
    if (!address || address === '정보 없음' || address === '주소 정보 없음') return false;
    if (/[·ㆍ]/.test(address) && !/\d/.test(address)) return false;
    if (address.split(' ').filter(Boolean).length < 3) return false;
    if (!/\d/.test(address) && /(시|군|구|동|읍|면)$/.test(address)) return false;
    return /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주|충청|전라|경상)/.test(address);
}

function normalizeAddressRegionWords(value?: string) {
    return compactText(value)
        .replace(/서울특별시|서울시/g, '서울')
        .replace(/부산광역시|부산시/g, '부산')
        .replace(/대구광역시|대구시/g, '대구')
        .replace(/인천광역시|인천시/g, '인천')
        .replace(/광주광역시|광주시/g, '광주')
        .replace(/대전광역시|대전시/g, '대전')
        .replace(/울산광역시|울산시/g, '울산')
        .replace(/경기도/g, '경기')
        .replace(/강원특별자치도|강원도/g, '강원')
        .replace(/충청북도/g, '충북')
        .replace(/충청남도/g, '충남')
        .replace(/전북특별자치도|전라북도/g, '전북')
        .replace(/전라남도/g, '전남')
        .replace(/경상북도/g, '경북')
        .replace(/경상남도/g, '경남')
        .replace(/제주특별자치도|제주도/g, '제주');
}

function getAddressAreaLabel(value?: string) {
    const parts = normalizeAddressRegionWords(value).split(' ').filter(Boolean);
    if (parts.length >= 2 && /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/.test(parts[0])) {
        return `${parts[0]} ${parts[1]}`;
    }
    return '';
}

function getRegionIdFromAddress(value?: string) {
    const region = normalizeAddressRegionWords(value).split(' ').filter(Boolean)[0];
    if (!region) return '';
    if (region === '서울') return 'seoul';
    if (region === '부산') return 'busan';
    if (region === '대구') return 'daegu';
    if (region === '인천') return 'incheon';
    if (region === '광주') return 'gwangju';
    if (region === '대전') return 'daejeon';
    if (region === '울산') return 'ulsan';
    if (region === '세종') return 'sejong';
    if (region === '경기') return 'gyeonggi';
    if (region === '강원') return 'gangwon';
    if (region === '충북') return 'chungbuk';
    if (region === '충남') return 'chungnam';
    if (region === '전북') return 'jeonbuk';
    if (region === '전남') return 'jeonnam';
    if (region === '경북') return 'gyeongbuk';
    if (region === '경남') return 'gyeongnam';
    if (region === '제주') return 'jeju';
    return '';
}

function isGenericOrNonVenueText(value?: string) {
    const text = compactText(value);
    if (!text) return true;
    if (GENERIC_VENUE_EXACTS.has(text)) return true;
    if (text.includes('/')) return true;
    if (/^[·ㆍ]\s*[가-힣]+[구군시읍면동]$/.test(text)) return true;
    if (/^(서울|부산|대구|인천|광주|대전|울산|세종|경기|경기도|강원|충북|충남|전북|전남|경북|경남|제주)\s*[·ㆍ]/.test(text)) return true;
    if (!/\d/.test(text) && /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|경기도|강원|충북|충남|전북|전남|경북|경남|제주)\s+[가-힣]+[구군시]$/.test(text)) return true;
    if (NON_VENUE_TEXT_PATTERNS.some((pattern) => pattern.test(text))) return true;
    if (text.length > 24 && /(합니다|드립니다|주세요|예정|참고|안내|확인)/.test(text)) return true;
    return false;
}

function applyVenueRecordToPerformance(performance: Performance, venueKey: string, record: VenueRecord) {
    const previousVenue = compactText(performance.venue);
    const venueChanged = previousVenue !== compactText(venueKey);
    const recordAddress = compactText(record.address);
    const recordLat = parseCoordinate(record.lat ?? record.latitude);
    const recordLng = parseCoordinate(record.lng ?? record.longitude);

    performance.venue = venueKey;
    performance.venueKey = venueKey;

    if (recordAddress && recordAddress !== '정보 없음') {
        const currentAddressIsWeak =
            isKnownSellerAddress(performance.address) ||
            !hasDetailedAddress(performance.address) ||
            compactComparable(performance.address) === compactComparable(performance.venue) ||
            hasGenericFallbackCoordinate(performance);

        if (currentAddressIsWeak || hasDetailedAddress(recordAddress)) {
            performance.address = recordAddress;
        }
    }

    if (typeof recordLat === 'number' && typeof recordLng === 'number') {
        const sameAddressAsRecord = compactComparable(performance.address) === compactComparable(recordAddress);
        if (venueChanged || sameAddressAsRecord || !performance.lat || !performance.lng || hasGenericFallbackCoordinate(performance)) {
            performance.lat = recordLat;
            performance.lng = recordLng;
        }
    } else if (hasGenericFallbackCoordinate(performance)) {
        performance.lat = undefined;
        performance.lng = undefined;
    }

    if (typeof record.district === 'string' && record.district.trim()) {
        performance.district = record.district.trim();
    }
    if (typeof record.mapped_region_id === 'string' && record.mapped_region_id.trim()) {
        performance.region = record.mapped_region_id.trim();
    }

    performance.locationKey = undefined;
}

function shortenText(value?: string, maxLength = 80) {
    const text = compactText(value);
    if (!text) return '';
    return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function hasUsableLink(value?: string) {
    return Boolean(value && value.trim() && value.trim() !== '#');
}

function hasLocalAsset(assetPath?: string) {
    if (!assetPath || !assetPath.startsWith('/')) return false;
    const normalized = assetPath.replace(/^\/+/, '');
    return fs.existsSync(path.join(process.cwd(), 'public', normalized));
}

function isMovieFallbackImage(image?: string) {
    return image === '/images/kbo-thumbnail.png' || image === FALLBACK_IMAGES.movie;
}

function isBrokenLocalAssetPath(assetPath?: string) {
    return Boolean(assetPath && assetPath.startsWith('/') && !hasLocalAsset(assetPath));
}

function getRemoteImageCandidate(performance: Performance) {
    const candidates = [performance.backupPoster, performance.posterUrl, performance.image];
    return candidates.find((candidate) => typeof candidate === 'string' && candidate.startsWith('http'));
}

function normalizeImageFields(items: Performance[]) {
    items.forEach((performance) => {
        if (performance.genre === 'soccer') {
            performance.image = FALLBACK_IMAGES.soccer;
            performance.backupPoster = FALLBACK_IMAGES.soccer;
        }

        const normalizedImage = normalizeImageUrl(performance.image);
        const normalizedBackup = normalizeImageUrl(performance.backupPoster);
        const normalizedPosterUrl = normalizeImageUrl(performance.posterUrl);
        const normalizedPoster = normalizeImageUrl(performance.poster);

        if (normalizedImage) performance.image = normalizedImage;
        if (normalizedBackup) performance.backupPoster = normalizedBackup;
        if (normalizedPosterUrl) performance.posterUrl = normalizedPosterUrl;
        if (normalizedPoster) performance.poster = normalizedPoster;

        const remoteCandidate = getRemoteImageCandidate(performance);
        if ((!performance.image || isMovieFallbackImage(performance.image)) && remoteCandidate) {
            performance.image = remoteCandidate;
        }
        if (performance.image?.startsWith('http') && !performance.backupPoster) {
            performance.backupPoster = performance.image;
        }
        if (performance.backupPoster?.startsWith('http') && !performance.posterUrl && performance.image !== performance.backupPoster) {
            performance.posterUrl = performance.backupPoster;
        }
    });
}

function getSiblingQualityScore(performance: Performance) {
    let score = 0;

    if (hasUsableLink(performance.link)) score += 3;
    if (hasUsableLink(performance.website)) score += 2;
    if (getRemoteImageCandidate(performance)) score += 3;
    if (compactText(performance.description) || compactText(performance.synopsis)) score += 1;
    if (compactText(performance.address)) score += 1;

    return score;
}

function loadMovieCatalog(): MovieCatalogItem[] {
    const candidates = [
        path.join(process.cwd(), 'src', 'data', 'movies.json'),
        path.join(process.cwd(), 'public', 'data', 'movies.json'),
    ];

    for (const candidate of candidates) {
        if (!fs.existsSync(candidate)) continue;

        try {
            const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'));
            if (Array.isArray(parsed)) {
                return parsed as MovieCatalogItem[];
            }
        } catch {
            // Try the next candidate.
        }
    }

    return [];
}

function readJsonIfExists<T>(filePath: string, fallback: T): T {
    if (!fs.existsSync(filePath)) return fallback;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
    } catch {
        return fallback;
    }
}

function getConfiguredVenuePlaceProviders(): VenuePlaceProvider[] {
    const providers: VenuePlaceProvider[] = [];
    if (process.env.KAKAO_REST_API_KEY || process.env.KAKAO_LOCAL_REST_API_KEY) providers.push('kakao');
    if (
        (process.env.NAVER_SEARCH_CLIENT_ID || process.env.NAVER_CLIENT_ID) &&
        (process.env.NAVER_SEARCH_CLIENT_SECRET || process.env.NAVER_CLIENT_SECRET)
    ) {
        providers.push('naver');
    }
    return providers;
}

function rehydrateMoviesFromCatalog(items: Performance[]) {
    const catalog = loadMovieCatalog();
    if (catalog.length === 0) return;

    const byId = new Map<string, MovieCatalogItem>();
    const byTitle = new Map<string, MovieCatalogItem>();

    catalog.forEach((movie) => {
        if (movie.id) byId.set(movie.id, movie);

        const titleKey = compactText(movie.title);
        if (titleKey) byTitle.set(titleKey, movie);
    });

    items.forEach((performance) => {
        if (performance.genre !== 'movie') return;

        const catalogItem =
            byId.get(performance.id) ||
            byTitle.get(compactText(performance.title));

        if (!catalogItem) return;

        const catalogBackupPoster = typeof catalogItem.backupPoster === 'string' ? catalogItem.backupPoster : undefined;
        const catalogPosterUrl = typeof catalogItem.posterUrl === 'string' ? catalogItem.posterUrl : undefined;
        const catalogImage = typeof catalogItem.image === 'string' ? catalogItem.image : undefined;
        const catalogStatsCollectedAt =
            typeof catalogItem.statsCollectedAt === 'string'
                ? catalogItem.statsCollectedAt
                : (typeof catalogItem.lastCollected === 'string' ? catalogItem.lastCollected : undefined);

        if (!performance.reservationRate && catalogItem.reservationRate) {
            performance.reservationRate = catalogItem.reservationRate;
        }
        if (!performance.audienceCount && catalogItem.audienceCount) {
            performance.audienceCount = catalogItem.audienceCount;
        }
        if (!performance.statsCollectedAt && catalogStatsCollectedAt) {
            performance.statsCollectedAt = catalogStatsCollectedAt;
        }
        if (!performance.dataCollectedAt && catalogStatsCollectedAt) {
            performance.dataCollectedAt = catalogStatsCollectedAt;
        }
        if (!hasUsableLink(performance.link) && hasUsableLink(catalogItem.link)) {
            performance.link = catalogItem.link;
        }
        if ((!performance.platforms || performance.platforms.length === 0) && Array.isArray(catalogItem.platforms) && catalogItem.platforms.length > 0) {
            performance.platforms = catalogItem.platforms;
        }
        if ((!performance.stillImages || performance.stillImages.length === 0) && Array.isArray(catalogItem.stillImages) && catalogItem.stillImages.length > 0) {
            performance.stillImages = catalogItem.stillImages;
        }
        if ((!performance.keywords || performance.keywords.length === 0) && Array.isArray(catalogItem.keywords) && catalogItem.keywords.length > 0) {
            performance.keywords = catalogItem.keywords;
        }
        if (!performance.tagline && catalogItem.tagline) {
            performance.tagline = catalogItem.tagline;
        }
        if (performance.voteAverage === undefined && catalogItem.voteAverage !== undefined) {
            performance.voteAverage = catalogItem.voteAverage;
        }
        if (performance.voteCount === undefined && catalogItem.voteCount !== undefined) {
            performance.voteCount = catalogItem.voteCount;
        }
        if (performance.popularity === undefined && catalogItem.popularity !== undefined) {
            performance.popularity = catalogItem.popularity;
        }
        if (!performance.trailer && catalogItem.trailer) {
            performance.trailer = catalogItem.trailer;
        }

        if (!performance.backupPoster && catalogBackupPoster) {
            performance.backupPoster = catalogBackupPoster;
        }
        if (!performance.posterUrl && catalogPosterUrl) {
            performance.posterUrl = catalogPosterUrl;
        }

        const shouldUseCatalogImage =
            !performance.image ||
            isMovieFallbackImage(performance.image) ||
            isBrokenLocalAssetPath(performance.image);

        if (shouldUseCatalogImage && catalogImage) {
            performance.image = catalogImage;
        }

        if (
            isBrokenLocalAssetPath(performance.image) &&
            !performance.backupPoster &&
            catalogBackupPoster
        ) {
            performance.backupPoster = catalogBackupPoster;
        }
    });
}

function enrichFromSiblingItems(items: Performance[]) {
    const donorByTitle = new Map<string, Performance>();

    items.forEach((performance) => {
        const key = compactText(performance.title);
        if (!key) return;

        const currentDonor = donorByTitle.get(key);
        if (!currentDonor || getSiblingQualityScore(performance) > getSiblingQualityScore(currentDonor)) {
            donorByTitle.set(key, performance);
        }
    });

    items.forEach((performance) => {
        const donor = donorByTitle.get(compactText(performance.title));
        if (!donor || donor === performance) return;

        if (!hasUsableLink(performance.link) && hasUsableLink(donor.link)) {
            performance.link = donor.link;
        }
        if (!hasUsableLink(performance.website) && hasUsableLink(donor.website)) {
            performance.website = donor.website;
        }
        if (
            !compactText(performance.description)
            && compactText(donor.description)
            && !isLowValueGeneratedDescription(donor.description)
        ) {
            performance.description = donor.description;
        }

        const donorImage = getRemoteImageCandidate(donor);
        if (!performance.backupPoster && donorImage) {
            performance.backupPoster = donorImage;
        }
    });
}

function repairBrokenLocalImages(items: Performance[]) {
    items.forEach((performance) => {
        if (performance.genre === 'movie' && isMovieFallbackImage(performance.image)) {
            const remoteCandidate = getRemoteImageCandidate(performance);
            performance.image = remoteCandidate || FALLBACK_IMAGES.movie;
            return;
        }

        if (!performance.image || !performance.image.startsWith('/')) return;
        if (hasLocalAsset(performance.image)) return;

        const remoteCandidate = getRemoteImageCandidate(performance);
        if (remoteCandidate) {
            performance.image = remoteCandidate;
            return;
        }

        performance.image = FALLBACK_IMAGES[performance.genre] || FALLBACK_IMAGES.default;
    });
}

function repairMissingLinks(items: Performance[]) {
    items.forEach((performance) => {
        if (hasUsableLink(performance.link)) return;
        performance.link = getExternalContentLink(performance);
    });
}

function normalizeDuplicateTimeFields(items: Performance[]) {
    items.forEach((performance) => {
        const operatingHours = compactComparable(performance.operatingHours);
        const performanceTime = compactComparable(performance.performanceTime);
        if (!operatingHours || !performanceTime || operatingHours !== performanceTime) return;

        if (performance.genre === 'tourism') {
            performance.performanceTime = '';
            return;
        }

        performance.operatingHours = '';
    });
}

function normalizeAmenityList(value: unknown) {
    if (Array.isArray(value)) {
        return value.map((item) => compactText(String(item))).filter(Boolean);
    }

    const text = compactText(value as string | undefined);
    if (!text) return [];
    return text.split(/[,，ㆍ·|/]/).map((item) => compactText(item)).filter(Boolean);
}

function enrichVenueContextFromRecords(items: Performance[], venues: Record<string, VenueRecord>) {
    items.forEach((performance) => {
        if (performance.genre === 'movie') return;

        const record = venues[performance.venueKey || ''] || venues[performance.venue || ''];
        if (!record) return;

        const phone = compactText(record.phone as string | undefined);
        const homepage = compactText(record.homepage as string | undefined);
        const facilityType = compactText(record.facilityType as string | undefined);
        const seatScale = compactText(record.seatScale as string | undefined);
        const theaterCount = compactText(record.theaterCount as string | undefined);
        const openedAt = compactText(record.openedAt as string | undefined);
        const parking = compactText(record.parking as string | undefined);
        const restrooms = compactText(record.restrooms as string | undefined);
        const facilities = compactText(record.facilities as string | undefined);
        const amenities = normalizeAmenityList(record.amenities);

        if (!performance.contact && phone) performance.contact = phone;
        if (!performance.venuePhone && phone) performance.venuePhone = phone;
        if (!performance.website && homepage) performance.website = homepage;
        if (!performance.venueHomepage && homepage) performance.venueHomepage = homepage;
        if (!performance.venueFacilityType && facilityType) performance.venueFacilityType = facilityType;
        if (!performance.venueSeatScale && seatScale) performance.venueSeatScale = seatScale;
        if (!performance.venueTheaterCount && theaterCount) performance.venueTheaterCount = theaterCount;
        if (!performance.venueOpenedAt && openedAt) performance.venueOpenedAt = openedAt;
        if (!performance.parking && parking) performance.parking = parking;
        if (!performance.restrooms && restrooms) performance.restrooms = restrooms;
        if (!performance.facilities && facilities) performance.facilities = facilities;
        if ((!performance.venueAmenities || performance.venueAmenities.length === 0) && amenities.length > 0) {
            performance.venueAmenities = amenities;
        }
    });
}

function applyVenuePlaceContextToPerformances(items: Performance[], venueMasterBuild: ReturnType<typeof buildVenueMaster>) {
    const entryById = new Map(venueMasterBuild.entries.map((entry) => [entry.id, entry]));

    items.forEach((performance) => {
        const venueMasterMatch = venueMasterBuild.performanceVenueIndex[performance.id];
        if (!venueMasterMatch) return;

        const entry = entryById.get(venueMasterMatch.canonicalId);
        performance.venueCanonicalId = venueMasterMatch.canonicalId;
        if (venueMasterMatch.hallName) {
            performance.venueHallName = venueMasterMatch.hallName;
        }

        if (!entry) return;

        const provider = (['kakao', 'naver'] as const).find((candidate) => entry.placeIds?.[candidate]);
        const providerPlaceId = provider ? entry.placeIds?.[provider] : undefined;
        if (provider && providerPlaceId) {
            performance.placeProvider = provider;
            performance.placeId = providerPlaceId;
        }
        const sourceVenueName = compactText(performance.venueKey || performance.venue);
        const entryDisplayName = compactText(entry.displayName);
        const canUseEntryDisplayName = Boolean(
            entryDisplayName
            && isCompatibleVenueDisplayName(sourceVenueName, entryDisplayName)
        );
        const shouldKeepSourceVenueName = (() => {
            if (performance.source !== 'yes24-exclusive') return false;
            const sourceVenue = compactText(performance.venue);
            if (!sourceVenue || !entryDisplayName || sourceVenue === entryDisplayName) return false;
            return sourceVenue.length > entryDisplayName.length
                && /(문화홀|콘서트홀|아트홀|소극장|대극장|공연장|홀)$/u.test(sourceVenue)
                && canUseEntryDisplayName;
        })();

        if (entry.displayName && entry.confidence === 'high' && canUseEntryDisplayName && !shouldKeepSourceVenueName) {
            performance.venue = entry.displayName;
            performance.venueKey = entry.displayName;
        }
        if (entry.address) {
            performance.address = entry.address;
            const regionFromAddress = getRegionIdFromAddress(entry.address);
            if (regionFromAddress) performance.region = regionFromAddress;
        }
        if (typeof entry.lat === 'number') performance.lat = entry.lat;
        if (typeof entry.lng === 'number') performance.lng = entry.lng;
        performance.locationKey = undefined;
    });
}

function isWeakScheduleLabel(value?: string) {
    const label = compactText(value).toUpperCase();
    if (!label) return true;
    return label.includes('상시') || label.includes('OPEN RUN') || label.includes('오픈런') || label.includes('연중');
}

function toKoreanMiddayDate(year: number, month: number, day: number) {
    return new Date(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00+09:00`);
}

function normalizeYearToken(value: string | undefined, fallbackYear: number) {
    if (!value) return fallbackYear;
    const year = Number.parseInt(value, 10);
    if (!Number.isFinite(year)) return fallbackYear;
    return year < 100 ? 2000 + year : year;
}

function extractTitleScheduleRange(title: string, referenceDate: Date) {
    const normalized = compactText(title);
    const match = normalized.match(/(?:^|[^\d])(?:(20\d{2}|\d{2})[.\/-])?(\d{1,2})[.\/-](\d{1,2})\s*[~～]\s*(?:(20\d{2}|\d{2})[.\/-])?(\d{1,2})[.\/-](\d{1,2})(?!\d)/);
    if (!match) return null;

    const referenceYear = referenceDate.getFullYear();
    const referenceMonth = referenceDate.getMonth() + 1;
    const startYearToken = match[1];
    const startMonth = Number.parseInt(match[2], 10);
    const startDay = Number.parseInt(match[3], 10);
    const endYearToken = match[4];
    const endMonth = Number.parseInt(match[5], 10);
    const endDay = Number.parseInt(match[6], 10);
    if (!startMonth || !startDay || !endMonth || !endDay) return null;

    let startYear = normalizeYearToken(startYearToken, referenceYear);
    let endYear = normalizeYearToken(endYearToken, startYear);

    if (!startYearToken && !endYearToken) {
        startYear = referenceYear;
        endYear = referenceYear;

        if (endMonth < startMonth) {
            if (referenceMonth <= endMonth) {
                startYear = referenceYear - 1;
                endYear = referenceYear;
            } else if (referenceMonth >= startMonth) {
                startYear = referenceYear;
                endYear = referenceYear + 1;
            } else {
                // Between the winter end and the next winter start, the range refers to the finished season.
                startYear = referenceYear - 1;
                endYear = referenceYear;
            }
        }
    } else if (!endYearToken && endMonth < startMonth) {
        endYear = startYear + 1;
    }

    const start = toKoreanMiddayDate(startYear, startMonth, startDay);
    const end = toKoreanMiddayDate(endYear, endMonth, endDay);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    if (end < start) return null;

    return { start, end };
}

function extractMonthScheduleRange(value: string, referenceDate: Date) {
    const normalized = compactText(value);
    const match = normalized.match(/(?:(20\d{2}|\d{2})년\s*)?(\d{1,2})월\s*[~～]\s*(?:(20\d{2}|\d{2})년\s*)?(\d{1,2})월/);
    if (!match) return null;

    const referenceYear = referenceDate.getFullYear();
    const referenceMonth = referenceDate.getMonth() + 1;
    const startYearToken = match[1];
    const startMonth = Number.parseInt(match[2], 10);
    const endYearToken = match[3];
    const endMonth = Number.parseInt(match[4], 10);
    if (!startMonth || !endMonth) return null;

    let startYear = normalizeYearToken(startYearToken, referenceYear);
    let endYear = normalizeYearToken(endYearToken, startYear);

    if (!startYearToken && !endYearToken) {
        startYear = referenceYear;
        endYear = referenceYear;
        if (endMonth < startMonth) {
            if (referenceMonth <= endMonth) {
                startYear = referenceYear - 1;
                endYear = referenceYear;
            } else if (referenceMonth >= startMonth) {
                startYear = referenceYear;
                endYear = referenceYear + 1;
            } else {
                startYear = referenceYear - 1;
                endYear = referenceYear;
            }
        }
    } else if (!endYearToken && endMonth < startMonth) {
        endYear = startYear + 1;
    }

    const endDay = new Date(endYear, endMonth, 0).getDate();
    const start = toKoreanMiddayDate(startYear, startMonth, 1);
    const end = toKoreanMiddayDate(endYear, endMonth, endDay);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    if (end < start) return null;

    return { start, end };
}

function extractEndOnlyMonthWindow(value: string, referenceDate: Date) {
    const normalized = compactText(value);
    const match = normalized.match(/[~～]\s*(?:(20\d{2}|\d{2})[.년\s]+)?(\d{1,2})월?/);
    if (!match) return null;

    const endYear = normalizeYearToken(match[1], referenceDate.getFullYear());
    const endMonth = Number.parseInt(match[2], 10);
    if (!endMonth) return null;

    const endDay = new Date(endYear, endMonth, 0).getDate();
    const start = toKoreanMiddayDate(endYear, 1, 1);
    const end = toKoreanMiddayDate(endYear, endMonth, endDay);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

    return { start, end };
}

function formatDateForUnifiedInput(date: Date) {
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
    ].join('.');
}

function applyTitleScheduleMetadata(items: Performance[], referenceDate: Date) {
    items.forEach((performance) => {
        const scheduleText = [performance.dateRaw, performance.date, performance.title].filter(Boolean).join(' ');
        const endOnlyWindow = extractEndOnlyMonthWindow(scheduleText, referenceDate);
        if (endOnlyWindow && isWeakScheduleLabel(performance.date)) {
            const rawRange = `${formatDateForUnifiedInput(endOnlyWindow.start)} ~ ${formatDateForUnifiedInput(endOnlyWindow.end)}`;
            performance.dateRaw = rawRange;
            performance.date = formatUnifiedDate(rawRange);
            return;
        }

        const monthWindow = extractMonthScheduleRange(scheduleText, referenceDate);
        if (monthWindow) {
            const rawRange = `${formatDateForUnifiedInput(monthWindow.start)} ~ ${formatDateForUnifiedInput(monthWindow.end)}`;
            performance.dateRaw = rawRange;
            performance.date = formatUnifiedDate(rawRange);
            return;
        }

        if (!isWeakScheduleLabel(performance.date) && !isWeakScheduleLabel(performance.dateRaw)) return;

        const titleWindow = extractTitleScheduleRange(performance.title, referenceDate);
        if (!titleWindow) return;

        const rawRange = `${formatDateForUnifiedInput(titleWindow.start)} ~ ${formatDateForUnifiedInput(titleWindow.end)}`;
        performance.dateRaw = rawRange;
        performance.date = formatUnifiedDate(rawRange);
    });
}

function repairBranchVenueAssignments(items: Performance[], venues: Record<string, VenueRecord>) {
    items.forEach((performance) => {
        const haystack = compactComparable([performance.title, performance.venue].filter(Boolean).join(' '));
        const rule = KNOWN_BRANCH_VENUE_RULES.find((candidate) => (
            venues[candidate.venueKey] &&
            candidate.tokens.every((token) => haystack.includes(compactComparable(token)))
        ));

        if (rule) {
            applyVenueRecordToPerformance(performance, rule.venueKey, venues[rule.venueKey]);
            return;
        }

        const exactRecord = venues[performance.venue];
        if (!exactRecord) return;

        const shouldHydrateFromDictionary =
            isKnownSellerAddress(performance.address) ||
            hasGenericFallbackCoordinate(performance) ||
            !hasDetailedAddress(performance.address) ||
            compactComparable(performance.address) === compactComparable(performance.venue);

        if (shouldHydrateFromDictionary) {
            applyVenueRecordToPerformance(performance, performance.venue, exactRecord);
        }
    });
}

function getSeasonPrimaryText(performance: Performance) {
    return [
        performance.title,
        performance.venue,
        performance.subGenre,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}

function isOutOfSeasonWinterLeisure(performance: Performance, referenceDate: Date) {
    const month = referenceDate.getMonth() + 1;
    if ([11, 12, 1, 2, 3].includes(month)) return false;

    const primaryText = WINTER_LEISURE_FALSE_POSITIVE_TERMS.reduce(
        (acc, keyword) => acc.replaceAll(keyword, ''),
        getSeasonPrimaryText(performance),
    );

    if (WINTER_LEISURE_TERMS.some((keyword) => primaryText.includes(keyword))) return true;
    if (primaryText.includes('스키') && /(리조트|렌탈|강습|슬로프|스키학교|스키\/보드)/.test(primaryText)) return true;
    if (primaryText.includes('보드') && /(스노우|스키|렌탈)/.test(primaryText)) return true;
    return false;
}

function applyLocationOverride(
    performance: Performance,
    patch: Pick<Performance, 'venue' | 'address' | 'lat' | 'lng' | 'region'> & { district?: string }
) {
    performance.venue = patch.venue;
    performance.address = patch.address;
    performance.region = patch.region;
    performance.lat = patch.lat;
    performance.lng = patch.lng;
    performance.district = patch.district;
    performance.venueKey = undefined;
    performance.locationKey = undefined;

    const description = compactText(performance.description);
    if (
        description.includes('고양대로 1955') ||
        description.includes('솜씨당 클래스') ||
        description.includes('장소 확인 필요')
    ) {
        performance.description = buildFallbackDescription(performance);
    }
}

function repairKnownLocationOverrides(items: Performance[]) {
    items.forEach((performance) => {
        if (
            performance.source === 'kopis' &&
            performance.venue.includes('금정문화회관') &&
            compactText(performance.address).includes('천안')
        ) {
            applyLocationOverride(performance, {
                venue: performance.venue,
                address: '부산 금정구 체육공원로 7',
                lat: 35.246196,
                lng: 129.0942315,
                region: 'busan',
                district: '금정구',
            });
            return;
        }

        if (performance.source !== 'umclass') return;

        const link = compactText(performance.link);
        if (link.includes('/classInfo/1494')) {
            applyLocationOverride(performance, {
                venue: '서울 영등포구',
                address: '서울 영등포구',
                lat: undefined,
                lng: undefined,
                region: 'seoul',
                district: '영등포구',
            });
            return;
        }

        if (link.includes('/classInfo/1950')) {
            applyLocationOverride(performance, {
                venue: '서울 광진구',
                address: '서울 광진구',
                lat: undefined,
                lng: undefined,
                region: 'seoul',
                district: '광진구',
            });
            return;
        }

        const hasStaleGenericGoyangLocation =
            compactText(performance.venue) === '솜씨당 클래스' &&
            compactText(performance.address).includes('고양대로 1955');
        if (!hasStaleGenericGoyangLocation) return;

        if (link.includes('/classInfo/1933') || link.includes('/classInfo/1936')) {
            applyLocationOverride(performance, {
                venue: '대구 중구 봉산문화길 95 (봉산동) 1층 markcollection',
                address: '대구광역시 중구 봉산문화길 95',
                lat: 35.8641430410256,
                lng: 128.596476331292,
                region: 'daegu',
                district: '중구',
            });
            return;
        }

        if (performance.title.includes('영등포')) {
            applyLocationOverride(performance, {
                venue: '서울 영등포구',
                address: '서울 영등포구',
                lat: undefined,
                lng: undefined,
                region: 'seoul',
                district: '영등포구',
            });
            return;
        }

        if (performance.title.includes('건대')) {
            applyLocationOverride(performance, {
                venue: '서울 광진구',
                address: '서울 광진구',
                lat: undefined,
                lng: undefined,
                region: 'seoul',
                district: '광진구',
            });
        }
    });
}

function sanitizeWeakVenueIdentities(items: Performance[]) {
    items.forEach((performance) => {
        const venue = compactText(performance.venue);
        const address = compactText(performance.address);
        const shouldSanitize =
            isGenericOrNonVenueText(venue) ||
            (isGenericOrNonVenueText(address) && !hasDetailedAddress(address));

        if (!shouldSanitize) return;

        const areaLabel = getAddressAreaLabel(address) || getAddressAreaLabel(venue);
        const safeVenue = areaLabel || performance.district || '장소 확인 필요';

        performance.venue = safeVenue;
        performance.venueKey = undefined;
        performance.locationKey = undefined;

        if (!hasDetailedAddress(address)) {
            performance.address = areaLabel || '';
            performance.lat = undefined;
            performance.lng = undefined;
        } else if (hasGenericFallbackCoordinate(performance)) {
            performance.lat = undefined;
            performance.lng = undefined;
        }

        const description = compactText(performance.description);
        if (!description || isGenericOrNonVenueText(description)) {
            performance.description = buildFallbackDescription(performance);
        }
        if (isLowValueGeneratedDescription(performance.description)) {
            performance.description = '';
        }
    });
}

function removeLowValueGeneratedDescriptions(items: Performance[]) {
    items.forEach((performance) => {
        if (isLowValueGeneratedDescription(performance.description)) {
            performance.description = '';
        }
    });
}

function getSourceAgeDays(updatedAt: Date) {
    const ageMs = Date.now() - updatedAt.getTime();
    return Math.max(0, Math.floor(ageMs / (1000 * 60 * 60 * 24)));
}

function getTrackedFileUpdatedAt(relativePath: string) {
    const absolutePath = path.join(process.cwd(), relativePath);
    if (!fs.existsSync(absolutePath)) return null;
    const fileMtime = fs.statSync(absolutePath).mtime;
    let hasUncommittedChanges = false;

    try {
        hasUncommittedChanges = execFileSync('git', ['status', '--porcelain', '--', relativePath], {
            cwd: process.cwd(),
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim().length > 0;
    } catch {
        hasUncommittedChanges = false;
    }

    try {
        const gitUpdatedAt = execFileSync('git', ['log', '-1', '--format=%cI', '--', relativePath], {
            cwd: process.cwd(),
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();

        if (gitUpdatedAt) {
            const parsed = new Date(gitUpdatedAt);
            if (!Number.isNaN(parsed.getTime())) {
                return hasUncommittedChanges && fileMtime.getTime() > parsed.getTime() ? fileMtime : parsed;
            }
        }
    } catch {
        // Fall through to filesystem mtime when git metadata is unavailable.
    }

    return fileMtime;
}

function getSourceFreshness(
    updatedAt: Date | null,
    itemCount: number,
    seasonal: boolean,
    freshDays = SOURCE_FRESH_DAYS,
    staleDays = SOURCE_STALE_DAYS,
): DataSourceFreshness {
    if (seasonal && itemCount === 0) return 'offseason';
    if (!updatedAt) return 'unknown';

    const ageDays = getSourceAgeDays(updatedAt);
    if (ageDays <= freshDays) return 'fresh';
    if (ageDays <= staleDays) return 'aging';
    return 'stale';
}

function buildSourceSummaries(sourceCounts: Record<string, number>): {
    sourceSummaries: DataSourceSummary[];
    sourceHealthSummary: DataSourceHealthSummary;
} {
    const sourceSummaries = SOURCE_REGISTRY
        .map<DataSourceSummary>((entry) => {
            const updatedAt = getTrackedFileUpdatedAt(path.join('src', 'data', entry.file));
            const itemCount = sourceCounts[entry.key] || 0;

            return {
                key: entry.key,
                label: entry.label,
                file: entry.file,
                itemCount,
                updatedAt: updatedAt ? updatedAt.toISOString() : null,
                ageDays: updatedAt ? getSourceAgeDays(updatedAt) : null,
                freshness: getSourceFreshness(
                    updatedAt,
                    itemCount,
                    entry.seasonal === true,
                    entry.freshDays,
                    entry.staleDays,
                ),
                seasonal: entry.seasonal === true,
            };
        })
        .filter((summary) => summary.itemCount > 0 || summary.seasonal);

    const sourceHealthSummary = sourceSummaries.reduce<DataSourceHealthSummary>((acc, summary) => {
        acc.totalSources += 1;

        if (summary.freshness === 'fresh') acc.freshCount += 1;
        else if (summary.freshness === 'aging') acc.agingCount += 1;
        else if (summary.freshness === 'stale') acc.staleCount += 1;
        else if (summary.freshness === 'offseason') acc.offseasonCount += 1;
        else acc.unknownCount += 1;

        return acc;
    }, {
        totalSources: 0,
        freshCount: 0,
        agingCount: 0,
        staleCount: 0,
        offseasonCount: 0,
        unknownCount: 0,
    });

    return { sourceSummaries, sourceHealthSummary };
}

function hasReliablePrice(performance: Performance) {
    const text = compactText([performance.price, performance.priceDetail, performance.feesAndPrograms].filter(Boolean).join(' '));
    if (!text) return false;
    if (/정보\s*없음|미정|문의|예매처\s*확인/i.test(text)) return false;
    return Boolean(extractFirstPrice(text));
}

function buildPriceCoverageSummary(items: Performance[], checkedAt = new Date().toISOString()): PriceCoverageSummary {
    const rows = items.reduce<Record<string, {
        key: string;
        label: string;
        itemCount: number;
        unknownCount: number;
        actionableUnknownCount: number;
    }>>((acc, performance) => {
        const key = performance.source || 'unknown';
        const entry = SOURCE_REGISTRY.find((source) => source.key === key);
        acc[key] = acc[key] || {
            key,
            label: entry?.label || key,
            itemCount: 0,
            unknownCount: 0,
            actionableUnknownCount: 0,
        };

        acc[key].itemCount += 1;
        if (!hasReliablePrice(performance)) {
            acc[key].unknownCount += 1;
            if (!PRICE_OPTIONAL_GENRES.has(performance.genre)) {
                acc[key].actionableUnknownCount += 1;
            }
        }
        return acc;
    }, {});

    const pricedCount = items.filter(hasReliablePrice).length;
    const unknownCount = items.length - pricedCount;
    const optionalUnknownCount = items.filter((performance) => !hasReliablePrice(performance) && PRICE_OPTIONAL_GENRES.has(performance.genre)).length;
    const actionableUnknownCount = unknownCount - optionalUnknownCount;

    return {
        checkedAt,
        itemCount: items.length,
        pricedCount,
        unknownCount,
        optionalUnknownCount,
        actionableUnknownCount,
        coverageRate: items.length > 0 ? Number((pricedCount / items.length).toFixed(4)) : 1,
        topUnknownBySource: Object.values(rows)
            .filter((row) => row.unknownCount > 0)
            .sort((left, right) => right.actionableUnknownCount - left.actionableUnknownCount || right.unknownCount - left.unknownCount)
            .slice(0, 8),
    };
}

function buildOperationsSummary(checkedAt = new Date().toISOString()): OperationsSummary {
    const logDir = path.join(process.cwd(), 'logs', 'data-update');
    const failurePath = path.join(logDir, 'last-scrape-failures.txt');
    const schedulerPlistPath = path.join(process.env.HOME || '', 'Library', 'LaunchAgents', 'com.cultureflow.daily-update.plist');
    const localLogs = fs.existsSync(logDir)
        ? fs.readdirSync(logDir)
            .filter((file) => /^local-data-update-.*\.log$/.test(file))
            .map((file) => {
                const absolutePath = path.join(logDir, file);
                return {
                    file,
                    mtime: fs.statSync(absolutePath).mtime,
                };
            })
            .sort((left, right) => right.mtime.getTime() - left.mtime.getTime())
        : [];
    const recordedFailures = fs.existsSync(failurePath)
        ? fs.readFileSync(failurePath, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
        : [];
    const failureUpdatedAt = fs.existsSync(failurePath) ? fs.statSync(failurePath).mtime : null;
    const lastFailureAgeHours = failureUpdatedAt
        ? Number(((Date.now() - failureUpdatedAt.getTime()) / 36e5).toFixed(1))
        : null;
    const inferredFailures = new Set(recordedFailures);
    const latestLocalLog = localLogs[0];
    let latestLocalUpdateCompleted = true;

    if (latestLocalLog) {
        const latestLogPath = path.join(logDir, latestLocalLog.file);
        try {
            const logText = fs.readFileSync(latestLogPath, 'utf8');
            const failedExitPattern = /\[local-update\]\s+<<<\s+([a-z0-9-]+)\s+exit=([1-9]\d*)/gi;
            let match: RegExpExecArray | null;

            while ((match = failedExitPattern.exec(logText))) {
                inferredFailures.add(match[1]);
            }

            const started = /\[local-update\]\s+started at/.test(logText);
            const finished = /\[local-update\]\s+(completed at|skipped:|no data changes to commit)/.test(logText);
            latestLocalUpdateCompleted = !started || finished;
            if (started && !finished) {
                inferredFailures.add('local-update-incomplete');
            }
        } catch {
            latestLocalUpdateCompleted = false;
            inferredFailures.add('local-update-log-unreadable');
        }
    }

    const lastFailures = Array.from(inferredFailures);

    return {
        checkedAt,
        localUpdateLogCount: localLogs.length,
        latestLocalUpdateLog: localLogs[0]?.file || null,
        latestLocalUpdateAt: localLogs[0]?.mtime.toISOString() || null,
        latestLocalUpdateCompleted,
        lastFailureUpdatedAt: failureUpdatedAt?.toISOString() || null,
        lastFailureAgeHours,
        lastFailureCount: lastFailures.length,
        lastFailures: lastFailures.slice(0, 12),
        schedulerConfigured: fs.existsSync(schedulerPlistPath),
    };
}

function getLatestSourceUpdatedAt() {
    return SOURCE_REGISTRY.reduce<Date | null>((latest, entry) => {
        const updatedAt = getTrackedFileUpdatedAt(path.join('src', 'data', entry.file));
        if (!updatedAt) return latest;

        if (!latest || updatedAt.getTime() > latest.getTime()) {
            return updatedAt;
        }

        return latest;
    }, null);
}

function buildSourceUpdatedAtMap() {
    return SOURCE_REGISTRY.reduce<Record<string, string>>((acc, entry) => {
        const updatedAt = getTrackedFileUpdatedAt(path.join('src', 'data', entry.file));
        if (updatedAt) acc[entry.key] = updatedAt.toISOString();
        return acc;
    }, {});
}

function applySourceTimestampFallbacks(items: Performance[], sourceUpdatedAtByKey: Record<string, string>) {
    items.forEach((performance) => {
        if (performance.dataCollectedAt || performance.sourceUpdatedAt) return;

        const updatedAt = sourceUpdatedAtByKey[performance.source || ''];
        if (updatedAt) {
            performance.dataCollectedAt = updatedAt;
        }
    });
}

function getPublicBuildGeneratedAt() {
    const buildInfoPath = path.join(process.cwd(), 'public', 'data', 'build-info.json');
    if (!fs.existsSync(buildInfoPath)) return null;

    try {
        const parsed = JSON.parse(fs.readFileSync(buildInfoPath, 'utf8')) as { generatedAt?: string };
        if (!parsed.generatedAt) return null;

        const generatedAt = new Date(parsed.generatedAt);
        return Number.isNaN(generatedAt.getTime()) ? null : generatedAt;
    } catch {
        return null;
    }
}

function shouldPreferPublicBaseline() {
    if (process.env.PREFER_PUBLIC_DATA_BASELINE !== '1') return false;
    if (process.env.FORCE_SOURCE_REBUILD === '1') return false;

    const publicPerformancesPath = path.join(process.cwd(), 'public', 'data', 'performances.json');
    if (!fs.existsSync(publicPerformancesPath)) return false;

    const publicGeneratedAt = getPublicBuildGeneratedAt();
    const latestSourceUpdatedAt = getLatestSourceUpdatedAt();

    if (!publicGeneratedAt) return false;
    if (!latestSourceUpdatedAt) return true;

    return publicGeneratedAt.getTime() >= latestSourceUpdatedAt.getTime();
}

function buildFallbackDescription(performance: Performance) {
    const genreLabel = GENRE_LABELS[performance.genre] || '콘텐츠';
    const title = compactText(performance.title);
    const venue = shortenText(performance.venue, 50);
    const date = shortenText(performance.date, 60);
    const address = shortenText(performance.address, 60);
    const audience = shortenText(performance.targetAudience, 40);
    const operatingHours = shortenText(performance.operatingHours, 40);
    const contact = shortenText(performance.contact, 30);
    const facilities = shortenText(performance.facilities, 40);
    const closedDays = shortenText(performance.closedDays, 30);
    const fees = shortenText(performance.priceDetail || performance.feesAndPrograms || performance.price, 40);
    const subGenre = shortenText(performance.subGenre, 30);

    const parts: string[] = [];

    if (['baseball', 'basketball', 'volleyball', 'soccer', 'handball'].includes(performance.genre) && performance.homeTeam && performance.awayTeam) {
        parts.push(`${performance.homeTeam}와 ${performance.awayTeam}의 ${genreLabel} 경기입니다.`);
    } else if (performance.genre === 'class') {
        const placeDesc = venue && venue !== '장소 확인 필요' && venue !== '모카클래스' && venue !== '지정 장소' 
            ? `${venue}에서 진행되는` 
            : '배움의 가치를 나누는';
        parts.push(`${title} 클래스는 ${placeDesc} 전문 문화 예술 배움 프로그램입니다.`);
    } else if (performance.genre === 'activity') {
        const placeDesc = venue && venue !== '장소 확인 필요' && venue !== '지정 장소' ? `${venue}에서 즐기는` : '생동감 넘치는';
        parts.push(`${title}는 ${placeDesc} 액티비티 체험 콘텐츠입니다.`);
    } else if (performance.genre === 'museum' || performance.genre === 'exhibition') {
        const placeDesc = venue && venue !== '장소 확인 필요' && venue !== '지정 장소' ? `${venue} 미술관/전시장` : '문화 공간';
        parts.push(`${title}는 ${placeDesc}에서 관람할 수 있는 전시 행사입니다.`);
    } else if (performance.genre === 'tourism') {
        parts.push(`${title}는 지역 명소로서 다양한 볼거리와 즐길 거리가 가득하여 방문을 적극 고려해볼 만한 관광 명소입니다.`);
    } else if (performance.genre === 'movie') {
        parts.push(`${title} 영화는 흥미로운 스토리와 다양한 볼거리를 제공하는 대중 문화 영화 작품입니다.`);
    } else {
        const placeDesc = venue && venue !== '장소 확인 필요' && venue !== '지정 장소' ? `${venue}에서 열리는` : '엄선된';
        parts.push(`${title}는 ${placeDesc} 특별한 ${genreLabel} 공연/행사입니다.`);
    }

    if (subGenre && performance.genre !== 'movie') {
        parts.push(`상세 분류는 ${subGenre} 분야로 구성되어 있습니다.`);
    }
    if (date && !['상시', 'OPEN RUN'].includes(date)) {
        parts.push(`진행 일정은 ${date} 기준입니다.`);
    }
    if (address) {
        parts.push(`위치는 ${address} 도로명 주소나 안내 지도를 참조바랍니다.`);
    }
    if (audience) {
        parts.push(`참여 권장 대상은 ${audience}입니다.`);
    }
    if (operatingHours) {
        parts.push(`상세 운영 시간은 ${operatingHours}입니다.`);
    }
    if (closedDays) {
        parts.push(`휴무일 정보는 ${closedDays}입니다.`);
    }
    if (facilities) {
        parts.push(`주변 편의 시설은 ${facilities} 정보를 포함하고 있습니다.`);
    }
    if (fees) {
        parts.push(`이용 요금 및 관련 정보는 ${fees} 기준입니다.`);
    }
    if (contact) {
        parts.push(`상세 연락처 및 예약 문의는 ${contact}에서 친절하게 상담 받으실 수 있습니다.`);
    }

    return parts.join(' ');
}

async function generate() {
    console.log('Generating static performance data...');
    try {
        const preferPublicData = shouldPreferPublicBaseline();
        console.log(`[Build Strategy] Input baseline: ${preferPublicData ? 'public/data' : 'src/data raw sources'}`);
        const performances = await getAllPerformances({ preferPublicData });
        const sourceVenues: Record<string, VenueRecord> = fs.existsSync(path.join(process.cwd(), 'src', 'data', 'venues.json'))
            ? JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src', 'data', 'venues.json'), 'utf8'))
            : {};
        Object.assign(sourceVenues, EXTRA_VENUE_RECORDS);

        // [Data Quality Override]
        // Manual fixes for specific items requested by user
        performances.forEach(p => {
            // 1. Hardcode specific festival posters
            if (p.title.includes('양평빙송어축제')) {
                p.posterUrl = '/images/posters/festivals/yangpyeong_ice_trout.png';
            } else if (p.title.includes('온천천 빛 축제')) {
                p.posterUrl = '/images/posters/festivals/oncheoncheon_light.png';
            } else if (p.title.includes('포천백운계곡 동장군축제')) {
                p.posterUrl = '/images/posters/festivals/pocheon_dongjanggun.jpg';
            }

            // 2. Fix Category for National Dance Company 2026 Festival
            if (p.title.includes('국립무용단 [2026 축제]')) {
                p.genre = '무용';
            }
        });

        // Overseas Filtering Logic (User Request)
        const KR_LAT_MIN = 33.0;
        const KR_LAT_MAX = 43.0;
        const KR_LNG_MIN = 124.0;
        const KR_LNG_MAX = 132.0;

        const isOverseas = (p: Performance) => {
            // 1. Specific title exclusion
            if (p.title.includes('일본 스페이스 일일캠프') || p.title.includes('JAXA츠크바우주센터')) return true;

            // 2. Address keywords
            const overseasKeywords = ['일본', '미국', '중국', '유럽', '괌', '대만', 'France', 'USA', 'Japan', 'China', 'Guam', 'Taiwan', 'New Taipei', '츠쿠바역'];
            if (overseasKeywords.some(kw => p.address?.includes(kw) || p.venue?.includes(kw))) return true;

            // 3. Coordinate check (if available)
            // Note: coordinates come from venues.json usually via p.venue mapping
            // In generate-performance-json, we have 'performances' array.
            // Let's check coordinates if they exist on the performance object (some sources have them)
            if (p.lat && p.lng) {
                if (p.lat < KR_LAT_MIN || p.lat > KR_LAT_MAX || p.lng < KR_LNG_MIN || p.lng > KR_LNG_MAX) return true;
            }

            return false;
        };

        // Filter out expired performances
        // Use a safe buffer (e.g., allow items ending yesterday to show until today's build runs, but 1 month ago is definitely out)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        applyTitleScheduleMetadata(performances, today);
        repairBranchVenueAssignments(performances, sourceVenues);

        const movieCount = 0;
        let ottCount = 0;
        let dateCount = 0;
        let seasonalCount = 0;

        const activePerformances = performances.filter(p => {
            // 0. EXCLUDE OTT from this specific JSON 
            // because they are loaded separately in the frontend (ott.json)
            // to avoid duplicates.
            if (p.genre === 'ott') {
                ottCount++;
                return false;
            }

            // Exclude Overseas Content
            if (isOverseas(p)) return false;
            if (isOutOfSeasonWinterLeisure(p, today)) {
                seasonalCount++;
                return false;
            }

            if (!p.date || p.date.trim() === '') return true; // Treat as active if no date (Museums/Activities)
            if (p.genre === 'movie') return true;

            const scheduleWindow = getScheduleWindow(p);
            if (scheduleWindow.end) {
                const endDate = new Date(scheduleWindow.end);
                endDate.setHours(23, 59, 59, 999);
                const isActive = endDate >= today;
                if (!isActive) {
                    dateCount++;
                    if (p.source === 'museum') console.log(`[DEBUG] Museum ${p.title} filtered by parsed schedule: ${p.date} (EndDate: ${endDate.toISOString()})`);
                }
                return isActive;
            }

            try {
                let endDate: Date | null = null;
                const d = p.date.replace(/\./g, '-'); // Normalize dots to dashes for better parsing

                if (d.includes('~')) {
                    const parts = d.split('~');
                    if (parts.length >= 2) {
                        let endStr = parts[1].trim();
                        // Clean up junk like "]" or " ("
                        endStr = endStr.split('[')[0].split('(')[0].trim();

                        // Handle "2026-01-04" or "26-01-04"
                        if (endStr.match(/^\d{2}-\d{2}-\d{2}$/)) {
                            endStr = '20' + endStr;
                        }

                        // Robust parsing for YYYYMMDD
                        if (endStr.match(/^\d{8}$/)) {
                            const y = parseInt(endStr.substring(0, 4));
                            const m = parseInt(endStr.substring(4, 6));
                            const dParts = parseInt(endStr.substring(6, 8));
                            endDate = new Date(y, m - 1, dParts);
                        } else {
                            endDate = new Date(endStr);
                        }
                    }
                } else if (d.trim() !== '') {
                    let endStr = d.trim();
                    endStr = endStr.split('[')[0].split('(')[0].trim();
                    if (endStr.match(/^\d{2}-\d{2}-\d{2}$/)) {
                        endStr = '20' + endStr;
                    }

                    if (endStr.match(/^\d{8}$/)) {
                        const y = parseInt(endStr.substring(0, 4));
                        const m = parseInt(endStr.substring(4, 6));
                        const dParts = parseInt(endStr.substring(6, 8));
                        endDate = new Date(y, m - 1, dParts);
                    } else {
                        endDate = new Date(endStr);
                    }
                }

                if (!endDate || isNaN(endDate.getTime())) {
                    return true;
                }

                // Set end date to end of day
                endDate.setHours(23, 59, 59, 999);
                const isActive = endDate >= today;
                if (!isActive) {
                    dateCount++;
                    if (p.source === 'museum') console.log(`[DEBUG] Museum ${p.title} filtered by date: ${p.date} (EndDate: ${endDate.toISOString()})`);
                }
                return isActive;

            } catch (error: unknown) {
                if (p.source === 'museum') console.log(`[DEBUG] Museum ${p.title} error in date parsing:`, error);
                return true;
            }
        });

        if (performances.some(p => p.source === 'museum')) {
             const museumRemained = activePerformances.filter(p => p.source === 'museum').length;
             console.log(`[DEBUG] Museum Items: Total ${performances.filter(p => p.source === 'museum').length}, Remaining After Filter: ${museumRemained}`);
        }

        console.log(`[Filtering Stats]`);
        console.log(`- Movies Filtered: ${movieCount}`);
        console.log(`- OTT Filtered: ${ottCount}`);
        console.log(`- Expired/Date Filtered: ${dateCount}`);
        console.log(`- Out-of-season Winter Leisure Filtered: ${seasonalCount}`);

        console.log(`Filtered ${performances.length - activePerformances.length} items (Expired or Duplicate Type).`);

        activePerformances.forEach((performance) => {
            if (!compactText(performance.description) && !compactText(performance.synopsis)) {
                performance.description = buildFallbackDescription(performance);
            }
            if (isLowValueGeneratedDescription(performance.description)) {
                performance.description = '';
            }
        });
        enrichFromSiblingItems(activePerformances);
        rehydrateMoviesFromCatalog(activePerformances);
        repairMissingLinks(activePerformances);
        repairBrokenLocalImages(activePerformances);
        normalizeImageFields(activePerformances);
        normalizeDuplicateTimeFields(activePerformances);
        repairKnownLocationOverrides(activePerformances);
        sanitizeWeakVenueIdentities(activePerformances);
        enrichVenueContextFromRecords(activePerformances, sourceVenues);
        applySourceTimestampFallbacks(activePerformances, buildSourceUpdatedAtMap());
        removeLowValueGeneratedDescriptions(activePerformances);

        // Sort by default (Date Ascending) to match previous API behavior
        const sorted = sortPerformancesForHomeFeed(activePerformances);
        const preliminaryVenueCanonicalizationReport = buildVenueCanonicalizationReport(
            sorted as Performance[],
            sourceVenues,
            new Date().toISOString(),
        );
        const coordinateRiskKeys = new Set(
            preliminaryVenueCanonicalizationReport.coordinateRiskGroups
                .map((group) => group.groupKey)
                .filter(Boolean)
        );
        const venueMasterSourceItems = (sorted as Performance[]).filter((performance) => performance.genre !== 'movie');
        const venueMasterBuild = buildVenueMaster(
            venueMasterSourceItems,
            sourceVenues,
            coordinateRiskKeys,
            new Date().toISOString(),
        );
        const venuePlaceCachePath = path.join(process.cwd(), 'src', 'data', 'venue-place-cache.json');
        const venuePlaceCache = readJsonIfExists<VenuePlaceCache>(venuePlaceCachePath, {});
        const activeVenueIds = new Set(venueMasterBuild.entries.map((entry) => entry.id));
        Object.keys(venuePlaceCache).forEach((venueId) => {
            if (!activeVenueIds.has(venueId)) {
                delete venuePlaceCache[venueId];
            }
        });
        venueMasterBuild.entries = applyVenuePlaceCache(venueMasterBuild.entries, venuePlaceCache);
        const venuePlaceMatchingReport = buildVenuePlaceMatchingReport(
            venueMasterBuild.entries,
            venuePlaceCache,
            getConfiguredVenuePlaceProviders(),
            new Date().toISOString(),
        );

        applyVenuePlaceContextToPerformances(sorted as Performance[], venueMasterBuild);

        // [New: Data Pruning for payload optimization]
        const pruned: PrunedPerformance[] = sorted.map((p) => {
            const rest = { ...(p as PrunablePerformance) };
            delete rest.posterUrl;
            // Also prune empty arrays/objects to save bytes
            if (Array.isArray(rest.cast) && rest.cast.length === 0) delete rest.cast;
            if (Array.isArray(rest.platforms) && rest.platforms.length === 0) delete rest.platforms;
            rest.source = p.source; // Keep the source for statistics
            return rest as PrunedPerformance;
        });

        const outputPath = path.join(process.cwd(), 'public', 'data', 'performances.json');

        // Ensure directory exists
        const dir = path.dirname(outputPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(outputPath, JSON.stringify(pruned));
        console.log(`Successfully generated ${pruned.length} items to ${outputPath}`);

        const performancePages = writePagedPayload(dir, 'pages', pruned);
        console.log(`Generated ${performancePages.pages.length} progressive performance pages to ${path.join(dir, 'pages')}`);

        const homeFeedPayloadPath = path.join(dir, 'home-feed.json');
        const homeFeedPayload = pruned.slice(0, HOME_FEED_LIMIT);
        fs.writeFileSync(homeFeedPayloadPath, JSON.stringify(homeFeedPayload));
        console.log(`Generated lightweight home feed (${homeFeedPayload.length} items) to ${homeFeedPayloadPath}`);

        const mapPayloadPath = path.join(dir, 'map-items.json');
        const mapPayload = pruned
            .map(buildMapPayloadItem)
            .filter((performance) => performance.lat && performance.lng);
        fs.writeFileSync(mapPayloadPath, JSON.stringify(mapPayload));
        console.log(`Generated lightweight map payload (${mapPayload.length} items) to ${mapPayloadPath}`);

        const mapVenuesPayloadPath = path.join(dir, 'map-venues.json');
        const mapVenuesPayload = buildMapVenuePayload(mapPayload);
        fs.writeFileSync(mapVenuesPayloadPath, JSON.stringify(mapVenuesPayload));
        console.log(`Generated venue-grouped map payload (${mapVenuesPayload.length} venues) to ${mapVenuesPayloadPath}`);

        // [New: Calendar Split Loading]
        const calendarDir = path.join(dir, 'calendar');
        fs.mkdirSync(calendarDir, { recursive: true });
        
                // Canonicalize region ids for all public payloads
        const prunedCanonical = pruned.map((item) => applyCanonicalRegion(item as any));
        // Use canonical list for all subsequent outputs
        pruned.length = 0;
        pruned.push(...prunedCanonical);

        const calendarPayload = pruned.map(buildCalendarPayloadItem);
        const monthlyChunks: Record<string, typeof calendarPayload> = {};
        
        calendarPayload.forEach(item => {
            const months = getMonthsForPerformance(item);
            months.forEach(month => {
                if (!monthlyChunks[month]) {
                    monthlyChunks[month] = [];
                }
                monthlyChunks[month].push(item);
            });
        });
        
        const monthsManifest: Record<string, number> = {};
        Object.entries(monthlyChunks).forEach(([month, items]) => {
            const chunkPath = path.join(calendarDir, `${month}.json`);
            fs.writeFileSync(chunkPath, JSON.stringify(items));
            monthsManifest[month] = items.length;
        });
        
        const manifestPath = path.join(calendarDir, 'manifest.json');
        const manifestContent = {
            totalItems: calendarPayload.length,
            months: monthsManifest
        };
        fs.writeFileSync(manifestPath, JSON.stringify(manifestContent));
        console.log(`Generated monthly calendar chunks in ${calendarDir}. Available months: ${Object.keys(monthsManifest).length}`);

        const calendarPayloadPath = path.join(dir, 'calendar-items.json');
        fs.writeFileSync(calendarPayloadPath, JSON.stringify(calendarPayload));
        console.log(`Generated fallback calendar-items.json (${calendarPayload.length} items) for compatibility.`);

        const categoryDataDir = path.join(dir, 'categories');
        fs.mkdirSync(categoryDataDir, { recursive: true });
        VALID_GENRE_SLUGS.forEach((slug) => {
            const genreFilter = getGenreFilterFromSlug(slug);
            const categoryItems = pruned.filter((performance) => (
                Array.isArray(genreFilter)
                    ? genreFilter.includes(performance.genre)
                    : performance.genre === genreFilter
            ));
            const categoryPath = path.join(categoryDataDir, `${slug}.json`);
            fs.writeFileSync(categoryPath, JSON.stringify(categoryItems));
            writePagedPayload(dir, path.join('category-pages', slug), categoryItems);
        });
        console.log(`Generated category-scoped and paged payloads to ${categoryDataDir}`);

        const versionPath = path.join(process.cwd(), 'public', 'version.txt');
        const version = process.env.GITHUB_SHA?.slice(0, 12) || `${Math.floor(Date.now() / 1000)}`;
        fs.writeFileSync(versionPath, `Version: ${version}\n`);
        console.log(`Updated version.txt to ${versionPath}`);

        const buildInfoPath = path.join(dir, 'build-info.json');
        const sourceCounts = pruned.reduce<Record<string, number>>((acc, performance) => {
            const source = performance.source || 'unknown';
            acc[source] = (acc[source] || 0) + 1;
            return acc;
        }, {});
        const genreCounts = pruned.reduce<Record<string, number>>((acc, performance) => {
            const genre = performance.genre || 'unknown';
            acc[genre] = (acc[genre] || 0) + 1;
            return acc;
        }, {});
        const qualitySummary = analyzeContentQuality(pruned, {
            checkedAt: new Date().toISOString(),
            hasLocalAsset: (assetPath) => {
                if (!assetPath || !assetPath.startsWith('/')) return false;
                const normalized = assetPath.replace(/^\/+/, '');
                return fs.existsSync(path.join(process.cwd(), 'public', normalized));
            },
        });
        const displayIntegritySummary = buildDisplayIntegrityReport(
            pruned as Performance[],
            fs.existsSync(path.join(process.cwd(), 'src', 'data', 'venues.json'))
                ? JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src', 'data', 'venues.json'), 'utf8'))
                : {},
            new Date().toISOString(),
        );
        const sourceFunnelReport = buildSourceFunnelReport(pruned as Performance[], new Date().toISOString());
        const sourceQualityOpportunitySummary = buildSourceQualityOpportunitySummary(pruned as Performance[], new Date().toISOString());
        const priceCoverageSummary = buildPriceCoverageSummary(pruned as Performance[], new Date().toISOString());
        const operationsSummary = buildOperationsSummary(new Date().toISOString());
        const venueCanonicalizationReport = buildVenueCanonicalizationReport(
            pruned as Performance[],
            sourceVenues,
            new Date().toISOString(),
        );
        const { sourceSummaries, sourceHealthSummary } = buildSourceSummaries(sourceCounts);
        const buildInfo = {
            generatedAt: new Date().toISOString(),
            version,
            itemCount: pruned.length,
            sourceCounts,
            genreCounts,
            qualitySummary,
            displayIntegritySummary,
            sourceSummaries,
            sourceHealthSummary,
            sourceFunnelSummary: sourceFunnelReport.summary,
            sourceQualityOpportunitySummary,
            venueCanonicalizationSummary: venueCanonicalizationReport.summary,
            venueMasterSummary: venueMasterBuild.report.summary,
            venuePlaceMatchingSummary: venuePlaceMatchingReport.summary,
            priceCoverageSummary,
            operationsSummary,
        };
        fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo));
        console.log(`Updated build-info.json to ${buildInfoPath}`);
        fs.writeFileSync(path.join(dir, 'data-integrity-report.json'), JSON.stringify(displayIntegritySummary));
        console.log(`Updated data-integrity-report.json to ${path.join(dir, 'data-integrity-report.json')}`);
        fs.writeFileSync(path.join(dir, 'source-funnel-report.json'), JSON.stringify(sourceFunnelReport));
        console.log(`Updated source-funnel-report.json to ${path.join(dir, 'source-funnel-report.json')}`);
        fs.writeFileSync(path.join(dir, 'source-quality-opportunities.json'), JSON.stringify(sourceQualityOpportunitySummary, null, 2));
        console.log(`Updated source-quality-opportunities.json to ${path.join(dir, 'source-quality-opportunities.json')}`);
        fs.writeFileSync(path.join(dir, 'venue-canonicalization-report.json'), JSON.stringify(venueCanonicalizationReport));
        console.log(`Updated venue-canonicalization-report.json to ${path.join(dir, 'venue-canonicalization-report.json')}`);
        fs.writeFileSync(path.join(dir, 'venue-master.json'), JSON.stringify(venueMasterBuild.entries));
        console.log(`Updated venue-master.json to ${path.join(dir, 'venue-master.json')}`);
        fs.writeFileSync(path.join(dir, 'venue-master-report.json'), JSON.stringify(venueMasterBuild.report));
        console.log(`Updated venue-master-report.json to ${path.join(dir, 'venue-master-report.json')}`);
        fs.writeFileSync(path.join(dir, 'venue-place-report.json'), JSON.stringify(venuePlaceMatchingReport, null, 2));
        console.log(`Updated venue-place-report.json to ${path.join(dir, 'venue-place-report.json')}`);

        // [New: Sync critical data files to public/data]
        const dataDir = path.join(process.cwd(), 'src', 'data');
        const filesToSync = ['cinemas.json', 'movies.json', 'ott.json', 'venues.json'];

        filesToSync.forEach(filename => {
            const srcPath = path.join(dataDir, filename);
            const destPath = path.join(dir, filename);

            if (fs.existsSync(srcPath)) {
                if (filename === 'venues.json') {
                    // Smart Pruning for venues.json
                    const venues = JSON.parse(fs.readFileSync(srcPath, 'utf8')) as Record<string, VenueRecord>;
                    const usedVenueNames = new Set(pruned.map(p => p.venue));
                    const prunedVenues: Record<string, VenueRecord> = {};

                    Object.entries(venues).forEach(([key, v]) => {
                        if (usedVenueNames.has(key)) {
                            const { name, ...rest } = v;
                            // Only keep name if it differs from the key
                            if (name && name !== key && isCompatibleVenueDisplayName(key, name)) {
                                rest.name = name;
                            }
                            prunedVenues[key] = rest;
                        }
                    });

                    fs.writeFileSync(destPath, JSON.stringify(prunedVenues));
                    console.log(`Optimized venues.json to ${destPath} (Kept ${Object.keys(prunedVenues).length}/${Object.keys(venues).length} used venues)`);
                } else {
                    fs.copyFileSync(srcPath, destPath);
                    console.log(`Synced ${filename} to ${destPath}`);
                }
            } else {
                console.warn(`Warning: ${filename} not found in src/data, skipping sync.`);
            }
        });

    } catch (error: unknown) {
        console.error('Error generating performance data:', error);
        process.exit(1);
    }
}

generate();
