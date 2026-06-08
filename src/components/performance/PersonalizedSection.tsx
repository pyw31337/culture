import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Sparkles } from 'lucide-react';
import { clsx } from 'clsx';
import type { Performance } from '@/types';
import { GENRES } from '@/lib/constants';
import { cleanTitle } from '@/lib/utils';
import ImageWithFallback from '../ImageWithFallback';
import SectionInfoPopover from './SectionInfoPopover';


function formatPosterSchedule(date?: string) {
    if (!date) return '';
    return date
        .replace(/\s+/g, ' ')
        .replace(/\s*~\s*/g, ' ~ ')
        .replace(/\.$/, '')
        .trim();
}

function PosterScheduleLine({ date }: { date?: string }) {
    const schedule = formatPosterSchedule(date);
    if (!schedule) return null;

    return (
        <p className="mb-1 text-[10.5px] sm:text-[11px] font-extrabold leading-snug text-white/80 drop-shadow-md break-keep whitespace-normal">
            {schedule}
        </p>
    );
}

interface PersonalizedSectionProps {
    items: Performance[];
    onDetail: (perf: Performance) => void;
    onDetailPrepare?: () => void;
    searchMode?: 'keyword' | 'location';
    subtitle?: string;
}

export default function PersonalizedSection({
    items,
    onDetail,
    onDetailPrepare,
    searchMode = 'keyword',
    subtitle,
}: PersonalizedSectionProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(true);

    // Native horizontal scroll is significantly cheaper than drag spring animations.
    const updateArrowState = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;
        const maxScroll = container.scrollWidth - container.clientWidth - 8;
        const nextShowLeft = container.scrollLeft > 10;
        const nextShowRight = container.scrollLeft < maxScroll;
        setShowLeftArrow((current) => current === nextShowLeft ? current : nextShowLeft);
        setShowRightArrow((current) => current === nextShowRight ? current : nextShowRight);
    }, [items]);

    useEffect(() => {
        updateArrowState();
        const container = containerRef.current;
        const onResize = () => updateArrowState();
        const onScroll = () => updateArrowState();

        window.addEventListener('resize', onResize, { passive: true });
        container?.addEventListener('scroll', onScroll, { passive: true });

        return () => {
            window.removeEventListener('resize', onResize);
            container?.removeEventListener('scroll', onScroll);
        };
    }, [updateArrowState]);

    const scroll = (direction: 'left' | 'right') => {
        const container = containerRef.current;
        if (!container) return;
        const amount = container.clientWidth * 0.78;
        container.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
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
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-40 p-3 bg-black/50 hover:bg-black/80 text-white rounded-r-xl  transition-colors opacity-0 group-hover/section:opacity-100 hidden sm:block"
                    >
                        <ChevronLeft size={32} />
                    </button>
                )}
                {showRightArrow && (
                    <button
                        onClick={() => scroll('right')}
                        className="absolute right-0 top-1/2 -translate-y-1/2 z-40 p-3 bg-black/50 hover:bg-black/80 text-white rounded-l-xl  transition-colors opacity-0 group-hover/section:opacity-100 hidden sm:block"
                    >
                        <ChevronRight size={32} />
                    </button>
                )}

                <div ref={containerRef} className="overflow-x-auto overflow-y-visible overscroll-x-contain scrollbar-hide pt-8 -mt-8 pb-10 transition-colors select-none" style={{ touchAction: 'pan-x pan-y' }}>
                    <div
                        ref={contentRef}
                        onDragEnd={() => setIsDragging(false)}
                        className="flex gap-5 sm:gap-6 pl-[1.6%] pr-[1.6%] pt-4 pb-4 items-stretch min-w-max"
                    >
                        {items.map((performance) => (
                            <div
                                key={performance.id}
                                className="relative w-[220px] sm:w-[260px] h-[340px] sm:h-[390px] rounded-[1.5rem] overflow-hidden bg-gray-900 shadow-lg flex-shrink-0"
                                onPointerDown={handlePointerDown}
                                onPointerEnter={onDetailPrepare}
                                onFocusCapture={onDetailPrepare}
                                onPointerUp={(event) => handlePointerUp(event, performance)}
                                style={{ contentVisibility: 'auto', containIntrinsicSize: '260px 390px' }}
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
                                    fastDisplay
                                    draggable={false}
                                />

                                <div className="absolute top-3 left-3 right-3 z-20 flex items-center gap-1.5 overflow-hidden whitespace-nowrap">
                                    <div className="inline-flex shrink-0 rounded-full bg-black/35 px-2 py-0.5 text-[9px] font-black text-white  border border-white/15">
                                        {GENRES.find((genre) => genre.id === performance.genre)?.label || performance.genre}
                                    </div>
                                </div>

                                <div className="absolute inset-x-0 bottom-0 z-20 p-4">
                                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-0" />
                                    <div className="relative z-10">
                                        <PosterScheduleLine date={performance.date} />
                                        <h3 className="text-white font-black text-sm sm:text-base leading-tight line-clamp-2 drop-shadow-md">
                                            {cleanTitle(performance.title)}
                                        </h3>
                                        <div className="mt-1 flex items-center gap-1 text-white/65 text-[11px] font-semibold min-w-0">
                                            <MapPin className="h-3 w-3 shrink-0" />
                                            <span className="truncate">{performance.venue}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
