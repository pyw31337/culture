'use client';

import React from 'react';
import { Layout, LayoutGrid, MapPin, Heart, Star } from 'lucide-react';
import { clsx } from 'clsx';
import { GENRES } from '@/lib/constants';
import { getGenreIcon } from '@/components/GenreIcons';

export type BottomMenuType = 'view' | 'category' | 'location' | null;

interface BottomNavProps {
    activeMenu: BottomMenuType;
    currentViewMode: string;
    onMenuClick: (menu: BottomMenuType) => void;
    onLikePerfClick: () => void;
    onLikeVenueClick: () => void;
    likeCount?: number;
    venueCount?: number;
    selectedGenre?: string;
}

export default function BottomNav({ activeMenu, currentViewMode, onMenuClick, onLikePerfClick, onLikeVenueClick, likeCount = 0, venueCount = 0, selectedGenre = 'all' }: BottomNavProps) {
    // Determine Category Label
    const categoryLabel = (selectedGenre && selectedGenre !== 'all')
        ? (GENRES.find(g => g.id === selectedGenre)?.label || '카테고리')
        : '카테고리';

    // Determine Category Icon
    const CategoryIcon = (selectedGenre && selectedGenre !== 'all')
        ? ({ className }: { className?: string }) => (
            <span className={clsx(className, "flex items-center justify-center")}>
                {getGenreIcon(selectedGenre)}
            </span>
        )
        : LayoutGrid;

    // Left side items
    const leftItems = [
        { id: 'view', label: '보기', icon: Layout, action: () => onMenuClick('view') },
        { id: 'category', label: categoryLabel, icon: CategoryIcon, action: () => onMenuClick('category') },
    ];

    // Right side items with badge counts
    const rightItems = [
        {
            id: 'likes-perf',
            label: '좋아요',
            icon: Heart,
            action: onLikePerfClick,
            isActive: currentViewMode === 'likes-perf',
            badgeCount: likeCount
        },
        {
            id: 'likes-venue',
            label: '공연장',
            icon: Star,
            action: onLikeVenueClick,
            isActive: currentViewMode === 'likes-venue',
            badgeCount: venueCount
        },
    ];

    const renderNavItem = (item: typeof leftItems[0] & { isActive?: boolean; badgeCount?: number }) => {
        const isActive = item.isActive || activeMenu === item.id;
        const Icon = item.icon;

        return (
            <button
                key={item.id}
                onClick={item.action}
                className={clsx(
                    "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all duration-300 relative group",
                    isActive ? "text-[#a78bfa]" : "text-gray-400 hover:text-gray-200"
                )}
            >
                <div className="relative">
                    <Icon
                        className={clsx(
                            "w-5 h-5 transition-all duration-300",
                            isActive && "drop-shadow-[0_0_8px_rgba(167,139,250,0.6)]"
                        )}
                        strokeWidth={isActive ? 2.5 : 1.5}
                    />
                    {/* Badge Count */}
                    {item.badgeCount !== undefined && item.badgeCount > 0 && (
                        <span className="absolute -top-2 -right-2.5 min-w-[18px] h-[18px] px-1 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg shadow-pink-500/30 border border-white/20">
                            {item.badgeCount > 99 ? '99+' : item.badgeCount}
                        </span>
                    )}
                </div>
                <span className="text-[10px] font-medium tracking-tight">
                    {item.label}
                </span>
            </button>
        );
    };

    return (
        <nav className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[9990] w-[90%] max-w-[360px]">
            <div className="relative h-[68px] bg-black/60 backdrop-blur-2xl rounded-full border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex items-center justify-between px-5 ring-1 ring-white/5">
                {/* Left Side */}
                <div className="flex gap-1">
                    {leftItems.map(renderNavItem)}
                </div>

                {/* Center Action (Location) */}
                <div className="relative -top-5">
                    <button
                        onClick={() => onMenuClick('location')}
                        className={clsx(
                            "w-14 h-14 rounded-full flex items-center justify-center transition-transform duration-300 shadow-[0_8px_16px_rgba(0,0,0,0.3)] border-4 border-[#1a1b1e]", // Dark border to mask background if needed, or transparent?
                            "bg-gradient-to-br from-[#a78bfa] to-[#f472b6]",
                            "hover:scale-105 active:scale-95 group"
                        )}
                    >
                        <MapPin
                            className="w-6 h-6 text-white drop-shadow-md group-hover:animate-bounce"
                            strokeWidth={2.5}
                        />
                        {activeMenu === 'location' && (
                            <span className="absolute inset-0 rounded-full animate-ping bg-purple-400/30 -z-10" />
                        )}
                    </button>
                </div>

                {/* Right Side */}
                <div className="flex gap-1">
                    {rightItems.map(renderNavItem)}
                </div>
            </div>
        </nav>
    );
}
