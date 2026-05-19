import type { DiscoveryContextId, FavoriteVenuePreference, Performance } from '@/types';
import type { DataBuildInfo } from '@/lib/build-info';
import { favoriteVenueMatchesIdentity } from './favorite-venues';
import { findMatchedKeyword } from './keyword-match';
import { extractFirstPrice } from './utils';
import {
    getDateDiffDays,
    getFeedScore,
    getKoreanReferenceDate,
    getScheduleWindow,
    sortPerformancesForHomeFeed,
} from './performance-filter';

interface DiscoveryActivity {
    viewedGenres: Record<string, number>;
    viewedItems: string[];
    itemClicks: Record<string, number>;
    lastActive: number;
}

interface DiscoverySignals {
    likedIds: string[];
    favoriteVenues: FavoriteVenuePreference[];
    savedKeywords: string[];
    activity: DiscoveryActivity;
    buildInfo?: DataBuildInfo | null;
}

export interface DiscoveryContextDefinition {
    id: DiscoveryContextId;
    label: string;
    description: string;
}

export const DISCOVERY_CONTEXTS: DiscoveryContextDefinition[] = [
    { id: 'all', label: '전체', description: '전체 흐름을 그대로 보여드려요.' },
    { id: 'today', label: '오늘', description: '오늘 바로 가기 좋은 콘텐츠만 모았습니다.' },
    { id: 'this_weekend', label: '이번 주말', description: '다가오는 주말에 보기 좋은 일정만 골랐어요.' },
    { id: 'indoor', label: '실내', description: '날씨 부담이 적은 실내 콘텐츠 위주로 정리했어요.' },
    { id: 'with_kids', label: '아이와', description: '가족, 키즈, 전체관람가 중심으로 모았습니다.' },
    { id: 'date_night', label: '데이트', description: '둘이서 보기 좋은 감상형 콘텐츠를 먼저 보여드려요.' },
    { id: 'under_10000', label: '1만원 이하', description: '가볍게 즐길 수 있는 가격대부터 찾을 수 있어요.' },
    { id: 'ending_soon', label: '곧 종료', description: '놓치기 전에 챙기면 좋은 일정 위주입니다.' },
];

const INDOOR_GENRES = new Set(['movie', 'musical', 'play', 'concert', 'classic_tradition', 'exhibition', 'museum', 'class']);
const DATE_GENRES = new Set(['movie', 'musical', 'play', 'concert', 'classic_tradition', 'exhibition']);
const SOLO_GENRES = new Set(['movie', 'exhibition', 'museum', 'classic_tradition', 'class']);
const KIDS_KEYWORDS = ['키즈', '어린이', '아이와', '가족', '패밀리', '유아', '초등', '아동', '미취학', '주니어', '패밀리쇼'];
const INDOOR_KEYWORDS = ['실내', '뮤지엄', '미술관', '박물관', '아트홀', '전시관', '센터', '공연장', '극장'];
const DATE_KEYWORDS = ['데이트', '로맨스', '야경', '음악회', '콘서트', '전시', '영화'];
const SOLO_KEYWORDS = ['사색', '혼자', '전시', '영화', '클래식', '뮤지엄'];

const normalizeText = (value?: string | null) => (value || '').replace(/\s+/g, '').toLowerCase().normalize('NFC');

function buildDiscoveryText(performance: Performance) {
    return normalizeText([
        performance.title,
        performance.venue,
        performance.genre,
        performance.subGenre,
        performance.description,
        performance.targetAudience,
        performance.address,
        performance.region,
        performance.district,
        performance.ageRating,
        performance.age,
    ]
        .filter(Boolean)
        .join(' '));
}

function addDays(date: Date, days: number) {
    const clone = new Date(date.getTime());
    clone.setDate(clone.getDate() + days);
    return clone;
}

function sameKoreanDay(a: Date, b: Date) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

function getWeekendWindow(referenceDate: Date) {
    const day = referenceDate.getDay();
    const diffToSaturday = (6 - day + 7) % 7;
    const saturday = addDays(referenceDate, diffToSaturday);
    const sunday = addDays(saturday, 1);
    return { start: saturday, end: sunday };
}

