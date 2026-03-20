import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { clsx } from 'clsx';
import { ChevronDown, ChevronUp, RotateCcw, Search, X, Star, MapPin, Clock, TrendingUp } from 'lucide-react';
import { TypingHero } from './TypingHero';
import { LocationSelector } from '../LocationSelector';
import { HeroTemplate, HERO_TEMPLATES } from '../../lib/hero-templates';
import { HERO_TEMPLATES_EN } from '../../lib/hero-templates-en';
import { REGIONS, RADIUS_OPTIONS } from '../../lib/constants';
import { useTranslations, useLocale } from 'next-intl';
import { getGenreMessages, getSearchMessages, getLocationMessages, getLikesPerfMessages, getLikesVenueMessages } from '../../lib/hero-messages';

interface HeroSectionProps {
    heroText: HeroTemplate;
    onCycle: () => void;
    isHeroVisible: boolean;
    viewMode: string;
    selectedGenre: string;
    selectedRegion: string;
    selectedDistrict: string;
    selectedVenue: string;
    activeLocation: { lat?: number, lng?: number, name: string } | null;
    userAddress: string | null;
    radius: number;
    lastUpdated: string;
    searchLocation?: any;
    searchText: string;
    searchResults: any[];
    isDropdownOpen: boolean;
    activeSearchSource: 'hero' | 'sticky';
    highlightedIndex: number;

    // Setters / Handlers
    setIsHeroFilterExpanded: React.Dispatch<React.SetStateAction<boolean>>;
    isHeroFilterExpanded: boolean;
    setSelectedRegion: (val: string) => void;
    setSelectedDistrict: (val: string) => void;
    setSelectedVenue: (val: string) => void;
    setUserLocation: (val: { lat: number, lng: number } | null) => void;
    setSearchLocation: (val: { lat: number, lng: number, name: string } | null) => void;
    setRadius: (val: number) => void;
    setSearchText: (val: string) => void;
    setActiveSearchSource: (val: 'hero' | 'sticky') => void;
    setIsDropdownOpen: (val: boolean) => void;
    handleSearch: () => void;
    handleSelectResult: (candidate: any) => void;
    handleKeyDown: (e: React.KeyboardEvent) => void;
    handleCurrentLocationClick: () => void; // New prop for location click

    // Data
    availableVenues: string[];
    districts: string[];

    // New Props for Search History
    recentKeywords: string[];
    onKeywordSelect: (keyword: string) => void;
    onRemoveRecent: (keyword: string) => void;
    onClearRecent: () => void;

    // Search Mode
    searchMode: 'keyword' | 'location';
    onSearchModeChange: (mode: 'keyword' | 'location') => void;
    onSearchChange: (text: string) => void;
}

