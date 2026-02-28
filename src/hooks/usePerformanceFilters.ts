import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Performance } from '@/types';
import { filterPerformances, sortPerformances } from '@/lib/performance-filter';
import { getDistanceFromLatLonInKm } from '@/lib/utils';
import venueData from '@/data/venue-dictionary.json';

const venues = venueData as Record<string, any>;

interface UsePerformanceFiltersProps {
    allPerformances: Performance[];
    initialGenre: string;
    searchMode: 'keyword' | 'location';
    searchText: string;
    searchLocation: any;
    userLocation: any;
    radius: number;
}

export function usePerformanceFilters({
    allPerformances,
    initialGenre,
    searchMode,
    searchText,
    searchLocation,
    userLocation,
    radius
}: UsePerformanceFiltersProps) {
    const [selectedGenre, setSelectedGenre] = useState<string>(initialGenre);
    const [selectedRegion, setSelectedRegion] = useState<string>('all');
    const [selectedDistrict, setSelectedDistrict] = useState<string>('all');
    const [selectedVenue, setSelectedVenue] = useState<string>('all');
    const [shuffleSeed, setShuffleSeed] = useState<number>(Date.now());
    const [visibleCount, setVisibleCount] = useState(24);

    useEffect(() => {
        setSelectedGenre(initialGenre);
    }, [initialGenre]);

    // Derived Filter Lists
    const districts = useMemo(() => {
        if (!selectedRegion || selectedRegion === 'all') return [];
        const regionVenues = Object.values(venues).filter(v => v.mapped_region_id === selectedRegion);
        const uniqueDistricts = new Set(regionVenues.map(v => v.district).filter((d): d is string => !!d));
        return Array.from(uniqueDistricts).sort();
    }, [selectedRegion]);

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
            search: searchMode === 'keyword' ? searchText : '',
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
                return withDist.sort((a, b) => a._dist - b._dist);
            }
        }

        if (selectedGenre !== 'movie') {
            return filtered
                .map(value => ({ value, sort: Math.sin(shuffleSeed + value.id.length) * 10000 }))
                .sort((a, b) => a.sort - b.sort)
                .map(({ value }) => value);
        }

        return sortPerformances(filtered, selectedGenre);
    }, [allPerformances, selectedGenre, selectedRegion, selectedDistrict, selectedVenue, searchText, searchLocation, userLocation, radius, searchMode, shuffleSeed]);

    // Pagination
    const displayPerformances = useMemo(() => {
        return filteredPerformances.slice(0, visibleCount);
    }, [filteredPerformances, visibleCount]);

    const hasMore = visibleCount < filteredPerformances.length;

    useEffect(() => {
        setVisibleCount(24);
    }, [selectedGenre, selectedRegion, selectedDistrict, selectedVenue, searchText, searchLocation]);

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
