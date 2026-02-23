'use client';

import { useState, useRef, useMemo } from 'react';
import { Performance } from '@/types';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';
import { GENRES, GENRE_STYLES } from '@/lib/constants';
import { getOptimizedUrl } from '@/lib/utils';
import Portal from './ui/Portal';

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

    // O(N) Pre-calculation: Group performances by date (yyyy-MM-dd)
    // This runs only when 'performances' changes, not on every render/month switch.
    const performancesByDate = useMemo(() => {
        const map = new Map<string, Performance[]>();

        performances.forEach(perf => {
            const dateStr = perf.date.trim();
            // Normalized Date Logic
            // If range: "2024.12.10 ~ 2025.01.10"
            if (dateStr.includes('~')) {
                const [startRaw, endRaw] = dateStr.split('~').map(s => s.trim());
                if (startRaw && endRaw) {
                    const start = new Date(startRaw.replace(/\./g, '-'));
                    const end = new Date(endRaw.replace(/\./g, '-'));

                    // Simple sanity check for invalid dates
                    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                        // Limit huge ranges (optional safety, e.g. loops 365 days)
                        // For now, assume data is reasonable.
                        // Use simplified iteration to avoid 'eachDayOfInterval' overhead if needed,
                        // but eachDayOfInterval is cleaner.
                        try {
                            const interval = eachDayOfInterval({ start, end });
                            interval.forEach(day => {
                                const dayStr = format(day, 'yyyy-MM-dd');
                                if (!map.has(dayStr)) map.set(dayStr, []);
                                map.get(dayStr)!.push(perf);
                            });
                        } catch (e) {
                            // Ignore invalid intervals
                        }
                    }
                }
            } else {
                // Single Date: "2024.12.10(Tue) 19:30" -> "2024-12-10"
                const normalizedDate = dateStr.replace(/\./g, '-').substring(0, 10);
                if (normalizedDate.length === 10) { // Simple validation YYYY-MM-DD
                    if (!map.has(normalizedDate)) map.set(normalizedDate, []);
                    map.get(normalizedDate)!.push(perf);
                }
            }
        });

        return map;
    }, [performances]);

    // O(1) Lookup
    const getPerformancesForDay = (day: Date) => {
        const dayStr = format(day, 'yyyy-MM-dd');
        return performancesByDate.get(dayStr) || [];
    };

    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedPopupGenre, setSelectedPopupGenre] = useState('all');

    // Infinite Scroll State
    const [visibleCount, setVisibleCount] = useState(20);

    // Filter events for the selected popup date
    const selectedDateEvents = selectedDate ? getPerformancesForDay(selectedDate) : [];

    // Apply Genre Filter
    const filteredDateEvents = selectedPopupGenre === 'all'
        ? selectedDateEvents
        : selectedDateEvents.filter(p => p.genre === selectedPopupGenre);

    // Slice for Infinite Scroll
    const displayedEvents = filteredDateEvents.slice(0, visibleCount);

    // Reset visible count when date or genre changes
    if (selectedDate && visibleCount > 20 && displayedEvents.length < visibleCount && filteredDateEvents.length <= 20) {
        // Just fail-safe reset if needed, but useEffect is better.
    }

    // Using simple effect to reset
    useState(() => {
        // logic moved to effect below
    });

    // Drag to scroll logic (Genre Tabs)
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
        const walk = (x - startX) * 2;
        scrollRef.current.scrollLeft = scrollLeft - walk;
    };

    // Reset pagination when content changes
    const prevDateRef = useRef<string | null>(null);
    const prevGenreRef = useRef<string>('all');

    if (selectedDate) {
        const dStr = selectedDate.toISOString();
        if (prevDateRef.current !== dStr || prevGenreRef.current !== selectedPopupGenre) {
            setVisibleCount(20);
            prevDateRef.current = dStr;
            prevGenreRef.current = selectedPopupGenre;
        }
    }

    // Scroll Handler for List
    const listRef = useRef<HTMLDivElement>(null);
    const onListScroll = () => {
        if (listRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = listRef.current;
            if (scrollTop + clientHeight >= scrollHeight - 50) { // 50px threshold
                if (visibleCount < filteredDateEvents.length) {
                    setVisibleCount(prev => prev + 20);
                }
            }
        }
    };

    return (
        <Portal>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="bg-gray-900 w-full max-w-[1700px] h-[90vh] rounded-2xl shadow-2xl flex flex-col border border-gray-800">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-800">
                        <h2 className="text-2xl font-extrabold text-white flex items-center gap-4">
                            <button onClick={() => {
                                if (calendarView === 'monthly') handlePrevMonth();
                                else if (calendarView === 'weekly') setCurrentMonth(subWeeks(currentMonth, 1));
                                else setCurrentMonth(subDays(currentMonth, 1));
                            }} className="p-2 hover:bg-gray-800 rounded-full transition"><ChevronLeft /></button>
                            {calendarView === 'daily'
                                ? format(currentMonth, 'yyyy년 M월 d일 (eee)', { locale: ko })
                                : calendarView === 'weekly'
                                    ? `${format(startOfWeek(currentMonth), 'M/d')} ~ ${format(endOfWeek(currentMonth), 'M/d')}`
                                    : format(currentMonth, 'yyyy년 M월', { locale: ko })}
                            <button onClick={() => {
                                if (calendarView === 'monthly') handleNextMonth();
                                else if (calendarView === 'weekly') setCurrentMonth(addWeeks(currentMonth, 1));
                                else setCurrentMonth(addDays(currentMonth, 1));
                            }} className="p-2 hover:bg-gray-800 rounded-full transition"><ChevronRight /></button>
                        </h2>
                        <div className="flex items-center gap-2">
                            {(['daily', 'weekly', 'monthly'] as CalendarView[]).map(v => (
                                <button
                                    key={v}
                                    onClick={() => setCalendarView(v)}
                                    className={clsx(
                                        'px-3 py-1.5 rounded-lg text-xs font-bold transition-colors',
                                        calendarView === v
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                                    )}
                                >
                                    {v === 'daily' ? '일간' : v === 'weekly' ? '주간' : '월간'}
                                </button>
                            ))}
                            <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition ml-2">
                                <X className="w-6 h-6" />
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
                                return dayEvents.map(perf => (
                                    <a key={`${perf.id}-${perf.venue}`} href={perf.link} target="_blank" rel="noopener noreferrer"
                                        className="flex gap-3 p-3 bg-gray-800 rounded-lg hover:bg-gray-750 border border-gray-700 transition group"
                                    >
                                        {perf.image && (
                                            <img src={getOptimizedUrl(perf.image)} alt={perf.title} className="w-14 h-[72px] object-cover rounded bg-gray-700 shrink-0" referrerPolicy="no-referrer" />
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={clsx("px-1.5 py-0.5 rounded text-[10px] font-extrabold text-white", (GENRE_STYLES as any)[perf.genre]?.twBg || 'bg-gray-600')}>
                                                    {GENRES.find(g => g.id === perf.genre)?.label}
                                                </span>
                                                <span className="text-[10px] text-gray-500">{perf.venue}</span>
                                            </div>
                                            <h4 className="text-sm font-bold text-white leading-tight line-clamp-2 group-hover:text-blue-400 transition-colors">{perf.title}</h4>
                                        </div>
                                    </a>
                                ));
                            })()}
                        </div>
                    )}

                    {/* Weekly View */}
                    {calendarView === 'weekly' && (
                        <>
                            <div className="grid grid-cols-7 border-b border-gray-800 bg-gray-900/50">
                                {eachDayOfInterval({ start: startOfWeek(currentMonth), end: endOfWeek(currentMonth) }).map((day, idx) => (
                                    <div key={day.toISOString()} className={clsx("py-3 text-center text-xs font-extrabold", idx === 0 ? "text-red-500" : idx === 6 ? "text-blue-500" : "text-gray-400")}>
                                        {format(day, 'eee d일', { locale: ko })}
                                    </div>
                                ))}
                            </div>
                            <div className="grid grid-cols-7 flex-grow overflow-y-auto bg-gray-800 gap-[1px]">
                                {eachDayOfInterval({ start: startOfWeek(currentMonth), end: endOfWeek(currentMonth) }).map(day => {
                                    const dayEvents = getPerformancesForDay(day);
                                    const isToday = isSameDay(day, new Date());
                                    return (
                                        <div key={day.toISOString()} className="bg-gray-900 p-2 flex flex-col gap-1 overflow-y-auto">
                                            <span className={clsx("text-xs font-extrabold mb-1", isToday ? "text-blue-400" : "text-gray-500")}>
                                                {dayEvents.length}건
                                            </span>
                                            {dayEvents.slice(0, 10).map(perf => (
                                                <a key={perf.id} href={perf.link} target="_blank" rel="noopener noreferrer"
                                                    className={clsx("text-[10px] px-2 py-1 rounded truncate text-white block hover:opacity-80 transition", (GENRE_STYLES as any)[perf.genre]?.twBg || 'bg-gray-700')}
                                                    title={perf.title}
                                                >{perf.title}</a>
                                            ))}
                                            {dayEvents.length > 10 && <span className="text-[10px] text-gray-500 pl-1">+{dayEvents.length - 10}</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {/* Monthly View */}
                    {calendarView === 'monthly' && (
                        <>
                            <div className="grid grid-cols-7 border-b border-gray-800 bg-gray-900/50">
                                {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
                                    <div key={day} className={clsx("py-3 text-center text-sm font-extrabold", idx === 0 ? "text-red-500" : idx === 6 ? "text-blue-500" : "text-gray-400")}>
                                        {day}
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-7 flex-grow overflow-y-auto auto-rows-fr bg-gray-800 gap-[1px]">
                                {dayList.map((day) => {
                                    const isCurrentMonth = isSameMonth(day, currentMonth);
                                    const dayEvents = getPerformancesForDay(day);
                                    const isToday = isSameDay(day, new Date());
                                    const hasEvents = dayEvents.length > 0;

                                    return (
                                        <div
                                            key={day.toISOString()}
                                            onClick={() => {
                                                setSelectedDate(day);
                                                setSelectedPopupGenre('all');
                                            }}
                                            className={clsx(
                                                "min-h-[80px] sm:min-h-[120px] bg-gray-900 p-2 flex flex-col gap-1 transition-colors hover:bg-gray-800/80 cursor-pointer relative",
                                                !isCurrentMonth && "opacity-30 bg-gray-900/50"
                                            )}
                                        >
                                            <span className={clsx(
                                                "text-sm font-extrabold w-7 h-7 flex items-center justify-center rounded-full mb-1",
                                                isToday ? "bg-blue-600 text-white" : "text-gray-400"
                                            )}>
                                                {format(day, 'd')}
                                            </span>

                                            {/* Mobile View: Circle Badge Count */}
                                            <div className="flex-1 flex items-center justify-center sm:hidden">
                                                {hasEvents && (
                                                    <div className="w-8 h-8 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center text-xs font-extrabold text-white">
                                                        {dayEvents.length}
                                                    </div>
                                                )}
                                            </div>

                                            {/* PC View: List (Max 2) */}
                                            <div className="hidden sm:flex flex-col gap-1 overflow-hidden">
                                                {dayEvents.slice(0, 2).map(perf => (
                                                    <div
                                                        key={perf.id}
                                                        className={clsx(
                                                            "text-[10px] sm:text-xs px-2 py-1 rounded truncate text-white block hover:opacity-80 transition",
                                                            (GENRE_STYLES as any)[perf.genre]?.twBg || 'bg-gray-700'
                                                        )}
                                                        title={perf.title}
                                                    >
                                                        {perf.title}
                                                    </div>
                                                ))}
                                                {dayEvents.length > 2 && (
                                                    <button
                                                        className="text-[10px] text-gray-400 hover:text-white text-left pl-1"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setSelectedDate(day);
                                                            setSelectedPopupGenre('all');
                                                        }}
                                                    >
                                                        +{dayEvents.length - 2} more
                                                    </button>
                                                )}
                                            </div>
                                        </div>
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
                        className="bg-gray-900 w-full max-w-md max-h-[80vh] rounded-2xl shadow-2xl flex flex-col border border-gray-700 overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800">
                            <h3 className="text-lg font-extrabold text-white">
                                {format(selectedDate, 'yyyy년 M월 d일 (eee)', { locale: ko })}
                            </h3>
                            <button onClick={() => setSelectedDate(null)} className="p-1 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Genre Tabs - Draggable */}
                        <div
                            ref={scrollRef}
                            className={`w-full px-4 py-3 bg-black/50 border-b border-gray-700 overflow-x-auto scrollbar-hide shrink-0 cursor-grab ${isDragging ? 'cursor-grabbing' : ''}`}
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
                                                ? "bg-white text-black border-white"
                                                : "bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500 hover:text-gray-200"
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
                                    {displayedEvents.map(perf => (
                                        <a
                                            key={`${perf.id}-${perf.venue}`} // Use composite key if duplicates exist
                                            href={perf.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex gap-3 p-3 bg-gray-800 rounded-lg hover:bg-gray-750 border border-gray-700 transition group"
                                        >
                                            {perf.image && (
                                                <img src={getOptimizedUrl(perf.image)} alt={perf.title} className="w-12 h-16 object-cover rounded bg-gray-700 shrink-0" referrerPolicy="no-referrer" />
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
                                                <h4 className="text-sm font-bold text-white leading-tight line-clamp-2 group-hover:text-blue-400 transition-colors">
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
