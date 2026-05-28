import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Sparkles } from 'lucide-react';
import { motion, useMotionValue, animate, useMotionValueEvent } from 'framer-motion';
import { clsx } from 'clsx';
import type { Performance } from '@/types';
import { GENRES } from '@/lib/constants';
import { cleanTitle } from '@/lib/utils';
import ImageWithFallback from '../ImageWithFallback';
import RecommendationReasonChips from './RecommendationReasonChips';
import SectionInfoPopover from './SectionInfoPopover';


function formatPosterSchedule(date?: string) {
    if (!date) return '';
    return date
        .replace(/\s+/g, ' ')
        .replace(/\s*~\s*/g, ' ~ ')
        .replace(/\.$/, '')
        .trim();
}

interface PersonalizedSectionProps {
    items: Performance[];
    onDetail: (perf: Performance) => void;
    searchMode?: 'keyword' | 'location';
    subtitle?: string;
}

export default function PersonalizedSection({
    items,
    onDetail,
    searchMode = 'keyword',
    subtitle,
}: PersonalizedSectionProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [constraints, setConstraints] = useState({ left: 0, right: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(true);
    const x = useMotionValue(0);

    const updateConstraints = useCallback(() => {
        if (!containerRef.current || !contentRef.current) return;
        const containerWidth = containerRef.current.offsetWidth;
        const contentWidth = contentRef.current.scrollWidth;
        const maxScroll = -(contentWidth - containerWidth + 60);

        setConstraints({ left: maxScroll, right: 0 });
        const currentX = x.get();
        setShowLeftArrow(currentX < -10);
        setShowRightArrow(currentX > maxScroll + 10);
    }, [items, x]);

    useEffect(() => {
        updateConstraints();
        const onResize = () => updateConstraints();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [updateConstraints]);

    useMotionValueEvent(x, 'change', (latest) => {
        if (!contentRef.current || !containerRef.current) return;
        const containerWidth = containerRef.current.offsetWidth;
        const contentWidth = contentRef.current.scrollWidth;
        const maxScroll = -(contentWidth - containerWidth + 60);
        setShowLeftArrow(latest < -10);
        setShowRightArrow(latest > maxScroll + 10);
    });

    const scroll = (direction: 'left' | 'right') => {
        const currentX = x.get();
        const containerWidth = containerRef.current?.offsetWidth || 300;
        const scrollAmount = containerWidth * 0.75;
        let nextX = direction === 'left' ? currentX + scrollAmount : currentX - scrollAmount;
        if (nextX > 0) nextX = 0;
        if (nextX < constraints.left) nextX = constraints.left;

        animate(x, nextX, {
            type: 'spring',
            stiffness: 300,
            damping: 30,
        });
    };

    const pointerPos = useRef({ x: 0, y: 0 });
    const handlePointerDown = (event: React.PointerEvent) => {
        pointerPos.current = { x: event.clientX, y: event.clientY };
    };

    const handlePointerUp = (event: React.PointerEvent, performance: Performance) => {
        const diffX = Math.abs(event.clientX - pointerPos.current.x);
        const diffY = Math.abs(event.clientY - pointerPos.current.y);
        if (diffX > 10 || diffY > 10 || isDragging) return;
        onDetail(performance);
    };

    if (items.length === 0) return null;

    return (
        <section className="mb-8 relative animate-in fade-in slide-in-from-bottom-4 duration-700 group/section">
            <div className="flex items-start justify-between gap-4 mb-4 pl-[1.6%] pr-[1.6%]">
                <div>
                    <div className="flex items-center gap-2">
                        <Sparkles className={clsx('w-5 h-5', searchMode === 'location' ? 'text-emerald-400 fill-emerald-400/20' : 'text-purple-400 fill-purple-400/20')} />
                        <h2 className="text-xl sm:text-2xl font-black text-white light:text-black tracking-tight transition-colors">
                            당신을 위한 <span className={clsx('text-transparent bg-clip-text bg-gradient-to-r', searchMode === 'location' ? 'from-[#55df99] to-[#0090f5]' : 'from-purple-400 to-pink-500')}>추천</span>
                        </h2>
                        <SectionInfoPopover
                            title="당신을 위한 추천"
                            description={subtitle || '좋아요, 저장 키워드, 자주 본 장르, 찜한 공연장을 함께 보고 첫 화면을 조금 더 나답게 정리했어요.'}
                        />
                    </div>
                </div>
            </div>

            <div className="relative">
                {showLeftArrow && (
                    <button
                        onClick={() => scroll('left')}
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-40 p-3 bg-black/50 hover:bg-black/80 text-white rounded-r-xl backdrop-blur-sm transition-all opacity-0 group-hover/section:opacity-100 hidden sm:block"
                    >
                        <ChevronLeft size={32} />
                    </button>
                )}
                {showRightArrow && (
                    <button
                        onClick={() => scroll('right')}
                        className="absolute right-0 top-1/2 -translate-y-1/2 z-40 p-3 bg-black/50 hover:bg-black/80 text-white rounded-l-xl backdrop-blur-sm transition-all opacity-0 group-hover/section:opacity-100 hidden sm:block"
                    >
                        <ChevronRight size={32} />
                    </button>
                )}

                <div ref={containerRef} className="overflow-hidden cursor-grab active:cursor-grabbing pt-8 -mt-8 pb-10 transition-all select-none" style={{ touchAction: 'pan-y' }}>
                    <motion.div
                        ref={contentRef}
                        drag="x"
                        dragConstraints={constraints}
                        dragElastic={0.6}
                        style={{ x }}
                        onDragStart={() => setIsDragging(true)}
                        onDragEnd={() => setIsDragging(false)}
                        className="flex gap-5 sm:gap-6 pl-[1.6%] pr-[1.6%] pt-4 pb-4 items-stretch min-w-max"
                    >
                        {items.map((performance) => (
                            <motion.div
                                key={performance.id}
                                className="relative w-[220px] sm:w-[260px] h-[340px] sm:h-[390px] rounded-[1.5rem] overflow-hidden bg-gray-900 shadow-2xl transition-shadow flex-shrink-0"
                                whileHover={!isDragging ? { scale: 1.03, zIndex: 30 } : {}}
                                onPointerDown={handlePointerDown}
                                onPointerUp={(event) => handlePointerUp(event, performance)}
                            >
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent z-10" />
                                <ImageWithFallback
                                    src={performance.image || performance.poster || performance.backupPoster || ''}
                                    backupSrc={performance.backupPoster}
                                    placeholderInput={{
                                        title: performance.title,
                                        genre: performance.genre,
                                        matchLabel: (performance as { homeTeam?: string; awayTeam?: string }).homeTeam && (performance as { homeTeam?: string; awayTeam?: string }).awayTeam
                                            ? `${(performance as { homeTeam?: string; awayTeam?: string }).homeTeam} vs ${(performance as { homeTeam?: string; awayTeam?: string }).awayTeam}`
                                            : null,
                                    }}
                                    optimizationWidth={340}
                                    quality={62}
                                    alt={performance.title}
                                    fill
                                    className="object-cover"
                                    sizes="(max-width: 768px) 220px, 260px"
                                    loading="lazy"
                                    draggable={false}
                                />

                                <div className="absolute top-3 left-3 right-3 z-20 flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
                                    <div className="inline-flex shrink-0 rounded-full bg-black/35 px-2 py-0.5 text-[9px] font-black text-white backdrop-blur-md border border-white/15">
                                        {GENRES.find((genre) => genre.id === performance.genre)?.label || performance.genre}
                                    </div>
                                    {formatPosterSchedule(performance.date) && (
                                        <div className="inline-flex min-w-0 max-w-[8.5rem] shrink rounded-full bg-white/85 px-2 py-0.5 text-[9px] font-black text-gray-900 backdrop-blur-md border border-white/30">
                                            <span className="truncate">{formatPosterSchedule(performance.date)}</span>
                                        </div>
                                    )}
                                    <RecommendationReasonChips
                                        reasons={performance.recommendationReasons}
                                        comparisonTags={performance.comparisonTags}
                                        compact
                                        singleLine
                                    />
                                </div>

                                <div className="absolute inset-x-0 bottom-0 z-20 p-4">
                                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-0" />
                                    <div className="relative z-10">
                                        <h3 className="text-white font-black text-sm sm:text-base leading-tight line-clamp-2 drop-shadow-md">
                                            {cleanTitle(performance.title)}
                                        </h3>
                                        <div className="mt-1 flex items-center gap-1 text-white/65 text-[11px] font-semibold min-w-0">
                                            <MapPin className="h-3 w-3 shrink-0" />
                                            <span className="truncate">{performance.venue}</span>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
