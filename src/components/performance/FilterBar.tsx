
import React from 'react';
import { clsx } from 'clsx';
import { Home, Search, Star, MapPin, Map as MapIcon } from 'lucide-react';
import { GENRES } from '../../lib/constants';

interface FilterBarProps {
    isSticky: boolean;
    searchText: string;
    isDropdownOpen: boolean;
    activeSearchSource: 'hero' | 'sticky' | null;
    searchResults: any[];
    highlightedIndex: number;
    selectedGenre: string;
    searchLocation: { name: string } | null;
    userAddress: string | null;

    setSearchText: (val: string) => void;
    handleSearchTextChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleKeyDown: (e: React.KeyboardEvent) => void;
    setActiveSearchSource: (val: 'hero' | 'sticky') => void;
    handleSelectResult: (candidate: any) => void;
    setSelectedGenre: (val: string) => void;

    // Reset Handlers
    onReset: () => void;

    // Map Toggle
    setIsMapOpen: (val: boolean) => void;
}

export default function FilterBar({
    isSticky,
    searchText,
    isDropdownOpen,
    activeSearchSource,
    searchResults,
    highlightedIndex,
    selectedGenre,
    searchLocation,
    userAddress,
    setSearchText,
    handleSearchTextChange,
    handleKeyDown,
    setActiveSearchSource,
    handleSelectResult,
    setSelectedGenre,
    onReset,
    setIsMapOpen
}: FilterBarProps) {
    return (
        <div className={clsx(
            "sticky top-[60px] md:top-[0px] z-[50] transition-all duration-300 transform",
            isSticky ? "translate-y-0 opacity-100 pointer-events-auto" : "-translate-y-4 opacity-0 pointer-events-none h-0 overflow-hidden"
        )}>
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
            <div className="bg-[#0f1115]/90 light:bg-white/95 backdrop-blur-xl border-b border-white/5 light:border-black/5 shadow-2xl">
                <div className="max-w-7xl 2xl:max-w-[1800px] mx-auto px-4 py-3 flex flex-col gap-2">
                    {/* Upper Row: Controls & Groups */}
                    <div className="flex items-center gap-3 w-full">
                        {/* 1. Home / Refresh */}
                        <button
                            onClick={onReset}
                            className="p-2 rounded-full bg-gray-800/50 hover:bg-gray-800 text-gray-400 hover:text-white transition-colors border border-white/5 light:bg-gray-100 light:text-gray-600 light:hover:bg-gray-200 light:border-gray-200 shrink-0"
                        >
                            <Home size={18} />
                        </button>

                        {/* 2. Group Tabs */}
                        <div className="flex-1 overflow-x-auto scrollbar-hide flex gap-1 mask-linear-fade">
                            {React.useMemo(() => {
                                // Group Components
                                return [
                                    { id: 'all', label: '전체', genres: ['all', 'hotdeal'] },
                                    { id: 'performance', label: '공연', genres: ['musical', 'concert', 'play', 'classic'] },
                                    { id: 'exhibition', label: '전시', genres: ['exhibition', 'museum'] },
                                    { id: 'activity', label: '액티비티', genres: ['festival', 'activity', 'leisure', 'travel', 'kids', 'class'] },
                                    { id: 'sports', label: '스포츠', genres: ['baseball', 'soccer', 'basketball', 'volleyball', 'handball'] },
                                    { id: 'life', label: '라이프', genres: ['movie', 'ott', 'food'] },
                                ].map(group => {
                                    const isActive = group.id === 'all'
                                        ? (selectedGenre === 'all' || selectedGenre === 'hotdeal')
                                        : group.genres.includes(selectedGenre);

                                    return (
                                        <button
                                            key={group.id}
                                            onClick={() => {
                                                // When clicking a group, select the first item in that group (or 'all' for all)
                                                if (group.id === 'all') setSelectedGenre('all');
                                                else setSelectedGenre(group.genres[0]);
                                            }}
                                            className={clsx(
                                                "whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-bold transition-all relative",
                                                isActive
                                                    ? "text-white"
                                                    : "text-gray-500 hover:text-gray-300 light:text-gray-500 light:hover:text-black"
                                            )}
                                        >
                                            {group.label}
                                            {isActive && (
                                                <div className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#a78bfa] rounded-full" />
                                            )}
                                        </button>
                                    );
                                });
                            }, [selectedGenre, setSelectedGenre])}
                        </div>

                        {/* 4. Map Toggle */}
                        <button
                            onClick={() => setIsMapOpen(true)}
                            className="p-2 rounded-full bg-[#a78bfa]/20 hover:bg-[#a78bfa] text-[#a78bfa] hover:text-white transition-all border border-[#a78bfa]/30 shrink-0"
                        >
                            <MapIcon size={18} />
                        </button>
                    </div>

                    {/* Lower Row: Search & Sub-Chips */}
                    <div className="flex items-center gap-3 w-full">
                        {/* Search Input (Compact) */}
                        <div className="w-1/3 min-w-[120px] max-w-[200px] relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="w-3.5 h-3.5 text-gray-500 group-focus-within:text-[#a78bfa] transition-colors" />
                            </div>
                            <input
                                type="text"
                                className="block w-full pl-9 pr-3 py-1.5 bg-gray-900/50 light:bg-gray-100 border border-white/10 light:border-gray-200 rounded-lg leading-5 text-gray-300 light:text-gray-900 placeholder-gray-600 focus:outline-none focus:bg-gray-900 focus:border-[#a78bfa]/50 transition-all text-xs font-medium"
                                placeholder="검색..."
                                value={searchText}
                                onChange={handleSearchTextChange}
                                onKeyDown={handleKeyDown}
                                onFocus={() => setActiveSearchSource('sticky')}
                            />
                            {/* Sticky Dropdown Positioned Here */}
                            {isDropdownOpen && activeSearchSource === 'sticky' && searchResults.length > 0 && (
                                <div className="absolute top-full left-0 right-[-100px] mt-2 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-[9999] overflow-hidden max-h-[50vh] overflow-y-auto">
                                    {searchResults.map((result, idx) => (
                                        <div
                                            key={`search-sticky-${idx}`}
                                            onClick={() => handleSelectResult(result)}
                                            className={`px-4 py-3 cursor-pointer flex items-center justify-between gap-3 border-b border-white/5 last:border-0 transition-colors ${idx === highlightedIndex ? 'bg-white/20' : 'bg-[#1a1a1a] hover:bg-white/10'}`}
                                        >
                                            <div className="text-white text-xs font-bold truncate">{result.name}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Chips Row */}
                        <div className="flex-1 overflow-x-auto scrollbar-hide flex gap-2 mask-linear-fade">
                            {React.useMemo(() => {
                                // Determine Current Group
                                const groups = [
                                    { id: 'all', label: '전체', genres: ['all', 'hotdeal'] },
                                    { id: 'performance', label: '공연', genres: ['musical', 'concert', 'play', 'classic'] },
                                    { id: 'exhibition', label: '전시', genres: ['exhibition', 'museum'] },
                                    { id: 'activity', label: '액티비티', genres: ['festival', 'activity', 'leisure', 'travel', 'kids', 'class'] },
                                    { id: 'sports', label: '스포츠', genres: ['baseball', 'soccer', 'basketball', 'volleyball', 'handball'] },
                                    { id: 'life', label: '라이프', genres: ['movie', 'ott', 'food'] },
                                ];

                                const currentGroup = groups.find(g => g.genres.includes(selectedGenre)) || groups[0];

                                return currentGroup.genres.map(genreId => {
                                    const genreInfo = GENRES.find(g => g.id === genreId);
                                    if (!genreInfo) return null;

                                    return (
                                        <button
                                            key={genreId}
                                            onClick={() => setSelectedGenre(genreId)}
                                            className={clsx(
                                                "whitespace-nowrap px-3 py-1 rounded-full text-xs font-medium transition-all border",
                                                selectedGenre === genreId
                                                    ? "bg-[#a78bfa] text-white border-[#a78bfa]"
                                                    : "bg-gray-800/30 text-gray-500 border-white/5 hover:bg-gray-800 light:bg-gray-50 light:text-gray-600 light:border-gray-200"
                                            )}
                                        >
                                            {genreInfo.label}
                                        </button>
                                    );
                                });
                            }, [selectedGenre])}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
