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
                "min-h-[60px] sm:min-h-[100px] bg-white dark:bg-black p-1 sm:p-2 flex flex-col gap-0.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer relative border-r border-b border-gray-200 dark:border-gray-800",
                !isCurrentMonth && "opacity-40 bg-gray-50 dark:bg-gray-950"
            )}
        >
            <span className={clsx(
                "text-xs sm:text-sm font-extrabold w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full mb-0.5",
                isToday ? "bg-blue-600 text-white" : "text-gray-900 dark:text-gray-400"
            )}>
                {format(day, 'd')}
            </span>

            {/* Mobile View: Circle Badge Count */}
            <div className="flex-1 flex items-center justify-center sm:hidden w-full h-full absolute inset-0 pt-4">
                {hasEvents && (
                    <div className="w-6 h-6 rounded-full bg-gray-100/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 flex items-center justify-center text-[10px] font-black text-gray-900 dark:text-white mt-1 shadow-sm">
                        {dayEvents.length}
                    </div>
                )}
            </div>

            {/* PC View: List (Max 3 as requested) */}
            <div className="hidden sm:flex flex-col gap-[1px] overflow-hidden">
                {dayEvents.slice(0, 3).map((perf, i) => (
                    <div
                        key={`${perf.id}-${i}`}
                        className={clsx(
                            "text-[10px] px-1.5 py-[1px] rounded truncate block hover:bg-gray-100 dark:hover:bg-gray-800 transition relative z-10 font-bold",
                            (GENRE_STYLES as any)[perf.genre]?.twText || 'text-gray-600 dark:text-gray-300'
                        )}
                        title={perf.title}
                    >
                        {perf.title}
                    </div>
                ))}
                {dayEvents.length > 3 && (
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 text-left pl-1 cursor-default relative z-10 font-bold">
                        +{dayEvents.length - 3}
                    </div>
                )}
            </div>
        </div>
    );
});

CalendarDayCell.displayName = 'CalendarDayCell';

export default CalendarDayCell;
