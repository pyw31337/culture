import React from 'react';
import { MapPin, Search, RotateCcw, ChevronDown } from 'lucide-react';
import { GENRES, RADIUS_OPTIONS } from '@/lib/constants';
import { getGenreIcon } from '@/components/GenreIcons';
import type { DataQualitySummary, DataSourceHealthSummary } from '@/lib/build-info';
import ServiceStatusStrip from './ServiceStatusStrip';
import DiscoveryContextBar from '@/components/performance/DiscoveryContextBar';
import type { DiscoveryContextDefinition } from '@/lib/discovery';
import type { DiscoveryContextId } from '@/types';

interface HeaderLocation {
    lat?: number;
    lng?: number;
    name?: string;
}

interface ResultsHeaderProps {
    viewMode: string;
    activeLocation: HeaderLocation | null;
    searchLocation: HeaderLocation | null;
    searchText: string;
    searchMode: string;
    selectedGenre: string;
    filteredCount: number;
    radius: number;
    lastUpdated: string;
    totalItemCount: number;
    availableGenreCount: number;
    qualitySummary?: DataQualitySummary | null;
    sourceHealthSummary?: DataSourceHealthSummary | null;
    discoveryContexts?: DiscoveryContextDefinition[];
    activeDiscoveryContext?: DiscoveryContextId;
    onDiscoveryContextChange?: (contextId: DiscoveryContextId) => void;
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
    lastUpdated,
    totalItemCount,
    availableGenreCount,
    qualitySummary,
    sourceHealthSummary,
    discoveryContexts,
    activeDiscoveryContext,
    onDiscoveryContextChange,
    onResetFilters,
    onRadiusChange
}: ResultsHeaderProps) => {
    if (viewMode === 'likes-perf') return null;

    const isLocationSearch = searchMode === 'location' && Boolean(activeLocation);
    const shouldShowDiscoveryContexts =
        Boolean(discoveryContexts?.length) &&
        Boolean(activeDiscoveryContext) &&
        Boolean(onDiscoveryContextChange) &&
        !searchText &&
        searchMode !== 'location';

    return (
        <div className="mb-6 mt-8">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between xl:gap-6">
                <div className="w-full min-w-0 xl:flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <h2 className="text-xl sm:text-2xl font-black text-gray-200 light:text-black flex items-center gap-2">
                            {(searchMode === 'location' && activeLocation) ? (
                                <>
                                    <MapPin className="text-emerald-500 w-5 h-5" />
                                    <span className="truncate max-w-[150px] sm:max-w-xs">
                                        {searchLocation?.name ? <>&apos;{searchLocation.name}&apos;</> : '내 위치'}
                                    </span>
                                    <span className="text-base sm:text-xl shrink-0">위치 주변 ({filteredCount})</span>
                                </>
                            ) : searchText ? (
                                <>
                                    {searchMode === 'location' ? (
                                        <MapPin className="text-emerald-500 w-5 h-5" />
                                    ) : (
                                        <Search className="text-purple-500 w-5 h-5" />
                                    )}
                                    <span className="truncate max-w-[120px] sm:max-w-xs">&apos;{searchText}&apos;</span>
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
                        <ServiceStatusStrip
                            lastUpdated={lastUpdated}
                            totalItemCount={totalItemCount}
                            availableGenreCount={availableGenreCount}
                            qualitySummary={qualitySummary}
                            sourceHealthSummary={sourceHealthSummary}
                            className="shrink-0"
                        />
                    </div>

                    {shouldShowDiscoveryContexts && discoveryContexts && activeDiscoveryContext && onDiscoveryContextChange && (
                        <DiscoveryContextBar
                            contexts={discoveryContexts}
                            activeContext={activeDiscoveryContext}
                            onChange={onDiscoveryContextChange}
                            className="mt-3 xl:hidden"
                        />
                    )}
                </div>

                <div className="flex w-full flex-col gap-3 xl:w-auto xl:min-w-fit xl:flex-none xl:items-end">
                    {shouldShowDiscoveryContexts && discoveryContexts && activeDiscoveryContext && onDiscoveryContextChange && (
                        <DiscoveryContextBar
                            contexts={discoveryContexts}
                            activeContext={activeDiscoveryContext}
                            onChange={onDiscoveryContextChange}
                            className="hidden xl:flex"
                        />
                    )}

                    {isLocationSearch && (
                        <div className="flex w-full flex-wrap items-center justify-end gap-2 xl:ml-auto xl:w-auto">
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
                            <button
                                type="button"
                                onClick={onResetFilters}
                                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3.5 py-2 text-xs sm:text-sm font-extrabold text-emerald-200 hover:border-emerald-300/70 hover:bg-emerald-500/20 light:bg-emerald-50 light:text-emerald-700 light:hover:bg-emerald-100 transition-all whitespace-nowrap shadow-sm"
                                title="위치 검색을 초기화합니다"
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                위치 초기화
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
export default ResultsHeader;
