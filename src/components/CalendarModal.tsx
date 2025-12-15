'use client';

import { useState } from 'react';
import { Performance } from '@/types';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO, isWithinInterval } from 'date-fns';
import { ko } from 'date-fns/locale';
import { X, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';
import { GENRES, GENRE_STYLES } from '@/lib/constants';

// Remove local GENRE_COLORS map

interface CalendarModalProps {
    performances: Performance[];
    onClose: () => void;
}

// Helper for image optimization
const getOptimizedUrl = (url: string, width: number = 200) => {
    if (!url) return "";
    if (url.startsWith('/')) return url;
    if (url.includes('kfescdn')) return url;
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=${width}&q=80&output=webp`;
};

export default function CalendarModal({ performances, onClose }: CalendarModalProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());

    const startDate = startOfWeek(startOfMonth(currentMonth));
    const endDate = endOfWeek(endOfMonth(currentMonth));
    const dayList = eachDayOfInterval({ start: startDate, end: endDate });

    const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

    // Helper to check if a performance is active on a given day
    const getPerformancesForDay = (day: Date) => {
        return performances.filter(perf => {
            const dateStr = perf.date.trim();
            const dayStr = format(day, 'yyyy-MM-dd');

            // Case 1: Range "2024.12.10 ~ 2025.01.10"
            if (dateStr.includes('~')) {
                const [startRaw, endRaw] = dateStr.split('~').map(s => s.trim());
                if (startRaw && endRaw) {
                    // Replace dots with dashes for easier parsing if needed, but simple string comparison works if format is YYYY.MM.DD
                    // Standardize to YYYY-MM-DD
                    const standardStart = startRaw.replace(/\./g, '-');
                    const standardEnd = endRaw.replace(/\./g, '-'); // Warning: endRaw might have extra text? Usually not for simple ranges.

                    // Simple lex comparison for "YYYY-MM-DD" works wonderfully
                    return dayStr >= standardStart && dayStr <= standardEnd;
                }
            }

            // Case 2: Single Date "2024.12.10(Tue) 19:30" or "2024-12-10"
            // Extract the date part (first 10 chars usually if YYYY.MM.DD or YYYY-MM-DD)
            // Kovo/KBL data might use dots or dashes.
            const normalizedDate = dateStr.replace(/\./g, '-').substring(0, 10);
            return normalizedDate === dayStr;
        });
    };

    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    // Filter events for the selected popup date
    const selectedDateEvents = selectedDate ? getPerformancesForDay(selectedDate) : [];

    return (
        <>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                <div className="bg-gray-900 w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex flex-col border border-gray-800">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-800">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-4">
                            <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-800 rounded-full transition"><ChevronLeft /></button>
                            {format(currentMonth, 'yyyy년 M월', { locale: ko })}
                            <button onClick={handleNextMonth} className="p-2 hover:bg-gray-800 rounded-full transition"><ChevronRight /></button>
                        </h2>
                        <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Days Header */}
                    <div className="grid grid-cols-7 border-b border-gray-800 bg-gray-900/50">
                        {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
                            <div key={day} className={clsx("py-3 text-center text-sm font-bold", idx === 0 ? "text-red-500" : idx === 6 ? "text-blue-500" : "text-gray-400")}>
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar Grid */}
                    <div className="grid grid-cols-7 flex-grow overflow-y-auto auto-rows-fr bg-gray-800 gap-[1px]">
                        {dayList.map((day) => {
                            const isCurrentMonth = isSameMonth(day, currentMonth);
                            const dayEvents = getPerformancesForDay(day);
                            const isToday = isSameDay(day, new Date());
                            const hasEvents = dayEvents.length > 0;

                            return (
                                <div
                                    key={day.toISOString()}
                                    onClick={() => setSelectedDate(day)}
                                    className={clsx(
                                        "min-h-[80px] sm:min-h-[120px] bg-gray-900 p-2 flex flex-col gap-1 transition-colors hover:bg-gray-800/80 cursor-pointer relative",
                                        !isCurrentMonth && "opacity-30 bg-gray-900/50"
                                    )}
                                >
                                    <span className={clsx(
                                        "text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full mb-1",
                                        isToday ? "bg-blue-600 text-white" : "text-gray-400"
                                    )}>
                                        {format(day, 'd')}
                                    </span>

                                    {/* Mobile View: Circle Badge Count */}
                                    <div className="flex-1 flex items-center justify-center sm:hidden">
                                        {hasEvents && (
                                            <div className="w-8 h-8 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center text-xs font-bold text-white">
                                                {dayEvents.length}
                                            </div>
                                        )}
                                    </div>

                                    {/* PC View: List (Max 2) - No internal scroll, hidden overflow */}
                                    <div className="hidden sm:flex flex-col gap-1 overflow-hidden">
                                        {dayEvents.slice(0, 2).map(perf => (
                                            <div
                                                key={perf.id}
                                                className={clsx(
                                                    "text-[10px] sm:text-xs px-2 py-1 rounded truncate text-white block hover:opacity-80 transition",
                                                    GENRE_STYLES[perf.genre]?.twBg || 'bg-gray-700'
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
                            <h3 className="text-lg font-bold text-white">
                                {format(selectedDate, 'yyyy년 M월 d일', { locale: ko })}
                            </h3>
                            <button onClick={() => setSelectedDate(null)} className="p-1 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto space-y-3">
                            {selectedDateEvents.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">일정이 없습니다.</p>
                            ) : (
                                selectedDateEvents.map(perf => (
                                    <a
                                        key={perf.id}
                                        href={perf.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex gap-3 p-3 bg-gray-800 rounded-lg hover:bg-gray-750 border border-gray-700 transition group"
                                    >
                                        {perf.image && (
                                            <img src={getOptimizedUrl(perf.image)} alt={perf.title} className="w-12 h-16 object-cover rounded bg-gray-700 shrink-0" />
                                        )}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={clsx(
                                                    "px-1.5 py-0.5 rounded text-[10px] font-bold text-white",
                                                    GENRE_STYLES[perf.genre]?.twBg || 'bg-gray-600'
                                                )}>
                                                    {GENRES.find(g => g.id === perf.genre)?.label}
                                                </span>
                                                <span className="text-[10px] text-gray-500">{perf.venue}</span>
                                            </div>
                                            <h4 className="text-sm font-semibold text-white leading-tight line-clamp-2 group-hover:text-blue-400 transition-colors">
                                                {perf.title}
                                            </h4>
                                        </div>
                                    </a>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
