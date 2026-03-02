
import React, { useState, useRef, useMemo, useCallback, memo } from 'react';
import { clsx } from 'clsx';
import { Heart, Star, MapPin, Calendar, Share2, Check, Plane, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { GENRES, GENRE_STYLES, FUTURES_TEAM_LOGOS } from '@/lib/constants';
import { extractFirstPrice, cleanTitle } from '@/lib/utils';
import ImageWithFallback from '../ImageWithFallback';
import { getGenreIcon } from '../GenreIcons';

interface PerformanceListItemProps {
    perf: any;
    distLabel: string | null;
    venueInfo: any;
    onLocationClick: (loc: any) => void;
    isLiked?: boolean;
    onToggleLike?: (id: string, e: React.MouseEvent) => void;
    variant?: 'default' | 'yellow' | 'pink' | 'emerald';
    onShare?: (id: string) => Promise<boolean>;
    onDetail?: (perf: any) => void;
    searchMode?: 'keyword' | 'location';
    searchText?: string;
}

// Helper for Highlighting
const HighlightText = memo(({ text, keyword }: { text: string, keyword?: string }) => {
    if (!keyword || !text || !keyword.trim()) return <>{text}</>;

    const cleanKeyword = keyword.trim();
    const regex = new RegExp(`(${cleanKeyword})`, 'gi');
    const parts = text.split(regex);

    return (
        <>
            {parts.map((part, i) =>
                regex.test(part) ? <span key={i} className="bg-yellow-300 text-red-600 font-extrabold">{part}</span> : part
            )}
        </>
    );
});

HighlightText.displayName = 'HighlightText';

function PerformanceListItem({ perf, distLabel, venueInfo, onLocationClick, isLiked = false, onToggleLike, variant = 'default', onShare, onDetail, searchMode = 'keyword', searchText }: PerformanceListItemProps) {
    const genreStyle = useMemo(() => GENRE_STYLES[perf.genre] || {}, [perf.genre]);
    const [isCopied, setIsCopied] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);
    const glareRef = useRef<HTMLDivElement>(null);

    // Tilt handlers
    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current || !glareRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -5;
        const rotateY = ((x - centerX) / centerX) * 5;
        cardRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.01, 1.01, 1.01)`;
        glareRef.current.style.transform = `translateX(${(x - centerX) / 3}px) translateY(${(y - centerY) / 3}px)`;
        glareRef.current.style.opacity = '1';
    }, []);

    const handleMouseLeave = useCallback(() => {
        if (!cardRef.current || !glareRef.current) return;
        cardRef.current.style.transform = `rotateX(0) rotateY(0) scale(1)`;
        glareRef.current.style.opacity = '0';
    }, []);

    const handleTouchStart = useCallback(() => {
        if (!cardRef.current) return;
        cardRef.current.style.transform = `perspective(1000px) rotateX(3deg) scale3d(0.99, 0.99, 0.99)`;
    }, []);

    const handleTouchEnd = useCallback(() => {
        if (!cardRef.current) return;
        cardRef.current.style.transform = `rotateX(0) rotateY(0) scale(1)`;
    }, []);

    // Variant styles
    const outerVariantStyle = useMemo(() => variant === 'emerald'
        ? "border-emerald-500/40 shadow-[0_4px_20px_-5px_rgba(16,185,129,0.25)] hover:shadow-[0_8px_30px_-5px_rgba(16,185,129,0.4)]"
        : variant === 'pink'
            ? "border-pink-500/40 shadow-[0_4px_20px_-5px_rgba(236,72,153,0.25)] hover:shadow-[0_8px_30px_-5px_rgba(236,72,153,0.4)]"
            : variant === 'yellow'
                ? "border-yellow-500/40 shadow-[0_4px_20px_-5px_rgba(234,179,8,0.25)] hover:shadow-[0_8px_30px_-5px_rgba(234,179,8,0.4)]"
                : "border-white/5 hover:border-white/20 light:border-black/5 light:hover:border-black/10 shadow-xl hover:shadow-2xl light:shadow-none light:hover:shadow-none bg-gray-900 light:bg-white", [variant]);

    const contentBgStyle = useMemo(() => variant === 'emerald'
        ? "bg-emerald-950/40"
        : variant === 'pink'
            ? "bg-pink-950/40"
            : variant === 'yellow'
                ? "bg-yellow-950 light:bg-yellow-100"
                : "", [variant]);

    const handleShareClick = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onShare) {
            const usedClipboard = await onShare(perf.id);
            if (usedClipboard) {
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
            }
        }
    }, [onShare]);

    const handleLocationClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (venueInfo?.lat) onLocationClick({ lat: venueInfo.lat, lng: venueInfo.lng, name: perf.venue });
    }, [venueInfo, onLocationClick, perf.venue]);

    const handleDetailClick = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (onDetail) onDetail(perf);
    }, [onDetail, perf]);

    return (
        <div
            className="perspective-1000 group relative hover:z-[2000]"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onClick={onDetail}
        >
            <div
                ref={cardRef}
                className={clsx(
                    "relative transition-transform duration-100 ease-out transform-style-3d rounded-xl overflow-hidden flex border backface-hidden h-full",
                    outerVariantStyle
                )}
                style={{
                    transformStyle: 'preserve-3d',
                    WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                }}
            >
                <div
                    ref={glareRef}
                    className="absolute inset-0 pointer-events-none z-50 opacity-0 transition-opacity duration-200"
                    style={{
                        background: 'radial-gradient(circle at center, rgba(255,255,255,0.15) 0%, transparent 60%)',
                        mixBlendMode: 'overlay',
                    }}
                />

                <div className="relative w-32 sm:w-48 shrink-0 aspect-[3/4] overflow-hidden isolate z-0 h-full">
                    <ImageWithFallback
                        src={perf.image || perf.poster}
                        backupSrc={perf.backupPoster}
                        optimizationWidth={400}
                        alt={perf.title}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                        sizes="(max-width: 640px) 128px, 192px"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        style={{ zIndex: 2 }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 z-5" />

                    {['volleyball', 'basketball', 'baseball', 'handball', 'soccer'].includes(perf.genre) && perf.homeTeam && perf.awayTeam && (
                        <div className="absolute top-1/2 left-0 w-full -translate-y-1/2 flex justify-between px-2 items-center z-10 pointer-events-none">
                            {/* Background Decorative Icon */}
                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.12] text-white pointer-events-none z-[-1]">
                                {React.isValidElement(getGenreIcon(perf.genre, 90)) ?
                                    React.cloneElement(getGenreIcon(perf.genre, 90) as React.ReactElement<React.SVGProps<SVGSVGElement>>, { strokeWidth: 1.5 }) :
                                    null}
                            </div>

                            <img
                                src={perf.genre === 'baseball' && FUTURES_TEAM_LOGOS[perf.homeTeam] ? FUTURES_TEAM_LOGOS[perf.homeTeam] : perf.homeTeamLogo}
                                alt={perf.homeTeam}
                                className="w-[35%] max-w-[64px] aspect-square object-contain drop-shadow-md"
                            />
                            <div className="text-white/90 font-black text-[10px] sm:text-sm italic bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-[2px] border border-white/10">VS</div>
                            <img
                                src={perf.genre === 'baseball' && FUTURES_TEAM_LOGOS[perf.awayTeam] ? FUTURES_TEAM_LOGOS[perf.awayTeam] : perf.awayTeamLogo}
                                alt={perf.awayTeam}
                                className="w-[35%] max-w-[64px] aspect-square object-contain drop-shadow-md"
                            />
                        </div>
                    )}

                    {distLabel && (
                        <div className="absolute bottom-1 right-1 bg-black/80 text-green-400 text-[10px] font-extrabold px-1.5 py-0.5 rounded border border-green-500/30 backdrop-blur-md z-[60]">
                            {distLabel}
                        </div>
                    )}

                    <button
                        onClick={(e) => onToggleLike && onToggleLike(perf.id, e)}
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
                    <button
                        onClick={handleShareClick}
                        className="absolute bottom-1 left-1 p-1.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 hover:bg-black/60 transition-colors z-[60] flex items-center justify-center group/share"
                    >
                        {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                            <Share2 className="w-3.5 h-3.5 text-white group-hover/share:text-emerald-400 transition-colors" />
                        )}
                    </button>

                    <AnimatePresence>
                        {isCopied && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.8, y: 10 }}
                                className="absolute bottom-8 left-1 bg-black/90 text-white text-[10px] font-extrabold px-2 py-1 round-md whitespace-nowrap border border-white/20 z-[200] shadow-xl"
                            >
                                복사됨!
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className={clsx(
                    "flex-1 p-3 sm:p-5 flex flex-col justify-between relative min-w-0",
                    contentBgStyle
                )}>
                    <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap gap-2 mb-1 items-center">
                            <span className={clsx(
                                "px-2 py-0.5 rounded text-[10px] sm:text-xs font-extrabold border whitespace-nowrap",
                                genreStyle.twBg ? `${genreStyle.twBg} text-white border-white/10` : 'bg-gray-800 text-gray-400 border-gray-700'
                            )}>
                                {GENRES.find(g => g.id === perf.genre)?.label || perf.genre}
                            </span>

                            <span className={clsx(
                                "text-[10px] sm:text-xs flex items-center gap-1 ml-auto sm:ml-0",
                                variant === 'yellow' ? "text-gray-400 light:text-black light:font-extrabold" : "text-gray-400 light:text-black"
                            )}>
                                <Calendar className="w-3 h-3" />
                                {perf.date ? perf.date.split('~')[0].trim() : '상시'}
                            </span>
                        </div>

                        <a href={perf.link} target="_blank" rel="noopener noreferrer" className="block group/link" onClick={e => e.stopPropagation()}>
                            <h3 className={clsx(
                                "text-lg sm:text-xl font-extrabold leading-tight mb-1 transition-colors line-clamp-2",
                                searchMode === 'location' ? "group-hover/link:text-emerald-400" : "group-hover/link:text-[#a78bfa]",
                                variant === 'yellow' ? "text-white light:text-black light:font-black" : "text-white light:text-black"
                            )}>
                                <HighlightText text={cleanTitle(perf.title) || '제목 없음'} keyword={searchText} />
                            </h3>
                        </a>

                        <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-400 light:text-black mt-1">
                            {perf.genre === 'movie' ? (
                                <div className="text-gray-400 text-xs flex items-center gap-1 mb-2 truncate">
                                    {perf.gradeIcon ? (
                                        <img src={perf.gradeIcon} alt="Grade" className="h-[18px] w-auto object-contain" />
                                    ) : (
                                        <>
                                            <span className="text-cyan-400 font-extrabold border border-cyan-400/30 px-1 rounded text-[10px]">등급</span>
                                            {perf.grade || (typeof perf.venue === 'string' && perf.venue.split('|').find((s: string) => s.includes('관람'))?.trim()) || perf.venue}
                                        </>
                                    )}
                                </div>
                            ) : perf.genre === 'travel' ? (
                                <div className="text-gray-400 light:text-black text-xs flex flex-col gap-0.5 mb-2 truncate">
                                    <div className="flex items-center gap-1 font-extrabold text-sky-400">
                                        <Plane className="w-3 h-3" />
                                        {perf.venue.split('|')[0]?.trim()}
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={handleLocationClick}
                                    className="hover:text-white light:hover:text-purple-600 hover:underline truncate text-gray-400 light:text-black text-xs flex items-center gap-1 mb-2"
                                >
                                    <MapPin className="w-3 h-3 flex-shrink-0" />
                                    <span className={clsx("truncate", variant === 'yellow' && "light:font-extrabold")}><HighlightText text={perf.venue} keyword={searchText} /></span>
                                </button>
                            )}
                        </div>

                        {perf.genre === 'movie' && (perf.cast || perf.director || perf.movieInfo || perf.originalTitle || perf.productionCountry || perf.productionYear || perf.subGenre) && (
                            <div className="mt-2 text-xs text-gray-400 light:text-gray-900 space-y-0.5 border-t border-white/10 light:border-black/10 pt-2">
                                {perf.originalTitle && perf.originalTitle !== perf.title && (
                                    <div className="text-gray-500 italic mb-1">{perf.originalTitle}</div>
                                )}
                                {(perf.subGenre || perf.director || perf.cast) && (
                                    <div className="mt-2 space-y-1 text-xs text-gray-400">
                                        {(perf.productionCountry || perf.productionYear || perf.subGenre) && (
                                            <div className="flex flex-col gap-0.5 text-xs text-gray-400">
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

                                        {((perf.castWithLinks && perf.castWithLinks.length > 0) || (perf.cast && Array.isArray(perf.cast) && perf.cast.length > 0)) && (
                                            <div className="flex items-start gap-1">
                                                <span className="text-gray-500 light:text-gray-600 min-w-[24px]">출연</span>
                                                <span className="text-gray-300 light:text-black line-clamp-1">
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
                                    </div>
                                )}

                                {(perf.runningTime || perf.ageRating || perf.price) && (
                                    <div className="text-gray-400 light:text-gray-900 mt-1.5 space-y-1">
                                        {perf.runningTime && (
                                            <div className="flex flex-col gap-0.5 text-xs text-gray-400">
                                                <div>
                                                    <span className="text-gray-500 light:text-gray-600 mr-1">플레이타임:</span>
                                                    <span className="light:text-black">{perf.runningTime}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

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
                                                    <span className="text-lg font-black">무료</span>
                                                ) : (
                                                    <>
                                                        {extracted.label && <span className="text-[10px] text-gray-400 mr-1">{extracted.label}</span>}
                                                        <span className="text-lg font-black">{extracted.price}</span>
                                                        <span className="text-xs font-normal ml-0.5">원</span>
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}

                        <div className="mt-auto pt-3 flex items-center gap-2">
                            <button
                                onClick={handleDetailClick}
                                className={clsx(
                                    "w-full py-2.5 transition-all flex items-center justify-center gap-1 text-xs sm:text-sm rounded-lg border text-left",
                                    "border-white/20 text-gray-400 hover:text-white hover:border-white/40 hover:bg-white/5",
                                    "light:border-0 light:bg-gray-100 light:text-gray-600 light:font-extrabold light:hover:bg-gray-200 light:hover:text-black"
                                )}
                            >
                                자세히 보기
                                <ChevronDown className="-rotate-90 w-3 h-3" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

PerformanceListItem.displayName = 'PerformanceListItem';

export default memo(PerformanceListItem);
