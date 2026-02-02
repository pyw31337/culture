'use client';

import { useEffect, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { Performance } from '@/types';
import { X, Star } from 'lucide-react';
import BuildingStadium from './BuildingStadium';
import venueData from '@/data/venues.json';
import { GENRES, GENRE_STYLES } from '@/lib/constants';
import { getOptimizedUrl, getDistanceFromLatLonInKm } from '@/lib/utils';

import Portal from './ui/Portal';
import BottomNavSheet from './BottomNavSheet';

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
                    level: centerLocation ? 4 : 8 // Start with slightly closer level for visibility
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

                // --- Event Listeners ---
                const handleMapChange = () => {
                    setShowSearchHereBtn(true);
                };

                window.kakao.maps.event.addListener(map, 'dragend', handleMapChange);
                window.kakao.maps.event.addListener(map, 'zoom_changed', handleMapChange);

                setIsMapReady(true);

                // Initial Bounds Check to set Visible Venues correctly
                // Wait for map to settle
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

                    {/* Bottom Sheet Area */}
                    <div className="absolute bottom-0 left-0 right-0 z-[90] bg-gradient-to-t from-gray-900 via-gray-900/90 to-transparent pt-8 pb-4 px-4">

                        {/* CASE 1: Selected Venue Detail (BottomNavSheet Integration) */}
                        <BottomNavSheet
                            activeMenu={selectedVenue ? 'venue-detail' : null}
                            onClose={() => setSelectedVenue(null)}
                            {...dummyProps}
                            venuePerformances={selectedVenueData?.performances || []}
                            selectedVenue={selectedVenue || ''}
                            hasBackdrop={false}
                        />

                        {/* CASE 2: Visible Venues List (Horizontal Scroll) - Only when no venue selected */}
                        {!selectedVenue && visibleVenues.length > 0 && (
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
                                    return (
                                        <button
                                            type="button"
                                            key={v.venueName}
                                            onClick={() => {
                                                setSelectedVenue(v.venueName);
                                                if (mapInstance && v.lat && v.lng) {
                                                    const moveLatLon = new window.kakao.maps.LatLng(v.lat, v.lng);
                                                    mapInstance.panTo(moveLatLon);
                                                }
                                            }}
                                            className={`snap-center shrink-0 w-64 p-3 rounded-xl shadow-xl text-left flex flex-col gap-1 transition-all duration-300 border hover:scale-[1.01] bg-white/90 backdrop-blur border-white/20 text-black hover:bg-white`}
                                        >
                                            <div className="flex justify-between items-start w-full">
                                                <h4 className="font-extrabold text-sm truncate flex-1">{v.venueName}</h4>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onToggleFavorite(v.venueName);
                                                    }}
                                                    className={`ml-2 p-1 rounded-full transition-colors ${isFavorite ? 'hover:bg-white/20' : 'hover:bg-gray-100'}`}
                                                >
                                                    <Star className={`w-4 h-4 ${isFavorite ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400'}`} />
                                                </button>
                                            </div>
                                            <p className="text-xs text-gray-600 truncate">{v.address || '주소 정보 없음'}</p>
                                            <div className="mt-1 flex items-center justify-between text-xs">
                                                <span className="font-extrabold text-blue-600">{v.performances.length}개 공연</span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )
                        }
                    </div>
                </div>
            </div>
        </Portal>
    );
}