function overlapsWindow(performance: Performance, start: Date, end: Date) {
    const schedule = getScheduleWindow(performance);
    if (!schedule.start || !schedule.end) return false;
    return schedule.start.getTime() <= end.getTime() && schedule.end.getTime() >= start.getTime();
}

function isToday(performance: Performance, referenceDate: Date) {
    return overlapsWindow(performance, referenceDate, referenceDate);
}

function isThisWeekend(performance: Performance, referenceDate: Date) {
    const weekend = getWeekendWindow(referenceDate);
    return overlapsWindow(performance, weekend.start, weekend.end);
}

function isEndingSoon(performance: Performance, referenceDate: Date) {
    const schedule = getScheduleWindow(performance);
    if (!schedule.end) return false;
    const daysUntilEnd = getDateDiffDays(schedule.end, referenceDate);
    return daysUntilEnd >= 0 && daysUntilEnd <= 7;
}

function getNumericPrice(performance: Performance) {
    const extracted = extractFirstPrice(performance.price || performance.priceDetail || '');
    if (!extracted) return null;
    if (extracted.price === '무료') return 0;
    if (typeof extracted.price !== 'string' || !extracted.price.trim()) return null;
    const numeric = Number(extracted.price.replace(/[^\d]/g, ''));
    return Number.isFinite(numeric) ? numeric : null;
}

function getBudgetTag(performance: Performance) {
    const price = getNumericPrice(performance);
    if (price === 0) return '무료';
    if (price === null) return null;
    if (price <= 10000) return '1만원 이하';
    if (price <= 30000) return '3만원 이하';
    if (price <= 50000) return '5만원 이하';
    return null;
}

function includesAnyKeyword(source: string, keywords: string[]) {
    return keywords.some((keyword) => source.includes(normalizeText(keyword)));
}

function isKidFriendly(performance: Performance) {
    const text = buildDiscoveryText(performance);
    if (performance.ageRating?.includes('전체') || performance.age?.includes('전체')) return true;
    return includesAnyKeyword(text, KIDS_KEYWORDS);
}

function isIndoor(performance: Performance) {
    if (INDOOR_GENRES.has(performance.genre)) return true;
    const text = buildDiscoveryText(performance);
    return includesAnyKeyword(text, INDOOR_KEYWORDS);
}

function isDateNightFriendly(performance: Performance) {
    if (DATE_GENRES.has(performance.genre)) return true;
    const text = buildDiscoveryText(performance);
    return includesAnyKeyword(text, DATE_KEYWORDS);
}

function isSoloFriendly(performance: Performance) {
    if (SOLO_GENRES.has(performance.genre)) return true;
    const text = buildDiscoveryText(performance);
    return includesAnyKeyword(text, SOLO_KEYWORDS);
}

function isUpdatedToday(performance: Performance, buildInfo?: DataBuildInfo | null, referenceDate?: Date) {
    const baseDate = referenceDate ?? getKoreanReferenceDate();
    const raw = performance.statsCollectedAt || buildInfo?.generatedAt;
    if (!raw) return false;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return false;
    return sameKoreanDay(date, baseDate);
}

function dedupeTags(values: (string | null | undefined)[]) {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const value of values) {
        if (!value) continue;
        if (seen.has(value)) continue;
        seen.add(value);
        result.push(value);
    }

    return result;
}

export function matchesDiscoveryContext(
    performance: Performance,
    contextId: DiscoveryContextId,
    referenceDate: Date = getKoreanReferenceDate()
) {
    switch (contextId) {
        case 'all':
            return true;
        case 'today':
            return isToday(performance, referenceDate);
        case 'this_weekend':
            return isThisWeekend(performance, referenceDate);
        case 'indoor':
            return isIndoor(performance);
        case 'with_kids':
            return isKidFriendly(performance);
        case 'date_night':
            return isDateNightFriendly(performance);
        case 'under_10000': {
            const price = getNumericPrice(performance);
            return price !== null && price <= 10000;
        }
        case 'ending_soon':
            return isEndingSoon(performance, referenceDate);
        default:
            return true;
    }
}

