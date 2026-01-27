
import React, { useState, useRef, useEffect } from 'react'; // Verified: Naver Link Enforced
import { clsx } from 'clsx';
import { Heart, Star, MapPin, Calendar, Share2, Check, Flame, Tag, Plane, Search } from 'lucide-react';
import BuildingStadium from '../BuildingStadium';
import { motion, AnimatePresence } from 'framer-motion';
import { GENRES, GENRE_STYLES, OTT_PLATFORMS, FUTURES_TEAM_LOGOS } from '@/lib/constants';
import { extractFirstPrice, cleanTitle } from '@/lib/utils';
import ImageWithFallback from '../ImageWithFallback';

interface PerformanceCardProps {
    perf: any;
    distLabel: string | null;
    venueInfo: any;
    onLocationClick: (loc: any) => void;
    variant?: 'default' | 'yellow' | 'pink' | 'emerald';
    isLiked?: boolean;
    onToggleLike?: (e: React.MouseEvent) => void;
    showRibbon?: boolean;
    enableActions?: boolean;
    isGradient?: boolean;
    onShare?: () => Promise<boolean>;
    onDetail?: () => void;
}

export default function PerformanceCard({ perf, distLabel, venueInfo, onLocationClick, variant = 'default', isLiked = false, onToggleLike, showRibbon = false, enableActions = false, isGradient = false, onShare, onDetail }: PerformanceCardProps) {
    const [isCopied, setIsCopied] = useState(false);
    const [showActions, setShowActions] = useState(false); // For Mobile Touch

    const cardRef = useRef<HTMLDivElement>(null);
    const glareRef = useRef<HTMLDivElement>(null);

    // D-Day Calculation Helper
    const getDDay = (dateStr: string) => {
        if (!dateStr) return null;
        try {
            // Standardize YYYY-MM-DD or YYYY.MM.DD
            const cleanDate = dateStr.replace(/\./g, '-').split('~')[0].trim();
            const target = new Date(cleanDate);
            const now = new Date();

            // Reset hours to compare dates only
            target.setHours(0, 0, 0, 0);
            now.setHours(0, 0, 0, 0);

            const diffTime = target.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 0) return 'D-Day';
            if (diffDays > 0) return `D-${diffDays}`;
            if (diffDays < 0) {
                // If more than 100 days have passed (D+100), hide the badge
                if (diffDays < -100) return null;
                return `D+${Math.abs(diffDays)}`;
            }
            return null;
        } catch (e) {
            return null;
        }
    };

    const dDay = perf.genre === 'movie' ? getDDay(perf.date) : null;

    const handleMouseEnter = () => {
        if (!cardRef.current) return;
        cardRef.current.style.transition = 'none';
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current || !glareRef.current) return;

        // Disable transition during movement for instant response
        cardRef.current.style.transition = 'none';

        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -10; // Max 10deg
        const rotateY = ((x - centerX) / centerX) * 10;

        cardRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;

        glareRef.current.style.transform = `translateX(${(x - centerX) / 2}px) translateY(${(y - centerY) / 2}px)`;
        glareRef.current.style.opacity = '1';
    };

    const handleMouseLeave = () => {
        if (!cardRef.current || !glareRef.current) return;

        // Enable transition for smooth reset
        cardRef.current.style.transition = 'transform 0.3s ease-out';

        cardRef.current.style.transform = `rotateX(0) rotateY(0) scale(1)`;
        glareRef.current.style.opacity = '0';
    };

    const handleCardClick = (e: React.MouseEvent) => {
        if (onDetail) {
            onDetail();
        } else if (!showActions) {
            setShowActions(true);
        } else {
            setShowActions(false);
        }
    }

    // Global listener to close actions on outside click (Mobile)
    useEffect(() => {
        if (!showActions) return;
        const handleGlobalClick = (e: any) => {
            if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
                setShowActions(false);
            }
        };
        document.addEventListener('touchstart', handleGlobalClick);
        return () => document.removeEventListener('touchstart', handleGlobalClick);
    }, [showActions]);

    const isInterestVariant = ['yellow', 'pink', 'emerald'].includes(variant);

    // Calculate if there are details other than price/discount to manage borders
    const hasOtherDetails = !!(
        (perf.originalTitle && perf.originalTitle !== perf.title) ||
        perf.productionCountry ||
        perf.productionYear ||
        perf.subGenre ||
        perf.runningTime ||
        (perf.ageRating && !['movie', 'ott'].includes(perf.genre)) ||
        perf.director ||
        ((perf.castWithLinks && perf.castWithLinks.length > 0) || (perf.cast && Array.isArray(perf.cast) && perf.cast.length > 0)) ||
        (perf.platforms && perf.platforms.length > 0)
    );

    return (
        <div
            className="sm:perspective-1000 group h-full relative hover:z-[2000]"
            onMouseEnter={handleMouseEnter}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            {/* New Gold Shimmer Wrapper Structure */}
            <div
                ref={cardRef}
                className={
                    clsx(
                        "relative transition-transform ease-out sm:transform-style-3d shadow-xl light:shadow-none group-hover:shadow-[5px_30px_50px_-12px_rgba(0,0,0,1)] light:group-hover:shadow-none h-full rounded-[15px] will-change-transform",
                        variant === 'default' ? "gold-shimmer-wrapper aspect-[3/4]" : "",
                        variant === 'emerald'
                            ? "border border-emerald-500/40 shadow-[0_4px_20px_-5px_rgba(16,185,129,0.25)] hover:shadow-[0_8px_30px_-5px_rgba(16,185,129,0.4)]"
                            : variant === 'pink'
                                ? "border border-pink-500/40 shadow-[0_4px_20px_-5px_rgba(236,72,153,0.25)] hover:shadow-[0_8px_30px_-5px_rgba(236,72,153,0.4)]"
                                : variant === 'yellow'
                                    ? "border border-yellow-500/40 shadow-[0_4px_20px_-5px_rgba(234,179,8,0.25)] hover:shadow-[0_8px_30px_-5px_rgba(234,179,8,0.4)]"
                                    : "border-0"
                    )
                }
                style={{ transformStyle: 'preserve-3d' }}
            >
                {/* Glare Effect */}
                <div
                    ref={glareRef}
                    className="absolute inset-0 pointer-events-none z-50 opacity-0 transition-opacity duration-200 rounded-xl"
                    style={{
                        background: 'radial-gradient(circle at center, rgba(255,255,255,0.15) 0%, transparent 60%)',
                        mixBlendMode: 'overlay',
                    }}
                />

                {/* Shimmer Border (Default Only) */}
                {variant === 'default' && (
                    <div className="gold-shimmer-border" style={{ '--shimmer-color': isGradient ? '#a78bfa' : 'gold' } as React.CSSProperties} />
                )}

                {/* Main Card Content */}
                <div className={clsx(
                    "gold-shimmer-main flex flex-col overflow-hidden h-full rounded-[15px] isolate",
                    isGradient
                        ? "bg-gradient-to-br from-[#2e1065] to-[#0f172a]"
                        : "bg-gray-900"
                )}
                    style={{ transform: 'translateZ(0)' }} // Force stacking context for Safari overflow fix
                >

                    {/* 🎗️ Recommended Ribbon (Only if showRibbon is true) */}
                    {showRibbon && (
                        <div className="absolute top-0 left-0 z-[60] w-24 h-24 pointer-events-none overflow-hidden rounded-tl-xl">
                            <div className="absolute top-0 left-0 bg-[#a78bfa] text-white text-[10px] font-bold py-1 w-32 text-center origin-top-left -rotate-45 translate-y-[18px] -translate-x-[26px] shadow-lg box-border border-b-2 border-white/20">
                                추천 공연
                            </div>
                        </div>
                    )}


                    {/* Like Button (Heart) */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onToggleLike) onToggleLike(e);
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

                    {/* Neon Stroke Effect (Border Gradient) */}
                    {variant !== 'yellow' && variant !== 'pink' && (
                        <div className="absolute inset-[-2px] z-[-1] rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-neon-flow bg-linear-to-tr from-[#ff00cc] via-[#3333ff] to-[#ff00cc] bg-[length:200%_auto] pointer-events-none" />
                    )}

                    {/* Glare Effect 2 */}
                    <div
                        ref={glareRef}
                        className="hidden sm:block absolute inset-0 w-[200%] h-[200%] bg-linear-to-tr from-transparent via-white/10 via-[#a78bfa]/20 via-[#f472b6]/20 via-white/10 to-transparent opacity-0 pointer-events-none z-50 mix-blend-color-dodge transition-opacity duration-300"
                        style={{ left: '-25%', top: '-25%' }}
                    />

                    {/* ========================================================= */}
                    {/*             VARIANT LOGIC: Interest vs Default            */}
                    {/* ========================================================= */}

                    {isInterestVariant ? (
                        /* --- VARIANT: INTEREST (Yellow/Pink/Emerald) --- */
                        <>
                            {/* Image Section (Top, Aspect 3/4) */}
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
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/40 via-transparent to-transparent opacity-60" />
                                </div>
                                {/* Badge */}
                                <div
                                    className={clsx(
                                        "absolute top-2 left-2 text-xs font-bold px-2 py-1 rounded-full shadow-md z-10 flex items-center gap-1 border",
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

                                {/* Action Buttons (Slide Up inside Image) */}
                                {enableActions && (
                                    <div className={clsx(
                                        "absolute inset-x-0 bottom-0 z-50 p-4 pb-4 flex gap-2 items-center justify-between transition-transform duration-300 ease-out",
                                        "translate-y-[100%] group-hover:translate-y-0"
                                    )}>
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                if (onShare) {
                                                    const usedClipboard = await onShare();
                                                    if (usedClipboard) {
                                                        setIsCopied(true);
                                                        setTimeout(() => setIsCopied(false), 2000);
                                                    }
                                                }
                                            }}
                                            className="w-[20%] bg-black/40 hover:bg-black/90 hover:text-white text-white backdrop-blur-md border border-white/20 py-3 rounded-[15px] flex items-center justify-center transition-all font-bold shadow-lg h-[50px] relative group/share"
                                            aria-label="공유하기"
                                        >
                                            <Share2 className="w-5 h-5" />
                                            <AnimatePresence>
                                                {isCopied && (
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        exit={{ opacity: 0, scale: 0.8, y: 10 }}
                                                        className="absolute -top-12 left-1/2 -translate-x-1/2 bg-black/90 text-white text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap border border-white/20 z-[200] shadow-xl flex items-center gap-1"
                                                    >
                                                        <span className="text-emerald-400">✓</span> 복사됨!
                                                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black/90 border-r border-b border-white/20 rotate-45 transform" />
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if ((perf.genre === 'movie' || perf.genre === 'ott') && perf.link) {
                                                    window.open(perf.link, '_blank', 'noopener,noreferrer');
                                                } else if (onDetail) {
                                                    onDetail();
                                                }
                                            }}
                                            className="flex-1 bg-black/60 text-white hover:bg-black/90 backdrop-blur-md border border-white/20 py-3 rounded-[15px] flex items-center justify-center transition-all font-extrabold shadow-lg h-[50px] gap-2 text-sm"
                                        >
                                            자세히 보기
                                            <Search className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Content Section (Bottom, Yellow/Pink/Emerald) */}
                            <div className={clsx(
                                "relative flex-1 sm:transform-style-3d overflow-hidden p-4 flex flex-col min-h-0",
                                variant === 'yellow' ? "bg-yellow-400" : variant === 'emerald' ? "bg-emerald-500" : "bg-pink-500"
                            )} style={{ transform: 'translateZ(10px)' }}>

                                {/* Text Content Area */}
                                <button
                                    className="block group/link relative z-[100] text-left w-full"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if ((perf.genre === 'movie' || perf.genre === 'ott') && perf.link) {
                                            window.open(perf.link, '_blank', 'noopener,noreferrer');
                                        } else if (onDetail) {
                                            onDetail();
                                        }
                                    }}
                                >
                                    <h3 className="font-bold text-lg text-black mb-1 line-clamp-2 group-hover:opacity-80 transition-opacity">
                                        {cleanTitle(perf.title)}
                                    </h3>
                                </button>

                                {perf.genre === 'movie' || perf.genre === 'ott' ? (
                                    <div className="text-gray-800 text-sm flex items-center gap-1 mb-2 w-max cursor-default">
                                        {perf.gradeIcon ? (
                                            <img src={perf.gradeIcon} alt="Grade" className="h-[20px] w-auto object-contain" />
                                        ) : (
                                            <>
                                                <span className="text-cyan-600 font-bold text-xs border border-cyan-600/30 px-1 rounded">등급</span>
                                                {perf.grade || perf.venue.split('|').find((s: string) => s.includes('관람'))?.trim() || perf.venue}
                                            </>
                                        )}
                                    </div>
                                ) : perf.genre === 'travel' ? (
                                    <div className="text-gray-800 text-xs flex flex-col gap-0.5 mb-2 w-max cursor-default">
                                        <div className="flex items-center gap-1 font-bold text-sky-700">
                                            <Plane className="w-3 h-3" />
                                            {perf.venue.split('|')[0]?.trim()}
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (venueInfo?.lat) onLocationClick({ lat: venueInfo.lat, lng: venueInfo.lng, name: perf.venue });
                                        }}
                                        className="text-gray-800 text-sm flex items-center gap-1 mb-2 hover:text-black hover:font-bold cursor-pointer w-max"
                                    >
                                        <MapPin className="w-3 h-3 text-gray-700 flex-shrink-0" />
                                        <span className="truncate">{perf.venue}</span>
                                    </button>
                                )}
                                {/* Price Section (Unified Style) */}
                                <div className="mt-auto mb-2 w-full">
                                    {(perf.price || perf.discount) && (
                                        <div className="flex justify-between items-end w-full border-t border-black/10 pt-2">
                                            <div className="flex flex-col justify-end leading-none">
                                                {perf.discount && <span className="text-red-600 font-black text-lg">{perf.discount}</span>}
                                            </div>
                                            <div className="flex flex-col items-end leading-none">
                                                {perf.originalPrice && perf.originalPrice !== perf.price && <span className="text-black/40 text-[10px] line-through mb-0.5">{perf.originalPrice}</span>}
                                                <div className="flex items-baseline gap-1.5">
                                                    {perf.price && (() => {
                                                        const extracted = extractFirstPrice(perf.price);
                                                        if (!extracted) return <span className="text-black font-black text-lg tracking-tighter text-right">{perf.price}</span>;
                                                        return (
                                                            <div className="text-black leading-none text-right">
                                                                {extracted.price === '무료' ? (
                                                                    <span className="text-lg font-extrabold">무료</span>
                                                                ) : (
                                                                    <>
                                                                        {extracted.label && <span className="text-[10px] text-black/60 mr-1">{extracted.label}</span>}
                                                                        <span className="text-xl font-extrabold tracking-tight">{extracted.price}</span>
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
                                <div className="flex justify-between items-center border-t border-black/10 pt-2 text-black">
                                    <span className="text-white text-xs font-bold bg-black px-2 py-1 rounded whitespace-nowrap">
                                        {GENRES.find(g => g.id === perf.genre)?.label || perf.genre}
                                    </span>
                                    {dDay && (
                                        <span className="text-white text-[10px] font-bold bg-transparent border border-white/30 px-2 rounded-full whitespace-nowrap flex items-center justify-center h-[20px]">
                                            {dDay}
                                        </span>
                                    )}
                                    <span className="text-[13px] font-bold opacity-70">{perf.date}</span>
                                    {perf.platforms && perf.platforms.length > 0 && (
                                        <div className="flex gap-1 ml-2">
                                            {perf.platforms.map((p: string) => {
                                                const platformInfo = OTT_PLATFORMS[p];
                                                if (platformInfo) {
                                                    const url = platformInfo.url.replace('{title}', encodeURIComponent(perf.title));
                                                    return (
                                                        <a
                                                            key={p}
                                                            href={url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={(e) => e.stopPropagation()}
                                                            className={clsx("text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter text-white hover:opacity-80 transition-opacity",
                                                                platformInfo.color
                                                            )}
                                                            title={`${platformInfo.label}에서 검색`}
                                                        >
                                                            {platformInfo.label.substring(0, 1).toUpperCase()}
                                                        </a>
                                                    );
                                                }
                                                return (
                                                    <span key={p} className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter bg-gray-600 text-white">
                                                        {p.substring(0, 1).toUpperCase()}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        /* --- VARIANT: DEFAULT (Spotlight/Standard) --- */
                        <div className="relative h-full w-full">
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
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent rounded-xl" />

                            {/* Volleyball/Basketball/Baseball/Handball/Hockey Team Logos Overlay */}
                            {['volleyball', 'basketball', 'baseball', 'handball', 'hockey', 'soccer'].includes(perf.genre) && perf.homeTeam && perf.awayTeam && (
                                <div className="absolute top-1/2 left-0 w-full -translate-y-1/2 flex justify-between px-4 items-center z-20 pointer-events-none" style={{ transform: 'translateZ(25px)' }}>
                                    <img
                                        src={perf.genre === 'baseball' && FUTURES_TEAM_LOGOS[perf.homeTeam] ? FUTURES_TEAM_LOGOS[perf.homeTeam] : perf.homeTeamLogo}
                                        alt={perf.homeTeam}
                                        className="w-[35%] max-w-[96px] aspect-square object-contain"
                                    />
                                    <div className="text-white/90 font-black text-xs sm:text-base md:text-xl italic bg-black/30 px-2 py-0.5 rounded-full backdrop-blur-[1px]">VS</div>
                                    <img
                                        src={perf.genre === 'baseball' && FUTURES_TEAM_LOGOS[perf.awayTeam] ? FUTURES_TEAM_LOGOS[perf.awayTeam] : perf.awayTeamLogo}
                                        alt={perf.awayTeam}
                                        className="w-[35%] max-w-[96px] aspect-square object-contain"
                                    />
                                </div>
                            )}

                            {/* Hot Deal Badge (Top Left) */}
                            {perf.discount && (
                                <div
                                    className="absolute top-2 left-2 z-40 bg-black/80 text-rose-500 border border-rose-500/30 px-2 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1 backdrop-blur-sm"
                                    style={{ transform: 'translateZ(20px)' }}
                                >
                                    <Flame className="w-3 h-3 fill-rose-500" />
                                    핫딜
                                </div>
                            )}


                            <div
                                className={clsx(
                                    "absolute inset-x-0 bottom-0 z-[70] flex flex-col justify-end transition-transform duration-300 ease-out will-change-transform",
                                    enableActions
                                        ? (showActions ? "translate-y-0" : "translate-y-[82px] group-hover:translate-y-0")
                                        : "translate-y-0"
                                )}
                                style={{ transform: 'translateZ(30px)', transformStyle: 'preserve-3d' }}
                            >
                                {/* Text Content */}
                                <div className="relative z-20 w-full">
                                    {/* Gradient Background - moves with text */}
                                    <div className="absolute inset-0 -top-24 bg-gradient-to-t from-black/95 via-black/80 to-transparent pointer-events-none" />

                                    <div className="relative z-10 p-4 pb-4">
                                        {/* Tags/Badges */}
                                        <div className="flex flex-wrap gap-2 mb-1.5 items-center">
                                            <span className={clsx(
                                                "px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md border shadow-sm transition-all text-white",
                                                GENRE_STYLES[perf.genre]?.twBg ? `${GENRE_STYLES[perf.genre].twBg} border-white/20` : 'bg-black/30 border-[#a78bfa]/50 text-[#a78bfa]'
                                            )}>
                                                {GENRES.find(g => g.id === perf.genre)?.label || perf.genre}
                                            </span>

                                            {/* D-Day Badge (Movie Only) - Style Updated */}
                                            {dDay && (
                                                <span className="px-2 rounded-full text-[10px] font-bold backdrop-blur-md border border-white/30 text-white bg-transparent flex items-center justify-center h-[24px]">
                                                    {dDay}
                                                </span>
                                            )}

                                            {/* [OTT] [N] Date Format Logic */}
                                            {perf.genre === 'ott' && perf.platforms && perf.platforms.length > 0 && (
                                                <div className="flex gap-1 items-center relative z-[200]" style={{ transform: 'translateZ(100px)' }}>
                                                    {perf.platforms.map((p: string) => {
                                                        const platformInfo = OTT_PLATFORMS[p];
                                                        if (platformInfo) {
                                                            // Use platform specific search URL
                                                            const url = platformInfo.url.replace('{title}', encodeURIComponent(perf.title));
                                                            return (
                                                                <a
                                                                    key={p}
                                                                    href={url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        // e.nativeEvent.stopImmediatePropagation(); // Stronger stop
                                                                    }}
                                                                    className={clsx("w-5 h-5 flex items-center justify-center rounded-md text-[10px] font-extrabold uppercase text-white shadow-sm hover:opacity-80 hover:scale-110 transition-all cursor-pointer pointer-events-auto relative",
                                                                        platformInfo.color
                                                                    )}
                                                                    title={`${platformInfo.label} 보러가기`}
                                                                    style={{ zIndex: 201 }} // Explicit inline Z-index to force top
                                                                >
                                                                    {platformInfo.label.substring(0, 1).toUpperCase()}
                                                                </a>
                                                            );
                                                        }
                                                        return null;
                                                    })}
                                                </div>
                                            )}

                                            {perf.date && (
                                                <span className="text-xs text-gray-300 flex items-center gap-1 font-medium">
                                                    {perf.genre !== 'ott' && <Calendar className="w-3.5 h-3.5" />}
                                                    {(() => {
                                                        let dateStr = perf.date;
                                                        // Clean up date string:
                                                        // 1. Remove tags like [얼리버드], [유효기간:~xxxx.xx.xx], etc.
                                                        dateStr = dateStr.replace(/\[(?:얼리버드|유효기간[:\s～~]*[^\\]]*|[^\]]*)\]/g, '');
                                                        // 2. Remove orphan brackets
                                                        dateStr = dateStr.replace(/[\[\]]/g, '');
                                                        // 3. Normalize dashes to dots, remove trailing dots
                                                        dateStr = dateStr.replace(/-/g, '.').replace(/\.+$/, '').trim();
                                                        // 4. If date is like "~2026.03.02 ~2026.03.02", take just one
                                                        const parts = dateStr.split('~').map((s: string) => s.trim()).filter(Boolean);
                                                        if (parts.length === 2 && parts[0] === parts[1]) {
                                                            return parts[0];
                                                        } else if (parts.length >= 1 && dateStr.startsWith('~')) {
                                                            // Format: "~2026.03.02" - just return the clean end date
                                                            return `~${parts[parts.length - 1]}`;
                                                        }
                                                        return dateStr;
                                                    })()}
                                                </span>
                                            )}
                                        </div>

                                        {/* Title */}
                                        {/* Title (Link Removed per request) */}
                                        <div className="block relative z-[100]" onClick={e => e.stopPropagation()}>
                                            <h3 className="text-lg md:text-xl font-[800] tracking-tighter text-white mb-0.5 leading-tight line-clamp-2 drop-shadow-lg transition-colors">
                                                {cleanTitle(perf.title) || '제목 없음'}
                                            </h3>
                                        </div>

                                        {/* Platforms Text */}

                                        {/* Venue/Grade Info - Hide for non-movie/ott when no detail info */}
                                        {(perf.genre === 'movie' || perf.genre === 'ott' || perf.cast || perf.director || perf.movieInfo || perf.originalTitle || perf.productionCountry || perf.productionYear || perf.subGenre || perf.runningTime || perf.ageRating) && (
                                            <div className="flex items-center gap-1.5 mt-1 text-gray-300 text-xs font-medium">
                                                {perf.genre === 'ott' ? (
                                                    perf.ageRating && (
                                                        <div className="text-gray-400 text-xs flex items-center gap-1 truncate h-[20px]">
                                                            <span className="text-cyan-400 font-bold border border-cyan-400/30 px-1 rounded text-[10px]">등급</span>
                                                            <span className="text-gray-300">{perf.ageRating}</span>
                                                        </div>
                                                    )
                                                ) : perf.genre === 'movie' ? (
                                                    <div className="text-gray-400 text-xs flex items-center gap-1 truncate h-[20px]">
                                                        {perf.gradeIcon ? (
                                                            <img src={perf.gradeIcon} alt="Grade" className="h-full w-auto object-contain" />
                                                        ) : (
                                                            <>
                                                                <span className="text-cyan-400 font-bold border border-cyan-400/30 px-1 rounded text-[10px]">등급</span>
                                                                {perf.grade || (perf.venue || 'Online').split('|').find((s: string) => s.includes('관람'))?.trim() || perf.venue || 'Online'}
                                                            </>
                                                        )}
                                                    </div>
                                                ) : perf.genre === 'travel' ? (
                                                    <div className="text-gray-400 text-xs flex flex-col gap-0.5 truncate h-auto">
                                                        <div className="flex items-center gap-1 font-bold text-sky-400">
                                                            <Plane className="w-3.5 h-3.5" />
                                                            {perf.venue.split('|')[0]?.trim()}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (onLocationClick) {
                                                            onLocationClick({ lat: venueInfo?.lat || 0, lng: venueInfo?.lng || 0, name: perf.venue || 'Online' });
                                                        }
                                                    }} className="flex items-center gap-1 hover:text-[#a78bfa] hover:underline truncate relative z-[100] cursor-pointer max-w-full">
                                                        <MapPin className="w-3.5 h-3.5 text-[#a78bfa] flex-shrink-0" />
                                                        <span className="truncate">{perf.venue || 'Online'}</span>
                                                    </button>
                                                )}
                                            </div>
                                        )}

                                        {/* Movie/Performance Info (Director/Cast/Runtime/Price/Age) */}
                                        {(perf.cast || perf.director || perf.movieInfo || perf.originalTitle || perf.productionCountry || perf.productionYear || perf.subGenre || perf.runningTime || perf.price || perf.ageRating || (perf.platforms && perf.platforms.length > 0)) && (
                                            <div className={clsx("mt-2 text-xs text-gray-400 space-y-0.5", hasOtherDetails ? "pt-1 border-t border-white/10" : "pt-0")}>
                                                {/* OTT Specific: Original Title */}
                                                {perf.originalTitle && perf.originalTitle !== perf.title && (
                                                    <div className="text-gray-500 italic mb-0.5 line-clamp-1">{perf.originalTitle}</div>
                                                )}

                                                {/* Country / Year / SubGenre */}
                                                {(perf.productionCountry || perf.productionYear || perf.subGenre) && (
                                                    <div className="flex flex-col gap-0.5 text-gray-500 text-xs">
                                                        {perf.subGenre && (
                                                            <div>
                                                                <span className="text-gray-500 mr-1">장르:</span>
                                                                <span className="text-gray-400">{perf.subGenre}</span>
                                                            </div>
                                                        )}
                                                        {perf.productionCountry && (
                                                            <div>
                                                                <span className="text-gray-500 mr-1">제작국가:</span>
                                                                <span>{perf.productionCountry}</span>
                                                            </div>
                                                        )}
                                                        {perf.productionYear && (
                                                            <div>
                                                                <span className="text-gray-500 mr-1">제작년도:</span>
                                                                <span>{perf.productionYear}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Runtime */}
                                                {perf.runningTime && (
                                                    <div className="flex flex-col gap-0.5 text-xs text-gray-400 mt-0.5">
                                                        <div>
                                                            <span className="text-gray-500 mr-1">플레이타임:</span>
                                                            <span>{perf.runningTime}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Age Rating (For non-Movie/OTT which show it in header) */}
                                                {perf.ageRating && !['movie', 'ott'].includes(perf.genre) && (
                                                    <div className="flex flex-col gap-0.5 text-xs text-gray-400 mt-0.5">
                                                        <div>
                                                            <span className="text-gray-500 mr-1">관람연령:</span>
                                                            <span>{perf.ageRating}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Director */}
                                                {(perf.director) && (
                                                    <div className="flex items-start gap-1">
                                                        <span className="text-gray-500 min-w-[24px]">감독</span>
                                                        <span className="text-gray-300 line-clamp-1">
                                                            {perf.director.split(',').map((d: string, i: number, arr: string[]) => (
                                                                <span key={i}>
                                                                    <a
                                                                        href={`https://search.naver.com/search.naver?query=${encodeURIComponent(d.trim())}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="hover:text-white hover:underline decoration-white/30"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    >
                                                                        {d.trim()}
                                                                    </a>
                                                                    {i < arr.length - 1 && ', '}
                                                                </span>
                                                            ))}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Cast */}
                                                {((perf.castWithLinks && perf.castWithLinks.length > 0) || (perf.cast && Array.isArray(perf.cast) && perf.cast.length > 0)) && (
                                                    <div className="flex items-start gap-1">
                                                        <span className="text-gray-500 min-w-[24px]">출연</span>
                                                        <span className="text-gray-300 line-clamp-2 leading-tight">
                                                            {(perf.castWithLinks || perf.cast).map((c: any, i: number, arr: any[]) => {
                                                                const isObj = typeof c === 'object' && c !== null;
                                                                const name = isObj ? c.name : c;
                                                                const url = `https://search.naver.com/search.naver?query=${encodeURIComponent(name.replace('더보기', '').trim())}`;

                                                                return (
                                                                    <span key={i}>
                                                                        <a
                                                                            href={url}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="hover:text-white hover:underline decoration-white/30"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            {name.trim()}
                                                                        </a>
                                                                        {i < arr.length - 1 && ', '}
                                                                    </span>
                                                                );
                                                            })}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* Price & Discount (Unified Style) */}
                                                {(perf.price || perf.discount) && (
                                                    <div className={clsx("flex justify-between items-end mt-2 w-full pt-2", (hasOtherDetails || perf.genre === 'travel') ? "border-t border-white/10" : "")}>
                                                        <div className="flex flex-col justify-end leading-none">
                                                            {perf.discount && <span className="text-red-500 font-black text-lg">{perf.discount}</span>}
                                                        </div>
                                                        <div className="flex flex-col items-end leading-none">
                                                            {perf.originalPrice && perf.originalPrice !== perf.price && <span className="text-gray-500 text-[10px] line-through mb-0.5">{perf.originalPrice}</span>}
                                                            <div className="flex items-baseline gap-1.5">
                                                                {perf.price && (() => {
                                                                    const extracted = extractFirstPrice(perf.price);
                                                                    if (!extracted) return <span className="text-white font-black text-lg tracking-tighter text-right">{perf.price}</span>;
                                                                    return (
                                                                        <div className="text-white drop-shadow-md leading-none text-right">
                                                                            {extracted.price === '무료' ? (
                                                                                <span className="text-lg font-extrabold">무료</span>
                                                                            ) : (
                                                                                <>
                                                                                    {extracted.label && <span className="text-[10px] text-gray-400 mr-1">{extracted.label}</span>}
                                                                                    <span className="text-xl font-extrabold tracking-tight">{extracted.price}</span>
                                                                                    <span className="text-xs font-light ml-0.5">원</span>
                                                                                </>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Provider (Text) - Moved to bottom */}
                                                {perf.platforms && perf.platforms.length > 0 && (
                                                    <div className="flex items-start gap-1 mt-1">
                                                        <span className="text-gray-500 min-w-[24px]">제공</span>
                                                        <span className="text-gray-300 line-clamp-1 flex gap-1">
                                                            {perf.platforms.map((p: string, i: number) => {
                                                                const info = OTT_PLATFORMS[p];
                                                                if (info) {
                                                                    const url = info.url.replace('{title}', encodeURIComponent(perf.title));
                                                                    return (
                                                                        <a
                                                                            key={p}
                                                                            href={url}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                            className="hover:text-white hover:underline decoration-white/30"
                                                                        >
                                                                            {info.label}{i < perf.platforms.length - 1 ? ', ' : ''}
                                                                        </a>
                                                                    );
                                                                }
                                                                return <span key={p}>{p}{i < perf.platforms.length - 1 ? ', ' : ''}</span>;
                                                            })}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                    </div>
                                </div>

                                {/* Actions Area (Height approx 82px) */}
                                {enableActions && (
                                    <div className="relative z-20 p-4 pb-4 bg-black/95 flex gap-2 items-center justify-between">
                                        <button
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                if (onShare) {
                                                    const usedClipboard = await onShare();
                                                    if (usedClipboard) {
                                                        setIsCopied(true);
                                                        setTimeout(() => setIsCopied(false), 2000);
                                                    }
                                                }
                                            }}
                                            className="w-[20%] bg-white/5 hover:bg-white/20 text-white border border-white/10 py-3 rounded-[15px] flex items-center justify-center transition-all font-bold shadow-lg h-[50px] relative group/share"
                                            aria-label="공유하기"
                                        >
                                            <Share2 className="w-5 h-5" />
                                            <AnimatePresence>
                                                {isCopied && (
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        exit={{ opacity: 0, scale: 0.8, y: 10 }}
                                                        className="absolute -top-12 left-1/2 -translate-x-1/2 bg-black/90 text-white text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap border border-white/20 z-[200] shadow-xl flex items-center gap-1"
                                                    >
                                                        <span className="text-emerald-400">✓</span> 복사됨!
                                                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black/90 border-r border-b border-white/20 rotate-45 transform" />
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (onDetail) onDetail();
                                            }}
                                            className="flex-1 bg-white ring-1 ring-white/20 text-black hover:bg-gray-200 py-3 rounded-[15px] flex items-center justify-center transition-all font-extrabold shadow-lg h-[50px] gap-2 text-sm"
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
