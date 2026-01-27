import React, { useRef, useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import ImageWithFallback from '../ImageWithFallback';
import { FUTURES_TEAM_LOGOS } from '@/lib/constants';
import { cleanTitle } from '@/lib/utils';

interface RecommendedSectionProps {
    recommendedItems: any[];
    onLocationClick: (loc: any) => void;
    onToggleLike: (id: string, e: React.MouseEvent) => void;
    likedIds: Set<string>;
    onDetail: (perf: any) => void;
}

export default function RecommendedSection({ recommendedItems, onLocationClick, onToggleLike, likedIds, onDetail }: RecommendedSectionProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [randomRecs, setRandomRecs] = useState<any[]>([]);

    useEffect(() => {
        // Shuffle and pick 9 items (Netflix style max)
        if (recommendedItems && recommendedItems.length > 0) {
            const shuffled = [...recommendedItems].sort(() => 0.5 - Math.random());
            setRandomRecs(shuffled.slice(0, 9));
        }
    }, [recommendedItems]);

    // Drag to Scroll Handlers
    const onMouseDown = (e: React.MouseEvent) => {
        if (!scrollRef.current) return;
        setIsDragging(true);
        setStartX(e.pageX - scrollRef.current.offsetLeft);
        setScrollLeft(scrollRef.current.scrollLeft);
    };

    const onMouseLeave = () => {
        setIsDragging(false);
    };

    const onMouseUp = () => {
        setIsDragging(false);
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollRef.current.offsetLeft;
        const walk = (x - startX) * 2; // Scroll-fast
        scrollRef.current.scrollLeft = scrollLeft - walk;
    };

    if (randomRecs.length === 0) return null;

    return (
        <section className="mb-16 relative animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* ... (header) */}

            <div
                ref={scrollRef}
                className="flex gap-4 sm:gap-14 overflow-x-auto pb-12 scrollbar-hide pl-[50px] pr-4 sm:pr-6 lg:pr-8 select-none cursor-grab active:cursor-grabbing items-end pt-12"
                onMouseDown={onMouseDown}
                onMouseLeave={onMouseLeave}
                onMouseUp={onMouseUp}
                onMouseMove={onMouseMove}
                style={{ scrollBehavior: isDragging ? 'auto' : 'smooth' }}
            >
                {randomRecs.map((perf, idx) => (
                    <div
                        key={perf.id}
                        className="relative group flex-shrink-0 w-[240px] sm:w-[280px] h-[315px] sm:h-[370px] cursor-pointer"
                        title={cleanTitle(perf.title)}
                    >
                        {/* 1. Large Rank Number (Left/Behind) */}
                        <div className="absolute -left-6 md:-left-[3.75rem] bottom-0 z-0 h-full flex items-end">
                            <span
                                className="text-[10rem] md:text-[13rem] font-black italic leading-none tracking-tighter text-transparent transition-transform duration-300 group-hover:scale-105 origin-bottom-left"
                                style={{
                                    WebkitTextStroke: '4px #cbd5e1', // Lighter Slate-300 for subtle stroke
                                }}
                            >
                                {idx + 1}
                            </span>
                        </div>

                        {/* 2. Poster Image (Right/Top - Overlapping - Wider Ratio) */}
                        <div className="absolute right-0 bottom-0 w-[220px] sm:w-[260px] h-[315px] sm:h-[370px] z-10 transition-transform duration-300 group-hover:scale-105 group-hover:-translate-y-4 origin-bottom shadow-black/50 drop-shadow-2xl overflow-hidden rounded-md bg-gray-800">
                            {/* Image */}
                            <div className="w-full h-full relative">
                                <ImageWithFallback
                                    src={perf.image || perf.poster}
                                    backupSrc={perf.backupPoster}
                                    alt={perf.title}
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 768px) 220px, 260px"
                                />
                                {/* Hover Overlay */}
                                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/30 transition-colors duration-300" />

                                {/* Sports Team Logos Overlay */}
                                {['volleyball', 'basketball', 'baseball', 'handball', 'hockey', 'soccer'].includes(perf.genre) && perf.homeTeam && perf.awayTeam && (
                                    <div className="absolute top-1/2 left-0 w-full -translate-y-1/2 flex justify-between px-4 items-center z-20 pointer-events-none">
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

                            {/* View Details Button (Slide Up) */}
                            <div className="absolute inset-x-0 bottom-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out z-20">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        window.open(perf.link, '_blank');
                                    }}
                                    className="w-full bg-white text-black font-bold py-3 rounded-xl shadow-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 text-sm"
                                >
                                    자세히 보기
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
