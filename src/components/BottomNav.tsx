'use client';

import React from 'react';
import { Layout, LayoutGrid, MapPin, Heart, Star } from 'lucide-react';
import { clsx } from 'clsx';

export type BottomMenuType = 'view' | 'category' | 'location' | null;

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

    const renderNavItem = (item: typeof leftItems[0] & { isActive?: boolean }) => {
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
                <Icon
                    className={clsx(
                        "w-5 h-5 transition-all duration-300",
                        isActive && "drop-shadow-[0_0_8px_rgba(167,139,250,0.6)]"
                    )}
                    strokeWidth={isActive ? 2.5 : 1.5}
                />
                <span className="text-[10px] font-medium tracking-tight">
                    {item.label}
                </span>
            </button>
        );
    };

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-[9990] pb-safe">
            {/* Main bar container with notch */}
            <div className="relative max-w-7xl mx-auto px-2">
                {/* Center floating button */}
                <div className="absolute left-1/2 -translate-x-1/2 -top-6 z-10">
                    <button
                        onClick={() => onMenuClick('location')}
                        className={clsx(
                            "w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 shadow-2xl",
                            "bg-gradient-to-br from-[#a78bfa] via-[#c084fc] to-[#f472b6]",
                            "hover:scale-110 hover:shadow-[0_0_30px_rgba(167,139,250,0.6)]",
                            "active:scale-95",
                            activeMenu === 'location' && "ring-4 ring-white/30 shadow-[0_0_40px_rgba(167,139,250,0.8)]"
                        )}
                    >
                        <MapPin
                            className="w-7 h-7 text-white drop-shadow-lg"
                            strokeWidth={2.5}
                        />
                    </button>
                    {/* Ripple effect when active */}
                    {activeMenu === 'location' && (
                        <div className="absolute inset-0 rounded-full animate-ping bg-purple-400/30 pointer-events-none" />
                    )}
                </div>

                {/* Bottom bar with curved notch */}
                <div className="relative bg-gradient-to-t from-black via-[#1a0b2e] to-[#1a0b2e]/90 backdrop-blur-xl border-t border-purple-500/20 rounded-t-3xl overflow-hidden">
                    {/* SVG Notch Mask */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-[1px] w-24 h-8">
                        <svg viewBox="0 0 96 32" fill="none" className="w-full h-full">
                            <path
                                d="M0 0 C16 0 24 28 48 28 C72 28 80 0 96 0 L96 32 L0 32 Z"
                                fill="#1a0b2e"
                                className="drop-shadow-lg"
                            />
                        </svg>
                    </div>

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
