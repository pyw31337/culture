'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, ExternalLink } from 'lucide-react';
import { usePerformanceSessions } from '@/hooks/usePerformanceSessions';
import { formatCompactKoreanDateTime } from '@/lib/build-info';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const MAX_VISIBLE_DAYS = 14;

function formatDayLabel(dateKey: string) {
    const [year, month, day] = dateKey.split('-').map(Number);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return { label: `${month}/${day}`, weekday: WEEKDAYS[weekday], isWeekend: weekday === 0 || weekday === 6 };
}

/**
 * Upcoming session (회차) calendar for a performance. Schedule only: it never shows
 * seat counts/seat numbers and links to the official booking page for availability.
 */
export default function SessionCalendar({ performanceId, bookingUrl }: { performanceId: string; bookingUrl?: string }) {
    const { entry } = usePerformanceSessions(performanceId);
    const [expanded, setExpanded] = useState(false);

    const days = useMemo(() => {
        if (!entry) return [] as { date: string; times: string[] }[];
        const grouped = new Map<string, string[]>();
        entry.sessions.forEach(([date, time]) => {
            const times = grouped.get(date) || [];
            times.push(time);
            grouped.set(date, times);
        });
        return [...grouped.entries()].map(([date, times]) => ({ date, times }));
    }, [entry]);

    if (!entry || days.length === 0) return null;

    const visibleDays = expanded ? days : days.slice(0, MAX_VISIBLE_DAYS);
    const checkedLabel = formatCompactKoreanDateTime(entry.checkedAt, '');
    const linkUrl = entry.url || bookingUrl;

    return (
        <div className="mt-4 rounded-xl border border-indigo-500/10 bg-indigo-50/50 p-4 dark:bg-indigo-500/5">
            <div className="mb-2 flex items-center justify-between gap-2">
                <h4 className="flex items-center gap-1.5 text-[13px] font-bold text-indigo-600 dark:text-indigo-300">
                    <CalendarDays className="h-4 w-4" />
                    공연 회차
                    <span className="text-[11px] font-semibold text-indigo-400">({days.length}일 · {entry.sessions.length}회)</span>
                </h4>
                {checkedLabel && (
                    <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">조회 시점 {checkedLabel}</span>
                )}
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {visibleDays.map(({ date, times }) => {
                    const { label, weekday, isWeekend } = formatDayLabel(date);
                    return (
                        <div key={date} className="flex items-start gap-2 text-[13px]">
                            <span className={`w-[64px] shrink-0 font-bold ${isWeekend ? 'text-rose-500' : 'text-gray-700 dark:text-gray-200'}`}>
                                {label} ({weekday})
                            </span>
                            <span className="flex flex-wrap gap-1">
                                {times.map((time) => (
                                    <span key={time} className="rounded-md bg-white px-1.5 py-0.5 text-[12px] font-semibold text-gray-700 shadow-sm dark:bg-white/10 dark:text-gray-200">
                                        {time}
                                    </span>
                                ))}
                            </span>
                        </div>
                    );
                })}
            </div>
            {days.length > MAX_VISIBLE_DAYS && (
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        setExpanded((value) => !value);
                    }}
                    className="mt-2 text-[12px] font-bold text-indigo-500 hover:underline"
                >
                    {expanded ? '접기' : `회차 더 보기 (+${days.length - MAX_VISIBLE_DAYS}일)`}
                </button>
            )}
            <p className="mt-2 flex flex-wrap items-center gap-1 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                인터파크 공개 회차 정보 기준이며, 잔여석·매진 여부는 예매처에서 확인하세요.
                {linkUrl && (
                    <a
                        href={linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex items-center gap-0.5 font-bold text-indigo-500 hover:underline"
                    >
                        예매처에서 확인 <ExternalLink className="h-3 w-3" />
                    </a>
                )}
            </p>
        </div>
    );
}
