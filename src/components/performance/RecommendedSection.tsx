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
}

export default function RecommendedSection({ recommendedItems, onLocationClick, onToggleLike, likedIds, onDetail }: RecommendedSectionProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [randomRecs, setRandomRecs] = useState<any[]>([]);
    const [constraints, setConstraints] = useState({ left: 0, right: 0 });
    const [isDragging, setIsDragging] = useState(false);
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

    // Robust Click Handler
    const handleItemClick = (perf: any, info: any) => {
        // If movement threshold exceeded (dragged), don't trigger click
        // 5px threshold is standard for "click" vs "drag"
        if (Math.abs(info.offset.x) > 5 || Math.abs(info.offset.y) > 5) return;
        onDetail(perf);
    };

    if (randomRecs.length === 0) return null;

    return (
        <section className="mb-16 relative animate-in fade-in slide-in-from-bottom-4 duration-700 group/section">
            <div className="flex items-center justify-between mb-4 px-4 sm:px-6 lg:px-8">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400 fill-purple-400/20" />
                    <h2 className="text-xl sm:text-2xl font-black text-white light:text-black tracking-tight transition-colors">
                        실시간 인기 <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">TOP 9</span>
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
                    className="overflow-hidden cursor-grab active:cursor-grabbing pb-12"
                >
                    <motion.div
                        ref={contentRef}
                        drag="x"
                        dragConstraints={constraints}
                        dragElastic={0.1} // Reduced elasticity for tighter feel
                        style={{ x }}
                        onDragStart={() => setIsDragging(true)}
                        onDragEnd={() => {
                            // Small delay to prevent accidental clicks immediately after drag release
                            setTimeout(() => setIsDragging(false), 50);
                        }}
                        className="flex gap-4 sm:gap-6 pl-[4%] pr-[4%] pt-4 items-end min-w-max"
                    >
                        {randomRecs.map((perf, idx) => (
                            <motion.div
                                key={perf.id}
                                className={clsx(
                                    "relative flex-shrink-0 w-[200px] sm:w-[240px] h-[300px] sm:h-[360px] transition-all duration-300",
                                    // Disable hover effects while dragging to prevent flicker
                                    !isDragging && "hover:z-30 hover:scale-105"
                                )}
                                title={cleanTitle(perf.title)}
                                onTap={(e, info) => handleItemClick(perf, info)}
                            >
                                {/* Rank Number */}
                                <div className="absolute -left-4 sm:-left-10 bottom-0 z-0 h-full flex items-end pointer-events-none select-none">
                                    <span
                                        className="text-[8rem] sm:text-[10rem] font-black italic leading-none tracking-tighter text-transparent"
                                        style={{ WebkitTextStroke: '2px #64748b' }}
                                    >
                                        {idx + 1}
                                    </span>
                                </div>

                                {/* Card Content */}
                                <div className={clsx(
                                    "relative w-full h-full rounded-lg overflow-hidden bg-gray-900 shadow-lg select-none",
                                    // Shadow effect on hover (only if not dragging)
                                    !isDragging && "shadow-purple-500/20"
                                )}>
                                    <ImageWithFallback
                                        src={perf.image || perf.poster}
                                        backupSrc={perf.backupPoster}
                                        alt={perf.title}
                                        fill
                                        className="object-cover pointer-events-none" // Ensure image doesn't hijack drag
                                        sizes="(max-width: 768px) 200px, 240px"
                                        draggable={false} // Native drag disable
                                    />

                                    {/* Gradient Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80" />

                                    {/* VS Badge for Sports */}
                                    {['volleyball', 'basketball', 'baseball', 'handball', 'hockey', 'soccer'].includes(perf.genre) && perf.homeTeam && perf.awayTeam && (
                                        <div className="absolute top-1/2 left-0 w-full -translate-y-1/2 flex justify-between px-3 items-center z-20 pointer-events-none">
                                            <img src={perf.genre === 'baseball' && FUTURES_TEAM_LOGOS[perf.homeTeam] ? FUTURES_TEAM_LOGOS[perf.homeTeam] : perf.homeTeamLogo} alt={perf.homeTeam} className="w-12 h-12 object-contain drop-shadow-md" />
                                            <span className="text-white/80 font-black text-sm italic bg-black/40 px-1.5 rounded">VS</span>
                                            <img src={perf.genre === 'baseball' && FUTURES_TEAM_LOGOS[perf.awayTeam] ? FUTURES_TEAM_LOGOS[perf.awayTeam] : perf.awayTeamLogo} alt={perf.awayTeam} className="w-12 h-12 object-contain drop-shadow-md" />
                                        </div>
                                    )}

                                    {/* Info Overlay (Visible on Hover Only) */}
                                    {!isDragging && (
                                        <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-4 text-center z-10">
                                            <h3 className="text-white font-bold text-lg mb-2 line-clamp-2">{cleanTitle(perf.title)}</h3>
                                            <p className="text-gray-300 text-sm mb-4">{perf.date}</p>
                                            <div className="px-4 py-2 bg-white text-black font-extrabold text-sm rounded-full transform scale-90 hover:scale-100 transition-transform">
                                                자세히 보기
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