export function filterByDiscoveryContext(
    performances: Performance[],
    contextId: DiscoveryContextId,
    referenceDate: Date = getKoreanReferenceDate()
) {
    if (contextId === 'all') return performances;
    return performances.filter((performance) => matchesDiscoveryContext(performance, contextId, referenceDate));
}

function buildGenreAffinityWeights(performances: Performance[], likedIds: string[], activity: DiscoveryActivity) {
    const weights: Record<string, number> = { ...activity.viewedGenres };
    const performanceById = new Map(performances.map((performance) => [performance.id, performance]));

    likedIds.forEach((id) => {
        const liked = performanceById.get(id);
        if (!liked) return;
        weights[liked.genre] = (weights[liked.genre] || 0) + 5;
    });

    return weights;
}

export function decoratePerformanceForDiscovery(
    performance: Performance,
    signals: DiscoverySignals,
    genreAffinityWeights: Record<string, number>,
    referenceDate: Date = getKoreanReferenceDate()
): Performance {
    const matchedKeyword = findMatchedKeyword(performance, signals.savedKeywords);
    const isFavoriteVenue = signals.favoriteVenues.some((favoriteVenue) =>
        favoriteVenueMatchesIdentity(favoriteVenue, {
            venueName: performance.venue,
            venueKey: performance.venueKey,
            locationKey: performance.locationKey,
        })
    );
    const recommendationReasons = dedupeTags([
        matchedKeyword ? `#${matchedKeyword}` : null,
        isFavoriteVenue ? '찜한 공연장' : null,
        (genreAffinityWeights[performance.genre] || 0) >= 4 ? '자주 보는 장르' : null,
        isToday(performance, referenceDate) ? '오늘 보기 좋아요' : null,
        isThisWeekend(performance, referenceDate) ? '이번 주말' : null,
        isEndingSoon(performance, referenceDate) ? '곧 종료' : null,
        isUpdatedToday(performance, signals.buildInfo, referenceDate) ? '오늘 수집' : null,
        isIndoor(performance) ? '실내' : null,
    ]).slice(0, 3);

    const comparisonTags = dedupeTags([
        isKidFriendly(performance) ? '아이와' : null,
        isDateNightFriendly(performance) ? '데이트' : null,
        isSoloFriendly(performance) ? '혼자도 좋아요' : null,
        isIndoor(performance) ? '실내' : null,
        getBudgetTag(performance),
        isEndingSoon(performance, referenceDate) ? '곧 종료' : null,
        isThisWeekend(performance, referenceDate) ? '이번 주말' : null,
    ]).slice(0, 3);

    const matchedDiscoveryContexts = DISCOVERY_CONTEXTS
        .filter((context) => context.id !== 'all' && matchesDiscoveryContext(performance, context.id, referenceDate))
        .map((context) => context.id);

    return {
        ...performance,
        matchedKeyword: matchedKeyword || performance.matchedKeyword,
        recommendationReasons,
        comparisonTags,
        matchedDiscoveryContexts,
    };
}

