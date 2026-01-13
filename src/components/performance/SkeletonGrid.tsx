
import React from 'react';
import { clsx } from 'clsx';

// Skeleton Loading Component for Grid View
const SkeletonCard = () => (
    <div className="relative rounded-xl overflow-hidden bg-gray-800/50 animate-pulse">
        {/* Image Placeholder */}
        <div className="aspect-[3/4] bg-gray-700/50" />
        {/* Content Placeholder */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
            <div className="h-3 bg-gray-600/30 rounded w-2/3" />
        </div>
    </div>
);


// Skeleton Loading Component for List View
const SkeletonListItem = () => (
    <div className="flex gap-4 p-4 rounded-xl bg-gray-800/50 animate-pulse">
        {/* Image Placeholder */}
        <div className="w-24 h-32 rounded-lg bg-gray-700/50 flex-shrink-0" />
        {/* Content Placeholder */}
        <div className="flex-1 flex flex-col justify-center gap-2">
            <div className="h-5 bg-gray-600/50 rounded w-3/4" />
            <div className="h-4 bg-gray-600/30 rounded w-1/2" />
            <div className="h-4 bg-gray-600/30 rounded w-2/3" />
            <div className="h-4 bg-gray-600/30 rounded w-1/3" />
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
