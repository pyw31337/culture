import React from 'react';
import { MapPin, Calendar } from 'lucide-react';
import { cleanTitle, formatUnifiedDate } from '@/lib/utils';
import { clsx } from 'clsx';

interface CardInfoProps {
    title: string;
    venue: string;
    date: string;
    searchText?: string;
    isDark?: boolean;
    onLocationClick?: () => void;
    distLabel?: string | null;
}

// Internal Highlight Helper
const HighlightText = ({ text, keyword }: { text: string, keyword?: string }) => {
    if (!keyword || !text) return <>{text}</>;
    const regex = new RegExp(`(${keyword})`, 'gi');
    const parts = text.split(regex);
    return (
        <>
            {parts.map((part, i) =>
                regex.test(part) ? <span key={i} className="bg-yellow-300 text-red-600 font-extrabold">{part}</span> : part
            )}
        </>
    );
};

export const CardInfo = ({ title, venue, date, searchText, isDark = true, onLocationClick, distLabel }: CardInfoProps) => {
    return (
        <div className="flex flex-col gap-1 w-full" style={{ zIndex: 'var(--z-card-overlay)' }}>
            <h3
                className={clsx(
                    "text-lg font-black tracking-tight line-clamp-2 leading-tight drop-shadow-sm",
                    isDark ? "text-white" : "text-[var(--card-foreground)]"
                )}
            >
                <HighlightText text={cleanTitle(title)} keyword={searchText} />
            </h3>

            <div className="flex flex-col gap-0.5 mt-0.5 opacity-90">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onLocationClick) onLocationClick();
                    }}
                    className={clsx(
                        "flex items-center gap-1 text-xs font-bold w-max max-w-full hover:opacity-80 transition-opacity",
                        isDark ? "text-gray-300" : "text-[var(--muted-foreground)]"
                    )}
                >
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="truncate flex-1">
                        <HighlightText text={venue} keyword={searchText} />
                    </span>
                    {distLabel && (
                        <span className={clsx(
                            "ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-black shrink-0",
                            isDark ? "bg-white/10 text-white" : "bg-black/5 text-black"
                        )}>
                            {distLabel}
                        </span>
                    )}
                </button>

                <div
                    className={clsx(
                        "flex items-center gap-1 text-xs font-semibold",
                        isDark ? "text-gray-400" : "text-[var(--muted-foreground)]"
                    )}
                >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{formatUnifiedDate(date)}</span>
                </div>
            </div>
        </div>
    );
};
