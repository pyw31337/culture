
import React, { useState, useRef } from 'react';
import { clsx } from 'clsx';
import { Heart, Star, MapPin, Calendar, Share2, Check, Plane, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GENRES, GENRE_STYLES, OTT_PLATFORMS, FUTURES_TEAM_LOGOS } from '@/lib/constants';
import { extractFirstPrice } from '@/lib/utils';
import ImageWithFallback from '../ImageWithFallback';

interface PerformanceListItemProps {
    perf: any;
    distLabel: string | null;
    venueInfo: any;
    onLocationClick: (loc: any) => void;
    isLiked?: boolean;
    onToggleLike?: (e: React.MouseEvent) => void;
    variant?: 'default' | 'yellow' | 'pink' | 'emerald';
    onShare?: () => Promise<boolean>;
    onDetail?: () => void;
}

export default function PerformanceListItem({ perf, distLabel, venueInfo, onLocationClick, isLiked = false, onToggleLike, variant = 'default', onShare, onDetail }: PerformanceListItemProps) {
    const genreStyle = GENRE_STYLES[perf.genre] || {};
    const [isCopied, setIsCopied] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);
    const glareRef = useRef<HTMLDivElement>(null);

    // Tilt handlers (same as PerformanceCard)
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current || !glareRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -5; // Less tilt for horizontal card
        const rotateY = ((x - centerX) / centerX) * 5;
        cardRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.01, 1.01, 1.01)`;
        glareRef.current.style.transform = `translateX(${(x - centerX) / 3}px) translateY(${(y - centerY) / 3}px)`;
        glareRef.current.style.opacity = '1';
    };

    const handleMouseLeave = () => {
        if (!cardRef.current || !glareRef.current) return;
        cardRef.current.style.transform = `rotateX(0) rotateY(0) scale(1)`;
        glareRef.current.style.opacity = '0';
    };

    const handleTouchStart = () => {
        if (!cardRef.current) return;
        cardRef.current.style.transform = `perspective(1000px) rotateX(3deg) scale3d(0.99, 0.99, 0.99)`;
    };

    const handleTouchEnd = () => {
        if (!cardRef.current) return;
        cardRef.current.style.transform = `rotateX(0) rotateY(0) scale(1)`;
    };

    // Variant styles for outer card border/shadow
    const outerVariantStyle = variant === 'emerald'
        ? "border-emerald-500/40 shadow-[0_4px_20px_-5px_rgba(16,185,129,0.25)] hover:shadow-[0_8px_30px_-5px_rgba(16,185,129,0.4)]"
        : variant === 'pink'
            ? "border-pink-500/40 shadow-[0_4px_20px_-5px_rgba(236,72,153,0.25)] hover:shadow-[0_8px_30px_-5px_rgba(236,72,153,0.4)]"
            : variant === 'yellow'
                ? "border-yellow-500/40 shadow-[0_4px_20px_-5px_rgba(234,179,8,0.25)] hover:shadow-[0_8px_30px_-5px_rgba(234,179,8,0.4)]"
                : "border-white/5 hover:border-white/20 light:border-black/5 light:hover:border-black/10 shadow-xl hover:shadow-2xl light:shadow-none light:hover:shadow-none bg-gray-900 light:bg-white";

    // Content background for colored variants
    const contentBgStyle = variant === 'emerald'
        ? "bg-emerald-950/40"
        : variant === 'pink'
            ? "bg-pink-950/40"
            : variant === 'yellow'
                ? "bg-yellow-950 light:bg-yellow-100"
                : ""; // Default: transparent (no bg class)

    return (
        <div
            className="perspective-1000 group relative hover:z-[2000]"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            <div
                ref={cardRef}
                className={clsx(
                    "relative transition-transform duration-100 ease-out transform-style-3d rounded-xl overflow-hidden flex border backface-hidden",
                    outerVariantStyle
                )}
                style={{
                    transformStyle: 'preserve-3d',
                    WebkitMaskImage: '-webkit-radial-gradient(white, black)', // Force proper clipping on Safari/Chrome
                }}
            >
                {/* Glare Effect */}
                <div
                    ref={glareRef}
                    className="absolute inset-0 pointer-events-none z-50 opacity-0 transition-opacity duration-200"
                    style={{
                        background: 'radial-gradient(circle at center, rgba(255,255,255,0.15) 0%, transparent 60%)',
                        mixBlendMode: 'overlay',
                    }}
                />

                {/* Image (Left) */}
                <div className="relative w-32 sm:w-48 shrink-0 aspect-[3/4] overflow-hidden isolate z-0">
                    <ImageWithFallback
                        src={perf.image || perf.poster}
                        optimizationWidth={200}
                        alt={perf.title}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                        sizes="(max-width: 640px) 128px, 192px"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />

                    {/* Sports Team Logos Overlay (List View) */}
                    {['volleyball', 'basketball', 'baseball', 'handball', 'hockey', 'soccer'].includes(perf.genre) && perf.homeTeam && perf.awayTeam && (
                        <div className="absolute top-1/2 left-0 w-full -translate-y-1/2 flex justify-between px-2 items-center z-20 pointer-events-none">
                            <img
                                src={perf.genre === 'baseball' && FUTURES_TEAM_LOGOS[perf.homeTeam] ? FUTURES_TEAM_LOGOS[perf.homeTeam] : perf.homeTeamLogo}
                                alt={perf.homeTeam}
                                className="w-[35%] max-w-[64px] aspect-square object-contain"
                            />
                            <div className="text-white/90 font-black text-[10px] sm:text-sm italic bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-[2px]">VS</div>
                            <img
                                src={perf.genre === 'baseball' && FUTURES_TEAM_LOGOS[perf.awayTeam] ? FUTURES_TEAM_LOGOS[perf.awayTeam] : perf.awayTeamLogo}
                                alt={perf.awayTeam}
                                className="w-[35%] max-w-[64px] aspect-square object-contain"
                            />
                        </div>
                    )}

                    {/* Distance Badge on Image */}
                    {distLabel && (
                        <div className="absolute bottom-1 right-1 bg-black/80 text-green-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-green-500/30 backdrop-blur-md z-[60]">
                            {distLabel}
                        </div>
                    )}

                    {/* OTT Platforms on Image (List View) */}
                    {perf.platforms && perf.platforms.length > 0 && (
                        <div className="absolute bottom-1 right-1 flex gap-1 z-[60]">
                            {perf.platforms.map((p: string) => {
                                const platformInfo = OTT_PLATFORMS[p];
                                if (!platformInfo) return null;
                                const url = platformInfo.url.replace('{title}', encodeURIComponent(perf.title));
                                return (
                                    <a
                                        key={p}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className={clsx(
                                            "h-6 flex items-center justify-center rounded-md text-[10px] font-bold uppercase hover:scale-105 transition-transform shadow-md text-white border border-white/10 px-1.5 w-auto",
                                            platformInfo.color
                                        )}
                                        title={`${platformInfo.label}에서 검색`}
                                    >
                                        {platformInfo.label}
                                    </a>
                                );
                            })}
                        </div>
                    )}

                    {/* Like Button (on Image) */}
                    <button
                        onClick={onToggleLike}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 hover:bg-black/60 transition-colors group/heart"
                    >
                        <Heart
                            className={clsx(
                                "w-4 h-4 transition-all duration-300",
                                isLiked
                                    ? "text-pink-500 fill-pink-500 scale-110 drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]"
                                    : "text-gray-300 hover:text-pink-400 hover:scale-110"
                            )}
                        />
                    </button>
                    {/* Share Button (Bottom Left on Image) */}
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
                        className="absolute bottom-1 left-1 p-1.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 hover:bg-black/60 transition-colors z-[60] flex items-center justify-center group/share"
                    >
                        {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                            <Share2 className="w-3.5 h-3.5 text-white group-hover/share:text-emerald-400 transition-colors" />
                        )}
                    </button>

                    {/* Copied Toast for List Item */}
                    <AnimatePresence>
                        {isCopied && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.8, y: 10 }}
                                className="absolute bottom-8 left-1 bg-black/90 text-white text-[10px] font-bold px-2 py-1 round-md whitespace-nowrap border border-white/20 z-[200] shadow-xl"
                            >
                                복사됨!
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Content (Right) - Apply variant background here */}
                <div className={clsx(
                    "flex-1 p-3 sm:p-5 flex flex-col justify-between relative min-w-0",
                    contentBgStyle
                )}>

                    {/* Header: Badges & Title */}
                    <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap gap-2 mb-1 items-center">
                            <span className={clsx(
                                "px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold border whitespace-nowrap",
                                genreStyle.twBg ? `${genreStyle.twBg} text-white border-white/10` : 'bg-gray-800 text-gray-400 border-gray-700'
                            )}>
                                {GENRES.find(g => g.id === perf.genre)?.label || perf.genre}
                            </span>

                            {/* Date - Condensed */}
                            <span className={clsx(
                                "text-[10px] sm:text-xs flex items-center gap-1 ml-auto sm:ml-0",
                                variant === 'yellow' ? "text-gray-400 light:text-black light:font-bold" : "text-gray-400 light:text-black"
                            )}>
                                <Calendar className="w-3 h-3" />
                                {perf.date ? perf.date.split('~')[0].trim() : '상시'}
                            </span>
                        </div>

                        <a href={perf.link} target="_blank" rel="noopener noreferrer" className="block group/link" onClick={e => e.stopPropagation()}>
                            <h3 className={clsx(
                                "text-lg sm:text-xl font-bold leading-tight mb-1 group-hover/link:text-[#a78bfa] transition-colors line-clamp-5",
                                variant === 'yellow' ? "text-white light:text-black light:font-extrabold" : "text-white light:text-black"
                            )}>
                                {perf.title.replace(/^\[야구\]\s*/, '').trim()}
                            </h3>
                        </a>

                        <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-400 light:text-black mt-1">

                            {perf.genre === 'movie' || perf.genre === 'ott' ? (
                                <div className="text-gray-400 text-xs flex items-center gap-1 mb-2 truncate">
                                    {perf.gradeIcon ? (
                                        <img src={perf.gradeIcon} alt="Grade" className="h-[18px] w-auto object-contain" />
                                    ) : (
                                        <>
                                            {/* OTT: Only show Age Rating if present, do not fallback to venue */}
                                            {perf.genre === 'ott' ? (
                                                perf.ageRating && (
                                                    <>
                                                        <span className="text-cyan-400 font-bold border border-cyan-400/30 px-1 rounded text-[10px]">등급</span>
                                                        <span className="text-gray-300">{perf.ageRating}</span>
                                                    </>
                                                )
                                            ) : (
                                                <>
                                                    <span className="text-cyan-400 font-bold border border-cyan-400/30 px-1 rounded text-[10px]">등급</span>
                                                    {perf.grade || perf.venue.split('|').find((s: string) => s.includes('관람'))?.trim() || perf.venue}
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>
                            ) : perf.genre === 'travel' ? (
                                <div className="text-gray-400 light:text-black text-xs flex flex-col gap-0.5 mb-2 truncate">
                                    {/* Agent */}
                                    <div className="flex items-center gap-1 font-bold text-sky-400">
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
                                    className="hover:text-white light:hover:text-purple-600 hover:underline truncate text-gray-400 light:text-black text-xs flex items-center gap-1 mb-2"
                                >
                                    <MapPin className="w-3 h-3 flex-shrink-0" />
                                    <span className={clsx("truncate", variant === 'yellow' && "light:font-bold")}>{perf.venue}</span>
                                </button>
                            )}
                        </div>

                        {/* Movie & OTT Metadata (Cast, Director, Info) */}
                        {/* Movie & OTT Metadata (Cast, Director, Info) */}
                        {(perf.genre === 'movie' || perf.genre === 'ott') && (perf.cast || perf.director || perf.movieInfo || perf.originalTitle || perf.productionCountry || perf.productionYear || perf.subGenre) && (
                            <div className="mt-2 text-xs text-gray-400 light:text-gray-900 space-y-0.5 border-t border-white/10 light:border-black/10 pt-2">
                                {/* OTT Specific: Original Title */}
                                {perf.originalTitle && perf.originalTitle !== perf.title && (
                                    <div className="text-gray-500 italic mb-1">{perf.originalTitle}</div>
                                )}
                                {/* Detailed Metadata (Synced with Card) */}
                                {(perf.subGenre || perf.director || perf.cast || (perf.platforms && perf.platforms.length > 0)) && (
                                    <div className="mt-2 space-y-1 text-xs text-gray-400">

                                        {/* Country / Year / SubGenre */}
                                        {/* Country / Year / SubGenre */}
                                        {(perf.productionCountry || perf.productionYear || perf.subGenre) && (
                                            <div className="flex flex-col gap-0.5 text-gray-500 text-[10px]">
                                                {perf.subGenre && (
                                                    <div>
                                                        <span className="text-gray-500 light:text-gray-600 mr-1">장르:</span>
                                                        <span className="text-gray-400 light:text-gray-900">{perf.subGenre}</span>
                                                    </div>
                                                )}
                                                {perf.productionCountry && (
                                                    <div>
                                                        <span className="text-gray-500 light:text-gray-600 mr-1">제작국가:</span>
                                                        <span className="light:text-gray-900">{perf.productionCountry}</span>
                                                    </div>
                                                )}
                                                {perf.productionYear && (
                                                    <div>
                                                        <span className="text-gray-500 light:text-gray-600 mr-1">제작년도:</span>
                                                        <span className="light:text-gray-900">{perf.productionYear}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Director */}
                                        {perf.director && (
                                            <div className="flex items-start gap-1">
                                                <span className="text-gray-500 light:text-gray-600 min-w-[24px]">감독</span>
                                                <span className="text-gray-300 light:text-black line-clamp-1">
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
                                        {perf.cast && Array.isArray(perf.cast) && perf.cast.length > 0 && (
                                            <div className="flex items-start gap-1">
                                                <span className="text-gray-500 light:text-gray-600 min-w-[24px]">출연</span>
                                                <span className="text-gray-300 light:text-black line-clamp-1">
                                                    {perf.cast.map((c: string, i: number, arr: string[]) => (
                                                        <span key={i}>
                                                            <a
                                                                href={`https://search.naver.com/search.naver?query=${encodeURIComponent(c.trim())}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="hover:text-white hover:underline decoration-white/30"
                                                                onClick={(e) => e.stopPropagation()}
                                                            >
                                                                {c.trim()}
                                                            </a>
                                                            {i < arr.length - 1 && ', '}
                                                        </span>
                                                    ))}
                                                </span>
                                            </div>
                                        )}

                                        {/* Provider (Text) */}
                                        {perf.platforms && perf.platforms.length > 0 && (
                                            <div className="flex items-start gap-1">
                                                <span className="text-gray-500 light:text-gray-600 min-w-[24px]">제공</span>
                                                <span className="text-gray-400 light:text-gray-900 line-clamp-1">
                                                    {perf.platforms.map((p: string, idx: number) => {
                                                        const info = OTT_PLATFORMS[p];
                                                        const url = info ? info.url.replace('{title}', encodeURIComponent(perf.title)) : '#';
                                                        return (
                                                            <span key={p}>
                                                                {idx > 0 && ', '}
                                                                <a
                                                                    href={url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                    className="hover:underline hover:text-black hover:font-bold transition-colors"
                                                                    title={`${info?.label || p}에서 검색`}
                                                                >
                                                                    {info ? info.label : p}
                                                                </a>
                                                            </span>
                                                        );
                                                    })}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Interpark Scraped Details: Time / Age / Info */}
                                {(perf.runningTime || perf.ageRating || perf.price) && (
                                    <div className="text-gray-400 light:text-gray-900 mt-1.5 space-y-1">
                                        {(perf.runningTime || perf.ageRating) && (
                                            <div className="flex flex-col gap-0.5 text-[10px] text-gray-400">
                                                {perf.runningTime && (
                                                    <div>
                                                        <span className="text-gray-500 light:text-gray-600 mr-1">플레이타임:</span>
                                                        <span className="light:text-black">{perf.runningTime}</span>
                                                    </div>
                                                )}
                                                {/* Note: AgeRating is already shown in the header for OTT/Movies, but we keep it here for others if needed, or suppress it to avoid duplication. 
                                                    Currently, Card View shows it in the body. The Header one in List View is prominent. 
                                                    Let's follow Card View: Card view shows it in BODY. 
                                                    Wait, List view has a "Header" grade section (lines 258-268). 
                                                    Card view ALSO has a "Header" grade section (lines 276-286).
                                                    In Card view, I moved OTT rating to the BODY (lines 450).
                                                    So I should potentially HIDE it from the Header in List View for OTT too?
                                                    Actually, in Card View I implemented:
                                                    Header: {perf.genre === 'ott' ? (perf.ageRating && ...) : ...} 
                                                    Body: {perf.ageRating && perf.genre === 'ott' && ...}
                                                    
                                                    Wait, in Card View I replaced the Header rating with specific logic.
                                                    Let's check lines 276-286 of Card View I just edited?
                                                    Actually I edited the HEADER part in Card View? 
                                                    No, I edited the BODY (lines 443-499 in previous turn). 
                                                    Let's check the HEADER part of Card View again.
                                                    Lines 276-286 in `PerformanceCard` (current file content):
                                                    It seems I did NOT edit the header in Card View in the previous step? 
                                                    Wait, let's look at the diff. 
                                                    I edited lines 446 (which was in Body? No, 446 inside `div className="text-gray-400 ..."`).
                                                    Actually, `PerformanceCard` has TWO places for grade?
                                                    One in `isInterestVariant` (Yellow/Pink) -> Header (lines 276).
                                                    One in `Default` variant -> Body (lines 443).
                                                    The user's "Make a Girl" is likely Default variant (OTT).
                                                    So I updated the Default variant body.
                                                    
                                                    In `PerformanceListItem`, the structure is:
                                                    Image (Left)
                                                    Content (Right) -> Header (Badges, Grade) -> Body (Metadata).
                                                    
                                                    The user said "Put the info from OTT thumbnail view exactly into list view".
                                                    So I should render these details in the BODY of the List item.
                                                    And potentially hide the Grade from the Header if it's duplicated?
                                                    In Card (Default), the Grade is ONLY in the body (that overlay text area).
                                                    In List, the Grade is in the Header (lines 258).
                                                    
                                                    I will add the labels to the BODY area here (lines 376).
                                                    And I will mirror the text-only style.
                                                */}
                                                {perf.ageRating && perf.genre === 'ott' && (
                                                    <div>
                                                        <span className="text-gray-500 light:text-gray-600 mr-1">등급:</span>
                                                        <span className="light:text-black">{perf.ageRating}</span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {perf.price && (
                                            <div className="text-xs font-medium text-emerald-400">
                                                🎟️ {perf.price.split('원')[0]}원
                                                {perf.price.includes('%') && (
                                                    <span className="ml-1 text-red-500 text-[10px]">{perf.price.match(/\d+%/)?.[0]}</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {perf.director && (
                                    <div className="flex gap-2 items-start hidden"> {/* Duplicate Hidden */} </div>
                                )}
                                {perf.cast && perf.cast.length > 0 && (
                                    <div className="flex gap-2 items-start hidden"> {/* Duplicate Hidden */} </div>
                                )}
                                {/* Provider (OTT) */}
                                {/* Provider (OTT) - Removed duplicate icon block */}
                                {perf.platforms && perf.platforms.length > 0 && (
                                    <div className="hidden"></div>
                                )}

                                {/* Info */}
                            </div>
                        )}

                        {/* Price & Discount info for List View */}
                        {(perf.price || perf.discount) && (
                            <div className="flex justify-between items-end mt-2 w-full border-t border-white/5 light:border-black/5 pt-2">
                                <div className="flex flex-col justify-end">
                                    {perf.discount && <span className="text-red-500 font-black text-lg">{perf.discount}</span>}
                                    {perf.originalPrice && perf.originalPrice !== perf.price && <span className="text-gray-600 text-xs line-through">{perf.originalPrice}</span>}
                                </div>
                                <div className="flex items-baseline gap-1.5">
                                    {perf.price && (() => {
                                        const extracted = extractFirstPrice(perf.price);
                                        if (!extracted) return <span className="text-white light:text-black font-black text-xl tracking-tighter">{perf.price}</span>;
                                        return (
                                            <div className="text-white light:text-black drop-shadow-md leading-none text-right">
                                                {extracted.price === '무료' ? (
                                                    <span className="text-lg font-extrabold">무료</span>
                                                ) : (
                                                    <>
                                                        {extracted.label && <span className="text-[10px] text-gray-400 mr-1">{extracted.label}</span>}
                                                        <span className="text-lg font-extrabold">{extracted.price}</span>
                                                        <span className="text-xs font-light ml-0.5">원</span>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="mt-auto pt-3 flex items-center gap-2">
                            <a
                                href={perf.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className={clsx(
                                    "w-full py-2.5 transition-all flex items-center justify-center gap-1 text-xs sm:text-sm rounded-lg border",
                                    // Dark Mode: Subtle border/text
                                    "border-white/20 text-gray-400 hover:text-white hover:border-white/40 hover:bg-white/5",
                                    // Light Mode: Visible border/text -> Light Gray Background, No Border
                                    "light:border-0 light:bg-gray-100 light:text-gray-600 light:font-bold light:hover:bg-gray-200 light:hover:text-black"
                                )}
                            >
                                자세히 보기
                                <ChevronDown className="-rotate-90 w-3 h-3" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
