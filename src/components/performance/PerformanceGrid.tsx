
import React from 'react';
import { clsx } from 'clsx';
import { resolveVenueInfoForPerformance } from '@/lib/location-display';
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
    handleDetailPrepare?: () => void;
    setSearchLocation: (loc: any) => void;
    onVenuePreview?: (loc: any) => void; // Optional to separate preview from search
    setIsMapOpen: (val: boolean) => void;
    copyItemShareUrl: (id: string) => Promise<boolean>;
    // Infinite Scroll
    hasMore: boolean;
    observerRef: React.Ref<HTMLDivElement>;
    // For Logic
    selectedGenre: string;
    viewMode: string;
    searchMode?: 'keyword' | 'location';
    searchText?: string;
}

const VIRTUALIZATION_THRESHOLD = 36;
const VIRTUALIZATION_MIN_WIDTH = 768;
const OVERSCAN_ROWS = 4;
const SCROLL_MEASURE_STEP = 420;

function getColumnCount(layoutMode: 'grid' | 'list', width: number): number {
    if (layoutMode === 'grid') {
        if (width >= 1536) return 5;
        if (width >= 1024) return 4;
        if (width >= 768) return 3;
        if (width >= 640) return 2;
        return 1;
    }

    if (width >= 1536) return 4;
    if (width >= 1280) return 3;
    if (width >= 768) return 2;
    return 1;
}

function getGap(width: number): number {
    return width >= 640 ? 24 : 12;
}

