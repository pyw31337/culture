'use client';

import { useEffect, useRef } from 'react';
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
}

// Removed local GENRE_COLORS

export default function KakaoMapModal({ performances, onClose }: KakaoMapModalProps) {
    const mapRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Load Kakao Maps SDK
        const script = document.createElement('script');
        script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=0236cfffa7cfef34abacd91a6d7c73c0&autoload=false`;
        script.async = true;

        script.onload = () => {
            window.kakao.maps.load(() => {
                if (!mapRef.current) return;

                const options = {
                    center: new window.kakao.maps.LatLng(37.5665, 126.9780), // Default Seoul
                    level: 9
                };
                const map = new window.kakao.maps.Map(mapRef.current, options);

                // Group by venue
                const venueGroups = performances.reduce((acc, perf) => {
                    if (!acc[perf.venue]) acc[perf.venue] = [];
                    acc[perf.venue].push(perf);
                    return acc;
                }, {} as Record<string, Performance[]>);

                // Create bounds to fit markers
                const bounds = new window.kakao.maps.LatLngBounds();
                let hasMarkers = false;

                Object.entries(venueGroups).forEach(([venueName, perfs]) => {
                    const venueInfo = venues[venueName];
                    if (!venueInfo?.lat || !venueInfo?.lng) return;

                    const position = new window.kakao.maps.LatLng(venueInfo.lat, venueInfo.lng);
                    bounds.extend(position);
                    hasMarkers = true;

                    const primaryGenre = perfs[0].genre;
                    const color = GENRE_STYLES[primaryGenre]?.hex || '#9ca3af';

                    // Parse HEX to RGB for background opacity
                    // Simple fix: just use the hex color

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

                if (hasMarkers) {
                    map.setBounds(bounds);
                }
            });
        };

        document.head.appendChild(script);

        return () => {
            // Cleanup script? usually fine to leave it or remove
            // document.head.removeChild(script);
        };
    }, [performances]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="relative w-full h-full max-w-7xl max-h-[90vh] m-4 bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-gray-800 flex flex-col">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-[100] p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition"
                >
                    <X className="w-6 h-6" />
                </button>

                <div ref={mapRef} className="w-full h-full bg-gray-800" />
            </div>
        </div>
    );
}
