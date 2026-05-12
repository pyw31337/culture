'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { DiscoveryContextId, Performance } from '@/types';
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
import PersonalizedSection from './performance/PersonalizedSection';
import RainbowBackground from './ui/RainbowBackground';
import ErrorBoundary from './ErrorBoundary';
import BottomNav, { BottomMenuType } from './BottomNav';
import BottomNavSheet from './BottomNavSheet';
import { buildGenreCounts, getAvailableGenres, isGenreAvailable, type GenreCounts } from '@/lib/genre-availability';
import { formatCompactKoreanDateTime, type DataBuildInfo } from '@/lib/build-info';
import { getRepresentativeVenueInfoForFavorite } from '@/lib/favorite-venues';
import { getKeywordMatchedItems } from '@/lib/keyword-match';
import { getRepresentativeVenueInfoForName } from '@/lib/location-display';
import { getFeaturedPerformances } from '@/lib/performance-filter';
import { buildCuratedDiscoveryItems, buildPersonalizedRecommendations, DISCOVERY_CONTEXTS } from '@/lib/discovery';

// Custom Hooks
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { usePerformanceData } from '@/hooks/usePerformanceData';
import { useSearchLogic } from '@/hooks/useSearchLogic';
import { usePerformanceFilters } from '@/hooks/usePerformanceFilters';
import { useHeroTemplates } from '@/hooks/useHeroTemplates';
import { useUserActivity } from '@/hooks/useUserActivity';

// Dynamic Modals for Code Splitting (Map & Calendar are now separate pages)
const FavoriteVenuesModal = dynamic(() => import('./FavoriteVenuesModal'), { ssr: false });
const SharedDetailModal = dynamic(() => import('./SharedDetailModal'), { ssr: false });

interface PerformanceListProps {
    initialPerformances: Performance[];
    lastUpdated: string;
    initialGenre?: string;
    initialGenreCounts?: GenreCounts;
    buildInfo?: DataBuildInfo | null;
    isCategoryPage?: boolean;
    categoryLabel?: string;
}

