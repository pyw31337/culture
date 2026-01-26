import React, { useRef, useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import ImageWithFallback from '../ImageWithFallback';
import { cleanTitle } from '@/lib/utils'; // Ensure cleanliness

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
            <div className="flex items-center gap-2 mb-4 px-4 sm:px-6 lg:px-8">
                <Sparkles className="w-6 h-6 text-purple-500 animate-pulse" />
                <h2 className="text-2xl font-bold text-white light:text-black">
                    회원님을 위한 맞춤 추천
                </h2>
            </div>

            <div
                ref={scrollRef}
                className="flex gap-14 overflow-visible pb-8 scrollbar-hide pl-[50px] pr-4 sm:pr-6 lg:pr-8 select-none cursor-grab active:cursor-grabbing items-end pt-4"
                onMouseDown={onMouseDown}
                onMouseLeave={onMouseLeave}
                onMouseUp={onMouseUp}
                onMouseMove={onMouseMove}
                style={{ scrollBehavior: isDragging ? 'auto' : 'smooth' }}
            >
                {randomRecs.map((perf, idx) => (
                    <div
                        key={perf.id}
                        className="relative group flex-shrink-0 w-[190px] md:w-[250px] h-[215px] md:h-[301px] cursor-pointer"
                        onClick={() => window.open(perf.link, '_blank')}
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
                        <div className="absolute right-0 bottom-0 w-[160px] md:w-[220px] h-[215px] md:h-[301px] z-10 transition-transform duration-300 group-hover:scale-105 group-hover:-translate-y-4 origin-bottom shadow-black/50 drop-shadow-2xl">
                            <div className="w-full h-full rounded-md overflow-hidden relative bg-gray-800">
                                <ImageWithFallback
                                    src={perf.image || perf.poster}
                                    backupSrc={perf.backupPoster}
                                    alt={perf.title}
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 768px) 160px, 220px"
                                />
                                {/* Hover Overlay */}
                                <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors duration-300" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
