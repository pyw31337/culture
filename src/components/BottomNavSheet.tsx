import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { X, Search, Grid3X3, List, CalendarDays, Map, LayoutGrid, LayoutList, Mic2, Music, Ticket, Frame, Baby, Star, Moon, Sun, MapPin } from 'lucide-react';
import { BottomMenuType, ListDetailsIcon } from './BottomNav';
import { CloverIcon } from './GenreIcons';
import { GENRES, GENRE_STYLES, REGIONS } from '@/lib/constants';
import { safeStorage } from '@/lib/safeStorage';
import { Performance } from '@/types';
import { getOptimizedUrl } from '@/lib/utils';

interface BottomNavSheetProps {
    activeMenu: BottomMenuType;
    onClose: () => void;
    // Props for sub-features
    viewMode: string;
    onViewModeChange: (mode: string) => void;
    selectedGenre: string;
    onGenreSelect: (genre: string) => void;
    searchText: string;
    onSearchChange: (text: string) => void;
    selectedRegion: string;
    onRegionSelect: (region: string) => void;
    selectedDistrict: string;
    onDistrictSelect: (district: string) => void;
    keywords: string[];
    onKeywordAdd: (keyword: string) => void;
    onKeywordRemove: (keyword: string) => void;
    districts: string[]; // Passed from parent based on selectedRegion
    availableVenues: string[];
    selectedVenue: string;
    onVenueSelect: (venue: string) => void;
    onSearch: () => void;
    searchMode?: 'keyword' | 'location';
    onSearchModeChange?: (mode: 'keyword' | 'location') => void;
    activeLocation?: { lat: number, lng: number } | null;
    searchResults?: any[];
    onResultSelect?: (result: any) => void;
    // New Props for Venue Detail Integration
    venuePerformances?: Performance[];
    hasBackdrop?: boolean;
}

import { getGenreIcon } from '@/components/GenreIcons';
import { LocationSelector } from './LocationSelector';

