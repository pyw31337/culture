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
                "min-h-[80px] sm:min-h-[120px] bg-white dark:bg-black p-2 flex flex-col gap-1 transition-colors hover:bg-gray-50 dark:hover:bg-gray-900 cursor-pointer relative border-r border-b border-gray-200 dark:border-gray-800",
                !isCurrentMonth && "opacity-40 bg-gray-50 dark:bg-gray-950"
            )}
        >
            <span className={clsx(
                "text-sm font-extrabold w-7 h-7 flex items-center justify-center rounded-full mb-1",
                isToday ? "bg-blue-600 text-white" : "text-gray-900 dark:text-gray-400"
            )}>
                {format(day, 'd')}
            </span>

            {/* Mobile View: Circle Badge Count */}
            <div className="flex-1 flex items-center justify-center sm:hidden w-full h-full absolute inset-0 pt-6">
                {hasEvents && (
                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 flex items-center justify-center text-xs font-extrabold text-gray-900 dark:text-white mt-2 shadow-sm">
                        {dayEvents.length}
                    </div>
                )}
            </div>

            {/* PC View: List (Max 5) */}
            <div className="hidden sm:flex flex-col gap-[2px] overflow-hidden">
                {dayEvents.slice(0, 5).map((perf, i) => (
                    <div
                        key={`${perf.id}-${i}`}
                        className={clsx(
                            "text-[10px] sm:text-xs px-2 py-[2px] rounded truncate block hover:bg-gray-100 dark:hover:bg-gray-800 transition relative z-10 font-bold",
                            (GENRE_STYLES as any)[perf.genre]?.twText || 'text-gray-600 dark:text-gray-300'
                        )}
                        title={perf.title}
                    >
                        {perf.title}
                    </div>
                ))}
                {dayEvents.length > 5 && (
                    <div className="text-[10px] text-gray-500 dark:text-gray-400 text-left pl-1 cursor-default relative z-10 font-bold">
                        +{dayEvents.length - 5}
                    </div>
                )}
            </div>
        </div>
    );
});

CalendarDayCell.displayName = 'CalendarDayCell';

export default CalendarDayCell;
