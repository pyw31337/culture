'use client';

import { clsx } from 'clsx';
import type { DiscoveryContextId } from '@/types';
import { DATE_FILTERS, PRICE_FILTERS, type DateFilterId, type PriceFilterId } from '@/lib/constants';

interface FilterChipBarProps {
    activeDiscoveryContext: DiscoveryContextId;
    onDiscoveryContextChange: (next: DiscoveryContextId) => void;
    selectedDate: DateFilterId | null;
    onDateChange: (next: DateFilterId | null) => void;
    selectedPrice: PriceFilterId | null;
    onPriceChange: (next: PriceFilterId | null) => void;
    className?: string;
}

type UnifiedFilterChip =
    | { kind: 'all'; id: 'all'; label: string }
    | { kind: 'date'; id: DateFilterId; label: string }
    | { kind: 'context'; id: DiscoveryContextId; label: string }
    | { kind: 'price'; id: PriceFilterId; label: string };

const contextChips: UnifiedFilterChip[] = [
    { kind: 'context', id: 'indoor', label: '실내' },
    { kind: 'context', id: 'with_kids', label: '아이와' },
    { kind: 'context', id: 'date_night', label: '데이트' },
];

const endingSoonChip: UnifiedFilterChip = { kind: 'context', id: 'ending_soon', label: '곧 종료' };

const unifiedChips: UnifiedFilterChip[] = [
    { kind: 'all', id: 'all', label: '전체' },
    ...DATE_FILTERS.map((filter) => ({ kind: 'date' as const, id: filter.id, label: filter.label })),
    ...contextChips,
    ...PRICE_FILTERS.filter((filter) => filter.id !== 'under-100k').map((filter) => ({
        kind: 'price' as const,
        id: filter.id,
        label: filter.label,
    })),
    endingSoonChip,
];

export default function FilterChipBar({
    activeDiscoveryContext,
    onDiscoveryContextChange,
    selectedDate,
    onDateChange,
    selectedPrice,
    onPriceChange,
    className,
}: FilterChipBarProps) {
    const clearAll = () => {
        onDiscoveryContextChange('all');
        onDateChange(null);
        onPriceChange(null);
    };

    const handleChipClick = (chip: UnifiedFilterChip) => {
        if (chip.kind === 'all') {
            clearAll();
            return;
        }

        if (chip.kind === 'date') {
            onDiscoveryContextChange('all');
            onPriceChange(null);
            onDateChange(selectedDate === chip.id ? null : chip.id);
            return;
        }

        if (chip.kind === 'price') {
            onDiscoveryContextChange('all');
            onDateChange(null);
            onPriceChange(selectedPrice === chip.id ? null : chip.id);
            return;
        }

        onDateChange(null);
        onPriceChange(null);
        onDiscoveryContextChange(activeDiscoveryContext === chip.id ? 'all' : chip.id);
    };

    const isChipActive = (chip: UnifiedFilterChip) => {
        if (chip.kind === 'all') {
            return activeDiscoveryContext === 'all' && selectedDate === null && selectedPrice === null;
        }
        if (chip.kind === 'date') return selectedDate === chip.id;
        if (chip.kind === 'price') return selectedPrice === chip.id;
        return activeDiscoveryContext === chip.id;
    };

    return (
        <div
            className={clsx(
                'flex max-w-full flex-nowrap items-center gap-2 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden',
                className
            )}
        >
            {unifiedChips.map((chip) => {
                const active = isChipActive(chip);
                return (
                    <button
                        key={`${chip.kind}-${chip.id}`}
                        type="button"
                        aria-pressed={active}
                        onClick={() => handleChipClick(chip)}
                        className={clsx(
                            'inline-flex shrink-0 items-center rounded-full border px-3.5 py-1.5 text-[11px] font-extrabold transition sm:text-xs',
                            active
                                ? 'border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-900/10 dark:border-white dark:bg-white dark:text-slate-950'
                                : 'border-slate-200 bg-white/90 text-slate-600 hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:bg-white/7 dark:text-slate-200 dark:hover:border-sky-300/40 dark:hover:text-white'
                        )}
                    >
                        {chip.label}
                    </button>
                );
            })}
        </div>
    );
}
