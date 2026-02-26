'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { clsx } from 'clsx';
import { Performance } from '@/types';
import { X, Heart, RotateCw, Film } from 'lucide-react';
import BuildingStadium from './BuildingStadium';
import venueData from '@/data/venues.json';
import { GENRES, GENRE_STYLES } from '@/lib/constants';
import { getOptimizedUrl, getDistanceFromLatLonInKm } from '@/lib/utils';

import Portal from './ui/Portal';

// import BottomNavSheet from './BottomNavSheet'; // Reverted usage for detail view


interface Cinema {
    name: string;
    address: string;
    lat: number;
    lng: number;
    brand: string;
}
interface Venue {
    name: string;
    address: string;
    lat?: number;
    lng?: number;
    district?: string;
}
const venues = venueData as Record<string, Venue>;

export interface KakaoMapModalProps {
    performances: Performance[];
    onClose: () => void;
    centerLocation?: { lat: number; lng: number; name: string } | null;
    favoriteVenues: string[];
    onToggleFavorite: (venueName: string) => void;
    onVenueLocationChange?: (venueName: string, lat: number, lng: number) => void;
    cinemas?: Cinema[];
}

export default function KakaoMapModal({ performances, cinemas = [], onClose, centerLocation, favoriteVenues, onToggleFavorite, onVenueLocationChange }: KakaoMapModalProps) {
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
                    lng: venues[perf.venue]?.lng || 0,
                    type: 'performance'
                };
            }
            acc[perf.venue].performances.push(perf);
            return acc;
        }, {} as Record<string, any>);

        // Add Cinemas as separate groups if provided
        cinemas.forEach(cinema => {
            if (!groups[cinema.name]) {
                groups[cinema.name] = {
                    venueName: cinema.name,
                    address: cinema.address,
                    lat: cinema.lat,
                    lng: cinema.lng,
                    brand: cinema.brand,
                    type: 'cinema',
                    performances: performances.filter(p => p.genre === 'movie').slice(0, 5) // Show top movies in cinema popup
                };
            }
        });

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
                            minLevel: 7,
                            disableClickZoom: false,
                            styles: [{
                                width: '50px', height: '50px',
                                background: 'rgba(79, 70, 229, 0.9)',
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
                    const isCinema = venue.type === 'cinema';
                    const color = isCinema ? '#4f46e5' : (GENRE_STYLES[primaryGenre]?.hex || '#10b981');

                    // 1. Create Overlay for UI
                    const content = document.createElement('div');
                    content.style.cssText = `background-color: ${color}; width: 32px; height: 32px; border-radius: 50%; border: 2px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3); cursor: pointer; display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 11px; z-index: 10; transition: transform 0.2s;`;

                    if (isCinema) {
                        content.innerHTML = `
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <rect width="18" height="18" x="3" y="3" rx="2"/><path d="m15 3-3 3-3-3"/><path d="m15 21-3-3-3 3"/><path d="m3 15 3-3-3-3"/><path d="m21 15-3-3 3-3"/>
                            </svg>
                        `;
                    } else {
                        content.innerText = perfs.length.toString();
                    }

                    content.onclick = () => {
                        setSelectedVenue(venue.venueName);
                    };

                    const customOverlay = new window.kakao.maps.CustomOverlay({
                        position: position,
                        content: content,
                        yAnchor: 1
                    });

                    // Initially show if level is deep enough
                    if (map.getLevel() <= 6) {
                        customOverlay.setMap(map);
                    }

                    // 2. Create Marker for Clusterer (Invisible to avoid redundancy with CustomOverlay)
                    const marker = new window.kakao.maps.Marker({
                        position,
                        image: new window.kakao.maps.MarkerImage(
                            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
                            new window.kakao.maps.Size(1, 1)
                        )
                    });

                    overlays.push({ overlay: customOverlay, isCinema });
                    markers.push(marker);
                });

                if (clusterer) {
                    clusterer.addMarkers(markers);
                }

                // --- Event Listeners with high-perf management ---
                const manageVisibility = () => {
                    const currentLevel = map.getLevel();
                    const showOverlays = currentLevel <= 6;

                    overlays.forEach(item => {
                        if (showOverlays) {
                            item.overlay.setMap(map);
                        } else {
                            item.overlay.setMap(null);
                        }
                    });
                    setShowSearchHereBtn(true);
                };

                window.kakao.maps.event.addListener(map, 'dragend', () => setShowSearchHereBtn(true));
                window.kakao.maps.event.addListener(map, 'zoom_changed', manageVisibility);

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
                <div className="relative w-full h-full max-w-[1700px] max-h-[90vh] m-0 sm:m-4 bg-white dark:bg-gray-900 sm:rounded-2xl overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col">
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 z-[100] p-2 bg-white/80 dark:bg-black/50 text-gray-900 dark:text-white rounded-full hover:bg-white dark:hover:bg-black/70 transition shadow-md"
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

                    <div ref={mapRef} className="w-full h-full bg-gray-200 dark:bg-gray-800" />

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
                                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 w-[280px] overflow-hidden flex flex-col shadow-2xl">
                                    {/* Header */}
                                    <div className="bg-gray-50 dark:bg-gray-800 p-3 flex justify-between items-start border-b border-gray-100 dark:border-gray-800">
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-gray-900 dark:text-white font-bold text-base leading-tight truncate">{selectedVenue}</h3>
                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">{selectedVenueData.address}</p>
                                        </div>
                                        <button onClick={() => setSelectedVenue(null)} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white ml-2 shrink-0">
                                            <X size={16} />
                                        </button>
                                    </div>

                                    {/* Cinema Special Row */}
                                    {selectedVenueData.type === 'cinema' && (
                                        <div className="bg-indigo-50 dark:bg-indigo-900/30 p-2 border-b border-indigo-100 dark:border-indigo-800">
                                            <a
                                                href={`https://search.naver.com/search.naver?query=${encodeURIComponent(selectedVenue + ' 상영시간표')}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-center gap-1.5 w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg transition-colors shadow-sm"
                                            >
                                                <RotateCw size={12} />
                                                실시간 상영시간표 확인하기
                                            </a>
                                            <p className="text-[9px] text-indigo-600 dark:text-indigo-400 mt-1.5 font-bold text-center">
                                                ★ 현재 박스오피스 상영 예정작
                                            </p>
                                        </div>
                                    )}

                                    {/* List */}
                                    <div className="max-h-[240px] overflow-y-auto custom-scrollbar bg-white dark:bg-gray-900 p-2 space-y-2"
                                        onScroll={handlePerfScroll}
                                    >
                                        {selectedVenueData.performances.slice(0, perfVisibleCount).map((p: any) => (
                                            <a
                                                key={p.id}
                                                href={p.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex gap-2 bg-gray-50 dark:bg-gray-800/50 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition border border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-600 group"
                                            >
                                                {p.image ? (
                                                    <img src={getOptimizedUrl(p.image, 80)} alt={p.title} className="w-10 h-14 object-cover rounded bg-gray-200 dark:bg-gray-950 shrink-0" />
                                                ) : (
                                                    <div className="w-10 h-14 bg-gray-200 dark:bg-gray-800 rounded flex items-center justify-center shrink-0">
                                                        <Heart size={10} className="text-gray-400 dark:text-gray-600" />
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
                                                    <h4 className="text-[12px] font-bold text-gray-900 dark:text-gray-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 line-clamp-2 leading-tight">
                                                        {p.title}
                                                    </h4>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                                {/* Arrow Tail */}
                                <div className="w-4 h-4 bg-white dark:bg-gray-900 border-r border-b border-gray-200 dark:border-gray-700 transform rotate-45 -mt-2 z-0 relative shadow-sm"></div>
                            </div>
                        )}
                    </div>

                    {/* Bottom Sheet Area (Venue List) */}
                    <div className="absolute bottom-0 left-0 right-0 z-[90] bg-gradient-to-t from-white/90 dark:from-gray-900 via-white/80 dark:via-gray-900/90 to-transparent pt-12 pb-4 px-4">



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
                                                    ? "bg-emerald-50 dark:bg-emerald-900/50 border-emerald-500 ring-2 ring-emerald-500/50 scale-[1.02]"
                                                    : "bg-white/90 dark:bg-gray-800/90 backdrop-blur border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 hover:scale-[1.01]"
                                            )}
                                        >
                                            <div className="flex justify-between items-start w-full">
                                                <h4 className={clsx("font-extrabold text-sm truncate flex-1", isSelected ? "text-emerald-900 dark:text-emerald-300" : "text-gray-900 dark:text-white")}>
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
                                                            ? "hover:bg-pink-100 dark:hover:bg-pink-900/50"
                                                            : (isSelected ? "hover:bg-emerald-200 dark:hover:bg-emerald-800" : "hover:bg-gray-100 dark:hover:bg-gray-700")
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
                                                        ? "bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200"
                                                        : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                                                )}>
                                                    {distanceLabel}
                                                </div>
                                            )}
                                            <span className="text-gray-500 dark:text-gray-400 text-[10px] truncate">{v.groupName}</span>
                                            <div className="mt-auto flex items-center justify-between text-xs">
                                                <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
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
