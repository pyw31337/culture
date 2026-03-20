import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Sparkles, ChevronLeft, ChevronRight, Share2 } from 'lucide-react';
import ImageWithFallback from '../ImageWithFallback';
import venueData from '@/data/venues.json';
import { FUTURES_TEAM_LOGOS, GENRES } from '@/lib/constants';
import { useTranslations } from 'next-intl';
import { Performance } from '@/types';
import { isSports } from '@/lib/type-guards';
import { cleanTitle } from '@/lib/utils';
import { getGenreIcon } from '../GenreIcons';
import { motion, useMotionValue, animate, useMotionValueEvent } from 'framer-motion';
import { useUserActivity } from '@/hooks/useUserActivity';
import { clsx } from 'clsx';

const venues = venueData as Record<string, any>;

interface RecommendedSectionProps {
    recommendedItems: Performance[];
    onLocationClick: (loc: any) => void;
    onToggleLike: (id: string, e: React.MouseEvent) => void;
    likedIds: Set<string>;
    onDetail: (perf: Performance) => void;
    searchMode?: 'keyword' | 'location';
    onShare?: (id: string, e?: React.MouseEvent) => void;
}

export default function RecommendedSection({ recommendedItems, onLocationClick, onToggleLike, likedIds, onDetail, searchMode = 'keyword', onShare }: RecommendedSectionProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [randomRecs, setRandomRecs] = useState<Performance[]>([]);
    const [constraints, setConstraints] = useState({ left: 0, right: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const lastDragEndTime = useRef<number>(0);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(true);

    // Motion value for x-axis scroll
    const x = useMotionValue(0);

    const t = useTranslations('Common');
    const ta = useTranslations('Actions');
    const tc = useTranslations('Categories');
    const { activity } = useUserActivity();

    // Deterministic Random Score Generator
    const getBaseScore = (id: string) => {
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
            hash = (hash << 5) - hash + id.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash) % 100;
    };

    // Rank Logic
    useEffect(() => {
        if (recommendedItems && recommendedItems.length > 0) {
            const ranked = [...recommendedItems].sort((a, b) => {
                const scoreA = (activity.itemClicks?.[a.id] || 0) * 20 + getBaseScore(a.id);
                const scoreB = (activity.itemClicks?.[b.id] || 0) * 20 + getBaseScore(b.id);
                return scoreB - scoreA;
            });
            setRandomRecs(ranked.slice(0, 9));
        }
    }, [recommendedItems, activity.itemClicks]);

    // Constraint & Arrow Logic
    const updateConstraints = useCallback(() => {
        if (containerRef.current && contentRef.current) {
            const containerWidth = containerRef.current.offsetWidth;
            const contentWidth = contentRef.current.scrollWidth;
            const maxScroll = -(contentWidth - containerWidth + 60);

            setConstraints({
                left: maxScroll,
                right: 0 // Strict right constraint
            });

            // Initial Arrow State Check
            const currentX = x.get();
            setShowLeftArrow(currentX < -10);
            setShowRightArrow(currentX > maxScroll + 10);
        }
    }, [randomRecs, x]);

    useEffect(() => {
        updateConstraints();
        const handleResize = () => updateConstraints();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [updateConstraints]);

    // Track scroll position for arrows
    useMotionValueEvent(x, "change", (latest) => {
        if (!contentRef.current || !containerRef.current) return;
        const containerWidth = containerRef.current.offsetWidth;
        const contentWidth = contentRef.current.scrollWidth;
        const maxScroll = -(contentWidth - containerWidth + 60);

        setShowLeftArrow(latest < -10);
        setShowRightArrow(latest > maxScroll + 10);
    });


    // Arrow Navigation Handlers
    const scroll = (direction: 'left' | 'right') => {
        const currentX = x.get();
        const containerWidth = containerRef.current?.offsetWidth || 300;
        const scrollAmount = containerWidth * 0.8; // Scroll 80% of screen width

        let newX = direction === 'left' ? currentX + scrollAmount : currentX - scrollAmount;

        // Clamp
        const maxScroll = constraints.left;
        if (newX > 0) newX = 0;
        if (newX < maxScroll) newX = maxScroll;

        animate(x, newX, {
            type: "spring",
            stiffness: 300,
            damping: 30
        });
    };

    // Simplified Click Detection
    const pointerPos = useRef({ x: 0, y: 0 });

    const handlePointerDown = (e: React.PointerEvent) => {
        pointerPos.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: React.PointerEvent, perf: any) => {
        // Threshold check
        const diffX = Math.abs(e.clientX - pointerPos.current.x);
        const diffY = Math.abs(e.clientY - pointerPos.current.y);

        // If moved more than 10px, it was a drag or intentional swipe
        if (diffX > 10 || diffY > 10) return;

        // Ensure we aren't currently dragging
        if (isDragging) return;

        onDetail(perf);
    };

    if (randomRecs.length === 0) return null;

    return (
        <section className="mb-8 relative animate-in fade-in slide-in-from-bottom-4 duration-700 group/section">
            <div className="flex items-center justify-between mb-4 text-left pl-[1.6%] pr-[1.6%]">
                <div className="flex items-center gap-2">
                    <Sparkles className={clsx("w-5 h-5", searchMode === 'location' ? "text-emerald-400 fill-emerald-400/20" : "text-purple-400 fill-purple-400/20")} />
                    <h2 className="text-xl sm:text-2xl font-black text-white light:text-black tracking-tight transition-colors">
                        {t.rich('trending_top_9', {
                            top: (chunks) => <span className={clsx("text-transparent bg-clip-text bg-gradient-to-r", searchMode === 'location' ? "from-[#55df99] to-[#0090f5]" : "from-purple-400 to-pink-500")}>TOP 9</span>
                        })}
                    </h2>
                </div>
            </div>

            <div className="relative">
                {/* Left Arrow */}
                {showLeftArrow && (
                    <button
                        onClick={() => scroll('left')}
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-40 p-3 bg-black/50 hover:bg-black/80 text-white rounded-r-xl backdrop-blur-sm transition-all opacity-0 group-hover/section:opacity-100 hidden sm:block"
                    >
                        <ChevronLeft size={32} />
                    </button>
                )}

                {/* Right Arrow */}
                {showRightArrow && (
                    <button
                        onClick={() => scroll('right')}
                        className="absolute right-0 top-1/2 -translate-y-1/2 z-40 p-3 bg-black/50 hover:bg-black/80 text-white rounded-l-xl backdrop-blur-sm transition-all opacity-0 group-hover/section:opacity-100 hidden sm:block"
                    >
                        <ChevronRight size={32} />
                    </button>
                )}

                <div
                    ref={containerRef}
                    className="overflow-hidden cursor-grab active:cursor-grabbing pb-12 transition-all select-none"
                    style={{ touchAction: 'pan-y' }}
                >
                    <motion.div
                        ref={contentRef}
                        drag="x"
                        dragConstraints={constraints}
                        dragElastic={0.6} // Restored elastic feel
                        style={{ x }}
                        onDragStart={() => setIsDragging(true)}
                        onDragEnd={() => {
                            lastDragEndTime.current = Date.now();
                            setIsDragging(false);
                        }}
                        className="flex gap-5 sm:gap-9 pl-[1.6%] pr-[1.6%] pt-4 items-end min-w-max"
                    >
                        {randomRecs.map((perf, idx) => {
                            const sportsPerf = isSports(perf) ? perf : null;
                            return (
                                <div
                                    key={perf.id}
                                    className="flex items-end gap-x-0 flex-shrink-0"
                                >
                                {/* Rank Number - Flexed Left */}
                                <div className="flex-shrink-0 select-none pointer-events-none mb-[-1rem]">
                                    <span
                                        className="text-[10rem] sm:text-[14rem] font-black italic leading-none tracking-tighter text-transparent block mix-blend-[plus-lighter] light:mix-blend-darken"
                                        style={{ WebkitTextStroke: '2px #64748b', opacity: 0.4 }}
                                    >
                                        {idx + 1}
                                    </span>
                                </div>

                                {/* Poster Card */}
                                <motion.div
                                    className={clsx(
                                        "relative w-[200px] sm:w-[260px] h-[300px] sm:h-[390px] rounded-xl overflow-hidden bg-gray-900 shadow-2xl transition-shadow -ml-6",
                                        !isDragging && (searchMode === 'location' ? "hover:shadow-emerald-500/30" : "hover:shadow-purple-500/30")
                                    )}
                                    whileHover={!isDragging ? { scale: 1.05, zIndex: 30 } : {}}
                                    onPointerDown={handlePointerDown}
                                    onPointerUp={(e) => handlePointerUp(e as any, perf)}
                                >
                                    {/* Category Badge */}
                                    <div className="absolute top-3 left-3 z-30 flex gap-1.5 pointer-events-none">
                                        <div className="px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white text-[10px] font-bold">
                                            {tc.has(perf.genre) ? tc(perf.genre) : (GENRES.find(g => g.id === perf.genre)?.label || perf.genre)}
                                        </div>
                                        {perf.category === '독점공연' && (
                                            <div className="px-2 py-0.5 rounded-full bg-orange-500/80 backdrop-blur-md border border-orange-400/30 text-white text-[10px] font-bold shadow-lg shadow-orange-500/20">
                                                {t('exclusive')}
                                            </div>
                                        )}
                                    </div>

                                    <ImageWithFallback
                                        src={perf.image || perf.poster}
                                        backupSrc={perf.backupPoster}
                                        alt={perf.title || ''}
                                        fill
                                        className="object-cover pointer-events-none"
                                        sizes="(max-width: 768px) 200px, 260px"
                                        draggable={false}
                                    />

                                    {/* Gradient Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-90" />

                                    {/* VS Badge for Sports */}
                                    {sportsPerf && sportsPerf.homeTeam && sportsPerf.awayTeam && (
                                        <div className="absolute top-1/2 left-0 w-full -translate-y-1/2 flex justify-between px-3 items-center z-20 pointer-events-none">
                                            {/* Background Decorative Icon */}
                                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.1] text-white pointer-events-none z-[-1]">
                                                {React.isValidElement(getGenreIcon(perf.genre, 120)) ?
                                                    React.cloneElement(getGenreIcon(perf.genre, 120) as React.ReactElement<React.SVGProps<SVGSVGElement>>, { strokeWidth: 1 }) :
                                                    null}
                                            </div>

                                            <img src={perf.genre === 'baseball' && FUTURES_TEAM_LOGOS[sportsPerf.homeTeam] ? FUTURES_TEAM_LOGOS[sportsPerf.homeTeam] : sportsPerf.homeTeamLogo} alt={sportsPerf.homeTeam} className="w-12 h-12 object-contain drop-shadow-md" />
                                            <span className="text-white/80 font-black text-sm italic bg-black/40 px-1.5 rounded border border-white/10">VS</span>
                                            <img src={perf.genre === 'baseball' && FUTURES_TEAM_LOGOS[sportsPerf.awayTeam] ? FUTURES_TEAM_LOGOS[sportsPerf.awayTeam] : sportsPerf.awayTeamLogo} alt={sportsPerf.awayTeam} className="w-12 h-12 object-contain drop-shadow-md" />
                                        </div>
                                    )}

                                    {/* Info Overlay (Detail View) */}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-4 text-center z-10">
                                        <h3 className="text-white font-bold text-lg mb-2 line-clamp-2">{cleanTitle(perf.title)}</h3>
                                        <p className="text-gray-300 text-sm mb-4 font-bold tracking-wider">
                                            {GENRES.find(g => g.id === perf.genre)?.label || perf.genre}
                                        </p>
                                        <div className="px-5 py-2.5 bg-white text-black font-extrabold text-xs rounded-full shadow-xl">
                                            {ta('view_detail')}
                                        </div>
                                    </div>

                                    {/* Bottom Action Bar (Permanent) */}
                                    <div className="absolute inset-x-0 bottom-0 z-20 p-3 flex items-center gap-3 pointer-events-none">
                                        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-0" />

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onShare?.(perf.id, e);
                                            }}
                                            className="relative z-10 w-10 h-10 flex items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 text-white backdrop-blur-md pointer-events-auto transition-all shrink-0 border border-white/10"
                                            title={ta('share')}
                                        >
                                            <ChevronRight size={20} />
                                        </button>

                                        <div className="relative z-10 flex flex-col justify-center min-w-0 h-10 overflow-hidden">
                                            <span className="text-white font-black text-sm sm:text-base leading-tight truncate drop-shadow-md">
                                                {cleanTitle(perf.title)}
                                            </span>
                                            <span className="text-white/60 font-bold text-[10px] sm:text-xs leading-tight truncate uppercase tracking-tight">
                                                {(() => {
                                                    const addr = venues[perf.venue]?.address || '';
                                                    if (!addr) return perf.venue;
                                                    const parts = addr.split(' ');
                                                    // Filter out numbers and specific theater detail rooms
                                                    return parts.slice(0, 3).join(' ');
                                                })()}
                                            </span>
                                        </div>
                                    </div>
                                </motion.div>
                                </div >
                            );
                        })}
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
