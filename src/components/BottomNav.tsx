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
            label: '좋아요 공연',
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
        <nav className="fixed bottom-0 left-0 right-0 z-[9990] bg-gradient-to-t from-black via-[#1a0b2e] to-transparent backdrop-blur-xl border-t border-purple-500/20 pb-safe">
            <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
                {navItems.map((item) => {
                    const isActive = item.isActive || activeMenu === item.id;
                    const Icon = item.icon;

                    return (
                        <button
                            key={item.id}
                            onClick={item.action}
                            className={clsx(
                                "flex flex-col items-center justify-center gap-1.5 w-full h-full transition-all duration-300 relative group",
                                isActive ? "text-[#a78bfa] -translate-y-1" : "text-gray-400 hover:text-gray-200"
                            )}
                        >
                            {/* Active Indicator Glow */}
                            {isActive && (
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-purple-600/20 rounded-full blur-xl pointer-events-none" />
                            )}

                            <Icon
                                className={clsx(
                                    "w-6 h-6 transition-all duration-300",
                                    isActive && "drop-shadow-[0_0_8px_rgba(167,139,250,0.6)]"
                                )}
                                strokeWidth={isActive ? 2.5 : 1.5}
                                fill={isActive ? "currentColor" : "none"} // Fill icon when active
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