function getEstimatedRowHeight(layoutMode: 'grid' | 'list', width: number, columns: number, gap: number): number {
    const safeColumns = Math.max(1, columns);
    const columnWidth = Math.max(220, (width - gap * (safeColumns - 1)) / safeColumns);

    if (layoutMode === 'list') {
        return 230 + gap;
    }

    // Poster cards are portrait-oriented. This estimate keeps scroll height
    // stable without forcing layout reads for every card.
    return Math.max(330, columnWidth * 1.34 + gap);
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
    handleDetailPrepare,
    setSearchLocation,
    onVenuePreview,
    setIsMapOpen,
    copyItemShareUrl,
    hasMore,
    observerRef,
    selectedGenre,
    viewMode,
    searchMode = 'keyword',
    searchText
}: PerformanceGridProps) {
    const likedIdSet = React.useMemo(() => new Set(likedIds), [likedIds]);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const lastViewportRef = React.useRef({
        scrollY: 0,
        height: 900,
        width: 0,
        top: 0,
    });
    const [viewport, setViewport] = React.useState({
        scrollY: 0,
        height: 900,
        width: 0,
        top: 0,
    });
    const [canVirtualize, setCanVirtualize] = React.useState(false);

    React.useEffect(() => {
        if (typeof window === 'undefined') return;

        let frame = 0;
        const shouldTrackScroll = canVirtualize && items.length > VIRTUALIZATION_THRESHOLD;
        const measure = () => {
            frame = 0;
            const node = containerRef.current;
            const rect = node?.getBoundingClientRect();
            const width = node?.clientWidth || window.innerWidth || 0;
            const isTouchViewport = window.matchMedia?.('(hover: none), (pointer: coarse)').matches ?? false;
            const nextViewport = {
                scrollY: window.scrollY || window.pageYOffset || 0,
                height: window.innerHeight || 900,
                width,
                top: (rect?.top || 0) + (window.scrollY || window.pageYOffset || 0),
            };
            setCanVirtualize(width >= VIRTUALIZATION_MIN_WIDTH && !isTouchViewport);
            const previous = lastViewportRef.current;
            const layoutChanged =
                Math.abs(nextViewport.width - previous.width) > 2 ||
                Math.abs(nextViewport.height - previous.height) > 2 ||
                Math.abs(nextViewport.top - previous.top) > 2;
            const scrolledEnough = Math.abs(nextViewport.scrollY - previous.scrollY) >= SCROLL_MEASURE_STEP;

            if (layoutChanged || scrolledEnough || previous.width === 0 || !shouldTrackScroll) {
                lastViewportRef.current = nextViewport;
                setViewport(nextViewport);
            }
        };

        const requestMeasure = () => {
            if (frame) return;
            frame = window.requestAnimationFrame(measure);
        };

        measure();
        if (shouldTrackScroll) {
            window.addEventListener('scroll', requestMeasure, { passive: true });
        }
        window.addEventListener('resize', requestMeasure, { passive: true });

        let resizeObserver: ResizeObserver | null = null;
        if ('ResizeObserver' in window && containerRef.current) {
            resizeObserver = new ResizeObserver(requestMeasure);
            resizeObserver.observe(containerRef.current);
        }

        return () => {
            if (frame) window.cancelAnimationFrame(frame);
            if (shouldTrackScroll) {
                window.removeEventListener('scroll', requestMeasure);
            }
            window.removeEventListener('resize', requestMeasure);
            resizeObserver?.disconnect();
        };
    }, [canVirtualize, items.length]);

    const virtualization = React.useMemo(() => {
        const width = viewport.width;
        const columns = getColumnCount(layoutMode, width);
        const gap = getGap(width);
        const rowHeight = getEstimatedRowHeight(layoutMode, width, columns, gap);
        const rowCount = Math.ceil(items.length / columns);
        const shouldVirtualize = canVirtualize && width >= VIRTUALIZATION_MIN_WIDTH && items.length > VIRTUALIZATION_THRESHOLD;

        if (!shouldVirtualize) {
            return {
                shouldVirtualize,
                startIndex: 0,
                endIndex: items.length,
                topSpacer: 0,
                bottomSpacer: 0,
            };
        }

        const relativeTop = Math.max(0, viewport.scrollY - viewport.top);
        const startRow = Math.max(0, Math.floor(relativeTop / rowHeight) - OVERSCAN_ROWS);
        const visibleRows = Math.ceil(viewport.height / rowHeight) + OVERSCAN_ROWS * 2;
        const endRow = Math.min(rowCount, startRow + visibleRows);
        const startIndex = Math.min(items.length, startRow * columns);
        const endIndex = Math.min(items.length, endRow * columns);
        const topSpacer = Math.max(0, startRow * rowHeight);
        const bottomSpacer = Math.max(0, (rowCount - endRow) * rowHeight);

        return {
            shouldVirtualize,
            startIndex,
            endIndex,
            topSpacer,
            bottomSpacer,
        };
    }, [canVirtualize, items.length, layoutMode, viewport.height, viewport.scrollY, viewport.top, viewport.width]);

    const renderedItems = virtualization.shouldVirtualize
        ? items.slice(virtualization.startIndex, virtualization.endIndex)
        : items;

    return (
        <div
            ref={containerRef}
            className={clsx(
                "w-full overflow-visible",
                layoutMode === 'grid'
                    ? "grid grid-cols-1 min-[310px]:grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-6"
                    : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6"
            )}
        >
            {virtualization.shouldVirtualize && virtualization.topSpacer > 0 && (
                <div aria-hidden="true" className="col-span-full" style={{ height: virtualization.topSpacer }} />
            )}

            {renderedItems.map((perf, visibleIndex) => {
                const index = virtualization.shouldVirtualize
                    ? virtualization.startIndex + visibleIndex
                    : visibleIndex;
                // Venue Info
                const venueInfo = resolveVenueInfoForPerformance(perf, venues);

                // Nearby Check
                // If selectedVenue is active, and this perf's venue DOES NOT match, it's a recommendation.
                const isNearby = selectedVenue !== 'all' && perf.venue !== selectedVenue;

                // Distance calculation is still needed here for display, but let's ensure it's not thrashing.
                // We'll pass the derived labels down to memoized children.
                const dist = activeLocation && venueInfo?.lat && venueInfo?.lng
                    ? getDistanceFromLatLonInKm(activeLocation.lat, activeLocation.lng, venueInfo.lat, venueInfo.lng)
                    : null;
                const distLabel = dist !== null ? `${dist.toFixed(1)}km` : null;
                const handleLocationClick = (loc: any) => {
                    const lat = Number(loc?.lat ?? venueInfo?.lat);
                    const lng = Number(loc?.lng ?? venueInfo?.lng);
                    const resolvedVenueName = (venueInfo as { name?: string; refined_name?: string } | null | undefined)?.name
                        || (venueInfo as { name?: string; refined_name?: string } | null | undefined)?.refined_name;

                    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                        return;
                    }

                    const nextLocation = {
                        ...loc,
                        lat,
                        lng,
                        name: loc?.name || resolvedVenueName || perf.venue,
                    };

                    setSearchLocation(nextLocation);
                    if (onVenuePreview) {
                        onVenuePreview(nextLocation);
                    } else {
                        setIsMapOpen(true);
                    }
                };

                return (
                    <div
                        key={`${perf.id}-${perf.region}`}
                        className={clsx(layoutMode === 'grid' ? "h-full w-full overflow-visible" : "w-full overflow-visible")}
                    >
                        {layoutMode === 'grid' ? (
                            <PerformanceCard
                                perf={perf}
                                priority={index < 5}
                                distLabel={distLabel}
                                venueInfo={venueInfo}
                                onLocationClick={handleLocationClick}
                                isLiked={likedIdSet.has(perf.id)}
                                onToggleLike={onToggleLike}
                                // Show ribbon for Nearby items
                                showRibbon={isNearby}
                                ribbonText="Nearby"
                                isGradient={isNearby || (selectedGenre === 'all' && !activeLocation && viewMode !== 'likes-perf' && viewMode !== 'likes-venue')}
                                enableActions={true}
                                enableEffects={false}
                                onShare={copyItemShareUrl}
                                onDetail={handleDetailOpen}
                                onDetailPrepare={handleDetailPrepare}
                                searchMode={searchMode}
                                searchText={searchText}
                            />
                        ) : (
                            <PerformanceListItem
                                perf={perf}
                                priority={index < 4}
                                distLabel={distLabel}
                                venueInfo={venueInfo}
                                onLocationClick={handleLocationClick}
                                isLiked={likedIdSet.has(perf.id)}
                                onToggleLike={onToggleLike}
                                onShare={copyItemShareUrl}
                                onDetail={handleDetailOpen}
                                onDetailPrepare={handleDetailPrepare}
                                searchMode={searchMode}
                                searchText={searchText}
                            />
                        )}
                    </div>
                );
            })}

            {virtualization.shouldVirtualize && virtualization.bottomSpacer > 0 && (
                <div aria-hidden="true" className="col-span-full" style={{ height: virtualization.bottomSpacer }} />
            )}

            {/* Sentinel for Infinite Scroll */}
            {hasMore && (
                <div
                    ref={observerRef}
                    className="col-span-full h-20 flex items-center justify-center opacity-50"
                    style={{ minHeight: 80 }}
                >
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                </div>
            )}
        </div>
    );
}
