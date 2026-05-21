import type { Performance } from '@/types';
import ticketReference from '@/data/sports-ticket-reference.json';
import { getSourceLabel, getSourceOfficialUrl } from '@/lib/source-registry';

type TicketBayEvent = {
    date: string;
    opponent?: string | null;
    saleCount: number;
    minPrice: number | null;
    maxPrice: number | null;
    minListPrice: number | null;
    grades?: string[];
};

type TicketBayReference = {
    categoryId: number;
    categoryName: string;
    depth2Name?: string | null;
    infoType?: string | null;
    url: string;
    saleCount: number;
    sampleCount: number;
    minPrice: number | null;
    maxPrice: number | null;
    minListPrice: number | null;
    opponents?: string[];
    grades?: string[];
    events?: TicketBayEvent[];
};

type SportsBookingProvider = {
    provider: string;
    url: string;
};

export type SportsTicketBaySummary = {
    label: string;
    detail: string;
    url: string;
    sourceLabel: string;
};

export type SportsTicketingInfo = {
    bookingUrl: string;
    bookingProvider: string;
    officialUrl?: string | null;
    officialLabel?: string | null;
    ticketBay?: SportsTicketBaySummary | null;
};

const SPORTS_GENRES = new Set(['soccer', 'baseball', 'basketball', 'volleyball', 'handball']);

// Build a Naver search URL with a sports-specific query. We fall back to Naver
// search for any sport where the upstream ticket vendor's listing page is not
// stable (ticketlink.co.kr/sports/{soccer,baseball,basketball,volleyball,
// handball} were returning either a "서비스가 원활하지 않습니다" page or
// redirecting to /sports as of 2026-05-21). Naver search consistently surfaces
// all major ticketing providers (ticketlink, interpark, team-official) plus
// fixture info, which is strictly better than landing the user on a broken
// vendor page.
const naverSearchUrl = (query: string) =>
    `https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`;

const BASEBALL_BOOKING_BY_TEAM: Record<string, SportsBookingProvider> = {
    // Teams whose home-game booking goes through ticketlink. The vendor's
    // /sports/baseball landing redirected to /sports during testing, so we
    // route through Naver search ("[team] KBO 예매") which lists the actual
    // ticketing page reliably.
    KIA: { provider: 'KBO 예매', url: naverSearchUrl('KIA 타이거즈 KBO 예매') },
    KT: { provider: 'KBO 예매', url: naverSearchUrl('KT 위즈 KBO 예매') },
    LG: { provider: 'KBO 예매', url: naverSearchUrl('LG 트윈스 KBO 예매') },
    SSG: { provider: 'KBO 예매', url: naverSearchUrl('SSG 랜더스 KBO 예매') },
    삼성: { provider: 'KBO 예매', url: naverSearchUrl('삼성 라이온즈 KBO 예매') },
    한화: { provider: 'KBO 예매', url: naverSearchUrl('한화 이글스 KBO 예매') },
    // Teams with stable direct vendor URLs - kept as-is, verified to work.
    두산: { provider: '인터파크 티켓', url: 'https://ticket.interpark.com/Contents/Sports/GoodsInfo?SportsCode=07001&TeamCode=PB004' },
    키움: { provider: '인터파크 티켓', url: 'https://ticket.interpark.com/Contents/Sports/GoodsInfo?SportsCode=07001&TeamCode=PB003' },
    롯데: { provider: '롯데 자이언츠 티켓', url: 'https://ticket.giantsclub.com/' },
    NC: { provider: 'NC 다이노스 티켓', url: 'https://ticket.ncdinos.com/' },
};

// Genre-level fallbacks. ticketlink.co.kr/sports/{soccer,basketball,volleyball}
// were broken as of 2026-05-21 - they 200 but render an error template. We
// route through Naver search instead because it always lists the active
// ticketing providers (ticketlink, interpark, kleague.com, team-official).
const SPORTS_BOOKING_BY_GENRE: Record<string, SportsBookingProvider> = {
    soccer: { provider: 'K리그 예매', url: naverSearchUrl('K리그 예매') },
    basketball: { provider: 'KBL 예매', url: naverSearchUrl('KBL 농구 예매') },
    volleyball: { provider: 'V리그 예매', url: naverSearchUrl('V리그 배구 예매') },
    handball: { provider: '핸드볼 예매', url: naverSearchUrl('H리그 핸드볼 예매') },
};

