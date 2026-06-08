
import React, { useState, useMemo, memo } from 'react';
import { clsx } from 'clsx';
import { Heart, Star, MapPin, Calendar, Share2, Search } from 'lucide-react';
import BuildingStadium from '../BuildingStadium';
import { GENRES, GENRE_STYLES, FUTURES_TEAM_LOGOS } from '@/lib/constants';
import { extractFirstPrice, cleanTitle, formatUnifiedDate } from '@/lib/utils';
import ImageWithFallback from '../ImageWithFallback';
import { getGenreIcon } from '../GenreIcons';
import { getDdayLabel } from '@/lib/dday';
import { getSportsTicketBaySummary } from '@/lib/sports-ticketing';
import RecommendationReasonChips from './RecommendationReasonChips';

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
    onDetailPrepare?: () => void;
    searchMode?: 'keyword' | 'location';
    searchText?: string;
    priority?: boolean;
    enableEffects?: boolean;
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

function PerformanceCard({ perf, distLabel, venueInfo, onLocationClick, variant = 'default', isLiked = false, onToggleLike, showRibbon = false, ribbonText = '추천 컨텐츠', enableActions = false, isGradient = false, onShare, onDetail, onDetailPrepare, searchMode = 'keyword', searchText, priority = false, enableEffects = false }: PerformanceCardProps) {
    const [isCopied, setIsCopied] = useState(false);

    const dDay = getDdayLabel(perf);
    const isMovie = perf.genre === 'movie';
    const formattedDate = formatUnifiedDate(perf.date);
    const shouldShowDateChip = Boolean(formattedDate && formattedDate !== dDay);
    const sportsTicketBay = useMemo(() => getSportsTicketBaySummary(perf), [perf]);
    const priceText = typeof perf.price === 'string' && perf.price.trim()
        ? perf.price.trim()
        : sportsTicketBay?.label || '';
    const priceFallbackText = sportsTicketBay?.sourceLabel || (['baseball', 'basketball', 'volleyball', 'soccer', 'handball'].includes(perf.genre)
        ? '예매처 확인'
        : '가격 확인');

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
            className="group h-full relative overflow-visible hover:z-[2000]"
            style={{ contentVisibility: 'auto', containIntrinsicSize: '360px 520px' }}
            onPointerEnter={onDetailPrepare}
            onFocusCapture={onDetailPrepare}
        >
            <div
                className={
                    clsx(
                        "relative shadow-md h-full rounded-[15px] isolate overflow-visible",
                        variant === 'default'
                            ? (searchMode === 'location'
                                ? "p-px border border-emerald-500/20 shadow-[0_4px_20px_-5px_rgba(16,185,129,0.1)]"
                                : "p-px")
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
            >
                {enableEffects && variant === 'default' && (
                    <div className="absolute inset-0 z-0 overflow-hidden rounded-[15px] pointer-events-none">
                        <div className="gold-shimmer-border" style={{ '--shimmer-color': isGradient ? (searchMode === 'location' ? '#34d399' : '#a78bfa') : 'gold' } as React.CSSProperties} />
                    </div>
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


                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onToggleLike) onToggleLike(perf.id, e);
                        }}
                        className="absolute top-3 right-3 z-[100] p-2 rounded-full hover:bg-black/20 transition-colors duration-100 group/heart"
                        style={{ transform: 'translateZ(50px)' }}
                    >
                        <Heart
                            className={clsx(
                                "w-6 h-6 transition-colors duration-100",
                                isLiked
                                    ? "text-pink-500 fill-pink-500"
                                    : "text-gray-400 fill-black/20 hover:text-pink-400"
                            )}
                        />
                    </button>

                    {enableEffects && (
                        <div className={clsx(
                            "absolute inset-[-2px] z-[-1] rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-150 animate-neon-flow bg-[length:200%_auto] pointer-events-none",
                            searchMode === 'location'
                                ? "bg-linear-to-tr from-[#34d399] via-[#059669] to-[#34d399]"
                                : "bg-linear-to-tr from-[#ff00cc] via-[#3333ff] to-[#ff00cc]"
                        )} />
                    )}

                    {isInterestVariant ? (
                        <>
                            <div className="relative aspect-[3/4] overflow-hidden shrink-0">
                                <div className="absolute inset-0 z-0">
                                    <ImageWithFallback
                                        src={perf.image || perf.poster}
                                        backupSrc={perf.backupPoster}
                                        placeholderInput={{
                                            title: perf.title,
                                            genre: perf.genre,
                                            matchLabel: perf.homeTeam && perf.awayTeam ? `${perf.homeTeam} vs ${perf.awayTeam}` : null,
                                        }}
                                        optimizationWidth={priority ? 360 : 320}
                                        quality={priority ? 62 : 56}
                                        alt={perf.title}
                                        fill
                                        className={clsx("pointer-events-none object-cover", enableEffects && "transition-transform duration-150 sm:group-hover:scale-[1.02]")}
                                        sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                                        loading={priority ? 'eager' : 'lazy'}
                                        priority={priority}
                                        fastDisplay={priority}
                                        referrerPolicy="no-referrer"
                                        style={{ zIndex: 0, pointerEvents: 'none' }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/40 via-transparent to-transparent opacity-60 z-[1]" />
                                </div>

                                {['volleyball', 'basketball', 'baseball', 'handball'].includes(perf.genre) && perf.homeTeam && perf.awayTeam && (
                                    <div className="absolute top-1/2 left-0 w-full -translate-y-1/2 flex justify-between px-3 items-center z-10 pointer-events-none" style={{ transform: 'translateZ(25px)' }}>
                                        <img
                                            src={FUTURES_TEAM_LOGOS[perf.homeTeam] || perf.homeTeamLogo}
                                            alt={perf.homeTeam}
                                            className="w-[30%] max-w-[64px] aspect-square object-contain drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                                        />
                                        <div className="text-white/90 font-black text-[10px] italic bg-black/50 px-1.5 py-0.5 rounded-full border border-white/10">VS</div>
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
                                        "absolute inset-x-0 bottom-0 z-50 p-4 pb-4 flex gap-2 items-center justify-between",
                                        "translate-y-0 sm:translate-y-[100%] sm:group-hover:translate-y-0"
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
                                            className="w-[20%] bg-black/55 hover:bg-black text-white border border-white/20 py-3 rounded-[15px] flex items-center justify-center transition-colors duration-100 h-[50px] relative group/share"
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
                                            className="flex-1 bg-black/70 text-white hover:bg-black/90 border border-white/20 py-3 rounded-[15px] flex items-center justify-center transition-colors duration-100 font-black h-[50px] gap-2 text-sm"
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

                                {!isMovie && (
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
                                )}

                                <div className="mt-auto pt-2 border-t border-black/10 flex justify-between items-center text-black">
                                    <span className="text-white text-[10px] font-extrabold bg-black px-2 py-0.5 rounded">
                                        {isMovie && perf.rank ? `영화 #${perf.rank}위` : (GENRES.find(g => g.id === perf.genre)?.label || perf.genre)}
                                    </span>
                                    {dDay && <span className="text-white text-[10px] font-black border border-white/30 px-2 rounded-full">{dDay}</span>}
                                    {shouldShowDateChip && <span className="text-[12px] font-extrabold opacity-70">{formattedDate}</span>}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="relative aspect-[3/4] w-full overflow-hidden">
                            <ImageWithFallback
                                src={perf.image || perf.poster}
                                backupSrc={perf.backupPoster}
                                placeholderInput={{
                                    title: perf.title,
                                    genre: perf.genre,
                                    matchLabel: perf.homeTeam && perf.awayTeam ? `${perf.homeTeam} vs ${perf.awayTeam}` : null,
                                }}
                                optimizationWidth={priority ? 360 : 320}
                                quality={priority ? 62 : 56}
                                alt={perf.title}
                                fill
                                className={clsx("pointer-events-none object-cover rounded-[15px]", enableEffects && "transition-transform duration-150 sm:group-hover:scale-[1.02]")}
                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                loading={priority ? 'eager' : 'lazy'}
                                priority={priority}
                                fastDisplay={priority}
                                referrerPolicy="no-referrer"
                                style={{ zIndex: 0, pointerEvents: 'none' }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent z-[1]" />

                            {['volleyball', 'basketball', 'baseball', 'handball'].includes(perf.genre) && perf.homeTeam && perf.awayTeam && (
                                <div className="absolute top-1/2 left-0 w-full -translate-y-1/2 flex justify-between px-4 items-center z-10 pointer-events-none" style={{ transform: 'translateZ(25px)' }}>
                                    <img
                                        src={FUTURES_TEAM_LOGOS[perf.homeTeam] || perf.homeTeamLogo}
                                        alt={perf.homeTeam}
                                        className="w-[35%] max-w-[96px] aspect-square object-contain drop-shadow-[0_0_15px_rgba(0,0,0,0.5)]"
                                    />
                                    <div className="text-white/90 font-black text-xs sm:text-base md:text-xl italic bg-black/50 px-2 py-0.5 rounded-full border border-white/10 shadow-lg">VS</div>
                                    <img
                                        src={FUTURES_TEAM_LOGOS[perf.awayTeam] || perf.awayTeamLogo}
                                        alt={perf.awayTeam}
                                        className="w-[35%] max-w-[96px] aspect-square object-contain drop-shadow-[0_0_15px_rgba(0,0,0,0.5)]"
                                    />
                                </div>
                            )}

                            {distLabel && (
                                <div className="absolute top-2 left-2 z-40 bg-emerald-600 text-white border border-emerald-400/30 px-2 py-1 rounded-full text-[10px] font-black shadow-lg flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {distLabel}
                                </div>
                            )}

                            <div className={clsx(
                                "absolute inset-x-0 bottom-0 z-30 flex flex-col justify-end",
                                enableActions ? "translate-y-0 sm:translate-y-[82px] sm:group-hover:translate-y-0" : "translate-y-0"
                            )}>
                                <div className="relative z-30 w-full p-4 pb-4">
                                    <div className="flex flex-wrap gap-2 mb-1.5 items-center">
                                        <span className={clsx(
                                            "px-3 py-1 rounded-full text-[10px] font-black border shadow-sm text-white",
                                            GENRE_STYLES[perf.genre]?.twBg || (searchMode === 'location' ? 'bg-black/30 border-emerald-500/50 text-emerald-400' : 'bg-black/30 border-[#a78bfa]/50 text-[#a78bfa]')
                                        )}>
                                            {isMovie && perf.rank ? `영화 #${perf.rank}위` : (GENRES.find(g => g.id === perf.genre)?.label || perf.genre)}
                                        </span>
                                        {dDay && <span className="px-2 rounded-full text-[10px] font-black border border-white/30 text-white bg-transparent h-[24px] flex items-center">{dDay}</span>}
                                        {shouldShowDateChip && <span className="text-[11px] text-gray-300 font-semibold">{formattedDate}</span>}
                                    </div>

                                    <h2 className="text-lg md:text-xl font-[800] tracking-tighter text-white mb-0.5 leading-tight line-clamp-2 drop-shadow-lg">
                                        <HighlightText text={cleanTitle(perf.title) || '제목 없음'} keyword={searchText} />
                                    </h2>

                                    <RecommendationReasonChips
                                        reasons={perf.recommendationReasons}
                                        comparisonTags={perf.comparisonTags}
                                        className="mb-1.5"
                                        compact
                                    />

                                    {!isMovie && (
                                        <div className="flex items-center gap-1 text-gray-300 text-xs font-semibold mt-1">
                                            <MapPin className={clsx("w-3.5 h-3.5 flex-shrink-0", searchMode === 'location' ? "text-emerald-400" : "text-[#a78bfa]")} />
                                            <button onClick={(e) => { e.stopPropagation(); onLocationClick?.({ lat: venueInfo?.lat, lng: venueInfo?.lng, name: perf.venue }); }} className="truncate hover:underline">
                                                <HighlightText text={perf.venue || 'Online'} keyword={searchText} />
                                            </button>
                                        </div>
                                    )}

                                    {!isMovie && (
                                        <div className="flex justify-between items-end mt-2 pt-2 border-t border-white/10">
                                            <div className="flex flex-col justify-end">
                                                {perf.discount && <span className="text-red-500 font-black text-lg leading-none">{perf.discount}</span>}
                                            </div>
                                            <div className="flex flex-col items-end">
                                                {perf.originalPrice && perf.originalPrice !== perf.price && <span className="text-gray-500 text-[10px] line-through mb-0.5">{perf.originalPrice}</span>}
                                                <div className="flex items-baseline gap-1 text-white">
                                                    {(() => {
                                                        const extracted = extractFirstPrice(priceText);
                                                        if (!extracted) return <span className="text-sm font-black text-white/85">{priceText || priceFallbackText}</span>;
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
                                    )}
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
                                            className="w-[20%] bg-white/5 hover:bg-white/20 text-white border border-white/10 py-3 rounded-[15px] flex items-center justify-center transition-colors duration-100 h-[50px] relative"
                                        >
                                            <Share2 className="w-5 h-5" />
                                            {isCopied && <div className="absolute -top-10 bg-black text-xs px-2 py-1 rounded">복사됨</div>}
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onDetail?.(perf); }}
                                            className="flex-1 bg-white ring-1 ring-white/20 text-black hover:bg-gray-200 py-3 rounded-[15px] flex items-center justify-center transition-colors duration-100 font-black h-[50px] gap-2 text-sm"
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

function arePerformanceCardPropsEqual(previous: PerformanceCardProps, next: PerformanceCardProps) {
    return previous.perf === next.perf
        && previous.distLabel === next.distLabel
        && previous.venueInfo === next.venueInfo
        && previous.variant === next.variant
        && previous.isLiked === next.isLiked
        && previous.showRibbon === next.showRibbon
        && previous.ribbonText === next.ribbonText
        && previous.enableActions === next.enableActions
        && previous.isGradient === next.isGradient
        && previous.onDetailPrepare === next.onDetailPrepare
        && previous.searchMode === next.searchMode
        && previous.searchText === next.searchText
        && previous.priority === next.priority
        && previous.enableEffects === next.enableEffects;
}

export default memo(PerformanceCard, arePerformanceCardPropsEqual);
