'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import venueData from '@/data/venues.json';
import { GENRES, GENRE_STYLES } from '@/lib/constants';
import { getOptimizedUrl, getDistanceFromLatLonInKm } from '@/lib/utils';
import { clsx } from 'clsx';
import { Performance } from '@/types';
import { X, Heart, RotateCw, Film, Plus, Minus, ExternalLink } from 'lucide-react';
import Portal from './ui/Portal';
import { SPORTS_GENRES } from '@/lib/constants';

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
    searchMode?: 'keyword' | 'location';
    searchText?: string;
}

export default function KakaoMapModal({
    performances,
    cinemas = [],
    onClose,
    centerLocation,
    favoriteVenues,
    onToggleFavorite,
    onVenueLocationChange,
    selectedGenre = 'all',
    searchMode = 'keyword',
    searchText = ''
}: KakaoMapModalProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const [mapInstance, setMapInstance] = useState<any>(null);
    const [selectedVenue, setSelectedVenue] = useState<string | null>(null);

    // Optimization States
    const [visibleVenues, setVisibleVenues] = useState<any[]>([]);
    const [showSearchHereBtn, setShowSearchHereBtn] = useState(false);
    const [isMapReady, setIsMapReady] = useState(false);
    const markersRef = useRef<any[]>([]);
    const mapOverlaysRef = useRef<any[]>([]);
    const lastRenderedVenuesKey = useRef<string>("");

    // Group performances by venue - Pre-calculation
    const allVenueGroups = useRef<Record<string, any>>({});
    const allVenuesList = useRef<any[]>([]);

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

    // --- 1. Data Memoization (Crucial for Performance) ---
    const processedData = useMemo(() => {
        const isMovieMode = selectedGenre === 'movie';
        const isAllMode = selectedGenre === 'all' || !selectedGenre;
        const groupsMap = new Map<string, any>();

        // 1. Process Performances
        if (!isMovieMode || isAllMode) {
            for (let i = 0; i < performances.length; i++) {
                const perf = performances[i];
                if (!isAllMode && perf.genre !== selectedGenre) continue;

                const vName = perf.venue;
                let group = groupsMap.get(vName);

                if (!group) {
                    const venueMeta = venues[vName];
                    group = {
                        ...venueMeta,
                        venueName: vName,
                        performances: [],
                        lat: venueMeta?.lat || 0,
                        lng: venueMeta?.lng || 0,
                        type: 'performance',
                        kakaoLatLng: null
                    };
                    groupsMap.set(vName, group);
                }
                group.performances.push(perf);
            }
        }

        // 2. Process Cinemas
        if (isMovieMode || isAllMode) {
            for (let i = 0; i < cinemas.length; i++) {
                const cinema = cinemas[i];
                if (!groupsMap.has(cinema.name)) {
                    groupsMap.set(cinema.name, {
                        venueName: cinema.name,
                        address: cinema.address,
                        lat: cinema.lat,
                        lng: cinema.lng,
                        brand: cinema.brand,
                        type: 'cinema',
                        performances: performances.slice(0, 10),
                        kakaoLatLng: null
                    });
                }
            }
        }

        const list = Array.from(groupsMap.values()).filter(v => v.lat && v.lng);

        // Sort by distance if center exists
        if (centerLocation && !isNaN(centerLocation.lat) && !isNaN(centerLocation.lng)) {
            const cLat = centerLocation.lat;
            const cLng = centerLocation.lng;
            list.sort((a, b) => {
                if (a.venueName === centerLocation.name) return -1;
                if (b.venueName === centerLocation.name) return 1;
                const distA = getDistanceFromLatLonInKm(cLat, cLng, a.lat, a.lng);
                const distB = getDistanceFromLatLonInKm(cLat, cLng, b.lat, b.lng);
                return distA - distB;
            });
        }

        return { groups: Object.fromEntries(groupsMap), list };
    }, [performances, cinemas, centerLocation, selectedGenre]);

    // Update refs immediately after memoization
    useEffect(() => {
        allVenueGroups.current = processedData.groups;
        allVenuesList.current = processedData.list;

        // Show more venues initially for specific categories to ensure immediate list appearance
        const initialCount = selectedGenre !== 'all' ? 200 : 20;
        setVisibleVenues(processedData.list.slice(0, initialCount));
    }, [processedData, selectedGenre]);

    const handleSearchHereInternal = useCallback((map: any) => {
        if (!map || !window.kakao?.maps?.LatLng) return;
        const bounds = map.getBounds();
        const visible = allVenuesList.current.filter(v => {
            if (!v.kakaoLatLng) v.kakaoLatLng = new window.kakao.maps.LatLng(v.lat, v.lng);
            return bounds.contain(v.kakaoLatLng);
        });
        setVisibleVenues(visible.slice(0, 200));
        setShowSearchHereBtn(false);
    }, []);

    const handleSearchHere = () => handleSearchHereInternal(mapInstance);
    const SEOUL_STATION = { lat: 37.554648, lng: 126.972559 };

    // --- 2. Map Instance Initialization (Once per mount) ---
    useEffect(() => {
        let checkInterval: any;
        let cancelled = false;

        const initializeMap = () => {
            if (!window.kakao?.maps?.load || !mapRef.current || cancelled) return;

            window.kakao.maps.load(() => {
                if (cancelled || !mapRef.current) return;
                const k = window.kakao.maps;
                if (!k.Map || !k.LatLng) return;

                // Determine initial center and level based on PRIORITY (no SDK calls yet)
                let initialCenter = SEOUL_STATION;
                let initialLevel = 8;
                let isUserLocation = false;

                if (centerLocation) {
                    initialCenter = { lat: centerLocation.lat, lng: centerLocation.lng };
                    initialLevel = 5;
                } else if (selectedGenre !== 'all' && allVenuesList.current.length > 0) {
                    const first = allVenuesList.current[0];
                    initialCenter = { lat: first.lat, lng: first.lng };
                    initialLevel = SPORTS_GENRES.includes(selectedGenre) ? 6 : 5;
                }

                const options = { center: new k.LatLng(initialCenter.lat, initialCenter.lng), level: initialLevel };
                const map = new k.Map(mapRef.current, options);

                // Cleanup and Setup
                mapOverlaysRef.current.forEach(o => o.setMap(null));
                mapOverlaysRef.current = [];
                setMapInstance(map);

                window.kakao.maps.event.addListener(map, 'dragend', () => setShowSearchHereBtn(true));
                window.kakao.maps.event.addListener(map, 'zoom_changed', () => setShowSearchHereBtn(true));

                setIsMapReady(true);
                setTimeout(() => { map.relayout(); }, 200);
            });
        };

        checkInterval = setInterval(() => {
            if (window.kakao?.maps) {
                clearInterval(checkInterval);
                initializeMap();
            }
        }, 100);

        return () => { cancelled = true; clearInterval(checkInterval); };
    }, []); // Empty dependency array = mount once

    // --- 3. Reactive Map Updates (Center/Bounds) ---
    useEffect(() => {
        if (!mapInstance || !isMapReady) return;
        const map = mapInstance;
        const k = window.kakao.maps;

        if (centerLocation) {
            const loc = new k.LatLng(centerLocation.lat, centerLocation.lng);
            map.panTo(loc);

            // Add search marker
            const content = `<div class="flex flex-col items-center pointer-events-none" style="transform: translateY(-100%); margin-top: 12px;">
                <div class="bg-red-500 text-white px-2.5 py-1 rounded-lg text-xs font-extrabold shadow-md mb-1 whitespace-nowrap border border-red-400 font-sans">
                    ${centerLocation.name || '검색 위치'}
                </div>
                <div class="w-4 h-4 bg-red-500 border-2 border-white rounded-full shadow-lg relative">
                    <div class="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-50"></div>
                </div>
            </div>`;
            const overlay = new k.CustomOverlay({ map, position: loc, content, zIndex: 100 });
            mapOverlaysRef.current.push(overlay);
        } else if (selectedGenre !== 'all' && allVenuesList.current.length > 0) {
            const first = allVenuesList.current[0];
            map.panTo(new k.LatLng(first.lat, first.lng));
            map.setLevel(SPORTS_GENRES.includes(selectedGenre) ? 6 : 5);
        }

        handleSearchHereInternal(map);
    }, [mapInstance, isMapReady, centerLocation, selectedGenre]); // Reactive updates only


    // Tracks whether auto-bounding has already been applied for this session/genre
    const hasBoundedOnce = useRef<string | null>(null);

    // 2. Re-render Markers when Data changes
    const clustererRef = useRef<any>(null);

    // --- 4. Marker & Clusterer Management (Consolidated) ---
    useEffect(() => {
        if (!mapInstance || !isMapReady) return;
        const k = window.kakao.maps;

        // Cleanup existing clusterer and markers
        if (clustererRef.current) {
            clustererRef.current.clear();
        }
        markersRef.current.forEach(m => {
            m.setMap(null);
            window.kakao.maps.event.removeListener(m, 'click');
        });
        markersRef.current = [];

        const clusterer = new k.MarkerClusterer({
            map: mapInstance,
            averageCenter: true,
            minLevel: 6,
            disableClickZoom: false,
            styles: [{
                width: '40px', height: '40px', background: 'rgba(16, 185, 129, 0.9)',
                borderRadius: '50%', color: '#fff', textAlign: 'center',
                fontWeight: 'bold', lineHeight: '40px', fontSize: '14px', border: '3px solid white', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            }]
        });
        clustererRef.current = clusterer;

        const venuesToProcess = allVenuesList.current;
        const markers: any[] = [];

        venuesToProcess.forEach(venue => {
            const isSelected = venue.venueName === selectedVenue;
            const primaryGenre = venue.performances[0]?.genre || selectedGenre || 'all';
            const style = (GENRE_STYLES as any)[primaryGenre] || (GENRE_STYLES as any)['all'];
            const color = venue.type === 'cinema' ? '#4f46e5' : style.color;
            const text = venue.performances.length.toString();

            const size = isSelected ? 44 : 36;
            const r = isSelected ? 20 : 16;
            const center = size / 2;
            const strokeColor = isSelected ? '#ef4444' : 'white';
            const strokeWidth = isSelected ? 3 : 2;

            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                <circle cx="${center}" cy="${center}" r="${r}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
                <text x="${center}" y="${center + 1}" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="${isSelected ? 14 : 12}" font-family="Pretendard, sans-serif" font-weight="900">${text}</text>
            </svg>`;
            const iconUrl = `data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(svg)))}`;

            const markerImage = new k.MarkerImage(iconUrl, new k.Size(size, size), new k.Point(center, center));
            const marker = new k.Marker({
                position: new k.LatLng(venue.lat, venue.lng),
                image: markerImage,
                zIndex: isSelected ? 100 : 10
            });

            k.event.addListener(marker, 'click', () => {
                setSelectedVenue(venue.venueName);
                mapInstance.panTo(new k.LatLng(venue.lat, venue.lng));
            });

            (marker as any)._venueName = venue.venueName;
            markers.push(marker);
            markersRef.current.push(marker);
        });

        clusterer.addMarkers(markers);
    }, [mapInstance, isMapReady, processedData, selectedVenue]);


    // --- 5. Search Auto-bounding ---
    useEffect(() => {
        if (!mapInstance || !isMapReady || !searchText) return;

        const k = window.kakao.maps;
        const bounds = new k.LatLngBounds();
        let hasValidCoords = false;

        allVenuesList.current.forEach(v => {
            if (v.lat && v.lng) {
                bounds.extend(new k.LatLng(v.lat, v.lng));
                hasValidCoords = true;
            }
        });

        if (hasValidCoords) {
            setTimeout(() => {
                if (allVenuesList.current.length === 1) {
                    mapInstance.setCenter(new k.LatLng(allVenuesList.current[0].lat, allVenuesList.current[0].lng));
                    mapInstance.setLevel(4);
                } else {
                    mapInstance.setBounds(bounds, 120, 50, 150, 50);
                }
            }, 100);
        }
    }, [mapInstance, isMapReady, searchText]);


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

        if (!window.kakao?.maps?.LatLng) return;
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

    const [perfVisibleCount, setPerfVisibleCount] = useState(30);
    const selectedVenueData = selectedVenue ? allVenueGroups.current[selectedVenue] : null;

    useEffect(() => {
        if (selectedVenue) setPerfVisibleCount(30);
    }, [selectedVenue]);

    const handlePerfScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollTop + clientHeight >= scrollHeight - 50) { // More aggressive trigger
            if (selectedVenueData && perfVisibleCount < selectedVenueData.performances.length) {
                setPerfVisibleCount(prev => prev + 20); // Larger increment
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

                                    {/* Action Button: cinema → 실시간 상영시간표, non-cinema → 공연 더보기 */}
                                    {selectedVenueData.type === 'cinema' ? (
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
                                    ) : selectedVenueData.lat && selectedVenueData.lng && onVenueLocationChange ? (
                                        <div className="bg-indigo-50 dark:bg-indigo-900/30 p-2 border-b border-indigo-100 dark:border-indigo-800">
                                            <button
                                                onClick={() => {
                                                    onVenueLocationChange(selectedVenue, selectedVenueData.lat, selectedVenueData.lng);
                                                }}
                                                className="flex items-center justify-center gap-1.5 w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg transition-colors shadow-sm"
                                            >
                                                <ExternalLink size={12} />
                                                {SPORTS_GENRES.includes(selectedGenre) ? '경기 더보기' : '공연 더보기'} · {selectedVenueData.performances?.length || 0}개 컨텐츠
                                            </button>
                                        </div>
                                    ) : null}

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
                                    const hasCenter = centerLocation && !isNaN(centerLocation.lat) && !isNaN(centerLocation.lng);
                                    const hasVenueCoords = v.lat && v.lng && !isNaN(v.lat) && !isNaN(v.lng);

                                    if (hasCenter && hasVenueCoords) {
                                        const dist = getDistanceFromLatLonInKm(centerLocation!.lat, centerLocation!.lng, v.lat, v.lng);
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
                                                    const k = window.kakao.maps;
                                                    if (typeof k.LatLng === 'function') {
                                                        const moveLatLon = new k.LatLng(v.lat, v.lng);
                                                        if (mapInstance.getLevel() > 4) {
                                                            mapInstance.setLevel(4);
                                                            setTimeout(() => mapInstance.panTo(moveLatLon), 10);
                                                        } else {
                                                            mapInstance.panTo(moveLatLon);
                                                        }
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