export default function BottomNavSheet({
    activeMenu,
    onClose,
    viewMode,
    onViewModeChange,
    selectedGenre,
    onGenreSelect,
    searchText,
    onSearchChange,
    selectedRegion,
    onRegionSelect,
    selectedDistrict,
    onDistrictSelect,
    keywords,
    onKeywordAdd,
    onKeywordRemove,
    districts,
    availableVenues,
    selectedVenue,
    onVenueSelect,
    onSearch,
    searchMode = 'keyword',
    onSearchModeChange = () => { },
    activeLocation,
    searchResults = [],
    onResultSelect = () => { },
    venuePerformances = [],
    hasBackdrop = true
}: BottomNavSheetProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [keywordInput, setKeywordInput] = useState('');
    // Default to true (Light) as that is now the CSS default
    const [isLight, setIsLight] = useState(true);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            // Check if .dark class is present (set by layout script)
            const hasDarkClass = document.documentElement.classList.contains('dark');
            setIsLight(!hasDarkClass);

            // Sync with localStorage if needed (using safeStorage for SSR safety)
            const savedTheme = safeStorage.get<string>('theme', 'light');
            if (savedTheme === 'dark' && !hasDarkClass) {
                document.documentElement.classList.add('dark');
                setIsLight(false);
            }
        }
    }, [isVisible]);

    const toggleTheme = () => {
        const doc = document.documentElement;
        if (doc.classList.contains('dark')) {
            doc.classList.remove('dark');
            setIsLight(true);
            safeStorage.set('theme', 'light');
        } else {
            doc.classList.add('dark');
            setIsLight(false);
            safeStorage.set('theme', 'dark');
        }
    };

    useEffect(() => {
        if (activeMenu) {
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    }, [activeMenu]);

    if (!activeMenu && !isVisible) return null;


    const handleKeywordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (keywordInput.trim()) {
            onKeywordAdd(keywordInput.trim());
            setKeywordInput('');
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();

            // Check for Choseong (Initial Consonants) or short Korean text
            // Regex for ONLY Choseong (Consonants) and spaces
            const isChoseong = /^[ㄱ-ㅎ\s]+$/.test(searchText);

            if (isChoseong) {
                // If Choseong, just close sheet (filter applied live)
                onClose();
            } else {
                // If normal text, trigger map search (if implemented)
                onSearch();
                onClose();
            }
        }
    };

    return (
        <>

            {/* Backdrop */}
            {
                hasBackdrop && (
                    <div
                        className={clsx(
                            "fixed inset-0 bg-black/60 backdrop-blur-sm z-[4980] transition-opacity duration-300",
                            activeMenu ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                        )}
                        onClick={onClose}
                    />
                )
            }



            {/* Sheet */}
            <div
                className={clsx(
                    "fixed bottom-0 left-0 right-0 z-[4990] bg-black/95 light:bg-white/95 backdrop-blur-xl border-t-2 rounded-t-3xl transition-transform duration-300 ease-out max-h-[90vh] flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.7)] light:shadow-[0_-5px_20px_rgba(0,0,0,0.1)] pb-0 animate-in slide-in-from-bottom duration-300",
                    activeMenu ? "translate-y-0 opacity-100" : "translate-y-full opacity-50",
                    searchMode === 'location'
                        ? "border-emerald-500/60 light:border-emerald-600/30"
                        : "border-purple-400/60 light:border-purple-600/30",
                    !hasBackdrop && "pointer-events-auto" // Ensure it's clickable if no backdrop
                )}
            >
                {/* Handle Bar */}
                <div className="w-full flex justify-center pt-3 pb-1" onClick={onClose}>
                    <div className="w-12 h-1.5 bg-gray-600/50 rounded-full cursor-pointer hover:bg-gray-500 transition-colors" />
                </div>

                {/* Content Area */}
                <div className="p-6 h-full overflow-hidden flex flex-col pb-32">

                    {/* VIEW MENU */}
                    {activeMenu === 'view' && (
                        <div className="space-y-6">
                            <h3 className="text-xl font-extrabold text-white light:text-black mb-4 px-1 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className={clsx(searchMode === 'location' ? "text-emerald-400" : "text-purple-400")}>#</span> 보기 방식
                                </div>

                                {/* Theme Toggle */}
                                <div className="flex bg-gray-800 light:bg-gray-200 p-1 rounded-full border border-white/10 light:border-black/5">
                                    <button
                                        onClick={toggleTheme}
                                        className={clsx(
                                            "p-1.5 rounded-full transition-all duration-300 flex items-center gap-1.5 px-3",
                                            !isLight ? "bg-gray-700 text-white shadow-md" : "text-gray-400 hover:text-gray-600"
                                        )}
                                    >
                                        <Moon size={14} />
                                        <span className="text-xs font-extrabold">다크</span>
                                    </button>
                                    <button
                                        onClick={toggleTheme}
                                        className={clsx(
                                            "p-1.5 rounded-full transition-all duration-300 flex items-center gap-1.5 px-3",
                                            isLight ? "bg-white text-orange-500 shadow-md" : "text-gray-400 hover:text-gray-300"
                                        )}
                                    >
                                        <Sun size={14} />
                                        <span className="text-xs font-extrabold">라이트</span>
                                    </button>
                                </div>
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { id: 'grid', label: '썸네일 보기', desc: '포스터 중심', icon: LayoutGrid, color: 'text-purple-400' },
                                    { id: 'list', label: '리스트 보기', desc: '정보 중심', icon: ListDetailsIcon, color: 'text-blue-400' },
                                    { id: 'calendar', label: '달력 보기', desc: '일자별 일정', icon: CalendarDays, color: 'text-green-400' },
                                    { id: 'map', label: '지도 보기', desc: '위치 기반', icon: Map, color: 'text-orange-400' }
                                ].map((mode) => {
                                    const isSelected = viewMode === mode.id;
                                    // Use icon from config (Clover for list/grid)
                                    const DisplayIcon = mode.icon;
                                    return (
                                        <button
                                            key={mode.id}
                                            onClick={() => {
                                                onViewModeChange(mode.id);
                                                if (mode.id === 'map' && onSearchModeChange) {
                                                    onSearchModeChange('location');
                                                }
                                                onClose();
                                            }}
                                            className={clsx(
                                                "p-4 rounded-2xl border text-left transition-all duration-300 group hover:scale-[1.02]",
                                                isSelected
                                                    ? (searchMode === 'location'
                                                        ? "bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-900/50 light:bg-emerald-50 light:border-emerald-600 light:shadow-none light:text-black"
                                                        : "bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-900/50 light:bg-purple-50 light:border-purple-600 light:shadow-none light:text-black")
                                                    : "bg-gray-900/50 light:bg-white border-white/5 light:border-black/5 hover:bg-gray-800 light:hover:bg-gray-50"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={clsx("p-2 rounded-lg",
                                                    isSelected
                                                        ? (searchMode === 'location'
                                                            ? "bg-transparent text-white light:bg-emerald-100 light:text-emerald-600"
                                                            : "bg-transparent text-white light:bg-purple-100 light:text-purple-600")
                                                        : "text-gray-400 light:text-black p-0 bg-transparent light:bg-transparent")
                                                }>
                                                    <DisplayIcon size={20} className={clsx(isSelected && "w-5 h-5")} />
                                                </div>
                                                <div className="text-sm font-extrabold text-gray-200 light:text-black">{mode.label}</div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* CATEGORY MENU */}
                    {activeMenu === 'category' && (
                        <div className="space-y-4">
                            <h3 className="text-lg font-extrabold text-white light:text-black px-1 flex items-center gap-2">
                                <span className={clsx(searchMode === 'location' ? "text-emerald-400" : "text-purple-400")}>#</span> 카테고리
                            </h3>
                            <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
                                {/* All */}
                                <button
                                    onClick={() => { onGenreSelect('all'); onClose(); }}
                                    className={clsx(
                                        "rounded-xl px-3 py-2.5 flex items-center gap-2 transition-all border",
                                        selectedGenre === 'all'
                                            ? (searchMode === 'location'
                                                ? "bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-900/50 light:bg-emerald-50 light:text-emerald-700 light:border-emerald-600 light:shadow-none"
                                                : "bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-900/50 light:bg-purple-50 light:text-purple-700 light:border-purple-600 light:shadow-none")
                                            : "bg-gray-800/50 light:bg-white text-gray-400 light:text-black border-white/5 light:border-black/5 hover:bg-gray-800 light:hover:bg-gray-50 hover:border-white/10"
                                    )}
                                >
                                    <CloverIcon className="w-4 h-4" />
                                    <span className="text-sm font-semibold">전체</span>
                                </button>

                                {/* Hotdeal */}
                                <button
                                    onClick={() => { onGenreSelect('hotdeal'); onClose(); }}
                                    className={clsx(
                                        "rounded-xl px-3 py-2.5 flex items-center gap-2 transition-all border",
                                        selectedGenre === 'hotdeal'
                                            ? (searchMode === 'location'
                                                ? "bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-900/50 light:bg-emerald-50 light:text-emerald-700 light:border-emerald-600 light:shadow-none"
                                                : "bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-900/50 light:bg-purple-50 light:text-purple-700 light:border-purple-600 light:shadow-none")
                                            : "bg-gray-800/50 light:bg-white text-gray-400 light:text-black border-white/5 light:border-black/5 hover:bg-gray-800 light:hover:bg-gray-50 hover:border-white/10"
                                    )}
                                >
                                    {getGenreIcon('hotdeal', 16)}
                                    <span className="text-sm font-semibold">핫딜</span>
                                </button>

                                {GENRES.filter(g => g.id !== 'hotdeal' && g.id !== 'all').map(genre => {
                                    const isSelected = selectedGenre === genre.id;
                                    return (
                                        <button
                                            key={genre.id}
                                            onClick={() => { onGenreSelect(genre.id); onClose(); }}
                                            className={clsx(
                                                "rounded-xl px-3 py-2.5 flex items-center gap-2 transition-all border",
                                                isSelected
                                                    ? (searchMode === 'location'
                                                        ? "bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-900/50 light:bg-emerald-50 light:text-emerald-700 light:border-emerald-600 light:shadow-none"
                                                        : "bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-900/50 light:bg-purple-50 light:text-purple-700 light:border-purple-600 light:shadow-none")
                                                    : "bg-gray-800/50 light:bg-white text-gray-400 light:text-black border-white/5 light:border-black/5 hover:bg-gray-800 light:hover:bg-gray-50 hover:border-white/10"
                                            )}
                                        >
                                            {getGenreIcon(genre.id, 16)}
                                            <span className="text-sm font-semibold truncate">{genre.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}


                    {/* LOCATION MENU */}
                    {activeMenu === 'location' && (
                        <div className="space-y-4">
                            <h3 className="text-xl font-extrabold text-white light:text-black px-1 flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                    <span className={clsx(searchMode === 'location' ? "text-emerald-400" : "text-purple-400")}>#</span> 위치 및 검색
                                </div>

                                {/* Search Mode Toggle (New Location) */}
                                <div className="flex bg-gray-800 light:bg-gray-200 p-1 rounded-full border border-white/10 light:border-black/5">
                                    <button
                                        onClick={() => onSearchModeChange && onSearchModeChange('location')}
                                        className={clsx(
                                            "p-1.5 rounded-full transition-all duration-300 flex items-center gap-1.5 px-3",
                                            searchMode === 'location' ? "bg-emerald-600 text-white shadow-md light:bg-white light:text-emerald-600" : "text-gray-400 hover:text-gray-200 light:text-gray-500 light:hover:text-gray-700"
                                        )}
                                    >
                                        <MapPin size={14} className={clsx(searchMode === 'location' ? "text-white light:text-emerald-600" : "")} />
                                        <span className="text-xs font-extrabold">위치검색</span>
                                    </button>
                                    <button
                                        onClick={() => onSearchModeChange && onSearchModeChange('keyword')}
                                        className={clsx(
                                            "p-1.5 rounded-full transition-all duration-300 flex items-center gap-1.5 px-3",
                                            searchMode === 'keyword' ? "bg-purple-600 text-white shadow-md light:bg-white light:text-purple-600" : "text-gray-400 hover:text-gray-200 light:text-gray-500 light:hover:text-gray-700"
                                        )}
                                    >
                                        <Search size={14} className={clsx(searchMode === 'keyword' ? "text-white light:text-purple-600" : "")} />
                                        <span className="text-xs font-extrabold">키워드</span>
                                    </button>
                                </div>
                            </h3>

                            {/* Search Bar - Unified Style */}
                            <div className="w-full relative group z-10">
                                <div className={clsx(
                                    "p-[3px] rounded-full transition-all duration-300 shadow-lg opacity-90 group-focus-within:opacity-100 group-focus-within:scale-[1.01]",
                                    searchMode === 'location'
                                        ? "bg-gradient-to-r from-[#55df99] to-[#0090f5] shadow-emerald-500/20"
                                        : "bg-gradient-to-r from-[#a78bfa] via-purple-500 to-[#f472b6] shadow-purple-500/20"
                                )}>
                                    <div className="bg-[#0a0a0a] light:bg-white rounded-full flex items-center p-1 relative">

                                        {/* Input Only */}
                                        <div className="flex-1 relative">
                                            <input
                                                type="text"
                                                value={searchText}
                                                onChange={(e) => onSearchChange(e.target.value)}
                                                onKeyDown={handleKeyDown}
                                                placeholder={searchMode === 'location' ? "지역, 장소 검색..." : "공연명, 장소, 출연진 검색..."}
                                                className="bg-transparent border-none text-white light:text-black text-base font-extrabold px-4 py-3 w-full focus:outline-none placeholder-gray-600 light:placeholder-gray-400"
                                            />
                                            {searchText && (
                                                <button
                                                    onClick={() => onSearchChange('')}
                                                    className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-gray-500 hover:text-white light:hover:text-black"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Search Button (Added) */}
                                        <div className="flex px-1 shrink-0">
                                            <button
                                                onClick={() => {
                                                    onSearch();
                                                    onClose();
                                                }}
                                                className={clsx(
                                                    "p-3 rounded-full text-white shadow-md hover:scale-105 active:scale-95 transition-all outline-none ml-1",
                                                    searchMode === 'location'
                                                        ? "bg-gradient-to-br from-[#55df99] to-[#0090f5] shadow-emerald-500/30 text-white"
                                                        : "bg-gradient-to-r from-[#a78bfa] to-[#f472b6] text-white"
                                                )}
                                            >
                                                {searchMode === 'location' ? <MapPin size={20} className="fill-current" /> : <Search size={20} />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>


                            {/* Search Results List (Inserted) */}
                            {searchResults.length > 0 && searchText.trim().length > 0 && (
                                <div className="w-full flex flex-col gap-1 max-h-[200px] overflow-y-auto custom-scrollbar my-2 p-1">
                                    {searchResults.map((result, idx) => (
                                        <button
                                            key={`${result.id || result.venueId}-${idx}`}
                                            onClick={() => {
                                                onResultSelect(result);
                                                onClose(); // Close sheet on selection
                                            }}
                                            className={clsx(
                                                "w-full text-left px-3 py-2.5 rounded-xl transition-colors flex items-start gap-3 group shrink-0",
                                                "hover:bg-white/5 light:hover:bg-gray-50",
                                                searchMode === 'location' ? "hover:bg-emerald-500/10 light:hover:bg-emerald-50" : "hover:bg-purple-500/10 light:hover:bg-purple-50"
                                            )}
                                        >
                                            <div className={clsx(
                                                "p-2 rounded-lg mt-0.5 shrink-0",
                                                searchMode === 'location'
                                                    ? "bg-emerald-500/20 text-emerald-400 light:bg-emerald-100 light:text-emerald-600"
                                                    : "bg-purple-500/20 text-purple-400 light:bg-purple-100 light:text-purple-600"
                                            )}>
                                                {searchMode === 'location' ? <MapPin size={16} /> : <Search size={16} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-gray-200 light:text-gray-900 truncate">
                                                        {result.name}
                                                    </span>
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 light:bg-gray-200 text-gray-400 light:text-gray-600 whitespace-nowrap">
                                                        {result.category || result.type}
                                                    </span>
                                                </div>
                                                {result.address && (
                                                    <div className="text-xs text-gray-500 light:text-gray-500 truncate mt-0.5">
                                                        {result.address}
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Location Filter Unified */}
                            <LocationSelector
                                selectedRegion={selectedRegion}
                                onRegionSelect={onRegionSelect}
                                selectedDistrict={selectedDistrict}
                                onDistrictSelect={onDistrictSelect}
                                selectedVenue={selectedVenue}
                                onVenueSelect={onVenueSelect}
                                districts={districts}
                                availableVenues={availableVenues}
                                isMobile={true}
                                inline={true}
                                searchMode={searchMode}
                                referenceLocation={activeLocation}
                            />
                        </div>

                    )}

                    {/* VENUE DETAIL MENU (New) */}
                    {activeMenu === 'venue-detail' && (
                        <div className="flex flex-col h-full overflow-hidden">
                            <div className="flex justify-between items-center mb-4 shrink-0">
                                <div>
                                    <h3 className="text-xl font-bold text-white light:text-black flex items-center gap-2">
                                        <MapPin className="text-emerald-500 w-5 h-5" />
                                        {selectedVenue}
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-300 border border-emerald-800">
                                            {venuePerformances.length}건
                                        </span>
                                    </h3>
                                    {/* Address removed or can be passed if needed, defaulting to keeping it simple for now */}
                                </div>
                            </div>

                            <div className="overflow-y-auto space-y-3 custom-scrollbar flex-1 pb-safe">
                                {venuePerformances.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        공연 정보가 없습니다.
                                    </div>
                                ) : (
                                    venuePerformances.map((p) => (
                                        <a
                                            key={p.id}
                                            href={p.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex gap-3 bg-gray-800/50 light:bg-gray-100 p-2 rounded-lg hover:bg-gray-800 light:hover:bg-gray-200 transition border border-gray-800 light:border-gray-200 hover:border-emerald-500/30"
                                        >
                                            <div className="relative w-12 h-16 shrink-0 rounded bg-gray-900 overflow-hidden">
                                                {p.image ? (
                                                    <img src={getOptimizedUrl(p.image, 80)} alt={p.title} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-gray-800 text-gray-600">
                                                        <Star size={12} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={clsx(
                                                        "px-1.5 py-0.5 rounded text-[10px] font-extrabold text-white",
                                                        (GENRE_STYLES as any)[p.genre]?.twBg || 'bg-gray-600'
                                                    )}>
                                                        {GENRES.find(g => g.id === p.genre)?.label}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500">{p.date}</span>
                                                </div>
                                                <h4 className="text-sm font-bold text-gray-100 light:text-black line-clamp-2 leading-tight">
                                                    {p.title}
                                                </h4>
                                            </div>
                                        </a>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div >

        </>
    );
}
