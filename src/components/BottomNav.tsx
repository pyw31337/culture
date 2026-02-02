'use client';

import React from 'react';
import { Layout, LayoutGrid, LayoutList, MapPin, Heart, Star } from 'lucide-react';
import { clsx } from 'clsx';
import { GENRES } from '@/lib/constants';
import { getGenreIcon, CloverIcon } from '@/components/GenreIcons';

export type BottomMenuType = 'view' | 'category' | 'location' | 'venue-detail' | null;

interface BottomNavProps {
    activeMenu: BottomMenuType;
    currentViewMode: string;
    onMenuClick: (menu: BottomMenuType) => void;
    onLikePerfClick: () => void;
    onLikeVenueClick: () => void;
    likeCount?: number;
    venueCount?: number;
    selectedGenre?: string;
    searchMode?: 'keyword' | 'location';
}



export const ListDetailsIcon = ({ className, size = 24 }: { className?: string; size?: number }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={clsx("icon icon-tabler icons-tabler-outline icon-tabler-list-details", className)}
    >
        <path stroke="none" d="M0 0h24v24H0z" fill="none" />
        <path d="M13 5h8" />
        <path d="M13 9h5" />
        <path d="M13 15h8" />
        <path d="M13 19h5" />
        <path d="M3 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" />
        <path d="M3 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4" />
    </svg>
);

