
import { Performance } from '@/types';
import { isChoseongMatch } from './hangul';
import { GENRES, REGIONS } from './constants';
import venueData from '@/data/venues.json';
import { getDistanceFromLatLonInKm } from './utils';

// Define Venue Interface since we import JSON directly
interface Venue {
    name: string;
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
}

export function filterPerformances(performances: Performance[], options: FilterOptions): Performance[] {
    let filtered = performances;
    const { genre, region, district, venue, search, lat, lng, radius } = options;

    // 1. Search Filter (Highest Priority)
    if (search && search.trim()) {
        const searchText = search.trim();
        const lowerSearch = searchText.toLowerCase().normalize('NFC');

        filtered = filtered.filter(p => {
            // A. Title Match (Choseong supported)
            if (isChoseongMatch(p.title, searchText)) return true;

            // B. Cast Match (Choseong supported)
            const castStr = p.cast ? (Array.isArray(p.cast) ? p.cast.join(' ') : p.cast) : '';
            if (isChoseongMatch(castStr, searchText)) return true;

            // C. Venue Match
            if (p.venue.toLowerCase().normalize('NFC').includes(lowerSearch)) return true;

            return false;
        });
    }

    // 2. Genre Filter
    if (genre && genre !== 'all') {
        if (genre === 'hotdeal') {
            filtered = filtered.filter(p => p.discount && p.discount !== '' && p.discount !== '0');
        } else if (genre === 'ott') {
            filtered = filtered.filter(p => p.genre === 'ott' || (p.platforms && p.platforms.length > 0));
        } else {
            filtered = filtered.filter(p => p.genre === genre);
        }
    }

    // [OTT/Movie Filter logic extracted from PerformanceList]
    // Filter out obscure foreign series for OTT/Movie unless country is major
    // This runs implicitly on the dataset usually, ensuring quality.
    // For now, we apply it if genre is movie or ott.
    // Actually, PerformanceList applied this globally. Let's keep consistency.
    filtered = filtered.filter(p => {
        if (p.genre !== 'ott' && p.genre !== 'movie') return true;

        const country = p.productionCountry ? p.productionCountry.replace(/\s+/g, '') : '';
        // [Denylist] Explicitly hide works from China, Thailand, India, Brazil
        const denylist = ['중국', 'China', '태국', 'Thailand', '인도', 'India', '브라질', 'Brazil'];
        const isDeniedCountry = denylist.some(c => country.includes(c));
        if (isDeniedCountry) return false;

        // [Allowlist] Allow if country is KR/JP/US
        const allowlist = ['한국', '대한민국', '일본', '미국', 'UnitedStates'];
        const isMajorCountry = allowlist.some(c => country.includes(c));

        if (isMajorCountry) return true;

        // [Fallback] Hide other foreign series if "Season" in title or Genre/SubGenre is "Drama"
        const titleHasSeason = p.title.includes('시즌') || p.title.toLowerCase().includes('season');
        const isDrama = p.subGenre === '드라마';

        if (titleHasSeason || isDrama) {
            return false; // Hide
        }
        return true;
    });

    // 3. Region Filter
    if (region && region !== 'all') {
        filtered = filtered.filter(p => {
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
    const sportsGenres = ['volleyball', 'basketball', 'baseball', 'handball', 'soccer', 'hockey'];
    if (genre && sportsGenres.includes(genre)) {
        return sorted.sort((a, b) => {
            const dateA = (a.date || '').split('(')[0].split('~')[0].trim();
            const dateB = (b.date || '').split('(')[0].split('~')[0].trim();
            return dateA.localeCompare(dateB);
        });
    }

    // Movie/OTT: Strict Date DESC Sort (Newest First)
    if (genre === 'movie' || genre === 'ott') {
        return sorted.sort((a, b) => {
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
