import type { Performance } from '@/types';

/**
 * Which /p/[id] pages are statically exported (dynamicParams = false). Shared by the
 * page and the sitemap so the sitemap only lists URLs that actually exist.
 */
export const DETAIL_PAGE_EXPORT_LIMIT = Number(process.env.DETAIL_PAGE_EXPORT_LIMIT || 400);
const ONE_DAY = 24 * 60 * 60 * 1000;

function parseFirstEventDate(performance: Performance) {
    const source = `${performance.dateRaw || ''} ${performance.date || ''}`;
    const match = source.match(/(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);
    if (!match) return null;

    const [, year, month, day] = match;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function scoreDetailPagePriority(performance: Performance, now = new Date()) {
    let score = 0;
    const start = parseFirstEventDate(performance);
    const daysUntil = start ? Math.floor((start.getTime() - now.getTime()) / ONE_DAY) : null;

    if (performance.image || performance.poster || performance.backupPoster || performance.posterUrl) score += 60;
    if (performance.description || performance.synopsis) score += 16;
    if (performance.link || performance.website) score += 8;
    if (performance.lat && performance.lng) score += 6;
    if (performance.genre === 'movie') score += 18;
    if (performance.genre === 'musical' || performance.genre === 'concert' || performance.genre === 'play') score += 14;

    if (daysUntil !== null) {
        if (daysUntil >= -7 && daysUntil <= 45) score += 80 - Math.abs(daysUntil);
        else if (daysUntil > 45 && daysUntil <= 120) score += 24;
        else if (daysUntil < -30) score -= 40;
    }

    return score;
}

export function pickDetailPageExportCandidates(performances: Performance[]) {
    if (!Number.isFinite(DETAIL_PAGE_EXPORT_LIMIT) || DETAIL_PAGE_EXPORT_LIMIT <= 0) {
        return [];
    }

    if (performances.length <= DETAIL_PAGE_EXPORT_LIMIT) {
        return performances;
    }

    return [...performances]
        .sort((a, b) => scoreDetailPagePriority(b) - scoreDetailPagePriority(a) || a.id.localeCompare(b.id))
        .slice(0, DETAIL_PAGE_EXPORT_LIMIT);
}
