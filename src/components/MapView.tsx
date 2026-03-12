'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import venueData from '@/data/venues.json';
import { GENRES, GENRE_STYLES, SPORTS_GENRES } from '@/lib/constants';
import { getOptimizedUrl, getDistanceFromLatLonInKm } from '@/lib/utils';
import { clsx } from 'clsx';
import { Performance } from '@/types';
import { X, Heart, RotateCw, Plus, Minus, ExternalLink, Locate, Filter, CheckCircle2, Circle } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { usePerformanceData } from '@/hooks/usePerformanceData';
import { filterPerformances } from '@/lib/performance-filter';
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

interface MapViewProps {
    initialPerformances: Performance[];
    initialCinemas?: Cinema[];
}

export default function MapView({ initialPerformances, initialCinemas = [] }: MapViewProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Self-contained state from URL params
    const selectedGenre = searchParams.get('genre') || 'all';
    const searchMode = (searchParams.get('mode') as 'keyword' | 'location') || 'keyword';
    const searchText = searchParams.get('q') || '';
    const paramLat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : null;
    const paramLng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : null;
    const centerName = searchParams.get('venue') || '';

    // Default center: try user's GPS first, fall back to Seoul Station
    const SEOUL_STATION = useMemo(() => ({ lat: 37.554648, lng: 126.972559 }), []);
    const [geoCenter, setGeoCenter] = useState<{ lat: number; lng: number; name: string } | null>(null);
    const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
    const [selectedMapGenres, setSelectedMapGenres] = useState<string[]>([]);

    // Sync selectedMapGenres with URL on initial load only? No, user said "비연동" (independent).
    // But let's start with all if genre=all, or just the URL genre if specified.
    useEffect(() => {
        if (selectedGenre === 'all') {
            setSelectedMapGenres([]); // Empty means "all" in our filter logic, or we can list all.
        } else {
            setSelectedMapGenres([selectedGenre]);
        }
    }, [selectedGenre]);

    const toggleMapGenre = (genreId: string) => {
        setSelectedMapGenres(prev => {
            if (prev.includes(genreId)) {
                return prev.filter(g => g !== genreId);
            } else {
                return [...prev, genreId];
            }
        });
    };

    const isGenreSelected = (genreId: string) => {
        if (selectedMapGenres.length === 0) return true; // Default all when nothing selected
        return selectedMapGenres.includes(genreId);
    };

    const geoAttempted = useRef(false);

    // Request geolocation on mount (only if no explicit lat/lng in URL)
    useEffect(() => {
        if (geoAttempted.current || paramLat) return;
        geoAttempted.current = true;

        if (!navigator.geolocation) {
            setGeoCenter({ ...SEOUL_STATION, name: '서울역' });
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setGeoCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude, name: '내 위치' });
            },
            () => {
                setGeoCenter({ ...SEOUL_STATION, name: '서울역' });
            },
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }
        );
    }, [paramLat, SEOUL_STATION]);

    // Resolve center: URL params > GPS > Seoul Station
    const centerLocation = useMemo(() => {
        if (paramLat && paramLng) {
            return { lat: paramLat, lng: paramLng, name: centerName };
        }
        if (geoCenter) return geoCenter;
        // Fallback while waiting for geo response
        return { ...SEOUL_STATION, name: '서울역' };
    }, [paramLat, paramLng, centerName, geoCenter, SEOUL_STATION]);

    // Load full data client-side
    const { allPerformances, cinemas: clientCinemas } = usePerformanceData({ initialPerformances });
    const cinemas = clientCinemas.length > 0 ? clientCinemas : initialCinemas;

    // Self-contained user preferences
    const { favoriteVenues, toggleFavoriteVenue } = useUserPreferences();

    // Filter performances based on URL params
    const performances = useMemo(() => {
        return filterPerformances(allPerformances, {
            genre: 'all', // We handle manual filtering below
            search: searchMode === 'keyword' ? searchText : '',
            searchMode,
            lat: centerLocation?.lat || undefined,
            lng: centerLocation?.lng || undefined,
            radius: 10
        }).filter(p => {
            if (selectedMapGenres.length === 0) return true;
            return selectedMapGenres.includes(p.genre);
        });
    }, [allPerformances, selectedGenre, searchMode, searchText, centerLocation]);

    // === Map State ===
    const mapRef = useRef<HTMLDivElement>(null);
    const [mapInstance, setMapInstance] = useState<any>(null);
    const [selectedVenue, setSelectedVenue] = useState<string | null>(null);
    const [visibleVenues, setVisibleVenues] = useState<any[]>([]);
    const [showSearchHereBtn, setShowSearchHereBtn] = useState(false);
    const [isMapReady, setIsMapReady] = useState(false);
    const markersRef = useRef<any[]>([]);
    const mapOverlaysRef = useRef<any[]>([]);
    const popupOverlayRef = useRef<any>(null);

    const allVenueGroups = useRef<Record<string, any>>({});
    const allVenuesList = useRef<any[]>([]);

    // Drag scroll for venue list
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
        if (Math.abs(walk) > 10) isDragClicked.current = true;
        scrollRef.current.scrollLeft = scrollLeft - walk;
    };

    // --- Data Processing ---
    const processedData = useMemo(() => {
        const isMovieMode = selectedGenre === 'movie';
        const isAllMode = selectedGenre === 'all' || !selectedGenre;
        const groupsMap = new Map<string, any>();

        if (!isMovieMode || isAllMode) {
            for (let i = 0; i < performances.length; i++) {
                const perf = performances[i];
                if (!isAllMode && perf.genre !== selectedGenre) continue;
                const vName = perf.venue;
                const venueMeta = venues[vName];
                if (vName.includes('투어패스') && venueMeta?.lat && venueMeta?.lng && venueMeta.lat > 37.4 && venueMeta.lng > 130.8) continue;

                let group = groupsMap.get(vName);
                if (!group) {
                    group = {
                        ...venueMeta, venueName: vName, performances: [],
                        lat: venueMeta?.lat || 0, lng: venueMeta?.lng || 0,
                        type: 'performance', kakaoLatLng: null, firstAppearanceIndex: i
                    };
                    groupsMap.set(vName, group);
                }
                group.performances.push(perf);
            }
        }

        if (isMovieMode || isAllMode) {
            const moviePerformances = performances.filter(p => p.genre === 'movie');
            const topMovies = moviePerformances.slice(0, 10);

            for (let i = 0; i < cinemas.length; i++) {
                const cinema = cinemas[i] as Cinema;
                if (!groupsMap.has(cinema.name)) {
                    groupsMap.set(cinema.name, {
                        venueName: cinema.name, address: cinema.address,
                        lat: cinema.lat, lng: cinema.lng, brand: (cinema as any).brand,
                        type: 'cinema', performances: topMovies,
                        kakaoLatLng: null, firstAppearanceIndex: i
                    });
                }
            }
        }

        let list = Array.from(groupsMap.values()).filter(v => v.lat && v.lng);
        list.sort((a, b) => (a.firstAppearanceIndex ?? 99999) - (b.firstAppearanceIndex ?? 99999));

        if (centerLocation && !isNaN(centerLocation.lat) && !isNaN(centerLocation.lng)) {
            const cLat = centerLocation.lat;
            const cLng = centerLocation.lng;
            list.sort((a, b) => {
                if (a.venueName === centerLocation.name) return -1;
                if (b.venueName === centerLocation.name) return 1;
                return getDistanceFromLatLonInKm(cLat, cLng, a.lat, a.lng) - getDistanceFromLatLonInKm(cLat, cLng, b.lat, b.lng);
            });
        }

        return { groups: Object.fromEntries(groupsMap), list };
    }, [performances, cinemas, centerLocation, selectedGenre]);

    useEffect(() => {
        allVenueGroups.current = processedData.groups;
        allVenuesList.current = processedData.list;
        const initialCount = selectedGenre !== 'all' ? 200 : 20;
        setVisibleVenues(processedData.list.slice(0, initialCount));
    }, [processedData, selectedGenre]);

    const handleSearchHereInternal = useCallback((map: any, isUserClick = false) => {
        if (!map || !window.kakao?.maps?.LatLng) return;
        const bounds = map.getBounds();
        const center = map.getCenter();
        const isMovieMode = selectedGenre === 'movie';

        let visible = allVenuesList.current.filter(v => {
            if (!v.kakaoLatLng) v.kakaoLatLng = new window.kakao.maps.LatLng(v.lat, v.lng);
            if (isMovieMode) return true;
            return bounds.contain(v.kakaoLatLng);
        });

        if (isMovieMode && center) {
            visible.sort((a, b) => getDistanceFromLatLonInKm(center.getLat(), center.getLng(), a.lat, a.lng) - getDistanceFromLatLonInKm(center.getLat(), center.getLng(), b.lat, b.lng));
        }

        setVisibleVenues(visible.slice(0, isMovieMode ? 50 : 200));
        // Keep the search button visible after search (user may want to search again)
    }, [selectedGenre]);

    const handleSearchHere = () => handleSearchHereInternal(mapInstance, true);

    // SEOUL_STATION is defined above at component level

    // --- Map Init ---
    useEffect(() => {
        let checkInterval: any;
        let cancelled = false;

        const initializeMap = () => {
            if (!window.kakao?.maps?.load || !mapRef.current || cancelled) return;
            window.kakao.maps.load(() => {
                if (cancelled || !mapRef.current) return;
                const k = window.kakao.maps;
                if (!k.Map || !k.LatLng) return;

                let initialCenter = SEOUL_STATION;
                let initialLevel = 8;

                if (centerLocation) {
                    initialCenter = { lat: centerLocation.lat, lng: centerLocation.lng };
                    initialLevel = selectedGenre === 'movie' ? 6 : 5;
                } else if (allVenuesList.current.length > 0) {
                    const first = allVenuesList.current[0];
                    initialCenter = { lat: first.lat, lng: first.lng };
                    initialLevel = SPORTS_GENRES.includes(selectedGenre) ? 6 : 5;
                }

                const options = { center: new k.LatLng(initialCenter.lat, initialCenter.lng), level: initialLevel };
                const map = new k.Map(mapRef.current, options);

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
            if (window.kakao?.maps) { clearInterval(checkInterval); initializeMap(); }
        }, 100);

        return () => { cancelled = true; clearInterval(checkInterval); };
    }, []);

    // --- Reactive Map Updates ---
    useEffect(() => {
        if (!mapInstance || !isMapReady) return;
        const map = mapInstance;
        const k = window.kakao.maps;

        mapOverlaysRef.current.forEach(o => o.setMap(null));
        mapOverlaysRef.current = [];

        if (centerLocation) {
            const loc = new k.LatLng(centerLocation.lat, centerLocation.lng);
            map.panTo(loc);

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

            handleSearchHereInternal(map);
        } else if (allVenuesList.current.length > 0) {
            const first = allVenuesList.current[0];
            map.panTo(new k.LatLng(first.lat, first.lng));
            map.setLevel(SPORTS_GENRES.includes(selectedGenre) ? 6 : 5);
            setSelectedVenue(first.venueName);
        }
    }, [mapInstance, isMapReady, centerLocation, selectedGenre]);

    // --- Markers & Clusterer ---
    const clustererRef = useRef<any>(null);
    const iconCache = useRef<Record<string, string>>({});

    const getMarkerIcon = useCallback((text: string, color: string, isSelected: boolean) => {
        const size = isSelected ? 44 : 36;
        const r = isSelected ? 20 : 16;
        const key = `${text}-${color}-${isSelected}`;
        if (iconCache.current[key]) return iconCache.current[key];

        const center = size / 2;
        const strokeColor = isSelected ? '#ef4444' : 'white';
        const strokeWidth = isSelected ? 3 : 2;

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            <circle cx="${center}" cy="${center}" r="${r}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
            <text x="${center}" y="${center + 1}" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="${isSelected ? 14 : 12}" font-family="Pretendard, sans-serif" font-weight="900">${text}</text>
        </svg>`;
        const iconUrl = `data:image/svg+xml;base64,${window.btoa(unescape(encodeURIComponent(svg)))}`;
        iconCache.current[key] = iconUrl;
        return iconUrl;
    }, []);

    useEffect(() => {
        if (!mapInstance || !isMapReady) return;
        const k = window.kakao.maps;

        if (clustererRef.current) clustererRef.current.clear();
        markersRef.current.forEach(m => { m.setMap(null); k.event.removeListener(m, 'click'); });
        markersRef.current = [];

        const clusterer = new k.MarkerClusterer({
            map: mapInstance, averageCenter: true, minLevel: 6, disableClickZoom: false,
            styles: [{
                width: '40px', height: '40px', background: 'rgba(16, 185, 129, 0.9)',
                borderRadius: '12px', color: '#fff', textAlign: 'center',
                fontWeight: 'bold', lineHeight: '34px', fontSize: '14px',
                border: '3px solid white', boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            }]
        });
        clustererRef.current = clusterer;

        const markers: any[] = [];
        allVenuesList.current.forEach(venue => {
            const primaryGenre = venue.performances[0]?.genre || selectedGenre || 'all';
            const style = (GENRE_STYLES as any)[primaryGenre] || (GENRE_STYLES as any)['all'];
            const color = venue.type === 'cinema' ? '#4f46e5' : (style.hex || '#4b5563');
            const text = venue.performances.length.toString();
            const isSelected = venue.venueName === selectedVenue;

            const iconUrl = getMarkerIcon(text, color, isSelected);
            const size = isSelected ? 44 : 36;
            const markerImage = new k.MarkerImage(iconUrl, new k.Size(size, size), new k.Point(size / 2, size / 2));

            const marker = new k.Marker({
                position: new k.LatLng(venue.lat, venue.lng), image: markerImage,
                zIndex: isSelected ? 100 : 10
            });

            k.event.addListener(marker, 'click', () => {
                setSelectedVenue(venue.venueName);
                mapInstance.panTo(new k.LatLng(venue.lat, venue.lng));
            });

            (marker as any)._venueName = venue.venueName;
            (marker as any)._color = color;
            (marker as any)._text = text;
            markers.push(marker);
            markersRef.current.push(marker);
        });

        clusterer.addMarkers(markers);
    }, [mapInstance, isMapReady, processedData]);

    // Selection update
    useEffect(() => {
        if (!mapInstance || !isMapReady) return;
        const k = window.kakao.maps;
        markersRef.current.forEach(marker => {
            const vName = marker._venueName;
            const isSelected = vName === selectedVenue;
            const wasSelected = marker.getZIndex() === 100;
            if (isSelected || wasSelected) {
                const iconUrl = getMarkerIcon(marker._text, marker._color, isSelected);
                const size = isSelected ? 44 : 36;
                const markerImage = new k.MarkerImage(iconUrl, new k.Size(size, size), new k.Point(size / 2, size / 2));
                marker.setImage(markerImage);
                marker.setZIndex(isSelected ? 100 : 10);
            }
        });
    }, [selectedVenue]);

    // Search auto-bounding
    useEffect(() => {
        if (!mapInstance || !isMapReady || !searchText) return;
        const k = window.kakao.maps;
        const bounds = new k.LatLngBounds();
        let hasValidCoords = false;
        allVenuesList.current.forEach(v => {
            if (v.lat && v.lng) { bounds.extend(new k.LatLng(v.lat, v.lng)); hasValidCoords = true; }
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

    // Popup management
    const [popupContainerRef, setPopupContainerRef] = useState<HTMLDivElement | null>(null);
    const [perfVisibleCount, setPerfVisibleCount] = useState(30);
    const selectedVenueData = selectedVenue ? allVenueGroups.current[selectedVenue] : null;

    useEffect(() => {
        if (!mapInstance || !isMapReady) return;
        const k = window.kakao.maps;

        if (popupOverlayRef.current) { popupOverlayRef.current.setMap(null); popupOverlayRef.current = null; }
        if (!selectedVenue) return;

        const venueValue = allVenueGroups.current[selectedVenue];
        if (!venueValue || !venueValue.lat || !venueValue.lng) return;

        const container = document.createElement('div');
        container.style.pointerEvents = 'auto';

        const overlay = new k.CustomOverlay({
            position: new k.LatLng(venueValue.lat, venueValue.lng),
            content: container, yAnchor: 0, xAnchor: 0, zIndex: 1000, clickable: true
        });

        overlay.setMap(mapInstance);
        popupOverlayRef.current = overlay;
        setPopupContainerRef(container);

        return () => {
            if (popupOverlayRef.current) { popupOverlayRef.current.setMap(null); popupOverlayRef.current = null; }
        };
    }, [mapInstance, isMapReady, selectedVenue]);

    useEffect(() => { if (selectedVenue) setPerfVisibleCount(30); }, [selectedVenue]);

    const handlePerfScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollTop + clientHeight >= scrollHeight - 50) {
            if (selectedVenueData && perfVisibleCount < selectedVenueData.performances.length) {
                setPerfVisibleCount(prev => prev + 20);
            }
        }
    };

    const handleZoomIn = () => { if (mapInstance) mapInstance.setLevel(mapInstance.getLevel() - 1, { animate: true }); };
    const handleZoomOut = () => { if (mapInstance) mapInstance.setLevel(mapInstance.getLevel() + 1, { animate: true }); };

    const handleClose = () => {
        if (window.history.length > 1) router.back();
        else router.push('/');
    };

    // My Location
    const [isLocating, setIsLocating] = useState(false);
    const myLocationOverlayRef = useRef<any>(null);

    const handleMyLocation = useCallback(() => {
        if (!mapInstance || !isMapReady) return;
        if (!navigator.geolocation) { alert('이 브라우저에서는 위치 서비스를 지원하지 않습니다.'); return; }

        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                const k = window.kakao.maps;
                const loc = new k.LatLng(latitude, longitude);

                // Use setCenter + setLevel (no animation) to avoid panTo conflict
                mapInstance.setCenter(loc);
                mapInstance.setLevel(4);

                // Remove previous my-location overlay
                if (myLocationOverlayRef.current) { myLocationOverlayRef.current.setMap(null); }

                const content = `<div class="flex flex-col items-center pointer-events-none" style="transform: translateY(-50%);">
                    <div class="bg-blue-500 text-white px-2 py-0.5 rounded-lg text-[10px] font-extrabold shadow-md mb-1 whitespace-nowrap border border-blue-400 font-sans">내 위치</div>
                    <div class="w-4 h-4 bg-blue-500 border-2 border-white rounded-full shadow-lg relative">
                        <div class="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-50"></div>
                    </div>
                </div>`;
                const overlay = new k.CustomOverlay({ map: mapInstance, position: loc, content, zIndex: 99 });
                myLocationOverlayRef.current = overlay;
                mapOverlaysRef.current.push(overlay);

                // Sort venues by distance from my location
                const sorted = [...allVenuesList.current].sort((a, b) =>
                    getDistanceFromLatLonInKm(latitude, longitude, a.lat, a.lng) - getDistanceFromLatLonInKm(latitude, longitude, b.lat, b.lng)
                );
                setVisibleVenues(sorted.slice(0, selectedGenre === 'movie' ? 50 : 200));
                setShowSearchHereBtn(false);
                setIsLocating(false);
            },
            (err) => {
                setIsLocating(false);
                alert('위치를 가져올 수 없습니다. 위치 권한을 확인해주세요.');
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }, [mapInstance, isMapReady, selectedGenre]);

    return (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="relative w-full h-full bg-white dark:bg-black overflow-hidden shadow-2xl flex flex-col">
                {/* Controls */}
                <div className="absolute top-4 right-4 z-[100] flex flex-col gap-2">
                    <button onClick={handleClose}
                        className="p-2 bg-white/80 dark:bg-black/50 text-gray-900 dark:text-white rounded-full hover:bg-white dark:hover:bg-black/70 transition shadow-md" title="닫기">
                        <X className="w-6 h-6" />
                    </button>
                    <div className="flex flex-col bg-white/80 dark:bg-black/50 rounded-full shadow-md overflow-hidden">
                        <button onClick={handleZoomIn}
                            className="p-2.5 text-gray-900 dark:text-white hover:bg-white dark:hover:bg-black/70 transition border-b border-gray-200 dark:border-gray-800" title="확대">
                            <Plus className="w-5 h-5" />
                        </button>
                        <button onClick={handleZoomOut}
                            className="p-2.5 text-gray-900 dark:text-white hover:bg-white dark:hover:bg-black/70 transition" title="축소">
                            <Minus className="w-5 h-5" />
                        </button>
                    </div>
                    {/* My Location Button - inverted colors */}
                    <button onClick={handleMyLocation} disabled={isLocating}
                        className={clsx("p-2.5 rounded-full shadow-md transition",
                            isLocating
                                ? "bg-blue-500 text-white animate-pulse"
                                : "bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-black dark:hover:bg-gray-100"
                        )} title="내 위치">
                        <Locate className="w-5 h-5" />
                    </button>
                </div>

                {showSearchHereBtn && isMapReady && (
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-[100]">
                        <button onClick={handleSearchHere}
                            className="px-4 py-2 bg-blue-600 text-white rounded-full font-bold shadow-lg hover:bg-blue-700 transition flex items-center gap-2 text-sm animate-fade-in-up">
                            <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                            현 위치에서 검색
                        </button>
                    </div>
                )}



                <div ref={mapRef} className="w-full h-full bg-gray-200 dark:bg-gray-800" />

                {/* Left Controls: Category Filter */}
                <div className="absolute top-4 left-4 z-[110] flex flex-col gap-2">
                    <div className="relative">
                        <button
                            onClick={() => setIsCategoryMenuOpen(!isCategoryMenuOpen)}
                            className={clsx(
                                "flex items-center gap-2 px-4 py-2 bg-white/80 dark:bg-black/50 text-gray-900 dark:text-white rounded-full hover:bg-white dark:hover:bg-black/70 transition shadow-md border border-gray-200 dark:border-gray-800 font-bold text-sm",
                                isCategoryMenuOpen && "ring-2 ring-blue-500"
                            )}
                        >
                            <Filter className="w-4 h-4" />
                            카테고리
                            {selectedMapGenres.length > 0 && (
                                <span className="flex items-center justify-center w-5 h-5 bg-blue-600 text-white text-[10px] rounded-full">
                                    {selectedMapGenres.length}
                                </span>
                            )}
                        </button>

                        {isCategoryMenuOpen && (
                            <div className="absolute top-full left-0 mt-2 w-56 max-h-[70vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 p-2 animate-fade-in-down pointer-events-auto custom-scrollbar">
                                <div className="space-y-1">
                                    {GENRES.filter(g => g.id !== 'all').map(genre => {
                                        const isSel = selectedMapGenres.includes(genre.id);
                                        const style = (GENRE_STYLES as any)[genre.id] || (GENRE_STYLES as any)['all'];
                                        return (
                                            <button
                                                key={genre.id}
                                                onClick={() => toggleMapGenre(genre.id)}
                                                className={clsx(
                                                    "flex items-center justify-between w-full px-3 py-2.5 rounded-xl transition-all text-sm group",
                                                    isSel ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={clsx("transition-transform group-active:scale-90", isSel ? "text-blue-600" : "text-gray-300 dark:text-gray-600")}>
                                                        {isSel ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                                                    </div>
                                                    <span>{genre.label}</span>
                                                </div>
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: style.hex }} />
                                            </button>
                                        );
                                    })}
                                </div>
                                {selectedMapGenres.length > 0 && (
                                    <button
                                        onClick={() => setSelectedMapGenres([])}
                                        className="w-full mt-2 py-2 text-[11px] text-gray-500 hover:text-blue-600 font-bold border-t border-gray-50 dark:border-gray-800 transition-colors"
                                    >
                                        필터 초기화
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Selected Tags Below Button */}
                    {selectedMapGenres.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 max-w-[200px] animate-fade-in">
                            {selectedMapGenres.map(gid => {
                                const genre = GENRES.find(g => g.id === gid);
                                const style = (GENRE_STYLES as any)[gid] || (GENRE_STYLES as any)['all'];
                                return (
                                    <div
                                        key={gid}
                                        className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/90 dark:bg-gray-800/90 shadow-sm border border-gray-100 dark:border-gray-700 pointer-events-auto"
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: style.hex }} />
                                        <span className="text-[10px] font-bold text-gray-700 dark:text-gray-300">
                                            {genre?.label || gid}
                                        </span>
                                        <button
                                            onClick={() => toggleMapGenre(gid)}
                                            className="ml-0.5 text-gray-400 hover:text-red-500"
                                        >
                                            <X className="w-2.5 h-2.5" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="absolute inset-0 pointer-events-none z-[110]">
                    {selectedVenue && selectedVenueData && popupContainerRef && (
                        <Portal customContainer={popupContainerRef}>
                            <div className="flex flex-col items-center" style={{
                                filter: 'drop-shadow(0 10px 15px rgba(0,0,0,0.5))',
                                position: 'absolute',
                                bottom: '26px', /* 26px clears the marker top edge */
                                transform: 'translateX(-50%)' /* Center horizontally exactly over marker */
                            }}>
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

                                    {selectedVenueData.type === 'cinema' ? (
                                        <div className="bg-indigo-50 dark:bg-indigo-900/30 p-2 border-b border-indigo-100 dark:border-indigo-800">
                                            <a href={`https://search.naver.com/search.naver?query=${encodeURIComponent(selectedVenue)}`}
                                                target="_blank" rel="noopener noreferrer"
                                                className="flex items-center justify-center gap-1.5 w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg transition-colors shadow-sm">
                                                <RotateCw size={12} /> 실시간 상영시간표 확인하기
                                            </a>
                                        </div>
                                    ) : selectedVenueData.lat && selectedVenueData.lng ? (
                                        <div className="bg-indigo-50 dark:bg-indigo-900/30 p-2 border-b border-indigo-100 dark:border-indigo-800">
                                            <button
                                                onClick={() => {
                                                    const params = new URLSearchParams();
                                                    params.set('mode', 'location');
                                                    params.set('lat', String(selectedVenueData.lat));
                                                    params.set('lng', String(selectedVenueData.lng));
                                                    params.set('venue', selectedVenue);

                                                    const basePath = (selectedGenre && selectedGenre !== 'all') ? `/${selectedGenre}` : '/';
                                                    router.push(`${basePath}?${params.toString()}`);
                                                }}
                                                className="flex items-center justify-center gap-1.5 w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg transition-colors shadow-sm">
                                                <ExternalLink size={12} />
                                                {SPORTS_GENRES.includes(selectedGenre) ? '경기 더보기' : '공연 더보기'} · {selectedVenueData.performances?.length || 0}개 컨텐츠
                                            </button>
                                        </div>
                                    ) : null}

                                    <div className="max-h-[240px] overflow-y-auto custom-scrollbar bg-white dark:bg-gray-900 p-2 space-y-2" onScroll={handlePerfScroll}>
                                        {selectedVenueData.performances.slice(0, perfVisibleCount).map((p: any) => (
                                            <a key={p.id} href={p.link} target="_blank" rel="noopener noreferrer"
                                                className="flex gap-2 bg-gray-50 dark:bg-gray-800/50 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition border border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-600 group">
                                                {p.image ? (
                                                    <img src={getOptimizedUrl(p.image, 80)} alt={p.title} className="w-10 h-14 object-cover rounded bg-gray-200 dark:bg-gray-950 shrink-0" />
                                                ) : (
                                                    <div className="w-10 h-14 bg-gray-200 dark:bg-gray-800 rounded flex items-center justify-center shrink-0">
                                                        <Heart size={10} className="text-gray-400 dark:text-gray-600" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 mb-0.5">
                                                        <span className={clsx("px-1 py-[1px] rounded-[3px] text-[9px] font-extrabold text-white leading-none", (GENRE_STYLES as any)[p.genre]?.twBg || 'bg-gray-600')}>
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
                        </Portal>
                    )}
                </div>

                <div className="absolute bottom-0 left-0 right-0 z-[90] bg-gradient-to-t from-white/95 dark:from-gray-900 via-white/80 dark:via-gray-900/80 to-transparent pt-16 pb-4 px-4 sm:px-6">
                    {visibleVenues.length > 0 && (
                        <div id="venue-scroll-container" ref={scrollRef}
                            className={`flex gap-3 overflow-x-auto pb-2 scrollbar-hide pointer-events-auto cursor-grab ${isDragging ? 'cursor-grabbing' : ''}`}
                            style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}
                            onMouseDown={onMouseDown} onMouseLeave={onMouseLeave} onMouseUp={onMouseUp} onMouseMove={onMouseMove}>
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
                                const isCinemaObj = v.type === 'cinema';
                                const bgClass = isCinemaObj ? 'bg-indigo-600' : style.twBg.replace('bg-', 'bg-');

                                return (
                                    <button type="button" key={v.venueName}
                                        onClick={(e) => {
                                            if (isDragClicked.current) { e.preventDefault(); return; }
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
                                        )}>
                                        <div className="flex justify-between items-start w-full">
                                            <h4 className={clsx("font-extrabold text-sm truncate flex-1", isSelected ? "text-white" : "text-gray-900 dark:text-white")}>{v.venueName}</h4>
                                            <button onClick={(e) => { e.stopPropagation(); toggleFavoriteVenue(v.venueName); }}
                                                className={clsx("ml-2 p-1 rounded-full transition-colors",
                                                    isFavorite ? (isSelected ? "bg-white/20 hover:bg-white/30" : "hover:bg-pink-100 dark:hover:bg-pink-900/50")
                                                        : (isSelected ? "hover:bg-white/20 hover:text-white" : "hover:bg-gray-100 dark:hover:bg-gray-700"))}>
                                                <Heart className={clsx("w-4 h-4", isFavorite ? (isSelected ? 'text-white fill-white' : 'text-pink-500 fill-pink-500') : (isSelected ? 'text-white/60' : 'text-gray-400'))} />
                                            </button>
                                        </div>
                                        {distanceLabel && (
                                            <div className={clsx("inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] w-fit font-bold mb-1",
                                                isSelected ? "bg-white/20 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400")}>
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
                    {visibleVenues.length === 0 && isMapReady && (
                        <div className="flex items-center justify-center py-6 pointer-events-auto">
                            <span className="text-sm text-gray-500 dark:text-gray-400 font-medium bg-white/80 dark:bg-gray-800/80 backdrop-blur px-4 py-2 rounded-full shadow">
                                주변 공연장이 없습니다.
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
