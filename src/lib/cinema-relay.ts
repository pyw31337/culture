/**
 * Client for the public daiso-mcp relay (https://mcp.aka.page) used by k-skill
 * korean-cinema-search. Called directly from the browser (CORS: *), read-only.
 *
 * - CGV:        /api/cgv/timetable?theaterCode=&playDate=
 * - 메가박스:    /api/megabox/seats?theaterId=&playDate=
 * - 롯데시네마:  /api/lottecinema/seats?theaterId=&playDate=
 *
 * Note: CGV ignores `theaterId` (it silently falls back to a default theater), so the
 * CGV id must be sent as `theaterCode`.
 */

export const CINEMA_RELAY_BASE = 'https://mcp.aka.page';
const CACHE_TTL_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15000;
const MAX_RESOLVE_DISTANCE_KM = 0.6;

export type CinemaRelayChain = 'cgv' | 'megabox' | 'lottecinema';

export interface CinemaShowtime {
    movieName: string;
    startTime: string;
    endTime?: string;
    screenName?: string;
    remainingSeats?: number;
    totalSeats?: number;
}

export interface CinemaTimetableResult {
    chain: CinemaRelayChain;
    theaterId: string;
    theaterName?: string;
    playDate: string;
    fetchedAt: string;
    showtimes: CinemaShowtime[];
}

export class CinemaRelayError extends Error {
    constructor(message: string, readonly kind: 'unsupported' | 'not_found' | 'rate_limited' | 'upstream' | 'network') {
        super(message);
        this.name = 'CinemaRelayError';
    }
}

export interface CinemaRelayTarget {
    name: string;
    brand?: string;
    lat?: number;
    lng?: number;
    relayTheaterId?: string;
}

export function getCinemaRelayChain(brand?: string, name?: string): CinemaRelayChain | null {
    const text = `${brand || ''} ${name || ''}`.toLowerCase();
    if (/cgv/.test(text)) return 'cgv';
    if (/메가박스|megabox/.test(text)) return 'megabox';
    if (/롯데\s?시네마|lotte/.test(text)) return 'lottecinema';
    return null;
}

export function getCinemaFallbackLinks(target: Pick<CinemaRelayTarget, 'name' | 'brand'>) {
    const links: { label: string; url: string }[] = [
        { label: '네이버에서 상영시간표 보기', url: `https://search.naver.com/search.naver?query=${encodeURIComponent(`${target.name} 상영시간표`)}` },
    ];
    const chain = getCinemaRelayChain(target.brand, target.name);
    if (chain === 'cgv') links.push({ label: 'CGV 공식', url: 'https://www.cgv.co.kr/' });
    if (chain === 'megabox') links.push({ label: '메가박스 공식', url: 'https://www.megabox.co.kr/booking/timetable' });
    if (chain === 'lottecinema') links.push({ label: '롯데시네마 공식', url: 'https://www.lottecinema.co.kr/NLCHS/Ticketing/Schedule' });
    return links;
}

export function kstDateKey(offsetDays = 0, now = new Date()): string {
    return new Date(now.getTime() + 9 * 3600 * 1000 + offsetDays * 86400000).toISOString().slice(0, 10).replace(/-/g, '');
}

const cache = new Map<string, { expiresAt: number; promise: Promise<unknown> }>();

async function relayGet<T>(path: string, params: Record<string, string | number>): Promise<T> {
    const query = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)]));
    const url = `${CINEMA_RELAY_BASE}${path}?${query.toString()}`;
    const cached = cache.get(url);
    if (cached && cached.expiresAt > Date.now()) return cached.promise as Promise<T>;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const promise = fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
        .then(async (response) => {
            if (response.status === 429) throw new CinemaRelayError('요청이 많아 잠시 후 다시 시도해주세요.', 'rate_limited');
            const json = await response.json().catch(() => null) as { success?: boolean; data?: T; error?: { code?: string; message?: string } } | null;
            if (!response.ok || !json?.success || !json.data) {
                throw new CinemaRelayError(json?.error?.message || `상영 정보 서버 응답 오류 (${response.status})`, 'upstream');
            }
            return json.data;
        })
        .catch((error: unknown) => {
            if (error instanceof CinemaRelayError) throw error;
            throw new CinemaRelayError('상영 정보 서버에 연결하지 못했습니다.', 'network');
        })
        .finally(() => clearTimeout(timer));

    cache.set(url, { expiresAt: Date.now() + CACHE_TTL_MS, promise });
    // Do not keep failures cached for the full TTL.
    promise.catch(() => cache.delete(url));
    return promise;
}

type RelayTheater = { theaterCode?: string; theaterId?: string; theaterName?: string; distanceKm?: number };

async function resolveTheaterId(chain: CinemaRelayChain, target: CinemaRelayTarget): Promise<{ id: string; name?: string }> {
    if (target.relayTheaterId) return { id: target.relayTheaterId };
    if (typeof target.lat !== 'number' || typeof target.lng !== 'number') {
        throw new CinemaRelayError('영화관 위치 정보가 없어 상영시간표를 찾지 못했습니다.', 'not_found');
    }
    const data = await relayGet<{ theaters?: RelayTheater[] }>(`/api/${chain}/theaters`, { lat: target.lat, lng: target.lng, limit: 1 });
    const nearest = data.theaters?.[0];
    const id = chain === 'cgv' ? nearest?.theaterCode : nearest?.theaterId;
    if (!nearest || !id || (typeof nearest.distanceKm === 'number' && nearest.distanceKm > MAX_RESOLVE_DISTANCE_KM)) {
        throw new CinemaRelayError('이 영화관의 상영시간표를 찾지 못했습니다.', 'not_found');
    }
    return { id, name: nearest.theaterName };
}

type RelayShowtime = {
    movieName?: string;
    startTime?: string;
    endTime?: string;
    screenName?: string;
    remainingSeats?: number;
    totalSeats?: number;
    theaterName?: string;
};

export async function fetchCinemaTimetable(target: CinemaRelayTarget, playDate = kstDateKey()): Promise<CinemaTimetableResult> {
    const chain = getCinemaRelayChain(target.brand, target.name);
    if (!chain) throw new CinemaRelayError('실시간 상영시간표를 지원하지 않는 영화관입니다.', 'unsupported');

    const theater = await resolveTheaterId(chain, target);
    const rows = chain === 'cgv'
        ? (await relayGet<{ timetable?: RelayShowtime[] }>('/api/cgv/timetable', { theaterCode: theater.id, playDate, limit: 200 })).timetable
        : (await relayGet<{ seats?: RelayShowtime[] }>(`/api/${chain}/seats`, { theaterId: theater.id, playDate, limit: 200 })).seats;

    const showtimes = (rows || [])
        .filter((row) => row.movieName && row.startTime)
        .map<CinemaShowtime>((row) => ({
            movieName: String(row.movieName),
            startTime: String(row.startTime),
            endTime: row.endTime || undefined,
            screenName: row.screenName || undefined,
            remainingSeats: typeof row.remainingSeats === 'number' ? row.remainingSeats : undefined,
            totalSeats: typeof row.totalSeats === 'number' ? row.totalSeats : undefined,
        }))
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

    return {
        chain,
        theaterId: theater.id,
        theaterName: theater.name || rows?.[0]?.theaterName,
        playDate,
        fetchedAt: new Date().toISOString(),
        showtimes,
    };
}
