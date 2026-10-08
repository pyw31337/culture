import type { Performance } from '@/types';

/** Date key (YYYY-MM-DD) in Asia/Seoul. */
export function getKstDateKey(now = new Date()): string {
    return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

const DATE_PATTERN = /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/g;

function toKey(year: string, month: string, day: string) {
    const m = Number(month);
    const d = Number(day);
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Extracts the first and last calendar dates from free-form schedule text such as
 * "2026.10.01 ~ 2026.12.31", "2026-10-08 19:00", "20261008". Returns null keys when
 * the text has no parseable date (상시/오픈런 등).
 */
export function parseEventDateRange(value?: string | null): { start: string | null; end: string | null } {
    const text = String(value || '');
    const keys: string[] = [];
    for (const match of text.matchAll(DATE_PATTERN)) {
        const key = toKey(match[1], match[2], match[3]);
        if (key) keys.push(key);
    }
    if (keys.length === 0) {
        const compact = text.trim().match(/^(20\d{2})(\d{2})(\d{2})$/);
        if (compact) {
            const key = toKey(compact[1], compact[2], compact[3]);
            if (key) keys.push(key);
        }
    }
    if (keys.length === 0) return { start: null, end: null };
    // "2026.01.01 ~ 오픈런" / "2026.01.01 ~ 상시": open-ended, not a single-day event.
    const tildeIndex = text.search(/[~～]/);
    if (tildeIndex >= 0) {
        const tail = text.slice(tildeIndex + 1);
        const tailKeys = [...tail.matchAll(DATE_PATTERN)].map((match) => toKey(match[1], match[2], match[3])).filter(Boolean) as string[];
        return { start: keys[0], end: tailKeys.length > 0 ? tailKeys[tailKeys.length - 1] : null };
    }
    return { start: keys[0], end: keys[keys.length - 1] };
}

/** Genres that are not dated events (now-showing movies, OTT titles). */
const UNDATED_GENRES = new Set(['movie', 'ott']);

/**
 * True when a dated event has clearly finished (end date before today, KST).
 * Undated items and movies/OTT are never treated as ended.
 */
export function isPerformanceEnded(performance: Pick<Performance, 'date' | 'genre'> & { dateRaw?: string }, todayKey = getKstDateKey()): boolean {
    if (UNDATED_GENRES.has(performance.genre)) return false;
    const { end } = parseEventDateRange(performance.date || performance.dateRaw);
    return Boolean(end && end < todayKey);
}

export function dropEndedPerformances<T extends Pick<Performance, 'date' | 'genre'>>(items: T[], todayKey = getKstDateKey()): T[] {
    const filtered = items.filter((item) => !isPerformanceEnded(item, todayKey));
    return filtered.length === items.length ? items : filtered;
}
