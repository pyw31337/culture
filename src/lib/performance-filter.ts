
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
    lat?: number;
    lng?: number;
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

    if (searchMode === 'location' && genre !== 'movie') {
        filtered = filtered.filter(p => p.genre !== 'movie');
    }

    // 0. Base Filter: Strict Address Integrity
    // Exclude any physical event that doesn't have a record in venues.json or has an empty address.
    // Digital content (OTT/Movie) is exempt from physical address requirement.
    filtered = filtered.filter(p => {
        if (p.genre === 'movie') return true;

        const venueInfo = venues[p.venue];
        if (!venueInfo || !venueInfo.address || venueInfo.address.trim() === '') {
            return false;
        }
        return true;
    });


    // 1. Search Filter (Highest Priority)
    if (search && search.trim()) {
        const searchText = search.replace(/\s+/g, ''); // ignore all spaces
        const lowerSearch = searchText.toLowerCase().normalize('NFC');
        const isChoseongMode = /^[ㄱ-ㅎ]+$/.test(searchText);

        filtered = filtered.filter(p => {
            const titleNoSpace = p.title.replace(/\s+/g, '');
            const venueNoSpace = p.venue.replace(/\s+/g, '');
            const castStr = p.cast ? (Array.isArray(p.cast) ? p.cast.join('') : p.cast) : '';
            const castNoSpace = castStr.replace(/\s+/g, '');

            // A. Title Match
            if (isChoseongMode ? isChoseongMatch(titleNoSpace, searchText) : titleNoSpace.toLowerCase().normalize('NFC').includes(lowerSearch)) return true;

            // B. Cast Match
            if (isChoseongMode ? isChoseongMatch(castNoSpace, searchText) : castNoSpace.toLowerCase().normalize('NFC').includes(lowerSearch)) return true;

            // C. Venue Match
            if (venueNoSpace.toLowerCase().normalize('NFC').includes(lowerSearch)) return true;

            return false;
        });
    }

    if (genre && genre !== 'all') {
        filtered = filtered.filter(p => p.genre === genre);
    }

    // [OTT/Movie Filter logic extracted from PerformanceList]
    // Filter out obscure foreign series for OTT/Movie unless country is major
    // This runs implicitly on the dataset usually, ensuring quality.
    // For now, we apply it if genre is movie or ott.
    // Actually, PerformanceList applied this globally. Let's keep consistency.
    filtered = filtered.filter(p => {
        if (p.genre !== 'movie') return true;
        return true;
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

export function sortPerformances(performances: Performance[], genre: string, keywords: string[] = []): Performance[] {
    // 1. Sort copies of array
    let sorted = [...performances];

    // Sports: Strict Date ASC Sort (Nearest First)
    const sportsGenres = ['volleyball', 'basketball', 'baseball', 'handball', 'soccer'];
    if (genre && sportsGenres.includes(genre)) {
        return sorted.sort((a, b) => {
            const dateA = (a.date || '').split('(')[0].split('~')[0].trim();
            const dateB = (b.date || '').split('(')[0].split('~')[0].trim();
            return dateA.localeCompare(dateB);
        });
    }

    // Movie: Rank First, then Strict Date DESC Sort (Newest First)
    if (genre === 'movie') {
        return sorted.sort((a, b) => {
            // Prioritize rank if available
            if (a.rank !== undefined && b.rank !== undefined) return a.rank - b.rank;
            if (a.rank !== undefined) return -1;
            if (b.rank !== undefined) return 1;

            const dateA = (a.date || '').split('(')[0].split('~')[0].trim();
            const dateB = (b.date || '').split('(')[0].split('~')[0].trim();
            return dateB.localeCompare(dateA);
        });
    }

    // Default: Sort by Random (seeded by keywords context) + Priority?
    // Current Logic in PerformanceList was: Random Shuffle using Seed.
    // We can't easily reproduce complex seeded shuffle on server for EVERY page identically without passing seed.
    // For Infinite Scroll, consistent sorting is CRITICAL.
    // Recommendation: Sort by ID or Date DESC as safe default, to ensure pagination works.
    // Otherwise, Page 1 might have Item A, and Page 2 reshuffles and has Item A again.

    // We will stick to Date sorting (Ascending for most, effectively?) or simple ID sort?
    // Actually, "Random" feeling is desired.
    // To enable consistent pagination with random order, the client must generate a seed, or simply we sort by Date.
    // Let's standardise on Date Ascending (Upcoming) for general events, as that's most useful.

    return sorted.sort((a, b) => {
        const dateA = (a.date || '').split('(')[0].split('~')[0].trim();
        const dateB = (b.date || '').split('(')[0].split('~')[0].trim();

        // Compare Date
        const dateCompare = dateA.localeCompare(dateB);
        if (dateCompare !== 0) return dateCompare;

        // Fallback to ID for stability
        return a.id.localeCompare(b.id);
    });
}
