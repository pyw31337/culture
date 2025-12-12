'use client';

import { useEffect, useRef, useState } from 'react';
import { Performance } from '@/types';
import { X } from 'lucide-react';
import venueData from '@/data/venues.json';
import { GENRES, GENRE_STYLES } from '@/lib/constants';

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
}

export default function KakaoMapModal({ performances, onClose, centerLocation }: KakaoMapModalProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const [mapInstance, setMapInstance] = useState<any>(null);
    const overlaysRef = useRef<Record<string, any>>({});

    useEffect(() => {
        const scriptId = 'kakao-map-script';

        const initializeMap = () => {
            window.kakao.maps.load(() => {
                if (!mapRef.current) return;

                const options = {
                    center: centerLocation
                        ? new window.kakao.maps.LatLng(centerLocation.lat, centerLocation.lng)
                        : new window.kakao.maps.LatLng(37.554648, 126.972559), // Default: Seoul Station
                    level: centerLocation ? 5 : 7 // Default level 7 (approx 500m scale)
                };
                const map = new window.kakao.maps.Map(mapRef.current, options);
                setMapInstance(map);

                // CRITICAL FIX: Force layout update after slight delay to ensure container size is calculated
                setTimeout(() => {
                    map.relayout();
                    map.setCenter(options.center);
                }, 100);
                setTimeout(() => {
                    map.relayout();
                    map.setCenter(options.center);
                }, 500); // Second check for safety
                overlaysRef.current = {}; // Reset overlays

                const venueGroups = performances.reduce((acc, perf) => {
                    if (!acc[perf.venue]) acc[perf.venue] = [];
                    acc[perf.venue].push(perf);
                    return acc;
                }, {} as Record<string, Performance[]>);

                // Create bounds to fit markers
                const bounds = new window.kakao.maps.LatLngBounds();
                let hasMarkers = false;

                // --- 1. Render Search Pin (if exists) ---
                if (centerLocation) {
                    const searchPos = new window.kakao.maps.LatLng(centerLocation.lat, centerLocation.lng);
                    bounds.extend(searchPos);
                    hasMarkers = true;

                    // Search Pin Overlay
                    const searchContent = document.createElement('div');
                    searchContent.className = 'custom-overlay-search';
                    searchContent.style.cssText = `
                        background-color: #ef4444; 
                        width: 32px;
                        height: 32px;
                        border-radius: 50%;
                        border: 3px solid white;
                        box-shadow: 0 4px 6px rgba(0,0,0,0.4);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-weight: bold;
                        font-size: 16px;
                        animation: bounce 0.5s;
                    `;
                    // Simple Icon (Search/Pin)
                    searchContent.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';

                    // Label for Search Pin
                    const labelContent = document.createElement('div');
                    labelContent.className = 'absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-black/70 text-white text-xs px-2 py-1 rounded whitespace-nowrap';
                    labelContent.innerText = centerLocation.name;
                    searchContent.appendChild(labelContent);

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
                    hasMarkers = true;

                    const primaryGenre = perfs[0].genre;
                    const color = GENRE_STYLES[primaryGenre]?.hex || '#9ca3af';

                    // Custom Overlay Content
                    const content = document.createElement('div');
                    content.className = 'custom-overlay';
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
                        map: map,
                        yAnchor: 1
                    });

                    // InfoWindow (using CustomOverlay for better styling)
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

                        // Image
                        if (p.image) {
                            const img = document.createElement('img');
                            img.src = p.image;
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

                    // Toggle Popup
                    content.onclick = () => {
                        // Close others? For now let's just toggle this one
                        if (popupOverlay.getMap()) {
                            popupOverlay.setMap(null);
                        } else {
                            popupOverlay.setMap(map);
                        }
                    };
                });

                // Removed setBounds to prevent auto-zoom to country level
                // if (hasMarkers) {
                //     map.setBounds(bounds);
                // }
            });
        };

        // Check if script already exists and is loaded
        if (document.getElementById(scriptId)) {
            if (window.kakao && window.kakao.maps) {
                // Already valid
                initializeMap();
            } else {
                // Exists but maybe loading. Attach listener if possible, or poll?
                // Since PerformanceList loads it, we can assume it will be ready soon.
                // Let's attach an interval or just re-attach load listener to the existing script?
                // Actually, if it's already in DOM, 'load' event might have passed.
                // Polling is safest fallback.
                const checkInterval = setInterval(() => {
                    if (window.kakao && window.kakao.maps) {
                        clearInterval(checkInterval);
                        initializeMap();
                    }
                }, 100);
                setTimeout(() => clearInterval(checkInterval), 5000); // 5s timeout
            }
            return;
        }

        // Script doesn't exist (unlikely if PerformanceList loads it, but for safety)
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=0236cfffa7cfef34abacd91a6d7c73c0&autoload=false&libraries=services`;
        script.async = true;
        script.onload = initializeMap;
        document.head.appendChild(script);

        return () => {
            // Cleanup
        };
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="relative w-full h-full max-w-7xl max-h-[90vh] m-0 sm:m-4 bg-gray-900 sm:rounded-2xl overflow-hidden shadow-2xl border border-gray-800 flex flex-col">
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
                    <div className="absolute bottom-4 left-0 right-0 z-[90] px-4">
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x">
                            {uniqueVenues.map((v: any) => (
                                <button
                                    key={v.venueName}
                                    onClick={() => {
                                        if (mapInstance && v.lat && v.lng) {
                                            const moveLatLon = new window.kakao.maps.LatLng(v.lat, v.lng);
                                            mapInstance.panTo(moveLatLon);

                                            // Open Overlay
                                            const overlay = overlaysRef.current[v.venueName];
                                            if (overlay) {
                                                // Close all others ? 
                                                Object.values(overlaysRef.current).forEach((o: any) => o.setMap(null));
                                                overlay.setMap(mapInstance);
                                            }
                                        }
                                    }}
                                    className="snap-center shrink-0 w-64 bg-white/90 backdrop-blur text-black p-3 rounded-xl shadow-xl border border-white/20 text-left flex flex-col gap-1 hover:bg-white transition"
                                >
                                    <h4 className="font-bold text-sm truncate">{v.venueName}</h4>
                                    <p className="text-xs text-gray-600 truncate">{v.address || '주소 정보 없음'}</p>
                                    <div className="mt-1 flex items-center justify-between text-xs">
                                        <span className="font-semibold text-blue-600">{v.performances.length}개 공연</span>
                                        {/* Distance could be calculated if we have centerLocation */}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
