import React from 'react';
import { Layout, LayoutGrid, MapPin, Heart, Star, Bell } from 'lucide-react';
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
    const navItems = [
        { id: 'view', label: '보기', icon: Layout, action: () => onMenuClick('view') },
        { id: 'category', label: '카테고리', icon: LayoutGrid, action: () => onMenuClick('category') },
        { id: 'location', label: '위치', icon: MapPin, action: () => onMenuClick('location') },
        {
            id: 'likes-perf',
            label: '찜한공연',
            icon: Heart,
            action: onLikePerfClick,
            isActive: currentViewMode === 'likes-perf'
        },
        {
            id: 'likes-venue',
            label: '찜한공연장',
            icon: Star,
            action: onLikeVenueClick,
            isActive: currentViewMode === 'likes-venue'
        },
        { id: 'alarm', label: '알림', icon: Bell, action: () => onMenuClick('alarm') },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-[9990] bg-black/80 backdrop-blur-xl border-t border-white/10 pb-safe">
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                {navItems.map((item) => {
                    const isActive = item.isActive || activeMenu === item.id;
                    const Icon = item.icon;

                    return (
                        <button
                            key={item.id}
                            onClick={item.action}
                            className={clsx(
                                "flex flex-col items-center justify-center gap-1 w-full h-full transition-all duration-300",
                                isActive ? "text-white scale-105" : "text-gray-500 hover:text-gray-300"
                            )}
                        >
                            <Icon
                                className={clsx(
                                    "w-6 h-6 transition-all duration-300",
                                    isActive && "stroke-2 shadow-glow"
                                )}
                                strokeWidth={isActive ? 2.5 : 2}
                            />
                            <span className="text-[10px] font-medium tracking-tight">
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </nav>
    );
}
