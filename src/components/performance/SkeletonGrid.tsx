import React from 'react';
import { clsx } from 'clsx';
import SkeletonCard from './SkeletonCard';

// Skeleton Loading Component for List View
// Skeleton Loading Component for List View
const SkeletonListItem = () => (
    <div className="flex gap-4 p-4 rounded-xl bg-gray-900/50 light:bg-white/50 border border-gray-800 light:border-gray-200 animate-pulse">
        {/* Image Placeholder */}
        <div className="w-24 h-32 rounded-lg bg-gray-800 light:bg-gray-300 flex-shrink-0" />

        {/* Content Placeholder */}
        <div className="flex-1 flex flex-col justify-center gap-3">
            <div className="flex gap-2 mb-1">
                <div className="w-16 h-4 bg-gray-700 light:bg-gray-300 rounded-full" />
            </div>
            <div className="h-5 bg-gray-700 light:bg-gray-400 rounded w-3/4" />
            <div className="h-4 bg-gray-800 light:bg-gray-300 rounded w-1/2" />

            <div className="mt-2 flex gap-2">
                <div className="h-4 bg-gray-800 light:bg-gray-300 rounded w-1/4" />
            </div>
        </div>
    </div>
);

// Skeleton Grid for multiple cards
export default function SkeletonGrid({ count = 8, isListMode = false }: { count?: number; isListMode?: boolean }) {
    return (
        <div className={clsx(
            "grid gap-4 sm:gap-6",
            isListMode
                ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
                : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5"
        )}>
            {Array.from({ length: count }).map((_, i) => (
                isListMode ? <SkeletonListItem key={i} /> : <SkeletonCard key={i} />
            ))}
        </div>
    );
}
