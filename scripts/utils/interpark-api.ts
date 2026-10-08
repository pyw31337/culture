/**
 * Read-only helpers for Interpark/NOL ticket public JSON endpoints.
 *
 * Endpoints (all public, no cookie/login):
 *   GET https://api-ticketfront.interpark.com/v1/goods/{code}/summary
 *   GET https://api-ticketfront.interpark.com/v1/goods/{code}/prices/group
 *   GET https://api-ticketfront.interpark.com/v1/goods/{code}/playSeq?...
 *
 * The playSeq call follows the k-skill `ticket-availability` guide: schedule
 * only (date/time/sequence). Remaining-seat counts, seat numbers and any booking
 * flow are intentionally NOT collected. Requests are sequential per worker with
 * a polite delay (default 350ms) and never retried aggressively.
 */
import axios from 'axios';

const API_BASE = 'https://api-ticketfront.interpark.com';
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Referer: 'https://tickets.interpark.com/',
    Accept: 'application/json',
};
const TIMEOUT_MS = Number(process.env.INTERPARK_API_TIMEOUT_MS || 12000);

export type InterparkSession = {
    /** YYYY-MM-DD (KST) */
    date: string;
    /** HH:MM (KST) */
    time: string;
    /** Interpark play sequence id (e.g. "081"). */
    seq?: string;
};

export type InterparkApiEnrichment = {
    runningTime?: string;
    ageRating?: string;
    performanceTime?: string;
    price?: string;
    priceList?: { label: string; price: string }[];
    sessions?: InterparkSession[];
    sessionsCheckedAt?: string;
};

type SummaryData = {
    goodsName?: string;
    viewRateName?: string;
    runningTime?: string;
    interMissionTime?: string;
    playTime?: string;
};

type PriceGroupEntry = {
    seatGradeName?: string;
    priceTypeName?: string;
    priceGradeName?: string;
    salesPrice?: number;
};

type PlaySeqEntry = {
    playSeq?: string;
    playDate?: string;
    playTime?: string;
};

async function getJson<T>(url: string, params?: Record<string, string>): Promise<T | null> {
    try {
        const response = await axios.get(url, {
            headers: HEADERS,
            params,
            timeout: TIMEOUT_MS,
            validateStatus: () => true,
        });
        if (response.status !== 200) return null;
        const contentType = String(response.headers['content-type'] || '');
        // Unknown paths fall through to the SPA HTML shell with 200.
        if (!contentType.includes('json') && typeof response.data !== 'object') return null;
        return response.data as T;
    } catch {
        return null;
    }
}

function compact(value?: string | null) {
    return String(value || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
}

export function formatRunningTime(runningTime?: string, interMissionTime?: string) {
    const minutes = Number.parseInt(String(runningTime || ''), 10);
    if (!Number.isFinite(minutes) || minutes <= 0) return undefined;
    const intermission = Number.parseInt(String(interMissionTime || ''), 10);
    if (Number.isFinite(intermission) && intermission > 0) {
        return `${minutes}분(인터미션 ${intermission}분 포함)`;
    }
    return `${minutes}분`;
}

export async function fetchInterparkSummary(goodsCode: string) {
    const body = await getJson<{ data?: SummaryData }>(`${API_BASE}/v1/goods/${goodsCode}/summary`);
    return body?.data || null;
}

/**
 * Returns the base price ("기본가") per seat grade, ordered as Interpark lists
 * them. Discount tiers are ignored on purpose: they depend on eligibility.
 */
export async function fetchInterparkBasePrices(goodsCode: string) {
    const body = await getJson<Record<string, Record<string, PriceGroupEntry[]>>>(
        `${API_BASE}/v1/goods/${goodsCode}/prices/group`,
        { goodsCode },
    );
    if (!body || typeof body !== 'object' || Array.isArray(body)) return [];
    const list: { label: string; price: string }[] = [];
    for (const [seatGrade, tiers] of Object.entries(body)) {
        if (!tiers || typeof tiers !== 'object') continue;
        const base = (tiers['기본가'] || []).find((entry) => typeof entry?.salesPrice === 'number');
        if (!base || typeof base.salesPrice !== 'number') continue;
        const label = compact(base.seatGradeName || seatGrade);
        const price = base.salesPrice === 0 ? '무료' : `${base.salesPrice.toLocaleString('ko-KR')}원`;
        if (label) list.push({ label, price });
    }
    return list;
}

function toKstYmd(date: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(date);
    return parts.replace(/-/g, '');
}

export async function fetchInterparkSessions(goodsCode: string, lookaheadDays = 120): Promise<InterparkSession[] | null> {
    const start = new Date();
    const end = new Date(start.getTime() + lookaheadDays * 86400000);
    const body = await getJson<{ data?: PlaySeqEntry[] }>(`${API_BASE}/v1/goods/${goodsCode}/playSeq`, {
        goodsCode,
        isBookableDate: 'true',
        page: '1',
        pageSize: '200',
        startDate: toKstYmd(start),
        endDate: toKstYmd(end),
    });
    if (!body || !Array.isArray(body.data)) return null;
    const sessions: InterparkSession[] = [];
    const seen = new Set<string>();
    for (const entry of body.data) {
        const d = String(entry.playDate || '');
        const t = String(entry.playTime || '');
        if (!/^\d{8}$/.test(d)) continue;
        const date = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
        const time = /^\d{4}$/.test(t) ? `${t.slice(0, 2)}:${t.slice(2, 4)}` : '';
        const key = `${date} ${time}`;
        if (seen.has(key)) continue;
        seen.add(key);
        sessions.push({ date, time, seq: entry.playSeq || undefined });
    }
    return sessions.sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
}

export function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetches summary/price (only when details are wanted) and sessions (only when
 * wanted), sequentially with a polite delay between calls.
 */
export async function fetchInterparkApiEnrichment(
    goodsCode: string,
    options: { details: boolean; sessions: boolean; delayMs: number; lookaheadDays?: number },
): Promise<InterparkApiEnrichment> {
    const result: InterparkApiEnrichment = {};
    if (options.details) {
        const summary = await fetchInterparkSummary(goodsCode);
        if (summary) {
            const runningTime = formatRunningTime(summary.runningTime, summary.interMissionTime);
            if (runningTime) result.runningTime = runningTime;
            const age = compact(summary.viewRateName);
            if (age) result.ageRating = age;
            const playTime = compact(summary.playTime);
            if (playTime) result.performanceTime = playTime;
        }
        await sleep(options.delayMs);
        const prices = await fetchInterparkBasePrices(goodsCode);
        if (prices.length > 0) {
            result.priceList = prices;
            result.price = prices.map((item) => `${item.label} ${item.price}`).join('\n');
        }
        if (options.sessions) await sleep(options.delayMs);
    }
    if (options.sessions) {
        const sessions = await fetchInterparkSessions(goodsCode, options.lookaheadDays);
        if (sessions) {
            result.sessions = sessions;
            result.sessionsCheckedAt = new Date().toISOString();
        }
    }
    return result;
}
