'use client';

import { useEffect, useRef, useState } from 'react';
import { Performance } from '@/types';
import { X, Star } from 'lucide-react';
import BuildingStadium from './BuildingStadium';
import venueData from '@/data/venues.json';
import { GENRES, GENRE_STYLES } from '@/lib/constants';
import { getOptimizedUrl, getDistanceFromLatLonInKm } from '@/lib/utils';

import Portal from './ui/Portal';

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

    // Drag to scroll logic
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

    const onMouseLeave = () => {
        setIsDragging(false);
    };

    const onMouseUp = () => {
        setIsDragging(false);
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollRef.current.offsetLeft;
        const walk = (x - startX) * 2; // Scroll-fast
        scrollRef.current.scrollLeft = scrollLeft - walk;
        scrollRef.current.scrollLeft = scrollLeft - walk;
    };

    // Auto-select and scroll to venue in list if provided via centerLocation
    useEffect(() => {
        if (centerLocation?.name) {
            setSelectedVenue(centerLocation.name);
            // Wait for render cycle then scroll
            setTimeout(() => {
                if (!scrollRef.current) return;
                const targetEl = scrollRef.current.querySelector<HTMLElement>(`[data-venue-name="${CSS.escape(centerLocation.name)}"]`);
                if (targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }
            }, 300); // 300ms delay to ensure list is rendered and modal transition is mostly done
        }
    }, [centerLocation]);

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
                    level: centerLocation ? 3 : 8
                };

                // Clear container before initializing (React Strict Mode safety)
                mapRef.current.innerHTML = '';

                const map = new window.kakao.maps.Map(mapRef.current, options);
                setMapInstance(map);

                // If no centerLocation provided, try to get user's current position
                if (!centerLocation && navigator.geolocation) {
                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            const lat = position.coords.latitude;
                            const lng = position.coords.longitude;
                            const loc = new window.kakao.maps.LatLng(lat, lng);
                            map.setCenter(loc);
                            map.setLevel(5);

                            const content = document.createElement('div');
                            content.className = 'custom-overlay-me';
                            content.innerHTML = `
                                <div style="background-color:#3b82f6;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 0 10px rgba(59,130,246,0.5);display:flex;align-items:center;justify-content:center;">
                                    <div style="width:8px;height:8px;background:white;border-radius:50%;"></div>
                                </div>
                            `;
                            new window.kakao.maps.CustomOverlay({
                                map: map,
                                position: loc,
                                content: content,
                                yAnchor: 0.5,
                                zIndex: 3
                            });
                        },
                        (err) => { /* console.log("Geolocation failed:", err) */ }
                    );
                }

                // Initialize Clusterer Safely
                let clusterer: any = null;
                try {
                    if (window.kakao.maps.MarkerClusterer) {
                        clusterer = new window.kakao.maps.MarkerClusterer({
                            map: map,
                            averageCenter: true,
                            minLevel: 6,
                            disableClickZoom: false,
                            styles: [{
                                width: '50px', height: '50px',
                                background: 'rgba(37, 99, 235, 0.9)',
                                borderRadius: '50%',
                                color: 'white',
                                textAlign: 'center', lineHeight: '50px',
                                fontWeight: '800', fontSize: '14px',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                                border: '2px solid rgba(255,255,255,0.8)'
                            }]
                        });
                    }
                } catch (e) {
                    console.warn('Failed to initialize MarkerClusterer:', e);
                }

                overlaysRef.current = {};
                const venueGroups = performances.reduce((acc, perf) => {
                    if (!acc[perf.venue]) acc[perf.venue] = [];
                    acc[perf.venue].push(perf);
                    return acc;
                }, {} as Record<string, Performance[]>);

                const markers: any[] = [];
                const overlays: any[] = [];
                const bounds = new window.kakao.maps.LatLngBounds();

                // 1. Search Pin (If active)
                if (centerLocation) {
                    bounds.extend(new window.kakao.maps.LatLng(centerLocation.lat, centerLocation.lng));
                    const searchPos = new window.kakao.maps.LatLng(centerLocation.lat, centerLocation.lng);
                    const searchContent = document.createElement('div');
                    searchContent.className = 'custom-overlay-search'; // Ensure this class exists or use inline styles heavily
                    searchContent.innerHTML = `<div style="background-color:#ef4444;width:32px;height:32px;border-radius:50%;border:3px solid white;box-shadow:0 4px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;animation:bounce 0.5s;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></div><div style="position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.7);color:white;padding:2px 6px;border-radius:4px;font-size:10px;white-space:nowrap;">${centerLocation.name}</div>`;

                    new window.kakao.maps.CustomOverlay({
                        position: searchPos,
                        content: searchContent,
                        map: map,
                        yAnchor: 0.5,
                        zIndex: 20
                    });
                }

                // 2. Venue Pins
                Object.entries(venueGroups).forEach(([venueName, perfs]) => {
                    const venueInfo = venues[venueName];
                    if (!venueInfo?.lat || !venueInfo?.lng) return;

                    const position = new window.kakao.maps.LatLng(venueInfo.lat, venueInfo.lng);
                    bounds.extend(position);
                    const primaryGenre = perfs[0].genre;
                    const color = GENRE_STYLES[primaryGenre]?.hex || '#9ca3af';

                    const marker = new window.kakao.maps.Marker({
                        position: position,
                        image: new window.kakao.maps.MarkerImage(
                            'data:image/svg+xml;charset=utf-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"%3E%3C/svg%3E',
                            new window.kakao.maps.Size(1, 1)
                        )
                    });
                    (marker as any).venueName = venueName;
                    markers.push(marker);

                    const content = document.createElement('div');
                    content.style.cssText = `background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); cursor: pointer; display: flex; align-items: center; justify-content: center; color: white; font-weight: 800; font-size: 10px;`;
                    content.innerText = perfs.length.toString();

                    const customOverlay = new window.kakao.maps.CustomOverlay({
                        position: position,
                        content: content,
                        yAnchor: 1
                    });
                    overlays.push({ marker, overlay: customOverlay });

                    // InfoWindow Logic
                    const infoContent = document.createElement('div');
                    infoContent.className = 'info-window bg-white text-black p-3 rounded-lg shadow-xl border border-gray-200 min-w-[250px] max-w-[300px] text-left relative';
                    infoContent.style.cssText = "bottom: 35px; position: relative; z-index: 100;";

                    const closeBtn = document.createElement('button');
                    closeBtn.innerHTML = '×';
                    closeBtn.className = 'absolute top-1 right-2 text-xl font-extrabold text-gray-500 hover:text-black';
                    closeBtn.onclick = () => popupOverlay.setMap(null);

                    const title = document.createElement('h3');
                    title.className = 'font-extrabold text-sm mb-2 pr-4';
                    title.innerText = venueName;

                    const list = document.createElement('div');
                    list.className = 'space-y-2 max-h-[580px] overflow-y-auto scrollbar-hide';

                    perfs.forEach(p => {
                        const item = document.createElement('div');
                        item.className = 'flex gap-2 items-start border-b border-gray-100 pb-2 last:border-0';
                        if (p.image) {
                            const img = document.createElement('img');
                            img.src = getOptimizedUrl(p.image, 80);
                            img.className = 'w-10 h-14 object-cover rounded bg-gray-100 shrink-0';
                            item.appendChild(img);
                        }
                        const details = document.createElement('div');
                        details.className = 'flex-1 min-w-0';
                        const pTitle = document.createElement('p');
                        pTitle.className = 'text-xs font-bold line-clamp-2 leading-tight';
                        pTitle.innerText = p.title;
                        const pDate = document.createElement('p');
                        pDate.className = 'text-[10px] text-gray-500 mt-0.5';
                        pDate.innerText = p.date;

                        const link = document.createElement('a');
                        link.href = p.link;
                        link.target = '_blank';
                        link.className = 'inline-block mt-1 px-2 py-0.5 bg-blue-600 text-white text-[10px] rounded hover:bg-blue-700 font-extrabold';
                        link.innerText = '예매하기';

                        details.appendChild(pTitle);
                        details.appendChild(pDate);
                        details.appendChild(link);
                        item.appendChild(details);
                        list.appendChild(item);
                    });

                    infoContent.appendChild(closeBtn);
                    infoContent.appendChild(title);
                    infoContent.appendChild(list);

                    const popupOverlay = new window.kakao.maps.CustomOverlay({
                        position: position,
                        content: infoContent,
                        yAnchor: 1,
                        zIndex: 10
                    });
                    overlaysRef.current[venueName] = popupOverlay;

                    content.onclick = () => {
                        const isOpen = popupOverlay.getMap();
                        Object.values(overlaysRef.current).forEach((o: any) => o.setMap(null));
                        if (isOpen) setSelectedVenue(null);
                        else {
                            popupOverlay.setMap(map);
                            setSelectedVenue(venueName);
                        }
                    };
                });

                if (clusterer) clusterer.addMarkers(markers);
                else markers.forEach(m => m.setMap(map));

                const syncOverlays = () => {
                    overlays.forEach(({ marker, overlay }) => {
                        if (marker.getMap()) overlay.setMap(map);
                        else overlay.setMap(null);
                    });
                };
                window.kakao.maps.event.addListener(map, 'idle', syncOverlays);
                setTimeout(syncOverlays, 100);
            });
        };

        // Wait for global SDK
        const checkInterval = setInterval(() => {
            if (window.kakao && window.kakao.maps) {
                clearInterval(checkInterval);
                initializeMap();
            }
        }, 100);

        return () => clearInterval(checkInterval);
    }, [performances, centerLocation]);

    // Group performances for the list view and SORT
    const uniqueVenues = Object.values(performances.reduce((acc, perf) => {
        if (!acc[perf.venue]) {
            acc[perf.venue] = {
                ...venues[perf.venue],
                venueName: perf.venue,
                performances: []
            };
        }
        acc[perf.venue].performances.push(perf);
        return acc;
    }, {} as Record<string, any>)).sort((a, b) => {
        // 1. Priority: Exact name match with searched location
        if (centerLocation) {
            if (a.venueName === centerLocation.name) return -1;
            if (b.venueName === centerLocation.name) return 1;

            // 2. Priority: Distance from center
            if (a.lat && a.lng && b.lat && b.lng) {
                const distA = getDistanceFromLatLonInKm(centerLocation.lat, centerLocation.lng, a.lat, a.lng);
                const distB = getDistanceFromLatLonInKm(centerLocation.lat, centerLocation.lng, b.lat, b.lng);
                return distA - distB;
            }
        }
        return 0;
    });

    const moveToVenue = (venueName: string) => {
        const venue = venues[venueName];
        if (venue?.lat && venue?.lng) {
            // We need to access the map instance. 
            // Since map is inside useEffect, we might need a stored ref or re-create logic.
            // Simpler: Just rely on the fact that we can't easily access the map instance from outside the effect without state.
            // OR: Store map instance in ref.
        }
    };

    // We need map instance to control it from the list.
    // const [mapInstance, setMapInstance] = useState<any>(null); // Already defined at top


    // Update useEffect to set mapInstance
    // We need to rewrite the useEffect slightly to expose map.
    // Actually, let's just do it inside the component body, but we need to modify the file content heavily to add state.
    // Let's defer component logic change to a second tool call to avoid complex multi-chunk issues if possible, 
    // BUT we are in multi_replace_file_content so we can do it.

    // Wait, I can't easily inject `userState` inside the component function body without replacing the whole function start, which I did in chunk 2. 
    // I entered `export default function ...` in chunk 2. I should have added `const [mapInstance, setMapInstance] = useState<any>(null);` there.
    // I will skip adding state for now and focus on rendering the Bottom List first, then fix the interaction in next step if needed or try to fit it now.

    // Let's restart the mental model for chunk 2:
    // replacing `export default function ... {` with `export default function ... { const [mapInstance, setMapInstance] = useState<any>(null);`

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

                    <div ref={mapRef} className="w-full h-full bg-gray-800" />

                    {/* Bottom List for Multiple Venues */}
                    {uniqueVenues.length > 0 && (
                        <div className="absolute bottom-4 left-0 right-0 z-[90] px-4 pointer-events-none">
                            <div
                                ref={scrollRef}
                                className={`flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x pointer-events-auto cursor-grab ${isDragging ? 'cursor-grabbing' : ''}`}
                                onMouseDown={onMouseDown}
                                onMouseLeave={onMouseLeave}
                                onMouseUp={onMouseUp}
                                onMouseMove={onMouseMove}
                            >
                                {uniqueVenues.map((v: any) => {
                                    const isFavorite = favoriteVenues.includes(v.venueName);
                                    const isSelected = selectedVenue === v.venueName;
                                    return (
                                        <button
                                            type="button"
                                            key={v.venueName}
                                            data-venue-name={v.venueName}
                                            style={{ pointerEvents: 'auto' }}
                                            onClick={(e) => {
                                                if (mapInstance && v.lat && v.lng) {
                                                    if (isSelected) {
                                                        // Close
                                                        const overlay = overlaysRef.current[v.venueName];
                                                        if (overlay) overlay.setMap(null);
                                                        setSelectedVenue(null);
                                                    } else {
                                                        // Open
                                                        const moveLatLon = new window.kakao.maps.LatLng(v.lat, v.lng);
                                                        mapInstance.setLevel(3);
                                                        mapInstance.setCenter(moveLatLon); // Force center

                                                        Object.values(overlaysRef.current).forEach((o: any) => o.setMap(null));
                                                        const overlay = overlaysRef.current[v.venueName];
                                                        if (overlay) overlay.setMap(mapInstance);
                                                        setSelectedVenue(v.venueName);
                                                    }
                                                } else {
                                                    console.warn('Map click failed: missing instance or coords', { mapInstance: !!mapInstance, lat: v.lat, lng: v.lng });
                                                }
                                            }}
                                            className={`snap-center shrink-0 w-64 p-3 rounded-xl shadow-xl text-left flex flex-col gap-1 transition-all duration-300
                                                ${isSelected
                                                    ? 'ring-4 ring-blue-500 scale-[1.02] z-10'
                                                    : 'border hover:scale-[1.01]'
                                                }
                                                ${isFavorite
                                                    ? 'bg-emerald-500 border-emerald-400 text-white hover:bg-emerald-600'
                                                    : 'bg-white/90 backdrop-blur border-white/20 text-black hover:bg-white'
                                                }`}
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
                                                    <Star
                                                        className={`w-4 h-4 ${isFavorite ? 'text-white fill-white' : 'text-gray-400'}`}
                                                    />
                                                </button>
                                            </div>
                                            <p className={`text-xs truncate ${isFavorite ? 'text-emerald-100' : 'text-gray-600'}`}>{v.address || '주소 정보 없음'}</p>
                                            <div className="mt-1 flex items-center justify-between text-xs">
                                                <span className={`font-extrabold ${isFavorite ? 'text-yellow-400' : 'text-blue-600'}`}>{v.performances.length}개 공연</span>
                                                {/* Distance could be calculated if we have centerLocation */}
                                            </div>
                                            {onVenueLocationChange && v.lat && v.lng && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onVenueLocationChange(v.venueName, v.lat, v.lng);
                                                    }}
                                                    className={`w-full mt-2 py-1.5 px-3 text-xs rounded-lg font-semibold transition-colors ${isFavorite
                                                        ? 'bg-white/20 hover:bg-white/30 text-white'
                                                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                                                        }`}
                                                >
                                                    이 공연장 주변보기
                                                </button>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Portal>
    );
}
