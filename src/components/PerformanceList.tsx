'use client';

import Link from 'next/link';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Performance } from '@/types';
import { Share2, Link2, Check, Search, MapPin, Calendar, Menu, X, Filter, ChevronDown, List, LayoutGrid, LayoutList, Heart, Flame, Star, Bell, RotateCw, RotateCcw, Map as MapIcon, ChevronUp, Plane, CalendarDays, Navigation, ChevronRight, Tag, Home, Loader2 } from 'lucide-react';
import ImageWithFallback from './ImageWithFallback';
import BuildingStadium from './BuildingStadium';
import { clsx } from 'clsx';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import venueData from '@/data/venues.json';
import { GENRES, REGIONS, NATIONWIDE_REGIONS, RADIUS_OPTIONS, OTT_PLATFORMS, FUTURES_TEAM_LOGOS } from '@/lib/constants';
import { getOptimizedUrl } from '@/lib/utils';
import { safeStorage } from '@/lib/safeStorage';
import { motion, AnimatePresence } from 'framer-motion';
import LZString from 'lz-string';
import Portal from './ui/Portal';
import BottomNav, { BottomMenuType } from './BottomNav';
import BottomNavSheet from './BottomNavSheet';
import { getGenreIcon } from '@/components/GenreIcons';
import { isChoseongMatch } from '@/lib/hangul';
import { useUserActivity } from '@/hooks/useUserActivity';
import { useRecommendation } from '@/hooks/useRecommendation';
import RecommendedSection from './performance/RecommendedSection';

const KakaoMapModal = dynamic(() => import('./KakaoMapModal'), { ssr: false });
const CalendarModal = dynamic(() => import('./CalendarModal'), { ssr: false });
const PerformanceDetailModal = dynamic(() => import('./PerformanceDetailModal'), { ssr: false });
const FavoriteVenuesModal = dynamic(() => import('./FavoriteVenuesModal'), { ssr: false });

import { useSearchParams, useRouter } from 'next/navigation';
import HeroSection from './performance/HeroSection';
import SkeletonGrid from './performance/SkeletonGrid';
import PerformanceGrid from './performance/PerformanceGrid';
import EmptyState from './performance/EmptyState';
import PerformanceCard from './performance/PerformanceCard';
import PerformanceListItem from './performance/PerformanceListItem';
import { getDistanceFromLatLonInKm } from '@/lib/utils';
import ErrorBoundary from './ErrorBoundary';
import { HERO_TEMPLATES, HeroTemplate } from '@/lib/hero-templates';
import FilterBar from './performance/FilterBar';
import { filterPerformances, sortPerformances } from '@/lib/performance-filter';

interface Venue {
    name: string;
    address: string;
    district?: string;
    lat?: number;
    lng?: number;
}

const venues = venueData as Record<string, Venue>;

interface PerformanceListProps {
    initialPerformances: Performance[]; // First 24 items
    lastUpdated: string;
    initialGenre?: string;
    isCategoryPage?: boolean;
    categoryLabel?: string;
}

