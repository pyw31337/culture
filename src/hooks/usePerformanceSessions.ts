'use client';

import { useEffect, useState } from 'react';

export interface PerformanceSessionEntry {
    source: 'interpark';
    url: string;
    checkedAt: string;
    sessions: [string, string][];
}

interface SessionsPayload {
    generatedAt: string;
    items: Record<string, PerformanceSessionEntry>;
}

let sessionsPromise: Promise<SessionsPayload | null> | null = null;

function loadSessions(): Promise<SessionsPayload | null> {
    if (!sessionsPromise) {
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
        sessionsPromise = fetch(`${basePath}/data/sessions.json`)
            .then((response) => (response.ok ? response.json() as Promise<SessionsPayload> : null))
            .catch(() => null);
        // Allow a retry later if the first load failed (e.g. offline).
        sessionsPromise.then((payload) => {
            if (!payload) sessionsPromise = null;
        });
    }
    return sessionsPromise;
}

function kstTodayKey(): string {
    return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * Lazily loads public/data/sessions.json (shared across detail views) and returns
 * upcoming sessions for one performance. Past dates are dropped on the client too,
 * because the static payload can be up to a day old.
 */
export function usePerformanceSessions(performanceId: string | undefined) {
    const [result, setResult] = useState<{ id: string; entry: PerformanceSessionEntry | null } | null>(null);

    useEffect(() => {
        if (!performanceId) return undefined;
        let cancelled = false;
        loadSessions().then((payload) => {
            if (cancelled) return;
            const found = payload?.items?.[performanceId];
            const today = kstTodayKey();
            const upcoming = found ? found.sessions.filter(([date]) => date >= today) : [];
            setResult({ id: performanceId, entry: found && upcoming.length > 0 ? { ...found, sessions: upcoming } : null });
        });
        return () => {
            cancelled = true;
        };
    }, [performanceId]);

    const isCurrent = Boolean(performanceId) && result?.id === performanceId;
    return { entry: isCurrent ? result!.entry : null, loading: Boolean(performanceId) && !isCurrent };
}
