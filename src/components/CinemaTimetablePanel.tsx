'use client';

import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { ExternalLink, RotateCw } from 'lucide-react';
import { useCinemaTimetable } from '@/hooks/useCinemaTimetable';
import { getCinemaFallbackLinks, getCinemaRelayChain, kstDateKey, type CinemaRelayTarget } from '@/lib/cinema-relay';

const DAY_OPTIONS = [
    { offset: 0, label: '오늘' },
    { offset: 1, label: '내일' },
    { offset: 2, label: '모레' },
];

function formatFetchedAt(iso: string) {
    try {
        return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
    } catch {
        return '';
    }
}

function FallbackLinks({ target }: { target: CinemaRelayTarget }) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {getCinemaFallbackLinks(target).map((link) => (
                <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-1 text-[10px] font-bold text-white transition-colors hover:bg-indigo-700"
                >
                    {link.label} <ExternalLink size={10} />
                </a>
            ))}
        </div>
    );
}

/**
 * Live timetable for one cinema (CGV / 메가박스 / 롯데시네마) from the public relay.
 * Values are "as of query time"; booking always happens on the official site.
 */
export default function CinemaTimetablePanel({ target }: { target: CinemaRelayTarget }) {
    const [dayOffset, setDayOffset] = useState(0);
    const [reloadKey, setReloadKey] = useState(0);
    const supported = Boolean(getCinemaRelayChain(target.brand, target.name));
    const playDate = kstDateKey(dayOffset);
    const state = useCinemaTimetable(supported ? target : null, playDate, reloadKey);

    const movies = useMemo(() => {
        if (state.status !== 'success') return [];
        const grouped = new Map<string, typeof state.data.showtimes>();
        state.data.showtimes.forEach((showtime) => {
            const list = grouped.get(showtime.movieName) || [];
            list.push(showtime);
            grouped.set(showtime.movieName, list);
        });
        return [...grouped.entries()];
    }, [state]);

    if (!supported) {
        return (
            <div className="space-y-2 p-2 text-[11px] text-gray-500 dark:text-gray-400">
                <p>이 영화관은 실시간 상영시간표를 제공하지 않습니다.</p>
                <FallbackLinks target={target} />
            </div>
        );
    }

    return (
        <div className="space-y-2 p-2">
            <div className="flex items-center justify-between gap-2">
                <div className="flex gap-1">
                    {DAY_OPTIONS.map((option) => (
                        <button
                            key={option.offset}
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                setDayOffset(option.offset);
                            }}
                            className={clsx(
                                'rounded-md px-2 py-0.5 text-[10px] font-bold transition-colors',
                                dayOffset === option.offset
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300',
                            )}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
                <button
                    type="button"
                    onClick={(event) => {
                        event.stopPropagation();
                        setReloadKey((value) => value + 1);
                    }}
                    className="text-gray-400 hover:text-indigo-600"
                    aria-label="상영시간표 새로고침"
                >
                    <RotateCw size={12} className={state.status === 'loading' ? 'animate-spin' : undefined} />
                </button>
            </div>

            {state.status === 'loading' && (
                <p className="py-3 text-center text-[11px] text-gray-400">상영시간표를 불러오는 중…</p>
            )}

            {state.status === 'error' && (
                <div className="space-y-2 rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                    <p>{state.error.message}</p>
                    <FallbackLinks target={target} />
                </div>
            )}

            {state.status === 'success' && movies.length === 0 && (
                <div className="space-y-2 text-[11px] text-gray-500 dark:text-gray-400">
                    <p>조회된 상영 회차가 없습니다.</p>
                    <FallbackLinks target={target} />
                </div>
            )}

            {state.status === 'success' && movies.length > 0 && (
                <>
                    <div className="space-y-2">
                        {movies.map(([movieName, showtimes]) => (
                            <div key={movieName} className="rounded-lg border border-gray-100 bg-gray-50 p-2 dark:border-gray-800 dark:bg-gray-800/50">
                                <h4 className="mb-1 line-clamp-1 text-[12px] font-bold text-gray-900 dark:text-gray-100">{movieName}</h4>
                                <div className="flex flex-wrap gap-1">
                                    {showtimes.map((showtime, index) => {
                                        const soldOut = showtime.remainingSeats === 0;
                                        return (
                                            <span
                                                key={`${showtime.startTime}-${showtime.screenName || ''}-${index}`}
                                                className={clsx(
                                                    'rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold shadow-sm dark:bg-gray-900',
                                                    soldOut ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-200',
                                                )}
                                                title={[showtime.screenName, showtime.endTime ? `~${showtime.endTime}` : ''].filter(Boolean).join(' ')}
                                            >
                                                {showtime.startTime}
                                                {typeof showtime.remainingSeats === 'number' && (
                                                    <span className="ml-1 text-[9px] font-medium text-indigo-500">
                                                        {soldOut ? '매진' : `${showtime.remainingSeats}${typeof showtime.totalSeats === 'number' ? `/${showtime.totalSeats}` : ''}석`}
                                                    </span>
                                                )}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="text-[9.5px] leading-snug text-gray-400">
                        {formatFetchedAt(state.data.fetchedAt)} 조회 시점 기준 · 잔여석은 수시로 바뀌니 예매 전 공식 앱/웹에서 다시 확인하세요.
                    </p>
                    <FallbackLinks target={target} />
                </>
            )}
        </div>
    );
}
