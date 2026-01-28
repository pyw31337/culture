
import React, { useState, useMemo, useRef, useEffect } from 'react'; // Added hooks
import { clsx } from 'clsx';
import { ChevronDown, MapPin, Check, Search, X, GripHorizontal } from 'lucide-react'; // Added icons
import { REGIONS } from '@/lib/constants';
import { getChoseong } from '@/lib/hangul';
import { motion } from 'framer-motion';

import venuesData from '@/data/venues.json'; // Direct import for lookup

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
    dropUp = false,
    inline = false
}: LocationSelectorProps) {

    // --- Horizontal Scroll Sub-component ---
    const HorizontalScroll = ({ children, className }: { children: React.ReactNode, className?: string }) => {
        const containerRef = useRef<HTMLDivElement>(null);
        const contentRef = useRef<HTMLDivElement>(null);
        const [constraints, setConstraints] = useState({ left: 0, right: 0 });

        const updateConstraints = () => {
            if (containerRef.current && contentRef.current) {
                const containerWidth = containerRef.current.offsetWidth;
                const contentWidth = contentRef.current.scrollWidth;
                setConstraints({ left: Math.min(0, containerWidth - contentWidth - 16), right: 0 });
            }
        };

        useEffect(() => {
            updateConstraints();
            window.addEventListener('resize', updateConstraints);
            return () => window.removeEventListener('resize', updateConstraints);
        }, [children]);

        return (
            <div ref={containerRef} className={clsx("overflow-hidden cursor-grab active:cursor-grabbing relative", className)}>
                <motion.div
                    ref={contentRef}
                    drag="x"
                    dragConstraints={constraints}
                    dragElastic={0.4}
                    className="flex gap-2 min-w-max pb-2 pt-0.5"
                >
                    {children}
                </motion.div>
                {/* Visual indicator for overflow */}
                <div className="absolute right-0 top-0 bottom-2 w-12 bg-gradient-to-l from-gray-900/40 light:from-white/40 to-transparent pointer-events-none" />
            </div>
        );
    };

    // UI Constants
    const baseButtonClass = "rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold transition-all border flex items-center justify-center gap-1.5 whitespace-nowrap"; // Reduced padding/text size slightly
    const activeClass = "bg-purple-600 text-white border-purple-500 shadow-md font-extrabold light:bg-purple-100 light:text-purple-700 light:border-purple-200";
    const inactiveClass = "bg-gray-800/50 light:bg-white text-gray-400 light:text-gray-600 border-white/5 light:border-gray-200 hover:bg-gray-800 light:hover:bg-gray-50";

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
        // For inline, we might not want to close it immediately, or maybe we do?
        // Usually selection closes the dropdown.
        setIsVenueOpen(false);
    };

    return (
        <div className="flex flex-col gap-5 w-full">

            {/* 1. Region Selection (Grid) */}
            <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-extrabold text-gray-500 light:text-gray-400 ml-1 block uppercase tracking-wider flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> 지역 (시/도)
                    </label>
                </div>

                {/* Horizontal Drag Area */}
                <HorizontalScroll>
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
                </HorizontalScroll>
            </div>

            {/* 2. District Selection (Conditional) */}
            {(selectedRegion !== 'all' && districts.length > 0) && (
                <div className="space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="text-xs font-extrabold text-gray-500 light:text-gray-400 ml-1 block uppercase tracking-wider">
                        상세 지역 (구/군)
                    </label>
                    <div className="bg-gray-900/30 light:bg-gray-50 p-2 sm:p-3 rounded-2xl border border-white/5 light:border-gray-200">
                        <HorizontalScroll>
                            <button
                                onClick={() => onDistrictSelect('all')}
                                className={clsx(
                                    "px-4 py-2 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap",
                                    selectedDistrict === 'all'
                                        ? "bg-purple-500/20 text-purple-300 light:text-purple-700 light:bg-purple-100 border-purple-500/50 light:border-purple-200 font-extrabold"
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
                                        "px-4 py-2 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap",
                                        selectedDistrict === d
                                            ? "bg-white text-black border-white font-extrabold light:bg-purple-600 light:text-white light:border-purple-600 shadow-sm"
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

            {/* 3. Venue Selection (Custom Dropdown with Search/Filter) */}
            {(availableVenues.length > 0) && (
                <div className={clsx("space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-400 delay-75", !inline && "z-20")}> {/* z-index for dropdown */}
                    <label className="text-xs font-extrabold text-gray-500 light:text-gray-400 ml-1 block uppercase tracking-wider">
                        공연장 선택 <span className="text-purple-400 ml-1">({availableVenues.length})</span>
                    </label>

                    <div className="relative" ref={venueDropdownRef}>
                        {/* Trigger Button */}
                        <button
                            onClick={() => setIsVenueOpen(!isVenueOpen)}
                            className={clsx(
                                "w-full text-left bg-gray-900/80 light:bg-white border rounded-xl py-3.5 px-4 text-sm font-semibold shadow-sm flex items-center justify-between transition-all",
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
                                                    ? "bg-purple-600 text-white font-extrabold shadow-purple-500/30"
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
                                                        ? "bg-purple-600 text-white font-extrabold shadow-purple-500/30"
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
                                                ? "bg-purple-500/10 text-purple-400 font-extrabold"
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
                                                        ? "bg-purple-500/10 text-purple-400 font-extrabold"
                                                        : "text-gray-300 light:text-gray-700 hover:bg-white/5 light:hover:bg-gray-100"
                                                )}
                                            >
                                                {/* Left: Name */}
                                                <span className="truncate mr-2">{v}</span>

                                                {/* Right: Location & Check */}
                                                <div className="flex items-center gap-2 shrink-0">
                                                    {/* Location Tag (Full Region + District) */}
                                                    {(venues[v]?.mapped_region_id || venues[v]?.district) && (
                                                        <span className="text-[10px] sm:text-xs text-gray-400 light:text-gray-500 border border-white/5 light:border-gray-200 px-2 py-0.5 rounded bg-black/40 light:bg-gray-100 italic">
                                                            {[REGIONS.find(r => r.id === venues[v].mapped_region_id)?.label, venues[v].district].filter(Boolean).join(' ')}
                                                        </span>
                                                    )}
                                                    {selectedVenue === v && <Check className="w-3.5 h-3.5 text-purple-500" />}
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
