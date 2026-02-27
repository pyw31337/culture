'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { clsx } from 'clsx';
import { Performance } from '@/types';
import { X, Heart, RotateCw, Film, Plus, Minus } from 'lucide-react';
import BuildingStadium from './BuildingStadium';
import venueData from '@/data/venues.json';
import { GENRES, GENRE_STYLES } from '@/lib/constants';
import { getOptimizedUrl, getDistanceFromLatLonInKm } from '@/lib/utils';

import Portal from './ui/Portal';

interface Cinema {
    name: string;
    address: string;
    lat: number;
    lng: number;
    brand: string;
}
interface Venue {
    name?: string;
    address: string;
    lat?: number;
    lng?: number;
    district?: string;
    refined_name?: string;
}
const venues = venueData as unknown as Record<string, Venue>;

export interface KakaoMapModalProps {
    performances: Performance[];
    onClose: () => void;
    centerLocation?: { lat: number; lng: number; name: string } | null;
    favoriteVenues: string[];
    onToggleFavorite: (venueName: string) => void;
    onVenueLocationChange?: (venueName: string, lat: number, lng: number) => void;
    cinemas?: Cinema[];
    selectedGenre?: string;
}

export default function KakaoMapModal({
    performances,
    cinemas = [],
    onClose,
    centerLocation,
    favoriteVenues,
    onToggleFavorite,
    onVenueLocationChange,
    selectedGenre = 'all'
}: KakaoMapModalProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const [mapInstance, setMapInstance] = useState<any>(null);
    const [selectedVenue, setSelectedVenue] = useState<string | null>(null);

    // Optimization States
    const [visibleVenues, setVisibleVenues] = useState<any[]>([]);
    const [showSearchHereBtn, setShowSearchHereBtn] = useState(false);
    const [isMapReady, setIsMapReady] = useState(false);

    // Group performances by venue - Pre-calculation
    const allVenueGroups = useRef<Record<string, any>>({});
    const allVenuesList = useRef<any[]>([]);
    const lastBoundedLocationRef = useRef<string | null>(null);

    // Drag to scroll logic (Horizontal List)
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);
    const isDragClicked = useRef(false);

    const onMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        isDragClicked.current = false;
        if (scrollRef.current) {
            setStartX(e.pageX - scrollRef.current.offsetLeft);
            setScrollLeft(scrollRef.current.scrollLeft);
        }
    };

    const onMouseLeave = () => setIsDragging(false);
    const onMouseUp = () => setIsDragging(false);
    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollRef.current.offsetLeft;
        const walk = (x - startX) * 2;
        if (Math.abs(walk) > 10) {
            isDragClicked.current = true;
        }
        scrollRef.current.scrollLeft = scrollLeft - walk;
    };

    // Initialize Data
    useEffect(() => {
        const isMovieMode = selectedGenre === 'movie';
        const isAllMode = selectedGenre === 'all' || !selectedGenre;

        const groups: Record<string, any> = {};

        // 1. Process Performances (Non-movie venues, or All)
        // Skip this section entirely if we are STRICTLY in movie mode
        if (!isMovieMode || isAllMode) {
            performances.forEach((perf) => {
                // If specific genre (not 'all'), only include if matches
                if (!isAllMode && perf.genre !== selectedGenre) return;

                const displayVenueName = venues[perf.venue]?.refined_name || venues[perf.venue]?.name || perf.venue;

                if (!groups[displayVenueName]) {
                    groups[displayVenueName] = {
                        ...venues[perf.venue],
                        venueName: displayVenueName,
                        performances: [],
                        lat: venues[perf.venue]?.lat || 0,
                        lng: venues[perf.venue]?.lng || 0,
                        type: 'performance'
                    };
                }
                groups[displayVenueName].performances.push(perf);
            });
        }

        // 2. Process Cinemas (Movie venues, or All)
        if (isMovieMode || isAllMode) {
            cinemas.forEach(cinema => {
                if (!groups[cinema.name]) {
                    groups[cinema.name] = {
                        venueName: cinema.name,
                        address: cinema.address,
                        lat: cinema.lat,
                        lng: cinema.lng,
                        brand: cinema.brand,
                        type: 'cinema',
                        // Parent component already filters performances to relevant ones
                        performances: performances.slice(0, 10)
                    };
                }
            });
        }

        allVenueGroups.current = groups;
        const list = Object.values(groups).filter(v => v.lat && v.lng);

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
        setVisibleVenues(list.slice(0, 20));
    }, [performances, cinemas, centerLocation, selectedGenre]);

    const handleSearchHereInternal = useCallback((map: any) => {
        if (!map) return;
        const bounds = map.getBounds();
        const visible = allVenuesList.current.filter(v => {
            const latlng = new window.kakao.maps.LatLng(v.lat, v.lng);
            return bounds.contain(latlng);
        });
        setVisibleVenues(visible);
        setShowSearchHereBtn(false);
    }, []);

    const handleSearchHere = () => handleSearchHereInternal(mapInstance);

    // 1. Initialize Map Instance
    useEffect(() => {
        let checkInterval: any;

        const initializeMap = () => {
            if (!window.kakao || !window.kakao.maps) return;

            window.kakao.maps.load(() => {
                if (!mapRef.current) return;

                const defaultCenter = new window.kakao.maps.LatLng(37.554648, 126.972559);
                const options = {
                    center: centerLocation
                        ? new window.kakao.maps.LatLng(centerLocation.lat, centerLocation.lng)
                        : defaultCenter,
                    level: centerLocation ? 2 : 6
                };

                mapRef.current!.innerHTML = '';
                const map = new window.kakao.maps.Map(mapRef.current, options);

                // Attach custom properties for state tracking
                (map as any)._customOverlays = [];
                (map as any)._clusterer = null;

                setMapInstance(map);

                // --- Global Event Listeners ---
                const handleMapChange = () => {
                    setShowSearchHereBtn(true);
                };

                window.kakao.maps.event.addListener(map, 'dragend', handleMapChange);
                window.kakao.maps.event.addListener(map, 'zoom_changed', handleMapChange);

                // Center / User Location Marker
                if (centerLocation) {
                    const loc = new window.kakao.maps.LatLng(centerLocation.lat, centerLocation.lng);
                    const content = `<div class="flex flex-col items-center pointer-events-none" style="transform: translateY(-100%); margin-top: 12px;">
                        <div class="bg-red-500 text-white px-2.5 py-1 rounded-lg text-xs font-extrabold shadow-md mb-1 whitespace-nowrap border border-red-400">
                            ${centerLocation.name || '검색 위치'}
                        </div>
                        <div class="w-4 h-4 bg-red-500 border-2 border-white rounded-full shadow-lg relative">
                            <div class="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-50"></div>
                        </div>
                    </div>`;
                    new window.kakao.maps.CustomOverlay({ map, position: loc, content, zIndex: 100 });
                } else if (navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(pos => {
                        const loc = new window.kakao.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
                        const content = `<div style="width:16px;height:16px;background:#3b82f6;border:2px solid white;border-radius:50%;box-shadow:0 0 8px rgba(59,130,246,0.5);"></div>`;
                        new window.kakao.maps.CustomOverlay({ map, position: loc, content });
                    });
                }

                setIsMapReady(true);

                // Initial Bounds Check
                setTimeout(() => {
                    handleSearchHereInternal(map);
                }, 500);
            });
        };

        checkInterval = setInterval(() => {
            if (window.kakao && window.kakao.maps) {
                clearInterval(checkInterval);
                initializeMap();
            }
        }, 100);
        return () => clearInterval(checkInterval);
    }, [centerLocation, handleSearchHereInternal]);

    // 2. Re-render Markers when Data changes
    useEffect(() => {
        if (!mapInstance || !isMapReady) return;

        const map = mapInstance;

        // --- Cleanup Existing ---
        if (map._clusterer) {
            map._clusterer.clear();
        }
        if (map._customOverlays) {
            map._customOverlays.forEach((ov: any) => ov.setMap(null));
        }

        // --- New Markers & Clusterer ---
        let clusterer = map._clusterer;
        if (!clusterer && window.kakao.maps.MarkerClusterer) {
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
                map._clusterer = clusterer;
            } catch (e) {
                console.warn("Clusterer error", e);
            }
        }

        const markers: any[] = [];
        const newOverlays: any[] = [];

        allVenuesList.current.forEach(venue => {
            if (!venue.lat || !venue.lng) return;

            const position = new window.kakao.maps.LatLng(venue.lat, venue.lng);
            const perfs = venue.performances;
            const primaryGenre = perfs[0]?.genre;
            const isCinema = venue.type === 'cinema';
            const color = isCinema ? '#4f46e5' : (GENRE_STYLES[primaryGenre]?.hex || '#10b981');

            const content = document.createElement('div');
            content.style.cssText = `background-color: ${color}; width: 32px; height: 32px; border-radius: 50%; border: 2px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.3); cursor: pointer; display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 11px; z-index: 10; transition: transform 0.2s;`;

            if (isCinema) {
                content.innerText = perfs.length > 0 ? perfs.length.toString() : '📽️';
            } else {
                content.innerText = perfs.length.toString();
            }

            content.onclick = () => {
                setSelectedVenue(venue.venueName);
                if (map) {
                    const moveLatLon = new window.kakao.maps.LatLng(venue.lat, venue.lng);
                    if (map.getLevel() > 4) {
                        map.setLevel(4);
                        setTimeout(() => map.panTo(moveLatLon), 10);
                    } else {
                        map.panTo(moveLatLon);
                    }
                }
                setTimeout(() => {
                    const scrollContainer = document.getElementById('venue-scroll-container');
                    if (scrollContainer) {
                        const idx = allVenuesList.current.findIndex(v => v.venueName === venue.venueName);
                        if (idx !== -1 && scrollContainer.children[idx]) {
                            const card = scrollContainer.children[idx] as HTMLElement;
                            const scrollLeft = card.offsetLeft - (scrollContainer.clientWidth / 2) + (card.clientWidth / 2);
                            scrollContainer.scrollTo({ left: scrollLeft, behavior: 'smooth' });
                        }
                    }
                }, 100);
            };

            const customOverlay = new window.kakao.maps.CustomOverlay({
                position: position,
                content: content,
                yAnchor: 0.5
            });

            if (map.getLevel() <= 6) {
                customOverlay.setMap(map);
            }

            const marker = new window.kakao.maps.Marker({
                position,
                image: new window.kakao.maps.MarkerImage(
                    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
                    new window.kakao.maps.Size(1, 1)
                ),
                opacity: 0
            });

            newOverlays.push(customOverlay);
            markers.push(marker);
        });

        if (clusterer) {
            clusterer.addMarkers(markers);
        }
        map._customOverlays = newOverlays;

        // --- Auto-adjust bounds to ensure at least 1 closest venue is visible ---
        if (centerLocation && allVenuesList.current.length > 0) {
            const locKey = `${centerLocation.lat},${centerLocation.lng}`;
            if (lastBoundedLocationRef.current !== locKey) {
                lastBoundedLocationRef.current = locKey;
                const closest = allVenuesList.current[0]; // Already sorted by distance in Data Init useEffect
                if (closest && closest.lat && closest.lng) {
                    const bounds = new window.kakao.maps.LatLngBounds();
                    bounds.extend(new window.kakao.maps.LatLng(centerLocation.lat, centerLocation.lng));
                    bounds.extend(new window.kakao.maps.LatLng(closest.lat, closest.lng));

                    // Use setTimeout to allow the map to render before bounding
                    setTimeout(() => {
                        // Apply padding to ensure markers aren't perfectly on the visual edge
                        map.setBounds(bounds, 150, 50, 50, 50);
                    }, 100);
                }
            }
        } else if (!centerLocation && allVenuesList.current.length > 0) {
            const sigKey = `all_${allVenuesList.current.length}_${selectedGenre}`;
            if (lastBoundedLocationRef.current !== sigKey) {
                lastBoundedLocationRef.current = sigKey;
                
                // Bound the map to include all matched venues in the search result
                const bounds = new window.kakao.maps.LatLngBounds();
                let hasValidCoords = false;
                
                allVenuesList.current.forEach(v => {
                    if (v.lat && v.lng) {
                        bounds.extend(new window.kakao.maps.LatLng(v.lat, v.lng));
                        hasValidCoords = true;
                    }
                });
                
                if (hasValidCoords) {
                    setTimeout(() => {
                        // Only bound if there's more than 1 venue, or if it's 1 it might zoom in too far.
                        if (allVenuesList.current.length === 1) {
                            map.setCenter(new window.kakao.maps.LatLng(allVenuesList.current[0].lat, allVenuesList.current[0].lng));
                            map.setLevel(4);
                        } else {
                            map.setBounds(bounds, 100, 50, 150, 50);
                            
                            // Restrict zoom out to Level 7 (approx 1km scale) to prevent zooming out to the whole country.
                            setTimeout(() => {
                                if (map.getLevel() > 7) {
                                    map.setLevel(7);
                                }
                            }, 50);
                        }
                    }, 100);
                }
            }
        }

        const manageVisibility = () => {
            const currentLevel = map.getLevel();
            const showOverlays = currentLevel <= 6;
            newOverlays.forEach(ov => ov.setMap(showOverlays ? map : null));
        };

        window.kakao.maps.event.addListener(map, 'zoom_changed', manageVisibility);

        return () => {
            window.kakao.maps.event.removeListener(map, 'zoom_changed', manageVisibility);
        };
    }, [mapInstance, isMapReady, performances, cinemas, selectedGenre, centerLocation]); // Re-run when data changes

    // Popup Position Logic
    const [popupPosition, setPopupPosition] = useState<{ x: number, y: number } | null>(null);

    const updatePopupPosition = useCallback(() => {
        if (!mapInstance || !selectedVenue) {
            setPopupPosition(null);
            return;
        }

        const venueValue = allVenueGroups.current[selectedVenue];
        if (!venueValue || !venueValue.lat || !venueValue.lng) {
            setPopupPosition(null);
            return;
        }

        const pos = new window.kakao.maps.LatLng(venueValue.lat, venueValue.lng);
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

        syncPopup();

        return () => {
            window.kakao.maps.event.removeListener(mapInstance, 'drag', syncPopup);
            window.kakao.maps.event.removeListener(mapInstance, 'zoom_changed', syncPopup);
            window.kakao.maps.event.removeListener(mapInstance, 'bounds_changed', syncPopup);
        };
    }, [mapInstance, updatePopupPosition]);

    const [perfVisibleCount, setPerfVisibleCount] = useState(10);
    const selectedVenueData = selectedVenue ? allVenueGroups.current[selectedVenue] : null;

    useEffect(() => {
        if (selectedVenue) setPerfVisibleCount(10);
    }, [selectedVenue]);

    const handlePerfScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollTop + clientHeight >= scrollHeight - 20) {
            if (selectedVenueData && perfVisibleCount < selectedVenueData.performances.length) {
                setPerfVisibleCount(prev => prev + 10);
            }
        }
    };
    const handleZoomIn = () => {
        if (mapInstance) {
            mapInstance.setLevel(mapInstance.getLevel() - 1, { animate: true });
        }
    };

    const handleZoomOut = () => {
        if (mapInstance) {
            mapInstance.setLevel(mapInstance.getLevel() + 1, { animate: true });
        }
    };

    return (
        <Portal>
            <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                <div className="relative w-full h-full bg-white dark:bg-black overflow-hidden shadow-2xl flex flex-col">
                    {/* Controls */}
                    <div className="absolute top-4 right-4 z-[100] flex flex-col gap-2">
                        <button
                            onClick={onClose}
                            className="p-2 bg-white/80 dark:bg-black/50 text-gray-900 dark:text-white rounded-full hover:bg-white dark:hover:bg-black/70 transition shadow-md"
                            title="닫기"
                        >
                            <X className="w-6 h-6" />
                        </button>

                        <div className="flex flex-col bg-white/80 dark:bg-black/50 rounded-full shadow-md overflow-hidden">
                            <button
                                onClick={handleZoomIn}
                                className="p-2.5 text-gray-900 dark:text-white hover:bg-white dark:hover:bg-black/70 transition border-b border-gray-200 dark:border-gray-800"
                                title="확대"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                            <button
                                onClick={handleZoomOut}
                                className="p-2.5 text-gray-900 dark:text-white hover:bg-white dark:hover:bg-black/70 transition"
                                title="축소"
                            >
                                <Minus className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

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

                    <div className="absolute inset-0 pointer-events-none z-[110]">
                        {selectedVenue && selectedVenueData && popupPosition && (
                            <div
                                className="absolute pointer-events-auto flex flex-col items-center"
                                style={{
                                    left: popupPosition.x,
                                    top: popupPosition.y,
                                    transform: 'translate(-50%, -100%) translateY(-25px)',
                                    filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.5))'
                                }}
                            >
                                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 w-[280px] overflow-hidden flex flex-col shadow-2xl">
                                    <div className="bg-gray-50 dark:bg-gray-800 p-3 flex justify-between items-start border-b border-gray-100 dark:border-gray-800">
                                        <div className="min-w-0 flex-1">
                                            <h3 className="text-gray-900 dark:text-white font-bold text-base leading-tight truncate">{selectedVenue}</h3>
                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">{selectedVenueData.address}</p>
                                        </div>
                                        <button onClick={() => setSelectedVenue(null)} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white ml-2 shrink-0">
                                            <X size={16} />
                                        </button>
                                    </div>

                                    {selectedVenueData.type === 'cinema' && (
                                        <div className="bg-indigo-50 dark:bg-indigo-900/30 p-2 border-b border-indigo-100 dark:border-indigo-800">
                                            <a
                                                href={`https://search.naver.com/search.naver?query=${encodeURIComponent(selectedVenue)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-center gap-1.5 w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg transition-colors shadow-sm"
                                            >
                                                <RotateCw size={12} />
                                                실시간 상영시간표 확인하기
                                            </a>
                                        </div>
                                    )}

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
                                <div className="w-4 h-4 bg-white dark:bg-gray-900 border-r border-b border-gray-200 dark:border-gray-700 transform rotate-45 -mt-2 z-0 relative shadow-sm"></div>
                            </div>
                        )}
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 z-[90] bg-gradient-to-t from-white/95 dark:from-gray-900 via-white/80 dark:via-gray-900/80 to-transparent pt-16 pb-4 px-4 sm:px-6">
                        {visibleVenues.length > 0 && (
                            <div
                                id="venue-scroll-container"
                                ref={scrollRef}
                                className={`flex gap-3 overflow-x-auto pb-2 scrollbar-hide pointer-events-auto cursor-grab ${isDragging ? 'cursor-grabbing' : ''}`}
                                style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}
                                onMouseDown={onMouseDown}
                                onMouseLeave={onMouseLeave}
                                onMouseUp={onMouseUp}
                                onMouseMove={onMouseMove}
                            >
                                {visibleVenues.map((v: any) => {
                                    const isFavorite = favoriteVenues.includes(v.venueName);
                                    const isSelected = selectedVenue === v.venueName;

                                    let distanceLabel = '';
                                    if (centerLocation) {
                                        const dist = getDistanceFromLatLonInKm(centerLocation.lat, centerLocation.lng, v.lat, v.lng);
                                        distanceLabel = `${dist.toFixed(1)}km`;
                                    }

                                    const primaryGenre = v.performances[0]?.genre || selectedGenre || 'all';
                                    const style = (GENRE_STYLES as any)[primaryGenre] || (GENRE_STYLES as any)['all'];

                                    // Make sure cinema falls back to dark indigo just like markers
                                    const isCinemaObj = v.type === 'cinema';
                                    const bgClass = isCinemaObj ? 'bg-indigo-600' : style.twBg.replace('bg-', 'bg-');

                                    return (
                                        <button
                                            type="button"
                                            key={v.venueName}
                                            onClick={(e) => {
                                                if (isDragClicked.current) {
                                                    e.preventDefault();
                                                    return;
                                                }
                                                const newSelected = v.venueName === selectedVenue ? null : v.venueName;
                                                setSelectedVenue(newSelected);
                                                if (newSelected && mapInstance && v.lat && v.lng) {
                                                    const moveLatLon = new window.kakao.maps.LatLng(v.lat, v.lng);
                                                    if (mapInstance.getLevel() > 4) {
                                                        mapInstance.setLevel(4);
                                                        setTimeout(() => mapInstance.panTo(moveLatLon), 10);
                                                    } else {
                                                        mapInstance.panTo(moveLatLon);
                                                    }
                                                }
                                            }}
                                            className={clsx(
                                                "shrink-0 w-64 p-3 rounded-xl shadow-xl text-left flex flex-col gap-1 transition-all duration-300",
                                                isSelected
                                                    ? `${bgClass} text-white scale-[1.03] shadow-2xl`
                                                    : "bg-white/90 dark:bg-gray-800/90 backdrop-blur border border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 hover:scale-[1.01]"
                                            )}
                                        >
                                            <div className="flex justify-between items-start w-full">
                                                <h4 className={clsx("font-extrabold text-sm truncate flex-1", isSelected ? "text-white" : "text-gray-900 dark:text-white")}>
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
                                                            ? (isSelected ? "bg-white/20 hover:bg-white/30" : "hover:bg-pink-100 dark:hover:bg-pink-900/50")
                                                            : (isSelected ? "hover:bg-white/20 hover:text-white" : "hover:bg-gray-100 dark:hover:bg-gray-700")
                                                    )}
                                                >
                                                    <Heart className={clsx("w-4 h-4", isFavorite ? (isSelected ? 'text-white fill-white' : 'text-pink-500 fill-pink-500') : (isSelected ? 'text-white/60' : 'text-gray-400'))} />
                                                </button>
                                            </div>

                                            {distanceLabel && (
                                                <div className={clsx(
                                                    "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] w-fit font-bold mb-1",
                                                    isSelected
                                                        ? "bg-white/20 text-white"
                                                        : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                                                )}>
                                                    {distanceLabel}
                                                </div>
                                            )}
                                            <span className={clsx("text-[10px] truncate", isSelected ? "text-white/80" : "text-gray-500 dark:text-gray-400")}>{v.address}</span>
                                            <div className="mt-auto flex items-center justify-between text-xs">
                                                <span className={clsx("font-bold shrink-0", isSelected ? "text-white" : "text-emerald-600 dark:text-emerald-400")}>
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
