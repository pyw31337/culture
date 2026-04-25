
import fs from 'fs';
import path from 'path';
import { getAllPerformances } from '../src/lib/performance-data';
import type {
    DataSourceFreshness,
    DataSourceHealthSummary,
    DataSourceSummary
} from '../src/lib/build-info';
import { getExternalContentLink } from '../src/lib/performance-links';
import { sortPerformances } from '../src/lib/performance-filter';
import { SOURCE_REGISTRY } from '../src/lib/source-registry';
import type { Performance } from '../src/types';
import { analyzeContentQuality } from './utils/content-quality';

type PrunablePerformance = Performance & {
    platforms?: string[];
};

type PrunedPerformance = Omit<PrunablePerformance, 'posterUrl'>;

type VenueRecord = {
    name?: string;
} & Record<string, unknown>;

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
    movie: '/images/kbo-thumbnail.png',
    default: '/images/placeholder.png'
};

const SOURCE_FRESH_DAYS = 3;
const SOURCE_STALE_DAYS = 30;

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
        if (!performance.image || !performance.image.startsWith('/')) return;

        const normalized = performance.image.replace(/^\/+/, '');
        const absolutePath = path.join(process.cwd(), 'public', normalized);
        if (fs.existsSync(absolutePath)) return;

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

function getSourceAgeDays(updatedAt: Date) {
    const ageMs = Date.now() - updatedAt.getTime();
    return Math.max(0, Math.floor(ageMs / (1000 * 60 * 60 * 24)));
}

function getSourceFreshness(updatedAt: Date | null, itemCount: number, seasonal: boolean): DataSourceFreshness {
    if (seasonal && itemCount === 0) return 'offseason';
    if (!updatedAt) return 'unknown';

    const ageDays = getSourceAgeDays(updatedAt);
    if (ageDays <= SOURCE_FRESH_DAYS) return 'fresh';
    if (ageDays <= SOURCE_STALE_DAYS) return 'aging';
    return 'stale';
}

function buildSourceSummaries(sourceCounts: Record<string, number>): {
    sourceSummaries: DataSourceSummary[];
    sourceHealthSummary: DataSourceHealthSummary;
} {
    const sourceSummaries = SOURCE_REGISTRY
        .map<DataSourceSummary>((entry) => {
            const absolutePath = path.join(process.cwd(), 'src', 'data', entry.file);
            const updatedAt = fs.existsSync(absolutePath) ? fs.statSync(absolutePath).mtime : null;
            const itemCount = sourceCounts[entry.key] || 0;

            return {
                key: entry.key,
                label: entry.label,
                file: entry.file,
                itemCount,
                updatedAt: updatedAt ? updatedAt.toISOString() : null,
                ageDays: updatedAt ? getSourceAgeDays(updatedAt) : null,
                freshness: getSourceFreshness(updatedAt, itemCount, entry.seasonal === true),
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
        const absolutePath = path.join(process.cwd(), 'src', 'data', entry.file);
        if (!fs.existsSync(absolutePath)) return latest;

        const updatedAt = fs.statSync(absolutePath).mtime;
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

            if (!p.date || p.date.trim() === '') return true; // Treat as active if no date (Museums/Activities)

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
                // Bypass date check for movies
                if (p.genre === 'movie') return true;

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

        console.log(`Filtered ${performances.length - activePerformances.length} items (Expired or Duplicate Type).`);

        activePerformances.forEach((performance) => {
            if (!compactText(performance.description) && !compactText(performance.synopsis)) {
                performance.description = buildFallbackDescription(performance);
            }
        });
        enrichFromSiblingItems(activePerformances);
        repairMissingLinks(activePerformances);
        repairBrokenLocalImages(activePerformances);

        // Sort by default (Date Ascending) to match previous API behavior
        const sorted = sortPerformances(activePerformances, 'all');

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
        const { sourceSummaries, sourceHealthSummary } = buildSourceSummaries(sourceCounts);
        const buildInfo = {
            generatedAt: new Date().toISOString(),
            version,
            itemCount: pruned.length,
            sourceCounts,
            genreCounts,
            qualitySummary,
            sourceSummaries,
            sourceHealthSummary,
        };
        fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo));
        console.log(`Updated build-info.json to ${buildInfoPath}`);

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
                            if (name && name !== key) {
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
