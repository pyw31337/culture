
import React, { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react';
import { clsx } from 'clsx';
import { Heart, Star, MapPin, Calendar, Share2, Search } from 'lucide-react';
import BuildingStadium from '../BuildingStadium';
import { motion, AnimatePresence } from 'framer-motion';
import { GENRES, GENRE_STYLES, FUTURES_TEAM_LOGOS } from '@/lib/constants';
import { extractFirstPrice, cleanTitle, formatUnifiedDate } from '@/lib/utils';
import ImageWithFallback from '../ImageWithFallback';
import { getGenreIcon } from '../GenreIcons';

interface PerformanceCardProps {
    perf: any;
    distLabel: string | null;
    venueInfo: any;
    onLocationClick: (loc: any) => void;
    variant?: 'default' | 'yellow' | 'pink' | 'emerald';
    isLiked?: boolean;
    onToggleLike?: (id: string, e: React.MouseEvent) => void;
    showRibbon?: boolean;
    ribbonText?: string;
    enableActions?: boolean;
    isGradient?: boolean;
    onShare?: (id: string) => Promise<boolean>;
    onDetail?: (perf: any) => void;
    searchMode?: 'keyword' | 'location';
    searchText?: string;
}

// Helper for Highlighting
const HighlightText = memo(({ text, keyword }: { text: string, keyword?: string }) => {
    if (!keyword || !text || !keyword.trim()) return <>{text}</>;

    try {
        const cleanKeyword = keyword.trim();
        // Escape special regex characters to prevent crash on keywords like "(", "[", etc.
        const escapedKeyword = cleanKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escapedKeyword})`, 'gi');
        const parts = text.split(regex);

        return (
            <>
                {parts.map((part, i) =>
                    regex.test(part) ? <span key={i} className="bg-yellow-300 text-red-600 font-extrabold">{part}</span> : part
                )}
            </>
        );
    } catch (e) {
        console.warn("HighlightText regex error:", e);
        return <>{text}</>;
    }
});

HighlightText.displayName = 'HighlightText';

function PerformanceCard({ perf, distLabel, venueInfo, onLocationClick, variant = 'default', isLiked = false, onToggleLike, showRibbon = false, ribbonText = '추천 컨텐츠', enableActions = false, isGradient = false, onShare, onDetail, searchMode = 'keyword', searchText }: PerformanceCardProps) {
    const [isCopied, setIsCopied] = useState(false);
    const [showActions, setShowActions] = useState(false);

    const cardRef = useRef<HTMLDivElement>(null);
    const glareRef = useRef<HTMLDivElement>(null);

    const dDay = useMemo(() => {
        if (perf.genre !== 'movie' || !perf.date) return null;
        try {
            const cleanDate = perf.date.replace(/\./g, '-').split('~')[0].trim();
            const target = new Date(cleanDate);
            const now = new Date();
            target.setHours(0, 0, 0, 0);
            now.setHours(0, 0, 0, 0);
            const diffTime = target.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays === 0) return 'D-Day';
            if (diffDays > 0) return `D-${diffDays}`;
            if (diffDays < 0) {
                if (diffDays < -100) return null;
                return `D+${Math.abs(diffDays)}`;
            }
            return null;
        } catch (e) {
            return null;
        }
    }, [perf.date, perf.genre]);

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current || !glareRef.current) return;

        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -10;
        const rotateY = ((x - centerX) / centerX) * 10;

        cardRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;

        glareRef.current.style.transform = `translateX(${(x - centerX) / 2}px) translateY(${(y - centerY) / 2}px)`;
        glareRef.current.style.opacity = '1';
    }, []);

    const handleMouseLeave = useCallback(() => {
        if (!cardRef.current || !glareRef.current) return;

        cardRef.current.style.transition = 'transform 0.3s ease-out';
        cardRef.current.style.transform = `rotateX(0) rotateY(0) scale(1)`;
        glareRef.current.style.opacity = '0';
    }, []);

    const isInterestVariant = ['yellow', 'pink', 'emerald'].includes(variant);

    const hasOtherDetails = useMemo(() => !!(
        (perf.originalTitle && perf.originalTitle !== perf.title) ||
        perf.productionCountry ||
        perf.productionYear ||
        perf.subGenre ||
        perf.runningTime ||
        (perf.ageRating && !['movie'].includes(perf.genre)) ||
        perf.director ||
        ((perf.castWithLinks && perf.castWithLinks.length > 0) || (perf.cast && Array.isArray(perf.cast) && perf.cast.length > 0)) ||
        (perf.platforms && perf.platforms.length > 0)
    ), [perf.originalTitle, perf.title, perf.productionCountry, perf.productionYear, perf.subGenre, perf.runningTime, perf.ageRating, perf.genre, perf.director, perf.castWithLinks, perf.cast, perf.platforms]);

    return (
        <div
            className="sm:perspective-1000 group h-full relative hover:z-[2000]"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            <div
                ref={cardRef}
                className={
                    clsx(
                        "relative transition-transform ease-out sm:transform-style-3d shadow-xl h-full rounded-[15px] will-change-transform isolate",
                        variant === 'default'
                            ? (searchMode === 'location'
                                ? "gold-shimmer-wrapper border border-emerald-500/20 shadow-[0_4px_20px_-5px_rgba(16,185,129,0.1)]"
                                : "gold-shimmer-wrapper")
                            : "",
                        variant === 'emerald'
                            ? "border border-emerald-500/40 shadow-[0_4px_20px_-5px_rgba(16,185,129,0.25)] hover:shadow-[0_8px_30px_-5px_rgba(16,185,129,0.4)]"
                            : variant === 'pink'
                                ? "border border-pink-500/40 shadow-[0_4px_20px_-5px_rgba(236,72,153,0.25)] hover:shadow-[0_8px_30px_-5px_rgba(236,72,153,0.4)]"
                                : variant === 'yellow'
                                    ? "border border-yellow-500/40 shadow-[0_4px_20px_-5px_rgba(234,179,8,0.25)] hover:shadow-[0_8px_30px_-5px_rgba(234,179,8,0.4)]"
                                    : "border-0"
                    )
                }
                style={{
                    transformStyle: 'preserve-3d',
                }}
                onClick={() => onDetail?.(perf)}
            >
                {/* Glare component */}
                <div
                    ref={glareRef}
                    className="absolute inset-0 pointer-events-none z-50 opacity-0 transition-opacity duration-200 rounded-xl"
                    style={{
                        background: 'radial-gradient(circle at center, rgba(255,255,255,0.15) 0%, transparent 60%)',
                        mixBlendMode: 'overlay',
                    }}
                />

                {variant === 'default' && (
                    <div className="gold-shimmer-border" style={{ '--shimmer-color': isGradient ? (searchMode === 'location' ? '#34d399' : '#a78bfa') : 'gold' } as React.CSSProperties} />
                )}

                <div className={clsx(
                    "gold-shimmer-main flex flex-col overflow-hidden h-full rounded-[15px] isolate",
                    isGradient
                        ? (searchMode === 'location'
                            ? "bg-gradient-to-br from-[#064e3b] to-[#0f172a]"
                            : "bg-gradient-to-br from-[#2e1065] to-[#0f172a]")
                        : "bg-gray-900"
                )}
                    style={{ transform: 'translateZ(0)' }}
                >

                    {showRibbon && (
                        <div className="absolute top-0 left-0 z-[60] w-24 h-24 pointer-events-none overflow-hidden rounded-tl-xl">
                            <div className={clsx(
                                "absolute top-0 left-0 text-white text-[10px] font-extrabold py-1 w-32 text-center origin-top-left -rotate-45 translate-y-[18px] -translate-x-[26px] shadow-lg box-border border-b-2 border-white/20",
                                searchMode === 'location' ? "bg-emerald-500" : "bg-[#a78bfa]"
                            )}>
                                {ribbonText}
                            </div>
                        </div>
                    )}

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onToggleLike) onToggleLike(perf.id, e);
                        }}
                        className="absolute top-3 right-3 z-[100] p-2 rounded-full hover:bg-black/20 transition-colors group/heart"
                        style={{ transform: 'translateZ(50px)' }}
                    >
                        <Heart
                            className={clsx(
                                "w-6 h-6 transition-all duration-300",
                                isLiked
                                    ? "text-pink-500 fill-pink-500 scale-110 drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]"
                                    : "text-gray-400 fill-black/20 hover:text-pink-400 hover:scale-110"
                            )}
                        />
                    </button>

                    <div className={clsx(
                        "absolute inset-[-2px] z-[-1] rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-neon-flow bg-[length:200%_auto] pointer-events-none",
                        searchMode === 'location'
                            ? "bg-linear-to-tr from-[#34d399] via-[#059669] to-[#34d399]"
                            : "bg-linear-to-tr from-[#ff00cc] via-[#3333ff] to-[#ff00cc]"
                    )} />

                    {isInterestVariant ? (
                        <>
                            <div className="relative aspect-[3/4] overflow-hidden shrink-0">
                                <div className="absolute inset-0 z-0">
                                    <ImageWithFallback
                                        src={perf.image || perf.poster}
                                        backupSrc={perf.backupPoster}
                                        optimizationWidth={1000}
                                        alt={perf.title}
                                        fill
                                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                                        sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                                        loading="lazy"
                                        referrerPolicy="no-referrer"
                                        style={{ zIndex: 0 }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/40 via-transparent to-transparent opacity-60 z-[1]" />
                                </div>

                                {['volleyball', 'basketball', 'baseball', 'handball', 'soccer'].includes(perf.genre) && perf.homeTeam && perf.awayTeam && (
                                    <div className="absolute top-1/2 left-0 w-full -translate-y-1/2 flex justify-between px-3 items-center z-10 pointer-events-none" style={{ transform: 'translateZ(25px)' }}>
                                        <img
                                            src={FUTURES_TEAM_LOGOS[perf.homeTeam] || perf.homeTeamLogo}
                                            alt={perf.homeTeam}
                                            className="w-[30%] max-w-[64px] aspect-square object-contain drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                                        />
                                        <div className="text-white/90 font-black text-[10px] italic bg-black/40 px-1.5 py-0.5 rounded-full backdrop-blur-[1px] border border-white/10">VS</div>
                                        <img
                                            src={FUTURES_TEAM_LOGOS[perf.awayTeam] || perf.awayTeamLogo}
                                            alt={perf.awayTeam}
                                            className="w-[30%] max-w-[64px] aspect-square object-contain drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                                        />
                                    </div>
                                )}

                                <div
                                    className={clsx(
                                        "absolute top-2 left-2 text-xs font-extrabold px-2 py-1 rounded-full shadow-md z-10 flex items-center gap-1 border",
                                        variant === 'yellow'
                                            ? "bg-black/80 text-yellow-500 border-yellow-500/30"
                                            : variant === 'pink'
                                                ? "bg-black/80 text-pink-500 border-pink-500/30"
                                                : "bg-black/80 text-emerald-500 border-emerald-500/30"
                                    )}
                                    style={{ transform: 'translateZ(20px)' }}
                                >
                                    {variant === 'yellow' ? <Star className="w-3 h-3 fill-yellow-500" /> : variant === 'pink' ? <Heart className="w-3 h-3 fill-pink-500" /> : <BuildingStadium className="w-3 h-3 fill-emerald-500" />}
                                    {variant === 'yellow' ? '알림' : variant === 'pink' ? '좋아요' : '찜한공연장'}
                                </div>

                                {enableActions && (
                                    <div className={clsx(
                                        "absolute inset-x-0 bottom-0 z-50 p-4 pb-4 flex gap-2 items-center justify-between transition-transform duration-300 ease-out",
                                        "translate-y-[100%] group-hover:translate-y-0"
                                    )}>
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                if (onShare) {
                                                    const usedClipboard = await onShare(perf.id);
                                                    if (usedClipboard) {
                                                        setIsCopied(true);
                                                        setTimeout(() => setIsCopied(false), 2000);
                                                    }
                                                }
                                            }}
                                            className="w-[20%] bg-black/40 hover:bg-black/99 text-white backdrop-blur-md border border-white/20 py-3 rounded-[15px] flex items-center justify-center transition-all shadow-lg h-[50px] relative group/share"
                                        >
                                            <Share2 className="w-5 h-5" />
                                            {isCopied && (
                                                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-black text-xs px-2 py-1 rounded">복사됨</div>
                                            )}
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDetail?.(perf);
                                            }}
                                            className="flex-1 bg-black/60 text-white hover:bg-black/90 backdrop-blur-md border border-white/20 py-3 rounded-[15px] flex items-center justify-center transition-all font-black shadow-lg h-[50px] gap-2 text-sm"
                                        >
                                            자세히 보기
                                            <Search className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className={clsx(
                                "relative flex-1 sm:transform-style-3d overflow-hidden p-4 flex flex-col min-h-0",
                                variant === 'yellow' ? "bg-yellow-400" : variant === 'emerald' ? "bg-emerald-500" : "bg-pink-500"
                            )}>
                                <h3 className="font-extrabold text-lg text-black mb-1 line-clamp-2">
                                    <HighlightText text={cleanTitle(perf.title)} keyword={searchText} />
                                </h3>

                                <div className="text-gray-800 text-sm flex items-center gap-1 mb-2">
                                    <MapPin className="w-3 h-3 text-gray-700 flex-shrink-0" />
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onLocationClick({ lat: venueInfo?.lat, lng: venueInfo?.lng, name: perf.venue });
                                        }}
                                        className="truncate hover:underline"
                                    >
                                        <HighlightText text={perf.venue} keyword={searchText} />
                                    </button>
                                </div>

                                <div className="mt-auto pt-2 border-t border-black/10 flex justify-between items-center text-black">
                                    <span className="text-white text-[10px] font-extrabold bg-black px-2 py-0.5 rounded">
                                        {perf.genre === 'movie' && perf.rank ? `영화 #${perf.rank}위` : (GENRES.find(g => g.id === perf.genre)?.label || perf.genre)}
                                    </span>
                                    {dDay && <span className="text-white text-[10px] font-black border border-white/30 px-2 rounded-full">{dDay}</span>}
                                    <span className="text-[12px] font-extrabold opacity-70">{formatUnifiedDate(perf.date)}</span>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="relative aspect-[3/4] w-full overflow-hidden">
                            <ImageWithFallback
                                src={perf.image || perf.poster}
                                backupSrc={perf.backupPoster}
                                optimizationWidth={1000}
                                alt={perf.title}
                                fill
                                className="object-cover transition-transform duration-500 group-hover:scale-110 rounded-[15px]"
                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                style={{ zIndex: 0 }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent z-[1]" />

                            {['volleyball', 'basketball', 'baseball', 'handball', 'soccer'].includes(perf.genre) && perf.homeTeam && perf.awayTeam && (
                                <div className="absolute top-1/2 left-0 w-full -translate-y-1/2 flex justify-between px-4 items-center z-10 pointer-events-none" style={{ transform: 'translateZ(25px)' }}>
                                    <img
                                        src={FUTURES_TEAM_LOGOS[perf.homeTeam] || perf.homeTeamLogo}
                                        alt={perf.homeTeam}
                                        className="w-[35%] max-w-[96px] aspect-square object-contain drop-shadow-[0_0_15px_rgba(0,0,0,0.5)]"
                                    />
                                    <div className="text-white/90 font-black text-xs sm:text-base md:text-xl italic bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-[1px] border border-white/10 shadow-lg">VS</div>
                                    <img
                                        src={FUTURES_TEAM_LOGOS[perf.awayTeam] || perf.awayTeamLogo}
                                        alt={perf.awayTeam}
                                        className="w-[35%] max-w-[96px] aspect-square object-contain drop-shadow-[0_0_15px_rgba(0,0,0,0.5)]"
                                    />
                                </div>
                            )}

                            {distLabel && (
                                <div className="absolute top-2 left-2 z-40 bg-emerald-600/90 text-white border border-emerald-400/30 px-2 py-1 rounded-full text-[10px] font-black shadow-lg flex items-center gap-1 backdrop-blur-sm">
                                    <MapPin className="w-3 h-3" />
                                    {distLabel}
                                </div>
                            )}

                            <div className={clsx(
                                "absolute inset-x-0 bottom-0 z-30 flex flex-col justify-end transition-transform duration-300 ease-out will-change-transform",
                                enableActions ? (showActions ? "translate-y-0" : "translate-y-[82px] group-hover:translate-y-0") : "translate-y-0"
                            )}>
                                <div className="relative z-30 w-full p-4 pb-4">
                                    <div className="flex flex-wrap gap-2 mb-1.5 items-center">
                                        <span className={clsx(
                                            "px-3 py-1 rounded-full text-[10px] font-black backdrop-blur-md border shadow-sm transition-all text-white",
                                            GENRE_STYLES[perf.genre]?.twBg || (searchMode === 'location' ? 'bg-black/30 border-emerald-500/50 text-emerald-400' : 'bg-black/30 border-[#a78bfa]/50 text-[#a78bfa]')
                                        )}>
                                            {perf.genre === 'movie' && perf.rank ? `영화 #${perf.rank}위` : (GENRES.find(g => g.id === perf.genre)?.label || perf.genre)}
                                        </span>
                                        {dDay && <span className="px-2 rounded-full text-[10px] font-black border border-white/30 text-white bg-transparent h-[24px] flex items-center">{dDay}</span>}
                                        <span className="text-[11px] text-gray-300 font-semibold">{formatUnifiedDate(perf.date)}</span>
                                    </div>

                                    <h3 className="text-lg md:text-xl font-[800] tracking-tighter text-white mb-0.5 leading-tight line-clamp-2 drop-shadow-lg">
                                        <HighlightText text={cleanTitle(perf.title) || '제목 없음'} keyword={searchText} />
                                    </h3>

                                    <div className="flex items-center gap-1 text-gray-300 text-xs font-semibold mt-1">
                                        <MapPin className={clsx("w-3.5 h-3.5 flex-shrink-0", searchMode === 'location' ? "text-emerald-400" : "text-[#a78bfa]")} />
                                        <button onClick={(e) => { e.stopPropagation(); onLocationClick?.({ lat: venueInfo?.lat, lng: venueInfo?.lng, name: perf.venue }); }} className="truncate hover:underline">
                                            <HighlightText text={perf.venue || 'Online'} keyword={searchText} />
                                        </button>
                                    </div>

                                    <div className="flex justify-between items-end mt-2 pt-2 border-t border-white/10">
                                        <div className="flex flex-col justify-end">
                                            {perf.discount && <span className="text-red-500 font-black text-lg leading-none">{perf.discount}</span>}
                                        </div>
                                        <div className="flex flex-col items-end">
                                            {perf.originalPrice && perf.originalPrice !== perf.price && <span className="text-gray-500 text-[10px] line-through mb-0.5">{perf.originalPrice}</span>}
                                            <div className="flex items-baseline gap-1 text-white">
                                                {(() => {
                                                    const extracted = extractFirstPrice(perf.price);
                                                    if (!extracted) return <span className="text-lg font-black">{perf.price}</span>;
                                                    return (
                                                        <div className="leading-none text-right">
                                                            {extracted.price === '무료' ? (
                                                                <span className="text-xl font-black">무료</span>
                                                            ) : (
                                                                <>
                                                                    {extracted.label && <span className="text-[10px] text-gray-400 mr-1">{extracted.label}</span>}
                                                                    <span className="text-xl font-black">{extracted.price}</span>
                                                                    <span className="text-xs font-bold ml-0.5">원</span>
                                                                </>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {enableActions && (
                                    <div className="relative z-20 p-4 pb-4 bg-black/95 flex gap-2 items-center justify-between before:absolute before:inset-x-0 before:-top-8 before:h-8 before:bg-gradient-to-t before:from-black/95 before:to-transparent before:pointer-events-none">
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                if (onShare) {
                                                    const usedClipboard = await onShare(perf.id);
                                                    if (usedClipboard) {
                                                        setIsCopied(true);
                                                        setTimeout(() => setIsCopied(false), 2000);
                                                    }
                                                }
                                            }}
                                            className="w-[20%] bg-white/5 hover:bg-white/20 text-white border border-white/10 py-3 rounded-[15px] flex items-center justify-center transition-all shadow-lg h-[50px] relative"
                                        >
                                            <Share2 className="w-5 h-5" />
                                            {isCopied && <div className="absolute -top-10 bg-black text-xs px-2 py-1 rounded">복사됨</div>}
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onDetail?.(perf); }}
                                            className="flex-1 bg-white ring-1 ring-white/20 text-black hover:bg-gray-200 py-3 rounded-[15px] flex items-center justify-center transition-all font-black shadow-lg h-[50px] gap-2 text-sm"
                                        >
                                            자세히 보기
                                            <Search className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default memo(PerformanceCard);