export default function HeroSection({
    heroText,
    onCycle,
    isHeroVisible,
    viewMode,
    selectedGenre,
    selectedRegion,
    selectedDistrict,
    selectedVenue,
    activeLocation,
    userAddress,
    radius,
    lastUpdated,
    searchLocation,
    searchText,
    searchResults,
    isDropdownOpen,
    activeSearchSource,
    highlightedIndex,
    setIsHeroFilterExpanded,
    isHeroFilterExpanded,
    setSelectedRegion,
    setSelectedDistrict,
    setSelectedVenue,
    setUserLocation,
    setSearchLocation,
    setRadius,
    setSearchText,
    setActiveSearchSource,
    setIsDropdownOpen,
    handleSearch,
    handleSelectResult,
    handleKeyDown,
    handleCurrentLocationClick,
    availableVenues,
    districts,
    recentKeywords,
    onKeywordSelect,
    onRemoveRecent,
    onClearRecent,
    searchMode,
    onSearchModeChange,
    onSearchChange
}: HeroSectionProps) {
    const ts = useTranslations('Search');
    const tr = useTranslations('Regions');
    const locale = useLocale();
    const isKo = locale === 'ko';
    const heroRef = useRef<HTMLDivElement>(null);
    const searchContainerRef = useRef<HTMLDivElement>(null);

    // Handle scroll to sync animation
    const [isAtTop, setIsAtTop] = useState(true);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollPos = window.scrollY;
            setIsAtTop(currentScrollPos < 50); // Threshold for being "at top"
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Handle click outside to close search dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                if (isDropdownOpen && activeSearchSource === 'hero') {
                    setIsDropdownOpen(false);
                }
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isDropdownOpen, activeSearchSource, setIsDropdownOpen]);

    // Logic for determining the current template to display
    const currentTemplate = useMemo(() => {
        const now = new Date();
        const minuteSeed = now.getMinutes();
        const hour = now.getHours();
        const day = now.getDay();
        const month = now.getMonth() + 1;

        const isWeekend = day === 0 || day === 6;
        const isFriday = day === 5;

        // Dynamic title messages for likes-perf (locale-aware)
        const likesPerfMessages = getLikesPerfMessages(locale);
        const likesVenueMessages = getLikesVenueMessages(locale);

        const perfMsg = likesPerfMessages[minuteSeed % likesPerfMessages.length];
        const venueMsg = likesVenueMessages[minuteSeed % likesVenueMessages.length];

        const genreMessages = getGenreMessages(locale, { hour, isWeekend, isFriday, month });
        const genreMsg = selectedGenre !== 'all' && (genreMessages as any)[selectedGenre]
            ? (genreMessages as any)[selectedGenre][minuteSeed % (genreMessages as any)[selectedGenre].length]
            : null;

        if (viewMode === 'likes-perf') {
            return { ...perfMsg, keywords: [], boldPrefix: undefined } as HeroTemplate;
        } else if (viewMode === 'likes-venue') {
            return { ...venueMsg, keywords: [], boldPrefix: undefined } as HeroTemplate;
        } else if (genreMsg) {
            return { ...genreMsg, keywords: [] } as HeroTemplate;
        } else if (searchText) {
            const cleanSearch = searchText.replace(/^.*? \d+(?:-\d+)?\s*/, '').replace(/\(.*\)/, '').trim();
            const searchMsgs = getSearchMessages(locale, cleanSearch);
            return { ...searchMsgs[minuteSeed % searchMsgs.length], keywords: [] } as HeroTemplate;
        } else if (selectedRegion !== 'all' || selectedVenue !== 'all') {
            const regionName = selectedRegion !== 'all' ? (tr.has(selectedRegion) ? tr(selectedRegion) : REGIONS.find(r => r.id === selectedRegion)?.label) : '';
            const locationString = `${regionName || ''} ${selectedDistrict !== 'all' ? selectedDistrict : ''} ${selectedVenue !== 'all' ? selectedVenue : ''}`.trim();
            const locationMsgs = getLocationMessages(locale, locationString);

            return { ...locationMsgs[minuteSeed % locationMsgs.length], keywords: [] } as HeroTemplate;
        } else {
            return heroText;
        }
    }, [viewMode, selectedGenre, searchText, selectedRegion, selectedDistrict, selectedVenue, heroText, locale, tr]);


    // Close filter panel when clicking outside
    const filterRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                // Also check if the toggle button was clicked (avoid immediate re-open)
                // We can't easily check the button ref here unless we pass it or use a shared parent.
                // But the toggle button usually stops propagation or we just check closest.
                // Simple fix: Check if target is inside the toggle button.
                const target = event.target as Element;
                if (target.closest('[data-region-toggle="true"]')) {
                    return;
                }
                setIsHeroFilterExpanded(false);
            }
        }
        if (isHeroFilterExpanded) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isHeroFilterExpanded, setIsHeroFilterExpanded]);

    return (
        <div className={clsx(
            "relative max-w-7xl 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-10 flex flex-col lg:flex-row justify-between lg:items-center gap-8",
            (!(isDropdownOpen && activeSearchSource === 'hero')) && "overflow-visible",
            (isDropdownOpen && activeSearchSource === 'hero') ? "z-[100]" : "z-[30]"
        )}>
            <div className="text-left flex-1 min-w-0 z-10">
                {selectedGenre !== 'movie' && (
                    <p className={clsx(
                        "font-extrabold mb-3 flex items-center gap-2 text-sm md:text-base transition-colors duration-500",
                        searchMode === 'location' ? "text-emerald-400" : "text-[#a78bfa]"
                    )}>
                        <button
                            onClick={handleCurrentLocationClick}
                            className={clsx(
                                "flex items-center gap-1 transition-colors group/label mr-2",
                                searchMode === 'location'
                                    ? "hover:text-white light:hover:text-emerald-600"
                                    : "hover:text-white light:hover:text-purple-600"
                            )}
                            title={ts('find_my_location')}
                        >
                            <MapPin className={clsx(
                                "w-4 h-4 group-hover/label:scale-110 transition-transform",
                                searchMode === 'location'
                                    ? "text-emerald-400 light:text-emerald-600"
                                    : "text-[#a78bfa] light:text-purple-600"
                            )} />
                            <span>
                                {(selectedRegion === 'all' && selectedVenue === 'all')
                                    ? (activeLocation ? (searchLocation ? ts('search_location_label') : ts('current_location')) : ts('current_location'))
                                    : ts('set_location')
                                }
                            </span>
                        </button>
                        <span
                            onClick={() => setIsHeroFilterExpanded(prev => !prev)}
                            className={clsx(
                                "text-white light:text-black cursor-pointer hover:border-white transition-colors",
                                searchMode === 'location'
                                    ? "border-b border-emerald-400"
                                    : "border-b border-[#a78bfa]"
                            )}
                            data-region-toggle="true"
                        >
                            {(selectedRegion === 'all' && selectedVenue === 'all')
                                ? (searchLocation?.name
                                    ? searchLocation.name
                                    : (activeLocation
                                        ? (userAddress || ts('near_me_gps'))
                                        : ts('nationwide')))
                                : `${selectedRegion !== 'all' ? (tr.has(selectedRegion) ? tr(selectedRegion) : REGIONS.find(r => r.id === selectedRegion)?.label || '') : ''} ${selectedDistrict !== 'all' ? selectedDistrict : ''} ${selectedVenue !== 'all' ? selectedVenue : ''}`.trim() || ts('nationwide')
                            }
                        </span>

                        <button
                            onClick={() => setIsHeroFilterExpanded(prev => !prev)}
                            className={clsx(
                                "ml-2 p-1.5 rounded-full bg-white/10 hover:bg-white/20 light:bg-black/5 light:hover:bg-black/10 text-gray-400 hover:text-white light:text-gray-600 light:hover:text-black transition-all border border-white/5 hover:border-white/20 light:border-black/5 light:hover:border-black/10",
                                isHeroFilterExpanded && "bg-white/20 text-white light:bg-purple-100 light:text-purple-700"
                            )}
                            title={isHeroFilterExpanded ? ts('close_region_settings') : ts('open_region_settings')}
                            data-region-toggle="true"
                        >
                            <ChevronDown className={clsx("w-3.5 h-3.5 transition-transform duration-300", isHeroFilterExpanded && "rotate-180")} />
                        </button>

                        {(activeLocation || selectedRegion !== 'all' || selectedVenue !== 'all') && (
                            <button
                                onClick={() => {
                                    setSelectedRegion('all');
                                    setSelectedDistrict('all');
                                    setSelectedVenue('all');
                                    setUserLocation(null);
                                    setSearchLocation(null);
                                    onSearchChange(''); // Clear search keyword and sync with URL
                                }}
                                className="ml-2 p-1.5 rounded-full bg-white/10 hover:bg-white/20 light:bg-black/5 light:hover:bg-black/10 text-gray-400 hover:text-white light:text-gray-600 light:hover:text-black transition-all border border-white/5 hover:border-white/20 light:border-black/5 light:hover:border-black/10 group/reload"
                                title={ts('reset_to_all_regions')}
                            >
                                <RotateCcw className="w-3.5 h-3.5 group-hover/reload:-rotate-180 transition-transform duration-500" />
                            </button>
                        )}
                    </p>
                )}

                {/* Inline Filter Panel (Toggle) */}
                {isHeroFilterExpanded && (
                    <div ref={filterRef} className={clsx(
                        "mt-2 mb-4 animate-in fade-in slide-in-from-top-2 duration-300 origin-top relative w-full backdrop-blur-3xl shadow-2xl rounded-2xl z-[60] transition-colors duration-500",
                        searchMode === 'location'
                            ? "bg-[#0a1f1a]/95 light:bg-white/95 border border-emerald-500/20 light:border-black/5"
                            : "bg-[#1a0b2e]/95 light:bg-white/95 border border-purple-500/20 light:border-black/5"
                    )}>
                        <div className="flex flex-col gap-4 p-6">
                            <LocationSelector
                                selectedRegion={selectedRegion}
                                onRegionSelect={(r) => {
                                    setSelectedRegion(r);
                                    if (r !== selectedRegion) {
                                        setSelectedDistrict('all');
                                        setSelectedVenue('all');
                                    }
                                }}
                                selectedDistrict={selectedDistrict}
                                onDistrictSelect={(d) => {
                                    setSelectedDistrict(d);
                                    if (d !== selectedDistrict) setSelectedVenue('all');
                                }}
                                selectedVenue={selectedVenue}
                                onVenueSelect={setSelectedVenue}
                                districts={districts}
                                availableVenues={availableVenues}
                                searchMode={searchMode}
                            />
                        </div>

                        {/* Search Dropdown - Main Hero */}
                        {isDropdownOpen && searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-4 bg-[#1a0b2e] light:bg-white backdrop-blur-xl rounded-2xl border border-white/10 light:border-gray-200 shadow-[0_10px_40px_rgba(0,0,0,0.5)] overflow-hidden z-[100] max-h-[320px] overflow-y-auto custom-scrollbar">
                                <div className="p-2">
                                    <div className="px-3 py-2 text-xs font-bold text-gray-400 light:text-gray-500 uppercase tracking-wider flex justify-between items-center">
                                        <span>{ts('search_results')}</span>
                                        <button onClick={() => setIsDropdownOpen(false)} className="bg-transparent hover:bg-white/5 p-1 rounded-full text-white light:text-black"><X size={14} /></button>
                                    </div>
                                    {searchResults.map((result, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleSelectResult(result)}
                                            className="w-full text-left px-4 py-3 rounded-xl hover:bg-white/10 light:hover:bg-gray-50 transition-colors flex items-start gap-3 group"
                                        >
                                            <div className="mt-0.5 p-2 rounded-lg bg-gray-800 light:bg-gray-100 text-gray-400 group-hover:text-white light:group-hover:text-black group-hover:bg-purple-500 transition-colors">
                                                {result.type === 'location' ? <MapPin size={16} /> : <Search size={16} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-gray-200 light:text-gray-900 truncate group-hover:text-purple-400 light:group-hover:text-purple-600 transition-colors">
                                                    {result.name}
                                                </div>
                                                {result.address && (
                                                    <div className="text-xs text-gray-500 light:text-gray-500 truncate mt-0.5">
                                                        {result.category ? <span className="text-purple-400 mr-2">{result.category}</span> : null}
                                                        {result.address}
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div ref={heroRef}>
                    <TypingHero
                        template={currentTemplate}
                        onCycle={onCycle}
                        paused={!isHeroVisible || !['list', 'grid', 'likes-perf', 'likes-venue'].includes(viewMode)}
                        searchMode={searchMode}
                        isAtTop={isAtTop}
                    />
                </div>

            </div>

            {/* Hero Search Bar */}
            <div
                ref={searchContainerRef}
                className={clsx(
                    "w-full lg:w-auto relative group",
                    (isDropdownOpen && activeSearchSource === 'hero') ? "z-[101]" : "z-[30]"
                )}>


                {/* Light Mode Static Glow */}
                <div className={clsx(
                    "hidden light:block absolute -inset-4 blur-2xl rounded-full opacity-70 pointer-events-none transition-colors duration-500",
                    searchMode === 'location'
                        ? "bg-gradient-to-r from-[#55df99]/30 to-[#0090f5]/30"
                        : "bg-gradient-to-r from-purple-400/20 via-pink-400/15 to-purple-400/20"
                )} />

                {/* Main Container */}
                <div className={clsx(
                    "p-[3px] rounded-full transition-all duration-300 relative",
                    searchMode === 'location'
                        ? "bg-linear-to-r from-[#55df99] to-[#0090f5] light:shadow-[0_4px_30px_rgba(85,223,153,0.35)]"
                        : "bg-linear-to-r from-[#a78bfa] via-purple-500 to-[#f472b6] light:shadow-[0_4px_30px_rgba(168,85,247,0.25)]"
                )}>
                    <div className="bg-[#0a0a0a] light:bg-white rounded-full flex items-center p-1 relative mix-blend-hard-light light:mix-blend-normal">
                        {/* Mode Toggle Button (Now on Left) */}
                        <button
                            onClick={() => onSearchModeChange(searchMode === 'keyword' ? 'location' : 'keyword')}
                            className={clsx(
                                "p-3.5 rounded-full text-white shadow-md hover:scale-105 active:scale-95 transition-all outline-none flex items-center justify-center shrink-0",
                                searchMode === 'location'
                                    ? "bg-gradient-to-br from-[#55df99] to-[#0090f5] shadow-emerald-500/30 text-white"
                                    : "bg-gradient-to-r from-[#a78bfa] to-[#f472b6] text-white"
                            )}
                            title={searchMode === 'location' ? ts('switch_to_keyword_search') : ts('switch_to_location_search')}
                        >
                            {searchMode === 'location'
                                ? <MapPin className="w-5 h-5 font-extrabold" />
                                : <Search className="w-5 h-5 font-extrabold" />
                            }
                        </button>

                        {/* Input Field (Fill the rest) */}
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={searchText}
                                onFocus={() => {
                                    setActiveSearchSource('hero');
                                    setIsDropdownOpen(true);
                                }}
                                onClick={() => setIsDropdownOpen(true)}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSearchText(val);
                                    // Reset location filters when user starts typing search
                                    if (val && (selectedRegion !== 'all' || selectedDistrict !== 'all' || selectedVenue !== 'all')) {
                                        setSelectedRegion('all');
                                        setSelectedDistrict('all');
                                        setSelectedVenue('all');
                                    }
                                    if (!isDropdownOpen) setIsDropdownOpen(true);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        if (searchMode === 'location' && searchResults?.length > 0 && searchText.trim() !== '') {
                                            handleSelectResult(searchResults[0]);
                                        } else {
                                            setIsDropdownOpen(false);
                                            handleKeyDown(e);
                                        }
                                    }
                                }}
                                className="bg-transparent border-none text-white light:text-black text-lg font-extrabold px-5 py-3 w-full lg:w-[480px] focus:outline-none placeholder-gray-600 caret-white light:caret-black"
                                placeholder={searchMode === 'location'
                                    ? ts('search_location')
                                    : ts('search_keyword')
                                }
                            />
                            {/* Reset Button (Next to Input) */}
                            {searchText && (
                                <button
                                    onClick={() => {
                                        onSearchChange('');
                                        setIsDropdownOpen(false);
                                        setSearchLocation(null);
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-white light:hover:text-black transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Search Results Dropdown (Attached to Hero Input) */}
                {isDropdownOpen && activeSearchSource === 'hero' && (
                    <div className="absolute top-full left-0 right-0 mt-4 bg-[#1a1a1a]/95 light:bg-white/95 backdrop-blur-md border border-white/10 light:border-gray-200 rounded-2xl shadow-2xl z-[100] overflow-hidden max-h-80 overflow-y-auto animate-in fade-in zoom-in-95 duration-200 pb-4">

                        {/* Case 1: Search Text Exists -> Show Results */}
                        {searchText.trim() ? (
                            searchResults.length > 0 ? (
                                searchResults.map((result, idx) => {
                                    const addressParts = result.address ? result.address.split(' ') : [];
                                    const shortAddress = addressParts.length >= 2 ? `${addressParts[0]} ${addressParts[1]}` : result.address;

                                    return (
                                        <div
                                            key={`search-hero-${idx}`}
                                            onClick={() => handleSelectResult(result)}
                                            className={`px-5 py-4 cursor-pointer flex items-center justify-between gap-4 border-b border-white/5 light:border-gray-100 last:border-0 transition-colors ${idx === highlightedIndex
                                                ? 'bg-white/10 dark:bg-white/20 light:bg-purple-50'
                                                : 'bg-[#1a1a1a] light:bg-white hover:bg-white/10 light:hover:bg-gray-50'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="bg-black/50 light:bg-gray-100 p-2.5 rounded-full shrink-0 border border-white/10 light:border-gray-200">
                                                    {result.type === 'location' ? (
                                                        <MapPin className="w-4 h-4 text-emerald-400 light:text-emerald-600" />
                                                    ) : result.type === 'video' ? (
                                                        <Star className="w-4 h-4 text-yellow-500 light:text-yellow-600" />
                                                    ) : (
                                                        <Search className="w-4 h-4 text-[#a78bfa] light:text-purple-600" />
                                                    )}
                                                </div>
                                                <div className="text-white light:text-black text-base font-extrabold truncate">
                                                    {result.name}
                                                </div>
                                            </div>

                                            <div className="text-gray-400 light:text-gray-600 text-sm whitespace-nowrap shrink-0">
                                                {shortAddress}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="p-8 text-center flex flex-col items-center gap-3">
                                    <div className="text-gray-400 light:text-gray-600 text-sm">
                                        <strong className={searchMode === 'location' ? "text-emerald-500" : "text-purple-500"}>
                                            {searchMode === 'location' ? ts('location') : ts('keyword')}
                                        </strong> {ts('no_search_results')}
                                    </div>
                                    <button onClick={() => {
                                        onSearchModeChange(searchMode === 'location' ? 'keyword' : 'location');
                                    }} className={`px-4 py-2 rounded-full text-sm font-extrabold text-white transition-all flex items-center gap-2 shadow-lg hover:-translate-y-0.5 ${searchMode === 'location'
                                        ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-500/20'
                                        : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'
                                        }`}>
                                        {searchMode === 'location' ? <Search size={14} /> : <MapPin size={14} />}
                                        {searchMode === 'location' ? ts('switch_to_keyword') : ts('switch_to_location')}
                                    </button>
                                </div>
                            )
                        ) : (
                            /* Case 2: No Search Text -> Show Recent/Popular Keywords */
                            <div className="p-4 bg-[#1a0b2e]/95 light:bg-white/95 backdrop-blur-3xl">
                                {/* Recent Keywords */}
                                <div className="mb-6">
                                    <div className="flex items-center justify-between mb-3 px-1">
                                        <h4 className="text-sm font-extrabold text-gray-400 light:text-gray-600 flex items-center gap-2">
                                            <Clock className="w-3.5 h-3.5" /> {ts('recent_searches')}
                                        </h4>
                                        {recentKeywords.length > 0 && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onClearRecent();
                                                }}
                                                className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                                            >
                                                {ts('clear_all')}
                                            </button>
                                        )}
                                    </div>

                                    {recentKeywords.length === 0 ? (
                                        <div className="text-center py-4 text-gray-600 light:text-gray-500 text-sm bg-white/5 light:bg-gray-50 rounded-xl border border-white/5 light:border-gray-100">
                                            {ts('no_recent_searches')}
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {recentKeywords.map((keyword, idx) => (
                                                <div
                                                    key={idx}
                                                    className="group flex items-center gap-2 px-3 py-1.5 bg-white/5 light:bg-gray-100 hover:bg-white/10 light:hover:bg-gray-200 border border-white/10 light:border-gray-200 rounded-full cursor-pointer transition-all"
                                                    onClick={() => onKeywordSelect(keyword)}
                                                >
                                                    <span className="text-sm text-gray-300 light:text-gray-700 group-hover:text-white light:group-hover:text-black transition-colors">{keyword}</span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onRemoveRecent(keyword);
                                                        }}
                                                        className="text-gray-500 light:text-gray-400 hover:text-red-400 light:hover:text-red-500 p-0.5 rounded-full hover:bg-white/10 light:hover:bg-white transition-colors"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Popular Keywords */}
                                <div>
                                    <h4 className="text-sm font-extrabold text-gray-400 light:text-gray-600 flex items-center gap-2 mb-3 px-1">
                                        <TrendingUp className="w-3.5 h-3.5 text-red-400" /> {ts('popular_searches')}
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            '뮤지컬', '콘서트', '서울', '전시회',
                                            '아이브', '임영웅', '싸이', '모네',
                                            '예술의전당', '세종문화회관'
                                        ].map((keyword, idx) => (
                                            <div
                                                key={idx}
                                                onClick={() => onKeywordSelect(keyword)}
                                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 light:hover:bg-gray-50 cursor-pointer group transition-colors"
                                            >
                                                <span className={`text-sm font-extrabold w-4 text-center ${idx < 3 ? 'text-[#a78bfa] light:text-purple-600' : 'text-gray-500'}`}>
                                                    {idx + 1}
                                                </span>
                                                <span className="text-sm text-gray-300 light:text-gray-700 group-hover:text-white light:group-hover:text-black transition-colors">
                                                    {keyword}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
