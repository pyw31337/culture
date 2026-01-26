import React, { useRef, useState, useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import PerformanceCard from './PerformanceCard';
import { cleanTitle } from '@/lib/utils'; // Ensure cleanliness

interface RecommendedSectionProps {
    performances: any[];
    onLocationClick: (loc: any) => void;
    onToggleLike: (e: React.MouseEvent, id: string) => void;
    likedIds: Set<string>;
    onDetail: (id: string) => void;
}

export default function RecommendedSection({ performances, onLocationClick, onToggleLike, likedIds, onDetail }: RecommendedSectionProps) {
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);
    const [randomRecs, setRandomRecs] = useState<any[]>([]);

    useEffect(() => {
        // Shuffle and pick 10 items across ALL genres
        if (performances && performances.length > 0) {
            const shuffled = [...performances].sort(() => 0.5 - Math.random());
            setRandomRecs(shuffled.slice(0, 10));
        }
    }, [performances]);

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
        <section className="mb-12 relative animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center gap-2 mb-6 px-4">
                <Sparkles className="w-6 h-6 text-purple-500 animate-pulse" />
                <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
                    회원님을 위한 맞춤 추천
                </h2>
            </div>

            <div
                ref={scrollRef}
                className="flex gap-4 overflow-x-auto pb-8 scrollbar-hide px-4 select-none cursor-grab active:cursor-grabbing"
                onMouseDown={onMouseDown}
                onMouseLeave={onMouseLeave}
                onMouseUp={onMouseUp}
                onMouseMove={onMouseMove}
                style={{ scrollBehavior: isDragging ? 'auto' : 'smooth' }}
            >
                {randomRecs.map((perf, idx) => (
                    <div key={perf.id} className="min-w-[160px] sm:min-w-[180px] md:min-w-[240px] h-auto relative flex-shrink-0">
                        {/* Rank Badge */}
                        <div className="absolute top-2 left-2 z-[60] px-2 py-0.5 bg-black/60 backdrop-blur-md rounded text-[10px] font-bold text-yellow-300 border border-yellow-500/30 shadow-lg pointer-events-none">
                            추천 #{idx + 1}
                        </div>
                        <PerformanceCard
                            perf={perf}
                            distLabel={null}
                            venueInfo={null}
                            onLocationClick={onLocationClick}
                            variant="default"
                            isGradient={true}
                            onToggleLike={(e) => onToggleLike(e, perf.id)}
                            isLiked={likedIds.has(perf.id)}
                            onDetail={() => onDetail(perf.id)}
                            enableActions={true}
                        />
                    </div>
                ))}
            </div>
            {/* Gradient Overlay Removed */}
        </section>
    );
}
