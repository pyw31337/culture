import type { Performance } from '@/types';

function toDateParts(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const compact = trimmed
        .split('~')[0]
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\[[^\]]*\]/g, ' ')
        .trim();

    const isoMatch = compact.match(/(\d{4})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);
    if (isoMatch) {
        return {
            year: Number(isoMatch[1]),
            month: Number(isoMatch[2]),
            day: Number(isoMatch[3]),
        };
    }

    const numericMatch = compact.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (numericMatch) {
        return {
            year: Number(numericMatch[1]),
            month: Number(numericMatch[2]),
            day: Number(numericMatch[3]),
        };
    }

    return null;
}

function parseStartDate(performance: Pick<Performance, 'date' | 'dateRaw'>) {
    const candidates = [performance.dateRaw, performance.date];

    for (const candidate of candidates) {
        if (!candidate || typeof candidate !== 'string') continue;

        const parts = toDateParts(candidate);
        if (!parts) continue;

        const date = new Date(parts.year, parts.month - 1, parts.day);
        if (!Number.isNaN(date.getTime())) {
            date.setHours(0, 0, 0, 0);
            return date;
        }
    }

    return null;
}

export function getDdayLabel(performance: Pick<Performance, 'date' | 'dateRaw'>) {
    const target = parseStartDate(performance);
    if (!target) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'D-Day';
    if (diffDays > 0) return `D-${diffDays}`;
    return `D+${Math.abs(diffDays)}`;
}
