
import React, { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { Heart, Star, MapPin, Calendar, Share2, Check, Flame, Tag, Plane, Search } from 'lucide-react';
import BuildingStadium from '../BuildingStadium';
import { motion, AnimatePresence } from 'framer-motion';
import { GENRES, GENRE_STYLES, OTT_PLATFORMS, FUTURES_TEAM_LOGOS } from '@/lib/constants';
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

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current || !glareRef.current) return;
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

    return (
        <div
            className="sm:perspective-1000 cursor-pointer group h-full relative hover:z-[2000]"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleCardClick}
        >
            {/* New Gold Shimmer Wrapper Structure */}
            <div
                ref={cardRef}
                className={
                    clsx(
                        "relative transition-transform duration-100 ease-out sm:transform-style-3d shadow-xl light:shadow-none group-hover:shadow-[5px_30px_50px_-12px_rgba(0,0,0,1)] light:group-hover:shadow-none h-full rounded-[15px]",
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
                                        src={perf.image}
                                        optimizationWidth={400}
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
                                                if (onDetail) onDetail();
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
                                        if (onDetail) onDetail();
                                    }}
                                >
                                    <h3 className="font-bold text-lg text-black mb-1 line-clamp-2 group-hover:opacity-80 transition-opacity">
                                        {perf.title.replace(/^\[야구\]\s*/, '').trim()}
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
                                <div className="mt-auto mb-2">
                                    <div className="flex items-center gap-1.5 w-full">
                                        {perf.discount && <span className="text-rose-700 text-xl font-extrabold">{perf.discount}</span>}
                                        {perf.price && <span className="text-black text-xl font-black tracking-tighter">{perf.price}</span>}
                                        {perf.originalPrice && perf.originalPrice !== perf.price && <span className="text-gray-700/60 text-xs line-through">{perf.originalPrice}</span>}
                                    </div>
                                </div>
                                <div className="flex justify-between items-center border-t border-black/10 pt-2 text-black">
                                    <span className="text-white text-xs font-bold bg-black px-2 py-1 rounded whitespace-nowrap">
                                        {GENRES.find(g => g.id === perf.genre)?.label || perf.genre}
                                    </span>
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
                                src={perf.image}
                                optimizationWidth={400}
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

                                    <div className="relative z-10 p-4 pb-8">
                                        {/* Tags/Badges */}
                                        <div className="flex flex-wrap gap-2 mb-1.5">
                                            <span className={clsx(
                                                "px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md border shadow-sm transition-all text-white",
                                                GENRE_STYLES[perf.genre]?.twBg ? `${GENRE_STYLES[perf.genre].twBg} border-white/20` : 'bg-black/30 border-[#a78bfa]/50 text-[#a78bfa]'
                                            )}>
                                                {GENRES.find(g => g.id === perf.genre)?.label || perf.genre}
                                            </span>
                                            {perf.date && (
                                                <span className="text-xs text-gray-300 flex items-center gap-1 font-medium">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    {(() => {
                                                        let dateStr = perf.date;
                                                        dateStr = dateStr.replace(/-/g, '.');
                                                        const parts = dateStr.split('~').map((s: string) => s.trim());
                                                        return (parts.length === 2 && parts[0] === parts[1]) ? parts[0] : dateStr;
                                                    })()}
                                                    {perf.platforms && perf.platforms.length > 0 && (
                                                        <div className="flex gap-1 ml-2 border-l border-white/20 pl-2">
                                                            {perf.platforms.map((p: string) => {
                                                                const platformInfo = OTT_PLATFORMS[p];
                                                                const badgeClass = clsx(
                                                                    "w-6 h-6 flex items-center justify-center rounded-md text-[10px] font-black uppercase cursor-pointer hover:scale-110 transition-transform shadow-md border border-white/10",
                                                                    platformInfo ? platformInfo.color : "bg-gray-600"
                                                                );
                                                                if (platformInfo) {
                                                                    const url = platformInfo.url.replace('{title}', encodeURIComponent(perf.title));
                                                                    return (
                                                                        <a key={p} href={url} target="_blank" rel="noopener noreferrer" className={clsx(badgeClass, "text-white no-underline")} onClick={(e) => e.stopPropagation()} title={`${platformInfo.label}에서 검색`}>
                                                                            {platformInfo.label.substring(0, 1).toUpperCase()}
                                                                        </a>
                                                                    );
                                                                }
                                                                return <span key={p} className={clsx(badgeClass, "text-white")}>{p.substring(0, 1).toUpperCase()}</span>;
                                                            })}
                                                        </div>
                                                    )}
                                                </span>
                                            )}
                                        </div>

                                        {/* Title */}
                                        {/* Title (Link Removed per request) */}
                                        <div className="block relative z-[100]" onClick={e => e.stopPropagation()}>
                                            <h3 className="text-lg md:text-xl font-[800] tracking-tighter text-white mb-0.5 leading-tight line-clamp-2 drop-shadow-lg transition-colors">
                                                {perf.title.replace(/^\[야구\]\s*/, '').trim()}
                                            </h3>
                                        </div>

                                        {/* Platforms Text */}
                                        {perf.platforms && perf.platforms.length > 0 && (
                                            <div className="flex gap-1 items-center mb-1 text-[11px] text-gray-400 font-medium relative z-[101]">
                                                <span className="text-gray-500 font-bold shrink-0">[제공]</span>
                                                <div className="flex flex-wrap gap-1 leading-none">
                                                    {perf.platforms.map((p: string, idx: number) => {
                                                        const platformInfo = OTT_PLATFORMS[p];
                                                        if (!platformInfo) return null;
                                                        const url = platformInfo.url.replace('{title}', encodeURIComponent(perf.title));
                                                        return (
                                                            <span key={idx} className="flex items-center">
                                                                <a href={url} target="_blank" rel="noopener noreferrer" className="hover:text-white hover:underline transition-colors" onClick={(e) => e.stopPropagation()}>
                                                                    {platformInfo.label}
                                                                </a>
                                                                {idx < perf.platforms.length - 1 && <span className="mr-0.5">,</span>}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {/* Venue/Grade Info */}
                                        <div className="flex items-center gap-1.5 mt-1 text-gray-300 text-xs font-medium">
                                            {perf.genre === 'movie' || perf.genre === 'ott' ? (
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

                                        {/* Movie Info (Director/Cast) */}
                                        {(perf.genre === 'movie' || perf.genre === 'ott') && (perf.cast || perf.director || perf.movieInfo) && (
                                            <div className="mt-2 text-xs text-gray-400 space-y-0.5 border-t border-white/10 pt-2">
                                                {perf.director && (
                                                    <div className="flex gap-1 items-start">
                                                        <span className="text-gray-500 font-bold shrink-0">감독</span>
                                                        <a href={`https://m.search.daum.net/search?w=tot&q=${encodeURIComponent(perf.director.replace('더보기', '').trim())}`} target="_blank" rel="noopener noreferrer" className="text-gray-300 truncate hover:text-white hover:underline transition-colors relative z-[100]" onClick={e => e.stopPropagation()}>
                                                            {perf.director.replace('더보기', '').trim()}
                                                        </a>
                                                    </div>
                                                )}
                                                {/* Cast (Added for parity with List View) */}
                                                {perf.cast && perf.cast.length > 0 && (
                                                    <div className="flex gap-1 items-start">
                                                        <span className="text-gray-500 font-bold shrink-0">출연</span>
                                                        <div className="flex flex-wrap gap-x-1 leading-snug">
                                                            {perf.cast.slice(0, 3).map((actor: string, idx: number) => {
                                                                const cleanName = actor.replace('더보기', '').trim();
                                                                if (!cleanName) return null;
                                                                return (
                                                                    <a
                                                                        key={idx}
                                                                        href={`https://m.search.daum.net/search?w=tot&q=${encodeURIComponent(cleanName)}`}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-gray-300 hover:text-white hover:underline transition-colors relative z-[100]"
                                                                        onClick={e => e.stopPropagation()}
                                                                    >
                                                                        {cleanName}{idx < Math.min(perf.cast.length, 3) - 1 ? ',' : ''}
                                                                    </a>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                                {perf.movieInfo && (
                                                    <div className="flex gap-1 items-start">
                                                        <span className="text-gray-500 font-bold shrink-0">정보</span>
                                                        <span className="text-gray-300 line-clamp-1">{perf.movieInfo}</span>
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
