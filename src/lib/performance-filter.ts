
import { Performance } from '@/types';
import { isChoseongMatch } from './hangul';
import { REGIONS } from './constants';
import { getRepresentativeVenueInfoForName, resolveVenueInfoForPerformance } from './location-display';
import { getDistanceFromLatLonInKm } from './utils';

// Define Venue Interface since we import JSON directly
interface Venue {
    name?: string;
    address?: string;
    district?: string;
    lat?: number | null;
    lng?: number | null;
    mapped_region_id?: string;
}

const KOREA_TIMEZONE = 'Asia/Seoul';
const WINTER_LEISURE_KEYWORDS = ['눈썰매', '리프트권', '스키장', '스노우파크', '스키렌탈', '보드렌탈', '렌탈샵', '슬로프'];
const WINTER_FALSE_POSITIVE_KEYWORDS = ['차이콥스키', '마이스키', '위스키', '트바르코프스키', '패들보드', '플레이팅보드'];
const SUMMER_KEYWORDS = ['워터파크', '수영장', '풀파티', '해수욕', '서핑', '물놀이', '계곡', '래프팅'];
const SPRING_KEYWORDS = ['벚꽃', '봄꽃', '유채꽃'];
const AUTUMN_KEYWORDS = ['단풍', '가을꽃', '억새'];

export function getKoreanReferenceDate() {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: KOREA_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });

    const parts = formatter.formatToParts(new Date());
    const getPart = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
    return new Date(`${getPart('year')}-${getPart('month')}-${getPart('day')}T12:00:00+09:00`);
}

function getKoreanDaySalt(referenceDate: Date) {
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: KOREA_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });

    return formatter.format(referenceDate);
}

function hashString(value: string) {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
        hash = (hash << 5) - hash + value.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function toMiddayDate(year: number, month: number, day: number) {
    return new Date(`${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T12:00:00+09:00`);
}

export function extractScheduleDates(performance: Pick<Performance, 'date' | 'dateRaw'>) {
    const source = [performance.dateRaw, performance.date]
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .join(' | ');

    if (!source) return [] as Date[];

    const normalized = source
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\[[^\]]*\]/g, ' ')
        .replace(/년/g, '.')
        .replace(/월/g, '.')
        .replace(/일/g, ' ')
        .replace(/\s+/g, ' ');

    const timestamps = new Set<number>();
    const dates: Date[] = [];

    const pushDate = (year: number, month: number, day: number) => {
        if (!year || !month || !day) return;
        const date = toMiddayDate(year, month, day);
        if (Number.isNaN(date.getTime())) return;
        if (timestamps.has(date.getTime())) return;
        timestamps.add(date.getTime());
        dates.push(date);
    };

    const fullYearPattern = /(20\d{2})[.\-/ ]+(\d{1,2})[.\-/ ]+(\d{1,2})/g;
    const shortYearPattern = /(^|[^\d])(\d{2})[.\-/ ]+(\d{1,2})[.\-/ ]+(\d{1,2})(?!\d)/g;
    const compactPattern = /\b(20\d{2})(\d{2})(\d{2})\b/g;

    let match: RegExpExecArray | null;
    while ((match = fullYearPattern.exec(normalized)) !== null) {
        pushDate(Number(match[1]), Number(match[2]), Number(match[3]));
    }

    while ((match = shortYearPattern.exec(normalized)) !== null) {
        pushDate(2000 + Number(match[2]), Number(match[3]), Number(match[4]));
    }

    while ((match = compactPattern.exec(normalized)) !== null) {
        pushDate(Number(match[1]), Number(match[2]), Number(match[3]));
    }

    return dates.sort((a, b) => a.getTime() - b.getTime());
}

export function getScheduleWindow(performance: Pick<Performance, 'date' | 'dateRaw'>) {
    const dates = extractScheduleDates(performance);
    if (dates.length === 0) {
        return { start: null as Date | null, end: null as Date | null };
    }

    return {
        start: dates[0],
        end: dates[dates.length - 1],
    };
}

export function getDateDiffDays(target: Date, reference: Date) {
    const ms = target.getTime() - reference.getTime();
    return Math.round(ms / (1000 * 60 * 60 * 24));
}

