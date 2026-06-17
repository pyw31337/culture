import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Bell, Share2 } from 'lucide-react';
import ImageWithFallback from '../ImageWithFallback';
import { GENRES } from '@/lib/constants';
import { getPerformanceLocationLabel } from '@/lib/location-display';
import { cleanTitle } from '@/lib/utils';
import { getGenreIcon } from '../GenreIcons';
import { clsx } from 'clsx';
import type { KeywordMatchedPerformance } from '@/lib/keyword-match';
import { getSportsTeamLogo, shouldShowSportsTeamLogoOverlay } from '@/lib/sports-team-logos';

const EMPTY_VENUES: Record<string, never> = {};

interface KeywordSectionProps {
    keywordItems: KeywordMatchedPerformance[];
    onDetail: (perf: KeywordMatchedPerformance) => void;
    onDetailPrepare?: () => void;
    searchMode?: 'keyword' | 'location';
    onShare?: (id: string, e?: React.MouseEvent) => void;
}

function KeywordSection({ keywordItems, onDetail, onDetailPrepare, searchMode = 'keyword', onShare }: KeywordSectionProps) {
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
    }, [keywordItems]);

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

    // Simplified Click Detection
    const pointerPos = useRef({ x: 0, y: 0 });

    const handlePointerDown = (e: React.PointerEvent) => {
        pointerPos.current = { x: e.clientX, y: e.clientY };
    };

    const handlePointerUp = (e: React.PointerEvent, perf: KeywordMatchedPerformance) => {
        // Threshold check
        const diffX = Math.abs(e.clientX - pointerPos.current.x);
        const diffY = Math.abs(e.clientY - pointerPos.current.y);

        // If moved more than 10px, it was a drag or intentional swipe
        if (diffX > 10 || diffY > 10) return;

        // Ensure we aren't currently dragging
        if (isDragging) return;

        onDetail(perf);
    };

    if (keywordItems.length === 0) return null;

    return (
        <section className="mb-8 relative animate-in fade-in slide-in-from-bottom-4 duration-700 group/section">
            <div className="flex items-center justify-between mb-4 text-left pl-[1.6%] pr-[1.6%]">
                <div className="flex items-center gap-2">
                    <Bell className={clsx("w-5 h-5", searchMode === 'location' ? "text-emerald-400 fill-emerald-400/20" : "text-purple-400 fill-purple-400/20")} />
                    <h2 className="text-xl sm:text-2xl font-black text-white light:text-black tracking-tight transition-colors">
                        키워드 컨텐츠 <span className={clsx("text-transparent bg-clip-text bg-gradient-to-r text-sm", searchMode === 'location' ? "from-[#55df99] to-[#0090f5]" : "from-purple-400 to-pink-500")}>New</span>
                    </h2>
                </div>
            </div>

            <div className="relative">
                {/* Left Arrow */}
                {showLeftArrow && (
                    <button
                        onClick={() => scroll('left')}
                        className="absolute left-0 top-1/2 -translate-y-1/2 z-40 p-3 bg-black/50 hover:bg-black/80 text-white rounded-r-xl  transition-colors opacity-0 group-hover/section:opacity-100 hidden sm:block"
                    >
                        <ChevronLeft size={32} />
                    </button>
                )}

                {/* Right Arrow */}
                {showRightArrow && (
                    <button
                        onClick={() => scroll('right')}
                        className="absolute right-0 top-1/2 -translate-y-1/2 z-40 p-3 bg-black/50 hover:bg-black/80 text-white rounded-l-xl  transition-colors opacity-0 group-hover/section:opacity-100 hidden sm:block"
                    >
                        <ChevronRight size={32} />
                    </button>
                )}

                <div
                    ref={containerRef}
                    className="overflow-x-auto overflow-y-visible overscroll-x-contain scrollbar-hide pt-8 -mt-8 pb-12 transition-colors select-none"
                    style={{ touchAction: 'pan-x pan-y' }}
                >
                    <div
                        ref={contentRef}
                        className="flex gap-5 sm:gap-9 pl-[1.6%] pr-[1.6%] pt-4 pb-4 items-end min-w-max"
                    >
                        {keywordItems.map((perf) => (
                            <div
                                key={perf.id}
                                className="flex items-end gap-x-0 flex-shrink-0"
                            >
                                {/* Poster Card */}
                                <div
                                    className={clsx(
                                        "relative w-[200px] sm:w-[260px] h-[300px] sm:h-[390px] rounded-xl overflow-hidden bg-gray-900",
                                        !isDragging && (searchMode === 'location' ? "hover:shadow-emerald-500/30" : "hover:shadow-purple-500/30")
                                    )}
                                    onPointerDown={handlePointerDown}
                                    onPointerUp={(e) => handlePointerUp(e, perf)}
                                    style={{ contentVisibility: 'auto', containIntrinsicSize: '260px 390px' }}
                                >
                                    {/* Category Badge */}
                                    <div className="absolute top-3 left-3 z-30 flex gap-1.5 pointer-events-none">
                                        <div className="px-2 py-0.5 rounded-full bg-black/40  border border-white/20 text-white text-[10px] font-bold">
                                            {GENRES.find(g => g.id === perf.genre)?.label || perf.genre}
                                        </div>
                                        {perf.matchedKeyword && (
                                            <div className="px-2 py-0.5 rounded-full bg-white/15  border border-white/20 text-white text-[10px] font-bold">
                                                #{perf.matchedKeyword.replace(/^#/, '')}
                                            </div>
                                        )}
                                        {perf.category === '독점공연' && (
                                            <div className="px-2 py-0.5 rounded-full bg-orange-500/80  border border-orange-400/30 text-white text-[10px] font-bold shadow-orange-500/20">
                                                단독
                                            </div>
                                        )}
                                    </div>

                                    <ImageWithFallback
                                        src={perf.image || perf.poster || perf.backupPoster || ''}
                                        backupSrc={perf.backupPoster}
                                        placeholderInput={{
                                            title: perf.title,
                                            genre: perf.genre,
                                            matchLabel: perf.homeTeam && perf.awayTeam ? `${perf.homeTeam} vs ${perf.awayTeam}` : null,
                                        }}
                                        optimizationWidth={340}
                                        quality={62}
                                        alt={perf.title}
                                        fill
                                        className="object-cover pointer-events-none"
                                        sizes="(max-width: 768px) 200px, 260px"
                                        loading="lazy"
                                        draggable={false}
                                        style={{ zIndex: 2 }}
                                    />

                                    {/* Gradient Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-90 z-5" />

                                    {/* VS Badge for Sports */}
                                    {shouldShowSportsTeamLogoOverlay(perf) && (
                                        <div className="absolute top-1/2 left-0 w-full -translate-y-1/2 flex justify-between px-3 items-center z-10 pointer-events-none">
                                            {/* Background Decorative Icon */}
                                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.1] text-white pointer-events-none z-[-1]">
                                                {React.isValidElement(getGenreIcon(perf.genre, 120)) ?
                                                    React.cloneElement(getGenreIcon(perf.genre, 120) as React.ReactElement<React.SVGProps<SVGSVGElement>>, { strokeWidth: 1 }) :
                                                    null}
                                            </div>

                                            <img src={getSportsTeamLogo(perf, 'home')} alt={perf.homeTeam} className="w-12 h-12 object-contain" />
                                            <span className="text-white/80 font-black text-sm italic bg-black/40 px-1.5 rounded border border-white/10">VS</span>
                                            <img src={getSportsTeamLogo(perf, 'away')} alt={perf.awayTeam} className="w-12 h-12 object-contain" />
                                        </div>
                                    )}

                                    {/* Bottom Action Bar (Permanent) */}
                                    <div className="absolute inset-x-0 bottom-0 z-30 p-3 flex items-center gap-3 pointer-events-none">
                                        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-0" />

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onShare?.(perf.id, e);
                                            }}
                                            className="relative z-10 w-10 h-10 scale-[0.8] origin-left flex items-center justify-center rounded-xl bg-white/20 hover:bg-white/30 text-white  pointer-events-auto transition-colors shrink-0 border border-white/10"
                                            title="공유하기"
                                        >
                                            <Share2 size={18} />
                                        </button>

                                        <div className="relative z-10 flex flex-col justify-center min-w-0 h-10 overflow-hidden">
                                            <span className="text-white font-black text-sm sm:text-base leading-tight truncate">
                                                {cleanTitle(perf.title)}
                                            </span>
                                            <span className="text-white/60 font-bold text-[10px] sm:text-xs leading-tight truncate uppercase tracking-tight">
                                                {getPerformanceLocationLabel(perf, EMPTY_VENUES, 3) || perf.venue}
                                            </span>
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

export default React.memo(KeywordSection);
