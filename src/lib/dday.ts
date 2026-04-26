import type { Performance } from '@/types';

function toDateParts(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const compact = trimmed
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

    const shortYearMatch = compact.match(/(^|[^\d])(\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})(?!\d)/);
    if (shortYearMatch) {
        return {
            year: 2000 + Number(shortYearMatch[2]),
            month: Number(shortYearMatch[3]),
            day: Number(shortYearMatch[4]),
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

function getScheduleFallback(performance: Pick<Performance, 'date' | 'dateRaw'>) {
    const source = [performance.dateRaw, performance.date]
        .find((value) => typeof value === 'string' && value.trim().length > 0)
        ?.trim();

    if (!source) return null;
    const normalized = source.toUpperCase();

    if (normalized.includes('OPEN RUN') || source.includes('오픈런')) return '오픈런';
    if (source.includes('상시')) return '상시';
    if (source.includes('예약 확정') || source.includes('일정 조율') || source.includes('옵션에서 선택')) return '예약형';

    return null;
}

export function getDdayLabel(performance: Pick<Performance, 'date' | 'dateRaw'>) {
    const target = parseStartDate(performance);
    if (!target) return getScheduleFallback(performance);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'D-Day';
    if (diffDays > 0) return `D-${diffDays}`;
    return `D+${Math.abs(diffDays)}`;
}
