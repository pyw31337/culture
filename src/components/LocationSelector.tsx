
import React, { useState, useMemo, useRef, useEffect } from 'react'; // Added hooks
import { clsx } from 'clsx';
import { ChevronDown, MapPin, Check, Search, X, GripHorizontal, ChevronUp } from 'lucide-react'; // Added icons
import { REGIONS } from '@/lib/constants';
import { getChoseong } from '@/lib/hangul';
import { motion } from 'framer-motion';

import { getDistanceFromLatLonInKm } from '@/lib/utils';

// --- Stadium Icon Component ---
const StadiumIcon = ({ className, strokeWidth = 2.5 }: { className?: string, strokeWidth?: number }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={clsx("icon icon-tabler icons-tabler-outline icon-tabler-building-stadium", className)}
    >
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M4 12a8 2 0 1 0 16 0a8 2 0 1 0 -16 0" />
        <path d="M4 12v7c0 .94 2.51 1.785 6 2v-3h4v3c3.435 -.225 6 -1.07 6 -2v-7" />
        <path d="M15 6h4v-3h-4v7" />
        <path d="M7 6h4v-3h-4v7" />
    </svg>
);

import venuesData from '@/data/venue-dictionary.json'; // Direct import for lookup

// Type assertion for venues data since it's a JSON file
const venues = venuesData as Record<string, any>;

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
    inline?: boolean;
    searchMode?: 'keyword' | 'location';
    referenceLocation?: { lat: number, lng: number } | null;
}

const CHOSEONG_LIST = [
    'ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'
];

