import React from 'react';
import { clsx } from 'clsx';

export default function SkeletonCard() {
    return (
        <div className="relative aspect-[3/4] rounded-[15px] overflow-hidden bg-gray-900 light:bg-gray-200 animate-pulse">
            {/* Image Placeholder */}
            <div className="absolute inset-0 bg-gray-800/50 light:bg-gray-300/50" />

            {/* Content Overlay Placeholder (To match Default Variant) */}
            <div className="absolute inset-x-0 bottom-0 p-4 pb-8 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent light:from-white light:via-white/60">
                {/* Genre Badge */}
                <div className="w-12 h-5 bg-gray-700 light:bg-gray-400 rounded-full mb-2" />

                {/* Title */}
                <div className="h-6 bg-gray-700 light:bg-gray-400 rounded w-3/4 mb-2" />
                <div className="h-6 bg-gray-700 light:bg-gray-400 rounded w-1/2 mb-3" />

                {/* Date/Location */}
                <div className="flex gap-2">
                    <div className="h-4 bg-gray-700/50 light:bg-gray-400/50 rounded w-1/3" />
                    <div className="h-4 bg-gray-700/50 light:bg-gray-400/50 rounded w-1/4" />
                </div>
            </div>

            {/* Top Right Heart Placeholder */}
            <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-gray-700/30 light:bg-gray-400/30" />
        </div>
    );
}