const BASEBALL_HOME_TEAM_BY_VENUE: Record<string, string> = {
    광주기아챔피언스필드: 'KIA',
    고척스카이돔: '키움',
    대구삼성라이온즈파크: '삼성',
    부산사직종합운동장사직야구장: '롯데',
    수원KT위즈파크: 'KT',
    인천SSG랜더스필드: 'SSG',
    잠실종합운동장잠실야구장: '',
    창원NC파크: 'NC',
    한화생명이글스파크: '한화',
    청주야구장: '한화',
    포항야구장: '삼성',
    울산문수야구장: '롯데',
};

const normalizeKey = (value: unknown) => String(value ?? '')
    .replace(/\s+/g, '')
    .replace(/[·ㆍ,./\\\-_:|"'“”‘’()[\]\s]/g, '')
    .toLowerCase();

const compactText = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();

const formatWon = (value?: number | null) => (
    typeof value === 'number' && Number.isFinite(value)
        ? `${value.toLocaleString('ko-KR')}원`
        : ''
);

const getDateKey = (performance: Pick<Performance, 'date'>) => {
    const match = compactText(performance.date).match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
    if (!match) return '';
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
};

const isWeekendGame = (performance: Pick<Performance, 'date'>) => {
    const date = getDateKey(performance);
    if (!date) return false;
    const parsed = new Date(`${date}T00:00:00+09:00`);
    const day = parsed.getDay();
    return day === 0 || day === 5 || day === 6;
};

export const isSportsPerformance = (performance: Pick<Performance, 'genre'>) =>
    SPORTS_GENRES.has(performance.genre || '');

export function getSportsOfficialSiteInfo(
    performance: Pick<Performance, 'genre' | 'source' | 'link'>
) {
    if (!isSportsPerformance(performance)) return null;

    const officialUrl = getSourceOfficialUrl(performance.source, performance.link);
    if (!officialUrl) return null;

    return {
        label: getSourceLabel(performance.source || ''),
        url: officialUrl,
    };
}

function inferBaseballHomeTeam(performance: Pick<Performance, 'homeTeam' | 'awayTeam' | 'venue'>) {
    const venueKey = normalizeKey(performance.venue);
    const venueHome = Object.entries(BASEBALL_HOME_TEAM_BY_VENUE).find(([venue]) => venueKey.includes(normalizeKey(venue)))?.[1];

    if (venueHome) return venueHome;

    // KBO source data is commonly stored as away vs home in the title order.
    return compactText(performance.awayTeam || performance.homeTeam);
}

function inferTicketBayTeam(performance: Pick<Performance, 'genre' | 'homeTeam' | 'awayTeam' | 'venue'>) {
    if (performance.genre === 'baseball') return inferBaseballHomeTeam(performance);
    return compactText(performance.homeTeam || performance.awayTeam);
}

function inferTicketBayOpponent(performance: Pick<Performance, 'genre' | 'homeTeam' | 'awayTeam'>) {
    if (performance.genre === 'baseball') return compactText(performance.homeTeam);
    return compactText(performance.awayTeam);
}

function getBaseballBookingProvider(performance: Pick<Performance, 'homeTeam' | 'awayTeam' | 'venue'>) {
    const homeTeam = inferBaseballHomeTeam(performance);
    if (BASEBALL_BOOKING_BY_TEAM[homeTeam]) return BASEBALL_BOOKING_BY_TEAM[homeTeam];

    // Unknown home team - search by the away team name (it always comes from
    // KBO data) plus 'KBO 예매' so the user lands on a usable Naver search
    // result rather than the broken ticketlink listing.
    const fallbackQueryTeam = compactText(performance.homeTeam || performance.awayTeam) || 'KBO';
    return {
        provider: 'KBO 예매',
        url: naverSearchUrl(`${fallbackQueryTeam} KBO 예매`),
    };
}

function getSportsBookingProvider(performance: Pick<Performance, 'genre' | 'homeTeam' | 'awayTeam' | 'venue'>) {
    if (performance.genre === 'baseball') return getBaseballBookingProvider(performance);
    return SPORTS_BOOKING_BY_GENRE[performance.genre || ''] || null;
}

function referenceSportMatches(reference: TicketBayReference, performance: Pick<Performance, 'genre'>) {
    if (performance.genre === 'baseball') {
        return reference.infoType === 'SPORTS_BASEBALL' || reference.infoType === 'SPORTS_B' || /야구/u.test(reference.depth2Name || reference.categoryName);
    }

    if (performance.genre === 'soccer') return /축구/u.test(reference.categoryName);
    if (performance.genre === 'basketball') return /농구/u.test(reference.categoryName);
    if (performance.genre === 'volleyball') return /배구/u.test(reference.categoryName);
    if (performance.genre === 'handball') return /핸드볼/u.test(reference.categoryName);
    return false;
}

function findTicketBayReference(performance: Pick<Performance, 'genre' | 'date' | 'homeTeam' | 'awayTeam' | 'venue'>) {
    if (!isSportsPerformance(performance)) return null;

    const references = (ticketReference.references as TicketBayReference[])
        .filter((reference) => referenceSportMatches(reference, performance));

    if (references.length === 0) return null;

    const team = inferTicketBayTeam(performance);
    const opponent = inferTicketBayOpponent(performance);
    const dateKey = getDateKey(performance);
    const weekend = isWeekendGame(performance);

    const teamRefs = references.filter((reference) => normalizeKey(reference.categoryName).includes(normalizeKey(team)));
    const candidates = teamRefs.length > 0 ? teamRefs : references;

    const scored = candidates.map((reference) => {
        const exactEvent = (reference.events || []).find((event) => {
            const dateMatches = dateKey && event.date === dateKey;
            const opponentMatches = opponent && normalizeKey(event.opponent).includes(normalizeKey(opponent));
            return dateMatches && opponentMatches;
        }) || (reference.events || []).find((event) => dateKey && event.date === dateKey);

        let score = 0;
        if (team && normalizeKey(reference.categoryName).includes(normalizeKey(team))) score += 40;
        if (opponent && normalizeKey(reference.opponents?.join(' ') || '').includes(normalizeKey(opponent))) score += 25;
        if (exactEvent) score += 30;
        if (weekend && /금토일|공휴일|주말/u.test(reference.categoryName)) score += 10;
        if (!weekend && /주중/u.test(reference.categoryName)) score += 10;
        if (reference.minPrice) score += 1;

        return { reference, event: exactEvent, score };
    }).sort((a, b) => b.score - a.score);

    return scored[0] || null;
}

export function getSportsTicketBaySummary(
    performance: Pick<Performance, 'genre' | 'date' | 'homeTeam' | 'awayTeam' | 'venue'>
): SportsTicketBaySummary | null {
    const match = findTicketBayReference(performance);
    if (!match) return null;

    const price = match.event?.minPrice || match.reference.minPrice;
    if (!price) return null;

    const listPrice = match.event?.minListPrice || match.reference.minListPrice;
    const saleCount = match.event?.saleCount || match.reference.saleCount || match.reference.sampleCount;
    const gradeText = (match.event?.grades || match.reference.grades || []).slice(0, 2).join(', ');
    const listPriceText = listPrice ? `정가 ${formatWon(listPrice)}부터` : '정가 정보 없음';

    return {
        label: `티켓베이 참고 ${formatWon(price)}~`,
        detail: `${match.reference.categoryName} 양도 상품 ${saleCount.toLocaleString('ko-KR')}건 기준 · ${listPriceText}${gradeText ? ` · ${gradeText}` : ''}`,
        url: match.reference.url,
        sourceLabel: '티켓베이 참고가',
    };
}

export function getSportsTicketingInfo(
    performance: Pick<Performance, 'genre' | 'title' | 'link' | 'website' | 'source' | 'date' | 'homeTeam' | 'awayTeam' | 'venue'>
): SportsTicketingInfo | null {
    if (!isSportsPerformance(performance)) return null;

    const official = getSportsOfficialSiteInfo(performance);
    const bookingProvider = getSportsBookingProvider(performance);
    const ticketBay = getSportsTicketBaySummary(performance);
    const fallbackUrl = ticketBay?.url || official?.url || performance.link || performance.website || '';

    return {
        bookingUrl: bookingProvider?.url || fallbackUrl,
        bookingProvider: bookingProvider?.provider || ticketBay?.sourceLabel || '예매처',
        officialUrl: official?.url,
        officialLabel: official?.label,
        ticketBay,
    };
}

export function getSportsBookingUrl(
    performance: Pick<Performance, 'genre' | 'title' | 'link' | 'website' | 'source' | 'date' | 'homeTeam' | 'awayTeam' | 'venue'>
) {
    return getSportsTicketingInfo(performance)?.bookingUrl || '';
}
