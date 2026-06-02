import React from 'react';
import { MapPin, Search, RotateCcw, ChevronDown } from 'lucide-react';
import { GENRES, RADIUS_OPTIONS } from '@/lib/constants';
import { getGenreIcon } from '@/components/GenreIcons';
import type { DataQualitySummary, DataSourceHealthSummary } from '@/lib/build-info';
import ServiceStatusStrip from './ServiceStatusStrip';
import FilterChipBar from './FilterChipBar';
import type { DiscoveryContextDefinition } from '@/lib/discovery';
import type { DiscoveryContextId } from '@/types';
import type { DateFilterId, PriceFilterId } from '@/lib/constants';
import { getRegionSelectionLabel } from '@/lib/region-selection';

interface HeaderLocation {
    lat?: number;
    lng?: number;
    name?: string;
}

const DATE_FILTER_LABELS: Record<string, string> = {
    today: '오늘',
    weekend: '이번 주말',
    'this-week': '이번 주',
    'next-week': '다음 주',
};

const PRICE_FILTER_LABELS: Record<string, string> = {
    free: '무료',
    'under-10k': '1만원 이하',
    'under-50k': '5만원 이하',
    'under-100k': '10만원 이하',
};

interface ResultsHeaderProps {
    viewMode: string;
    activeLocation: HeaderLocation | null;
    searchLocation: HeaderLocation | null;
    searchText: string;
    searchMode: string;
    selectedGenre: string;
    selectedRegion?: string;
    selectedDistrict?: string;
    selectedVenue?: string;
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
    selectedDateFilter?: DateFilterId | null;
    onDateFilterChange?: (next: DateFilterId | null) => void;
    selectedPriceTier?: PriceFilterId | null;
    onPriceTierChange?: (next: PriceFilterId | null) => void;
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
    selectedRegion = 'all',
    selectedDistrict = 'all',
    selectedVenue = 'all',
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
    selectedDateFilter,
    onDateFilterChange,
    selectedPriceTier,
    onPriceTierChange,
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
    const shouldShowUnifiedFilters =
        shouldShowDiscoveryContexts &&
        Boolean(onDateFilterChange) &&
        Boolean(onPriceTierChange);
    const activeDiscoveryLabel = discoveryContexts?.find((item) => item.id === activeDiscoveryContext)?.label || '';
    const activeDateLabel = DATE_FILTER_LABELS[selectedDateFilter || ''] || '';
    const activePriceLabel = PRICE_FILTER_LABELS[selectedPriceTier || ''] || '';
    const isRegionFiltered = selectedRegion !== 'all' || selectedDistrict !== 'all' || selectedVenue !== 'all';
    const hasQuickFilter = activeDiscoveryContext !== 'all' || Boolean(selectedDateFilter) || Boolean(selectedPriceTier);
    const hasAnyListFilter = isRegionFiltered || hasQuickFilter || Boolean(searchText) || isLocationSearch;
    const regionFilterLabel = selectedVenue !== 'all' ? selectedVenue : getRegionSelectionLabel(selectedRegion, selectedDistrict);
    const filterTitleLabel = [
        isRegionFiltered ? regionFilterLabel : '',
        activeDiscoveryLabel,
        activeDateLabel,
        activePriceLabel,
    ].filter(Boolean).join(' · ');
    const listTitle =
        selectedGenre === 'all'
            ? (hasAnyListFilter && !searchText && !isLocationSearch ? '필터 적용 콘텐츠 목록' : '전체 컨텐츠 목록')
            : `${GENRES.find(g => g.id === selectedGenre)?.label || '컨텐츠'} 목록`;
    const allResetButton = hasAnyListFilter && !isLocationSearch ? (
        <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white/95 px-3.5 py-1.5 text-[11px] font-extrabold text-slate-700 shadow-sm transition hover:border-emerald-400 hover:text-emerald-700 dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:border-emerald-300/50"
            title="지역, 검색어, 날짜, 가격, 상황 필터를 모두 초기화하고 전체 목록으로 돌아갑니다"
        >
            <RotateCcw className="h-3.5 w-3.5" />
            전체 보기
        </button>
    ) : null;
    const locationResetButton = isLocationSearch ? (
        <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/60 bg-white/90 px-3.5 py-2 text-xs sm:text-sm font-extrabold text-emerald-700 shadow-sm transition-all whitespace-nowrap hover:border-emerald-500 hover:bg-emerald-50 dark:bg-slate-900/70 dark:text-emerald-100 dark:hover:bg-emerald-500/15"
            title="위치 검색을 초기화합니다"
        >
            <RotateCcw className="h-3.5 w-3.5" />
            위치 초기화
        </button>
    ) : null;
    const locationControls = isLocationSearch ? (
        <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
            <div className="inline-flex items-center rounded-full border border-emerald-500 bg-emerald-500 px-3.5 py-2 text-white shadow-sm transition-all hover:border-emerald-600 hover:bg-emerald-600 dark:border-emerald-400 dark:bg-emerald-400 dark:text-slate-950 dark:hover:bg-emerald-300">
                <div className="relative flex items-center">
                    <select
                        value={radius}
                        onChange={(e) => onRadiusChange(Number(e.target.value))}
                        className="cursor-pointer appearance-none bg-transparent py-0.5 pr-6 text-xs font-extrabold text-white focus:outline-none sm:text-sm dark:text-slate-950"
                        title="검색 반경을 변경합니다"
                    >
                        {RADIUS_OPTIONS.map(r => (
                            <option key={r.value} value={r.value} className="bg-white text-slate-900">
                                {r.label}
                            </option>
                        ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-0 mr-0.5 h-3.5 w-3.5 text-white dark:text-slate-950" />
                </div>
            </div>
            {locationResetButton}
        </div>
    ) : null;

    return (
        <div className="mb-6 mt-8">
            <div className="flex flex-col gap-3">
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
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
                                                {listTitle}
                                            </span>
                                            <span className="text-base sm:text-xl text-gray-400 font-medium ml-2">({filteredCount})</span>
                                        </>
                                    )}
                                </h2>
                                {filterTitleLabel && (
                                    <span className="max-w-full truncate rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">
                                        {filterTitleLabel}
                                    </span>
                                )}
                                <ServiceStatusStrip
                                    lastUpdated={lastUpdated}
                                    totalItemCount={totalItemCount}
                                    availableGenreCount={availableGenreCount}
                                    qualitySummary={qualitySummary}
                                    sourceHealthSummary={sourceHealthSummary}
                                    className="shrink-0"
                                />
                            </div>
                            {shouldShowUnifiedFilters && activeDiscoveryContext && onDiscoveryContextChange && onDateFilterChange && onPriceTierChange && (
                                <div className="flex w-full min-w-0 items-center justify-start gap-2 xl:ml-auto xl:w-auto xl:justify-end">
                                    {allResetButton}
                                    <FilterChipBar
                                        activeDiscoveryContext={activeDiscoveryContext}
                                        onDiscoveryContextChange={onDiscoveryContextChange}
                                        selectedDate={selectedDateFilter ?? null}
                                        onDateChange={onDateFilterChange}
                                        selectedPrice={selectedPriceTier ?? null}
                                        onPriceChange={onPriceTierChange}
                                        className="min-w-0 flex-1 xl:flex-none"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="shrink-0 sm:ml-auto">
                        {locationControls}
                    </div>
                </div>
            </div>
        </div>
    );
};
export default ResultsHeader;
