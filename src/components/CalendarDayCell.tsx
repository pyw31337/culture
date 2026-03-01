import React, { memo } from 'react';
import { clsx } from 'clsx';
import { Performance } from '@/types';
import { GENRE_STYLES } from '@/lib/constants';
import { format, isSameMonth, isSameDay } from 'date-fns';

interface CalendarDayCellProps {
    day: Date;
    currentMonth: Date;
    dayEvents: Performance[];
    onSelectDay: (day: Date) => void;
}

const CalendarDayCell = memo(({ day, currentMonth, dayEvents, onSelectDay }: CalendarDayCellProps) => {
    const isCurrentMonth = isSameMonth(day, currentMonth);
    const isToday = isSameDay(day, new Date());
    const hasEvents = dayEvents.length > 0;

    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                onSelectDay(day);
            }}
            className={clsx(
                "min-h-[60px] sm:min-h-[80px] bg-white dark:bg-gray-900 p-1 sm:p-2 flex flex-col gap-0.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer relative border-r border-b border-gray-200 dark:border-gray-800 overflow-hidden",
                !isCurrentMonth && "opacity-40 bg-gray-50 dark:bg-gray-950"
            )}
        >
            <span className={clsx(
                "text-xs sm:text-sm font-extrabold flex items-center justify-center rounded-full mb-0.5 w-max px-1.5",
                isToday ? "bg-blue-600 text-white" : "text-gray-900 dark:text-gray-400"
            )}>
                {format(day, 'd')}
            </span>

            {/* Mobile View: Circle Badge Count */}
            <div className="flex-1 flex items-center justify-center sm:hidden w-full h-full absolute inset-0 pt-4 pointer-events-none">
                {hasEvents && (
                    <div className="w-6 h-6 rounded-full bg-gray-100/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-[10px] font-black text-gray-900 dark:text-white mt-1 shadow-sm">
                        {dayEvents.length}
                    </div>
                )}
            </div>

            {/* PC/Desktop View: List (Max 5 to fill space) */}
            <div className="hidden sm:flex flex-col gap-[1px] overflow-hidden flex-1">
                {dayEvents.slice(0, 5).map((perf, i) => (
                    <a
                        key={`${perf.id}-${i}`}
                        href={perf.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1.5 px-1 py-[2px] rounded hover:bg-blue-50 dark:hover:bg-gray-700 transition relative z-10 w-full"
                        title={perf.title}
                    >
                        <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", (GENRE_STYLES as any)[perf.genre]?.twBg || 'bg-gray-400')} />
                        <span className="text-[11px] font-bold text-gray-900 dark:text-white truncate">
                            {perf.title}
                        </span>
                    </a>
                ))}
                {dayEvents.length > 5 && (
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 text-left pl-1 cursor-default relative z-10 font-bold mt-auto">
                        +{dayEvents.length - 5}
                    </div>
                )}
            </div>
        </div>
    );
});

CalendarDayCell.displayName = 'CalendarDayCell';

export default CalendarDayCell;
