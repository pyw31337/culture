/**
 * Builds public/data/sessions.json — upcoming performance sessions (회차) keyed by the
 * final public performance id. Kept out of performances.json so the main payload stays
 * small; the detail page lazy-loads it.
 *
 * Source: Interpark public playSeq API (collected by scripts/scrape-interpark.ts).
 * Schedule only — no seat counts, no seat numbers.
 */

export interface RawSession {
    date: string; // YYYY-MM-DD
    time: string; // HH:MM
    seq?: string;
}

export interface PublicSessionEntry {
    source: 'interpark';
    url: string;
    checkedAt: string;
    /** [date, time] tuples, sorted, today (KST) onward. */
    sessions: [string, string][];
}

export interface PublicSessionsPayload {
    generatedAt: string;
    note: string;
    items: Record<string, PublicSessionEntry>;
}

const MAX_SESSIONS_PER_ITEM = 120;

export function extractInterparkGoodsCode(link?: string | null): string | null {
    if (!link) return null;
    const match = String(link).match(/[?&]GoodsCode=([A-Za-z0-9]+)/i)
        || String(link).match(/interpark\.com\/(?:[a-z]+\/)*goods\/([A-Za-z0-9]+)/);
    return match ? match[1] : null;
}

function kstToday(now = new Date()): string {
    return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

export function buildSessionsPayload(
    publicItems: Array<{ id: string; link?: string; website?: string }>,
    interparkRaw: Array<{ link?: string; sessions?: RawSession[]; sessionsCheckedAt?: string }>,
    now = new Date(),
): PublicSessionsPayload {
    const today = kstToday(now);
    const byCode = new Map<string, { url: string; checkedAt: string; sessions: RawSession[] }>();
    for (const raw of interparkRaw) {
        const code = extractInterparkGoodsCode(raw.link);
        if (!code || !Array.isArray(raw.sessions) || raw.sessions.length === 0 || !raw.sessionsCheckedAt) continue;
        const previous = byCode.get(code);
        if (previous && previous.checkedAt >= raw.sessionsCheckedAt) continue;
        byCode.set(code, {
            url: `https://tickets.interpark.com/goods/${code}`,
            checkedAt: raw.sessionsCheckedAt,
            sessions: raw.sessions,
        });
    }

    const items: Record<string, PublicSessionEntry> = {};
    for (const item of publicItems) {
        const code = extractInterparkGoodsCode(item.link) || extractInterparkGoodsCode(item.website);
        if (!code) continue;
        const entry = byCode.get(code);
        if (!entry) continue;
        const sessions = entry.sessions
            .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.date) && /^\d{2}:\d{2}$/.test(s.time) && s.date >= today)
            .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
            .slice(0, MAX_SESSIONS_PER_ITEM)
            .map((s) => [s.date, s.time] as [string, string]);
        if (sessions.length === 0) continue;
        items[item.id] = { source: 'interpark', url: entry.url, checkedAt: entry.checkedAt, sessions };
    }

    return {
        generatedAt: now.toISOString(),
        note: 'Interpark 공개 회차 정보(조회 시점 기준). 잔여석/좌석 정보는 포함하지 않으며 실제 예매 가능 여부는 예매처에서 확인해야 합니다.',
        items,
    };
}
