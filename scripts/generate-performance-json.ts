
import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { getAllPerformances } from '../src/lib/performance-data';
import type {
    DataSourceFreshness,
    DataSourceHealthSummary,
    DataSourceSummary
} from '../src/lib/build-info';
import { getExternalContentLink } from '../src/lib/performance-links';
import { getScheduleWindow, sortPerformancesForHomeFeed } from '../src/lib/performance-filter';
import { SOURCE_REGISTRY } from '../src/lib/source-registry';
import { getGenreFilterFromSlug } from '../src/lib/genre-availability';
import { VALID_GENRE_SLUGS } from '../src/lib/constants';
import type { Performance } from '../src/types';
import { analyzeContentQuality } from './utils/content-quality';
import { buildDisplayIntegrityReport } from './utils/display-integrity';
import { buildSourceFunnelReport } from './utils/source-funnel';
import { buildVenueCanonicalizationReport } from './utils/venue-canonicalization';
import { buildVenueMaster } from './utils/venue-master';
import { applyVenuePlaceCache, buildVenuePlaceMatchingReport, type VenuePlaceCache, type VenuePlaceProvider } from './utils/venue-place-matching';
import { isCompatibleVenueDisplayName } from './utils/venue-name-quality';

type PrunablePerformance = Performance & {
    platforms?: string[];
};

type PrunedPerformance = Omit<PrunablePerformance, 'posterUrl'>;

type VenueRecord = {
    name?: string;
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
    soccer: '/images/soccer_poster.png',
    baseball: '/images/fallbacks/baseball.jpg',
    basketball: '/images/fallbacks/basketball.jpg',
    volleyball: '/images/fallbacks/volleyball.jpg',
    handball: '/images/fallbacks/handball.jpg',
    museum: '/images/fallbacks/museum.jpg',
    exhibition: '/images/fallbacks/exhibition.jpg',
    classic_tradition: '/images/fallbacks/classic.jpg',
    activity: '/images/fallbacks/activity.jpg',
    movie: '/images/fallbacks/movie.svg',
    default: '/images/placeholder.png'
};

const SOURCE_FRESH_DAYS = 3;
const SOURCE_STALE_DAYS = 30;
const WINTER_LEISURE_TERMS = ['리프트권', '스키장', '스노우파크', '눈썰매', '눈썰매장', '스키렌탈', '보드렌탈', '렌탈샵', '슬로프'];
const WINTER_LEISURE_FALSE_POSITIVE_TERMS = ['차이콥스키', '마이스키', '위스키', '트바르코프스키', '패들보드', '플레이팅보드'];