function includesSeasonKeyword(text: string, keywords: string[]) {
    return keywords.some((keyword) => {
        const target = keyword === '물놀이'
            ? text.replace(/사물놀이/g, '')
            : text;
        return target.includes(keyword);
    });
}

function includesWinterLeisureKeyword(text: string) {
    const target = WINTER_FALSE_POSITIVE_KEYWORDS.reduce((acc, keyword) => acc.replaceAll(keyword, ''), text);
    if (WINTER_LEISURE_KEYWORDS.some((keyword) => target.includes(keyword))) return true;
    if (target.includes('스키') && /(리조트|렌탈|강습|슬로프|스키학교|스키\/보드)/.test(target)) return true;
    if (target.includes('보드') && /(스노우|스키|렌탈)/.test(target)) return true;
    return false;
}

function getSeasonalPenalty(performance: Pick<Performance, 'title' | 'venue' | 'genre' | 'description' | 'subGenre'>, referenceDate: Date) {
    const text = [
        performance.title,
        performance.venue,
        performance.genre,
        performance.subGenre,
        performance.description,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    const primaryText = [
        performance.title,
        performance.venue,
        performance.genre,
        performance.subGenre,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

    const month = referenceDate.getUTCMonth() + 1;
    let penalty = 0;

    if (includesWinterLeisureKeyword(primaryText) && ![11, 12, 1, 2, 3].includes(month)) {
        penalty -= 140;
        if (primaryText.includes('25/26') || primaryText.includes('시즌권') || primaryText.includes('리프트권')) {
            penalty -= 80;
        }
    }

    if (includesSeasonKeyword(text, SUMMER_KEYWORDS) && ![5, 6, 7, 8, 9].includes(month)) {
        penalty -= 35;
    }

    if (includesSeasonKeyword(text, SPRING_KEYWORDS) && ![3, 4, 5].includes(month)) {
        penalty -= 18;
    }

    if (includesSeasonKeyword(text, AUTUMN_KEYWORDS) && ![9, 10, 11].includes(month)) {
        penalty -= 18;
    }

    return penalty;
}

function getFreshCollectionBoost(performance: Performance, referenceDate: Date) {
    if (!performance.statsCollectedAt) return 0;

    const collectedAt = new Date(performance.statsCollectedAt);
    if (Number.isNaN(collectedAt.getTime())) return 0;

    const ageDays = Math.max(0, getDateDiffDays(referenceDate, collectedAt));
    if (ageDays <= 1) return 8;
    if (ageDays <= 3) return 4;
    return 0;
}

export function getFeedScore(performance: Performance, referenceDate: Date) {
    const { start, end } = getScheduleWindow(performance);
    const daysUntilStart = start ? getDateDiffDays(start, referenceDate) : null;
    const daysUntilEnd = end ? getDateDiffDays(end, referenceDate) : null;
    const runningDays = start && end ? Math.max(0, getDateDiffDays(end, start)) : 0;

    let score = 0;

    const genreBase: Record<string, number> = {
        musical: 18,
        play: 18,
        concert: 17,
        classic_tradition: 16,
        exhibition: 15,
        activity: 12,
        class: 10,
        museum: 12,
        tourism: 10,
        movie: 16,
        baseball: 14,
        soccer: 14,
        sports: 13,
    };

    score += genreBase[performance.genre] ?? 12;

    if (performance.genre === 'movie' && performance.rank && performance.rank <= 10) {
        score += 32 - performance.rank * 2;
    }

    if (daysUntilStart !== null && daysUntilEnd !== null) {
        if (daysUntilStart >= 0) {
            if (daysUntilStart <= 7) score += 96 - daysUntilStart * 8;
            else if (daysUntilStart <= 30) score += 68 - daysUntilStart;
            else if (daysUntilStart <= 90) score += 36 - Math.floor(daysUntilStart / 3);
            else if (daysUntilStart <= 180) score += 10;
            else score -= 20;
        } else if (daysUntilEnd >= 0) {
            score += 44;
            if (daysUntilEnd <= 7) score += 18;
            else if (daysUntilEnd <= 30) score += 10;

            const ageDays = start ? Math.max(0, getDateDiffDays(referenceDate, start)) : 0;
            if (ageDays > 180) score -= Math.min(36, Math.floor(ageDays / 30));
            if (runningDays > 365) score -= 18;
        } else {
            score -= 100;
        }
    } else if (daysUntilEnd !== null) {
        if (daysUntilEnd >= 0 && daysUntilEnd <= 90) score += 18;
        else if (daysUntilEnd < 0) score -= 40;
    } else {
        score += 4;
    }

    if (performance.title.includes('개막') || performance.title.includes('오픈') || performance.title.includes('신규')) {
        score += 8;
    }

    score += getFreshCollectionBoost(performance, referenceDate);
    score += getSeasonalPenalty(performance, referenceDate);

    return score;
}

function rankPerformancesByDiscoveryScore(performances: Performance[], referenceDate: Date) {
    const salt = getKoreanDaySalt(referenceDate);

    return [...performances].sort((a, b) => {
        const scoreA = getFeedScore(a, referenceDate);
        const scoreB = getFeedScore(b, referenceDate);
        if (scoreA !== scoreB) return scoreB - scoreA;

        const windowA = getScheduleWindow(a);
        const windowB = getScheduleWindow(b);
        const daysUntilA = windowA.start ? Math.abs(getDateDiffDays(windowA.start, referenceDate)) : 9999;
        const daysUntilB = windowB.start ? Math.abs(getDateDiffDays(windowB.start, referenceDate)) : 9999;
        if (daysUntilA !== daysUntilB) return daysUntilA - daysUntilB;

        const tieA = hashString(`${salt}:${a.id}`) % 1000;
        const tieB = hashString(`${salt}:${b.id}`) % 1000;
        if (tieA !== tieB) return tieB - tieA;

        return a.title.localeCompare(b.title, 'ko');
    });
}

export function sortPerformancesForHomeFeed(performances: Performance[]) {
    const referenceDate = getKoreanReferenceDate();
    const ranked = rankPerformancesByDiscoveryScore(performances, referenceDate);

    const earlyWindow = 36;
    const selected: Performance[] = [];
    const selectedIds = new Set<string>();
    const genreCounts = new Map<string, number>();
    const venueCounts = new Map<string, number>();

    const canPlaceEarly = (item: Performance, index: number) => {
        const sameGenreCount = genreCounts.get(item.genre) || 0;
        const sameVenueCount = venueCounts.get(item.venue) || 0;

        if (index < 8 && sameGenreCount >= 1) return false;
        if (index < 10 && sameVenueCount >= 1) return false;
        if (index < 18 && sameGenreCount >= 2) return false;
        if (index < 24 && sameVenueCount >= 1) return false;
        if (index < earlyWindow && sameGenreCount >= 3) return false;

        return true;
    };

    for (const item of ranked) {
        if (selected.length >= earlyWindow) break;
        if (!canPlaceEarly(item, selected.length)) continue;

        selected.push(item);
        selectedIds.add(item.id);
        genreCounts.set(item.genre, (genreCounts.get(item.genre) || 0) + 1);
        venueCounts.set(item.venue, (venueCounts.get(item.venue) || 0) + 1);
    }

    if (selected.length < earlyWindow) {
        for (const item of ranked) {
            if (selected.length >= earlyWindow) break;
            if (selectedIds.has(item.id)) continue;

            selected.push(item);
            selectedIds.add(item.id);
        }
    }

    const remainder = ranked.filter((item) => !selectedIds.has(item.id));
    return [...selected, ...remainder];
}

export function sortPerformancesForCategoryFeed(performances: Performance[]) {
    const referenceDate = getKoreanReferenceDate();
    const ranked = rankPerformancesByDiscoveryScore(performances, referenceDate);
    const earlyWindow = Math.min(36, ranked.length);
    const selected: Performance[] = [];
    const selectedIds = new Set<string>();
    const venueCounts = new Map<string, number>();
    const sourceCounts = new Map<string, number>();

    for (const item of ranked) {
        if (selected.length >= earlyWindow) break;

        const venueIdentity = item.locationKey || item.venueKey || item.venue;
        const sourceIdentity = item.source || 'unknown';
        const sameVenueCount = venueCounts.get(venueIdentity) || 0;
        const sameSourceCount = sourceCounts.get(sourceIdentity) || 0;

        if (selected.length < 12 && sameVenueCount >= 1) continue;
        if (selected.length < 24 && sameVenueCount >= 2) continue;
        if (selected.length < 18 && sameSourceCount >= 8) continue;

        selected.push(item);
        selectedIds.add(item.id);
        venueCounts.set(venueIdentity, sameVenueCount + 1);
        sourceCounts.set(sourceIdentity, sameSourceCount + 1);
    }

    if (selected.length < earlyWindow) {
        for (const item of ranked) {
            if (selected.length >= earlyWindow) break;
            if (selectedIds.has(item.id)) continue;
            selected.push(item);
            selectedIds.add(item.id);
        }
    }

    return [...selected, ...ranked.filter((item) => !selectedIds.has(item.id))];
}

export function getFeaturedPerformances(performances: Performance[], limit = 18) {
    const ranked = sortPerformancesForHomeFeed(performances);
    const selected: Performance[] = [];
    const seenIds = new Set<string>();
    const genreCounts = new Map<string, number>();
    const venueCounts = new Map<string, number>();

    for (const item of ranked) {
        if (selected.length >= limit) break;
        if (seenIds.has(item.id)) continue;

        const sameGenreCount = genreCounts.get(item.genre) || 0;
        const sameVenueCount = venueCounts.get(item.venue) || 0;
        const earlyWindow = selected.length < 8;

        if (earlyWindow && sameGenreCount >= 1) continue;
        if (selected.length < 6 && sameVenueCount >= 1) continue;

        selected.push(item);
        seenIds.add(item.id);
        genreCounts.set(item.genre, sameGenreCount + 1);
        venueCounts.set(item.venue, sameVenueCount + 1);
    }

    if (selected.length < limit) {
        for (const item of ranked) {
            if (selected.length >= limit) break;
            if (seenIds.has(item.id)) continue;
            selected.push(item);
            seenIds.add(item.id);
        }
    }

    return selected;
}

export interface FilterOptions {
    genre?: string;
    region?: string;
    district?: string;
    venue?: string;
    search?: string;
    lat?: number;
    lng?: number;
    radius?: number; // In km
    searchMode?: 'keyword' | 'location';
}

export function filterPerformances(performances: Performance[], options: FilterOptions, venueLookup: Record<string, Venue> = {}): Performance[] {
    let filtered = performances;
    const { genre, region, district, venue, search, lat, lng, radius, searchMode } = options;
    const resolvedVenueCache = new Map<string, Venue>();
    const getResolvedVenue = (performance: Performance) => {
        const key = performance.id || `${performance.title}::${performance.venue}::${performance.address || ''}`;
        const cached = resolvedVenueCache.get(key);
        if (cached) return cached;

        const resolved = resolveVenueInfoForPerformance(performance, venueLookup) as Venue;
        resolvedVenueCache.set(key, resolved);
        return resolved;
    };

    // 0. Genre Early Filter (Optimization for [genre] pages)
    if (genre && genre !== 'all') {
        filtered = filtered.filter(p => p.genre === genre);
    }

    if (searchMode === 'location' && genre !== 'movie') {
        filtered = filtered.filter(p => p.genre !== 'movie');
    }

    // 1. Base Filter: Strict Address Integrity
    // Exclude any physical event that doesn't have a record in venues.json or has an empty address.
    // Digital content (OTT/Movie) is exempt from physical address requirement.
    // [FIX] Also allow items that ALREADY have inherent coordinates (Museum/Tourism/Mommom)
    filtered = filtered.filter(p => {
        if (p.genre === 'movie') return true;

        const venueInfo = getResolvedVenue(p);
        if ((venueInfo.lat && venueInfo.lng) || (p.lat && p.lng && p.lat !== 0 && p.lng !== 0)) return true;
        if (!venueInfo || !venueInfo.address || venueInfo.address.trim() === '') {
            return false;
        }
        return true;
    });


    // 2. Search Filter (Highest Priority)
    if (search && search.trim()) {
        const targetSearch = search.replace(/\s+/g, '').toLowerCase().normalize('NFC');
        const isChoseongMode = /^[ㄱ-ㅎ]+$/.test(targetSearch);

        filtered = filtered.filter(p => {
            const titleNoSpace = p.title.replace(/\s+/g, '').toLowerCase().normalize('NFC');
            const venueNoSpace = p.venue.replace(/\s+/g, '').toLowerCase().normalize('NFC');

            // A. Title Match
            if (isChoseongMode ? isChoseongMatch(titleNoSpace, targetSearch) : titleNoSpace.includes(targetSearch)) return true;

            // B. Cast Match
            if (p.cast) {
                const castStr = Array.isArray(p.cast) ? p.cast.join('') : p.cast;
                const castNoSpace = castStr.replace(/\s+/g, '').toLowerCase().normalize('NFC');
                if (isChoseongMode ? isChoseongMatch(castNoSpace, targetSearch) : castNoSpace.includes(targetSearch)) return true;
            }

            // C. Venue Match
            if (venueNoSpace.includes(targetSearch)) return true;

            return false;
        });
    }


    // [OTT/Movie Filter logic extracted from PerformanceList]
    // Filter out obscure foreign series for OTT/Movie unless country is major
    // This runs implicitly on the dataset usually, ensuring quality.
    // For now, we apply it if genre is movie or ott.
    // Actually, PerformanceList applied this globally. Let's keep consistency.
    filtered = filtered.filter(p => {
        if (p.genre !== 'movie') return true;

        // Keep box office top 10 always
        if (p.rank && p.rank <= 10) return true;

        // Keep all unranked movies (upcoming releases from KOBIS schedule)
        // These are explicitly scraped as upcoming content, so always show them
        if (!p.rank) return true;

        return false;
    });

    // 3. Region Filter
    if (region && region !== 'all') {
        filtered = filtered.filter(p => {
            if (p.genre === 'movie') return true;

            const venueInfo = getResolvedVenue(p);

            // 0. Use Strict Mapped Region ID if available
            if (venueInfo && venueInfo.mapped_region_id) {
                return venueInfo.mapped_region_id === region;
            }

            // 1. Trust server-side region assignment
            if (p.region === region) return true;

            if (!venueInfo) {
                // Fallback check if venue name contains region
                const regionLabel = REGIONS.find(r => r.id === region)?.label;
                return regionLabel ? p.venue.includes(regionLabel) : false;
            }

            const regionLabel = REGIONS.find(r => r.id === region)?.label;
            if (!regionLabel) return false;

            // Matches address 
            const venueAddress = venueInfo.address || '';
            const isRegionMatch = venueAddress.startsWith(regionLabel);
            if (!isRegionMatch) return false;

            // District Check (if selected)
            if (district && district !== 'all') {
                return venueInfo.district === district || venueAddress.includes(district);
            }

            return true;
        });
    }

    // 4. Venue Check (Specific Venue or Radius)
    if (venue && venue !== 'all') {
        const centerVenue = getRepresentativeVenueInfoForName(venue, filtered, venueLookup);
        if (centerVenue && centerVenue.lat && centerVenue.lng) {
            // Include: 1. Exact Venue Match OR 2. Within 10km (Standard logic)
            filtered = filtered.filter(p => {
                if (p.genre === 'movie') return true;
                if (p.venue === venue) return true;
                const pVenue = getResolvedVenue(p);
                if (!pVenue?.lat || !pVenue?.lng) return false;
                const dist = getDistanceFromLatLonInKm(centerVenue.lat!, centerVenue.lng!, pVenue.lat, pVenue.lng);
                return dist <= 10;
            });
        } else {
            filtered = filtered.filter(p => p.venue === venue);
        }
    }

    // 5. GPS Radius Filter (if lat/lng/radius provided and NO venue selected)
    // Note: If 'venue' selected, it overrides this with its own radius logic above.
    if ((!venue || venue === 'all') && lat && lng && radius) {
        filtered = filtered.filter(p => {
            if (p.genre === 'movie') return true;
            const pVenue = getResolvedVenue(p);
            if (!pVenue?.lat || !pVenue?.lng) return false;
            const dist = getDistanceFromLatLonInKm(lat, lng, pVenue.lat, pVenue.lng);
            return dist <= radius;
        });
    }

    return filtered;
}

export function sortPerformances(performances: Performance[], genre: string, searchText: string = ''): Performance[] {
    // 1. Sort copies of array
    const sorted = [...performances];
    const cleanSearch = searchText.replace(/\s+/g, '').toLowerCase().normalize('NFC');

    // Sports: Strict Date DESC Sort (Newest First)
    const sportsGenres = ['volleyball', 'basketball', 'baseball', 'handball', 'soccer'];
    if (genre && sportsGenres.includes(genre)) {
        return sorted.sort((a, b) => {
            const dateA = (a.date || '').split('(')[0].split('~')[0].trim();
            const dateB = (b.date || '').split('(')[0].split('~')[0].trim();
            return dateA.localeCompare(dateB);
        });
    }

    // Movie: Top 10 Rank First, then Strict Date ASC Sort (Upcoming First)
    if (genre === 'movie') {
        return sorted.sort((a, b) => {
            // Prioritize Top 10 ranks if available
            const rankA = (a.rank !== undefined && a.rank > 0 && a.rank <= 10) ? a.rank : Infinity;
            const rankB = (b.rank !== undefined && b.rank > 0 && b.rank <= 10) ? b.rank : Infinity;

            if (rankA !== rankB) return rankA - rankB;

            // Normalize formats: "2026.03.04." vs "2026-12-31" -> "20260304" vs "20261231"
            const dateA = (a.dateRaw || a.date || '99991231').replace(/\D/g, '').padEnd(8, '0');
            const dateB = (b.dateRaw || b.date || '99991231').replace(/\D/g, '').padEnd(8, '0');
            return dateA.localeCompare(dateB);
        });
    }

    // 2. SEARCH RELEVANCE SORTING (Highest Priority if keyword provided)
    if (cleanSearch) {
        return sorted.sort((a, b) => {
            const getScore = (p: Performance) => {
                let score = 0;
                const titleNoSpace = p.title.replace(/\s+/g, '').toLowerCase().normalize('NFC');
                const venueNoSpace = p.venue.replace(/\s+/g, '').toLowerCase().normalize('NFC');
                const castStr = Array.isArray(p.cast) ? p.cast.join('') : (p.cast || '');
                const castNoSpace = castStr.replace(/\s+/g, '').toLowerCase().normalize('NFC');

                // A. Title Match (Max 100)
                if (titleNoSpace === cleanSearch) score += 100;
                else if (titleNoSpace.startsWith(cleanSearch)) score += 90;
                else if (titleNoSpace.includes(cleanSearch)) score += 80;

                // B. Cast Match (Max 40)
                if (castNoSpace.includes(cleanSearch)) score += 40;

                // C. Venue Match (Max 20)
                if (venueNoSpace.includes(cleanSearch)) score += 20;

                return score;
            };

            const scoreA = getScore(a);
            const scoreB = getScore(b);

            if (scoreA !== scoreB) return scoreB - scoreA; // High score first

            // If scores equal, sort by Date
            const dateA = (a.date || '').split('(')[0].split('~')[0].trim();
            const dateB = (b.date || '').split('(')[0].split('~')[0].trim();
            const dateCompare = dateA.localeCompare(dateB);
            if (dateCompare !== 0) return dateCompare;

            return a.id.localeCompare(b.id);
        });
    }

    // Default: Sort by Date Ascending (Upcoming)
    return sorted.sort((a, b) => {
        const dateA = (a.date || '').split('(')[0].split('~')[0].trim();
        const dateB = (b.date || '').split('(')[0].split('~')[0].trim();

        // Compare Date
        const dateCompare = dateA.localeCompare(dateB);
        if (dateCompare !== 0) return dateCompare;

        return a.id.localeCompare(b.id);
    });
}
