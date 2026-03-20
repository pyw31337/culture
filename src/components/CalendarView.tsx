'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { Performance } from '@/types';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { useTranslations, useLocale } from 'next-intl';
import { X, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';
import { clsx } from 'clsx';
import { GENRES, GENRE_STYLES } from '@/lib/constants';
import { getOptimizedUrl, translateContent } from '@/lib/utils';
import CalendarDayCell from './CalendarDayCell';
import venueData from '@/data/venues.json';
import { MapPin } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePerformanceData } from '@/hooks/usePerformanceData';

const venues = venueData as unknown as Record<string, { address?: string; district?: string; refined_name?: string }>;

interface CalendarViewProps {
    performances: Performance[];
}

type CalendarView = 'daily' | 'weekly' | 'monthly';

export default function CalendarView({ performances: initialPerformances }: CalendarViewProps) {
    const t = useTranslations('Calendar');
    const tc = useTranslations('Categories');
    const ta = useTranslations('Actions');
    const td = useTranslations('Data');
    const locale = useLocale();
    const dateLocale = locale === 'ko' ? ko : enUS;
    const router = useRouter();
    const searchParams = useSearchParams();

    // Load full data client-side (server provides initial subset, client fetches full)
    const { allPerformances } = usePerformanceData({ initialPerformances });
    const performances = allPerformances;

    // Read initial state from URL params
    const initialGenre = searchParams.get('genre') || 'all';
    const initialView = (searchParams.get('view') as CalendarView) || 'monthly';
    const initialDateStr = searchParams.get('date');

    const [currentMonth, setCurrentMonth] = useState(() => {
        if (initialDateStr) {
            const d = new Date(initialDateStr);
            if (!isNaN(d.getTime())) return d;
        }
        return new Date();
    });
    const [calendarView, setCalendarView] = useState<CalendarView>(initialView);
    const [localGenre, setLocalGenre] = useState(initialGenre);

    const startDate = startOfWeek(startOfMonth(currentMonth));
    const endDate = endOfWeek(endOfMonth(currentMonth));
    const dayList = eachDayOfInterval({ start: startDate, end: endDate });

    const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

    // Map performances to dates
    const performancesByDate = useMemo(() => {
        const map = new Map<string, Performance[]>();

        performances.forEach(perf => {
            const dateStr = perf.date.trim();

            if (dateStr.includes('~')) {
                const [startRaw, endRaw] = dateStr.split('~').map(s => s.trim());
                if (startRaw && endRaw) {
                    const startRawCleanup = startRaw.replace(/\./g, '-');
                    const endRawCleanup = endRaw.replace(/\./g, '-');

                    if (startRawCleanup.startsWith('202') && endRawCleanup.startsWith('202')) {
                        const start = new Date(startRawCleanup);
                        const end = new Date(endRawCleanup);

                        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                            try {
                                let maxEnd = end;
                                const MAX_DAYS = 90;
                                const diffTime = Math.abs(end.getTime() - start.getTime());
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                                if (perf.genre === 'movie') {
                                    maxEnd = start;
                                } else if (diffDays > MAX_DAYS) {
                                    maxEnd = new Date(start.getTime() + (MAX_DAYS * 24 * 60 * 60 * 1000));
                                }

                                const interval = eachDayOfInterval({ start, end: maxEnd });

                                interval.forEach(day => {
                                    const dayStr = format(day, 'yyyy-MM-dd');
                                    if (!map.has(dayStr)) map.set(dayStr, []);
                                    map.get(dayStr)!.push(perf);
                                });
                            } catch (e) { }
                        }
                    }
                }
            } else {
                const normalizedDate = dateStr.replace(/\./g, '-').substring(0, 10);
                if (normalizedDate.length === 10) {
                    if (!map.has(normalizedDate)) map.set(normalizedDate, []);
                    map.get(normalizedDate)!.push(perf);
                }
            }
        });

        return map;
    }, [performances]);

    const getPerformancesForDay = (day: Date) => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const allEvents = performancesByDate.get(dayStr) || [];
        if (localGenre === 'all') return allEvents;
        return allEvents.filter(p => p.genre === localGenre);
    };

    // Calculate Counts for the focused view context
    const currentViewTotalEvents = useMemo(() => {
        if (calendarView === 'daily') {
            const dayStr = format(currentMonth, 'yyyy-MM-dd');
            return performancesByDate.get(dayStr) || [];
        } else if (calendarView === 'weekly') {
            const start = startOfWeek(currentMonth, { weekStartsOn: 0 });
            const end = endOfWeek(currentMonth, { weekStartsOn: 0 });
            const result: Performance[] = [];
            const seen = new Set<string>();
            eachDayOfInterval({ start, end }).forEach(day => {
                const dayStr = format(day, 'yyyy-MM-dd');
                (performancesByDate.get(dayStr) || []).forEach(p => {
                    if (!seen.has(p.id)) {
                        seen.add(p.id);
                        result.push(p);
                    }
                });
            });
            return result;
        } else {
            const start = startOfMonth(currentMonth);
            const end = endOfMonth(currentMonth);
            const result: Performance[] = [];
            const seen = new Set<string>();
            eachDayOfInterval({ start, end }).forEach(day => {
                const dayStr = format(day, 'yyyy-MM-dd');
                (performancesByDate.get(dayStr) || []).forEach(p => {
                    if (!seen.has(p.id)) {
                        seen.add(p.id);
                        result.push(p);
                    }
                });
            });
            return result;
        }
    }, [calendarView, currentMonth, performancesByDate]);

    const currentViewEvents = useMemo(() => {
        if (localGenre === 'all') return currentViewTotalEvents;
        return currentViewTotalEvents.filter(p => p.genre === localGenre);
    }, [currentViewTotalEvents, localGenre]);

    const [visibleCount, setVisibleCount] = useState(20);

    useEffect(() => {
        setVisibleCount(20);
    }, [currentMonth, localGenre, calendarView]);

    // Drag to scroll logic
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const scrollLeftRef = useRef(0);

    const onMouseDown = (e: React.MouseEvent) => {
        if (!scrollRef.current) return;
        setIsDragging(true);
        setStartX(e.pageX - scrollRef.current.offsetLeft);
        scrollLeftRef.current = scrollRef.current.scrollLeft;
    };

    const onMouseLeave = () => setIsDragging(false);
    const onMouseUp = () => setIsDragging(false);

    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollRef.current.offsetLeft;
        const walk = (x - startX) * 2;
        scrollRef.current.scrollLeft = scrollLeftRef.current - walk;
    };

    // Scroll Handler for List
    const listRef = useRef<HTMLDivElement>(null);
    const onListScroll = () => {
        if (listRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = listRef.current;
            if (scrollTop + clientHeight >= scrollHeight - 50) {
                const totalFiltered = localGenre === 'all'
                    ? currentViewEvents.length
                    : currentViewEvents.filter(p => p.genre === localGenre).length;
                if (visibleCount < totalFiltered) {
                    setVisibleCount(prev => prev + 20);
                }
            }
        }
    };

    const handleClose = () => {
        // Navigate back, or go to home if no history
        if (window.history.length > 1) {
            router.back();
        } else {
            router.push('/');
        }
    };

    const handleSelectDay = useMemo(() => (d: Date) => {
        setCurrentMonth(d);
        setCalendarView('daily');
    }, [router]); // Stable setter

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 w-full h-full shadow-2xl flex flex-col border-0">
                {/* Header */}
                <div className="flex items-center justify-between p-3 sm:p-6 border-b border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900 z-10">
                    <h2 className="text-base sm:text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-1 sm:gap-4 truncate">
                        <button onClick={() => {
                            if (calendarView === 'monthly') handlePrevMonth();
                            else if (calendarView === 'weekly') setCurrentMonth(subWeeks(currentMonth, 1));
                            else setCurrentMonth(subDays(currentMonth, 1));
                        }} className="p-1 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition shrink-0"><ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" /></button>

                        <span className="hidden sm:inline cursor-pointer hover:text-blue-500 dark:hover:text-blue-400 transition-colors" onClick={() => setCurrentMonth(new Date())} title={t('today')}>
                            {calendarView === 'daily'
                                ? format(currentMonth, locale === 'ko' ? 'yyyy년 M월 d일 (eee)' : 'EEE, MMM d, yyyy', { locale: dateLocale })
                                : calendarView === 'weekly'
                                    ? `${format(startOfWeek(currentMonth), 'M/d')} ~ ${format(endOfWeek(currentMonth), 'M/d')}`
                                    : format(currentMonth, locale === 'ko' ? 'yyyy년 M월' : 'MMM yyyy', { locale: dateLocale })}
                        </span>
                        <span className="sm:hidden text-base truncate cursor-pointer hover:text-blue-500 dark:hover:text-blue-400 transition-colors" onClick={() => setCurrentMonth(new Date())} title={t('today')}>
                            {calendarView === 'daily'
                                ? format(currentMonth, 'yy.MM.dd', { locale: dateLocale })
                                : calendarView === 'weekly'
                                    ? `${format(startOfWeek(currentMonth), 'M/d')}~${format(endOfWeek(currentMonth), 'M/d')}`
                                    : format(currentMonth, 'yy.MM', { locale: dateLocale })}
                        </span>

                        <button onClick={() => {
                            if (calendarView === 'monthly') handleNextMonth();
                            else if (calendarView === 'weekly') setCurrentMonth(addWeeks(currentMonth, 1));
                            else setCurrentMonth(addDays(currentMonth, 1));
                        }} className="p-1 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition shrink-0"><ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" /></button>
                    </h2>
                    <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        {(['daily', 'weekly', 'monthly'] as CalendarView[]).map(v => (
                            <button
                                key={v}
                                onClick={() => setCalendarView(v)}
                                className={clsx(
                                    'px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-colors',
                                    calendarView === v
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
                                )}
                            >
                                {v === 'daily' ? t('daily') : v === 'weekly' ? t('weekly') : t('monthly')}
                            </button>
                        ))}
                        <button onClick={handleClose} className="p-1 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition ml-0 sm:ml-2 shrink-0">
                            <X className="w-5 h-5 sm:w-6 sm:h-6" />
                        </button>
                    </div>
                </div>

                {/* Category Nav Header */}
                <div className="w-full px-4 py-3 bg-gray-100/30 dark:bg-black/20 border-b border-gray-200 dark:border-gray-800 overflow-x-auto scrollbar-hide shrink-0 cursor-grab z-10"
                    onMouseDown={onMouseDown} onMouseLeave={onMouseLeave} onMouseUp={onMouseUp} onMouseMove={onMouseMove} ref={scrollRef}>
                    <div className="flex gap-2 w-max">
                        {GENRES.map((genre) => {
                            const isSelected = localGenre === genre.id;
                            const count = genre.id === 'all'
                                ? currentViewTotalEvents.length
                                : currentViewTotalEvents.filter(p => p.genre === genre.id).length;
                            const isEmpty = count === 0;

                            return (
                                <button
                                    key={genre.id}
                                    disabled={isEmpty && genre.id !== 'all'}
                                    onClick={() => {
                                        setLocalGenre(genre.id);
                                    }}
                                    className={clsx(
                                        "px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 border shadow-sm flex items-center gap-1.5",
                                        isSelected
                                            ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white shadow-lg scale-105"
                                            : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800",
                                        isEmpty && genre.id !== 'all' ? "opacity-30 grayscale cursor-not-allowed" : "opacity-100"
                                    )}
                                >
                                    {genre.label}
                                    {count > 0 && <span className={clsx("text-[10px] font-black opacity-60", isSelected ? "text-blue-400" : "text-gray-500")}>{count}</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Unified Day View Pane */}
                {calendarView === 'daily' && (
                    <div
                        ref={listRef}
                        onScroll={onListScroll}
                        className="flex-grow overflow-y-auto p-4 space-y-3 bg-white dark:bg-gray-900 custom-scrollbar"
                    >
                        {(() => {
                            const filteredEvents = localGenre === 'all'
                                ? currentViewEvents
                                : currentViewEvents.filter(p => p.genre === localGenre);

                            const displayedDailyEvents = filteredEvents.slice(0, visibleCount);

                            if (filteredEvents.length === 0) return (
                                <div className="flex flex-col items-center justify-center h-full py-20 opacity-40">
                                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 text-gray-400">
                                        <X size={32} />
                                    </div>
                                    <p className="text-gray-500 text-lg font-bold">{t('no_events')}</p>
                                </div>
                            );
                            return (
                                <div className="space-y-3 max-w-4xl mx-auto w-full">
                                    {displayedDailyEvents.map((perf, i) => (
                                        <a key={`${perf.id}-${i}`} href={perf.link} target="_blank" rel="noopener noreferrer"
                                            className="flex gap-4 p-4 bg-white dark:bg-gray-800/50 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-750 border border-gray-100 dark:border-gray-800 transition-all group shadow-sm hover:shadow-md active:scale-[0.98]"
                                        >
                                            {perf.image && (
                                                <div className="relative w-14 h-20 shrink-0 shadow-lg group-hover:scale-105 transition-transform">
                                                    <img src={getOptimizedUrl(perf.image)} alt={perf.title} className="w-full h-full object-cover rounded-lg bg-gray-100 dark:bg-gray-700" referrerPolicy="no-referrer" />
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1 flex flex-col justify-center">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className={clsx("px-2 py-0.5 rounded text-[10px] font-black tracking-wider text-white uppercase", (GENRE_STYLES as any)[perf.genre]?.twBg || 'bg-gray-600')}>
                                                        {tc(perf.genre)}
                                                    </span>
                                                    <span className="text-[11px] text-gray-500 font-bold truncate">{translateContent(perf.venue, td)}</span>
                                                </div>
                                                <h4 className="text-sm sm:text-base font-black text-gray-900 dark:text-white leading-tight line-clamp-2 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">{translateContent(perf.title, td)}</h4>
                                                {(() => {
                                                    const v = venues[perf.venue];
                                                    const addr = v?.address || '';
                                                    const parts = addr.split(/\s+/);
                                                    const loc = parts.length >= 2 ? `${parts[0]} ${parts[1]}` : parts[0] || '';
                                                    return loc ? (
                                                        <span className="sm:hidden flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 font-bold mt-1">
                                                            <MapPin size={9} className="shrink-0" />{loc}
                                                        </span>
                                                    ) : null;
                                                })()}
                                            </div>
                                            {(() => {
                                                const v = venues[perf.venue];
                                                const addr = v?.address || '';
                                                const parts = addr.split(/\s+/);
                                                const loc = parts.length >= 2 ? `${parts[0]} ${parts[1]}` : parts[0] || '';
                                                return loc ? (
                                                    <div className="hidden sm:flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 font-bold shrink-0 self-center">
                                                        <MapPin size={10} className="shrink-0" />{loc}
                                                    </div>
                                                ) : null;
                                            })()}
                                        </a>
                                    ))}

                                    {displayedDailyEvents.length < filteredEvents.length && (
                                        <div className="py-8 text-center text-xs text-gray-500 font-black animate-pulse uppercase tracking-widest">
                                            Loading More Data...
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                )}

                {/* Weekly View */}
                {calendarView === 'weekly' && (
                    <div className="flex-grow overflow-y-auto flex flex-col bg-gray-50 dark:bg-gray-950">
                        {eachDayOfInterval({
                            start: startOfWeek(currentMonth, { weekStartsOn: 0 }),
                            end: endOfWeek(currentMonth, { weekStartsOn: 0 })
                        }).map((day, idx) => {
                            const dayEvents = getPerformancesForDay(day);
                            const isToday = isSameDay(day, new Date());
                            const isSelectedDay = isSameDay(day, currentMonth);

                            return (
                                <div
                                    key={day.toISOString()}
                                    className={clsx(
                                        "flex border-b border-gray-200 dark:border-gray-900 min-h-[100px] last:border-b-0 cursor-pointer transition-colors active:bg-blue-50/20",
                                        isSelectedDay && "bg-blue-50/10 dark:bg-blue-900/5 ring-2 ring-inset ring-blue-500/20"
                                    )}
                                    onClick={() => {
                                        setCurrentMonth(day);
                                        setCalendarView('daily');
                                    }}
                                >
                                    <div className={clsx(
                                        "w-20 sm:w-32 flex flex-col items-center justify-center border-r border-gray-200 dark:border-gray-900 shrink-0 select-none",
                                        isToday ? "bg-blue-50/50 dark:bg-blue-900/10" : "bg-gray-50/30 dark:bg-gray-950/20"
                                    )}>
                                        <span className={clsx(
                                            "text-[10px] sm:text-xs font-black uppercase tracking-tighter",
                                            idx === 0 ? "text-red-500" : idx === 6 ? "text-blue-500" : "text-gray-500 dark:text-gray-400"
                                        )}>
                                            {format(day, 'eee', { locale: dateLocale })}
                                        </span>
                                        <span className="text-xl sm:text-3xl font-black text-gray-900 dark:text-white leading-none mt-1">
                                            {format(day, 'd')}
                                        </span>
                                        <span className={clsx(
                                            "text-[10px] font-black mt-2 px-2 py-0.5 rounded-full border shadow-sm",
                                            dayEvents.length > 0 ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700" : "text-gray-400 border-transparent opacity-40 text-[9px]"
                                        )}>
                                            {dayEvents.length}
                                        </span>
                                    </div>

                                    <div className="flex-grow p-4 overflow-hidden relative group">
                                        <div className="flex flex-col gap-1.5 overflow-hidden">
                                            {dayEvents.slice(0, 10).map((perf, i) => (
                                                <a
                                                    key={`${perf.id}-${i}`}
                                                    href={perf.link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                                >
                                                    <span className={clsx("w-2 h-2 rounded-full shrink-0", (GENRE_STYLES as any)[perf.genre]?.twBg || 'bg-gray-400')} />
                                                    <span className="truncate">{perf.title}</span>
                                                </a>
                                            ))}
                                            {dayEvents.length > 10 && (
                                                <div className="text-[10px] text-gray-500 font-bold italic pl-4">{t('more_events', { count: dayEvents.length - 10 })}</div>
                                            )}
                                            {dayEvents.length === 0 && (
                                                <div className="h-full flex items-center justify-center text-gray-300 dark:text-gray-700 font-black italic uppercase tracking-widest text-[10px]">{t('no_events')}</div>
                                            )}
                                        </div>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                            <div className="bg-blue-600 text-white p-2 rounded-full shadow-lg">
                                                <ChevronRight size={16} strokeWidth={4} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Monthly View */}
                {calendarView === 'monthly' && (
                    <>
                        <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-900 bg-gray-50 dark:bg-gray-950/50 shrink-0">
                            {[0, 1, 2, 3, 4, 5, 6].map((dayIdx) => {
                                const date = addDays(startOfWeek(new Date(), { weekStartsOn: 0 }), dayIdx);
                                return (
                                    <div key={dayIdx} className={clsx("py-3 text-center text-xs font-black uppercase tracking-widest", dayIdx === 0 ? "text-red-500/80" : dayIdx === 6 ? "text-blue-500/80" : "text-gray-400 dark:text-gray-500")}>
                                        {format(date, 'eee', { locale: dateLocale })}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="grid grid-cols-7 flex-grow overflow-y-auto auto-rows-fr bg-gray-100 dark:bg-gray-900/50 gap-[1px]">
                            {dayList.map((day) => {
                                const dayEvents = getPerformancesForDay(day);
                                return (
                                    <CalendarDayCell
                                        key={day.toISOString()}
                                        day={day}
                                        currentMonth={currentMonth}
                                        dayEvents={dayEvents}
                                        onSelectDay={handleSelectDay}
                                    />
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
