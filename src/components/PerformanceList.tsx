'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Performance } from '@/types';
import { MapPin, Bell, Sun, Moon, Loader2, Languages } from 'lucide-react';
import { clsx } from 'clsx';
import Image from 'next/image';
import { GENRES, RADIUS_OPTIONS } from '@/lib/constants';
import { useSearchParams } from 'next/navigation';
import { useRouter, Link, usePathname } from '@/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X as CloseIcon, Globe } from 'lucide-react';

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

// Dynamic Modals for Code Splitting (Map & Calendar are now separate pages)
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
    const pathname = usePathname();
    const locale = useLocale();
    const searchParams = useSearchParams();
    const t = useTranslations();
    const tc = useTranslations('Categories');
    const tr = useTranslations('Regions');
    const ts = useTranslations('Search');
    const ta = useTranslations('Actions');

    // --- Custom Hooks (Modular Logic) ---
    const {
        likedIds, favoriteVenues, savedKeywords, setSavedKeywords, theme, toggleTheme,
        toggleLike, toggleFavoriteVenue, addKeyword, removeKeyword
    } = useUserPreferences();

    const { allPerformances, setAllPerformances, cinemas, venues, isDataFullyLoaded } = usePerformanceData({ initialPerformances });
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

    const localizedSelectedGenreLabel = useMemo(() => {
        const genre = GENRES.find(g => g.id === initialGenre);
        return genre ? (tc.has(genre.id) ? tc(genre.id) : genre.label) : tc('all');
    }, [initialGenre, tc]);

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

    const [activeBottomMenu, setActiveBottomMenu] = useState<BottomMenuType>(null);
    const [isHeroFilterExpanded, setIsHeroFilterExpanded] = useState(false);
    const [activeSearchSource, setActiveSearchSource] = useState<'hero' | 'sticky'>('hero');
    const [showFavoriteListModal, setShowFavoriteListModal] = useState(false);
    const [isHeroVisible, setIsHeroVisible] = useState(true);
    const [isAlarmOpen, setIsAlarmOpen] = useState(false);
    const [keywordInput, setKeywordInput] = useState('');
    const [sharedPerf, setSharedPerf] = useState<Performance | null>(null);
    const [showLanguageSheet, setShowLanguageSheet] = useState(false);
    const observerTarget = useRef<HTMLDivElement>(null);
    const deepLinkHandled = useRef(false);

    // --- Derived State ---
    const activeLocation = searchLocation || userLocation;

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
        return allPerformances.filter(p =>
            savedKeywords.some(k =>
                (p.title || '').includes(k) || (p.genre || '').includes(k) || (p.venue || '').includes(k)
            )
        ).slice(0, 15);
    }, [savedKeywords, allPerformances]);

    const recommendedItems = useMemo(() => {
        if (!allPerformances.length) return [];
        
        // If user has likes, recommend based on most-liked genre
        if (likedIds.length > 0) {
            const likedSet = new Set(likedIds);
            const genreCounts = new Map<string, number>();
            allPerformances.forEach(p => {
                if (likedSet.has(p.id)) {
                    genreCounts.set(p.genre, (genreCounts.get(p.genre) || 0) + 1);
                }
            });
            const topGenre = [...genreCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
            if (topGenre) {
                const genreItems = allPerformances.filter(p => p.genre === topGenre && !likedSet.has(p.id));
                if (genreItems.length >= 5) return genreItems.slice(0, 10);
            }
        }
        
        // Fallback: diverse sampling from different genres
        return allPerformances.slice(0, 10);
    }, [allPerformances, likedIds]);

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

    const setPreserveFlag = useCallback(() => {
        if (typeof window !== 'undefined') {
            sessionStorage.setItem('cf_preserve_order', 'true');
        }
    }, []);

    // --- Handlers ---
    const handleDetailOpen = useCallback((perf: Performance) => {
        setPreserveFlag();
        router.push(`/p/${perf.id}/`);
    }, [router, setPreserveFlag]);

    const handleLanguageToggle = useCallback(() => {
        setShowLanguageSheet(true);
    }, []);

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
                router.replace(pathname);
            }
        }
    }, [setSearchText, setSelectedGenre, setSelectedRegion, setSelectedDistrict, setSelectedVenue, searchParams, router, pathname]);

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
        setPreserveFlag();
        if (searchMode === 'location' && activeLocation) {
            const venueName = 'name' in activeLocation ? (activeLocation as any).name : ts('near_me');
            router.push(`/map?genre=${selectedGenre}&mode=location&lat=${activeLocation.lat}&lng=${activeLocation.lng}&venue=${encodeURIComponent(venueName)}`);
        } else {
            router.push(`/map?genre=${selectedGenre}`);
        }
    }, [searchMode, activeLocation, selectedGenre, router, setPreserveFlag]);

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
                        <button 
                            onClick={handleLanguageToggle} 
                            className="p-1 rounded-full text-gray-400 light:text-gray-500 hover:text-white light:hover:text-black transition-colors group/lang"
                            title={ta('language_change')}
                        >
                            <div className={clsx(
                                "flex items-center justify-center w-7 h-7 rounded-[7px] border-2 border-gray-400 light:border-gray-500 group-hover/lang:border-white light:group-hover/lang:border-black transition-colors",
                                "text-[9px] font-black leading-none uppercase"
                            )}>
                                {locale === 'ko' ? 'KR' : locale === 'en' ? 'EN' : locale === 'zh' ? 'CN' : 'JP'}
                            </div>
                        </button>
                        <button 
                            onClick={toggleTheme} 
                            className="p-2 rounded-full text-gray-400 light:text-gray-500 hover:text-white light:hover:text-black"
                            title={ta('mode_change')}
                        >
                            {theme === 'dark' ? <Sun size={24} /> : <Moon size={24} />}
                        </button>
                        <button 
                            onClick={() => setIsAlarmOpen(!isAlarmOpen)} 
                            className={clsx("p-2 rounded-full", isAlarmOpen ? "text-purple-300" : "text-gray-400")}
                            title={ta('keyword_settings')}
                        >
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
            <ErrorBoundary fallback={<div>{t('Errors.unexpected')}</div>}>
                <HeroSection
                    heroText={heroText} onCycle={selectNextTemplate} isHeroVisible={isHeroVisible} viewMode={viewMode} selectedGenre={selectedGenre}
                    selectedRegion={selectedRegion} selectedDistrict={selectedDistrict} selectedVenue={selectedVenue}
                    activeLocation={activeLocation ? { name: ('name' in activeLocation) ? (activeLocation as any).name : ts('near_me') } : null}
                    userAddress={userAddress} radius={radius} lastUpdated={lastUpdated} searchLocation={searchLocation} searchText={searchText}
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
                        onResetFilters={() => { setSearchLocation(null); handleSearchChange(''); }} onRadiusChange={setRadius}
                    />

                    {filteredPerformances.length === 0 && viewMode !== 'likes-perf' && isDataFullyLoaded ? (
                        <EmptyState viewMode={viewMode} selectedGenre={selectedGenre} setSelectedRegion={setSelectedRegion} setSelectedDistrict={setSelectedDistrict} setSearchText={setSearchText} setUserLocation={setUserLocation} setIsMapOpen={handleOpenMap} searchMode={searchMode} setSearchMode={setSearchMode} searchText={searchText} />
                    ) : viewMode === 'likes-perf' ? (
                        <LikedSections
                            viewMode={viewMode} allPerformances={allPerformances} likedIds={likedIds} favoriteVenues={favoriteVenues}
                            venues={venues} onToggleLike={toggleLike} onDetailOpen={handleDetailOpen} onSetSearchLocation={setSearchLocation}
                            onVenuePreview={(loc) => { setPreserveFlag(); router.push(`/map?genre=${selectedGenre}&lat=${loc.lat}&lng=${loc.lng}&venue=${encodeURIComponent(loc.name)}`); }} setIsMapOpen={handleOpenMap}
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
                            onVenuePreview={(loc) => { setPreserveFlag(); router.push(`/map?genre=${selectedGenre}&lat=${loc.lat}&lng=${loc.lng}&venue=${encodeURIComponent(loc.name)}`); }}
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
                            <span className="ml-3 text-gray-400">{t('Calendar.loading_more')}</span>
                        </div>
                    )}
                </div>
            </main>

            {/* 4. Navigation & Modals */}
            {(() => {
                const directLikedIds = new Set(likedIds);
                const venueLikedIds = new Set(allPerformances
                    .filter(p => favoriteVenues.includes(p.venue || ''))
                    .map(p => p.id)
                );
                const totalLikeCount = new Set([...Array.from(directLikedIds), ...Array.from(venueLikedIds)]).size;

                return (
                    <BottomNav 
                        activeMenu={activeBottomMenu} 
                        currentViewMode={viewMode} 
                        onMenuClick={setActiveBottomMenu} 
                        onLikePerfClick={handleLikePerfClick} 
                        onMapClick={handleOpenMap} 
                        onCalendarClick={() => { setPreserveFlag(); router.push(`/calendar?genre=${selectedGenre}`); }} 
                        likeCount={totalLikeCount} 
                        selectedGenre={selectedGenre} 
                        searchMode={searchMode} 
                    />
                );
            })()}

            <BottomNavSheet activeMenu={activeBottomMenu} onClose={() => setActiveBottomMenu(null)} viewMode={viewMode} onViewModeChange={setViewMode} selectedGenre={selectedGenre} onGenreSelect={handleGenreSelect} selectedRegion={selectedRegion} onRegionSelect={setSelectedRegion} selectedDistrict={selectedDistrict} onDistrictSelect={setSelectedDistrict} selectedVenue={selectedVenue} onVenueSelect={(v) => {
                setSelectedVenue(v);

                // Location Mode Integration: Intercept venue selection to trigger location search
                if (v !== 'all' && venues[v] && venues[v].lat && venues[v].lng) {
                    // [RESET ALL FILTERS] As requested, reset existing filtering related parts
                    setSelectedGenre('all');
                    setSelectedRegion('all');
                    setSelectedDistrict('all');
                    setSavedKeywords([]); // Reset saved keywords if applicable
                    
                    setSearchMode('location');
                    setSearchLocation({ lat: venues[v].lat, lng: venues[v].lng, name: v });
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

            {/* Language Selection Sheet */}
            <AnimatePresence>
                {showLanguageSheet && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowLanguageSheet(false)}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[6000]"
                        />

                        {/* Sheet */}
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 200 }}
                            className="fixed bottom-0 left-0 right-0 z-[6010] bg-white dark:bg-[#121212] border-t border-black/5 dark:border-white/10 rounded-t-[32px] overflow-hidden flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.3)] touch-none"
                        >
                            {/* Header / Handle */}
                            <div className="w-full flex flex-col items-center pt-3 pb-2 shrink-0">
                                <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full mb-4" />
                                <div className="w-full px-6 flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                                            <Globe size={20} />
                                        </div>
                                        <h3 className="text-xl font-black text-gray-900 dark:text-white">{ta('language_change')}</h3>
                                    </div>
                                    <button 
                                        onClick={() => setShowLanguageSheet(false)}
                                        className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
                                    >
                                        <CloseIcon size={20} />
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="px-6 pb-12 pt-2 flex flex-col gap-3">
                                {[
                                    { id: 'ko', label: '한국어', sub: 'Korean', flag: '🇰🇷' },
                                    { id: 'en', label: 'English', sub: '영어', flag: '🇺🇸' },
                                    { id: 'zh', label: '简体中文', sub: 'Chinese', flag: '🇨🇳' },
                                    { id: 'ja', label: '日本語', sub: 'Japanese', flag: '🇯🇵' }
                                ].map((lang) => {
                                    const isSelected = locale === lang.id;
                                    return (
                                        <button
                                            key={lang.id}
                                            onClick={() => {
                                                // Ensure the pathname is clean (next-intl should handle this, but explicit is safer)
                                                router.push(pathname, { locale: lang.id as any });
                                                setShowLanguageSheet(false);
                                            }}
                                            className={clsx(
                                                "w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 group relative overflow-hidden",
                                                isSelected 
                                                    ? "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800/50" 
                                                    : "bg-gray-50 dark:bg-white/5 border-transparent hover:border-gray-200 dark:hover:border-white/10"
                                            )}
                                        >
                                            <div className="flex items-center gap-4">
                                                <span className="text-2xl">{lang.flag}</span>
                                                <div className="flex flex-col text-left">
                                                    <span className={clsx(
                                                        "text-base font-bold transition-colors",
                                                        isSelected ? "text-purple-600 dark:text-purple-400" : "text-gray-900 dark:text-gray-200"
                                                    )}>
                                                        {lang.label}
                                                    </span>
                                                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{lang.sub}</span>
                                                </div>
                                            </div>
                                            {isSelected && (
                                                <div className="w-6 h-6 rounded-full bg-purple-600 dark:bg-purple-500 flex items-center justify-center text-white">
                                                    <Check size={14} strokeWidth={4} />
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {showFavoriteListModal && <FavoriteVenuesModal isOpen={showFavoriteListModal} onClose={() => setShowFavoriteListModal(false)} favoriteVenues={favoriteVenues} onRemove={toggleFavoriteVenue} onVenueClick={(name) => { setPreserveFlag(); router.push(`/map?genre=${selectedGenre}&lat=${venues[name]?.lat || 0}&lng=${venues[name]?.lng || 0}&venue=${encodeURIComponent(name)}`); }} />}
            {sharedPerf && <SharedDetailModal performance={sharedPerf} onClose={() => setSharedPerf(null)} lastUpdated={lastUpdated} />}
        </div>
    );
}