import { HorizontalScroll } from '@/components/ui/HorizontalScroll';

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
    dropUp = false,
    inline = false,
    searchMode = 'keyword',
    referenceLocation
}: LocationSelectorProps) {

    // UI Constants
    const baseButtonClass = "rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold transition-all border flex items-center justify-center gap-1.5 whitespace-nowrap"; // Reduced padding/text size slightly

    // Dynamic Colors based on Search Mode
    const isLoc = searchMode === 'location';

    const activeClass = isLoc
        ? "bg-emerald-600 text-white border-emerald-500 shadow-md font-extrabold light:bg-emerald-100 light:text-emerald-700 light:border-emerald-200"
        : "bg-purple-600 text-white border-purple-500 shadow-md font-extrabold light:bg-purple-100 light:text-purple-700 light:border-purple-200";

    const inactiveClass = "bg-gray-800/50 light:bg-white text-gray-400 light:text-gray-600 border-white/5 light:border-gray-200 hover:bg-gray-800 light:hover:bg-gray-50";

    const accentTextClass = isLoc ? "text-emerald-400" : "text-purple-400";
    const accentBorderClass = isLoc ? "border-emerald-500" : "border-purple-500";
    const accentBgClass = isLoc ? "bg-emerald-600" : "bg-purple-600";
    const accentLightTextClass = isLoc ? "light:text-emerald-600" : "light:text-purple-600";

    // Venue Selector State
    const [isVenueOpen, setIsVenueOpen] = useState(false);
    const [activeChoseong, setActiveChoseong] = useState<string>('all');
    const venueDropdownRef = useRef<HTMLDivElement>(null);

    // Close venue dropdown when clicking outside (only if NOT inline)
    useEffect(() => {
        if (inline) return; // Don't auto-close inline as it's part of the flow
        function handleClickOutside(event: MouseEvent) {
            if (venueDropdownRef.current && !venueDropdownRef.current.contains(event.target as Node)) {
                setIsVenueOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [inline]);

    // Venue Filtering Logic
    const filteredVenues = useMemo(() => {
        let sorted = [...availableVenues];

        // 1. Sort Logic
        if (searchMode === 'location' && referenceLocation) {
            // Sort by Distance
            sorted.sort((a, b) => {
                const va = venues[a];
                const vb = venues[b];
                const da = (va?.lat && va?.lng) ? getDistanceFromLatLonInKm(referenceLocation.lat, referenceLocation.lng, va.lat, va.lng) : 99999;
                const db = (vb?.lat && vb?.lng) ? getDistanceFromLatLonInKm(referenceLocation.lat, referenceLocation.lng, vb.lat, vb.lng) : 99999;
                return da - db;
            });
        } else {
            // Sort by English (A-Z) then Korean (ㄱ-ㅎ)
            sorted.sort((a, b) => {
                const nameA = venues[a]?.refined_name || venues[a]?.name || a;
                const nameB = venues[b]?.refined_name || venues[b]?.name || b;

                const isEnglishA = /^[A-Za-z]/.test(nameA);
                const isEnglishB = /^[A-Za-z]/.test(nameB);

                if (isEnglishA && !isEnglishB) return -1;
                if (!isEnglishA && isEnglishB) return 1;

                return nameA.localeCompare(nameB);
            });
        }

        // 2. Filter by Choseong
        if (activeChoseong === 'all') return sorted;

        return sorted.filter(v => {
            const name = venues[v]?.refined_name || venues[v]?.name || v;

            // Handle English filter
            if (/[A-Z]/.test(activeChoseong)) {
                return name.toUpperCase().startsWith(activeChoseong);
            }

            // Handle Korean Choseong
            const cho = getChoseong(name);
            return cho.startsWith(activeChoseong);
        });
    }, [availableVenues, activeChoseong, searchMode, referenceLocation]);

    // Accordion State
    const [isRegionExpanded, setIsRegionExpanded] = useState(true);

    const handleRegionSelectInternal = (region: string) => {
        onRegionSelect(region);
        // setIsRegionExpanded(false); // Removed auto-collapse: User wants it to stay open for District selection
    };

    const handleDistrictSelectInternal = (district: string) => {
        onDistrictSelect(district);
        setIsRegionExpanded(false); // Auto-collapse on district selection
    };

    const handleVenueClick = (venue: string) => {
        onVenueSelect(venue);
        setIsVenueOpen(false);
    };

    const selectedRegionLabel = useMemo(() => {
        if (selectedRegion === 'all') return '전국';
        return REGIONS.find(r => r.id === selectedRegion)?.label || '';
    }, [selectedRegion]);

    return (
        <div className="flex flex-col gap-5 w-full">

            {/* 1. Region & District Area (Accordion) */}
            <div className="space-y-2.5">
                {/* Accordion Header / Summary View */}
                <div
                    className="flex items-center justify-between cursor-pointer group hover:bg-white/5 p-1 rounded-lg transition-colors"
                    onClick={() => setIsRegionExpanded(!isRegionExpanded)}
                >
                    {/* Fixed width container for icon to align text perfectly */}
                    <div className="flex items-center gap-2">
                        <div className="w-5 flex justify-center">
                            <MapPin className={clsx("w-4 h-4", accentTextClass)} strokeWidth={2.5} />
                        </div>
                        <label className="text-xs font-extrabold text-gray-500 light:text-gray-400 uppercase tracking-wider cursor-pointer">
                            지역 설정
                        </label>
                    </div>

                    <div className="flex items-center gap-2">
                        {!isRegionExpanded && (
                            <div className={clsx(
                                "flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-extrabold animate-in fade-in zoom-in-95 duration-300",
                                isLoc
                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                    : "bg-purple-500/10 border-purple-500/20 text-purple-400"
                            )}>
                                <span>{selectedRegionLabel}</span>
                                {selectedDistrict !== 'all' && (
                                    <>
                                        <span className="opacity-40 text-[9px]">•</span>
                                        <span>{selectedDistrict}</span>
                                    </>
                                )}
                            </div>
                        )}
                        {isRegionExpanded ? (
                            <ChevronUp className={clsx("w-4 h-4 text-gray-500 transition-colors", isLoc ? "group-hover:text-emerald-400" : "group-hover:text-purple-400")} />
                        ) : (
                            <ChevronDown className={clsx("w-4 h-4 text-gray-500 transition-colors", isLoc ? "group-hover:text-emerald-400" : "group-hover:text-purple-400")} />
                        )}
                    </div>
                </div>

                {/* Collapsible Content */}
                {isRegionExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-0 overflow-visible" // Changed space-y-4 to 0 for tight tab connection
                    >
                        {/* Region Buttons */}
                        <div className="relative z-20 pb-0"> {/* z-index to sit on top of district box */}
                            <HorizontalScroll className="px-1 pb-0">
                                <button
                                    onClick={() => handleRegionSelectInternal('all')}
                                    className={clsx(
                                        baseButtonClass,
                                        selectedRegion === 'all'
                                            ? activeClass
                                            : inactiveClass
                                    )}
                                >
                                    전국
                                </button>

                                {REGIONS.filter(r => r.id !== 'all').map(r => (
                                    <button
                                        key={r.id}
                                        onClick={() => handleRegionSelectInternal(r.id)}
                                        className={clsx(
                                            "relative rounded-t-xl px-4 py-2.5 text-xs sm:text-sm font-semibold transition-all border flex items-center justify-center whitespace-nowrap",
                                            // Tab logic: If active, connect to bottom with negative margin and z-index
                                            selectedRegion === r.id
                                                ? clsx(
                                                    accentTextClass, accentLightTextClass,
                                                    "bg-gray-900/50 light:bg-gray-50 border-b-0 -mb-px z-30 font-extrabold shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]",
                                                    isLoc
                                                        ? "border-emerald-500/60 light:border-emerald-600/30 border-t border-l border-r" // Green mode active border
                                                        : "border-purple-400/60 light:border-purple-600/30 border-t border-l border-r"   // Purple mode active border
                                                )
                                                : "rounded-b-xl bg-gray-800/30 light:bg-white text-gray-400 light:text-gray-600 border-white/5 light:border-gray-200 hover:bg-gray-800 light:hover:bg-gray-50 mb-1" // Add margin bottom for inactive to separate from line
                                        )}
                                    >
                                        {r.label}
                                        {/* Visual connector for tab style (hiding the bottom border line of the container if any, though negative margin handles overlap) */}
                                        {selectedRegion === r.id && (
                                            <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-gray-900/50 light:bg-gray-50 z-40" />
                                        )}
                                    </button>
                                ))}
                            </HorizontalScroll>
                        </div>

                        {/* District Selection (Box) */}
                        {(selectedRegion !== 'all' && districts.length > 0) && (
                            <div className="relative pt-0 animate-in fade-in slide-in-from-top-1 duration-200 z-10 -mt-px">
                                {/* The Box */}
                                <div className={clsx(
                                    "bg-gray-900/50 light:bg-gray-50 p-3 pt-2 rounded-b-2xl rounded-tr-2xl rounded-tl-2xl border shadow-inner",
                                    isLoc
                                        ? "border-emerald-500/60 light:border-emerald-600/30"
                                        : "border-purple-400/60 light:border-purple-600/30"
                                )}>
                                    <HorizontalScroll>
                                        <button
                                            onClick={() => handleDistrictSelectInternal('all')}
                                            className={clsx(
                                                "px-4 py-2 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap",
                                                selectedDistrict === 'all'
                                                    ? (isLoc
                                                        ? "bg-emerald-500/20 text-emerald-300 light:text-emerald-700 light:bg-emerald-100 border-emerald-500/50 light:border-emerald-200 font-extrabold"
                                                        : "bg-purple-500/20 text-purple-300 light:text-purple-700 light:bg-purple-100 border-purple-500/50 light:border-purple-200 font-extrabold")
                                                    : "bg-gray-800 light:bg-white text-gray-400 light:text-gray-500 border-gray-700 light:border-gray-200 hover:bg-gray-700 light:hover:bg-gray-100"
                                            )}
                                        >
                                            전체
                                        </button>
                                        {districts.map(d => (
                                            <button
                                                key={d}
                                                onClick={() => handleDistrictSelectInternal(d)}
                                                className={clsx(
                                                    "px-4 py-2 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap",
                                                    selectedDistrict === d
                                                        ? (isLoc
                                                            ? "bg-white text-black border-white font-extrabold light:bg-emerald-600 light:text-white light:border-emerald-600 shadow-sm"
                                                            : "bg-white text-black border-white font-extrabold light:bg-purple-600 light:text-white light:border-purple-600 shadow-sm")
                                                        : "bg-gray-800 light:bg-white text-gray-400 light:text-gray-500 border-gray-700 light:border-gray-200 hover:bg-gray-700 light:hover:bg-gray-100"
                                                )}
                                            >
                                                {d}
                                            </button>
                                        ))}
                                    </HorizontalScroll>
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </div>

            {/* 2. Venue Selection (Custom Dropdown with Search/Filter) */}
            {(availableVenues.length > 0) && (
                <div className={clsx("space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-400 delay-75", !inline && "z-20")}> {/* z-index for dropdown */}
                    {/* Header with Alignment */}
                    <div className="flex items-center gap-2 pl-1 mb-2">
                        <div className="w-5 flex justify-center">
                            <StadiumIcon className={clsx("w-3.5 h-3.5", accentTextClass)} />
                        </div>
                        <label className="text-xs font-extrabold text-gray-500 light:text-gray-400 uppercase tracking-wider">
                            공연장 선택 <span className={clsx("ml-1", accentTextClass)}>({availableVenues.length})</span>
                        </label>
                    </div>

                    <div className="relative" ref={venueDropdownRef}>
                        {/* Trigger Button */}
                        <button
                            onClick={() => setIsVenueOpen(!isVenueOpen)}
                            className={clsx(
                                "w-full text-left bg-gray-900/80 light:bg-white border rounded-xl py-3.5 px-4 text-sm font-semibold shadow-sm flex items-center justify-between transition-all",
                                isVenueOpen
                                    ? clsx("ring-1 text-white light:text-black", accentBorderClass, isLoc ? "ring-emerald-500/30" : "ring-purple-500/30")
                                    : clsx("border-white/10 light:border-gray-300 text-white light:text-black", isLoc ? "hover:border-emerald-500/30" : "hover:border-purple-500/30")
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
                            <div className={clsx(
                                "bg-gray-900 light:bg-white border border-white/10 light:border-gray-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200",
                                // Fix overlap: Restricted height and bottom padding/margin logic
                                inline ? "mt-2 relative w-full" : (dropUp ? "absolute bottom-[115%] mb-2 left-0 w-full max-h-[400px]" : "absolute top-full mt-2 left-0 w-full max-h-[400px]")
                            )}>

                                {/* Choseong Filter Header */}
                                <div className="p-2 border-b border-white/5 light:border-gray-100 bg-gray-800/50 light:bg-gray-50">
                                    <HorizontalScroll>
                                        <button
                                            onClick={() => setActiveChoseong('all')}
                                            className={clsx(
                                                "w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg text-xs sm:text-sm transition-all shadow-sm",
                                                activeChoseong === 'all'
                                                    ? clsx(accentBgClass, "text-white font-extrabold", isLoc ? "shadow-emerald-500/30" : "shadow-purple-500/30")
                                                    : "text-gray-400 light:text-gray-600 bg-gray-700/50 light:bg-white border border-transparent light:border-gray-200 hover:bg-white/10 light:hover:bg-gray-100"
                                            )}
                                        >
                                            전체
                                        </button>
                                        {CHOSEONG_LIST.map(cho => (
                                            <button
                                                key={cho}
                                                onClick={() => setActiveChoseong(cho)}
                                                className={clsx(
                                                    "w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-lg text-xs sm:text-sm transition-all shadow-sm",
                                                    activeChoseong === cho
                                                        ? clsx(accentBgClass, "text-white font-extrabold", isLoc ? "shadow-emerald-500/30" : "shadow-purple-500/30")
                                                        : "text-gray-400 light:text-gray-600 bg-gray-700/50 light:bg-white border border-transparent light:border-gray-200 hover:bg-white/10 light:hover:bg-gray-100"
                                                )}
                                            >
                                                {cho}
                                            </button>
                                        ))}
                                    </HorizontalScroll>
                                </div>

                                {/* Venue List with Scrollbar */}
                                <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-1"> {/* Increased from 200px */}
                                    <button
                                        onClick={() => handleVenueClick('all')}
                                        className={clsx(
                                            "w-full text-left px-3 py-2.5 text-sm rounded-lg transition-colors flex items-center justify-between group",
                                            selectedVenue === 'all'
                                                ? (isLoc ? "bg-emerald-500/10 text-emerald-400 font-extrabold" : "bg-purple-500/10 text-purple-400 font-extrabold")
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
                                                    "w-full text-left px-3 py-3 text-sm rounded-lg transition-colors flex items-center justify-between group border-b border-white/5 light:border-gray-50 last:border-0",
                                                    selectedVenue === v
                                                        ? (isLoc ? "bg-emerald-500/10 text-emerald-400 font-extrabold" : "bg-purple-500/10 text-purple-400 font-extrabold")
                                                        : "text-gray-300 light:text-gray-700 hover:bg-white/5 light:hover:bg-gray-100"
                                                )}
                                            >
                                                {/* Left: Name */}
                                                <span className="truncate mr-2">
                                                    {venues[v]?.refined_name || venues[v]?.name || v}
                                                </span>

                                                {/* Right: Location & Check */}
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {/* Location Tag (Full Region + District) */}
                                                    {(venues[v]?.mapped_region_id || venues[v]?.district) && (
                                                        <span className="text-[10px] sm:text-xs text-gray-400 light:text-gray-500 border border-white/5 light:border-gray-200 px-2 py-0.5 rounded bg-black/40 light:bg-gray-100 italic">
                                                            {[REGIONS.find(r => r.id === venues[v].mapped_region_id)?.label, venues[v].district].filter(Boolean).join(' ')}
                                                        </span>
                                                    )}
                                                    {selectedVenue === v && <Check className={clsx("w-3.5 h-3.5", isLoc ? "text-emerald-500" : "text-purple-500")} />}
                                                </div>
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
