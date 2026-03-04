'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Performance } from '@/types';
import { MapPin, Bell, Sun, Moon, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import Image from 'next/image';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { GENRES, RADIUS_OPTIONS } from '@/lib/constants';
import { useRouter, useSearchParams } from 'next/navigation';

// Atomic Components
import AlarmPanel from './performance/list/AlarmPanel';
import ResultsHeader from './performance/list/ResultsHeader';
import LikedSections from './performance/list/LikedSections';
import HeroSection from './performance/HeroSection';
import PerformanceGrid from './performance/PerformanceGrid';
import EmptyState from './performance/EmptyState';
import RecommendedSection from './performance/RecommendedSection';
import KeywordSection from './performance/KeywordSection';
import RainbowBackground from './ui/RainbowBackground';
import ErrorBoundary from './ErrorBoundary';
import BottomNav, { BottomMenuType } from './BottomNav';
import BottomNavSheet from './BottomNavSheet';

// Custom Hooks
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { usePerformanceData } from '@/hooks/usePerformanceData';
import { useSearchLogic } from '@/hooks/useSearchLogic';
import { usePerformanceFilters } from '@/hooks/usePerformanceFilters';
import { useHeroTemplates } from '@/hooks/useHeroTemplates';

// Dynamic Modals for Code Splitting
const KakaoMapModal = dynamic(() => import('./KakaoMapModal'), { ssr: false });
const CalendarModal = dynamic(() => import('./CalendarModal'), { ssr: false });
const FavoriteVenuesModal = dynamic(() => import('./FavoriteVenuesModal'), { ssr: false });
const SharedDetailModal = dynamic(() => import('./SharedDetailModal'), { ssr: false });

interface PerformanceListProps {
    initialPerformances: Performance[];
    lastUpdated: string;
    initialGenre?: string;
    isCategoryPage?: boolean;
    categoryLabel?: string;
}

export default function PerformanceList({
    initialPerformances,
    lastUpdated,
    initialGenre = 'all',
    isCategoryPage = false,
    categoryLabel
}: PerformanceListProps) {
    const router = useRouter();
    const [focusVenue, setFocusVenue] = useState<{ lat: number, lng: number, name: string } | null>(null);

    // --- Custom Hooks (Modular Logic) ---
    const {
        likedIds, favoriteVenues, savedKeywords, setSavedKeywords, theme, toggleTheme,
        toggleLike, toggleFavoriteVenue, addKeyword, removeKeyword
    } = useUserPreferences();

    const { allPerformances, setAllPerformances, cinemas, venues, isDataFullyLoaded } = usePerformanceData({ initialPerformances });

    const searchParams = useSearchParams();
    const initialQuery = searchParams.get('q') || '';

    const {
        searchText, setSearchText, searchMode, setSearchMode, searchLocation, setSearchLocation,
        userLocation, setUserLocation, userAddress, radius, setRadius, isDropdownOpen, setIsDropdownOpen,
        highlightedIndex, setHighlightedIndex, searchResults
    } = useSearchLogic({ allPerformances, initialSearchText: initialQuery });

    const {
        selectedGenre, setSelectedGenre, selectedRegion, setSelectedRegion,
        selectedDistrict, setSelectedDistrict, selectedVenue, setSelectedVenue,
        setShuffleSeed, districts, availableVenues, filteredPerformances, displayPerformances,
        hasMore, loadMore
    } = usePerformanceFilters({
        allPerformances, initialGenre, searchMode, searchText, searchLocation, userLocation, radius, venues
    });

    const { heroText, selectNextTemplate } = useHeroTemplates({ allPerformances, initialPerformances, searchMode });

    // --- View State ---
    const [viewMode, setViewMode] = useState<string>('grid');
    const [savedScrollPosition, setSavedScrollPosition] = useState(0);
    const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');
    const [isMapOpen, setIsMapOpen] = useState(false);
    const [activeBottomMenu, setActiveBottomMenu] = useState<BottomMenuType>(null);
    const [isHeroFilterExpanded, setIsHeroFilterExpanded] = useState(false);
    const [activeSearchSource, setActiveSearchSource] = useState<'hero' | 'sticky'>('hero');
    const [showFavoriteListModal, setShowFavoriteListModal] = useState(false);
    const [isHeroVisible, setIsHeroVisible] = useState(true);
    const [isAlarmOpen, setIsAlarmOpen] = useState(false);
    const [keywordInput, setKeywordInput] = useState('');
    const [sharedPerf, setSharedPerf] = useState<Performance | null>(null);
    const observerTarget = useRef<HTMLDivElement>(null);
    const deepLinkHandled = useRef(false);

    // --- Derived State ---
    const activeLocation = searchLocation || userLocation;

    const keywordItems = useMemo(() => {
        if (!savedKeywords.length || !allPerformances.length) return [];
        return allPerformances.filter(p =>
            savedKeywords.some(k =>
                (p.title || '').includes(k) || (p.genre || '').includes(k) || (p.venue || '').includes(k)
            )
        ).slice(0, 15);
    }, [savedKeywords, allPerformances]);

    const recommendedItems = useMemo(() => {
        // Simple mock for now, can be sophisticated later
        return allPerformances.slice(0, 10);
    }, [allPerformances]);

    // --- Handlers ---
    const handleDetailOpen = useCallback((perf: Performance) => window.open(perf.link, '_blank'), []);

    const copyItemShareUrl = useCallback(async (id: string) => {
        const url = `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH || ''}/p/${id}/`;
        await navigator.clipboard.writeText(url);
        alert('링크가 복사되었습니다.');
        return true;
    }, []);

    const handleSearchChange = useCallback((text: string) => {
        setSearchText(text);
        if (text.trim().length > 0) {
            setSelectedGenre('all');
            setSelectedRegion('all');
            setSelectedDistrict('all');
            setSelectedVenue('all');
        } else {
            // If cleared manually, remove from URL
            if (searchParams.has('q')) {
                const path = window.location.pathname;
                router.replace(path);
            }
        }
    }, [setSearchText, setSelectedGenre, setSelectedRegion, setSelectedDistrict, setSelectedVenue, searchParams, router]);

    const resetHome = useCallback(() => {
        setSelectedGenre('all');
        setSelectedRegion('all');
        setSelectedDistrict('all');
        setSelectedVenue('all');
        setSearchLocation(null);
        setSearchText('');
        setViewMode('grid');
        if (searchParams.has('q')) {
            router.replace('/');
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [setSelectedGenre, setSelectedRegion, setSelectedDistrict, setSelectedVenue, setSearchLocation, setSearchText, setViewMode, searchParams, router]);

    const handleGenreSelect = useCallback((g: string) => {
        setSelectedGenre(g);
        if (g !== 'movie') setShuffleSeed(Date.now());
        if (viewMode === 'likes-perf') setViewMode('grid');

        // Prevent navigation if we are in calendar mode (prevents modal closing)
        if (viewMode !== 'calendar') {
            const path = g === 'all' ? '/' : `/${g === 'play' ? 'theater' : g}`;
            if (searchText) {
                router.push(`${path}?q=${encodeURIComponent(searchText)}`);
            } else {
                router.push(path);
            }
        }
    }, [setSelectedGenre, setShuffleSeed, viewMode, setViewMode, router, searchText]);

    const handleLikePerfClick = useCallback(() => {
        if (viewMode === 'likes-perf') {
            setViewMode('grid');
            setTimeout(() => window.scrollTo({ top: savedScrollPosition, behavior: 'auto' }), 10);
        } else {
            setSavedScrollPosition(window.scrollY);
            setViewMode('likes-perf');
            setTimeout(() => window.scrollTo({ top: 0, behavior: 'auto' }), 10);
        }
    }, [viewMode, setViewMode, savedScrollPosition, setSavedScrollPosition]);

    // --- Effects (Lifecycle & Logic) ---

    // 1. Infinite Scroll Observer
    useEffect(() => {
        if (!observerTarget.current) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore) {
                    loadMore();
                }
            },
            { threshold: 0.1, rootMargin: '100px' }
        );

        observer.observe(observerTarget.current);
        return () => observer.disconnect();
    }, [hasMore, loadMore]);

    // 2. Deep Link Support (Shared Content Modal)
    useEffect(() => {
        if (deepLinkHandled.current || !allPerformances.length) return;

        const hash = window.location.hash;
        const match = hash.match(/^#p=(.+)$/);
        if (match && match[1]) {
            const id = decodeURIComponent(match[1]);
            const perf = allPerformances.find(p => p.id === id);
            if (perf) {
                setSharedPerf(perf);
                deepLinkHandled.current = true;
                // Clean the hash from the URL so it doesn't reopen on refresh
                window.history.replaceState(null, '', window.location.pathname + window.location.search);
            }
        }
    }, [allPerformances]);

    return (
        <div className="min-h-screen bg-transparent text-white light:text-black">
            <RainbowBackground />
            <div className="noise-texture z-0 mix-blend-overlay opacity-20 fixed inset-0 pointer-events-none"></div>

            {/* 1. Header & Alarm Panel */}
            <header className="relative z-40 bg-transparent border-b border-transparent light:border-transparent">
                <div className="max-w-7xl 2xl:max-w-[1800px] mx-auto px-4 h-16 sm:h-20 flex items-center justify-between">
                    <Link
                        href="/"
                        className="flex items-center gap-3 cursor-pointer group pointer-events-auto"
                        onClick={(e) => {
                            e.preventDefault();
                            resetHome();
                            router.push('/');
                        }}
                    >
                        <div className="relative w-10 h-10 transition-transform group-hover:scale-110">
                            <Image src="/culture/images/ticket_icon.png" alt="Icon" fill className="object-cover" priority />
                        </div>
                        <h1 className="text-[1.5rem] md:text-3xl font-black tracking-tight group-hover:text-[#a78bfa] transition-colors leading-[0.9]">
                            Culture Flow
                        </h1>
                    </Link>

                    <div className="flex items-center gap-1">
                        <button onClick={toggleTheme} className="p-2 rounded-full text-gray-400 light:text-gray-500 hover:text-white light:hover:text-black">
                            {theme === 'dark' ? <Sun size={24} /> : <Moon size={24} />}
                        </button>
                        <button onClick={() => setIsAlarmOpen(!isAlarmOpen)} className={clsx("p-2 rounded-full", isAlarmOpen ? "text-purple-300" : "text-gray-400")}>
                            <Bell size={24} className={clsx(isAlarmOpen && "animate-pulse")} />
                        </button>
                    </div>
                </div>
            </header>

            <AlarmPanel
                isOpen={isAlarmOpen} onClose={() => setIsAlarmOpen(false)} keywordInput={keywordInput}
                onKeywordInputChange={setKeywordInput} onAddKeyword={addKeyword} savedKeywords={savedKeywords} onRemoveKeyword={removeKeyword}
            />

            {/* 2. Hero Section */}
            <ErrorBoundary fallback={<div>Hero Error</div>}>
                <HeroSection
                    heroText={heroText} onCycle={selectNextTemplate} isHeroVisible={isHeroVisible} viewMode={viewMode} selectedGenre={selectedGenre}
                    selectedRegion={selectedRegion} selectedDistrict={selectedDistrict} selectedVenue={selectedVenue}
                    activeLocation={activeLocation ? { name: searchLocation?.name || '내 위치' } : null}
                    userAddress={userAddress} radius={radius} lastUpdated={lastUpdated} searchLocation={searchLocation} searchText={searchText}
                    searchResults={searchResults} isDropdownOpen={isDropdownOpen} activeSearchSource={activeSearchSource} highlightedIndex={highlightedIndex}
                    setIsHeroFilterExpanded={setIsHeroFilterExpanded} isHeroFilterExpanded={isHeroFilterExpanded} setSelectedRegion={setSelectedRegion}
                    setSelectedDistrict={setSelectedDistrict} setSelectedVenue={setSelectedVenue} setUserLocation={setUserLocation}
                    setSearchLocation={setSearchLocation} setRadius={setRadius} setSearchText={setSearchText} onSearchChange={handleSearchChange}
                    setActiveSearchSource={setActiveSearchSource} setIsDropdownOpen={setIsDropdownOpen} handleSearch={() => { }}
                    handleSelectResult={(res: any) => {
                        setSearchText(res.name);
                        setIsDropdownOpen(false);
                        if (selectedGenre !== 'all') handleGenreSelect('all');
                    }}
                    handleKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === 'Enter') {
                            if (selectedGenre !== 'all') handleGenreSelect('all');
                        }
                    }} handleCurrentLocationClick={() => { setUserLocation(null); setSearchLocation(null); }}
                    availableVenues={availableVenues} districts={districts} recentKeywords={savedKeywords}
                    onKeywordSelect={(k) => {
                        setSearchText(k);
                        if (selectedGenre !== 'all') handleGenreSelect('all');
                    }} onRemoveRecent={removeKeyword} onClearRecent={() => setSavedKeywords([])}
                    searchMode={searchMode} onSearchModeChange={setSearchMode}
                />
            </ErrorBoundary>

            {/* Data Sections */}
            {(viewMode === 'grid' || viewMode === 'list') && !searchText && !searchLocation && selectedGenre === 'all' && (
                <div className="max-w-7xl 2xl:max-w-[1800px] mx-auto mt-14 px-4 space-y-14 relative z-10">
                    {keywordItems.length > 0 && <KeywordSection keywordItems={keywordItems} onDetail={handleDetailOpen} onLocationClick={setSearchLocation} onToggleLike={toggleLike} likedIds={new Set(likedIds)} searchMode={searchMode} />}
                    <RecommendedSection recommendedItems={recommendedItems} onDetail={handleDetailOpen} onLocationClick={setSearchLocation} onToggleLike={toggleLike} likedIds={new Set(likedIds)} searchMode={searchMode} />
                </div>
            )}

            {/* 3. Main Content */}
            <main className="max-w-7xl 2xl:max-w-[1800px] mx-auto px-4 py-8 relative z-10">
                <div className="px-[1.6%]">
                    <ResultsHeader
                        viewMode={viewMode} activeLocation={activeLocation} searchLocation={searchLocation} searchText={searchText}
                        searchMode={searchMode} selectedGenre={selectedGenre} filteredCount={filteredPerformances.length} radius={radius}
                        onResetFilters={() => { setSearchLocation(null); setSearchText(''); }} onRadiusChange={setRadius}
                    />

                    {filteredPerformances.length === 0 && viewMode !== 'likes-perf' && isDataFullyLoaded ? (
                        <EmptyState viewMode={viewMode} selectedGenre={selectedGenre} setSelectedRegion={setSelectedRegion} setSelectedDistrict={setSelectedDistrict} setSearchText={setSearchText} setUserLocation={setUserLocation} setIsMapOpen={setIsMapOpen} searchMode={searchMode} setSearchMode={setSearchMode} searchText={searchText} />
                    ) : viewMode === 'likes-perf' ? (
                        <LikedSections
                            viewMode={viewMode} allPerformances={allPerformances} likedIds={likedIds} favoriteVenues={favoriteVenues}
                            venues={venues} onToggleLike={toggleLike} onDetailOpen={handleDetailOpen} onSetSearchLocation={setSearchLocation}
                            onVenuePreview={(loc) => { setFocusVenue(loc); setIsMapOpen(true); }} setIsMapOpen={setIsMapOpen}
                            copyItemShareUrl={copyItemShareUrl} selectedGenre={selectedGenre} searchMode={searchMode} searchText={searchText}
                            setShowFavoriteListModal={setShowFavoriteListModal} layoutMode={layoutMode}
                        />
                    ) : (
                        <PerformanceGrid
                            items={displayPerformances}
                            hasMore={hasMore}
                            observerRef={observerTarget}
                            layoutMode={layoutMode}
                            selectedVenue={selectedVenue}
                            activeLocation={activeLocation}
                            venues={venues}
                            likedIds={likedIds}
                            onToggleLike={toggleLike}
                            handleDetailOpen={handleDetailOpen}
                            setSearchLocation={setSearchLocation}
                            onVenuePreview={(loc) => { setFocusVenue(loc); setIsMapOpen(true); }}
                            setIsMapOpen={setIsMapOpen}
                            copyItemShareUrl={copyItemShareUrl}
                            selectedGenre={selectedGenre}
                            viewMode={viewMode}
                            searchMode={searchMode}
                            searchText={searchText}
                        />
                    )}

                    {!isDataFullyLoaded && (
                        <div className="flex justify-center py-12">
                            <Loader2 className="animate-spin text-purple-500" />
                            <span className="ml-3 text-gray-400">데이터를 불러오는 중...</span>
                        </div>
                    )}
                </div>
            </main>

            {/* 4. Navigation & Modals */}
            <BottomNav activeMenu={activeBottomMenu} currentViewMode={viewMode} onMenuClick={setActiveBottomMenu} onLikePerfClick={handleLikePerfClick} onMapClick={() => { setIsMapOpen(true); }} onCalendarClick={() => setViewMode(viewMode === 'calendar' ? 'grid' : 'calendar')} likeCount={likedIds.length} venueCount={favoriteVenues.length} selectedGenre={selectedGenre} searchMode={searchMode} />

            <BottomNavSheet activeMenu={activeBottomMenu} onClose={() => setActiveBottomMenu(null)} viewMode={viewMode} onViewModeChange={setViewMode} selectedGenre={selectedGenre} onGenreSelect={handleGenreSelect} selectedRegion={selectedRegion} onRegionSelect={setSelectedRegion} selectedDistrict={selectedDistrict} onDistrictSelect={setSelectedDistrict} selectedVenue={selectedVenue} onVenueSelect={setSelectedVenue} searchText={searchText} onSearchChange={handleSearchChange} keywords={savedKeywords} onKeywordAdd={addKeyword} onKeywordRemove={removeKeyword} districts={districts} availableVenues={availableVenues} onSearch={() => { }} searchMode={searchMode} onSearchModeChange={setSearchMode} activeLocation={activeLocation} searchResults={searchResults} onResultSelect={(res) => { setSearchText(res.name); }} />

            {isMapOpen && (
                <KakaoMapModal
                    performances={filteredPerformances} // ALWAYS pass filtered to ensure map markers match the grid feed exactly
                    cinemas={selectedGenre === 'movie' ? cinemas : []}
                    selectedGenre={selectedGenre}
                    searchMode={searchMode}
                    searchText={searchText}
                    centerLocation={
                        focusVenue ||
                        searchLocation ||
                        (selectedGenre === 'movie' ? (userLocation ? { ...userLocation, name: '내 위치' } : { lat: 37.554648, lng: 126.972559, name: '서울역' }) : null)
                    }
                    favoriteVenues={favoriteVenues}
                    onToggleFavorite={toggleFavoriteVenue}
                    onClose={() => {
                        setIsMapOpen(false);
                        setFocusVenue(null);
                    }}
                    onVenueLocationChange={(name, lat, lng) => {
                        setSearchLocation({ name, lat, lng });
                        setIsMapOpen(false);
                    }}
                    onMapSearchHere={(lat, lng, venueName) => {
                        setSearchMode('location');
                        setSearchLocation({
                            name: venueName ? `${venueName} 주변` : '지도 탐색 위치',
                            lat,
                            lng
                        });
                    }}
                />
            )}
            {showFavoriteListModal && <FavoriteVenuesModal isOpen={showFavoriteListModal} onClose={() => setShowFavoriteListModal(false)} favoriteVenues={favoriteVenues} onRemove={toggleFavoriteVenue} onVenueClick={(name) => { setFocusVenue({ lat: venues[name]?.lat || 0, lng: venues[name]?.lng || 0, name }); setIsMapOpen(true); }} />}
            {viewMode === 'calendar' && <CalendarModal performances={allPerformances} onClose={() => setViewMode('grid')} selectedGenre={selectedGenre} onGenreSelect={handleGenreSelect} />}
            {sharedPerf && <SharedDetailModal performance={sharedPerf} onClose={() => setSharedPerf(null)} />}
        </div>
    );
}
