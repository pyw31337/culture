import React from 'react';
import { GENRES } from '@/lib/constants';
import { clsx } from 'clsx';

interface GenreBadgeProps {
    genre: string;
    rank?: number | string;
    className?: string;
    variant?: 'default' | 'outline' | 'glass';
}

export const GenreBadge = ({ genre, rank, className, variant = 'glass' }: GenreBadgeProps) => {
    const label = (genre === 'movie' && rank) ? `영화 #${rank}위` : (GENRES.find(g => g.id === genre)?.label || genre);

    // Base styles using generic accent or genre-specific accent
    const genreColorVar = `var(--genre-${genre}, var(--accent))`;

    return (
        <span
            className={clsx(
                "px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-extrabold transition-all border shadow-sm",
                variant === 'glass' && "bg-black/30 backdrop-blur-md text-white border-white/20",
                variant === 'default' && "bg-black text-white border-white/10",
                variant === 'outline' && "bg-transparent text-white border-white/40",
                className
            )}
            style={{
                borderColor: variant === 'glass' ? undefined : genreColorVar,
                color: variant === 'glass' ? undefined : genreColorVar,
                zIndex: 'var(--z-card-overlay)'
            }}
        >
            {label}
        </span>
    );
};
