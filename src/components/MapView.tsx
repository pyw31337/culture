'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import venueData from '@/data/venues.json';
import { GENRES, GENRE_STYLES, SPORTS_GENRES } from '@/lib/constants';
import { getDistanceFromLatLonInKm } from '@/lib/utils';
import { clsx } from 'clsx';
import { Performance } from '@/types';
import { X, Heart, RotateCw, Plus, Minus, ExternalLink, Locate, Filter, CloudSun, Calendar, Droplets, Navigation } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { usePerformanceData } from '@/hooks/usePerformanceData';
import { filterPerformances } from '@/lib/performance-filter';
import { buildGenreCounts, getAvailableGenres, getGenreNavigationItems, isGenreAvailable, type GenreCounts } from '@/lib/genre-availability';
import type { DataBuildInfo } from '@/lib/build-info';
import { createFavoriteVenuePreference, favoriteVenueMatchesIdentity } from '@/lib/favorite-venues';
import { getExternalContentLink } from '@/lib/performance-links';
import { buildPerformanceLocationKey, getPerformanceVenueKey, resolveVenueInfoForPerformance } from '@/lib/location-display';
import Portal from './ui/Portal';
import ImageWithFallback from './ImageWithFallback';
import ServiceStatusStrip from './performance/list/ServiceStatusStrip';

// Weather interface
interface DailyWeather {
    date: string;
    maxTemp: number;
    minTemp: number;
    avgTemp: number;
    pop: number; // probability of precipitation
    rain: number;
    snow: number;
    weatherCode: number;
}

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

type MapSearchCenter = {
    lat: number;
    lng: number;
    name: string;
};

type VenueGroup = Venue & {
    groupKey: string;
    venueName: string;
    venueKey: string;
    address?: string;
    lat: number;
    lng: number;
    brand?: string;
    type: 'performance' | 'cinema';
    performances: Performance[];
    kakaoLatLng: KakaoLatLng | null;
    firstAppearanceIndex: number;
};

type GenreStyle = (typeof GENRE_STYLES)[keyof typeof GENRE_STYLES];

interface KakaoLatLng {
    getLat(): number;
    getLng(): number;
}

interface KakaoBounds {
    contain(latlng: KakaoLatLng): boolean;
    extend(latlng: KakaoLatLng): void;
}

interface KakaoMap {
    getBounds(): KakaoBounds;
    getCenter(): KakaoLatLng;
    panTo(latlng: KakaoLatLng): void;
    setCenter(latlng: KakaoLatLng): void;
    setLevel(level: number, options?: { animate?: boolean }): void;
    getLevel(): number;
    setBounds(bounds: KakaoBounds, top?: number, right?: number, bottom?: number, left?: number): void;
    relayout(): void;
}

interface KakaoOverlay {
    setMap(map: KakaoMap | null): void;
}

interface KakaoMarker {
    setMap(map: KakaoMap | null): void;
    setImage(image: unknown): void;
    setZIndex(zIndex: number): void;
    getZIndex(): number;
    _venueName?: string;
    _groupKey?: string;
    _color?: string;
    _text?: string;
}

interface KakaoClusterer {
    clear(): void;
    addMarkers(markers: KakaoMarker[]): void;
}

interface KakaoGeocoderAddressResult {
    road_address?: {
        address_name?: string;
    };
    address: {
        address_name: string;
    };
}

interface WeatherApiResponse {
    daily?: {
        time: string[];
        temperature_2m_max: number[];
        temperature_2m_min: number[];
        temperature_2m_mean: number[];
        precipitation_probability_max: number[];
        rain_sum: number[];
        snowfall_sum: number[];
        weather_code: number[];
    };
}

const SEOUL_STATION = { lat: 37.554648, lng: 126.972559 };
const venues = venueData as unknown as Record<string, Venue>;

function getGenreStyle(genreId?: string): GenreStyle {
    return GENRE_STYLES[genreId as keyof typeof GENRE_STYLES] ?? GENRE_STYLES.all;
}

interface MapViewProps {
    initialPerformances: Performance[];
    initialCinemas?: Cinema[];
    initialGenreCounts?: GenreCounts;
    buildInfo?: DataBuildInfo | null;
    lastUpdated: string;
}

