
import { Performance } from '@/types';
import { isChoseongMatch } from './hangul';
import { GENRES, REGIONS } from './constants';
import venueData from '@/data/venues.json';
import { getDistanceFromLatLonInKm } from './utils';

// Define Venue Interface since we import JSON directly
interface Venue {
    name?: string;
    address: string;
    district?: string;
    lat?: number | null;
    lng?: number | null;
    mapped_region_id?: string;
}

const venues = venueData as Record<string, Venue>;

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

export function filterPerformances(performances: Performance[], options: FilterOptions): Performance[] {
    let filtered = performances;
    const { genre, region, district, venue, search, lat, lng, radius, searchMode } = options;

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

        // If it already has geodata, it is valid regardless of venues.json
        if (p.lat && p.lng && p.lat !== 0 && p.lng !== 0) return true;

        const venueInfo = venues[p.venue];
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

            const venueInfo = venues[p.venue];

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
            const isRegionMatch = venueInfo.address.startsWith(regionLabel);
            if (!isRegionMatch) return false;

            // District Check (if selected)
            if (district && district !== 'all') {
                return venueInfo.district === district || venueInfo.address.includes(district);
            }

            return true;
        });
    }

    // 4. Venue Check (Specific Venue or Radius)
    if (venue && venue !== 'all') {
        const centerVenue = venues[venue];
        if (centerVenue && centerVenue.lat && centerVenue.lng) {
            // Include: 1. Exact Venue Match OR 2. Within 10km (Standard logic)
            filtered = filtered.filter(p => {
                if (p.genre === 'movie') return true;
                if (p.venue === venue) return true;
                const pVenue = venues[p.venue];
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
            const pVenue = venues[p.venue];
            if (!pVenue?.lat || !pVenue?.lng) return false;
            const dist = getDistanceFromLatLonInKm(lat, lng, pVenue.lat, pVenue.lng);
            return dist <= radius;
        });
    }

    return filtered;
}

// Helper for seeded random to ensure consistent shuffling within a session
function seededRandom(seed: number) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

function shuffleWithSeed<T>(array: T[], seed: number): T[] {
    const shuffled = [...array];
    let s = seed;
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(seededRandom(s++) * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

export function sortPerformances(performances: Performance[], genre: string, searchText: string = '', shuffleSeed?: number): Performance[] {
    // 1. Sort copies of array
    let sorted = [...performances];
    const cleanSearch = searchText.replace(/\s+/g, '').toLowerCase().normalize('NFC');

    // Sports: Strict Date DESC Sort (Newest First)
    const sportsGenres = ['volleyball', 'basketball', 'baseball', 'handball', 'soccer'];
    if (genre && sportsGenres.includes(genre)) {
        return sorted.sort((a, b) => {
            const dateA = (a.date || '').split('(')[0].split('~')[0].trim();
            const dateB = (b.date || '').split('(')[0].split('~')[0].trim();
            return dateB.localeCompare(dateA) || a.title.localeCompare(b.title);
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
            return dateA.localeCompare(dateB) || a.title.localeCompare(b.title);
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

            return a.title.localeCompare(b.title);
        });
    }

    // 3. SHUFFLE LOGIC (Default for generic lists if seed provided)
    if (shuffleSeed !== undefined && shuffleSeed !== 0) {
        return shuffleWithSeed(sorted, shuffleSeed);
    }

    // Default: Sort by Date Ascending (Upcoming)
    return sorted.sort((a, b) => {
        const dateA = (a.date || '').split('(')[0].split('~')[0].trim();
        const dateB = (b.date || '').split('(')[0].split('~')[0].trim();

        // Compare Date
        const dateCompare = dateA.localeCompare(dateB);
        if (dateCompare !== 0) return dateCompare;

        return a.title.localeCompare(b.title);
    });
}
