'use client';

import { clsx } from 'clsx';
import { Calendar, Tag, X } from 'lucide-react';
import { DATE_FILTERS, PRICE_FILTERS, type DateFilterId, type PriceFilterId } from '@/lib/constants';

interface FilterChipBarProps {
    selectedDate: DateFilterId | null;
    onDateChange: (next: DateFilterId | null) => void;
    selectedPrice: PriceFilterId | null;
    onPriceChange: (next: PriceFilterId | null) => void;
    /**
     * Total result count after all filters have been applied - shown next to
     * the bar so the user can see how aggressive their current chip selection
     * is. Hidden when there's nothing meaningful to show.
     */
    filteredCount?: number;
}

/**
 * Quick filter chips that sit above the results grid. Each chip toggles on /
 * off - clicking an active chip clears it. Designed to be additive with the
 * existing genre / region selectors above (handled by other components).
 *
 * The bar is mounted in PerformanceList right after ResultsHeader.
 */
export default function FilterChipBar({
    selectedDate,
    onDateChange,
    selectedPrice,
    onPriceChange,
    filteredCount,
}: FilterChipBarProps) {
    const hasActive = selectedDate !== null || selectedPrice !== null;

    return (
        <div className="mt-3 mb-4 -mx-1">
            <div className="flex flex-wrap items-center gap-2 px-1">
                {/* Date chips */}
                <div className="inline-flex items-center gap-1.5 mr-2">
                    <Calendar className="w-3.5 h-3.5 text-gray-400 light:text-gray-500" aria-hidden="true" />
                    <span className="text-[11px] font-bold text-gray-400 light:text-gray-500">언제</span>
                </div>
                {DATE_FILTERS.map((opt) => {
                    const active = selectedDate === opt.id;
                    return (
                        <button
                            key={opt.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => onDateChange(active ? null : opt.id)}
                            className={clsx(
                                'inline-flex items-center px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors border',
                                active
                                    ? 'bg-purple-500 text-white border-purple-400 shadow shadow-purple-500/20'
                                    : 'bg-white/5 text-gray-200 border-white/10 hover:bg-white/10 light:bg-gray-100 light:text-gray-700 light:border-gray-200 light:hover:bg-gray-200'
                            )}
                        >
                            {opt.label}
                        </button>
                    );
                })}

                {/* Separator */}
                <span className="hidden sm:inline-block w-px h-5 bg-white/10 light:bg-gray-200 mx-1" aria-hidden="true" />

                {/* Price chips */}
                <div className="inline-flex items-center gap-1.5 mr-2 mt-2 sm:mt-0">
                    <Tag className="w-3.5 h-3.5 text-gray-400 light:text-gray-500" aria-hidden="true" />
                    <span className="text-[11px] font-bold text-gray-400 light:text-gray-500">가격</span>
                </div>
                {PRICE_FILTERS.map((opt) => {
                    const active = selectedPrice === opt.id;
                    return (
                        <button
                            key={opt.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => onPriceChange(active ? null : opt.id)}
                            className={clsx(
                                'inline-flex items-center px-3 py-1.5 rounded-full text-[12px] font-bold transition-colors border',
                                active
                                    ? 'bg-emerald-500 text-white border-emerald-400 shadow shadow-emerald-500/20'
                                    : 'bg-white/5 text-gray-200 border-white/10 hover:bg-white/10 light:bg-gray-100 light:text-gray-700 light:border-gray-200 light:hover:bg-gray-200'
                            )}
                        >
                            {opt.label}
                        </button>
                    );
                })}

                {/* Clear-all + active count summary */}
                {hasActive && (
                    <button
                        type="button"
                        onClick={() => {
                            onDateChange(null);
                            onPriceChange(null);
                        }}
                        className="ml-auto inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold text-gray-300 hover:text-white light:text-gray-500 light:hover:text-gray-900 transition-colors"
                    >
                        <X className="w-3.5 h-3.5" />
                        필터 초기화
                        {typeof filteredCount === 'number' && (
                            <span className="ml-1 opacity-70">· {filteredCount.toLocaleString('ko-KR')}건</span>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
}
