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
}

type CalendarView = 'daily' | 'weekly' | 'monthly';

export default function CalendarModal({ performances, onClose }: CalendarModalProps) {
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
    const [selectedPopupGenre, setSelectedPopupGenre] = useState('all');

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
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="bg-white dark:bg-gray-900 w-full max-w-[1700px] h-[90vh] rounded-2xl shadow-2xl flex flex-col border border-gray-200 dark:border-gray-800">
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

                    {/* Daily View */}
                    {calendarView === 'daily' && (
                        <div className="flex-grow overflow-y-auto p-4 space-y-3">
                            {(() => {
                                const dayEvents = getPerformancesForDay(currentMonth);
                                if (dayEvents.length === 0) return (
                                    <p className="text-center text-gray-500 py-16 text-lg">일정이 없습니다</p>
                                );
                                return dayEvents.map((perf, i) => (
                                    <a key={`${perf.id}-${i}`} href={perf.link} target="_blank" rel="noopener noreferrer"
                                        className="flex gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 border border-gray-200 dark:border-gray-700 transition group shadow-sm"
                                    >
                                        {perf.image && (
                                            <img src={getOptimizedUrl(perf.image)} alt={perf.title} className="w-14 h-[72px] object-cover rounded bg-gray-100 dark:bg-gray-700 shrink-0" referrerPolicy="no-referrer" />
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={clsx("px-1.5 py-0.5 rounded text-[10px] font-extrabold text-white", (GENRE_STYLES as any)[perf.genre]?.twBg || 'bg-gray-600')}>
                                                    {GENRES.find(g => g.id === perf.genre)?.label}
                                                </span>
                                                <span className="text-[10px] text-gray-500">{perf.venue}</span>
                                            </div>
                                            <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-tight line-clamp-2 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">{perf.title}</h4>
                                        </div>
                                    </a>
                                ));
                            })()}
                        </div>
                    )}

                    {/* Weekly View */}
                    {calendarView === 'weekly' && (
                        <>
                            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                                {eachDayOfInterval({ start: startOfWeek(currentMonth), end: endOfWeek(currentMonth) }).map((day, idx) => (
                                    <div key={day.toISOString()} className={clsx("py-3 text-center text-xs font-extrabold", idx === 0 ? "text-red-500" : idx === 6 ? "text-blue-500" : "text-gray-600 dark:text-gray-400")}>
                                        {format(day, 'eee d일', { locale: ko })}
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 flex-grow overflow-y-auto bg-gray-200 dark:bg-gray-800 gap-[1px]">
                                {eachDayOfInterval({ start: startOfWeek(currentMonth), end: endOfWeek(currentMonth) }).map(day => {
                                    const dayEvents = getPerformancesForDay(day);
                                    const isToday = isSameDay(day, new Date());
                                    return (
                                        <div key={day.toISOString()} className="bg-white dark:bg-gray-900 p-2 flex flex-col gap-1 overflow-y-auto">
                                            <span className={clsx("text-xs font-extrabold mb-1", isToday ? "text-blue-600 dark:text-blue-400" : "text-gray-500")}>
                                                {dayEvents.length}건
                                            </span>
                                            {dayEvents.slice(0, 30).map((perf, i) => (
                                                <a key={`${perf.id}-${i}`} href={perf.link} target="_blank" rel="noopener noreferrer"
                                                    className={clsx("text-[10px] sm:text-xs px-2 py-1 rounded truncate text-white block hover:opacity-80 transition shrink-0", (GENRE_STYLES as any)[perf.genre]?.twBg || 'bg-gray-400 dark:bg-gray-700')}
                                                    title={perf.title}
                                                >{perf.title}</a>
                                            ))}
                                            {dayEvents.length > 30 && <span className="text-[10px] text-gray-500 pl-1 font-bold shrink-0">+{dayEvents.length - 30}</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {/* Monthly View */}
                    {calendarView === 'monthly' && (
                        <>
                            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
                                {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
                                    <div key={day} className={clsx("py-3 text-center text-sm font-extrabold", idx === 0 ? "text-red-500" : idx === 6 ? "text-blue-500" : "text-gray-600 dark:text-gray-400")}>
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

            {/* Day Detail Modal */}
            {selectedDate && (
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedDate(null)}>
                    <div
                        className="bg-white dark:bg-gray-900 w-full max-w-md max-h-[80vh] rounded-2xl shadow-2xl flex flex-col border border-gray-200 dark:border-gray-700 overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-800">
                            <h3 className="text-lg font-extrabold text-gray-900 dark:text-white">
                                {format(selectedDate, 'yyyy년 M월 d일 (eee)', { locale: ko })}
                            </h3>
                            <button onClick={() => setSelectedDate(null)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Genre Tabs - Draggable */}
                        <div
                            ref={scrollRef}
                            className={`w-full px-4 py-3 bg-gray-100/50 dark:bg-black/50 border-b border-gray-200 dark:border-gray-700 overflow-x-auto scrollbar-hide shrink-0 cursor-grab ${isDragging ? 'cursor-grabbing' : ''}`}
                            onMouseDown={onMouseDown}
                            onMouseLeave={onMouseLeave}
                            onMouseUp={onMouseUp}
                            onMouseMove={onMouseMove}
                        >
                            <div className="flex gap-2 w-max pointer-events-none">
                                {GENRES.map(g => (
                                    <button
                                        key={g.id}
                                        onClick={(e) => {
                                            if (isDragging) e.preventDefault();
                                            setSelectedPopupGenre(g.id);
                                        }}
                                        style={{ pointerEvents: 'auto' }}
                                        className={clsx(
                                            "whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-semibold transition-colors border select-none",
                                            selectedPopupGenre === g.id
                                                ? "bg-gray-900 dark:bg-white text-white dark:text-black border-gray-900 dark:border-white"
                                                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-900 dark:hover:text-gray-200"
                                        )}
                                    >
                                        {g.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div
                            ref={listRef}
                            onScroll={onListScroll}
                            className="p-4 overflow-y-auto space-y-3 custom-scrollbar"
                        >
                            {displayedEvents.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">
                                    {selectedPopupGenre === 'all' ? '일정이 없습니다.' : '해당 장르의 일정이 없습니다.'}
                                </p>
                            ) : (
                                <>
                                    {displayedEvents.map((perf, i) => (
                                        <a
                                            key={`${perf.id}-${i}`}
                                            href={perf.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 border border-gray-200 dark:border-gray-700 transition group shadow-sm"
                                        >
                                            {perf.image && (
                                                <img src={getOptimizedUrl(perf.image)} alt={perf.title} className="w-12 h-16 object-cover rounded bg-gray-100 dark:bg-gray-700 shrink-0" referrerPolicy="no-referrer" />
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={clsx(
                                                        "px-1.5 py-0.5 rounded text-[10px] font-extrabold text-white",
                                                        (GENRE_STYLES as any)[perf.genre]?.twBg || 'bg-gray-600'
                                                    )}>
                                                        {GENRES.find(g => g.id === perf.genre)?.label}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500">{perf.venue}</span>
                                                </div>
                                                <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-tight line-clamp-2 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
                                                    {perf.title}
                                                </h4>
                                            </div>
                                        </a>
                                    ))}
                                    {/* Loading Indicator for Infinite Scroll */}
                                    {displayedEvents.length < filteredDateEvents.length && (
                                        <div className="py-2 text-center text-xs text-gray-500">
                                            Loading more...
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </Portal>
    );
}
