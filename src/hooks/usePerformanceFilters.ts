import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { DiscoveryContextId, Performance } from '@/types';
import { filterPerformances, sortPerformances, sortPerformancesForCategoryFeed, sortPerformancesForHomeFeed } from '@/lib/performance-filter';
import { resolveVenueInfoForPerformance } from '@/lib/location-display';
import { getDistanceFromLatLonInKm } from '@/lib/utils';
import { filterByDiscoveryContext } from '@/lib/discovery';
import type { DateFilterId, PriceFilterId } from '@/lib/constants';
import { parseDistrictSelection, parseRegionSelection, persistRegionSelection, readPersistedRegionSelection, REGION_SELECTION_EVENT } from '@/lib/region-selection';

const INITIAL_VISIBLE_COUNT = 15;
const LOAD_MORE_COUNT = 30;
const FILTER_CACHE_LIMIT = 24;
const filterResultCache = new Map<string, Performance[]>();

function rememberFilterResult(key: string, result: Performance[]) {
    filterResultCache.delete(key);
    filterResultCache.set(key, result);
    while (filterResultCache.size > FILTER_CACHE_LIMIT) {
        const oldestKey = filterResultCache.keys().next().value;
        if (!oldestKey) break;
        filterResultCache.delete(oldestKey);
    }
    return result;
}

interface UsePerformanceFiltersProps {
    allPerformances: Performance[];
    initialGenre: string;
    searchMode: 'keyword' | 'location';
    searchText: string;
    searchLocation: any;
    userLocation: any;
    radius: number;
    venues: Record<string, any>;
    discoveryContextId: DiscoveryContextId;
}

