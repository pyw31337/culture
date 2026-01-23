'use client';

import { motion } from 'framer-motion';

interface SkeletonCardProps {
    variant?: 'card' | 'list';
}

/**
 * Skeleton Loading component for performance cards/list items.
 * Provides visual feedback during data loading with smooth animations.
 */
export default function SkeletonCard({ variant = 'card' }: SkeletonCardProps) {
    // Shimmer animation component
    const ShimmerOverlay = () => (
        <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 dark:via-gray-600/30 to-transparent"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{
                repeat: Infinity,
                duration: 1.5,
                ease: 'easeInOut' as const,
            }}
        />
    );

    if (variant === 'list') {
        return (
            <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
                {/* Thumbnail */}
                <div className="relative w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-xl overflow-hidden flex-shrink-0">
                    <ShimmerOverlay />
                </div>
                {/* Content */}
                <div className="flex-1 space-y-3">
                    {/* Title */}
                    <div className="relative h-5 bg-gray-200 dark:bg-gray-700 rounded-md w-3/4 overflow-hidden">
                        <ShimmerOverlay />
                    </div>
                    {/* Subtitle */}
                    <div className="relative h-4 bg-gray-200 dark:bg-gray-700 rounded-md w-1/2 overflow-hidden">
                        <ShimmerOverlay />
                    </div>
                    {/* Meta */}
                    <div className="flex gap-3">
                        <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded w-16 overflow-hidden">
                            <ShimmerOverlay />
                        </div>
                        <div className="relative h-3 bg-gray-200 dark:bg-gray-700 rounded w-20 overflow-hidden">
                            <ShimmerOverlay />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Card variant (Thumbnail grid)
    return (
        <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
            {/* Image Placeholder */}
            <div className="relative aspect-[3/4] bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <ShimmerOverlay />
            </div>
            {/* Content */}
            <div className="p-4 space-y-3">
                {/* Title */}
                <div className="relative h-5 bg-gray-200 dark:bg-gray-700 rounded-md w-4/5 overflow-hidden">
                    <ShimmerOverlay />
                </div>
                {/* Subtitle */}
                <div className="relative h-4 bg-gray-200 dark:bg-gray-700 rounded-md w-3/5 overflow-hidden">
                    <ShimmerOverlay />
                </div>
                {/* Meta Row */}
                <div className="flex justify-between items-center pt-2">
                    <div className="relative h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 overflow-hidden">
                        <ShimmerOverlay />
                    </div>
                    <div className="relative h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-20 overflow-hidden">
                        <ShimmerOverlay />
                    </div>
                </div>
            </div>
        </div>
    );
}

// Grid wrapper component for multiple skeleton cards
export function SkeletonGrid({ count = 6, variant = 'card' }: { count?: number; variant?: 'card' | 'list' }) {
    return (
        <div className={variant === 'card'
            ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
            : "space-y-3"
        }>
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonCard key={i} variant={variant} />
            ))}
        </div>
    );
}
