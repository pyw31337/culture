import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Performance } from '@/types';
import { filterPerformances, sortPerformances } from '@/lib/performance-filter';
import { getDistanceFromLatLonInKm } from '@/lib/utils';

interface UsePerformanceFiltersProps {
    allPerformances: Performance[];
    initialGenre: string;
    searchMode: 'keyword' | 'location';
    searchText: string;
    searchLocation: any;
    userLocation: any;
    radius: number;
    venues: Record<string, any>;
}

export function usePerformanceFilters({
    allPerformances,
    initialGenre,
    searchMode,
    searchText,
    searchLocation,
    userLocation,
    radius,
    venues
}: UsePerformanceFiltersProps) {
    const [selectedGenre, setSelectedGenre] = useState<string>(initialGenre);
    
    // Lazy State Initializers for Persistence
    const [selectedRegion, setSelectedRegion] = useState<string>(() => {
        if (typeof window === 'undefined') return 'all';
        try {
            const saved = sessionStorage.getItem(`cf_state_${initialGenre}`);
            return (saved ? JSON.parse(saved).region || 'all' : 'all') as string;
        } catch { return 'all'; }
    });
    const [selectedDistrict, setSelectedDistrict] = useState<string>(() => {
        if (typeof window === 'undefined') return 'all';
        try {
            const saved = sessionStorage.getItem(`cf_state_${initialGenre}`);
            return (saved ? JSON.parse(saved).district || 'all' : 'all') as string;
        } catch { return 'all'; }
    });
    const [selectedVenue, setSelectedVenue] = useState<string>(() => {
        if (typeof window === 'undefined') return 'all';
        try {
            const saved = sessionStorage.getItem(`cf_state_${initialGenre}`);
            return (saved ? JSON.parse(saved).venue || 'all' : 'all') as string;
        } catch { return 'all'; }
    });
    const [shuffleSeed, setShuffleSeed] = useState<number>(() => {
        if (typeof window === 'undefined') return Date.now();
        try {
            const saved = sessionStorage.getItem(`cf_state_${initialGenre}`);
            return (saved ? JSON.parse(saved).seed || Date.now() : Date.now()) as number;
        } catch { return Date.now(); }
    });
    const [visibleCount, setVisibleCount] = useState<number>(() => {
        if (typeof window === 'undefined') return 24;
        try {
            const saved = sessionStorage.getItem(`cf_state_${initialGenre}`);
            return (saved ? JSON.parse(saved).visibleCount || 24 : 24) as number;
        } catch { return 24; }
    });

    const [debouncedSearchText, setDebouncedSearchText] = useState(searchText);
    const isInitialized = useRef(false);

    // Persistence: Always keep sessionStorage synced with current state
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const state = {
            region: selectedRegion,
            district: selectedDistrict,
            venue: selectedVenue,
            seed: shuffleSeed,
            visibleCount: visibleCount
        };
        sessionStorage.setItem(`cf_state_${selectedGenre}`, JSON.stringify(state));
        isInitialized.current = true;
    }, [selectedGenre, selectedRegion, selectedDistrict, selectedVenue, shuffleSeed, visibleCount]);

    // Debounce search text to avoid heavy filtering on every keystroke
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchText(searchText);
        }, 150);
        return () => clearTimeout(timer);
    }, [searchText]);

    useEffect(() => {
        setSelectedGenre(initialGenre);
    }, [initialGenre]);

    // Derived Filter Lists
    const districts = useMemo(() => {
        if (!selectedRegion || selectedRegion === 'all') return [];
        const regionVenues = Object.values(venues).filter(v => v.mapped_region_id === selectedRegion);
        const uniqueDistricts = new Set(regionVenues.map(v => v.district).filter((d): d is string => !!d));
        return Array.from(uniqueDistricts).sort();
    }, [selectedRegion, venues]);

    const availableVenues = useMemo(() => {
        let relevantVenues = Object.keys(venues);
        if (selectedRegion && selectedRegion !== 'all') {
            relevantVenues = relevantVenues.filter(v => venues[v].mapped_region_id === selectedRegion);
        }
        if (selectedDistrict && selectedDistrict !== 'all') {
            relevantVenues = relevantVenues.filter(v => venues[v].district === selectedDistrict);
        }
        return relevantVenues.sort();
    }, [selectedRegion, selectedDistrict]);

    // Main Filtering Logic
    const filteredPerformances = useMemo(() => {
        const filtered = filterPerformances(allPerformances, {
            genre: selectedGenre,
            region: selectedRegion,
            district: selectedDistrict,
            venue: selectedVenue,
            search: searchMode === 'keyword' ? debouncedSearchText : '',
            lat: searchLocation?.lat || userLocation?.lat,
            lng: searchLocation?.lng || userLocation?.lng,
            radius: radius,
            searchMode: searchMode
        });

        if (searchMode === 'location' && (searchLocation || userLocation)) {
            const center = searchLocation || userLocation;
            if (center && center.lat && center.lng) {
                const withDist = filtered.map(p => {
                    const v = venues[p.venue];
                    const dist = (v?.lat && v?.lng)
                        ? getDistanceFromLatLonInKm(center.lat, center.lng, v.lat, v.lng)
                        : 99999;
                    return { ...p, _dist: dist };
                });
                return withDist.sort((a, b) => {
                    const distDiff = a._dist - b._dist;
                    if (distDiff !== 0) return distDiff; // Primary: Distance

                    // Secondary: Date (Newest first)
                    const dateA = (a.date || '').split('(')[0].split('~')[0].trim();
                    const dateB = (b.date || '').split('(')[0].split('~')[0].trim();
                    const dateCompare = dateB.localeCompare(dateA);
                    if (dateCompare !== 0) return dateCompare;

                    // Tertiary: Title (Alphabetical)
                    return a.title.localeCompare(b.title);
                });
            }
        }

        const sportsGenres = ['volleyball', 'basketball', 'baseball', 'handball', 'soccer'];
        if (selectedGenre !== 'movie' && !sportsGenres.includes(selectedGenre)) {
            return filtered
                .map(value => ({ value, sort: Math.sin(shuffleSeed + value.id.length) * 10000 }))
                .sort((a, b) => a.sort - b.sort)
                .map(({ value }) => value);
        }

        return sortPerformances(filtered, selectedGenre);
    }, [allPerformances, selectedGenre, selectedRegion, selectedDistrict, selectedVenue, debouncedSearchText, searchLocation, userLocation, radius, searchMode, shuffleSeed]);

    // Pagination
    const displayPerformances = useMemo(() => {
        return filteredPerformances.slice(0, visibleCount);
    }, [filteredPerformances, visibleCount]);

    const hasMore = visibleCount < filteredPerformances.length;

    useEffect(() => {
        // Reset count only if GENRE or MAJOR parameters change in a way that implies a NEW search entry, 
        // but restored state will take precedence in the first mount.
        // Actually, if we are initialized, we don't want to force reset to 24 if we just came back.
        // However, if the user manually changes something, we DO want reset.
        if (isInitialized.current) {
            // We should distinguish between "mounting" and "explicitly changing filters"
            // For now, let's reset to 24 if major filters change AFTER mount
            setVisibleCount(24);
        }
    }, [selectedGenre, selectedRegion, selectedDistrict, selectedVenue, debouncedSearchText, searchLocation]);

    const loadMore = useCallback(() => {
        setVisibleCount(prev => prev + 24);
    }, []);

    return {
        selectedGenre,
        setSelectedGenre,
        selectedRegion,
        setSelectedRegion,
        selectedDistrict,
        setSelectedDistrict,
        selectedVenue,
        setSelectedVenue,
        shuffleSeed,
        setShuffleSeed,
        districts,
        availableVenues,
        filteredPerformances,
        displayPerformances,
        hasMore,
        loadMore
    };
}
