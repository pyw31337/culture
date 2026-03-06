import React from 'react';
import { MapPin, Search, RotateCcw, ChevronDown } from 'lucide-react';
import { GENRES, RADIUS_OPTIONS } from '@/lib/constants';
import { getGenreIcon } from '@/components/GenreIcons';

interface ResultsHeaderProps {
    viewMode: string;
    activeLocation: any;
    searchLocation: any;
    searchText: string;
    searchMode: string;
    selectedGenre: string;
    filteredCount: number;
    radius: number;
    onResetFilters: () => void;
    onRadiusChange: (val: number) => void;
}

export const ResultsHeader = ({
    viewMode,
    activeLocation,
    searchLocation,
    searchText,
    searchMode,
    selectedGenre,
    filteredCount,
    radius,
    onResetFilters,
    onRadiusChange
}: ResultsHeaderProps) => {
    if (viewMode === 'likes-perf') return null;

    return (
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 mt-8 gap-2">
            <div className="w-full sm:w-auto">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h2 className="text-xl sm:text-2xl font-black text-gray-200 light:text-black flex items-center gap-2">
                        {activeLocation ? (
                            <>
                                <MapPin className="text-emerald-500 w-5 h-5" />
                                <span className="truncate max-w-[150px] sm:max-w-xs">{searchLocation ? `'${searchLocation.name}'` : '내 위치'}</span>
                                <span className="text-base sm:text-xl shrink-0">위치 주변 ({filteredCount})</span>
                                <button
                                    onClick={onResetFilters}
                                    className="ml-2 p-1.5 rounded-full bg-white/10 hover:bg-white/20 light:bg-black/5 light:hover:bg-black/10 text-gray-400 hover:text-white light:text-gray-600 light:hover:text-black transition-all border border-white/5 hover:border-white/20 light:border-black/5 light:hover:border-black/10 group/reload"
                                    title="지역 설정 초기화"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                </button>
                            </>
                        ) : searchText ? (
                            <>
                                {searchMode === 'location' ? (
                                    <MapPin className="text-emerald-500 w-5 h-5" />
                                ) : (
                                    <Search className="text-purple-500 w-5 h-5" />
                                )}
                                <span className="truncate max-w-[120px] sm:max-w-xs">'{searchText}'</span>
                                <span className="text-base sm:text-xl shrink-0">
                                    {searchMode === 'location' ? '위치 주변' : '키워드 검색'} ({filteredCount})
                                </span>
                            </>
                        ) : (
                            <>
                                <span className="flex items-center gap-2">
                                    {getGenreIcon(selectedGenre, 28)}
                                    {selectedGenre === 'all' ? '전체 컨텐츠 목록' : `${GENRES.find(g => g.id === selectedGenre)?.label || '컨텐츠'} 목록`}
                                </span>
                                <span className="text-base sm:text-xl text-gray-400 font-medium ml-2">({filteredCount})</span>
                            </>
                        )}
                    </h2>
                    {activeLocation && (
                        <div className="flex items-center gap-2 ml-auto">
                            <div className="flex items-center bg-gray-800/50 light:bg-white border border-emerald-500/50 light:border-emerald-400 rounded-full pl-3 pr-1 py-1 group hover:border-emerald-400 transition-all shadow-sm">
                                <div className="relative flex items-center pl-1">
                                    <select
                                        value={radius}
                                        onChange={(e) => onRadiusChange(Number(e.target.value))}
                                        className="bg-transparent text-xs sm:text-sm font-bold text-emerald-500 light:text-emerald-700 focus:outline-none appearance-none pr-6 cursor-pointer py-1.5"
                                    >
                                        {RADIUS_OPTIONS.map(r => (
                                            <option key={r.value} value={r.value} className="bg-gray-800 light:bg-white text-gray-300 light:text-black">
                                                {r.label}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-0 w-3.5 h-3.5 text-emerald-500 pointer-events-none mr-1" />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
export default ResultsHeader;