export default function MapView({
    initialPerformances,
    initialCinemas = [],
    initialGenreCounts,
    buildInfo,
    lastUpdated
}: MapViewProps) {
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
    const [geoCenter, setGeoCenter] = useState<MapSearchCenter | null>(null);
    const [isCategoryMenuOpen, setIsCategoryMenuOpen] = useState(false);
    const [selectedMapGenre, setSelectedMapGenre] = useState<string>('all');
    
    // Independent search center for the map - triggers marker reloading
    const [mapSearchCenter, setMapSearchCenter] = useState<MapSearchCenter | null>(null);

    const [weatherData, setWeatherData] = useState<DailyWeather[]>([]);
    const [isWeatherLoading, setIsWeatherLoading] = useState(false);
    const [isWeatherOpen, setIsWeatherOpen] = useState(false);
    const [weatherAddress, setWeatherAddress] = useState<string>('');
    const [showExtendedForecast, setShowExtendedForecast] = useState(false);
    const [mapLoadError, setMapLoadError] = useState<string | null>(null);

    // Sync selectedMapGenre with URL on initial load only? No, user said "비연동" (independent).
    // But let's start with all if genre=all, or just the URL genre if specified.
    useEffect(() => {
        setSelectedMapGenre(selectedGenre);
    }, [selectedGenre]);

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
    }, [paramLat]);

    // Resolve center: URL params > GPS > Seoul Station
    const centerLocation = useMemo(() => {
        if (paramLat && paramLng) {
            return { lat: paramLat, lng: paramLng, name: centerName };
        }
        if (geoCenter) return geoCenter;
        return { ...SEOUL_STATION, name: '서울역' };
    }, [paramLat, paramLng, centerName, geoCenter]);

    // Update mapSearchCenter when initial centerLocation is resolved
    useEffect(() => {
        setMapSearchCenter((previousCenter) => previousCenter ?? centerLocation);
    }, [centerLocation]);

    // Load full data client-side
    const { allPerformances, cinemas: clientCinemas, isDataFullyLoaded } = usePerformanceData({
        initialPerformances,
        performanceLoadPolicy: 'full',
        backgroundLoadPriority: 'immediate',
        loadCinemas: true,
    });
    const cinemas = clientCinemas.length > 0 ? clientCinemas : initialCinemas;
    const genreCounts = useMemo(() => {
        if (isDataFullyLoaded) return buildGenreCounts(allPerformances);
        if (initialGenreCounts && Object.keys(initialGenreCounts).length > 0) return initialGenreCounts;
        return buildGenreCounts(allPerformances);
    }, [allPerformances, initialGenreCounts, isDataFullyLoaded]);
    const availableGenres = useMemo(() => getAvailableGenres(genreCounts), [genreCounts]);
    const genreNavigationItems = useMemo(() => getGenreNavigationItems(genreCounts), [genreCounts]);
    const totalItemCount = useMemo(() => {
        if (buildInfo?.itemCount) return buildInfo.itemCount;
        return Object.values(genreCounts).reduce((sum, count) => sum + count, 0);
    }, [buildInfo?.itemCount, genreCounts]);
    const availableGenreCount = useMemo(() => {
        return availableGenres.filter((genre) => genre.id !== 'all').length;
    }, [availableGenres]);

    // Self-contained user preferences
    const { favoriteVenues, toggleFavoriteVenue } = useUserPreferences();

    useEffect(() => {
        if (selectedMapGenre !== 'all' && !isGenreAvailable(genreCounts, selectedMapGenre)) {
            setSelectedMapGenre('all');
        }
    }, [genreCounts, selectedMapGenre]);

    // Filter performances based on URL params
    const performances = useMemo(() => {
        return filterPerformances(allPerformances, {
            genre: 'all', // We handle manual filtering below
            search: searchMode === 'keyword' ? searchText : '',
            searchMode,
            lat: mapSearchCenter?.lat || undefined,
            lng: mapSearchCenter?.lng || undefined,
            radius: 20 // Balanced 20km radius for markers
        }).filter(p => {
            if (selectedMapGenre === 'all') return true;
            // The data stores genre IDs (English), but we were comparing with Korean labels.
            // Fix: Compare directly with the selected ID.
            return p.genre === selectedMapGenre;
        });
    }, [allPerformances, searchMode, searchText, mapSearchCenter, selectedMapGenre]);

    // === Map State ===
    const mapRef = useRef<HTMLDivElement>(null);
    const [mapInstance, setMapInstance] = useState<KakaoMap | null>(null);
    const [selectedVenue, setSelectedVenue] = useState<string | null>(null);
    const [visibleVenues, setVisibleVenues] = useState<VenueGroup[]>([]);
    const [showSearchHereBtn, setShowSearchHereBtn] = useState(false);
    const [isMapReady, setIsMapReady] = useState(false);
    const markersRef = useRef<KakaoMarker[]>([]);
    const mapOverlaysRef = useRef<KakaoOverlay[]>([]);
    const popupOverlayRef = useRef<KakaoOverlay | null>(null);

    const allVenueGroups = useRef<Record<string, VenueGroup>>({});
    const allVenuesList = useRef<VenueGroup[]>([]);
    const centerLocationRef = useRef<MapSearchCenter>(centerLocation);
    const selectedMapGenreRef = useRef(selectedMapGenre);

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
        const isMovieMode = selectedMapGenre === 'movie';
        const isAllMode = selectedMapGenre === 'all' || !selectedMapGenre;
        const groupsMap = new Map<string, VenueGroup>();

        if (!isMovieMode || isAllMode) {
            for (let i = 0; i < performances.length; i++) {
                const perf = performances[i];
                if (!isAllMode && perf.genre !== selectedMapGenre) continue;
                const vName = perf.venue;
                const venueMeta = venues[vName];
                const resolvedVenue = resolveVenueInfoForPerformance(perf, venues) as Venue;
                const venueKey = perf.venueKey || getPerformanceVenueKey(perf, venues);
                const venueLat = resolvedVenue.lat || venueMeta?.lat || 0;
                const venueLng = resolvedVenue.lng || venueMeta?.lng || 0;
                const groupKey = buildPerformanceLocationKey(perf, venues);

                if (vName.includes('투어패스') && venueLat > 37.4 && venueLng > 130.8) continue;

                let group = groupsMap.get(groupKey);
                if (!group) {
                    group = {
                        ...venueMeta,
                        ...resolvedVenue,
                        groupKey,
                        venueName: vName,
                        venueKey,
                        performances: [],
                        lat: venueLat,
                        lng: venueLng,
                        type: 'performance',
                        kakaoLatLng: null,
                        firstAppearanceIndex: i
                    };
                    groupsMap.set(groupKey, group);
                }
                group.performances.push(perf);
            }
        }

        if (isMovieMode || isAllMode) {
            const moviePerformances = performances.filter(p => p.genre === 'movie');
            const topMovies = moviePerformances.slice(0, 10);

            for (let i = 0; i < cinemas.length; i++) {
                const cinema = cinemas[i];
                if (!groupsMap.has(cinema.name)) {
                    groupsMap.set(cinema.name, {
                        groupKey: cinema.name,
                        venueName: cinema.name,
                        venueKey: cinema.name,
                        address: cinema.address,
                        lat: cinema.lat,
                        lng: cinema.lng,
                        brand: cinema.brand,
                        type: 'cinema',
                        performances: topMovies,
                        kakaoLatLng: null,
                        firstAppearanceIndex: i
                    });
                }
            }
        }

        const list = Array.from(groupsMap.values()).filter((venue) => venue.lat && venue.lng);
        list.sort((a, b) => (a.firstAppearanceIndex ?? 99999) - (b.firstAppearanceIndex ?? 99999));

        if (mapSearchCenter && !isNaN(mapSearchCenter.lat) && !isNaN(mapSearchCenter.lng)) {
            const cLat = mapSearchCenter.lat;
            const cLng = mapSearchCenter.lng;
            list.sort((a, b) => {
                if (a.venueName === mapSearchCenter.name) return -1;
                if (b.venueName === mapSearchCenter.name) return 1;
                return getDistanceFromLatLonInKm(cLat, cLng, a.lat, a.lng) - getDistanceFromLatLonInKm(cLat, cLng, b.lat, b.lng);
            });
        }

        return { groups: Object.fromEntries(groupsMap), list };
    }, [performances, cinemas, mapSearchCenter, selectedMapGenre]);

    useEffect(() => {
        allVenueGroups.current = processedData.groups;
        allVenuesList.current = processedData.list;
        const initialCount = selectedMapGenre !== 'all' ? 200 : 20;
        setVisibleVenues(processedData.list.slice(0, initialCount));
    }, [processedData, selectedMapGenre]);

    useEffect(() => {
        centerLocationRef.current = centerLocation;
        selectedMapGenreRef.current = selectedMapGenre;
    }, [centerLocation, selectedMapGenre]);

    const handleSearchHereInternal = useCallback((map: KakaoMap) => {
        if (!map || !window.kakao?.maps?.LatLng) return;
        const bounds = map.getBounds();
        const center = map.getCenter();
        const isMovieMode = selectedMapGenre === 'movie';

        const visible = allVenuesList.current.filter((venue) => {
            if (!venue.kakaoLatLng) {
                venue.kakaoLatLng = new window.kakao.maps.LatLng(venue.lat, venue.lng) as KakaoLatLng;
            }
            if (isMovieMode) return true;
            return bounds.contain(venue.kakaoLatLng);
        });

        if (isMovieMode && center) {
            visible.sort((a, b) => getDistanceFromLatLonInKm(center.getLat(), center.getLng(), a.lat, a.lng) - getDistanceFromLatLonInKm(center.getLat(), center.getLng(), b.lat, b.lng));
        }

        setVisibleVenues(visible.slice(0, isMovieMode ? 50 : 200));
        // Keep the search button visible after search (user may want to search again)
    }, [selectedMapGenre]);

    const handleSearchHere = () => {
        if (!mapInstance) return;
        const center = mapInstance.getCenter();
        setMapSearchCenter({
            lat: center.getLat(),
            lng: center.getLng(),
            name: '현 위치'
        });
        handleSearchHereInternal(mapInstance);
    };

    // SEOUL_STATION is defined above at component level

    // --- Map Init ---
    useEffect(() => {
        let checkInterval: ReturnType<typeof setInterval> | null = null;
        let sdkTimeout: ReturnType<typeof setTimeout> | null = null;
        let cancelled = false;

        const initializeMap = () => {
            if (!window.kakao?.maps?.load || !mapRef.current || cancelled) return;
            window.kakao.maps.load(() => {
                if (cancelled || !mapRef.current) return;
                const k = window.kakao.maps;
                if (!k.Map || !k.LatLng) return;
                if (sdkTimeout) {
                    clearTimeout(sdkTimeout);
                    sdkTimeout = null;
                }

                let initialCenter = SEOUL_STATION;
                let initialLevel = 8;
                const nextCenterLocation = centerLocationRef.current;
                const nextGenre = selectedMapGenreRef.current;

                if (nextCenterLocation) {
                    initialCenter = { lat: nextCenterLocation.lat, lng: nextCenterLocation.lng };
                    initialLevel = nextGenre === 'movie' ? 7 : 6;
                } else if (allVenuesList.current.length > 0) {
                    const first = allVenuesList.current[0];
                    initialCenter = { lat: first.lat, lng: first.lng };
                    initialLevel = SPORTS_GENRES.includes(nextGenre) ? 7 : 6;
                }

                const options = { center: new k.LatLng(initialCenter.lat, initialCenter.lng), level: initialLevel };
                const map = new k.Map(mapRef.current, options) as KakaoMap;

                mapOverlaysRef.current.forEach(o => o.setMap(null));
                mapOverlaysRef.current = [];
                setMapInstance(map);
                setMapLoadError(null);

                window.kakao.maps.event.addListener(map, 'dragend', () => setShowSearchHereBtn(true));
                window.kakao.maps.event.addListener(map, 'zoom_changed', () => setShowSearchHereBtn(true));

                setIsMapReady(true);
                setTimeout(() => { map.relayout(); }, 200);
            });
        };

        checkInterval = setInterval(() => {
            if (window.kakao?.maps && checkInterval) {
                clearInterval(checkInterval);
                initializeMap();
            }
        }, 100);

        sdkTimeout = setTimeout(() => {
            if (!cancelled && !window.kakao?.maps) {
                setMapLoadError('지도 SDK를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
            }
        }, 5000);

        return () => {
            cancelled = true;
            if (checkInterval) {
                clearInterval(checkInterval);
            }
            if (sdkTimeout) {
                clearTimeout(sdkTimeout);
            }
        };
    }, []);

    // --- Reactive Map Updates ---
    useEffect(() => {
        if (!mapInstance || !isMapReady) return;
        const map = mapInstance;
        const k = window.kakao.maps;

        mapOverlaysRef.current.forEach(o => o.setMap(null));
        mapOverlaysRef.current = [];

        if (mapSearchCenter) {
            const loc = new k.LatLng(mapSearchCenter.lat, mapSearchCenter.lng);
            // We only pan if it's the initial center (to avoid fighting manual dragging)
            // if (hasPannedOnce.current === false) ... - but let's just use mapSearchCenter
            
            if (mapSearchCenter.name !== '현 위치') {
                map.panTo(loc);
            }

            const content = `<div class="flex flex-col items-center pointer-events-none" style="transform: translateY(-100%); margin-top: 12px;">
                <div class="bg-red-500 text-white px-2.5 py-1 rounded-lg text-xs font-extrabold shadow-md mb-1 whitespace-nowrap border border-red-400 font-sans">
                    ${mapSearchCenter.name || '검색 위치'}
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
            map.setLevel(SPORTS_GENRES.includes(selectedMapGenre) ? 6 : 5); // Level 5-6 is good for nationwide clusters
            setSelectedVenue(first.groupKey);
        }
    }, [handleSearchHereInternal, isMapReady, mapInstance, mapSearchCenter, selectedMapGenre]);

    // --- Markers & Clusterer ---
    const clustererRef = useRef<KakaoClusterer | null>(null);
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

    const updateMarkerSelection = useCallback((nextSelectedVenue: string | null) => {
        if (!mapInstance || !isMapReady) return;
        const k = window.kakao.maps;

        markersRef.current.forEach((marker) => {
            if (!marker._text || !marker._color || !marker._groupKey) return;

            const isSelected = marker._groupKey === nextSelectedVenue;
            const wasSelected = marker.getZIndex() === 100;
            if (!isSelected && !wasSelected) return;

            const iconUrl = getMarkerIcon(marker._text, marker._color, isSelected);
            const size = isSelected ? 44 : 36;
            const markerImage = new k.MarkerImage(iconUrl, new k.Size(size, size), new k.Point(size / 2, size / 2));
            marker.setImage(markerImage);
            marker.setZIndex(isSelected ? 100 : 10);
        });
    }, [getMarkerIcon, isMapReady, mapInstance]);

    useEffect(() => {
        if (!mapInstance || !isMapReady) return;
        const k = window.kakao.maps;

        if (clustererRef.current) clustererRef.current.clear();
        markersRef.current.forEach((marker) => {
            marker.setMap(null);
            k.event.removeListener(marker, 'click');
        });
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

        const markers: KakaoMarker[] = [];
        allVenuesList.current.forEach((venue) => {
            const primaryGenre = venue.performances[0]?.genre || selectedMapGenre || 'all';
            const style = getGenreStyle(primaryGenre);
            const color = venue.type === 'cinema' ? '#4f46e5' : (style.hex || '#4b5563');
            const text = venue.performances.length.toString();

            const iconUrl = getMarkerIcon(text, color, false);
            const size = 36;
            const markerImage = new k.MarkerImage(iconUrl, new k.Size(size, size), new k.Point(size / 2, size / 2));

            const marker = new k.Marker({
                position: new k.LatLng(venue.lat, venue.lng), image: markerImage,
                zIndex: 10
            }) as KakaoMarker;

            k.event.addListener(marker, 'click', () => {
                setSelectedVenue(venue.groupKey);
                mapInstance.panTo(new k.LatLng(venue.lat, venue.lng));
            });

            marker._venueName = venue.venueName;
            marker._groupKey = venue.groupKey;
            marker._color = color;
            marker._text = text;
            markers.push(marker);
            markersRef.current.push(marker);
        });

        clusterer.addMarkers(markers);
        updateMarkerSelection(selectedVenue);
    }, [getMarkerIcon, isMapReady, mapInstance, processedData, selectedMapGenre, selectedVenue, updateMarkerSelection]);

    // Selection update
    useEffect(() => {
        updateMarkerSelection(selectedVenue);
    }, [selectedVenue, updateMarkerSelection]);

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
        // Navigate to the list view matching the currently selected category on the map
        const genrePath = (selectedMapGenre && selectedMapGenre !== 'all') ? `/${selectedMapGenre}` : '/';
        
        // Preserve other search params if they exist (mode, q, lat, lng, etc.)
        const params = new URLSearchParams(searchParams.toString());
        // We don't need the 'genre' param if we use the path, but 'all' is the root path
        if (selectedMapGenre === 'all') {
            params.delete('genre');
        } else {
            params.set('genre', selectedMapGenre);
        }
        
        router.push(`${genrePath}?${params.toString()}`);
    };

    // My Location
    const [isLocating, setIsLocating] = useState(false);
    const myLocationOverlayRef = useRef<KakaoOverlay | null>(null);

    const handleMyLocation = useCallback(() => {
        if (!mapInstance || !isMapReady) return;
        if (!navigator.geolocation) { alert('이 브라우저에서는 위치 서비스를 지원하지 않습니다.'); return; }

        setIsLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                const k = window.kakao.maps;
                const loc = new k.LatLng(latitude, longitude) as KakaoLatLng;

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
                const overlay = new k.CustomOverlay({ map: mapInstance, position: loc, content, zIndex: 99 }) as KakaoOverlay;
                myLocationOverlayRef.current = overlay;
                mapOverlaysRef.current.push(overlay);

                // Sort venues by distance from my location
                const sorted = [...allVenuesList.current].sort((a, b) =>
                    getDistanceFromLatLonInKm(latitude, longitude, a.lat, a.lng) - getDistanceFromLatLonInKm(latitude, longitude, b.lat, b.lng)
                );
                // Show more venues when locating
                setVisibleVenues(sorted.slice(0, selectedMapGenre === 'movie' ? 100 : 300));
                setShowSearchHereBtn(false);
                setIsLocating(false);
                
                // Update search center to my location
                setMapSearchCenter({ lat: latitude, lng: longitude, name: '내 위치' });
            },
            () => {
                setIsLocating(false);
                alert('위치를 가져올 수 없습니다. 위치 권한을 확인해주세요.');
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    }, [isMapReady, mapInstance, selectedMapGenre]);

    // Weather Fetching Logic
    const fetchWeather = useCallback(async () => {
        if (!mapInstance) return;
        const center = mapInstance.getCenter();
        const lat = center.getLat();
        const lng = center.getLng();

        setIsWeatherLoading(true);
        setIsWeatherOpen(true);
        setShowExtendedForecast(false);

        try {
            // 1. Get Address using Kakao Geocoder
            const geocoder = new window.kakao.maps.services.Geocoder() as {
                coord2Address: (
                    lng: number,
                    lat: number,
                    callback: (result: KakaoGeocoderAddressResult[], status: string) => void
                ) => void;
            };
            geocoder.coord2Address(lng, lat, (result, status) => {
                if (status === window.kakao.maps.services.Status.OK) {
                    const addr = result[0].road_address?.address_name || result[0].address.address_name;
                    setWeatherAddress(addr);
                }
            });

            // 2. Fetch Weather from Open-Meteo (14 days)
            const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min,temperature_2m_mean,precipitation_probability_max,rain_sum,snowfall_sum&timezone=auto&forecast_days=14`);
            const data = await response.json() as WeatherApiResponse;

            const dailyForecast = data.daily;
            if (dailyForecast) {
                const forecast: DailyWeather[] = dailyForecast.time.map((time: string, idx: number) => ({
                    date: time,
                    maxTemp: dailyForecast.temperature_2m_max[idx],
                    minTemp: dailyForecast.temperature_2m_min[idx],
                    avgTemp: dailyForecast.temperature_2m_mean[idx],
                    pop: dailyForecast.precipitation_probability_max[idx],
                    rain: dailyForecast.rain_sum[idx],
                    snow: dailyForecast.snowfall_sum[idx],
                    weatherCode: dailyForecast.weather_code[idx]
                }));
                setWeatherData(forecast);
            }
        } catch (error) {
            console.error('Weather fetch error:', error);
        } finally {
            setIsWeatherLoading(false);
        }
    }, [mapInstance]);

    const getWeatherIcon = (code: number) => {
        if (code <= 3) return <CloudSun className="w-6 h-6 text-yellow-500" />;
        if (code <= 48) return <div className="w-6 h-6 text-gray-400">☁️</div>;
        if (code <= 67) return <Droplets className="w-6 h-6 text-blue-500" />;
        if (code <= 77) return <div className="w-6 h-6 text-blue-200">❄️</div>;
        if (code <= 82) return <Droplets className="w-6 h-6 text-blue-600" />;
        return <div className="w-6 h-6 text-gray-500">⛈️</div>;
    };

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
                    {/* Weather Button */}
                    <button onClick={() => isWeatherOpen ? setIsWeatherOpen(false) : fetchWeather()}
                        className={clsx("p-2.5 rounded-full shadow-md transition bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700",
                            isWeatherOpen && "ring-2 ring-blue-500"
                        )} title="날씨 확인">
                        <CloudSun className="w-5 h-5" />
                    </button>
                    <ServiceStatusStrip
                        lastUpdated={lastUpdated}
                        totalItemCount={totalItemCount}
                        availableGenreCount={availableGenreCount}
                        qualitySummary={buildInfo?.qualitySummary}
                        sourceHealthSummary={buildInfo?.sourceHealthSummary}
                        className="self-end"
                        buttonClassName="h-10 w-10 border-gray-200 bg-white/80 text-gray-900 shadow-md hover:bg-white dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
                    />
                </div>

                {/* Search Here Button relocated to bottom for better mobile UX */}

                {!isDataFullyLoaded && allPerformances.length === 0 && (
                    <div className="absolute inset-x-0 top-20 z-[120] flex justify-center px-4 pointer-events-none">
                        <div className="pointer-events-auto rounded-full bg-black/70 px-4 py-2 text-sm font-bold text-white shadow-lg backdrop-blur-md">
                            지도 데이터를 불러오는 중...
                        </div>
                    </div>
                )}

                {mapLoadError && !isMapReady && (
                    <div className="absolute inset-x-0 top-20 z-[130] flex justify-center px-4">
                        <div className="pointer-events-auto max-w-md rounded-2xl border border-amber-200 bg-white/95 px-4 py-3 text-sm text-slate-700 shadow-xl backdrop-blur-md dark:border-amber-900/60 dark:bg-slate-900/95 dark:text-slate-200">
                            <div className="font-black text-amber-600 dark:text-amber-400">지도를 표시하지 못하고 있어요</div>
                            <p className="mt-1 leading-relaxed">{mapLoadError}</p>
                            <button
                                onClick={() => window.location.reload()}
                                className="mt-3 inline-flex items-center rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                            >
                                새로고침
                            </button>
                        </div>
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
                            카테고리 ({genreNavigationItems.find(g => g.id === selectedMapGenre)?.label || '전체'})
                        </button>

                        {isCategoryMenuOpen && (
                            <div className="absolute top-full left-0 mt-2 w-56 max-h-[70vh] overflow-y-auto bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 p-2 animate-fade-in-down pointer-events-auto custom-scrollbar">
                                <div className="space-y-1">
                                    {/* Categoriy Order matching GENRES list in constants.ts */}
                                    {genreNavigationItems.map(genre => {
                                        const isSel = selectedMapGenre === genre.id;
                                        const style = getGenreStyle(genre.id);
                                        return (
                                            <button
                                                key={genre.id}
                                                disabled={genre.disabled}
                                                aria-disabled={genre.disabled}
                                                title={genre.offseason ? `${genre.label.replace(' (비시즌)', '')}은 현재 비시즌이라 수집된 경기가 없습니다.` : undefined}
                                                onClick={() => {
                                                    if (genre.disabled) return;
                                                    setSelectedMapGenre(genre.id);
                                                    setIsCategoryMenuOpen(false);
                                                }}
                                                className={clsx(
                                                    "flex items-center justify-between w-full px-3 py-2.5 rounded-xl transition-all text-sm group",
                                                    genre.disabled
                                                        ? "cursor-not-allowed border border-dashed border-gray-200 text-gray-400 opacity-60 grayscale dark:border-gray-800 dark:text-gray-600"
                                                        : isSel ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold" : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                                                )}
                                            >
                                                <div className="flex items-center gap-3">
                                                <div className={clsx("transition-transform group-active:scale-90", isSel ? "text-blue-600" : "text-gray-300 dark:text-gray-600")}>
                                                        {isSel ? (
                                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                                                                <circle cx="12" cy="12" r="6.3" fill="currentColor" />
                                                            </svg>
                                                        ) : (
                                                            <div className="w-5 h-5 rounded-full border-2 border-current opacity-30" />
                                                        )}
                                                    </div>
                                                    <span>{genre.label}</span>
                                                </div>
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: style.hex }} />
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Weather Popup */}
                {isWeatherOpen && (
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[200] w-[90%] max-w-md bg-white/95 dark:bg-gray-900/95 backdrop-blur-md rounded-3xl shadow-2xl border border-white/20 dark:border-white/10 overflow-hidden animate-fade-in-up pointer-events-auto">
                        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start">
                            <div className="flex gap-3 flex-1 pr-2">
                                <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-xl shrink-0 mt-0.5">
                                    <CloudSun className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <h3 className="text-[15px] font-black text-gray-900 dark:text-white leading-tight">
                                        <span className="text-blue-600 dark:text-blue-400">
                                            {(() => {
                                                if (!weatherAddress) return '위치 정보';
                                                // Remove house numbers/digits and stop at Dong level
                                                const parts = weatherAddress.split(' ');
                                                const dongIdx = parts.findIndex(p => p.endsWith('동') || p.endsWith('가') || p.endsWith('로'));
                                                if (dongIdx !== -1) return parts.slice(0, dongIdx + 1).join(' ');
                                                return weatherAddress;
                                            })()}
                                        </span> 날씨 정보
                                    </h3>
                                    <div className="flex items-center gap-1.5 text-gray-400 dark:text-gray-500 text-[10px]">
                                        <Navigation className="w-2.5 h-2.5" />
                                        <span>현재 지도 중앙 위치</span>
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setIsWeatherOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition shrink-0 -mt-1 -mr-1">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        
                        <div className="p-3">
                            {isWeatherLoading ? (
                                <div className="flex flex-col items-center py-10 gap-3">
                                    <RotateCw className="w-8 h-8 text-blue-500 animate-spin" />
                                    <span className="text-sm text-gray-500">날씨 데이터를 가져오고 있습니다...</span>
                                </div>
                            ) : (
                                <>
                                    <div className={clsx(
                                        "space-y-2 custom-scrollbar pr-1 transition-all duration-500 ease-in-out",
                                        showExtendedForecast ? "max-h-[520px] overflow-y-auto" : "max-h-none overflow-visible"
                                    )}>
                                        {weatherData.slice(0, showExtendedForecast ? 14 : 7).map((day, idx) => {
                                        const d = new Date(day.date);
                                        const dayName = d.toLocaleDateString('ko-KR', { weekday: 'short' });
                                        const dateStr = `${d.getMonth() + 1}.${d.getDate()}`;
                                        
                                        return (
                                            <div key={day.date} className={clsx(
                                                "flex items-center justify-between p-2.5 rounded-2xl border transition-colors",
                                                idx === 0 ? "bg-blue-50/50 dark:bg-blue-900/20 border-blue-200/50 dark:border-blue-800/50" : "bg-gray-50/30 dark:bg-gray-800/20 border-transparent"
                                            )}>
                                                <div className="w-12 shrink-0">
                                                    <div className="text-[11px] font-black text-gray-600 dark:text-gray-300">{idx === 0 ? '오늘' : dayName}</div>
                                                    <div className="text-[10px] text-gray-400 font-medium">{dateStr}</div>
                                                </div>
                                                
                                                <div className="flex-1 flex items-center justify-center gap-3">
                                                    <div className="flex flex-col items-center scale-90">
                                                        {getWeatherIcon(day.weatherCode)}
                                                    </div>
                                                    
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex flex-col items-center px-4">
                                                            <div className="text-[13px] font-black text-gray-900 dark:text-white">{day.maxTemp.toFixed(0)}°</div>
                                                            <div className="text-[8px] text-rose-500 font-bold leading-none">MAX</div>
                                                        </div>
                                                        <div className="flex flex-col items-center px-4">
                                                            <div className="text-[13px] font-black text-gray-500 dark:text-gray-400">{day.minTemp.toFixed(0)}°</div>
                                                            <div className="text-[8px] text-blue-500 font-bold leading-none">MIN</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                
                                                <div className="w-16 text-right">
                                                    <div className="flex items-center justify-end gap-1 text-[10px] font-extrabold text-blue-600 dark:text-blue-400">
                                                        <Droplets className="w-2.5 h-2.5" />
                                                        {day.pop}%
                                                    </div>
                                                    {(day.rain > 0 || day.snow > 0) && (
                                                        <div className="text-[9px] text-gray-400 mt-0.5">
                                                            {day.rain > 0 && `비 ${day.rain}mm`}
                                                            {day.snow > 0 && `눈 ${day.snow}cm`}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    </div>

                                    {!showExtendedForecast && weatherData.length > 7 && (
                                        <button
                                            onClick={() => setShowExtendedForecast(true)}
                                            className="mt-4 w-full py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs font-bold rounded-2xl border border-gray-100 dark:border-gray-800 transition-all flex items-center justify-center gap-2 group"
                                        >
                                            <Calendar className="w-4 h-4 transition-transform group-hover:scale-110" />
                                            날씨 더보기 (다음 일주일)
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}
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
                                            <h3 className="text-gray-900 dark:text-white font-bold text-base leading-tight truncate">{selectedVenueData.venueName}</h3>
                                            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">{selectedVenueData.address || '주소 정보 없음'}</p>
                                        </div>
                                        <button onClick={() => setSelectedVenue(null)} className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white ml-2 shrink-0">
                                            <X size={16} />
                                        </button>
                                    </div>

                                    {selectedVenueData.type === 'cinema' ? (
                                        <div className="bg-indigo-50 dark:bg-indigo-900/30 p-2 border-b border-indigo-100 dark:border-indigo-800">
                                            <a href={`https://search.naver.com/search.naver?query=${encodeURIComponent(selectedVenueData.venueName)}`}
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
                                                    params.set('venue', selectedVenueData.venueName);

                                                    const basePath = (selectedMapGenre && selectedMapGenre !== 'all') ? `/${selectedMapGenre}` : '/';
                                                    router.push(`${basePath}?${params.toString()}`);
                                                }}
                                                className="flex items-center justify-center gap-1.5 w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg transition-colors shadow-sm">
                                                <ExternalLink size={12} />
                                                {SPORTS_GENRES.includes(selectedMapGenre) ? '경기 더보기' : '공연 더보기'} · {selectedVenueData.performances?.length || 0}개 컨텐츠
                                            </button>
                                        </div>
                                    ) : null}

                                    <div className="max-h-[240px] overflow-y-auto custom-scrollbar bg-white dark:bg-gray-900 p-2 space-y-2" onScroll={handlePerfScroll}>
                                        {selectedVenueData.performances.slice(0, perfVisibleCount).map((p) => (
                                            <a key={p.id} href={getExternalContentLink(p)} target="_blank" rel="noopener noreferrer"
                                                className="flex gap-2 bg-gray-50 dark:bg-gray-800/50 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition border border-gray-100 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-600 group">
                                                {p.image ? (
                                                    <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-gray-200 dark:bg-gray-950">
                                                        <ImageWithFallback
                                                            src={p.image || p.poster || p.backupPoster || p.posterUrl || ''}
                                                            backupSrc={p.backupPoster || p.posterUrl || p.poster}
                                                            alt={p.title}
                                                            fill
                                                            optimizationWidth={80}
                                                            sizes="40px"
                                                            className="object-cover"
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="w-10 h-14 bg-gray-200 dark:bg-gray-800 rounded flex items-center justify-center shrink-0">
                                                        <Heart size={10} className="text-gray-400 dark:text-gray-600" />
                                                    </div>
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-1.5 mb-0.5">
                                                        <span className={clsx("px-1 py-[1px] rounded-[3px] text-[9px] font-extrabold text-white leading-none", getGenreStyle(p.genre).twBg || 'bg-gray-600')}>
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

                <div className="absolute bottom-0 left-0 right-0 z-[90] bg-gradient-to-t from-white/95 dark:from-gray-900 via-white/80 dark:via-gray-900/80 to-transparent pt-16 pb-4 px-4 sm:px-6">
                    {showSearchHereBtn && isMapReady && (
                        <div className="absolute top-3 left-1/2 transform -translate-x-1/2 z-[100] w-full flex justify-center pointer-events-none">
                            <button onClick={handleSearchHere}
                                className="px-5 py-2.5 bg-blue-600/90 backdrop-blur-sm text-white rounded-full font-black shadow-xl hover:bg-blue-700 transition flex items-center gap-2.5 text-sm animate-fade-in-up border border-white/20 pointer-events-auto">
                                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                                현 위치에서 검색
                            </button>
                        </div>
                    )}
                    {visibleVenues.length > 0 && (
                        <div id="venue-scroll-container" ref={scrollRef}
                            className={`flex gap-3 overflow-x-auto pb-2 scrollbar-hide pointer-events-auto cursor-grab ${isDragging ? 'cursor-grabbing' : ''}`}
                            style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}
                            onMouseDown={onMouseDown} onMouseLeave={onMouseLeave} onMouseUp={onMouseUp} onMouseMove={onMouseMove}>
                            {visibleVenues.map((v) => {
                                const isFavorite = favoriteVenues.some((favoriteVenue) =>
                                    favoriteVenueMatchesIdentity(favoriteVenue, {
                                        venueName: v.venueName,
                                        venueKey: v.venueKey,
                                        locationKey: v.groupKey,
                                    })
                                );
                                const isSelected = selectedVenue === v.groupKey;

                                let distanceLabel = '';
                                const hasCenter = mapSearchCenter && !isNaN(mapSearchCenter.lat) && !isNaN(mapSearchCenter.lng);
                                const hasVenueCoords = v.lat && v.lng && !isNaN(v.lat) && !isNaN(v.lng);

                                if (hasCenter && hasVenueCoords) {
                                    const dist = getDistanceFromLatLonInKm(mapSearchCenter!.lat, mapSearchCenter!.lng, v.lat, v.lng);
                                    distanceLabel = `${dist.toFixed(1)}km`;
                                }

                                const primaryGenre = v.performances[0]?.genre || selectedMapGenre || 'all';
                                const style = getGenreStyle(primaryGenre);
                                const isCinemaObj = v.type === 'cinema';
                                const bgClass = isCinemaObj ? 'bg-indigo-600' : style.twBg.replace('bg-', 'bg-');

                                return (
                                    <button type="button" key={v.groupKey}
                                        onClick={(e) => {
                                            if (isDragClicked.current) { e.preventDefault(); return; }
                                            const newSelected = v.groupKey === selectedVenue ? null : v.groupKey;
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
                                            <button onClick={(e) => {
                                                e.stopPropagation();
                                                toggleFavoriteVenue(createFavoriteVenuePreference({
                                                    venueName: v.venueName,
                                                    venueKey: v.venueKey,
                                                    locationKey: v.groupKey,
                                                    address: v.address,
                                                    lat: v.lat,
                                                    lng: v.lng,
                                                }));
                                            }}
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
