import React, { useRef, useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import ImageWithFallback from '../ImageWithFallback';
import { FUTURES_TEAM_LOGOS } from '@/lib/constants';
import { cleanTitle } from '@/lib/utils';
import { motion, useMotionValue } from 'framer-motion';

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
    const x = useMotionValue(0);

    useEffect(() => {
        // Shuffle and pick 9 items (Netflix style max)
        if (recommendedItems && recommendedItems.length > 0) {
            const shuffled = [...recommendedItems].sort(() => 0.5 - Math.random());
            setRandomRecs(shuffled.slice(0, 9));
        }
    }, [recommendedItems]);

    useEffect(() => {
        const updateConstraints = () => {
            if (containerRef.current && contentRef.current) {
                const containerWidth = containerRef.current.offsetWidth;
                const contentWidth = contentRef.current.scrollWidth;
                // Add padding to constraints
                setConstraints({
                    left: -(contentWidth - containerWidth + 60),
                    right: 40
                });
            }
        };

        updateConstraints();
        window.addEventListener('resize', updateConstraints);
        return () => window.removeEventListener('resize', updateConstraints);
    }, [randomRecs]);

    const handleItemClick = (perf: any, info: any) => {
        // If movement threshold exceeded, don't trigger click
        if (Math.abs(info.offset.x) > 10 || Math.abs(info.offset.y) > 10) return;
        onDetail(perf);
    };

    if (randomRecs.length === 0) return null;

    return (
        <section className="mb-16 relative animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Restored */}
            <div className="flex items-center justify-between mb-8 px-4 sm:px-6 lg:px-8">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400 fill-purple-400/20" />
                    <h2 className="text-xl sm:text-2xl font-black text-white light:text-black tracking-tight transition-colors">
                        실시간 인기 <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">TOP 9</span>
                    </h2>
                </div>
            </div>

            <div
                ref={containerRef}
                className="overflow-hidden cursor-grab active:cursor-grabbing pb-12"
            >
                <motion.div
                    ref={contentRef}
                    drag="x"
                    dragConstraints={constraints}
                    dragElastic={0.15}
                    style={{ x }}
                    onDragStart={() => setIsDragging(true)}
                    onDragEnd={() => setIsDragging(false)}
                    className="flex gap-4 sm:gap-14 pl-[50px] pr-8 items-end pt-12"
                >
                    {randomRecs.map((perf, idx) => (
                        <motion.div
                            key={perf.id}
                            className="relative group flex-shrink-0 w-[240px] sm:w-[280px] h-[315px] sm:h-[370px]"
                            title={cleanTitle(perf.title)}
                            onTap={(e, info) => handleItemClick(perf, info)}
                        >
                            {/* 1. Large Rank Number */}
                            <div className="absolute -left-6 md:-left-[3.75rem] bottom-0 z-0 h-full flex items-end">
                                <span
                                    className="text-[10rem] md:text-[13rem] font-black italic leading-none tracking-tighter text-transparent transition-transform duration-300 group-hover:scale-105 origin-bottom-left"
                                    style={{
                                        WebkitTextStroke: '4px #cbd5e1',
                                    }}
                                >
                                    {idx + 1}
                                </span>
                            </div>

                            {/* 2. Poster Image */}
                            <div className="absolute right-0 bottom-0 w-[220px] sm:w-[260px] h-[315px] sm:h-[370px] z-10 transition-transform duration-300 group-hover:scale-105 group-hover:-translate-y-4 origin-bottom shadow-black/50 drop-shadow-2xl overflow-hidden rounded-md bg-gray-800 pointer-events-none">
                                <div className="w-full h-full relative">
                                    <ImageWithFallback
                                        src={perf.image || perf.poster}
                                        backupSrc={perf.backupPoster}
                                        alt={perf.title}
                                        fill
                                        className="object-cover"
                                        sizes="(max-width: 768px) 220px, 260px"
                                    />
                                    <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors duration-300" />

                                    {['volleyball', 'basketball', 'baseball', 'handball', 'hockey', 'soccer'].includes(perf.genre) && perf.homeTeam && perf.awayTeam && (
                                        <div className="absolute top-1/2 left-0 w-full -translate-y-1/2 flex justify-between px-4 items-center z-20">
                                            <img
                                                src={perf.genre === 'baseball' && FUTURES_TEAM_LOGOS[perf.homeTeam] ? FUTURES_TEAM_LOGOS[perf.homeTeam] : perf.homeTeamLogo}
                                                alt={perf.homeTeam}
                                                className="w-[35%] max-w-[80px] aspect-square object-contain drop-shadow-lg"
                                            />
                                            <div className="text-white/90 font-black text-lg italic bg-black/30 px-2 py-0.5 rounded-full backdrop-blur-[1px]">VS</div>
                                            <img
                                                src={perf.genre === 'baseball' && FUTURES_TEAM_LOGOS[perf.awayTeam] ? FUTURES_TEAM_LOGOS[perf.awayTeam] : perf.awayTeamLogo}
                                                alt={perf.awayTeam}
                                                className="w-[35%] max-w-[80px] aspect-square object-contain drop-shadow-lg"
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* View Details Button Overlay */}
                                <div className="absolute inset-x-0 bottom-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out z-20">
                                    <div className="w-full bg-white text-black font-extrabold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 text-sm">
                                        자세히 보기
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
}