export function usePerformanceFilters({
    allPerformances,
    initialGenre,
    searchMode,
    searchText,
    searchLocation,
    userLocation,
    radius,
    venues,
    discoveryContextId
}: UsePerformanceFiltersProps) {
    const [selectedGenre, setSelectedGenre] = useState<string>(initialGenre);

    // Keep the first client render identical to the static HTML, then restore
    // browser-only state after mount. Reading storage in useState initializers
    // causes hydration mismatches on GitHub Pages.
    const [selectedRegion, setSelectedRegion] = useState<string>('all');
    const [selectedDistrict, setSelectedDistrict] = useState<string>('all');
    const [selectedVenue, setSelectedVenue] = useState<string>('all');
    const [shuffleSeed, setShuffleSeed] = useState<number>(0);
    // Chip filters: simple toggle state, not persisted (intentionally - they're
    // meant for one-off browsing rather than a remembered preference).
    const [selectedDateFilter, setSelectedDateFilter] = useState<DateFilterId | null>(null);
    const [selectedPriceTier, setSelectedPriceTier] = useState<PriceFilterId | null>(null);

    const [visibleCount, setVisibleCount] = useState<number>(INITIAL_VISIBLE_COUNT);

    const [debouncedSearchText, setDebouncedSearchText] = useState(searchText);
    const isInitialized = useRef(false);
    const skipInitialPersist = useRef(true);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        try {
            const persisted = readPersistedRegionSelection();
            const saved = sessionStorage.getItem(`cf_state_${initialGenre}`);
            const parsed = saved ? JSON.parse(saved) : null;

            setSelectedRegion(persisted?.region || parsed?.region || 'all');
            setSelectedDistrict(persisted?.district || parsed?.district || 'all');
            setSelectedVenue(persisted?.venue || parsed?.venue || 'all');
            setShuffleSeed(parsed?.seed || Date.now());
            const savedVisibleCount = Number(parsed?.visibleCount);
            setVisibleCount(
                Number.isFinite(savedVisibleCount)
                    ? Math.min(Math.max(savedVisibleCount, INITIAL_VISIBLE_COUNT), INITIAL_VISIBLE_COUNT + LOAD_MORE_COUNT * 2)
                    : INITIAL_VISIBLE_COUNT
            );
        } catch {
            setShuffleSeed(Date.now());
        } finally {
            isInitialized.current = true;
        }
    }, [initialGenre]);

    // Persistence: Always keep sessionStorage synced with current state
    useEffect(() => {
        if (typeof window === 'undefined' || !isInitialized.current) return;
        if (skipInitialPersist.current) {
            skipInitialPersist.current = false;
            return;
        }

        const state = {
            region: selectedRegion,
            district: selectedDistrict,
            venue: selectedVenue,
            seed: shuffleSeed,
            visibleCount: visibleCount
        };
        sessionStorage.setItem(`cf_state_${selectedGenre}`, JSON.stringify(state));
        persistRegionSelection(selectedRegion, selectedDistrict, selectedVenue);
    }, [selectedGenre, selectedRegion, selectedDistrict, selectedVenue, shuffleSeed, visibleCount]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handleRegionSync = (event: Event) => {
            const detail = (event as CustomEvent<{ region?: string; district?: string; venue?: string }>).detail;
            if (!detail) return;
            if (detail.region && detail.region !== selectedRegion) setSelectedRegion(detail.region);
            if (detail.district && detail.district !== selectedDistrict) setSelectedDistrict(detail.district);
            if (detail.venue && detail.venue !== selectedVenue) setSelectedVenue(detail.venue);
        };
        window.addEventListener(REGION_SELECTION_EVENT, handleRegionSync);
        return () => window.removeEventListener(REGION_SELECTION_EVENT, handleRegionSync);
    }, [selectedRegion, selectedDistrict, selectedVenue]);

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
        const selectedRegions = parseRegionSelection(selectedRegion);
        if (selectedRegions.length === 0) return [];
        const regionVenues = Object.values(venues).filter(v => selectedRegions.includes(v.mapped_region_id));
        const uniqueDistricts = new Set(regionVenues.map(v => v.district).filter((d): d is string => !!d));
        return Array.from(uniqueDistricts).sort();
    }, [selectedRegion, venues]);

    const availableVenues = useMemo(() => {
        let relevantVenues = Object.keys(venues);
        const selectedRegions = parseRegionSelection(selectedRegion);
        const districtMap = parseDistrictSelection(selectedDistrict, selectedRegions[0]);
        if (selectedRegions.length > 0) {
            relevantVenues = relevantVenues.filter(v => selectedRegions.includes(venues[v].mapped_region_id));
        }
        const hasDistricts = Object.values(districtMap).some((items) => items.length > 0);
        if (hasDistricts) {
            relevantVenues = relevantVenues.filter(v => {
                const region = venues[v].mapped_region_id;
                const selectedDistricts = districtMap[region] || [];
                return selectedDistricts.length === 0 || selectedDistricts.includes(venues[v].district);
            });
        }
        return relevantVenues.sort();
    }, [selectedRegion, selectedDistrict, venues]);

    // Main Filtering Logic
    const filteredPerformances = useMemo(() => {
        const dataFingerprint = `${allPerformances.length}:${allPerformances.at(-1)?.id || ''}`;
        const locationFingerprint = searchLocation || userLocation;
        const cacheKey = JSON.stringify([
            dataFingerprint,
            selectedGenre,
            selectedRegion,
            selectedDistrict,
            selectedVenue,
            debouncedSearchText,
            locationFingerprint?.lat || '',
            locationFingerprint?.lng || '',
            radius,
            searchMode,
            discoveryContextId,
            selectedDateFilter,
            selectedPriceTier,
            Object.keys(venues).length,
        ]);
        const cachedResult = filterResultCache.get(cacheKey);
        if (cachedResult) return cachedResult;

        const filtered = filterPerformances(allPerformances, {
            genre: selectedGenre,
            region: selectedRegion,
            district: selectedDistrict,
            venue: selectedVenue,
            search: searchMode === 'keyword' ? debouncedSearchText : '',
            lat: searchLocation?.lat || userLocation?.lat,
            lng: searchLocation?.lng || userLocation?.lng,
            radius: radius,
            searchMode: searchMode,
            dateFilter: selectedDateFilter,
            priceTier: selectedPriceTier,
        }, venues);

        const discoveryFiltered = (!debouncedSearchText && searchMode !== 'location')
            ? filterByDiscoveryContext(filtered, discoveryContextId)
            : filtered;

        if (searchMode === 'location' && (searchLocation || userLocation)) {
            const center = searchLocation || userLocation;
            if (center && center.lat && center.lng) {
                const resolvedVenueCache = new Map<string, { lat?: number | null; lng?: number | null }>();
                const withDist = discoveryFiltered.map(p => {
                    const cacheKey = p.id || `${p.title}::${p.venue}::${p.address || ''}`;
                    const v = resolvedVenueCache.get(cacheKey) || resolveVenueInfoForPerformance(p, venues);
                    resolvedVenueCache.set(cacheKey, v);
                    const dist = (v?.lat && v?.lng)
                        ? getDistanceFromLatLonInKm(center.lat, center.lng, v.lat, v.lng)
                        : 99999;
                    return { ...p, _dist: dist };
                });
                return rememberFilterResult(cacheKey, withDist.sort((a, b) => {
                    const distDiff = a._dist - b._dist;
                    if (distDiff !== 0) return distDiff; // Primary: Distance

                    // Secondary: Date (Newest first)
                    const dateA = (a.date || '').split('(')[0].split('~')[0].trim();
                    const dateB = (b.date || '').split('(')[0].split('~')[0].trim();
                    const dateCompare = dateB.localeCompare(dateA);
                    if (dateCompare !== 0) return dateCompare;

                    // Tertiary: Title (Alphabetical)
                    return a.title.localeCompare(b.title);
                }));
            }
        }

        const sportsGenres = ['volleyball', 'basketball', 'baseball', 'handball', 'soccer'];
        if (selectedGenre === 'all' && searchMode !== 'location' && !debouncedSearchText) {
            return rememberFilterResult(cacheKey, sortPerformancesForHomeFeed(discoveryFiltered));
        }

        if (selectedGenre !== 'movie' && !sportsGenres.includes(selectedGenre) && !debouncedSearchText) {
            return rememberFilterResult(cacheKey, sortPerformancesForCategoryFeed(discoveryFiltered));
        }

        return rememberFilterResult(cacheKey, sortPerformances(discoveryFiltered, selectedGenre, debouncedSearchText));
    }, [allPerformances, selectedGenre, selectedRegion, selectedDistrict, selectedVenue, debouncedSearchText, searchLocation, userLocation, radius, searchMode, venues, discoveryContextId, selectedDateFilter, selectedPriceTier]);

    // Pagination
    const displayPerformances = useMemo(() => {
        return filteredPerformances.slice(0, visibleCount);
    }, [filteredPerformances, visibleCount]);

    const hasMore = visibleCount < filteredPerformances.length;

    useEffect(() => {
        // Reset count only if GENRE or MAJOR parameters change in a way that implies a NEW search entry,
        // but restored state will take precedence in the first mount.
        // Actually, if we are initialized, we don't want to force reset if we just came back.
        // However, if the user manually changes something, we DO want reset.
        if (isInitialized.current) {
            // We should distinguish between "mounting" and "explicitly changing filters"
            // For now, let's reset to the initial window if major filters change AFTER mount
            setVisibleCount(INITIAL_VISIBLE_COUNT);
        }
    }, [selectedGenre, selectedRegion, selectedDistrict, selectedVenue, debouncedSearchText, searchLocation, discoveryContextId]);

    const loadMore = useCallback(() => {
        setVisibleCount(prev => prev + LOAD_MORE_COUNT);
    }, []);

    // Reset chip filters when other major filters change. Avoids users being
    // confused by an empty grid because, say, '오늘' is still active after
    // they switched to a category that has no shows today.
    useEffect(() => {
        if (isInitialized.current) {
            setSelectedDateFilter(null);
            setSelectedPriceTier(null);
        }
    }, [selectedGenre, debouncedSearchText, searchLocation]);

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
        selectedDateFilter,
        setSelectedDateFilter,
        selectedPriceTier,
        setSelectedPriceTier,
        districts,
        availableVenues,
        filteredPerformances,
        displayPerformances,
        hasMore,
        loadMore
    };
}
