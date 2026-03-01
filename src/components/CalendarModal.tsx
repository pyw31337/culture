'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { Performance } from '@/types';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { GENRES, GENRE_STYLES } from '@/lib/constants';
import { getOptimizedUrl } from '@/lib/utils';
import Portal from './ui/Portal';
import CalendarDayCell from './CalendarDayCell';

interface CalendarModalProps {
    performances: Performance[];
    onClose: () => void;
    selectedGenre?: string;
    onGenreSelect?: (genre: string) => void;
}

type CalendarView = 'daily' | 'weekly' | 'monthly';

export default function CalendarModal({ performances, onClose, selectedGenre = 'all', onGenreSelect }: CalendarModalProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [calendarView, setCalendarView] = useState<CalendarView>('monthly');

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
                    const start = new Date(startRaw.replace(/\./g, '-'));
                    const end = new Date(endRaw.replace(/\./g, '-'));

                    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                        try {
                            // OPTIMIZATION 1: Cap extreme date ranges
                            // Cap limits how many days we loop to prevent huge object allocations
                            let maxEnd = end;
                            const MAX_DAYS = 60; // Max span displayed on the map to prevent clutter and memory spikes
                            const diffTime = Math.abs(end.getTime() - start.getTime());
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                            if (perf.genre === 'movie') {
                                // For OTT or Movies, only map to their start/release date.
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
        return performancesByDate.get(dayStr) || [];
    };

    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedPopupGenre, setSelectedPopupGenre] = useState(selectedGenre);

    const [visibleCount, setVisibleCount] = useState(20);

    const selectedDateEvents = useMemo(() => {
        return selectedDate ? getPerformancesForDay(selectedDate) : [];
    }, [selectedDate, performancesByDate]);

    const filteredDateEvents = useMemo(() => {
        return selectedPopupGenre === 'all'
            ? selectedDateEvents
            : selectedDateEvents.filter(p => p.genre === selectedPopupGenre);
    }, [selectedDateEvents, selectedPopupGenre]);

    const displayedEvents = filteredDateEvents.slice(0, visibleCount);

    // Reset pagination when selection changes
    useEffect(() => {
        setVisibleCount(20);
    }, [selectedDate, selectedPopupGenre]);

    // Drag to scroll logic
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    const onMouseDown = (e: React.MouseEvent) => {
        if (!scrollRef.current) return;
        setIsDragging(true);
        setStartX(e.pageX - scrollRef.current.offsetLeft);
        setScrollLeft(scrollRef.current.scrollLeft);
    };

    const onMouseLeave = () => setIsDragging(false);
    const onMouseUp = () => setIsDragging(false);

    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollRef.current.offsetLeft;
        const walk = (x - startX) * 2;
        scrollRef.current.scrollLeft = scrollLeft - walk;
    };

    // Scroll Handler for List
    const listRef = useRef<HTMLDivElement>(null);
    const onListScroll = () => {
        if (listRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = listRef.current;
            if (scrollTop + clientHeight >= scrollHeight - 50) {
                if (visibleCount < filteredDateEvents.length) {
                    setVisibleCount(prev => prev + 20);
                }
            }
        }
    };

    return (
        <Portal>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                <div className="bg-white dark:bg-gray-900 w-full h-full shadow-2xl flex flex-col border-0">
                    {/* Header */}
                    <div className="flex items-center justify-between p-3 sm:p-6 border-b border-gray-200 dark:border-gray-800 overflow-hidden">
                        <h2 className="text-base sm:text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-1 sm:gap-4 truncate">
                            <button onClick={() => {
                                if (calendarView === 'monthly') handlePrevMonth();
                                else if (calendarView === 'weekly') setCurrentMonth(subWeeks(currentMonth, 1));
                                else setCurrentMonth(subDays(currentMonth, 1));
                            }} className="p-1 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition shrink-0"><ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" /></button>

                            <span className="hidden sm:inline">
                                {calendarView === 'daily'
                                    ? format(currentMonth, 'yyyy년 M월 d일 (eee)', { locale: ko })
                                    : calendarView === 'weekly'
                                        ? `${format(startOfWeek(currentMonth), 'M/d')} ~ ${format(endOfWeek(currentMonth), 'M/d')}`
                                        : format(currentMonth, 'yyyy년 M월', { locale: ko })}
                            </span>
                            <span className="sm:hidden text-base truncate">
                                {calendarView === 'daily'
                                    ? format(currentMonth, 'yy.MM.dd', { locale: ko })
                                    : calendarView === 'weekly'
                                        ? `${format(startOfWeek(currentMonth), 'M/d')}~${format(endOfWeek(currentMonth), 'M/d')}`
                                        : format(currentMonth, 'yy.MM', { locale: ko })}
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
                                    {v === 'daily' ? '일간' : v === 'weekly' ? '주간' : '월간'}
                                </button>
                            ))}
                            <button onClick={onClose} className="p-1 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition ml-0 sm:ml-2 shrink-0">
                                <X className="w-5 h-5 sm:w-6 sm:h-6" />
                            </button>
                        </div>
                    </div>

                    {/* Category Nav Header (Sync with PerformanceList) */}
                    {onGenreSelect && (
                        <div className="w-full px-4 py-3 bg-gray-100/50 dark:bg-black/50 border-b border-gray-200 dark:border-gray-800 overflow-x-auto scrollbar-hide shrink-0 cursor-grab"
                            onMouseDown={onMouseDown} onMouseLeave={onMouseLeave} onMouseUp={onMouseUp} onMouseMove={onMouseMove} ref={scrollRef}>
                            <div className="flex gap-2 w-max">
                                {GENRES.filter(g => g.id !== 'movie').map((genre) => {
                                    const isSelected = selectedGenre === genre.id;

                                    return (
                                        <button
                                            key={genre.id}
                                            onClick={() => { onGenreSelect(genre.id); setSelectedPopupGenre(genre.id); }}
                                            className={clsx(
                                                "px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 border shadow-sm",
                                                isSelected
                                                    ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white"
                                                    : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800"
                                            )}
                                        >
                                            {genre.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Performance Day List (Unified Component) */}
                    {(calendarView === 'daily' || selectedDate) && (
                        <div
                            ref={listRef}
                            onScroll={onListScroll}
                            className={clsx(
                                "flex-grow overflow-y-auto p-4 space-y-3 bg-white dark:bg-gray-900 custom-scrollbar relative",
                                selectedDate && "z-[10001]"
                            )}
                        >
                            {/* Header for Monthly Detail View inside the same container or as a standalone overlay */}
                            {selectedDate && (
                                <div className="sticky top-0 z-20 -mx-4 -mt-4 mb-4 p-4 border-b border-gray-200 dark:border-gray-800 flex justify-between items-center bg-gray-50/95 dark:bg-gray-900/95 backdrop-blur-sm">
                                    <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">
                                        {format(selectedDate, 'yyyy년 M월 d일 (eee)', { locale: ko })}
                                    </h3>
                                    <button onClick={() => setSelectedDate(null)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            )}

                            {/* Genre Tabs (Unified for Daily & Monthly Detail) */}
                            <div
                                ref={scrollRef}
                                className="sticky top-0 z-10 -mx-4 -mt-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 px-4 py-3 mb-4 overflow-x-auto scrollbar-hide shrink-0 cursor-grab"
                                onMouseDown={onMouseDown} onMouseLeave={onMouseLeave} onMouseUp={onMouseUp} onMouseMove={onMouseMove}
                            >
                                <div className="flex gap-2 w-max">
                                    {GENRES.filter(g => g.id !== 'movie').map((genre) => {
                                        const isSelected = selectedPopupGenre === genre.id;
                                        const activeDay = selectedDate || currentMonth;
                                        const dayEvents = getPerformancesForDay(activeDay);
                                        const count = genre.id === 'all'
                                            ? dayEvents.length
                                            : dayEvents.filter(p => p.genre === genre.id).length;

                                        const isEmpty = count === 0;

                                        return (
                                            <button
                                                key={genre.id}
                                                onClick={() => {
                                                    setSelectedPopupGenre(genre.id);
                                                }}
                                                disabled={isEmpty && genre.id !== 'all'}
                                                className={clsx(
                                                    "px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 border shadow-sm",
                                                    isSelected
                                                        ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white opacity-100"
                                                        : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800",
                                                    isEmpty && genre.id !== 'all' && "opacity-30 grayscale cursor-not-allowed"
                                                )}
                                            >
                                                {genre.label} {count > 0 && <span className="ml-1 opacity-60 text-[10px]">{count}</span>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {(() => {
                                const activeDay = selectedDate || currentMonth;
                                const rawEvents = getPerformancesForDay(activeDay);
                                const filteredEvents = selectedPopupGenre === 'all'
                                    ? rawEvents
                                    : rawEvents.filter(p => p.genre === selectedPopupGenre);

                                const displayedDailyEvents = filteredEvents.slice(0, visibleCount);

                                if (filteredEvents.length === 0) return (
                                    <div className="flex flex-col items-center justify-center py-20 opacity-40">
                                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                                            <X className="w-8 h-8 text-gray-400" />
                                        </div>
                                        <p className="text-center text-gray-500 text-lg font-bold">일정이 없습니다</p>
                                    </div>
                                );
                                return (
                                    <div className="space-y-3">
                                        {displayedDailyEvents.map((perf, i) => (
                                            <a key={`${perf.id}-${i}`} href={perf.link} target="_blank" rel="noopener noreferrer"
                                                className="flex gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 border border-gray-200 dark:border-gray-700 transition group shadow-sm"
                                            >
                                                {perf.image && (
                                                    <img src={getOptimizedUrl(perf.image)} alt={perf.title} className="w-12 h-16 object-cover rounded bg-gray-100 dark:bg-gray-700 shrink-0" referrerPolicy="no-referrer" />
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={clsx("px-1.5 py-0.5 rounded text-[10px] font-extrabold text-white", (GENRE_STYLES as any)[perf.genre]?.twBg || 'bg-gray-600')}>
                                                            {GENRES.find(g => g.id === perf.genre)?.label}
                                                        </span>
                                                        <span className="text-[10px] text-gray-500 truncate">{perf.venue}</span>
                                                    </div>
                                                    <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-tight line-clamp-2 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">{perf.title}</h4>
                                                </div>
                                            </a>
                                        ))}

                                        {displayedDailyEvents.length < filteredEvents.length && (
                                            <div className="py-6 text-center text-xs text-gray-500 font-bold animate-pulse">
                                                데이터를 더 불러오는 중...
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* Weekly View (Vertical Row Layout - Redensified) */}
                    {calendarView === 'weekly' && !selectedDate && (
                        <div className="flex-grow overflow-y-auto flex flex-col bg-gray-50 dark:bg-gray-900">
                            {eachDayOfInterval({
                                start: startOfWeek(currentMonth, { weekStartsOn: 0 }),
                                end: endOfWeek(currentMonth, { weekStartsOn: 0 })
                            }).map((day, idx) => {
                                const dayEvents = getPerformancesForDay(day);
                                const isToday = isSameDay(day, new Date());

                                return (
                                    <div key={day.toISOString()} className="flex border-b border-gray-200 dark:border-gray-800 min-h-[80px] sm:min-h-[100px] last:border-b-0">
                                        {/* Day Info Sidebar (More compact) */}
                                        <div className={clsx(
                                            "w-16 sm:w-24 flex flex-col items-center justify-center border-r border-gray-200 dark:border-gray-800 shrink-0 select-none",
                                            isToday ? "bg-blue-50/50 dark:bg-blue-900/20" : "bg-gray-50/50 dark:bg-gray-900/30"
                                        )}>
                                            <span className={clsx(
                                                "text-[10px] sm:text-xs font-black truncate w-full text-center px-1 uppercase",
                                                idx === 0 ? "text-red-500" : idx === 6 ? "text-blue-500" : "text-gray-500 dark:text-gray-400"
                                            )}>
                                                {format(day, 'eee', { locale: ko })}
                                            </span>
                                            <span className="text-lg sm:text-2xl font-black text-gray-900 dark:text-white leading-none mt-0.5">
                                                {format(day, 'd')}
                                            </span>
                                            <span className={clsx(
                                                "text-[9px] sm:text-[10px] font-bold mt-1 px-1.5 py-0.5 rounded-full border",
                                                dayEvents.length > 0 ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 border-blue-200 dark:border-blue-800" : "text-gray-400 border-transparent"
                                            )}>
                                                {dayEvents.length}건
                                            </span>
                                        </div>

                                        {/* Performance List Viewport (Tighter Gap) */}
                                        <div className="flex-grow p-1.5 sm:p-3 overflow-x-auto bg-white dark:bg-gray-900">
                                            <div className="flex flex-col gap-0.5 min-w-max sm:min-w-0">
                                                {dayEvents.length > 0 ? (
                                                    dayEvents.slice(0, 50).map((perf, i) => (
                                                        <a
                                                            key={`${perf.id}-${i}`}
                                                            href={perf.link}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className={clsx(
                                                                "group flex items-center gap-1.5 text-[11px] sm:text-sm px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition border border-transparent hover:border-gray-200 dark:hover:border-gray-700 max-w-[500px] sm:max-w-none text-gray-900 dark:text-white font-bold"
                                                            )}
                                                            title={perf.title}
                                                        >
                                                            <span className={clsx("w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0", (GENRE_STYLES as any)[perf.genre]?.twBg || 'bg-gray-400')} />
                                                            <span className="truncate">{perf.title}</span>
                                                            {perf.venue && (
                                                                <span className="text-[9px] sm:text-[11px] text-gray-400 font-medium ml-auto hidden sm:block shrink-0">{perf.venue}</span>
                                                            )}
                                                        </a>
                                                    ))
                                                ) : (
                                                    <div className="h-full flex items-center justify-center text-gray-400 text-[10px] sm:text-xs font-medium italic opacity-60 py-2">
                                                        일정이 없습니다
                                                    </div>
                                                )}
                                                {dayEvents.length > 50 && (
                                                    <div className="text-[10px] text-gray-500 font-bold pl-2 py-0.5">
                                                        외 {dayEvents.length - 50}건 더보기
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Monthly View (Reduced font size and padding) */}
                    {calendarView === 'monthly' && (
                        <>
                            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 shrink-0">
                                {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
                                    <div key={day} className={clsx("py-2 text-center text-[10px] sm:text-xs font-black", idx === 0 ? "text-red-500" : idx === 6 ? "text-blue-500" : "text-gray-500 dark:text-gray-400")}>
                                        {day}
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-7 flex-grow overflow-y-auto auto-rows-fr bg-gray-200 dark:bg-gray-800 gap-[1px]">
                                {dayList.map((day) => {
                                    const dayEvents = getPerformancesForDay(day);
                                    return (
                                        <CalendarDayCell
                                            key={day.toISOString()}
                                            day={day}
                                            currentMonth={currentMonth}
                                            dayEvents={dayEvents}
                                            onSelectDay={(d) => {
                                                setSelectedDate(d);
                                                setSelectedPopupGenre('all');
                                            }}
                                        />
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </Portal>
    );
}