function compactText(value?: string) {
    return value?.replace(/\s+/g, ' ').trim() || '';
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
        if (!hasUsableLink(performance.link) && hasUsableLink(catalogItem.link)) {
            performance.link = catalogItem.link;
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
        if (!compactText(performance.description) && compactText(donor.description)) {
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
        const operatingHours = compactText(performance.operatingHours);
        const performanceTime = compactText(performance.performanceTime);
        if (!operatingHours || !performanceTime || operatingHours !== performanceTime) return;

        if (performance.genre === 'tourism') {
            performance.performanceTime = '';
            return;
        }

        performance.operatingHours = '';
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

function getSourceAgeDays(updatedAt: Date) {
    const ageMs = Date.now() - updatedAt.getTime();
    return Math.max(0, Math.floor(ageMs / (1000 * 60 * 60 * 24)));
}

function getTrackedFileUpdatedAt(relativePath: string) {
    const absolutePath = path.join(process.cwd(), relativePath);
    if (!fs.existsSync(absolutePath)) return null;

    try {
        const gitUpdatedAt = execFileSync('git', ['log', '-1', '--format=%cI', '--', relativePath], {
            cwd: process.cwd(),
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();

        if (gitUpdatedAt) {
            const parsed = new Date(gitUpdatedAt);
            if (!Number.isNaN(parsed.getTime())) {
                return parsed;
            }
        }
    } catch {
        // Fall through to filesystem mtime when git metadata is unavailable.
    }

    return fs.statSync(absolutePath).mtime;
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
        parts.push(`${performance.homeTeam}와 ${performance.awayTeam}의 ${genreLabel}입니다.`);
    } else if (performance.genre === 'class') {
        parts.push(`${title}는 ${venue || '지정 장소'}에서 진행되는 ${genreLabel}입니다.`);
    } else if (performance.genre === 'activity') {
        parts.push(`${title}는 ${venue || '현장'}에서 즐길 수 있는 ${genreLabel}입니다.`);
    } else if (performance.genre === 'museum' || performance.genre === 'exhibition') {
        parts.push(`${title}는 ${venue || '전시 공간'}에서 만날 수 있는 ${genreLabel}입니다.`);
    } else if (performance.genre === 'tourism') {
        parts.push(`${title}는 방문을 고려해볼 만한 ${genreLabel}입니다.`);
    } else {
        parts.push(`${title}는 ${venue || '현장'}에서 진행되는 ${genreLabel}입니다.`);
    }

    if (subGenre && performance.genre !== 'movie') {
        parts.push(`분류는 ${subGenre}입니다.`);
    }
    if (date && !['상시', 'OPEN RUN'].includes(date)) {
        parts.push(`일정은 ${date} 기준입니다.`);
    }
    if (address) {
        parts.push(`위치는 ${address}입니다.`);
    }
    if (audience) {
        parts.push(`추천 대상은 ${audience}입니다.`);
    }
    if (operatingHours) {
        parts.push(`운영 시간은 ${operatingHours}입니다.`);
    }
    if (closedDays) {
        parts.push(`휴무 정보는 ${closedDays}입니다.`);
    }
    if (facilities) {
        parts.push(`현장 편의 정보는 ${facilities}입니다.`);
    }
    if (fees) {
        parts.push(`이용 정보는 ${fees} 기준입니다.`);
    }
    if (contact) {
        parts.push(`문의는 ${contact}에서 확인할 수 있습니다.`);
    }

    return parts.join(' ');
}

async function generate() {
    console.log('Generating static performance data...');
    try {
        const preferPublicData = shouldPreferPublicBaseline();
        console.log(`[Build Strategy] Input baseline: ${preferPublicData ? 'public/data' : 'src/data raw sources'}`);
        const performances = await getAllPerformances({ preferPublicData });

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
            const overseasKeywords = ['일본', '미국', '중국', '유럽', 'France', 'USA', 'Japan', 'China', '츠쿠바역'];
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
        });
        enrichFromSiblingItems(activePerformances);
        rehydrateMoviesFromCatalog(activePerformances);
        repairMissingLinks(activePerformances);
        repairBrokenLocalImages(activePerformances);
        normalizeDuplicateTimeFields(activePerformances);
        repairKnownLocationOverrides(activePerformances);

        // Sort by default (Date Ascending) to match previous API behavior
        const sorted = sortPerformancesForHomeFeed(activePerformances);
        const sourceVenues = fs.existsSync(path.join(process.cwd(), 'src', 'data', 'venues.json'))
            ? JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src', 'data', 'venues.json'), 'utf8'))
            : {};
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
        venueMasterBuild.entries = applyVenuePlaceCache(venueMasterBuild.entries, venuePlaceCache);
        const venuePlaceMatchingReport = buildVenuePlaceMatchingReport(
            venueMasterBuild.entries,
            venuePlaceCache,
            getConfiguredVenuePlaceProviders(),
            new Date().toISOString(),
        );

        sorted.forEach((performance) => {
            const venueMasterMatch = venueMasterBuild.performanceVenueIndex[performance.id];
            if (!venueMasterMatch) return;

            performance.venueCanonicalId = venueMasterMatch.canonicalId;
            if (venueMasterMatch.hallName) {
                performance.venueHallName = venueMasterMatch.hallName;
            }
        });

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
        });
        console.log(`Generated category-scoped payloads to ${categoryDataDir}`);

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
            venueCanonicalizationSummary: venueCanonicalizationReport.summary,
            venueMasterSummary: venueMasterBuild.report.summary,
            venuePlaceMatchingSummary: venuePlaceMatchingReport.summary,
        };
        fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo));
        console.log(`Updated build-info.json to ${buildInfoPath}`);
        fs.writeFileSync(path.join(dir, 'data-integrity-report.json'), JSON.stringify(displayIntegritySummary));
        console.log(`Updated data-integrity-report.json to ${path.join(dir, 'data-integrity-report.json')}`);
        fs.writeFileSync(path.join(dir, 'source-funnel-report.json'), JSON.stringify(sourceFunnelReport));
        console.log(`Updated source-funnel-report.json to ${path.join(dir, 'source-funnel-report.json')}`);
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
