'use client';

import { useEffect, useRef, useState } from 'react';
import { Performance } from '@/types';
import { X, Star } from 'lucide-react';
import BuildingStadium from './BuildingStadium';
import venueData from '@/data/venues.json';
import { GENRES, GENRE_STYLES } from '@/lib/constants';
import { getOptimizedUrl } from '@/lib/utils';

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
}

export default function KakaoMapModal({ performances, onClose, centerLocation, favoriteVenues, onToggleFavorite }: KakaoMapModalProps) {
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
    };

    useEffect(() => {
        const scriptId = 'kakao-map-script';

        const initializeMap = () => {
            window.kakao.maps.load(() => {
                if (!mapRef.current) return;

                const options = {
                    center: centerLocation
                        ? new window.kakao.maps.LatLng(centerLocation.lat, centerLocation.lng)
                        : new window.kakao.maps.LatLng(37.554648, 126.972559),
                    level: centerLocation ? 4 : 8 // Start zoomed out a bit more for clustering effect
                };
                const map = new window.kakao.maps.Map(mapRef.current, options);
                setMapInstance(map);

                // Initialize Clusterer Safely
                let clusterer: any = null;
                try {
                    if (window.kakao.maps.MarkerClusterer) {
                        clusterer = new window.kakao.maps.MarkerClusterer({
                            map: map,
                            averageCenter: true,
                            minLevel: 6, // Venues spread at level 5
                            disableClickZoom: false,
                            styles: [{
                                width: '50px', height: '50px',
                                background: 'rgba(37, 99, 235, 0.9)', // Blue-600
                                borderRadius: '50%',
                                color: 'white',
                                textAlign: 'center',
                                lineHeight: '50px',
                                fontWeight: 'bold',
                                fontSize: '14px',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                                border: '2px solid rgba(255,255,255,0.8)'
                            }]
                        });
                    }
                } catch (e) {
                    console.warn('Failed to initialize MarkerClusterer:', e);
                }

                // Force layout update
                setTimeout(() => { map.relayout(); map.setCenter(options.center); }, 100);

                overlaysRef.current = {}; // Reset overlays
                const venueGroups = performances.reduce((acc, perf) => {
                    if (!acc[perf.venue]) acc[perf.venue] = [];
                    acc[perf.venue].push(perf);
                    return acc;
                }, {} as Record<string, Performance[]>);

                const markers: any[] = [];
                const overlays: any[] = [];

                // Bounds Logic
                const bounds = new window.kakao.maps.LatLngBounds();
                if (centerLocation) {
                    bounds.extend(new window.kakao.maps.LatLng(centerLocation.lat, centerLocation.lng));

                    // Add Search Pin (Static)
                    // ... Search Pin Logic (Same as before) ...
                    const searchPos = new window.kakao.maps.LatLng(centerLocation.lat, centerLocation.lng);
                    const searchContent = document.createElement('div');
                    searchContent.className = 'custom-overlay-search';
                    searchContent.innerHTML = `<div style="background-color:#ef4444;width:32px;height:32px;border-radius:50%;border:3px solid white;box-shadow:0 4px 6px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;color:white;animation:bounce 0.5s;"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></div><div style="position:absolute;bottom:-20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.7);color:white;padding:2px 6px;border-radius:4px;font-size:10px;white-space:nowrap;">${centerLocation.name}</div>`;

                    new window.kakao.maps.CustomOverlay({
                        position: searchPos,
                        content: searchContent,
                        map: map,
                        yAnchor: 0.5
                    });
                }

                Object.entries(venueGroups).forEach(([venueName, perfs]) => {
                    const venueInfo = venues[venueName];
                    if (!venueInfo?.lat || !venueInfo?.lng) return;

                    const position = new window.kakao.maps.LatLng(venueInfo.lat, venueInfo.lng);
                    bounds.extend(position);

                    const primaryGenre = perfs[0].genre;
                    const color = GENRE_STYLES[primaryGenre]?.hex || '#9ca3af';

                    // 1. Create Invisible Marker for Clusterer
                    // Use a 1px transparent image or just relying on CustomOverlay? 
                    // Clusterer NEEDS a Marker.
                    const marker = new window.kakao.maps.Marker({
                        position: position,
                        // Transparent image to make it invisible but clickable/clusterable
                        image: new window.kakao.maps.MarkerImage(
                            'data:image/svg+xml;charset=utf-8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="1" height="1"%3E%3C/svg%3E',
                            new window.kakao.maps.Size(1, 1) // Tiny size
                        )
                    });

                    // Attach metadata to marker for syncing
                    (marker as any).venueName = venueName;
                    markers.push(marker);

                    // 2. Create Custom Overlay (The Visual Badge)
                    const content = document.createElement('div');
                    content.style.cssText = `
                        background-color: ${color};
                        width: 24px;
                        height: 24px;
                        border-radius: 50%;
                        border: 2px solid white;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-weight: bold;
                        font-size: 10px;
                    `;
                    content.innerText = perfs.length.toString();

                    const customOverlay = new window.kakao.maps.CustomOverlay({
                        position: position,
                        content: content,
                        // map: map, // Do NOT set map initially, let sync logic handle it
                        yAnchor: 1
                    });

                    // Store for syncing
                    overlays.push({ marker, overlay: customOverlay });

                    // InfoWindow Logic (Same as before)
                    const infoContent = document.createElement('div');
                    infoContent.className = 'info-window bg-white text-black p-3 rounded-lg shadow-xl border border-gray-200 min-w-[250px] max-w-[300px] text-left relative';
                    infoContent.style.cssText = "bottom: 35px; position: relative; z-index: 100;"; // Positioning above marker

                    // Close button
                    const closeBtn = document.createElement('button');
                    closeBtn.innerHTML = '×';
                    closeBtn.className = 'absolute top-1 right-2 text-xl font-bold text-gray-500 hover:text-black';
                    closeBtn.onclick = () => {
                        popupOverlay.setMap(null);
                    };

                    const title = document.createElement('h3');
                    title.className = 'font-bold text-sm mb-2 pr-4';
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
                        pTitle.className = 'text-xs font-semibold line-clamp-2 leading-tight';
                        pTitle.innerText = p.title;
                        const pDate = document.createElement('p');
                        pDate.className = 'text-[10px] text-gray-500 mt-0.5';
                        pDate.innerText = p.date;
                        const link = document.createElement('a');
                        link.href = p.link;
                        link.target = '_blank';
                        link.className = 'inline-block mt-1 px-2 py-0.5 bg-blue-600 text-white text-[10px] rounded hover:bg-blue-700 font-bold';
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

                // Add markers to clusterer or map
                if (clusterer) {
                    clusterer.addMarkers(markers);
                } else {
                    markers.forEach(m => m.setMap(map));
                }

                // Sync Function
                const syncOverlays = () => {
                    overlays.forEach(({ marker, overlay }) => {
                        // If marker is on map (not clustered), show overlay
                        if (marker.getMap()) {
                            overlay.setMap(map);
                        } else {
                            overlay.setMap(null);
                        }
                    });
                };

                // Listeners
                window.kakao.maps.event.addListener(map, 'idle', syncOverlays);
                // Initial Sync (Wait a bit for clusterer)
                setTimeout(syncOverlays, 100);
            });
        };

        if (document.getElementById(scriptId)) {
            if (window.kakao && window.kakao.maps && window.kakao.maps.MarkerClusterer) {
                initializeMap();
            } else {
                let retryCount = 0;
                const checkInterval = setInterval(() => {
                    retryCount++;
                    if (window.kakao && window.kakao.maps && window.kakao.maps.MarkerClusterer) {
                        clearInterval(checkInterval);
                        initializeMap();
                    } else if (retryCount > 20) { // Fallback after ~2s
                        clearInterval(checkInterval);
                        console.warn('MarkerClusterer not found after timeout. Initializing map without clustering.');
                        initializeMap();
                    }
                }, 100);
            }
            return;
        }

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=0236cfffa7cfef34abacd91a6d7c73c0&autoload=false&libraries=services,clusterer`;
        script.async = true;
        script.onload = initializeMap;
        document.head.appendChild(script);

        return () => { };
    }, [performances, centerLocation]);

    // Group performances for the list view
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
    }, {} as Record<string, any>));

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
        <div className="fixed inset-0 z-[100001] flex items-center justify-center bg-black/80 backdrop-blur-sm">
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
                                                    mapInstance.panTo(moveLatLon);

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
                                            <h4 className="font-bold text-sm truncate flex-1">{v.venueName}</h4>
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
                                            <span className={`font-bold ${isFavorite ? 'text-yellow-400' : 'text-blue-600'}`}>{v.performances.length}개 공연</span>
                                            {/* Distance could be calculated if we have centerLocation */}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
