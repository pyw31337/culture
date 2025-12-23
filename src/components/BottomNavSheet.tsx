import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { X, Search, Grid3X3, List, CalendarDays, Map, LayoutGrid, Mic2, Music, Ticket, Frame, Baby, Star } from 'lucide-react';
import { BottomMenuType } from './BottomNav';
import { GENRES, GENRE_STYLES, REGIONS } from '@/lib/constants';

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
}

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
    onVenueSelect
}: BottomNavSheetProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [keywordInput, setKeywordInput] = useState('');

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

    // Custom SVG Icon Components for genres
    const FlameIcon = ({ size = 16 }: { size?: number }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 10.941c2.333 -3.308 .167 -7.823 -1 -8.941c0 3.395 -2.235 5.299 -3.667 6.706c-1.43 1.408 -2.333 3.621 -2.333 5.588c0 3.704 3.134 6.706 7 6.706s7 -3.002 7 -6.706c0 -1.712 -1.232 -4.403 -2.333 -5.588c-2.084 3.353 -3.257 3.353 -4.667 2.235" />
        </svg>
    );

    const MovieIcon = ({ size = 16 }: { size?: number }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" />
            <path d="M8 4l0 16" /><path d="M16 4l0 16" /><path d="M4 8l4 0" /><path d="M4 16l4 0" /><path d="M4 12l16 0" /><path d="M16 8l4 0" /><path d="M16 16l4 0" />
        </svg>
    );

    const TicketIcon = ({ size = 16 }: { size?: number }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l0 2" /><path d="M15 11l0 2" /><path d="M15 17l0 2" />
            <path d="M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-3a2 2 0 0 0 0 -4v-3a2 2 0 0 1 2 -2" />
        </svg>
    );

    const TheaterIcon = ({ size = 16 }: { size?: number }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9.5 11l.01 0" /><path d="M14.5 11l.01 0" /><path d="M9.5 15a3.5 3.5 0 0 0 5 0" />
            <path d="M7 5h1v-2h8v2h1a3 3 0 0 1 3 3v9a3 3 0 0 1 -3 3v1h-10v-1a3 3 0 0 1 -3 -3v-9a3 3 0 0 1 3 -3" />
        </svg>
    );

    const ExhibitionIcon = ({ size = 16 }: { size?: number }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 11h16" /><path d="M12 6.5c0 1 -5 4.5 -8 4.5" /><path d="M12 6.5c0 1 5 4.5 8 4.5" />
            <path d="M6 11c-.333 5.333 -1 8.667 -2 10h4c1 0 4 -4 4 -9v-1" />
            <path d="M18 11c.333 5.333 1 8.667 2 10h-4c-1 0 -4 -4 -4 -9v-1" /><path d="M12 7v-4l2 1h-2" />
        </svg>
    );

    const ActivityIcon = ({ size = 16 }: { size?: number }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4a1 1 0 1 0 2 0a1 1 0 0 0 -2 0" /><path d="M3 17l5 1l.75 -1.5" />
            <path d="M14 21v-4l-4 -3l1 -6" /><path d="M6 12v-3l5 -1l3 3l3 1" />
            <path d="M19.5 20a.5 .5 0 1 0 0 -1a.5 .5 0 0 0 0 1z" fill="currentColor" />
        </svg>
    );

    const ClassIcon = ({ size = 16 }: { size?: number }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 9l-10 -4l-10 4l10 4l10 -4v6" /><path d="M6 10.6v5.4a6 3 0 0 0 12 0v-5.4" />
        </svg>
    );

    const TravelIcon = ({ size = 16 }: { size?: number }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3.59 7h8.82a1 1 0 0 1 .902 1.433l-1.44 3a1 1 0 0 1 -.901 .567h-5.942a1 1 0 0 1 -.901 -.567l-1.44 -3a1 1 0 0 1 .901 -1.433" />
            <path d="M6 7l-.78 -2.342a.5 .5 0 0 1 .473 -.658h4.612a.5 .5 0 0 1 .475 .658l-.78 2.342" />
            <path d="M8 2v2" /><path d="M6 12v9h4v-9" /><path d="M3 21h18" />
            <path d="M22 5h-6l-1 -1" /><path d="M18 3l2 2l-2 2" /><path d="M10 17h7a2 2 0 0 1 2 2v2" />
        </svg>
    );

    const FestivalIcon = ({ size = 16 }: { size?: number }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 5h2" /><path d="M5 4v2" /><path d="M11.5 4l-.5 2" /><path d="M18 5h2" /><path d="M19 4v2" />
            <path d="M15 9l-1 1" /><path d="M18 13l2 -.5" /><path d="M18 19h2" /><path d="M19 18v2" />
            <path d="M14 16.518l-6.518 -6.518l-4.39 9.58a1 1 0 0 0 1.329 1.329l9.579 -4.39z" />
        </svg>
    );

    const LeisureIcon = ({ size = 16 }: { size?: number }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6.414 6.414a2 2 0 0 0 0 -2.828l-1.414 -1.414l-2.828 2.828l1.414 1.414a2 2 0 0 0 2.828 0z" />
            <path d="M17.586 17.586a2 2 0 0 0 0 2.828l1.414 1.414l2.828 -2.828l-1.414 -1.414a2 2 0 0 0 -2.828 0z" />
            <path d="M6.5 6.5l11 11" /><path d="M22 2.5c-9.983 2.601 -17.627 7.952 -20 19.5c9.983 -2.601 17.627 -7.952 20 -19.5z" />
            <path d="M6.5 12.5l5 5" /><path d="M12.5 6.5l5 5" />
        </svg>
    );

    const VolleyballIcon = ({ size = 16 }: { size?: number }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
            <path d="M12 12a8 8 0 0 0 8 4" /><path d="M7.5 13.5a12 12 0 0 0 8.5 6.5" />
            <path d="M12 12a8 8 0 0 0 -7.464 4.928" /><path d="M12.951 7.353a12 12 0 0 0 -9.88 4.111" />
            <path d="M12 12a8 8 0 0 0 -.536 -8.928" /><path d="M15.549 15.147a12 12 0 0 0 1.38 -10.611" />
        </svg>
    );

    const BasketballIcon = ({ size = 16 }: { size?: number }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
            <path d="M5.65 5.65l12.7 12.7" /><path d="M5.65 18.35l12.7 -12.7" />
            <path d="M12 3a9 9 0 0 0 9 9" /><path d="M3 12a9 9 0 0 1 9 9" />
        </svg>
    );

    const BaseballIcon = ({ size = 16 }: { size?: number }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5.636 18.364a9 9 0 1 0 12.728 -12.728a9 9 0 0 0 -12.728 12.728z" />
            <path d="M12.495 3.02a9 9 0 0 1 -9.475 9.475" /><path d="M20.98 11.505a9 9 0 0 0 -9.475 9.475" />
            <path d="M9 9l2 2" /><path d="M13 13l2 2" /><path d="M11 7l2 1" /><path d="M7 11l1 2" />
            <path d="M16 11l1 2" /><path d="M11 16l2 1" />
        </svg>
    );

    const FootballIcon = ({ size = 16 }: { size?: number }) => (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
            <path d="M12 7l4.76 3.45l-1.76 5.55h-6l-1.76 -5.55z" />
            <path d="M12 7v-4m3 13l2.5 3m-.74 -8.55l3.74 -1.45m-11.44 7.05l-2.56 2.95m.74 -8.55l-3.74 -1.45" />
        </svg>
    );

    // Helper to get genre icon
    const getGenreIcon = (id: string) => {
        switch (id) {
            case 'hotdeal': return FlameIcon;
            case 'movie': return MovieIcon;
            case 'musical': return TicketIcon;
            case 'theater': return TheaterIcon;
            case 'concert': return TheaterIcon; // Fallback to theater
            case 'classic': return ClassIcon;
            case 'exhibition': return ExhibitionIcon;
            case 'activity': return ActivityIcon;
            case 'class': return ClassIcon;
            case 'travel': return TravelIcon;
            case 'festival': return FestivalIcon;
            case 'leisure': return LeisureIcon;
            case 'volleyball': return VolleyballIcon;
            case 'basketball': return BasketballIcon;
            case 'baseball': return BaseballIcon;
            case 'football': return FootballIcon;
            case 'kids': return TheaterIcon;
            default: return LayoutGrid;
        }
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className={clsx(
                    "fixed inset-0 bg-black/60 backdrop-blur-sm z-[9980] transition-opacity duration-300",
                    activeMenu ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            {/* Sheet */}
            <div
                className={clsx(
                    "fixed bottom-0 left-0 right-0 z-[9985] bg-black/95 backdrop-blur-xl border-t-2 border-purple-400/60 rounded-t-3xl transition-transform duration-300 ease-out max-h-[75vh] flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.7)] pb-20 animate-purple-shimmer",
                    activeMenu ? "translate-y-0 opacity-100" : "translate-y-full opacity-50"
                )}
            >
                {/* Handle Bar */}
                <div className="w-full flex justify-center pt-3 pb-1" onClick={onClose}>
                    <div className="w-12 h-1.5 bg-gray-600/50 rounded-full cursor-pointer hover:bg-gray-500 transition-colors" />
                </div>

                {/* Content Area */}
                <div className="p-6 overflow-y-auto custom-scrollbar">

                    {/* VIEW MENU */}
                    {activeMenu === 'view' && (
                        <div className="space-y-6">
                            <h3 className="text-xl font-bold text-white mb-4 px-1 flex items-center gap-2">
                                <span className="text-purple-400">#</span> 보기 방식
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                {[
                                    { id: 'grid', label: '썸네일 보기', desc: '포스터 중심', icon: Grid3X3, color: 'text-purple-400' },
                                    { id: 'list', label: '리스트 보기', desc: '정보 중심', icon: List, color: 'text-blue-400' },
                                    { id: 'calendar', label: '달력 보기', desc: '일자별 일정', icon: CalendarDays, color: 'text-green-400' },
                                    { id: 'map', label: '지도 보기', desc: '위치 기반', icon: Map, color: 'text-orange-400' }
                                ].map((mode) => {
                                    const Icon = mode.icon;
                                    const isSelected = viewMode === mode.id;
                                    return (
                                        <button
                                            key={mode.id}
                                            onClick={() => { onViewModeChange(mode.id); onClose(); }}
                                            className={clsx(
                                                "p-4 rounded-2xl border text-left transition-all duration-300 group hover:scale-[1.02]",
                                                isSelected
                                                    ? "bg-white/10 border-purple-500/50 shadow-[0_0_15px_rgba(168,85,247,0.2)]"
                                                    : "bg-gray-900/50 border-white/5 hover:bg-gray-800"
                                            )}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={clsx("p-2 rounded-lg", isSelected ? "bg-gray-800 text-white" : "text-gray-400 p-0 bg-transparent")}>
                                                    <Icon size={20} />
                                                </div>
                                                <div className="text-sm font-bold text-gray-200">{mode.label}</div>
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
                            <h3 className="text-lg font-bold text-white px-1 flex items-center gap-2">
                                <span className="text-purple-400">#</span> 카테고리
                            </h3>
                            <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
                                {/* All */}
                                <button
                                    onClick={() => { onGenreSelect('all'); onClose(); }}
                                    className={clsx(
                                        "rounded-xl px-3 py-2.5 flex items-center gap-2 transition-all border",
                                        selectedGenre === 'all'
                                            ? "bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-900/50"
                                            : "bg-gray-800/50 text-gray-400 border-white/5 hover:bg-gray-800 hover:border-white/10"
                                    )}
                                >
                                    <LayoutGrid size={16} />
                                    <span className="text-sm font-medium">전체</span>
                                </button>

                                {/* Hotdeal */}
                                <button
                                    onClick={() => { onGenreSelect('hotdeal'); onClose(); }}
                                    className={clsx(
                                        "rounded-xl px-3 py-2.5 flex items-center gap-2 transition-all border",
                                        selectedGenre === 'hotdeal'
                                            ? "bg-gradient-to-r from-orange-500 to-red-500 text-white border-transparent shadow-lg shadow-orange-900/50"
                                            : "bg-gray-800/50 text-gray-400 border-white/5 hover:bg-gray-800 hover:border-white/10"
                                    )}
                                >
                                    <Star size={16} />
                                    <span className="text-sm font-medium">핫딜</span>
                                </button>

                                {GENRES.filter(g => g.id !== 'hotdeal' && g.id !== 'all').map(genre => {
                                    const GenreIcon = getGenreIcon(genre.id);
                                    const isSelected = selectedGenre === genre.id;
                                    return (
                                        <button
                                            key={genre.id}
                                            onClick={() => { onGenreSelect(genre.id); onClose(); }}
                                            className={clsx(
                                                "rounded-xl px-3 py-2.5 flex items-center gap-2 transition-all border",
                                                isSelected
                                                    ? `${GENRE_STYLES[genre.id]?.twBg.replace('bg-', 'bg-') || 'bg-gray-600'} text-white border-transparent ring-2 ring-white/20 shadow-lg`
                                                    : "bg-gray-800/50 text-gray-400 border-white/5 hover:bg-gray-800 hover:border-white/10"
                                            )}
                                        >
                                            <GenreIcon size={16} />
                                            <span className="text-sm font-medium truncate">{genre.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* LOCATION MENU */}
                    {activeMenu === 'location' && (
                        <div className="space-y-6">
                            <h3 className="text-xl font-bold text-white px-1 flex items-center gap-2">
                                <span className="text-purple-400">#</span> 위치 및 검색
                            </h3>

                            {/* Search Bar - Hero Style */}
                            <div className="w-full relative group">
                                <div className="p-[3px] rounded-full bg-gradient-to-r from-[#a78bfa] via-purple-500 to-[#f472b6] shadow-lg shadow-purple-500/20 transition-all duration-300 group-focus-within:shadow-purple-500/40 opacity-90 group-focus-within:opacity-100">
                                    <div className="bg-[#0a0a0a] rounded-full flex items-center p-1 relative">
                                        <Search className="ml-3 text-purple-400 w-5 h-5" />
                                        <input
                                            type="text"
                                            value={searchText}
                                            onChange={(e) => onSearchChange(e.target.value)}
                                            placeholder="공연명, 출연진, 장소 검색..."
                                            className="bg-transparent border-none text-white text-lg font-bold px-4 py-3 w-full focus:outline-none placeholder-gray-600"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Location Selectors */}
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 ml-1 mb-2 block uppercase tracking-wider">지역 (시/도)</label>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => onRegionSelect('all')}
                                            className={clsx(
                                                "px-4 py-2.5 rounded-xl text-sm font-medium border transition-all",
                                                selectedRegion === 'all'
                                                    ? "bg-purple-600 text-white border-purple-500 shadow-md"
                                                    : "bg-gray-800/50 text-gray-400 border-white/5 hover:bg-gray-800"
                                            )}
                                        >
                                            전체
                                        </button>

                                        {REGIONS.filter(r => r.id !== 'all').map(r => (
                                            <button
                                                key={r.id}
                                                onClick={() => onRegionSelect(r.id)}
                                                className={clsx(
                                                    "px-4 py-2.5 rounded-xl text-sm font-medium border transition-all",
                                                    selectedRegion === r.id
                                                        ? "bg-white text-black border-white shadow-md font-bold"
                                                        : "bg-gray-800/50 text-gray-400 border-white/5 hover:bg-gray-800"
                                                )}
                                            >
                                                {r.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {selectedRegion !== 'all' && (
                                    <div className="animate-fade-in-up">
                                        <label className="text-xs font-bold text-gray-500 ml-1 mb-2 block uppercase tracking-wider">상세 지역 (구/군)</label>
                                        <div className="flex flex-wrap gap-2 p-4 bg-gray-900/30 rounded-2xl border border-white/5">
                                            <button
                                                onClick={() => onDistrictSelect('all')}
                                                className={clsx(
                                                    "px-3 py-2 rounded-lg text-xs font-medium border transition-all",
                                                    selectedDistrict === 'all'
                                                        ? "bg-purple-500/20 text-purple-300 border-purple-500/50"
                                                        : "bg-gray-800 text-gray-400 border-gray-700"
                                                )}
                                            >
                                                전체
                                            </button>
                                            {districts.map(d => (
                                                <button
                                                    key={d}
                                                    onClick={() => onDistrictSelect(d)}
                                                    className={clsx(
                                                        "px-3 py-2 rounded-lg text-xs font-medium border transition-all",
                                                        selectedDistrict === d
                                                            ? "bg-white text-black border-white font-bold"
                                                            : "bg-gray-800 text-gray-400 border-gray-700 hover:bg-gray-700"
                                                    )}
                                                >
                                                    {d}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Venue List - Select Dropdown */}
                                <div className="animate-fade-in-up">
                                    <label className="text-xs font-bold text-gray-500 ml-1 mb-2 block uppercase tracking-wider">공연장 ({availableVenues.length})</label>
                                    <div className="relative">
                                        <select
                                            value={selectedVenue}
                                            onChange={(e) => onVenueSelect(e.target.value)}
                                            className="w-full bg-gray-900/80 border border-white/10 rounded-xl py-3 px-4 text-white appearance-none cursor-pointer focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all text-sm"
                                        >
                                            <option value="all">전체 공연장</option>
                                            {availableVenues.map(v => (
                                                <option key={v} value={v}>{v}</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}



                </div>
            </div>
        </>
    );
}
