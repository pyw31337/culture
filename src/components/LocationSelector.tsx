
import React, { useState, useMemo, useRef, useEffect } from 'react'; // Added hooks
import { clsx } from 'clsx';
import { ChevronDown, MapPin, Check, Search, X } from 'lucide-react'; // Added icons
import { REGIONS } from '@/lib/constants';
import { getChoseong } from '@/lib/hangul'; // Import Choseong utility

interface LocationSelectorProps {
    selectedRegion: string;
    onRegionSelect: (region: string) => void;
    selectedDistrict: string;
    onDistrictSelect: (district: string) => void;
    selectedVenue: string;
    onVenueSelect: (venue: string) => void;
    districts: string[];
    availableVenues: string[];
    isMobile?: boolean;
    dropUp?: boolean;
}

const CHOSEONG_LIST = ['ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

export function LocationSelector({
    selectedRegion,
    onRegionSelect,
    selectedDistrict,
    onDistrictSelect,
    selectedVenue,
    onVenueSelect,
    districts,
    availableVenues,
    isMobile = false,
    dropUp = false
}: LocationSelectorProps) {

    // UI Constants
    const baseButtonClass = "rounded-xl px-3 py-2 text-xs sm:text-sm font-medium transition-all border flex items-center justify-center gap-1.5 whitespace-nowrap"; // Reduced padding/text size slightly
    const activeClass = "bg-purple-600 text-white border-purple-500 shadow-md font-bold light:bg-purple-100 light:text-purple-700 light:border-purple-200";
    const inactiveClass = "bg-gray-800/50 light:bg-white text-gray-400 light:text-gray-600 border-white/5 light:border-gray-200 hover:bg-gray-800 light:hover:bg-gray-50";

    // Venue Selector State
    const [isVenueOpen, setIsVenueOpen] = useState(false);
    const [activeChoseong, setActiveChoseong] = useState<string>('all');
    const venueDropdownRef = useRef<HTMLDivElement>(null);

    // Close venue dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (venueDropdownRef.current && !venueDropdownRef.current.contains(event.target as Node)) {
                setIsVenueOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Venue Filtering Logic
    const filteredVenues = useMemo(() => {
        if (activeChoseong === 'all') return availableVenues;
        return availableVenues.filter(v => {
            const cho = getChoseong(v);
            // Check if the FIRST char's choseong matches, OR if the venue starts with the choseong char directly (rare)
            // User likely wants to filter by first letter.
            return cho.startsWith(activeChoseong);
        });
    }, [availableVenues, activeChoseong]);

    const handleVenueClick = (venue: string) => {
        onVenueSelect(venue);
        setIsVenueOpen(false);
    };

    return (
        <div className="flex flex-col gap-5 w-full">

            {/* 1. Region Selection (Grid) */}
            <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-500 light:text-gray-400 ml-1 block uppercase tracking-wider flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> 지역 (시/도)
                    </label>
                </div>

                {/* Modified container: Reduced gap to fit items better */}
                <div className="flex flex-wrap gap-1.5 sm:gap-2">
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
                <div className="space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="text-xs font-bold text-gray-500 light:text-gray-400 ml-1 block uppercase tracking-wider">
                        상세 지역 (구/군)
                    </label>
                    <div className="bg-gray-900/30 light:bg-gray-50 p-3 sm:p-4 rounded-2xl border border-white/5 light:border-gray-200">
                        <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            <button
                                onClick={() => onDistrictSelect('all')}
                                className={clsx(
                                    "px-3 py-1.5 sm:py-2 rounded-lg text-xs font-medium border transition-all",
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
                                        "px-3 py-1.5 sm:py-2 rounded-lg text-xs font-medium border transition-all",
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

            {/* 3. Venue Selection (Custom Dropdown with Search/Filter) */}
            {(availableVenues.length > 0) && (
                <div className="space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-400 delay-75 z-20"> {/* z-index for dropdown */}
                    <label className="text-xs font-bold text-gray-500 light:text-gray-400 ml-1 block uppercase tracking-wider">
                        공연장 선택 <span className="text-purple-400 ml-1">({availableVenues.length})</span>
                    </label>

                    <div className="relative" ref={venueDropdownRef}>
                        {/* Trigger Button */}
                        <button
                            onClick={() => setIsVenueOpen(!isVenueOpen)}
                            className={clsx(
                                "w-full text-left bg-gray-900/80 light:bg-white border rounded-xl py-3.5 px-4 text-sm font-medium shadow-sm flex items-center justify-between transition-all",
                                isVenueOpen
                                    ? "border-purple-500 ring-1 ring-purple-500/30 text-white light:text-black"
                                    : "border-white/10 light:border-gray-300 text-white light:text-black hover:border-purple-500/30"
                            )}
                        >
                            <span className="truncate">
                                {selectedVenue === 'all'
                                    ? '전체 공연장 보기'
                                    : selectedVenue}
                            </span>
                            <ChevronDown className={clsx("w-4 h-4 text-gray-400 transition-transform", isVenueOpen && "rotate-180")} />
                        </button>

                        {/* Dropdown Panel */}
                        {isVenueOpen && (
                            <div className="absolute top-full left-0 w-full mt-2 bg-gray-900 light:bg-white border border-white/10 light:border-gray-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

                                {/* Choseong Filter Header */}
                                <div className="p-2 border-b border-white/5 light:border-gray-100 bg-gray-800/50 light:bg-gray-50">
                                    <div className="flex flex-wrap gap-1 justify-center">
                                        <button
                                            onClick={() => setActiveChoseong('all')}
                                            className={clsx(
                                                "px-2 py-1 text-[10px] rounded hover:bg-purple-500/20 transition-colors",
                                                activeChoseong === 'all'
                                                    ? "bg-purple-600 text-white font-bold"
                                                    : "text-gray-400 light:text-gray-600 bg-gray-700/50 light:bg-white border border-transparent light:border-gray-200"
                                            )}
                                        >
                                            전체
                                        </button>
                                        {CHOSEONG_LIST.map(cho => (
                                            <button
                                                key={cho}
                                                onClick={() => setActiveChoseong(cho)}
                                                className={clsx(
                                                    "w-6 h-6 flex items-center justify-center text-[10px] rounded hover:bg-purple-500/20 transition-colors",
                                                    activeChoseong === cho
                                                        ? "bg-purple-600 text-white font-bold"
                                                        : "text-gray-400 light:text-gray-600 bg-gray-700/50 light:bg-white border border-transparent light:border-gray-200"
                                                )}
                                            >
                                                {cho}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Venue List with Scrollbar */}
                                <div className="max-h-[280px] overflow-y-auto custom-scrollbar p-1">
                                    <button
                                        onClick={() => handleVenueClick('all')}
                                        className={clsx(
                                            "w-full text-left px-3 py-2.5 text-sm rounded-lg transition-colors flex items-center justify-between group",
                                            selectedVenue === 'all'
                                                ? "bg-purple-500/10 text-purple-400 font-bold"
                                                : "text-gray-300 light:text-gray-700 hover:bg-white/5 light:hover:bg-gray-100"
                                        )}
                                    >
                                        <span>전체 공연장</span>
                                        {selectedVenue === 'all' && <Check className="w-3.5 h-3.5" />}
                                    </button>

                                    {filteredVenues.length === 0 ? (
                                        <div className="py-8 text-center text-xs text-gray-500">
                                            해당 초성의 공연장이 없습니다.
                                        </div>
                                    ) : (
                                        filteredVenues.map(v => (
                                            <button
                                                key={v}
                                                onClick={() => handleVenueClick(v)}
                                                className={clsx(
                                                    "w-full text-left px-3 py-2.5 text-sm rounded-lg transition-colors flex items-center justify-between group",
                                                    selectedVenue === v
                                                        ? "bg-purple-500/10 text-purple-400 font-bold"
                                                        : "text-gray-300 light:text-gray-700 hover:bg-white/5 light:hover:bg-gray-100"
                                                )}
                                            >
                                                <span>{v}</span>
                                                {selectedVenue === v && <Check className="w-3.5 h-3.5" />}
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
