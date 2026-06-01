import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Sparkles, ChevronLeft, ChevronRight, Share2 } from 'lucide-react';
import ImageWithFallback from '../ImageWithFallback';
import { FUTURES_TEAM_LOGOS, GENRES } from '@/lib/constants';
import { getPerformanceLocationLabel } from '@/lib/location-display';
import { cleanTitle } from '@/lib/utils';
import { getGenreIcon } from '../GenreIcons';
import { useUserActivity } from '@/hooks/useUserActivity';
import { clsx } from 'clsx';
import RecommendationReasonChips from './RecommendationReasonChips';
import SectionInfoPopover from './SectionInfoPopover';

const EMPTY_VENUES: Record<string, never> = {};


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

interface RecommendedSectionProps {
    recommendedItems: any[];
    onLocationClick: (loc: any) => void;
    onToggleLike: (id: string, e: React.MouseEvent) => void;
    likedIds: Set<string>;
    onDetail: (perf: any) => void;
    searchMode?: 'keyword' | 'location';
    onShare?: (id: string, e?: React.MouseEvent) => void;
    title?: string;
    subtitle?: string;
}

export default function RecommendedSection({
    recommendedItems,
    onLocationClick,
    onToggleLike,
    likedIds,
    onDetail,
    searchMode = 'keyword',
    onShare,
    title = '지금 주목할 콘텐츠',
    subtitle = '시즌 적합성, 일정 임박도, 장르 다양성을 함께 보고 첫 화면을 조금 더 생동감 있게 정리했어요.',
}: RecommendedSectionProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [randomRecs, setRandomRecs] = useState<any[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(true);
    const dailySalt = React.useMemo(() => {
        const formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
        return formatter.format(new Date());
    }, []);

    // Motion value for x-axis scroll

    const { activity, isActivityReady } = useUserActivity();
    const hasLockedRecommendations = useRef(false);

    // Deterministic Random Score Generator
    const getBaseScore = (id: string) => {
        let hash = 0;
        const source = `${dailySalt}:${id}`;
        for (let i = 0; i < source.length; i++) {
            hash = (hash << 5) - hash + source.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash) % 100;
    };

    // Rank Logic
    useEffect(() => {
        if (hasLockedRecommendations.current) return;
        if (!isActivityReady) return;

        if (recommendedItems && recommendedItems.length > 0) {
            const ranked = [...recommendedItems].sort((a, b) => {
                const clickPenaltyA = Math.min(activity.itemClicks?.[a.id] || 0, 5) * 16;
                const clickPenaltyB = Math.min(activity.itemClicks?.[b.id] || 0, 5) * 16;
                const scoreA = getBaseScore(a.id) - clickPenaltyA;
                const scoreB = getBaseScore(b.id) - clickPenaltyB;
                return scoreB - scoreA;
            });
            setRandomRecs(ranked.slice(0, 9));
            hasLockedRecommendations.current = true;
        }
    }, [recommendedItems, activity.itemClicks, isActivityReady]);

    // Constraint & Arrow Logic
    // Native horizontal scroll is significantly cheaper than drag spring animations.
    const updateArrowState = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;
        const maxScroll = container.scrollWidth - container.clientWidth - 8;
        setShowLeftArrow(container.scrollLeft > 10);
        setShowRightArrow(container.scrollLeft < maxScroll);
    }, [randomRecs]);

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
                <div>
                    <div className="flex items-center gap-2">
                        <Sparkles className={clsx("w-5 h-5", searchMode === 'location' ? "text-emerald-400 fill-emerald-400/20" : "text-purple-400 fill-purple-400/20")} />
                        <h2 className={clsx("text-xl sm:text-2xl font-black tracking-tight transition-colors text-transparent bg-clip-text bg-gradient-to-r", searchMode === 'location' ? "from-[#55df99] to-[#0090f5]" : "from-purple-400 to-pink-500")}>
                            {title}
                        </h2>
                        <SectionInfoPopover
                            title={title}
                            description={subtitle}
                        />
                    </div>
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
                    className="overflow-x-auto overflow-y-visible overscroll-x-contain scrollbar-hide pt-8 -mt-8 pb-12 transition-all select-none"
                    style={{ touchAction: 'pan-x pan-y' }}
                >
                    <div
                        ref={contentRef}
                        className="flex gap-5 sm:gap-9 pl-[1.6%] pr-[1.6%] pt-4 pb-4 items-end min-w-max"
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
                                <div
                                    className={clsx(
                                        "relative w-[200px] sm:w-[260px] h-[300px] sm:h-[390px] rounded-xl overflow-hidden bg-gray-900 shadow-2xl transition-transform duration-200 hover:-translate-y-1 -ml-6",
                                        !isDragging && (searchMode === 'location' ? "hover:shadow-emerald-500/30" : "hover:shadow-purple-500/30")
                                    )}
                                    onPointerDown={handlePointerDown}
                                    onPointerUp={(e) => handlePointerUp(e as any, perf)}
                                >
                                    {/* Category Badge */}
                                    <div className="absolute top-3 left-3 right-3 z-30 flex gap-1.5 pointer-events-none overflow-hidden whitespace-nowrap">
                                        <div className="px-2 py-0.5 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white text-[10px] font-bold">
                                            {GENRES.find(g => g.id === perf.genre)?.label || perf.genre}
                                        </div>
                                        {(perf.recommendationReasons?.[0] || perf.comparisonTags?.[0]) && (
                                            <div className="px-2 py-0.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white text-[10px] font-bold">
                                                {perf.recommendationReasons?.[0] || perf.comparisonTags?.[0]}
                                            </div>
                                        )}
                                        {perf.category === '독점공연' && (
                                            <div className="px-2 py-0.5 rounded-full bg-orange-500/80 backdrop-blur-md border border-orange-400/30 text-white text-[10px] font-bold shadow-lg shadow-orange-500/20">
                                                단독
                                            </div>
                                        )}
                                    </div>

                                    <ImageWithFallback
                                        src={perf.image || perf.poster}
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
                                        fastDisplay
                                        draggable={false}
                                    />

                                    {/* Gradient Overlay */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-90" />

                                    {/* VS Badge for Sports */}
                                    {['volleyball', 'basketball', 'baseball', 'handball'].includes(perf.genre) && perf.homeTeam && perf.awayTeam && (
                                        <div className="absolute top-1/2 left-0 w-full -translate-y-1/2 flex justify-between px-3 items-center z-20 pointer-events-none">
                                            {/* Background Decorative Icon */}
                                            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.1] text-white pointer-events-none z-[-1]">
                                                {React.isValidElement(getGenreIcon(perf.genre, 120)) ?
                                                    React.cloneElement(getGenreIcon(perf.genre, 120) as React.ReactElement<React.SVGProps<SVGSVGElement>>, { strokeWidth: 1 }) :
                                                    null}
                                            </div>

                                            <img src={perf.genre === 'baseball' && FUTURES_TEAM_LOGOS[perf.homeTeam] ? FUTURES_TEAM_LOGOS[perf.homeTeam] : perf.homeTeamLogo} alt={perf.homeTeam} className="w-12 h-12 object-contain drop-shadow-md" />
                                            <span className="text-white/80 font-black text-sm italic bg-black/40 px-1.5 rounded border border-white/10">VS</span>
                                            <img src={perf.genre === 'baseball' && FUTURES_TEAM_LOGOS[perf.awayTeam] ? FUTURES_TEAM_LOGOS[perf.awayTeam] : perf.awayTeamLogo} alt={perf.awayTeam} className="w-12 h-12 object-contain drop-shadow-md" />
                                        </div>
                                    )}

                                    {/* Info Overlay (Detail View) */}
                                    <div className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-4 text-center z-10">
                                        <h3 className="text-white font-bold text-lg mb-2 line-clamp-2">{cleanTitle(perf.title)}</h3>
                                        <p className="text-gray-300 text-sm mb-4 font-bold tracking-wider">
                                            {GENRES.find(g => g.id === perf.genre)?.label || perf.genre}
                                        </p>
                                        <div className="px-5 py-2.5 bg-white text-black font-extrabold text-xs rounded-full shadow-xl">
                                            자세히 보기
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
                                            title="공유하기"
                                        >
                                            <ChevronRight size={20} />
                                        </button>

                                        <div className="relative z-10 flex min-w-0 flex-col justify-center overflow-visible">
                                            <PosterScheduleLine date={perf.date} />
                                            <span className="text-white font-black text-sm sm:text-base leading-tight truncate drop-shadow-md">
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
