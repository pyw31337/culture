
import React from 'react';
import { Filter } from 'lucide-react';
import { clsx } from 'clsx';
import { GENRES, REGIONS } from '@/lib/constants';
import { getGenreIcon } from '@/components/GenreIcons';
import { useTranslations } from 'next-intl';

// Reusable Dropdown Component
interface FilterDropdownProps {
    label: string;
    value: string;
    options: { id: string; label: string }[];
    onChange: (val: string) => void;
    icon?: React.ReactNode;
    color?: string; // e.g. "purple", "emerald"
    isOpen?: boolean;
    onToggle?: () => void;
}

const FilterDropdown = ({ label, value, options, onChange, icon, color = "purple", isOpen, onToggle }: FilterDropdownProps) => {
    return (
        <div className="relative group">
            <button
                className={clsx(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border",
                    value !== 'all'
                        ? `bg-${color}-500 text-white border-${color}-500 shadow-lg shadow-${color}-500/20`
                        : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500 hover:text-gray-200 light:bg-white light:text-gray-600 light:border-gray-200 light:shadow-sm"
                )}
                onClick={onToggle} // Now controlled externally if needed, or we can make it internal state? 
            // Actually for simplicity, standard dropdowns usually just use internal state or simple hover.
            // But for mobile, click is better.
            >
                {icon}
                <span>
                    {value === 'all' ? label : options.find(o => o.id === value)?.label || label}
                </span>
            </button>
            {/* Dropdown Menu - Simple Hover/Focus Implementation for Desktop, Click for Mobile if needed */}
            <div className="absolute top-full left-0 mt-2 w-32 bg-gray-900 light:bg-white border border-gray-800 light:border-gray-200 rounded-xl shadow-xl overflow-hidden z-50 hidden group-hover:block transition-all">
                <div className="max-h-[200px] overflow-y-auto custom-scrollbar p-1">
                    <button
                        onClick={() => onChange('all')}
                        className={clsx(
                            "w-full text-left px-3 py-2 text-xs rounded-lg transition-colors",
                            value === 'all'
                                ? `bg-${color}-500/10 text-${color}-500 font-bold`
                                : "text-gray-400 light:text-gray-600 hover:bg-gray-800 light:hover:bg-gray-100"
                        )}
                    >
                        {label}
                    </button>
                    {options.map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => onChange(opt.id)}
                            className={clsx(
                                "w-full text-left px-3 py-2 text-xs rounded-lg transition-colors truncate",
                                value === opt.id
                                    ? `bg-${color}-500/10 text-${color}-500 font-bold`
                                    : "text-gray-400 light:text-gray-600 hover:bg-gray-800 light:hover:bg-gray-100"
                            )}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};


interface FilterBarProps {
    isSticky: boolean;
    selectedGenre: string;
    onGenreChange: (genre: string) => void;
    selectedRegion: string;
    onRegionChange: (region: string) => void;
    totalCount: number;
    isLoading?: boolean;
}

export default function FilterBar({
    isSticky,
    selectedGenre,
    onGenreChange,
    selectedRegion,
    onRegionChange,
    totalCount,
    isLoading
}: FilterBarProps) {
    const td = useTranslations('Data');
    const tc = useTranslations('Categories');
    const tr = useTranslations('Regions');
    const ta = useTranslations('Actions');

    // Sort Genres for Dropdown (Same as PerformanceList logic?)
    // Usually standard GENRES list.

    return (
        <div className={clsx(
            "flex items-center justify-between gap-4 transition-all duration-300",
            isSticky ? "h-10" : "h-12"
        )}>
            {/* Left: Filters */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pr-4">
                {/* 1. Genre Filter */}
                <div className="relative group shrink-0">
                    <button className={clsx(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                        selectedGenre !== 'all'
                            ? "bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-500/20"
                            : "bg-gray-800/80 text-gray-300 border-white/10 hover:bg-gray-700 light:bg-white light:text-gray-700 light:border-gray-200 light:shadow-sm"
                    )}>
                        {getGenreIcon(selectedGenre, 14)}
                        <span>{selectedGenre === 'all' ? td('all_genres') : (tc.has(selectedGenre) ? tc(selectedGenre) : GENRES.find(g => g.id === selectedGenre)?.label)}</span>
                    </button>
                    {/* Dropdown */}
                    <div className="absolute top-full left-0 mt-2 w-40 bg-gray-900 light:bg-white border border-white/10 light:border-gray-200 rounded-xl shadow-2xl overflow-hidden z-50 hidden group-hover:block">
                        <div className="p-1 max-h-[300px] overflow-y-auto custom-scrollbar">
                            <button onClick={() => onGenreChange('all')} className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-white/5 rounded-lg mb-1">{td('view_all')}</button>
                            {GENRES.map(g => (
                                <button
                                    key={g.id}
                                    onClick={() => onGenreChange(g.id)}
                                    className={clsx(
                                        "w-full flex items-center gap-2 px-3 py-2 text-xs rounded-lg transition-colors",
                                        selectedGenre === g.id
                                            ? "bg-purple-500/20 text-purple-400 font-bold"
                                            : "text-gray-300 hover:bg-white/5 light:text-gray-700 light:hover:bg-gray-100"
                                    )}
                                >
                                    {getGenreIcon(g.id, 14)}
                                    {tc.has(g.id) ? tc(g.id) : g.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 2. Region Filter */}
                <div className="relative group shrink-0">
                    <button className={clsx(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                        selectedRegion !== 'all'
                            ? "bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-500/20"
                            : "bg-gray-800/80 text-gray-300 border-white/10 hover:bg-gray-700 light:bg-white light:text-gray-700 light:border-gray-200 light:shadow-sm"
                    )}>
                        <Filter size={12} />
                        <span>{selectedRegion === 'all' ? td('all_regions') : (tr.has(selectedRegion) ? tr(selectedRegion) : REGIONS.find(r => r.id === selectedRegion)?.label)}</span>
                    </button>
                    {/* Dropdown */}
                    <div className="absolute top-full left-0 mt-2 w-32 bg-gray-900 light:bg-white border border-white/10 light:border-gray-200 rounded-xl shadow-2xl overflow-hidden z-50 hidden group-hover:block">
                        <div className="p-1">
                            <button onClick={() => onRegionChange('all')} className="w-full text-left px-3 py-2 text-xs text-gray-400 hover:bg-white/5 rounded-lg mb-1">{td('all_regions')}</button>
                            {REGIONS.map(r => (
                                <button
                                    key={r.id}
                                    onClick={() => onRegionChange(r.id)}
                                    className={clsx(
                                        "w-full text-left px-3 py-2 text-xs rounded-lg transition-colors",
                                        selectedRegion === r.id
                                            ? "bg-emerald-500/20 text-emerald-400 font-bold"
                                            : "text-gray-300 hover:bg-white/5 light:text-gray-700 light:hover:bg-gray-100"
                                    )}
                                >
                                    {tr.has(r.id) ? tr(r.id) : r.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Right: Count */}
            <div className="shrink-0 text-xs font-bold text-gray-500 light:text-gray-400 flex items-center gap-2">
                {isLoading ? (
                    <span className="animate-pulse">{tc('loading')}</span>
                ) : (
                    <>
                        <span>{td('total_count', { count: totalCount })}</span>
                    </>
                )}
            </div>
        </div>
    );
}
