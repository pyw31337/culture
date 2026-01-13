
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
                <div className="max-w-7xl 2xl:max-w-[1800px] mx-auto px-4 py-3 flex items-center gap-3">
                    {/* 1. Home / Refresh */}
                    <button
                        onClick={onReset}
                        className="p-2.5 rounded-full bg-gray-800/50 hover:bg-gray-800 text-gray-400 hover:text-white transition-colors border border-white/5 light:bg-gray-100 light:text-gray-600 light:hover:bg-gray-200 light:border-gray-200"
                    >
                        <Home size={18} />
                    </button>

                    {/* 2. Search Input (Compact) */}
                    <div className="flex-1 max-w-lg relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="w-4 h-4 text-gray-500 group-focus-within:text-[#a78bfa] transition-colors" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-2.5 bg-gray-900/50 light:bg-gray-100 border border-white/10 light:border-gray-200 rounded-full leading-5 text-gray-300 light:text-gray-900 placeholder-gray-600 focus:outline-none focus:bg-gray-900 focus:border-[#a78bfa]/50 transition-all text-sm font-medium"
                            placeholder={searchLocation?.name || userAddress ? `${searchLocation?.name || userAddress} 주변 검색...` : "공연, 배우, 장소 검색..."}
                            value={searchText}
                            onChange={handleSearchTextChange}
                            onKeyDown={handleKeyDown}
                            onFocus={() => setActiveSearchSource('sticky')}
                        />
                        {/* Sticky Dropdown Positioned Here */}
                        {isDropdownOpen && activeSearchSource === 'sticky' && searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-3 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl z-[9999] overflow-hidden max-h-[60vh] overflow-y-auto">
                                {searchResults.map((result, idx) => {
                                    const addressParts = result.address ? result.address.split(' ') : [];
                                    const shortAddress = addressParts.length >= 2 ? `${addressParts[0]} ${addressParts[1]}` : result.address;
                                    return (
                                        <div
                                            key={`search-sticky-${idx}`}
                                            onClick={() => handleSelectResult(result)}
                                            className={`px-4 py-3 cursor-pointer flex items-center justify-between gap-3 border-b border-white/5 last:border-0 transition-colors ${idx === highlightedIndex ? 'bg-white/20' : 'bg-[#1a1a1a] hover:bg-white/10'}`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="bg-black/50 p-2 rounded-full shrink-0 border border-white/10">
                                                    {result.type === 'video' ? <Star className="w-3.5 h-3.5 text-yellow-500" /> : <MapPin className="w-3.5 h-3.5 text-[#a78bfa]" />}
                                                </div>
                                                <div className="text-white text-sm font-bold truncate">{result.name}</div>
                                            </div>
                                            <div className="text-gray-500 text-xs whitespace-nowrap shrink-0">{shortAddress}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* 3. Category Scroll (Compact) */}
                    <div className="flex-1 overflow-x-auto scrollbar-hide flex gap-2 mask-linear-fade">
                        {GENRES.map(genre => (
                            <button
                                key={genre.id}
                                onClick={() => setSelectedGenre(genre.id)}
                                className={clsx(
                                    "whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-all border",
                                    selectedGenre === genre.id
                                        ? "bg-[#a78bfa] text-white border-[#a78bfa]"
                                        : "bg-gray-800/50 text-gray-400 border-white/10 hover:bg-gray-800 light:bg-gray-50 light:text-gray-600 light:border-gray-200"
                                )}
                            >
                                {genre.label}
                            </button>
                        ))}
                    </div>

                    {/* 4. Map/List Toggle */}
                    <button
                        onClick={() => setIsMapOpen(true)}
                        className="p-2.5 rounded-full bg-[#a78bfa]/20 hover:bg-[#a78bfa] text-[#a78bfa] hover:text-white transition-all border border-[#a78bfa]/30 shrink-0"
                    >
                        <MapIcon size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}
