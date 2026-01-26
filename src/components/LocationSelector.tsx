
import React from 'react';
import { clsx } from 'clsx';
import { ChevronDown, MapPin, Check } from 'lucide-react';
import { REGIONS } from '@/lib/constants';

interface LocationSelectorProps {
    selectedRegion: string;
    onRegionSelect: (region: string) => void;
    selectedDistrict: string;
    onDistrictSelect: (district: string) => void;
    selectedVenue: string;
    onVenueSelect: (venue: string) => void;
    districts: string[];
    availableVenues: string[];
    isMobile?: boolean; // To adjust layout if needed
}

export function LocationSelector({
    selectedRegion,
    onRegionSelect,
    selectedDistrict,
    onDistrictSelect,
    selectedVenue,
    onVenueSelect,
    districts,
    availableVenues,
    isMobile = false
}: LocationSelectorProps) {

    // UI Constants
    const baseButtonClass = "rounded-xl px-4 py-2.5 text-sm font-medium transition-all border flex items-center justify-center gap-2";
    const activeClass = "bg-purple-600 text-white border-purple-500 shadow-md font-bold light:bg-purple-100 light:text-purple-700 light:border-purple-200";
    const inactiveClass = "bg-gray-800/50 light:bg-white text-gray-400 light:text-gray-600 border-white/5 light:border-gray-200 hover:bg-gray-800 light:hover:bg-gray-50";

    return (
        <div className="flex flex-col gap-6 w-full">

            {/* 1. Region Selection (Grid) */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-500 light:text-gray-400 ml-1 block uppercase tracking-wider flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> 지역 (시/도)
                    </label>
                </div>

                <div className="flex flex-wrap gap-2">
                    {/* 'All' Button */}
                    <button
                        onClick={() => {
                            onRegionSelect('all');
                        }}
                        className={clsx(
                            baseButtonClass,
                            selectedRegion === 'all' ? activeClass : inactiveClass
                        )}
                    >
                        전국
                    </button>

                    {REGIONS.filter(r => r.id !== 'all').map(r => (
                        <button
                            key={r.id}
                            onClick={() => onRegionSelect(r.id)}
                            className={clsx(
                                baseButtonClass,
                                selectedRegion === r.id ? activeClass : inactiveClass
                            )}
                        >
                            {r.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 2. District Selection (Conditional) */}
            {(selectedRegion !== 'all' && districts.length > 0) && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="text-xs font-bold text-gray-500 light:text-gray-400 ml-1 block uppercase tracking-wider">
                        상세 지역 (구/군)
                    </label>
                    <div className="bg-gray-900/30 light:bg-gray-50 p-4 rounded-2xl border border-white/5 light:border-gray-200">
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => onDistrictSelect('all')}
                                className={clsx(
                                    "px-3 py-2 rounded-lg text-xs font-medium border transition-all",
                                    selectedDistrict === 'all'
                                        ? "bg-purple-500/20 text-purple-300 light:text-purple-700 light:bg-purple-100 border-purple-500/50 light:border-purple-200 font-bold"
                                        : "bg-gray-800 light:bg-white text-gray-400 light:text-gray-500 border-gray-700 light:border-gray-200 hover:bg-gray-700 light:hover:bg-gray-100"
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
                                            ? "bg-white text-black border-white font-bold light:bg-purple-600 light:text-white light:border-purple-600 shadow-sm"
                                            : "bg-gray-800 light:bg-white text-gray-400 light:text-gray-500 border-gray-700 light:border-gray-200 hover:bg-gray-700 light:hover:bg-gray-100"
                                    )}
                                >
                                    {d}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 3. Venue Selection (Conditional) */}
            {(availableVenues.length > 0) && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-400 delay-75">
                    <label className="text-xs font-bold text-gray-500 light:text-gray-400 ml-1 block uppercase tracking-wider">
                        공연장 선택 <span className="text-purple-400 ml-1">({availableVenues.length})</span>
                    </label>

                    <div className="relative">
                        <select
                            value={selectedVenue}
                            onChange={(e) => onVenueSelect(e.target.value)}
                            className="w-full bg-gray-900/80 light:bg-white border border-white/10 light:border-gray-300 rounded-xl py-3.5 px-4 text-white light:text-black appearance-none cursor-pointer focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all text-sm font-medium shadow-sm hover:border-purple-500/30"
                        >
                            <option value="all">전체 공연장 보기</option>
                            {availableVenues.map(v => (
                                <option key={v} value={v}>{v}</option>
                            ))}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
