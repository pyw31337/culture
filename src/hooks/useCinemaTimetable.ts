'use client';

import { useEffect, useState } from 'react';
import { CinemaRelayError, fetchCinemaTimetable, type CinemaRelayTarget, type CinemaTimetableResult } from '@/lib/cinema-relay';

type State =
    | { status: 'idle' | 'loading'; data: null; error: null }
    | { status: 'success'; data: CinemaTimetableResult; error: null }
    | { status: 'error'; data: null; error: CinemaRelayError };

/** Live cinema timetable from the mcp.aka.page relay (5 min client cache). */
export function useCinemaTimetable(target: CinemaRelayTarget | null, playDate: string, reloadKey = 0) {
    const [state, setState] = useState<State>({ status: 'idle', data: null, error: null });
    const targetKey = target ? `${target.brand}|${target.name}|${target.relayTheaterId || ''}|${target.lat}|${target.lng}` : '';

    useEffect(() => {
        if (!target) {
            setState({ status: 'idle', data: null, error: null });
            return undefined;
        }
        let cancelled = false;
        setState({ status: 'loading', data: null, error: null });
        fetchCinemaTimetable(target, playDate)
            .then((data) => {
                if (!cancelled) setState({ status: 'success', data, error: null });
            })
            .catch((error: unknown) => {
                if (cancelled) return;
                const relayError = error instanceof CinemaRelayError
                    ? error
                    : new CinemaRelayError('상영시간표를 불러오지 못했습니다.', 'network');
                setState({ status: 'error', data: null, error: relayError });
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [targetKey, playDate, reloadKey]);

    return state;
}
