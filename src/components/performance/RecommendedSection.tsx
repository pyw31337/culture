import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import ImageWithFallback from '../ImageWithFallback';
import { FUTURES_TEAM_LOGOS } from '@/lib/constants';
import { cleanTitle } from '@/lib/utils';
import { motion, useMotionValue, animate, useMotionValueEvent } from 'framer-motion';
import { useUserActivity } from '@/hooks/useUserActivity';
import { clsx } from 'clsx';

interface RecommendedSectionProps {
    recommendedItems: any[];
    onLocationClick: (loc: any) => void;
    onToggleLike: (id: string, e: React.MouseEvent) => void;
    likedIds: Set<string>;
    onDetail: (perf: any) => void;
    searchMode?: 'keyword' | 'location';
}

export default function RecommendedSection({ recommendedItems, onLocationClick, onToggleLike, likedIds, onDetail, searchMode = 'keyword' }: RecommendedSectionProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [randomRecs, setRandomRecs] = useState<any[]>([]);
    const [constraints, setConstraints] = useState({ left: 0, right: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const lastDragEndTime = useRef<number>(0);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(true);

    // Motion value for x-axis scroll
    const x = useMotionValue(0);

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
            <div className="flex items-center justify-between mb-4 px-4 sm:px-6 lg:px-8">
                <div className="flex items-center gap-2">
                    <Sparkles className={clsx("w-5 h-5", searchMode === 'location' ? "text-emerald-400 fill-emerald-400/20" : "text-purple-400 fill-purple-400/20")} />
                    <h2 className="text-xl sm:text-2xl font-black text-white light:text-black tracking-tight transition-colors">
                        실시간 인기 <span className={clsx("text-transparent bg-clip-text bg-gradient-to-r", searchMode === 'location' ? "from-emerald-400 to-teal-500" : "from-purple-400 to-pink-500")}>TOP 9</span>
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
                        className="flex gap-10 sm:gap-16 pl-[8%] pr-[8%] pt-4 items-end min-w-max"
                    >
                        {randomRecs.map((perf, idx) => (
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
                                        !isDragging && "hover:shadow-purple-500/30"
                                    )}
                                    whileHover={!isDragging ? { scale: 1.05, zIndex: 30 } : {}}
                                    onPointerDown={handlePointerDown}
                                    onPointerUp={(e) => handlePointerUp(e as any, perf)}
                                >
                                    <ImageWithFallback
                                        src={perf.image || perf.poster}
                                        backupSrc={perf.backupPoster}
                                        alt={perf.title}
                                        fill
                                        className="object-cover pointer-events-none"
                                        sizes="(max-width: 768px) 200px, 260px"
                                        draggable={false}
                                    />

                                    {/* Gradient Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-90" />

                                    {/* VS Badge for Sports */}
                                    {['volleyball', 'basketball', 'baseball', 'handball', 'hockey', 'soccer'].includes(perf.genre) && perf.homeTeam && perf.awayTeam && (
                                        <div className="absolute top-1/2 left-0 w-full -translate-y-1/2 flex justify-between px-3 items-center z-20 pointer-events-none">
                                            <img src={perf.genre === 'baseball' && FUTURES_TEAM_LOGOS[perf.homeTeam] ? FUTURES_TEAM_LOGOS[perf.homeTeam] : perf.homeTeamLogo} alt={perf.homeTeam} className="w-12 h-12 object-contain drop-shadow-md" />
                                            <span className="text-white/80 font-black text-sm italic bg-black/40 px-1.5 rounded">VS</span>
                                            <img src={perf.genre === 'baseball' && FUTURES_TEAM_LOGOS[perf.awayTeam] ? FUTURES_TEAM_LOGOS[perf.awayTeam] : perf.awayTeamLogo} alt={perf.awayTeam} className="w-12 h-12 object-contain drop-shadow-md" />
                                        </div>
                                    )}

                                    {/* Info Overlay */}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-4 text-center z-10">
                                        <h3 className="text-white font-bold text-lg mb-2 line-clamp-2">{cleanTitle(perf.title)}</h3>
                                        <p className="text-gray-300 text-sm mb-4">{perf.date}</p>
                                        <div className="px-5 py-2.5 bg-white text-black font-extrabold text-xs rounded-full shadow-xl">
                                            자세히 보기
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        ))}
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