export function buildPersonalizedRecommendations(
    performances: Performance[],
    signals: DiscoverySignals,
    limit = 12
) {
    const referenceDate = getKoreanReferenceDate();
    const ranked = sortPerformancesForHomeFeed(performances);
    const performanceById = new Map(performances.map((performance) => [performance.id, performance]));
    const genreAffinityWeights = buildGenreAffinityWeights(performances, signals.likedIds, signals.activity);

    const scored = ranked.map((performance) => {
        const matchedKeyword = findMatchedKeyword(performance, signals.savedKeywords);
        const favoriteVenueBoost = signals.favoriteVenues.some((favoriteVenue) =>
            favoriteVenueMatchesIdentity(favoriteVenue, {
                venueName: performance.venue,
                venueKey: performance.venueKey,
                locationKey: performance.locationKey,
            })
        ) ? 18 : 0;
        const keywordBoost = matchedKeyword ? 24 : 0;
        const genreBoost = (genreAffinityWeights[performance.genre] || 0) * 4;
        const recencyBoost = isToday(performance, referenceDate) ? 20 : isThisWeekend(performance, referenceDate) ? 14 : 0;
        const endingBoost = isEndingSoon(performance, referenceDate) ? 10 : 0;
        const clickPenalty = Math.min(signals.activity.itemClicks?.[performance.id] || 0, 4) * 5;
        const viewedPenalty = signals.activity.viewedItems?.includes(performance.id) ? 10 : 0;
        const likeBoost = signals.likedIds.includes(performance.id) ? 8 : 0;
        const basedOnLikedVenue = signals.likedIds.reduce((score, id) => {
            const liked = performanceById.get(id);
            if (!liked) return score;
            const sameVenueIdentity = (liked.locationKey || liked.venueKey || liked.venue) === (performance.locationKey || performance.venueKey || performance.venue);
            return sameVenueIdentity ? score + 6 : score;
        }, 0);

        return {
            performance,
            score:
                getFeedScore(performance, referenceDate) +
                favoriteVenueBoost +
                keywordBoost +
                genreBoost +
                recencyBoost +
                endingBoost +
                likeBoost +
                basedOnLikedVenue -
                clickPenalty -
                viewedPenalty,
        };
    });

    const sorted = scored.sort((a, b) => b.score - a.score).map(({ performance }) => performance);
    const selected: Performance[] = [];
    const seen = new Set<string>();
    const genreCounts = new Map<string, number>();
    const venueCounts = new Map<string, number>();

    for (const performance of sorted) {
        if (selected.length >= limit) break;
        if (seen.has(performance.id)) continue;

        const sameGenreCount = genreCounts.get(performance.genre) || 0;
        const venueIdentity = performance.locationKey || performance.venueKey || performance.venue;
        const sameVenueCount = venueCounts.get(venueIdentity) || 0;

        if (selected.length < 6 && sameGenreCount >= 2) continue;
        if (selected.length < 6 && sameVenueCount >= 1) continue;

        selected.push(performance);
        seen.add(performance.id);
        genreCounts.set(performance.genre, sameGenreCount + 1);
        venueCounts.set(venueIdentity, sameVenueCount + 1);
    }

    if (selected.length < limit) {
        for (const performance of sorted) {
            if (selected.length >= limit) break;
            if (seen.has(performance.id)) continue;
            selected.push(performance);
            seen.add(performance.id);
        }
    }

    return selected.map((performance) => decoratePerformanceForDiscovery(performance, signals, genreAffinityWeights, referenceDate));
}

export function buildCuratedDiscoveryItems(
    performances: Performance[],
    signals: DiscoverySignals,
    limit = 18
) {
    const referenceDate = getKoreanReferenceDate();
    const genreAffinityWeights = buildGenreAffinityWeights(performances, signals.likedIds, signals.activity);
    const ranked = sortPerformancesForHomeFeed(performances);
    const selected: Performance[] = [];
    const seen = new Set<string>();
    const genreCounts = new Map<string, number>();
    const venueCounts = new Map<string, number>();

    for (const performance of ranked) {
        if (selected.length >= limit) break;
        if (seen.has(performance.id)) continue;

        const venueIdentity = performance.locationKey || performance.venueKey || performance.venue;
        const sameGenreCount = genreCounts.get(performance.genre) || 0;
        const sameVenueCount = venueCounts.get(venueIdentity) || 0;

        if (selected.length < 8 && sameGenreCount >= 1) continue;
        if (selected.length < 10 && sameVenueCount >= 1) continue;
        if (selected.length < 16 && sameGenreCount >= 2) continue;

        selected.push(performance);
        seen.add(performance.id);
        genreCounts.set(performance.genre, sameGenreCount + 1);
        venueCounts.set(venueIdentity, sameVenueCount + 1);
    }

    if (selected.length < limit) {
        for (const performance of ranked) {
            if (selected.length >= limit) break;
            if (seen.has(performance.id)) continue;
            selected.push(performance);
            seen.add(performance.id);
        }
    }

    return selected.map((performance) => decoratePerformanceForDiscovery(performance, signals, genreAffinityWeights, referenceDate));
}

export function getDiscoveryContextById(contextId: DiscoveryContextId) {
    return DISCOVERY_CONTEXTS.find((context) => context.id === contextId) || DISCOVERY_CONTEXTS[0];
}
