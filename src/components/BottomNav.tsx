import React from 'react';
import { Layout, LayoutGrid, MapPin, Heart, Star } from 'lucide-react';
import { clsx } from 'clsx';

export type BottomMenuType = 'view' | 'category' | 'location' | 'alarm' | null;

interface BottomNavProps {
    activeMenu: BottomMenuType;
    currentViewMode: string;
    onMenuClick: (menu: BottomMenuType) => void;
    onLikePerfClick: () => void;
    onLikeVenueClick: () => void;
}

export default function BottomNav({ activeMenu, currentViewMode, onMenuClick, onLikePerfClick, onLikeVenueClick }: BottomNavProps) {
    // Left side items
    const leftItems = [
        { id: 'view', label: '보기', icon: Layout, action: () => onMenuClick('view') },
        { id: 'category', label: '카테고리', icon: LayoutGrid, action: () => onMenuClick('category') },
    ];

    // Right side items
    const rightItems = [
        {
            id: 'likes-perf',
            label: '좋아요',
            icon: Heart,
            action: onLikePerfClick,
            isActive: currentViewMode === 'likes-perf'
        },
        {
            id: 'likes-venue',
            label: '공연장',
            icon: Star,
            action: onLikeVenueClick,
            isActive: currentViewMode === 'likes-venue'
        },
    ];

    // Center item (Location - Core Feature)
    const centerItem = { id: 'location', label: '위치', icon: MapPin, action: () => onMenuClick('location') };
    const isCenterActive = activeMenu === 'location';

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-[9990] pb-safe">
            {/* Main Container with curved top */}
            <div className="relative max-w-lg mx-auto">
                {/* Floating Center Button */}
                <button
                    onClick={centerItem.action}
                    className={clsx(
                        "absolute left-1/2 -translate-x-1/2 -top-6 z-10 w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300",
                        isCenterActive
                            ? "bg-gradient-to-br from-purple-500 to-pink-500 text-white scale-110 shadow-purple-500/50"
                            : "bg-white text-gray-700 hover:scale-105 shadow-black/20"
                    )}
                >
                    <MapPin
                        className={clsx(
                            "w-7 h-7 transition-all",
                            isCenterActive && "drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]"
                        )}
                        strokeWidth={isCenterActive ? 2.5 : 2}
                    />
                </button>

                {/* Navigation Bar */}
                <div className="bg-white/95 backdrop-blur-xl rounded-t-[28px] shadow-[0_-4px_30px_rgba(0,0,0,0.15)] border-t border-gray-100">
                    <div className="flex items-center justify-between px-4 h-20">
                        {/* Left Items */}
                        <div className="flex items-center gap-1 flex-1 justify-start">
                            {leftItems.map((item) => {
                                const isActive = activeMenu === item.id;
                                const Icon = item.icon;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={item.action}
                                        className={clsx(
                                            "flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-2xl transition-all duration-300",
                                            isActive
                                                ? "text-purple-600 bg-purple-50"
                                                : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                                        )}
                                    >
                                        <Icon className="w-6 h-6" strokeWidth={isActive ? 2.2 : 1.5} />
                                        <span className="text-[10px] font-medium tracking-tight">{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Center Spacer */}
                        <div className="w-20 flex-shrink-0" />

                        {/* Right Items */}
                        <div className="flex items-center gap-1 flex-1 justify-end">
                            {rightItems.map((item) => {
                                const isActive = item.isActive;
                                const Icon = item.icon;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={item.action}
                                        className={clsx(
                                            "flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-2xl transition-all duration-300",
                                            isActive
                                                ? "text-pink-500 bg-pink-50"
                                                : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                                        )}
                                    >
                                        <Icon
                                            className="w-6 h-6"
                                            strokeWidth={isActive ? 2.2 : 1.5}
                                            fill={isActive ? "currentColor" : "none"}
                                        />
                                        <span className="text-[10px] font-medium tracking-tight">{item.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
}