export default function PerformanceList({ initialPerformances, lastUpdated, initialGenre = 'all', isCategoryPage = false, categoryLabel }: PerformanceListProps) {

    // --- State ---

    // Data (Hybrid: Initial -> Fetched Full)
    const [allPerformances, setAllPerformances] = useState<Performance[]>(initialPerformances);
    const [isDataFullyLoaded, setIsDataFullyLoaded] = useState(false);
    const [visibleCount, setVisibleCount] = useState(24);

    // Filters
    const [selectedGenre, setSelectedGenre] = useState<string>(initialGenre);
    const [selectedRegion, setSelectedRegion] = useState<string>('all');
    const [selectedDistrict, setSelectedDistrict] = useState<string>('all');
    const [selectedVenue, setSelectedVenue] = useState<string>('all');
    const [searchText, setSearchText] = useState('');
    const [searchLocation, setSearchLocation] = useState<{ lat: number, lng: number, name: string } | null>(null);
    const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [userAddress, setUserAddress] = useState<string | null>(null);
    const [radius, setRadius] = useState<number>(10);

    // View & Layout
    const [viewMode, setViewMode] = useState<string>('grid');
    const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');
    const [isMapOpen, setIsMapOpen] = useState(false);
    const [activeBottomMenu, setActiveBottomMenu] = useState<BottomMenuType>(null);

    // User Preferences
    const [likedIds, setLikedIds] = useState<string[]>([]);
    const [favoriteVenues, setFavoriteVenues] = useState<string[]>([]);
    const [savedKeywords, setSavedKeywords] = useState<string[]>([]);
    const [isStorageLoaded, setIsStorageLoaded] = useState(false);

    // UI Toggles
    const [isHeroFilterExpanded, setIsHeroFilterExpanded] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [activeSearchSource, setActiveSearchSource] = useState<'hero' | 'sticky'>('hero');
    const [isHeroVisible, setIsHeroVisible] = useState(true);

    // Deep Linking
    const router = useRouter();


    // --- 1. Async Data Fetch (Static JSON) ---
    useEffect(() => {
        const loadAllData = async () => {
            try {
                // Static Fetch (GitHub Pages compatible)
                const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
                const res = await fetch(`${basePath}/data/performances.json`);
                if (!res.ok) throw new Error('Failed to load data');
                const data: Performance[] = await res.json();

                // Merge/Replace initial
                setAllPerformances(data);
                setIsDataFullyLoaded(true);
            } catch (e) {
                console.error("Background data load failed", e);
            }
        };

        // Delay slightly to prioritize rendering
        const timer = setTimeout(() => {
            loadAllData();
        }, 500);
        return () => clearTimeout(timer);
    }, []);


    // --- 2. Filtering & Sorting (Client Side) ---
    const filteredPerformances = useMemo(() => {
        if (!isDataFullyLoaded) {
            // While loading, just filter the initial 24 items provided (fallback)
            // or show loading? Better to show what we have.
            return initialPerformances;
        }

        // Use shared logic
        const filtered = filterPerformances(allPerformances, {
            genre: selectedGenre,
            region: selectedRegion,
            district: selectedDistrict,
            venue: selectedVenue,
            search: searchText,
            lat: searchLocation?.lat || userLocation?.lat,
            lng: searchLocation?.lng || userLocation?.lng,
            radius: radius
        });

        // Sort
        return sortPerformances(filtered, selectedGenre);

    }, [allPerformances, isDataFullyLoaded, initialPerformances, selectedGenre, selectedRegion, selectedDistrict, selectedVenue, searchText, searchLocation, userLocation, radius]);


    // --- 3. Pagination (Virtual "Infinite Scroll") ---
    const displayPerformances = useMemo(() => {
        return filteredPerformances.slice(0, visibleCount);
    }, [filteredPerformances, visibleCount]);

    const hasMore = visibleCount < filteredPerformances.length;

    // Reset pagination on filter change
    useEffect(() => {
        setVisibleCount(24);
    }, [selectedGenre, selectedRegion, selectedDistrict, selectedVenue, searchText]);


    // Infinite Scroll Observer
    const observerTarget = useRef<HTMLDivElement>(null);
    const loadMore = useCallback(() => {
        setVisibleCount(prev => prev + 24);
    }, []);

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && hasMore) {
                    loadMore();
                }
            },
            { threshold: 0.1, rootMargin: '500px' }
        );

        if (observerTarget.current) observer.observe(observerTarget.current);
        return () => {
            if (observerTarget.current) observer.unobserve(observerTarget.current);
        };
    }, [hasMore, loadMore]);


    // --- Local Storage Loading ---
    useEffect(() => {
        setSavedKeywords(safeStorage.get<string[]>('culture_keywords', []));
        setLikedIds(safeStorage.get<string[]>('culture_likes', []));
        setFavoriteVenues(safeStorage.get<string[]>('culture_favorite_venues', []));

        const storedViewMode = safeStorage.get<string>('culture_view_mode', 'grid');
        setViewMode(storedViewMode);
        if (storedViewMode === 'list' || storedViewMode === 'grid') setLayoutMode(storedViewMode as 'list' | 'grid');

        setIsStorageLoaded(true);
    }, []);

    useEffect(() => { if (isStorageLoaded) safeStorage.set('culture_likes', likedIds); }, [likedIds, isStorageLoaded]);
    useEffect(() => { if (isStorageLoaded) safeStorage.set('culture_favorite_venues', favoriteVenues); }, [favoriteVenues, isStorageLoaded]);
    useEffect(() => { if (isStorageLoaded) safeStorage.set('culture_keywords', savedKeywords); }, [savedKeywords, isStorageLoaded]);
    useEffect(() => { if (isStorageLoaded) safeStorage.set('culture_view_mode', viewMode); }, [viewMode, isStorageLoaded]);


    // --- Handlers ---

    const toggleLike = (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setLikedIds(prev => prev.includes(id) ? prev.filter(lid => lid !== id) : [...prev, id]);
    };

    const toggleFavoriteVenue = (venueName: string) => {
        setFavoriteVenues(prev => prev.includes(venueName) ? prev.filter(v => v !== venueName) : [...prev, venueName]);
    };

    const handleDetailOpen = (perf: Performance) => {
        window.open(perf.link, '_blank');
    };

    const copyItemShareUrl = async (id: string) => {
        const url = `${window.location.origin}${window.location.pathname}#p=${id}`;
        await navigator.clipboard.writeText(url);
        alert('링크가 복사되었습니다.');
        return true;
    };

    // Stub Hero Text
    const [heroText, setHeroText] = useState<HeroTemplate>(HERO_TEMPLATES.general[0]);

    return (
        <div className="min-h-screen bg-gray-900 light:bg-white text-white light:text-black">

            {/* 1. Header & Hero */}
            <ErrorBoundary fallback={<div>Header Error</div>}>
                <HeroSection
                    heroText={heroText}
                    onCycle={() => { }}
                    isHeroVisible={isHeroVisible}
                    viewMode={viewMode}
                    selectedGenre={selectedGenre}
                    selectedRegion={selectedRegion}
                    selectedDistrict={selectedDistrict}
                    selectedVenue={selectedVenue}
                    activeLocation={searchLocation || userLocation ? { name: searchLocation?.name || userAddress || '내 위치' } : null}
                    userAddress={userAddress}
                    radius={radius}
                    lastUpdated={lastUpdated}
                    searchLocation={searchLocation}
                    searchText={searchText}
                    searchResults={[]}
                    isDropdownOpen={isDropdownOpen}
                    activeSearchSource={activeSearchSource}
                    highlightedIndex={-1}

                    setIsHeroFilterExpanded={setIsHeroFilterExpanded}
                    isHeroFilterExpanded={isHeroFilterExpanded}
                    setSelectedRegion={setSelectedRegion}
                    setSelectedDistrict={setSelectedDistrict}
                    setSelectedVenue={setSelectedVenue}
                    setUserLocation={setUserLocation}
                    setSearchLocation={setSearchLocation}
                    setRadius={setRadius}
                    setSearchText={setSearchText}
                    setActiveSearchSource={setActiveSearchSource}
                    setIsDropdownOpen={setIsDropdownOpen}
                    handleSearch={() => { }} // No auto fetch, happens via Effect
                    handleSelectResult={(res) => {
                        setSearchLocation(res);
                        setSearchText('');
                        setIsDropdownOpen(false);
                    }}
                    handleKeyDown={() => { }}
                    handleCurrentLocationClick={() => { }}

                    availableVenues={[]}
                    districts={[]}

                    recentKeywords={savedKeywords}
                    onKeywordSelect={(k) => { setSearchText(k); }}
                    onRemoveRecent={() => { }}
                    onClearRecent={() => { }}
                />
            </ErrorBoundary>

            {/* 2. Sticky Filter Bar */}
            <div className="sticky top-0 z-40 bg-gray-900/95 light:bg-white/95 backdrop-blur-md border-b border-white/5 light:border-black/5">
                <div className="max-w-7xl 2xl:max-w-[1800px] mx-auto px-4 py-2">
                    <FilterBar
                        isSticky={true}
                        selectedGenre={selectedGenre}
                        onGenreChange={setSelectedGenre}
                        selectedRegion={selectedRegion}
                        onRegionChange={setSelectedRegion}
                        totalCount={filteredPerformances.length}
                        isLoading={!isDataFullyLoaded}
                    />
                </div>
            </div>

            {/* 3. Main Content (Grid/List) */}
            <main className="max-w-7xl 2xl:max-w-[1800px] mx-auto px-4 py-6 min-h-[50vh]">
                {filteredPerformances.length === 0 && isDataFullyLoaded ? (
                    <EmptyState
                        viewMode={viewMode}
                        selectedGenre={selectedGenre}
                        setSelectedRegion={setSelectedRegion}
                        setSelectedDistrict={setSelectedDistrict}
                        setSearchText={setSearchText}
                        setUserLocation={setUserLocation}
                        setIsMapOpen={setIsMapOpen}
                    />
                ) : (
                    <PerformanceGrid
                        items={displayPerformances} // Sliced
                        hasMore={hasMore}
                        observerRef={observerTarget}
                        layoutMode={layoutMode}
                        selectedVenue={selectedVenue}
                        activeLocation={searchLocation || userLocation}
                        venues={venues}
                        likedIds={likedIds}
                        onToggleLike={toggleLike}
                        handleDetailOpen={handleDetailOpen}
                        setSearchLocation={setSearchLocation}
                        setIsMapOpen={setIsMapOpen}
                        copyItemShareUrl={copyItemShareUrl}
                        selectedGenre={selectedGenre}
                        viewMode={viewMode}
                    />
                )}

                {!isDataFullyLoaded && (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                        <span className="ml-2 text-sm text-gray-500">전체 데이터 불러오는 중...</span>
                    </div>
                )}
            </main>

            {/* 4. Modals */}
            {isMapOpen && (
                <KakaoMapModal
                    performances={filteredPerformances} // Pass full filtered list to Map
                    centerLocation={searchLocation || (selectedVenue !== 'all' && venues[selectedVenue] ? { lat: venues[selectedVenue].lat!, lng: venues[selectedVenue].lng!, name: selectedVenue } : null)}
                    favoriteVenues={favoriteVenues}
                    onToggleFavorite={toggleFavoriteVenue}
                    onClose={() => setIsMapOpen(false)}
                    onVenueLocationChange={(name, lat, lng) => setSearchLocation({ name, lat, lng })}
                />
            )}

            <BottomNavSheet
                activeMenu={activeBottomMenu}
                onClose={() => setActiveBottomMenu(null)}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                selectedGenre={selectedGenre}
                onGenreSelect={setSelectedGenre}
                selectedRegion={selectedRegion}
                onRegionSelect={setSelectedRegion}
                selectedDistrict={selectedDistrict}
                onDistrictSelect={setSelectedDistrict}
                selectedVenue={selectedVenue}
                onVenueSelect={setSelectedVenue}
                searchText={searchText}
                onSearchChange={setSearchText}
                keywords={savedKeywords}
                onKeywordAdd={(k) => setSavedKeywords(prev => [...prev, k])}
                onKeywordRemove={(k) => setSavedKeywords(prev => prev.filter(w => w !== k))}
                districts={[]}
                availableVenues={Object.keys(venues)}
                onSearch={() => { }}
            />

            <BottomNav
                activeMenu={activeBottomMenu}
                currentViewMode={viewMode}
                onMenuClick={setActiveBottomMenu}
                onLikePerfClick={() => setViewMode('likes-perf')}
                onLikeVenueClick={() => setViewMode('likes-venue')}
                likeCount={likedIds.length}
                venueCount={favoriteVenues.length}
                selectedGenre={selectedGenre}
            />

        </div>
    );
}
