
import React from 'react';
import { clsx } from 'clsx';
import PerformanceCard from './PerformanceCard';
import PerformanceListItem from './PerformanceListItem';
import { getDistanceFromLatLonInKm } from '@/lib/utils';

interface PerformanceGridProps {
    items: any[];
    layoutMode: 'grid' | 'list';
    selectedVenue: string;
    activeLocation: any;
    venues: any;
    likedIds: string[];
    onToggleLike: (id: string, e: any) => void;
    handleDetailOpen: (perf: any) => void;
    setSearchLocation: (loc: any) => void;
    setIsMapOpen: (val: boolean) => void;
    copyItemShareUrl: (id: string) => Promise<boolean>;
    // Infinite Scroll
    hasMore: boolean;
    observerRef: React.Ref<HTMLDivElement>;
    // For Logic
    selectedGenre: string;
    viewMode: string;
    searchMode?: 'keyword' | 'location';
}

export default function PerformanceGrid({
    items,
    layoutMode,
    selectedVenue,
    activeLocation,
    venues,
    likedIds,
    onToggleLike,
    handleDetailOpen,
    setSearchLocation,
    setIsMapOpen,
    copyItemShareUrl,
    hasMore,
    observerRef,
    selectedGenre,
    viewMode,
    searchMode = 'keyword'
}: PerformanceGridProps) {

    return (
        <div
            className={clsx(
                "w-full",
                layoutMode === 'grid'
                    ? "grid grid-cols-1 min-[310px]:grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-6"
                    : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6"
            )}
        >
            {items.map((perf, index) => {
                // Venue Info
                const venueInfo = venues[perf.venue];

                const dist = activeLocation && venueInfo?.lat && venueInfo?.lng
                    ? getDistanceFromLatLonInKm(activeLocation.lat, activeLocation.lng, venueInfo.lat, venueInfo.lng)
                    : null;
                const distLabel = dist !== null ? `${dist.toFixed(1)}km` : null;

                const isNearbyHeader = (selectedVenue !== 'all' && perf.venue !== selectedVenue && (index === 0 || items[index - 1].venue === selectedVenue));

                return (
                    <div
                        key={`${perf.id}-${perf.region}`}
                        className={clsx(layoutMode === 'grid' ? "h-full w-full" : "w-full", isNearbyHeader ? "col-span-full pt-8" : "")}
                    >
                        {/* Split List Header */}
                        {isNearbyHeader && (
                            <div className="w-full h-px relative bg-gradient-to-r from-transparent via-[#a78bfa]/50 to-transparent mb-8 flex items-center justify-center">
                                <span className="bg-[#0f1115] px-4 text-[#a78bfa] text-sm font-extrabold tracking-widest uppercase">
                                    Nearby Recommendations
                                </span>
                            </div>
                        )}
                        {layoutMode === 'grid' ? (
                            <PerformanceCard
                                perf={perf}
                                distLabel={distLabel}
                                venueInfo={venueInfo}
                                onLocationClick={(loc) => {
                                    setSearchLocation(loc);
                                    setIsMapOpen(true);
                                }}
                                isLiked={likedIds.includes(perf.id)}
                                onToggleLike={(e) => onToggleLike(perf.id, e)}
                                // Logic Update: 
                                // - Ribbon: pass false
                                // - Gradient: KEEP for general recommended lists? (Logic copied from PerformanceList)
                                showRibbon={false}
                                isGradient={selectedGenre === 'all' && !activeLocation && viewMode !== 'likes-perf' && viewMode !== 'likes-venue'}
                                enableActions={true}
                                onShare={() => copyItemShareUrl(perf.id)}
                                onDetail={() => handleDetailOpen(perf)}
                                searchMode={searchMode}
                            />
                        ) : (
                            <PerformanceListItem
                                perf={perf}
                                distLabel={distLabel}
                                venueInfo={venueInfo}
                                onLocationClick={(loc) => {
                                    setSearchLocation(loc);
                                    setIsMapOpen(true);
                                }}
                                isLiked={likedIds.includes(perf.id)}
                                onToggleLike={(e) => onToggleLike(perf.id, e)}
                                onShare={() => copyItemShareUrl(perf.id)}
                                onDetail={() => handleDetailOpen(perf)}
                                searchMode={searchMode}
                            />
                        )}
                    </div>
                );
            })}

            {/* Sentinel for Infinite Scroll */}
            {hasMore && (
                <div ref={observerRef} className="col-span-full h-20 flex items-center justify-center opacity-50">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                </div>
            )}
        </div>
    );
}
