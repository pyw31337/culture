import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { X, Search, Grid3X3, List, CalendarDays, Map, LayoutGrid, LayoutList, Mic2, Music, Ticket, Frame, Baby, Star, Moon, Sun } from 'lucide-react';
import { BottomMenuType, ListDetailsIcon } from './BottomNav';
import { CloverIcon } from './GenreIcons';
import { GENRES, GENRE_STYLES, REGIONS } from '@/lib/constants';
import { safeStorage } from '@/lib/safeStorage';

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
    onSearch
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
            <div
                className={clsx(
                    "fixed inset-0 bg-black/60 backdrop-blur-sm z-[4980] transition-opacity duration-300",
                    activeMenu ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            {/* Sheet */}
            <div
                className={clsx(
                    "fixed bottom-0 left-0 right-0 z-[4990] bg-black/95 light:bg-white/95 backdrop-blur-xl border-t-2 border-purple-400/60 light:border-purple-600/30 rounded-t-3xl transition-transform duration-300 ease-out max-h-[90vh] flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.7)] light:shadow-[0_-5px_20px_rgba(0,0,0,0.1)] pb-0 animate-purple-shimmer",
                    activeMenu ? "translate-y-0 opacity-100" : "translate-y-full opacity-50"
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
                                    <span className="text-purple-400 light:text-purple-600">#</span> 보기 방식
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
                                            onClick={() => { onViewModeChange(mode.id); onClose(); }}
                                            className={clsx(
                                                "p-4 rounded-2xl border text-left transition-all duration-300 group hover:scale-[1.02]",
                                                isSelected
                                                    ? "bg-white/10 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)] light:bg-purple-50 light:border-purple-600 light:shadow-none"
                                                    : "bg-gray-900/50 light:bg-white border-white/5 light:border-black/5 hover:bg-gray-800 light:hover:bg-gray-50"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={clsx("p-2 rounded-lg", isSelected ? "bg-gray-800 text-white light:bg-purple-100 light:text-purple-600" : "text-gray-400 light:text-black p-0 bg-transparent light:bg-transparent")}>
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
                                <span className="text-purple-400">#</span> 카테고리
                            </h3>
                            <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
                                {/* All */}
                                <button
                                    onClick={() => { onGenreSelect('all'); onClose(); }}
                                    className={clsx(
                                        "rounded-xl px-3 py-2.5 flex items-center gap-2 transition-all border",
                                        selectedGenre === 'all'
                                            ? "bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-900/50 light:bg-purple-50 light:text-purple-700 light:border-purple-600 light:shadow-none"
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
                                            ? "bg-gradient-to-r from-orange-500 to-red-500 text-white border-transparent shadow-lg shadow-orange-900/50 light:bg-purple-50 light:text-purple-700 light:border-purple-600 light:shadow-none light:bg-none"
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
                                                    ? `${GENRE_STYLES[genre.id]?.twBg.replace('bg-', 'bg-') || 'bg-gray-600'} text-white border-transparent ring-2 ring-white/20 shadow-lg light:bg-white light:text-purple-700 light:border-purple-600 light:ring-purple-600`
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
                        <div className="space-y-6">
                            <h3 className="text-xl font-extrabold text-white light:text-black px-1 flex items-center gap-2">
                                <span className="text-purple-400">#</span> 위치 및 검색
                            </h3>

                            {/* Search Bar - Hero Style */}
                            <div className="w-full relative group">
                                <div className="p-[3px] rounded-full bg-gradient-to-r from-[#a78bfa] via-purple-500 to-[#f472b6] shadow-lg shadow-purple-500/20 transition-all duration-300 group-focus-within:shadow-[0_0_20px_rgba(167,139,250,0.6),0_0_40px_rgba(244,114,182,0.4)] opacity-90 group-focus-within:opacity-100 group-focus-within:scale-[1.01]">
                                    <div className="bg-[#0a0a0a] light:bg-white rounded-full flex items-center p-1 relative">
                                        <Search className="ml-3 text-purple-400 w-5 h-5" />
                                        <input
                                            type="text"
                                            value={searchText}
                                            onChange={(e) => onSearchChange(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder="공연명, 출연진, 장소 검색..."
                                            className="bg-transparent border-none text-white light:text-black text-lg font-extrabold px-4 py-3 w-full focus:outline-none placeholder-gray-600 light:placeholder-gray-400"
                                        />
                                    </div>
                                </div>
                            </div>

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
                            />
                        </div>
                    )}



                </div>
            </div>
        </>
    );
}