export default function PerformanceList({
    initialPerformances,
    lastUpdated,
    initialGenre = 'all',
    initialGenreCounts,
    buildInfo,
    isCategoryPage = false,
    categoryLabel
}: PerformanceListProps) {
    const router = useRouter();

    // --- Custom Hooks (Modular Logic) ---
    const {
        likedIds, favoriteVenues, savedKeywords, setSavedKeywords, theme, toggleTheme,
        toggleLike, toggleFavoriteVenue, addKeyword, removeKeyword
    } = useUserPreferences();
    const { activity, trackGenreView, trackItemView } = useUserActivity();

    const { allPerformances, venues, isDataFullyLoaded } = usePerformanceData({
        initialPerformances,
        performanceLoadPolicy: isCategoryPage ? 'initial-only' : 'full',
        backgroundLoadPriority: 'deferred',
        loadVenues: true,
    });

    const searchParams = useSearchParams();
    const initialQuery = searchParams.get('q') || '';
    const urlMode = searchParams.get('mode') as 'keyword' | 'location' | null;
    const urlLat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : null;
    const urlLng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : null;
    const urlVenue = searchParams.get('venue') || '';

    const {
        searchText, setSearchText, searchMode, setSearchMode, searchLocation, setSearchLocation,
        userLocation, setUserLocation, userAddress, radius, setRadius, isDropdownOpen, setIsDropdownOpen,
        highlightedIndex, setHighlightedIndex, searchResults
    } = useSearchLogic({ allPerformances, initialSearchText: initialQuery });
    const [discoveryContextId, setDiscoveryContextId] = useState<DiscoveryContextId>('all');

    const {
        selectedGenre, setSelectedGenre, selectedRegion, setSelectedRegion,
        selectedDistrict, setSelectedDistrict, selectedVenue, setSelectedVenue,
        setShuffleSeed, districts, availableVenues, filteredPerformances, displayPerformances,
        hasMore, loadMore
    } = usePerformanceFilters({
        allPerformances, initialGenre, searchMode, searchText, searchLocation, userLocation, radius, venues, discoveryContextId
    });

    const { heroText, selectNextTemplate } = useHeroTemplates({ allPerformances, initialPerformances, searchMode });

    // --- View State ---
    const [viewMode, setViewMode] = useState<string>('grid');
    const [savedScrollPosition, setSavedScrollPosition] = useState(0);
    const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');

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
    const genreCounts = useMemo(() => {
        // Category pages intentionally keep a scoped item list, so the global
        // genre navigation should continue to use the build-time aggregate counts.
        if (isCategoryPage && initialGenreCounts && Object.keys(initialGenreCounts).length > 0) {
            return initialGenreCounts;
        }

        if (isDataFullyLoaded) return buildGenreCounts(allPerformances);
        if (initialGenreCounts && Object.keys(initialGenreCounts).length > 0) return initialGenreCounts;
        return buildGenreCounts(allPerformances);
    }, [allPerformances, initialGenreCounts, isCategoryPage, isDataFullyLoaded]);
    const availableGenres = useMemo(() => getAvailableGenres(genreCounts), [genreCounts]);
    const totalItemCount = useMemo(() => {
        if (buildInfo?.itemCount) return buildInfo.itemCount;
        return Object.values(genreCounts).reduce((sum, count) => sum + count, 0);
    }, [buildInfo?.itemCount, genreCounts]);
    const availableGenreCount = useMemo(() => {
        return availableGenres.filter((genre) => genre.id !== 'all').length;
    }, [availableGenres]);
    const freshnessNote = useMemo(() => {
        if (!buildInfo?.generatedAt) return '방금 정리한 추천 흐름이에요.';
        return `${formatCompactKoreanDateTime(buildInfo.generatedAt)} 기준으로 다시 정리했어요.`;
    }, [buildInfo?.generatedAt]);

    // Initialize from URL params (e.g., from map '공연 더보기' button or venue links)
    const lastUrlKey = useRef<string>('');
    useEffect(() => {
        const currentKey = `${urlMode}-${urlLat}-${urlLng}-${urlVenue}`;
        if (lastUrlKey.current === currentKey) return;
        
        if (urlMode === 'location' && urlLat && urlLng && urlVenue) {
            lastUrlKey.current = currentKey;
            setSearchMode('location');
            setSearchLocation({ lat: urlLat, lng: urlLng, name: urlVenue });
            setSearchText(urlVenue);
            if (searchParams.get('genre')) {
                setSelectedGenre(searchParams.get('genre')!);
            }
        }
    }, [urlMode, urlLat, urlLng, urlVenue, setSearchMode, setSearchLocation, setSearchText, setSelectedGenre, searchParams]);

    const keywordItems = useMemo(() => {
        if (!savedKeywords.length || !allPerformances.length) return [];
        return getKeywordMatchedItems(allPerformances, savedKeywords, 15);
    }, [savedKeywords, allPerformances]);

    const discoverySignals = useMemo(() => ({
        likedIds,
        favoriteVenues,
        savedKeywords,
        activity,
        buildInfo,
    }), [likedIds, favoriteVenues, savedKeywords, activity, buildInfo]);

    const personalizedItems = useMemo(() => {
        if (!allPerformances.length) return [];
        return buildPersonalizedRecommendations(allPerformances, discoverySignals, 12);
    }, [allPerformances, discoverySignals]);

    const recommendedItems = useMemo(() => {
        const featured = getFeaturedPerformances(allPerformances, 24);
        return buildCuratedDiscoveryItems(featured, discoverySignals, 18);
    }, [allPerformances, discoverySignals]);

    useEffect(() => {
        if (selectedGenre !== 'all' && !isGenreAvailable(genreCounts, selectedGenre)) {
            setSelectedGenre('all');
        }
    }, [genreCounts, selectedGenre, setSelectedGenre]);

    useEffect(() => {
        if (selectedGenre !== 'all') {
            trackGenreView(selectedGenre);
        }
    }, [selectedGenre, trackGenreView]);

    // --- Search Synchronization Helper ---
    const syncSearchToUrl = useCallback((
        q: string,
        mode: 'keyword' | 'location',
        loc: { lat: number, lng: number, name: string } | null,
        genre: string = selectedGenre
    ) => {
        const path = genre === 'all' ? '/' : `/${genre === 'play' ? 'theater' : genre}`;
        const params = new URLSearchParams();
        
        if (q.trim()) params.set('q', q.trim());
        params.set('mode', mode);

        if (mode === 'location' && loc) {
            params.set('lat', String(loc.lat));
            params.set('lng', String(loc.lng));
            params.set('venue', loc.name);
        }

        router.push(`${path}?${params.toString()}`);
    }, [router, selectedGenre]);

    // --- Handlers ---
    const handleDetailOpen = useCallback((perf: Performance) => {
        trackItemView(perf.id);
        router.push(`/p/${perf.id}/`);
    }, [router, trackItemView]);

    const copyItemShareUrl = useCallback(async (id: string) => {
        const url = `${window.location.origin}${process.env.NEXT_PUBLIC_BASE_PATH || ''}/p/${id}/`;
        await navigator.clipboard.writeText(url);
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
        setDiscoveryContextId('all');
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

        syncSearchToUrl(searchText, searchMode, searchLocation, g);
    }, [setSelectedGenre, setShuffleSeed, viewMode, setViewMode, syncSearchToUrl, searchText, searchMode, searchLocation]);

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

    const handleOpenMap = useCallback(() => {
        if (searchMode === 'location' && activeLocation) {
            const venueName = 'name' in activeLocation ? (activeLocation as any).name : '내 위치';
            router.push(`/map?genre=${selectedGenre}&mode=location&lat=${activeLocation.lat}&lng=${activeLocation.lng}&venue=${encodeURIComponent(venueName)}`);
        } else {
            router.push(`/map?genre=${selectedGenre}`);
        }
    }, [searchMode, activeLocation, selectedGenre, router]);

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
                            <Image src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/images/ticket_icon.png`} alt="Icon" fill className="object-cover" priority />
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
                    userAddress={userAddress} radius={radius} searchLocation={searchLocation} searchText={searchText}
                    searchResults={searchResults} isDropdownOpen={isDropdownOpen} activeSearchSource={activeSearchSource} highlightedIndex={highlightedIndex}
                    setIsHeroFilterExpanded={setIsHeroFilterExpanded} isHeroFilterExpanded={isHeroFilterExpanded} setSelectedRegion={setSelectedRegion}
                    setSelectedDistrict={setSelectedDistrict} setSelectedVenue={setSelectedVenue} setUserLocation={setUserLocation}
                    setSearchLocation={setSearchLocation} setRadius={setRadius} setSearchText={setSearchText} onSearchChange={handleSearchChange}
                    setActiveSearchSource={setActiveSearchSource} setIsDropdownOpen={setIsDropdownOpen} handleSearch={() => { }}
                    handleSelectResult={(res: any) => {
                        setSearchText(res.name);
                        
                        // Reset all filters for a clean keyword search
                        setSelectedGenre('all');
                        setSelectedRegion('all');
                        setSelectedDistrict('all');
                        setSelectedVenue('all');
                        setSearchLocation(null);
                        setSearchMode('keyword');

                        setIsDropdownOpen(false);
                        syncSearchToUrl(res.name, 'keyword', null, 'all');
                    }}
                    handleKeyDown={(e: React.KeyboardEvent) => {
                        if (e.key === 'Enter') {
                            // Reset all filters for a clean keyword search
                            setSelectedGenre('all');
                            setSelectedRegion('all');
                            setSelectedDistrict('all');
                            setSelectedVenue('all');
                            setSearchLocation(null);
                            setSearchMode('keyword');

                            syncSearchToUrl(searchText, 'keyword', null, 'all');
                        }
                    }} handleCurrentLocationClick={() => { setUserLocation(null); setSearchLocation(null); }}
                    availableVenues={availableVenues} districts={districts} recentKeywords={savedKeywords}
                    onKeywordSelect={(k) => {
                        setSearchText(k);
                        // Reset all filters for a clean keyword search
                        setSelectedGenre('all');
                        setSelectedRegion('all');
                        setSelectedDistrict('all');
                        setSelectedVenue('all');
                        setSearchLocation(null);
                        setSearchMode('keyword');

                        syncSearchToUrl(k, 'keyword', null, 'all');
                    }} onRemoveRecent={removeKeyword} onClearRecent={() => setSavedKeywords([])}
                    searchMode={searchMode} onSearchModeChange={(m) => {
                        setSearchMode(m);
                        syncSearchToUrl(searchText, m, searchLocation);
                    }}
                />
            </ErrorBoundary>

            {/* Data Sections */}
            {(viewMode === 'grid' || viewMode === 'list') && !searchText && !searchLocation && selectedGenre === 'all' && (
                <div className="max-w-7xl 2xl:max-w-[1800px] mx-auto mt-14 px-4 space-y-14 relative z-10">
                    {keywordItems.length > 0 && <KeywordSection keywordItems={keywordItems} onDetail={handleDetailOpen} searchMode={searchMode} />}
                    <PersonalizedSection
                        items={personalizedItems}
                        onDetail={handleDetailOpen}
                        searchMode={searchMode}
                        subtitle={`좋아요, 저장 키워드, 자주 본 장르, 찜한 공연장을 함께 읽어서 첫 화면을 조금 더 나답게 정리했어요. ${freshnessNote}`}
                    />
                    <RecommendedSection
                        recommendedItems={recommendedItems}
                        onDetail={handleDetailOpen}
                        onLocationClick={setSearchLocation}
                        onToggleLike={toggleLike}
                        likedIds={new Set(likedIds)}
                        searchMode={searchMode}
                        title="지금 주목할 콘텐츠"
                        subtitle={`이번 주에 보기 좋고, 시즌에도 잘 맞고, 장르가 한쪽으로 몰리지 않도록 고른 흐름입니다. ${freshnessNote}`}
                    />
                </div>
            )}

            {/* 3. Main Content */}
            <main className="max-w-7xl 2xl:max-w-[1800px] mx-auto px-4 py-8 relative z-10">
                <div className="px-[1.6%]">
                    <ResultsHeader
                        viewMode={viewMode} activeLocation={activeLocation} searchLocation={searchLocation} searchText={searchText}
                        searchMode={searchMode} selectedGenre={selectedGenre} filteredCount={filteredPerformances.length} radius={radius}
                        lastUpdated={lastUpdated}
                        totalItemCount={totalItemCount}
                        availableGenreCount={availableGenreCount}
                        qualitySummary={buildInfo?.qualitySummary}
                        sourceHealthSummary={buildInfo?.sourceHealthSummary}
                        discoveryContexts={DISCOVERY_CONTEXTS}
                        activeDiscoveryContext={discoveryContextId}
                        onDiscoveryContextChange={setDiscoveryContextId}
                        onResetFilters={() => { setSearchLocation(null); handleSearchChange(''); }} onRadiusChange={setRadius}
                    />

                    {filteredPerformances.length === 0 && viewMode !== 'likes-perf' && isDataFullyLoaded ? (
                        <EmptyState viewMode={viewMode} selectedGenre={selectedGenre} setSelectedRegion={setSelectedRegion} setSelectedDistrict={setSelectedDistrict} setSearchText={setSearchText} setUserLocation={setUserLocation} setIsMapOpen={handleOpenMap} searchMode={searchMode} setSearchMode={setSearchMode} searchText={searchText} />
                    ) : viewMode === 'likes-perf' ? (
                        <LikedSections
                            viewMode={viewMode} allPerformances={allPerformances} likedIds={likedIds} favoriteVenues={favoriteVenues}
                            venues={venues} onToggleLike={toggleLike} onDetailOpen={handleDetailOpen} onSetSearchLocation={setSearchLocation}
                            onVenuePreview={(loc) => { router.push(`/map?genre=${selectedGenre}&lat=${loc.lat}&lng=${loc.lng}&venue=${encodeURIComponent(loc.name)}`); }} setIsMapOpen={handleOpenMap}
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
                            onVenuePreview={(loc) => { router.push(`/map?genre=${selectedGenre}&lat=${loc.lat}&lng=${loc.lng}&venue=${encodeURIComponent(loc.name)}`); }}
                            setIsMapOpen={handleOpenMap}
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
            <BottomNav activeMenu={activeBottomMenu} currentViewMode={viewMode} onMenuClick={setActiveBottomMenu} onLikePerfClick={handleLikePerfClick} onMapClick={handleOpenMap} onCalendarClick={() => { router.push(`/calendar?genre=${selectedGenre}`); }} likeCount={likedIds.length} venueCount={favoriteVenues.length} selectedGenre={selectedGenre} searchMode={searchMode} />

            <BottomNavSheet activeMenu={activeBottomMenu} onClose={() => setActiveBottomMenu(null)} viewMode={viewMode} onViewModeChange={setViewMode} selectedGenre={selectedGenre} availableGenres={availableGenres} onGenreSelect={handleGenreSelect} selectedRegion={selectedRegion} onRegionSelect={setSelectedRegion} selectedDistrict={selectedDistrict} onDistrictSelect={setSelectedDistrict} selectedVenue={selectedVenue} onVenueSelect={(v) => {
                setSelectedVenue(v);

                // Location Mode Integration: Intercept venue selection to trigger location search
                const representativeVenue = v !== 'all'
                    ? getRepresentativeVenueInfoForName(v, allPerformances, venues)
                    : null;

                if (v !== 'all' && representativeVenue?.lat && representativeVenue?.lng) {
                    // [RESET ALL FILTERS] As requested, reset existing filtering related parts
                    setSelectedGenre('all');
                    setSelectedRegion('all');
                    setSelectedDistrict('all');
                    setSavedKeywords([]); // Reset saved keywords if applicable
                    
                    setSearchMode('location');
                    setSearchLocation({ lat: representativeVenue.lat, lng: representativeVenue.lng, name: v });
                    setSearchText(v);
                    setRadius(10); // Default to 10km radius

                    // Force UI adjustments
                    setActiveBottomMenu(null); // Close the bottom sheet immediately
                    
                    // Reset pagination/scroll
                    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 10);
                }
            }} searchText={searchText} onSearchChange={handleSearchChange} keywords={savedKeywords} onKeywordAdd={addKeyword} onKeywordRemove={removeKeyword} districts={districts} availableVenues={availableVenues} onSearch={() => { }} searchMode={searchMode} onSearchModeChange={setSearchMode} activeLocation={activeLocation} searchResults={searchResults} onResultSelect={(res) => {
                setSearchText(res.name);
                if (searchMode === 'location' && res.lat && res.lng) {
                    setSearchLocation({ lat: res.lat, lng: res.lng, name: res.name });
                }
            }} />

            {showFavoriteListModal && <FavoriteVenuesModal isOpen={showFavoriteListModal} onClose={() => setShowFavoriteListModal(false)} favoriteVenues={favoriteVenues} onRemove={toggleFavoriteVenue} onVenueClick={(favoriteVenue) => {
                const representativeVenue = getRepresentativeVenueInfoForFavorite(favoriteVenue, allPerformances, venues);
                router.push(`/map?genre=${selectedGenre}&lat=${representativeVenue?.lat || 0}&lng=${representativeVenue?.lng || 0}&venue=${encodeURIComponent(favoriteVenue.venueName)}`);
            }} />}
            {sharedPerf && <SharedDetailModal performance={sharedPerf} onClose={() => setSharedPerf(null)} />}
        </div>
    );
}
