'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { clsx } from 'clsx';
import { Performance } from '@/types';
import { X, Heart, MapPin } from 'lucide-react';
import BuildingStadium from './BuildingStadium';
import venueData from '@/data/venues.json';
import { GENRES, GENRE_STYLES } from '@/lib/constants';
import { getOptimizedUrl, getDistanceFromLatLonInKm } from '@/lib/utils';

import Portal from './ui/Portal';

// import BottomNavSheet from './BottomNavSheet'; // Reverted usage for detail view


interface Venue {
    name: string;
    address: string;
    lat?: number;
    lng?: number;
    district?: string;
}
const venues = venueData as Record<string, Venue>;

interface KakaoMapModalProps {
    performances: Performance[];
    onClose: () => void;
    centerLocation?: { lat: number; lng: number; name: string } | null;
    favoriteVenues: string[];
    onToggleFavorite: (venueName: string) => void;
    onVenueLocationChange?: (venueName: string, lat: number, lng: number) => void;
}

export default function KakaoMapModal({ performances, onClose, centerLocation, favoriteVenues, onToggleFavorite, onVenueLocationChange }: KakaoMapModalProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const [mapInstance, setMapInstance] = useState<any>(null);
    const [selectedVenue, setSelectedVenue] = useState<string | null>(null);
    const overlaysRef = useRef<Record<string, any>>({});

    // Optimization States
    const [visibleVenues, setVisibleVenues] = useState<any[]>([]);
    const [showSearchHereBtn, setShowSearchHereBtn] = useState(false);
    const [isMapReady, setIsMapReady] = useState(false);

    // Group performances by venue - Pre-calculation
    const allVenueGroups = useRef<Record<string, any>>({});
    // Sorted list of all venues for initial calculation
    const allVenuesList = useRef<any[]>([]);

    // Drag to scroll logic (Horizontal List)
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    const onMouseDown = (e: React.MouseEvent) => {
        if (!scrollRef.current) return;
        setIsDragging(true);
        setStartX(e.pageX - scrollRef.current.offsetLeft);
        setScrollLeft(scrollRef.current.scrollLeft);
    };

    const onMouseLeave = () => setIsDragging(false);
    const onMouseUp = () => setIsDragging(false);
    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollRef.current.offsetLeft;
        const walk = (x - startX) * 2;
        scrollRef.current.scrollLeft = scrollLeft - walk;
    };

    // Initialize Data
    useEffect(() => {
        const groups = performances.reduce((acc, perf) => {
            if (!acc[perf.venue]) {
                acc[perf.venue] = {
                    ...venues[perf.venue],
                    venueName: perf.venue,
                    performances: [],
                    lat: venues[perf.venue]?.lat || 0,
                    lng: venues[perf.venue]?.lng || 0
                };
            }
            acc[perf.venue].performances.push(perf);
            return acc;
        }, {} as Record<string, any>);

        allVenueGroups.current = groups;
        const list = Object.values(groups).filter(v => v.lat && v.lng); // Filter invalid venues

        // Sort by distance if center exists
        if (centerLocation) {
            list.sort((a, b) => {
                if (a.venueName === centerLocation.name) return -1;
                if (b.venueName === centerLocation.name) return 1;
                const distA = getDistanceFromLatLonInKm(centerLocation.lat, centerLocation.lng, a.lat, a.lng);
                const distB = getDistanceFromLatLonInKm(centerLocation.lat, centerLocation.lng, b.lat, b.lng);
                return distA - distB;
            });
        }
        allVenuesList.current = list;

        // Initial visible set (take top 20 or all if small)
        // If centerLocation exists, we probably want to see that.
        // We will update visibleVenues correctly once map loads and boundaries are known.
        // For now, init with sorted list.
        setVisibleVenues(list.slice(0, 20));
    }, [performances, centerLocation]);

    // Map Initialization
    useEffect(() => {
        const initializeMap = () => {
            if (!window.kakao || !window.kakao.maps) return;

            window.kakao.maps.load(() => {
                if (!mapRef.current) return;

                const defaultCenter = new window.kakao.maps.LatLng(37.554648, 126.972559);
                const options = {
                    center: centerLocation
                        ? new window.kakao.maps.LatLng(centerLocation.lat, centerLocation.lng)
                        : defaultCenter,
                    level: centerLocation ? 2 : 6 // Zoom in: 4->2, 8->6
                };

                mapRef.current.innerHTML = '';
                const map = new window.kakao.maps.Map(mapRef.current, options);
                setMapInstance(map);

                // --- Markers & Clusterer ---
                let clusterer: any = null;
                if (window.kakao.maps.MarkerClusterer) {
                    try {
                        clusterer = new window.kakao.maps.MarkerClusterer({
                            map: map,
                            averageCenter: true,
                            minLevel: 6,
                            disableClickZoom: false, // We will handle click
                            styles: [{
                                width: '50px', height: '50px',
                                background: 'rgba(59, 130, 246, 0.9)',
                                borderRadius: '50%',
                                color: 'white',
                                textAlign: 'center', lineHeight: '50px',
                                fontWeight: 'bold',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                                border: '2px solid rgba(255,255,255,0.8)'
                            }]
                        });
                    } catch (e) { console.warn("Clusterer error", e); }
                }

                const markers: any[] = [];
                const overlays: any[] = [];

                allVenuesList.current.forEach(venue => {
                    const position = new window.kakao.maps.LatLng(venue.lat, venue.lng);
                    const perfs = venue.performances;
                    const primaryGenre = perfs[0]?.genre;
                    const color = GENRE_STYLES[primaryGenre]?.hex || '#9ca3af';

                    // Marker (Invisible/Small) or Custom Content
                    // We use CustomOverlay for the badges as main indicators
                    const content = document.createElement('div');
                    content.style.cssText = `background-color: ${color}; width: 28px; height: 28px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); cursor: pointer; display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 11px; z-index: 10;`;
                    content.innerText = perfs.length.toString();

                    content.onclick = () => {
                        setSelectedVenue(venue.venueName);
                        // Center map on click? Optional. 
                        // map.panTo(position); 
                    };

                    const customOverlay = new window.kakao.maps.CustomOverlay({
                        position: position,
                        content: content,
                        yAnchor: 1
                    });

                    // Also create a marker for Clusterer if needed, or just use overlay.
                    // Clusterer usually needs Markers.
                    const marker = new window.kakao.maps.Marker({ position });
                    marker.setMap(null); // Hide default marker
                    // Hack: Clusterer works with Markers. We might want to just show Overlays and skip Clusterer if we want custom UI?
                    // Or sync them. 
                    // For performance with thousands of points, Clusterer is better.
                    // Let's stick to Overlays for now as they carry count info which is critical.
                    // If performance is issue, we can revisit. User said "optimize speed", so...
                    // But Overlay view is "venue" based. There aren't THAT many venues (usually < 100 visible).
                    // So rendering 100 overlays is fine.

                    customOverlay.setMap(map);
                    overlays.push(customOverlay);
                });

                // User Location Marker
                if (!centerLocation && navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(pos => {
                        const loc = new window.kakao.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
                        const content = `<div style="width:16px;height:16px;background:#3b82f6;border:2px solid white;border-radius:50%;box-shadow:0 0 8px rgba(59,130,246,0.5);"></div>`;
                        new window.kakao.maps.CustomOverlay({ map, position: loc, content });
                    });
                }

                // --- Event Listeners removed from here as they handle stale states incorrectly ---
                const handleMapChange = () => {
                    setShowSearchHereBtn(true);
                };

                window.kakao.maps.event.addListener(map, 'dragend', handleMapChange);
                window.kakao.maps.event.addListener(map, 'zoom_changed', handleMapChange);

                setIsMapReady(true);

                // Initial Bounds Check
                setTimeout(() => {
                    handleSearchHereInternal(map);
                }, 500);
            });
        };

        const checkInterval = setInterval(() => {
            if (window.kakao && window.kakao.maps) {
                clearInterval(checkInterval);
                initializeMap();
            }
        }, 100);
        return () => clearInterval(checkInterval);
    }, []);

    const handleSearchHereInternal = (map: any) => {
        if (!map) return;
        const bounds = map.getBounds();
        const visible = allVenuesList.current.filter(v => {
            const latlng = new window.kakao.maps.LatLng(v.lat, v.lng);
            return bounds.contain(latlng);
        });
        setVisibleVenues(visible);
        setShowSearchHereBtn(false);
    };

    const handleSearchHere = () => handleSearchHereInternal(mapInstance);

    // Popup Position Logic
    const [popupPosition, setPopupPosition] = useState<{ x: number, y: number } | null>(null);

    const updatePopupPosition = useCallback(() => {
        if (!mapInstance || !selectedVenue) {
            setPopupPosition(null);
            return;
        }

        const venueData = allVenueGroups.current[selectedVenue];
        if (!venueData) {
            setPopupPosition(null);
            return;
        }

        const pos = new window.kakao.maps.LatLng(venueData.lat, venueData.lng);
        const projection = mapInstance.getProjection();
        const point = projection.containerPointFromCoords(pos);

        setPopupPosition({ x: point.x, y: point.y });
    }, [mapInstance, selectedVenue]);

    // Attach map listeners for popup positioning
    useEffect(() => {
        if (!mapInstance) return;

        const syncPopup = () => updatePopupPosition();

        window.kakao.maps.event.addListener(mapInstance, 'drag', syncPopup);
        window.kakao.maps.event.addListener(mapInstance, 'zoom_changed', syncPopup);
        window.kakao.maps.event.addListener(mapInstance, 'bounds_changed', syncPopup);

        // Initial sync
        syncPopup();

        return () => {
            window.kakao.maps.event.removeListener(mapInstance, 'drag', syncPopup);
            window.kakao.maps.event.removeListener(mapInstance, 'zoom_changed', syncPopup);
            window.kakao.maps.event.removeListener(mapInstance, 'bounds_changed', syncPopup);
        };
    }, [mapInstance, updatePopupPosition]);


    // Handling Selected Venue Performance List (Infinite Scroll Logic)
    const [perfVisibleCount, setPerfVisibleCount] = useState(10);
    const selectedVenueData = selectedVenue ? allVenueGroups.current[selectedVenue] : null;

    // Reset visible count when venue changes
    useEffect(() => {
        if (selectedVenue) setPerfVisibleCount(10);
    }, [selectedVenue]);

    // Use BottomNavSheet for Venue Detail
    // When selectedVenue is active, we treat it as 'venue-detail' menu active
    // We need to pass dummy props for the required ones that aren't used here.
    const noop = () => { };
    const dummyProps = {
        viewMode: 'map',
        onViewModeChange: noop,
        selectedGenre: 'all',
        onGenreSelect: noop,
        searchText: '',
        onSearchChange: noop,
        selectedRegion: 'all',
        onRegionSelect: noop,
        selectedDistrict: 'all',
        onDistrictSelect: noop,
        keywords: [],
        onKeywordAdd: noop,
        onKeywordRemove: noop,
        districts: [],
        availableVenues: [],
        onSearch: noop,
        onVenueSelect: noop,
    };

    const handlePerfScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollTop + clientHeight >= scrollHeight - 20) {
            if (selectedVenueData && perfVisibleCount < selectedVenueData.performances.length) {
                setPerfVisibleCount(prev => prev + 10);
            }
        }
    };

    return (
        <Portal>
            <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                <div className="relative w-full h-full max-w-[1700px] max-h-[90vh] m-0 sm:m-4 bg-gray-900 sm:rounded-2xl overflow-hidden shadow-2xl border border-gray-800 flex flex-col">
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 z-[100] p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    {/* Search Here Button */}
                    {showSearchHereBtn && isMapReady && (
                        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[100]">
                            <button
                                onClick={handleSearchHere}
                                className="px-4 py-2 bg-blue-600 text-white rounded-full font-bold shadow-lg hover:bg-blue-700 transition flex items-center gap-2 text-sm animate-fade-in-up"
                            >
                                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                현 위치에서 검색
                            </button>
                        </div>
                    )}

                    <div ref={mapRef} className="w-full h-full bg-gray-800" />

                    {/* Popup Layer (Relative to Map) */}
                    <div className="absolute inset-0 pointer-events-none z-[110]">
                        {selectedVenue && selectedVenueData && popupPosition && (
                            <div
                                className="absolute pointer-events-auto flex flex-col items-center"
                                style={{
                                    left: popupPosition.x,
                                    top: popupPosition.y,
                                    transform: 'translate(-50%, -100%) translateY(-20px)', // Pivot bottom center + gap above marker
                                    filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.5))'
                                }}
                            >
                                <div className="bg-gray-900 rounded-xl border border-gray-700 w-[280px] overflow-hidden flex flex-col shadow-2xl">
                                    {/* Header */}
                                    <div className="bg-gray-800 p-3 flex justify-between items-start">
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-white font-bold text-base leading-tight truncate">{selectedVenue}</h3>
                                            <p className="text-[10px] text-gray-400 mt-0.5 truncate">{selectedVenueData.address}</p>
                                        </div>
                                        <button onClick={() => setSelectedVenue(null)} className="text-gray-400 hover:text-white ml-2 shrink-0">
                                            <X size={16} />
                                        </button>
                                    </div>

                                    {/* List */}
                                    <div className="max-h-[240px] overflow-y-auto custom-scrollbar bg-gray-900 p-2 space-y-2"
                                        onScroll={handlePerfScroll}
                                    >
                                        {selectedVenueData.performances.slice(0, perfVisibleCount).map((p: any) => (
                                            <a
                                                key={p.id}
                                                href={p.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex gap-2 bg-gray-800/50 p-2 rounded hover:bg-gray-800 transition border border-gray-800 hover:border-gray-600 group"
                                            >
                                                {p.image ? (
                                                    <img src={getOptimizedUrl(p.image, 80)} alt={p.title} className="w-10 h-14 object-cover rounded bg-gray-950 shrink-0" />
                                                ) : (
                                                    <div className="w-10 h-14 bg-gray-800 rounded flex items-center justify-center shrink-0">
                                                        <Heart size={10} className="text-gray-600" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 mb-0.5">
                                                        <span className={clsx(
                                                            "px-1 py-[1px] rounded-[3px] text-[9px] font-extrabold text-white leading-none",
                                                            (GENRE_STYLES as any)[p.genre]?.twBg || 'bg-gray-600'
                                                        )}>
                                                            {GENRES.find(g => g.id === p.genre)?.label}
                                                        </span>
                                                        <span className="text-[9px] text-gray-500">{p.date}</span>
                                                    </div>
                                                    <h4 className="text-[12px] font-bold text-gray-200 group-hover:text-emerald-400 line-clamp-2 leading-tight">
                                                        {p.title}
                                                    </h4>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                                {/* Arrow Tail */}
                                <div className="w-4 h-4 bg-gray-900 border-r border-b border-gray-700 transform rotate-45 -mt-2 z-0 relative shadow-sm"></div>
                            </div>
                        )}
                    </div>

                    {/* Bottom Sheet Area (Venue List) */}
                    <div className="absolute bottom-0 left-0 right-0 z-[90] bg-gradient-to-t from-gray-900 via-gray-900/90 to-transparent pt-8 pb-4 px-4">



                        {/* CASE 2: Visible Venues List (Horizontal Scroll) - ALWAYS VISIBLE */}
                        {visibleVenues.length > 0 && (
                            <div
                                ref={scrollRef}
                                className={`flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x pointer-events-auto cursor-grab ${isDragging ? 'cursor-grabbing' : ''}`}
                                onMouseDown={onMouseDown}
                                onMouseLeave={onMouseLeave}
                                onMouseUp={onMouseUp}
                                onMouseMove={onMouseMove}
                            >
                                {visibleVenues.map((v: any) => {
                                    const isFavorite = favoriteVenues.includes(v.venueName);
                                    const isSelected = selectedVenue === v.venueName;

                                    // Calculate Distance
                                    let distanceLabel = '';
                                    if (centerLocation) {
                                        const dist = getDistanceFromLatLonInKm(centerLocation.lat, centerLocation.lng, v.lat, v.lng);
                                        distanceLabel = `${dist.toFixed(1)}km`;
                                    }

                                    return (
                                        <button
                                            type="button"
                                            key={v.venueName}
                                            onClick={() => {
                                                const newSelected = v.venueName === selectedVenue ? null : v.venueName;
                                                setSelectedVenue(newSelected); // Toggle
                                                if (newSelected && mapInstance && v.lat && v.lng) {
                                                    const moveLatLon = new window.kakao.maps.LatLng(v.lat, v.lng);
                                                    mapInstance.panTo(moveLatLon);
                                                    mapInstance.setLevel(2); // Focus zoom level
                                                }
                                            }}
                                            className={clsx(
                                                "snap-center shrink-0 w-64 p-3 rounded-xl shadow-xl text-left flex flex-col gap-1 transition-all duration-300 border",
                                                isSelected
                                                    ? "bg-emerald-50/95 border-emerald-500 ring-2 ring-emerald-500/50 scale-[1.02]"
                                                    : "bg-white/90 backdrop-blur border-white/20 hover:bg-white hover:scale-[1.01]"
                                            )}
                                        >
                                            <div className="flex justify-between items-start w-full">
                                                <h4 className={clsx("font-extrabold text-sm truncate flex-1", isSelected ? "text-emerald-900" : "text-black")}>
                                                    {v.venueName}
                                                </h4>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onToggleFavorite(v.venueName);
                                                    }}
                                                    className={clsx(
                                                        "ml-2 p-1 rounded-full transition-colors",
                                                        isFavorite
                                                            ? "hover:bg-pink-100"
                                                            : (isSelected ? "hover:bg-emerald-200" : "hover:bg-gray-100")
                                                    )}
                                                >
                                                    <Heart className={clsx("w-4 h-4", isFavorite ? 'text-pink-500 fill-pink-500' : 'text-gray-400')} />
                                                </button>
                                            </div>

                                            {/* Distance Badge */}
                                            {distanceLabel && (
                                                <div className={clsx(
                                                    "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] w-fit font-bold mb-1",
                                                    isSelected
                                                        ? "bg-emerald-200 text-emerald-800"
                                                        : "bg-gray-100 text-gray-500"
                                                )}>
                                                    <MapPin size={10} className="fill-current" />
                                                    {distanceLabel}
                                                </div>
                                            )}
                                            <span className="text-gray-300 light:text-gray-600 truncate">{v.groupName}</span>
                                            <div className="mt-auto flex items-center justify-between text-xs">
                                                <span className="text-emerald-400 light:text-emerald-600 font-bold shrink-0">
                                                    {v.performances.length}개 컨텐츠
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Portal>
    );
}