export default function BottomNav({ activeMenu, currentViewMode, onMenuClick, onLikePerfClick, onLikeVenueClick, likeCount = 0, venueCount = 0, selectedGenre = 'all', searchMode = 'keyword' }: BottomNavProps) {
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
        : CloverIcon;

    // Left side items
    const leftItems = [
        {
            id: 'view',
            label: currentViewMode === 'list' ? '리스트보기' : '썸네일보기',
            icon: (props: any) => currentViewMode === 'list'
                ? <ListDetailsIcon {...props} />
                : <LayoutGrid {...props} />, // Show Grid icon when in Grid mode (implied context: button switches modes OR shows current state? Validating user request: "When Thumbnail/List selected... use respective icon") 
            // Wait, standard nav pattern: Button function is "Change View". Often shows CURRENT state or NEXT state. 
            // User request: "Bottom menu... if thumbnail/list selected... use respective icon".
            // So if View is 'grid', show LayoutGrid (Thumbnail). If 'list', show List details.
            action: () => onMenuClick('view')
        },
        { id: 'category', label: categoryLabel, icon: CategoryIcon, action: () => onMenuClick('category') },
    ];

    // Right side items with badge counts
    const rightItems = [
        {
            id: 'likes-perf',
            label: '좋아요',
            icon: Heart,
            action: () => {
                onMenuClick(null);
                onLikePerfClick();
            },
            isActive: currentViewMode === 'likes-perf',
            badgeCount: likeCount
        },
        {
            id: 'likes-venue',
            label: '공연장',
            icon: Star,
            action: () => {
                onMenuClick(null);
                onLikeVenueClick();
            },
            isActive: currentViewMode === 'likes-venue',
            badgeCount: venueCount
        },
    ];

    // Navigation Item Type
    interface NavItem {
        id: string;
        label: string;
        icon: React.ElementType;
        action: () => void;
        isActive?: boolean;
        badgeCount?: number;
    }

    const renderNavItem = (item: NavItem) => {
        const isActive = item.isActive || activeMenu === item.id;
        const Icon = item.icon;

        return (
            <button
                key={item.id}
                onClick={item.action}
                className={clsx(
                    "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all duration-300 relative group",
                    isActive
                        ? (item.id === 'likes-perf'
                            ? "text-pink-500 light:text-pink-600"
                            : (item.id === 'likes-venue'
                                ? "text-emerald-500 light:text-emerald-600"
                                : (searchMode === 'location'
                                    ? "text-emerald-400 light:text-emerald-600"
                                    : "text-purple-400 light:text-purple-600")))
                        : "text-gray-400 hover:text-gray-200 light:text-gray-600 light:hover:text-black"
                )
                }
            >
                <div className="relative">
                    <Icon
                        className={clsx(
                            "w-5 h-5 transition-all duration-300",
                            isActive && (item.id === 'likes-perf'
                                ? "drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]" // Pink Glow
                                : (item.id === 'likes-venue'
                                    ? "drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]" // Emerald Glow
                                    : (searchMode === 'location'
                                        ? "drop-shadow-none" // Remove glow if BG is present
                                        : "drop-shadow-none"))) // Remove glow if BG is present
                        )}
                        strokeWidth={isActive ? 2.5 : 2}
                    />
                    {/* Badge Count */}
                    {item.badgeCount !== undefined && item.badgeCount > 0 && (
                        <span className="absolute -top-2 -right-2.5 min-w-[18px] h-[18px] px-1 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center shadow-lg shadow-pink-500/30 border border-white/20">
                            {item.badgeCount > 99 ? '99+' : item.badgeCount}
                        </span>
                    )}
                </div>
                <span className="text-[10px] font-semibold tracking-tight">
                    {item.label}
                </span>
            </button >
        );
    };


    return (
        <nav className="fixed bottom-0 left-0 right-0 z-[5000] pb-safe">
            {/* Main bar container with notch */}
            <div className="relative max-w-7xl mx-auto px-2">

                {/* Center floating button with rotating gradient border */}
                <div className="absolute left-1/2 -translate-x-1/2 -top-6 z-10">
                    {/* Outer gradient border wrapper - rotating conic gradient */}
                    <button
                        onClick={() => onMenuClick('location')}
                        className={clsx(
                            "w-[68px] h-[68px] rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl",
                            searchMode === 'location'
                                ? "bg-gradient-to-br from-[#55df99] to-[#0090f5]"
                                : "bg-gradient-to-br from-[#a78bfa] via-[#c084fc] to-[#f472b6]",
                            "hover:scale-105",
                            "active:scale-95",
                            "bg-white light:bg-white", // Floating button bg
                            activeMenu === 'location' && (searchMode === 'location'
                                ? "shadow-[0_0_40px_rgba(52,211,153,0.8)]"
                                : "shadow-[0_0_40px_rgba(167,139,250,0.8)]")
                        )}
                    >
                        <MapPin
                            className="w-7 h-7 text-white drop-shadow-lg"
                            strokeWidth={2.5}
                        />
                    </button>
                    {activeMenu === 'location' && (
                        <div className={clsx(
                            "absolute inset-0 rounded-full animate-ping pointer-events-none",
                            searchMode === 'location' ? "bg-emerald-400/30" : "bg-purple-400/30"
                        )} />
                    )}
                </div>

                {/* Bottom bar - Clean Glassy Look */}
                <div className={clsx(
                    "relative backdrop-blur-xl rounded-t-3xl overflow-hidden transition-colors duration-500",
                    searchMode === 'location'
                        ? "bg-gradient-to-t from-black via-[#0a1f1a] to-[#0a1f1a]/90 light:bg-white/60 light:bg-none border-t border-emerald-500/20 light:border-black/5 shadow-[0_-5px_20px_rgba(0,0,0,0.3)] light:shadow-[0_-5px_20px_rgba(0,0,0,0.05)]"
                        : "bg-gradient-to-t from-black via-[#1a0b2e] to-[#1a0b2e]/90 light:bg-white/60 light:bg-none border-t border-purple-500/20 light:border-black/5 shadow-[0_-5px_20px_rgba(0,0,0,0.3)] light:shadow-[0_-5px_20px_rgba(0,0,0,0.05)]"
                )}>
                    {/* SVG Notch Mask REMOVED */}

                    {/* Navigation Items Container */}
                    <div className="h-16 flex items-center">
                        {/* Left Side */}
                        <div className="flex-1 flex items-center justify-evenly h-full">
                            {leftItems.map(renderNavItem)}
                        </div>

                        {/* Center Spacer for the floating button */}
                        <div className="w-20" />

                        {/* Right Side */}
                        <div className="flex-1 flex items-center justify-evenly h-full">
                            {rightItems.map(renderNavItem)}
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
}
