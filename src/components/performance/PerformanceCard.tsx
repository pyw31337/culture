import React, { useState, useRef, useMemo, useCallback, memo } from 'react';
import { clsx } from 'clsx';
import { Heart } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GENRE_STYLES } from '@/lib/constants';
import { CardImage } from './atomic/CardImage';
import { SportsOverlay } from './atomic/SportsOverlay';
import { GenreBadge } from './atomic/GenreBadge';
import { CardInfo } from './atomic/CardInfo';
import { CardActions } from './atomic/CardActions';

interface PerformanceCardProps {
    perf: any;
    distLabel: string | null;
    venueInfo: any;
    onLocationClick: (loc: any) => void;
    variant?: 'default' | 'yellow' | 'pink' | 'emerald';
    isLiked?: boolean;
    onToggleLike?: (e: React.MouseEvent) => void;
    showRibbon?: boolean;
    ribbonText?: string;
    enableActions?: boolean;
    isGradient?: boolean;
    onShare?: () => Promise<boolean>;
    onDetail?: () => void;
    searchMode?: 'keyword' | 'location';
    searchText?: string;
}

function PerformanceCard({
    perf,
    distLabel,
    venueInfo,
    onLocationClick,
    variant = 'default',
    isLiked = false,
    onToggleLike,
    showRibbon = false,
    ribbonText = '추천 컨텐츠',
    enableActions = false,
    isGradient = false,
    onShare,
    onDetail,
    searchMode = 'keyword',
    searchText
}: PerformanceCardProps) {
    const [showActions, setShowActions] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);
    const glareRef = useRef<HTMLDivElement>(null);

    const isInterestVariant = ['yellow', 'pink', 'emerald'].includes(variant);

    // 3D Hover Effects
    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current || !glareRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -8;
        const rotateY = ((x - centerX) / centerX) * 8;
        cardRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
        glareRef.current.style.opacity = '1';
    }, []);

    const handleMouseLeave = useCallback(() => {
        if (!cardRef.current || !glareRef.current) return;
        cardRef.current.style.transform = `rotateX(0) rotateY(0) scale(1)`;
        glareRef.current.style.opacity = '0';
    }, []);

    return (
        <div
            className="group h-full relative perspective-1000"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={() => onDetail?.()}
        >
            <div
                ref={cardRef}
                className={clsx(
                    "relative transition-transform duration-200 ease-out transform-style-3d shadow-xl rounded-[20px] overflow-hidden h-full isolate",
                    isInterestVariant ? "border-2" : "border border-white/10",
                    variant === 'emerald' ? "border-emerald-500/50" :
                        variant === 'pink' ? "border-pink-500/50" :
                            variant === 'yellow' ? "border-yellow-500/50" : ""
                )}
            >
                {/* Glare Effect */}
                <div
                    ref={glareRef}
                    className="absolute inset-0 pointer-events-none z-50 opacity-0 transition-opacity duration-300"
                    style={{ background: 'radial-gradient(circle at center, rgba(255,255,255,0.1) 0%, transparent 70%)' }}
                />

                {/* Like Button - Always on Top */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleLike?.(e);
                    }}
                    className="absolute top-3 right-3 p-2 rounded-full hover:bg-black/20 transition-all z-[var(--z-card-overlay)]"
                    style={{ transform: 'translateZ(30px)' }}
                >
                    <Heart className={clsx("w-6 h-6 transition-all", isLiked ? "text-pink-500 fill-pink-500 scale-110" : "text-white/40 hover:text-pink-400")} />
                </button>

                {/* Card Content Pipeline */}
                <div className="flex flex-col h-full bg-[var(--card)]">
                    <div className="relative aspect-[3/4] overflow-hidden">
                        <CardImage
                            src={perf.image || perf.poster}
                            alt={perf.title}
                            fallbackGenre={perf.genre}
                        />

                        {/* Sports / Metadata Overlay */}
                        <SportsOverlay
                            genre={perf.genre}
                            homeTeam={perf.homeTeam}
                            homeTeamLogo={perf.homeTeamLogo}
                            awayTeam={perf.awayTeam}
                            awayTeamLogo={perf.awayTeamLogo}
                            size={isInterestVariant ? 'sm' : 'md'}
                        />

                        {/* Ribbon / Badges */}
                        {showRibbon && (
                            <div className="absolute top-0 left-0 z-[var(--z-card-overlay)] bg-accent text-white text-[10px] font-black px-3 py-1 rounded-br-lg shadow-lg">
                                {ribbonText}
                            </div>
                        )}
                    </div>

                    {/* Bottom Info Section */}
                    <div className={clsx(
                        "p-4 flex flex-col gap-3 flex-1 justify-between",
                        isInterestVariant ? (variant === 'yellow' ? "bg-yellow-400" : variant === 'emerald' ? "bg-emerald-500" : "bg-pink-500") : "bg-[var(--card)]"
                    )}>
                        <div className="flex flex-col gap-2">
                            <GenreBadge genre={perf.genre} rank={perf.rank} />
                            <CardInfo
                                title={perf.title}
                                venue={perf.venue}
                                date={perf.date}
                                searchText={searchText}
                                isDark={!isInterestVariant}
                                onLocationClick={() => onLocationClick?.({ lat: venueInfo?.lat, lng: venueInfo?.lng, name: perf.venue })}
                                distLabel={distLabel}
                            />
                        </div>

                        {/* Actions Layer */}
                        <AnimatePresence>
                            {(enableActions || showActions) && (
                                <CardActions
                                    onShare={onShare}
                                    onDetail={onDetail}
                                    isPrimary={!isInterestVariant}
                                />
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default memo(PerformanceCard);
