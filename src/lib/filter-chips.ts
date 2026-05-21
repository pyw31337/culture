/**
 * Matching helpers for the quick filter chips (date + price) that live
 * above the results grid. Kept in their own file so the logic is testable
 * in isolation and reusable from both filterPerformances() and the chip
 * UI (for things like "show count per chip" later).
 */

import type { Performance } from '@/types';
import { getScheduleWindow, getKoreanReferenceDate } from './performance-filter';
import type { DateFilterId, PriceFilterId } from './constants';

/* -------------------------------------------------------------------- */
/* Date filter                                                           */
/* -------------------------------------------------------------------- */

interface DateRange {
    start: Date;
    end: Date;
}

/**
 * Resolve a date filter id into a [start, end] window in the KST reference
 * frame used by the rest of the app. Returns null when the id is not
 * recognized (callers should then short-circuit out of date filtering).
 */
export function resolveDateFilterRange(id: DateFilterId | null | undefined): DateRange | null {
    if (!id) return null;

    const today = getKoreanReferenceDate();
    today.setHours(0, 0, 0, 0);

    if (id === 'today') {
        const end = new Date(today);
        end.setHours(23, 59, 59, 999);
        return { start: today, end };
    }

    if (id === 'this-week') {
        // From now through the upcoming Sunday inclusive. Mon..Sun week.
        const dow = today.getDay(); // Sun=0 ... Sat=6
        const daysUntilSun = (7 - dow) % 7; // 0 if today is Sunday
        const end = new Date(today);
        end.setDate(today.getDate() + daysUntilSun);
        end.setHours(23, 59, 59, 999);
        return { start: today, end };
    }

    if (id === 'weekend') {
        // Friday evening through Sunday end. If today is already Fri/Sat/Sun
        // we use today as the start so weekend shows current weekend events.
        const dow = today.getDay();
        const start = new Date(today);
        if (dow < 5) {
            start.setDate(today.getDate() + (5 - dow)); // jump to Friday
        }
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        const daysToSun = (7 - end.getDay()) % 7;
        end.setDate(end.getDate() + daysToSun);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }

    if (id === 'next-week') {
        const dow = today.getDay();
        const daysUntilNextMon = ((8 - dow) % 7) || 7; // strict next Mon
        const start = new Date(today);
        start.setDate(today.getDate() + daysUntilNextMon);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        return { start, end };
    }

    return null;
}

/**
 * True iff at least one date in the performance's schedule overlaps the
 * given window. Performances are date strings of the form 'YYYY.MM.DD'
 * (single) or 'YYYY.MM.DD ~ YYYY.MM.DD' (range), normalized by
 * getScheduleWindow().
 */
export function performanceMatchesDateRange(
    performance: Pick<Performance, 'date' | 'dateRaw'>,
    range: DateRange
): boolean {
    const window = getScheduleWindow(performance);
    // getScheduleWindow returns nullable start/end for unparsed dates - those
    // are excluded from date filters (we can't tell when they happen).
    if (!window || !window.start || !window.end) return false;
    // Overlap test: [a, b] overlaps [c, d] iff a <= d AND c <= b.
    return window.start.getTime() <= range.end.getTime()
        && range.start.getTime() <= window.end.getTime();
}

/* -------------------------------------------------------------------- */
/* Price filter                                                          */
/* -------------------------------------------------------------------- */

/**
 * Parse the lowest ticket price from a free-form price string. Returns
 * null when no numeric price can be extracted (we treat that as "unknown
 * price" and exclude it from priced-tier filters - but include it under
 * the 'free' tier ONLY if the text explicitly says 무료).
 *
 * Examples:
 *   "전석 45,000원"            -> 45000
 *   "R석 110,000원 / S석 88,000원" -> 88000  (we want the lowest)
 *   "무료"                     -> 0
 *   "사전 예약 후 안내"          -> null
 */
export function parseMinPriceWon(priceStr: string | null | undefined): number | null {
    if (!priceStr) return null;
    const compact = priceStr.replace(/\s+/g, '');
    if (/^(무료|0|0원|입장무료|관람무료|무료입장)$/.test(compact)) return 0;
    if (/무료/.test(compact)) {
        // Sometimes prices are written as "무료 (사전예약)" — also free.
        if (!/\d/.test(compact)) return 0;
    }

    let min: number | null = null;
    // Match every "<digits>원" occurrence and take the smallest.
    const re = /(\d{1,3}(?:,\d{3})+|\d{3,})\s*원/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(priceStr)) !== null) {
        const value = parseInt(match[1].replace(/,/g, ''), 10);
        if (Number.isFinite(value) && (min === null || value < min)) min = value;
    }
    return min;
}

const PRICE_TIER_LIMITS: Record<PriceFilterId, { min: number; max: number }> = {
    'free':        { min: 0,     max: 0      },
    'under-10k':   { min: 0,     max: 10000  },
    'under-50k':   { min: 0,     max: 50000  },
    'under-100k':  { min: 0,     max: 100000 },
};

export function performanceMatchesPriceTier(
    performance: Pick<Performance, 'price'>,
    tier: PriceFilterId
): boolean {
    const limits = PRICE_TIER_LIMITS[tier];
    if (!limits) return true;
    const value = parseMinPriceWon(performance.price);
    if (value === null) return false; // unknown price -> excluded from tier filters
    return value >= limits.min && value <= limits.max;
}
