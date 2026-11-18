/**
 * Cross-source duplicate removal for ticketed performances.
 *
 * The same show is often listed by KOPIS (공연예술통합전산망), 문화포털, 서울문화포털 and
 * one or more ticket sellers (Interpark/NOL, Timeticket, YES24). Titles and venues are
 * written differently per source ("연극〈늘근도둑이야기〉" vs "늘근도둑이야기 [대학로]",
 * "대학로 아트포레스트" vs "아트포레스트"), so the exact-key merge in performance-merger
 * leaves them as separate cards.
 *
 * Here each item is attached to the best matching item of a higher-priority source.
 * The catalog row (KOPIS → 문화포털 → 서울) stays as the card, absorbs missing fields
 * from the seller rows, and keeps every seller as a booking link. Dropped ids are kept
 * in `aliasIds` so old share links still open the merged card.
 *
 * Gray-zone pairs (similar but not certain) are not merged unless a cached judgment
 * from the local AI judge (scripts/ai/judge-duplicates-ollama.ts) says they are the same.
 */
import { mergeItems } from '@/lib/performance-merger';

// Rows from every source share this loose shape until safePerformance narrows them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Item = Record<string, any>;

/** Lower = preferred as the surviving card. */
export const DEDUPE_SOURCE_PRIORITY: Record<string, number> = {
    kopis: 0,
    'culture-portal': 1,
    seoul: 2,
    interpark: 3,
    'yes24-exclusive': 4,
    yes24: 4,
    timeticket: 5,
};

const SOURCE_BOOKING_LABEL: Record<string, string> = {
    interpark: 'NOL 티켓(인터파크)',
    timeticket: '타임티켓',
    yes24: 'YES24 티켓',
    'yes24-exclusive': 'YES24 티켓',
    'culture-portal': '문화포털',
    seoul: '서울문화포털',
};

const MAX_BOOKING_LINKS = 8;
const NEAR_VENUE_DEGREES = 0.004; // ≈ 400m
const AI_MIN_CONFIDENCE = 0.8;

export interface DedupeJudgment {
    same: boolean;
    confidence: number;
    reason?: string;
    model?: string;
    judgedAt?: string;
}

export interface DedupeJudgments {
    judgments?: Record<string, DedupeJudgment>;
}

export interface DedupePair {
    key: string;
    a: Item;
    b: Item;
    titleScore: number;
}

export interface DedupeResult {
    items: Item[];
    merged: number;
    bySourcePair: Record<string, number>;
    grayZone: DedupePair[];
}

export function judgmentKey(idA: string, idB: string) {
    return [idA, idB].sort().join('|');
}

const TITLE_PREFIX = /^(뮤지컬|연극|콘서트|오페라|발레|무용|전시|클래식|국악|음악극|가족뮤지컬|어린이뮤지컬|아동극|인형극)\s*/;

export function normalizeDedupeTitle(title: unknown): string {
    const raw = String(title || '').normalize('NFC').toLowerCase();
    // Bracketed parts are region/venue tags ([대학로], (광화문전용관)) or alternate titles.
    const stripped = raw
        .replace(/\[[^\]]*\]|\([^)]*\)|（[^）]*）/g, ' ')
        .replace(/［[^］]*］/g, ' ')
        .replace(/[〈〉<>《》「」『』'"‘’“”]/g, ' ')
        .trim()
        .replace(TITLE_PREFIX, '');
    const compact = (value: string) => value.replace(/[^a-z0-9가-힣]/g, '');
    const result = compact(stripped);
    return result.length >= 2 ? result : compact(raw.replace(TITLE_PREFIX, ''));
}

export function normalizeDedupeVenue(venue: unknown): string {
    return String(venue || '')
        .normalize('NFC')
        .toLowerCase()
        .replace(/\[[^\]]*\]|\([^)]*\)/g, ' ')
        .replace(/구\s*,.*$/, '') // "NOL 씨어터 합정 구, 신한카드 SOL페이 스퀘어"
        .replace(/[^a-z0-9가-힣]/g, '');
}

/**
 * Alternative spellings of the core title: the 〈quoted〉 name inside a seller headline
 * ("대학로1등 코믹연극 〈타임〉"), the part before " - 지역" ("〈그날들〉 - 부산") and the part
 * after a series/festival prefix ("제14회 GAF공연예술제, 고백").
 */
export function titleVariants(title: unknown): string[] {
    const raw = String(title || '').normalize('NFC');
    const variants = new Set<string>([normalizeDedupeTitle(raw)]);
    const quoted = raw.match(/[〈<《「『［]([^〉>》」』］]{2,})[〉>》」』］]/);
    if (quoted) variants.add(normalizeDedupeTitle(quoted[1]));
    const beforeDash = raw.split(/\s[-–—]\s/)[0];
    if (beforeDash !== raw) variants.add(normalizeDedupeTitle(beforeDash));
    const commaIndex = raw.lastIndexOf(', ');
    if (commaIndex > 0) variants.add(normalizeDedupeTitle(raw.slice(commaIndex + 2)));
    return [...variants].filter((v) => v.length >= 2);
}

function bigrams(value: string) {
    const grams: string[] = [];
    for (let i = 0; i < value.length - 1; i += 1) grams.push(value.slice(i, i + 2));
    return grams;
}

/** Dice coefficient on character bigrams (0..1). */
export function titleSimilarity(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const ga = bigrams(a);
    const gb = bigrams(b);
    if (ga.length === 0 || gb.length === 0) return 0;
    const counts = new Map<string, number>();
    ga.forEach((g) => counts.set(g, (counts.get(g) || 0) + 1));
    let overlap = 0;
    gb.forEach((g) => {
        const n = counts.get(g) || 0;
        if (n > 0) {
            overlap += 1;
            counts.set(g, n - 1);
        }
    });
    return (2 * overlap) / (ga.length + gb.length);
}

function parseDateRange(date: unknown): { start?: string; end?: string } {
    const matches = String(date || '').match(/\d{4}[.-]\d{2}[.-]\d{2}/g) || [];
    const days = matches.map((m) => m.replace(/[.-]/g, ''));
    if (days.length === 0) return {};
    return { start: days[0], end: days[days.length - 1] };
}

function datesCompatible(a: Item, b: Item, strict: boolean) {
    const ra = parseDateRange(a.date);
    const rb = parseDateRange(b.date);
    // OPEN RUN / 상시 rows carry no dates; the title + venue match has to carry it.
    if (!ra.start || !rb.start) return !strict;
    if (strict) {
        return ra.start === rb.start && (ra.end === rb.end || ra.start === ra.end || rb.start === rb.end);
    }
    return ra.start <= (rb.end as string) && rb.start <= (ra.end as string);
}

function coordinate(item: Item, key: 'lat' | 'lng') {
    const value = Number(item[key] ?? item[key === 'lat' ? 'latitude' : 'longitude']);
    return Number.isFinite(value) && value !== 0 ? value : null;
}

export function venuesMatch(a: Item, b: Item) {
    const va = normalizeDedupeVenue(a.venue);
    const vb = normalizeDedupeVenue(b.venue);
    if (va && vb) {
        if (va === vb) return true;
        const [short, long] = va.length <= vb.length ? [va, vb] : [vb, va];
        if (short.length >= 3 && long.includes(short)) return true;
    }
    if (a.venueKey && a.venueKey === b.venueKey) return true;
    const latA = coordinate(a, 'lat');
    const lngA = coordinate(a, 'lng');
    const latB = coordinate(b, 'lat');
    const lngB = coordinate(b, 'lng');
    if (latA !== null && lngA !== null && latB !== null && lngB !== null) {
        return Math.hypot(latA - latB, (lngA - lngB) * 0.8) < NEAR_VENUE_DEGREES;
    }
    return false;
}

/** Seller-specific ids found in a URL: interpark goods code, timeticket product, yes24 perf id. */
export function extractTicketIds(url: unknown): string[] {
    const text = String(url || '');
    if (!text) return [];
    const ids: string[] = [];
    const interpark = text.match(/[?&]GoodsCode=([A-Za-z0-9]+)/i) || text.match(/interpark\.com\/(?:[a-z]+\/)*goods\/([A-Za-z0-9]+)/i);
    if (interpark) ids.push(`interpark:${interpark[1]}`);
    const timeticket = text.match(/timeticket\.co\.kr\/(?:product\/|\?number=|.*[?&]number=)(\d+)/i);
    if (timeticket) ids.push(`timeticket:${timeticket[1]}`);
    const yes24 = text.match(/yes24\.com\/.*?(?:Perf\/|[?&]IdPerf=|goods\/)(\d+)/i);
    if (yes24) ids.push(`yes24:${yes24[1]}`);
    return ids;
}

function ownTicketIds(item: Item) {
    return new Set([...extractTicketIds(item.link), ...extractTicketIds(item.website)]);
}

function referencedTicketIds(item: Item) {
    const ids = new Set<string>();
    (Array.isArray(item.bookingLinks) ? item.bookingLinks : []).forEach((link: Item) => {
        extractTicketIds(link?.url).forEach((id) => ids.add(id));
    });
    return ids;
}

function isEligible(item: Item) {
    return item && typeof item.source === 'string' && item.source in DEDUPE_SOURCE_PRIORITY && item.genre !== 'movie';
}

type Match = { kind: 'certain' } | { kind: 'gray'; titleScore: number } | null;

function matchPair(head: Item, candidate: Item, headVariants: string[], candidateVariants: string[]): Match {
    const headTitle = headVariants[0] || '';
    const candidateTitle = candidateVariants[0] || '';
    // Strongest signal: the catalog row lists this seller page as one of its booking sites.
    const listed = referencedTicketIds(head);
    const sharesTicket = [...ownTicketIds(candidate)].some((id) => listed.has(id))
        || [...ownTicketIds(head)].some((id) => referencedTicketIds(candidate).has(id));
    if (sharesTicket && datesCompatible(head, candidate, false)) return { kind: 'certain' };

    if (!venuesMatch(head, candidate)) return null;

    if (headTitle && headTitle === candidateTitle) {
        return datesCompatible(head, candidate, false) ? { kind: 'certain' } : null;
    }

    const score = titleSimilarity(headTitle, candidateTitle);
    const [short, long] = headTitle.length <= candidateTitle.length ? [headTitle, candidateTitle] : [candidateTitle, headTitle];
    const contains = short.length >= 4 && long.includes(short) && short.length / long.length >= 0.5;

    const sharesVariant = headVariants.some((v) => candidateVariants.includes(v));

    if ((score >= 0.75 || contains || sharesVariant) && datesCompatible(head, candidate, true)) return { kind: 'certain' };
    if ((score >= 0.5 || sharesVariant) && datesCompatible(head, candidate, false)) {
        return { kind: 'gray', titleScore: Math.max(score, sharesVariant ? 0.6 : 0) };
    }
    return null;
}

function isPlaceholderPrice(value: unknown) {
    const text = String(value ?? '').replace(/\s/g, '');
    return !text || /^(정보없음|가격정보없음|가격미정|미정|-)$/.test(text);
}

function bookingLinkKey(url: string) {
    const ids = extractTicketIds(url);
    if (ids.length > 0) return ids[0];
    return url.replace(/^https?:\/\//i, '').replace(/^(www|m|mobile)\./i, '').replace(/\/+$/, '').toLowerCase();
}

function isUsableUrl(value: unknown): value is string {
    return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

function absorbMember(head: Item, member: Item): Item {
    const headHasPrice = !isPlaceholderPrice(head.price);
    // mergeItems picks the richer row as the base; the catalog row must stay the card.
    const filled = mergeItems(head, member);
    const merged: Item = { ...filled };
    for (const key of ['id', 'title', 'venue', 'date', 'source', 'link', 'genre', 'region', 'originalId']) {
        if (head[key] !== undefined) merged[key] = head[key];
    }
    if (!headHasPrice && !isPlaceholderPrice(member.price)) {
        merged.price = member.price;
        if (member.originalPrice) merged.originalPrice = member.originalPrice;
        if (member.discount) merged.discount = member.discount;
    }
    if (!Array.isArray(head.priceList) || head.priceList.length === 0) {
        if (Array.isArray(member.priceList) && member.priceList.length > 0) merged.priceList = member.priceList;
    }

    const links: { name: string; url: string }[] = [];
    const seen = new Set<string>();
    const addLink = (name: string, url: unknown) => {
        if (!name || !isUsableUrl(url)) return;
        const key = bookingLinkKey(url);
        if (seen.has(key)) return;
        seen.add(key);
        links.push({ name, url: url.trim() });
    };
    (Array.isArray(head.bookingLinks) ? head.bookingLinks : []).forEach((l: Item) => addLink(l?.name, l?.url));
    // The seller row we are dropping is a real booking page; keep it reachable.
    const memberLabel = SOURCE_BOOKING_LABEL[member.source];
    if (memberLabel) addLink(memberLabel, member.link);
    (Array.isArray(member.bookingLinks) ? member.bookingLinks : []).forEach((l: Item) => addLink(l?.name, l?.url));
    if (links.length > 0) merged.bookingLinks = links.slice(0, MAX_BOOKING_LINKS);

    // KOPIS link is a database page; a seller link is still useful as the website fallback.
    if (!isUsableUrl(merged.website) && isUsableUrl(member.link)) merged.website = member.link;

    merged.aliasIds = Array.from(new Set([...(head.aliasIds || []), member.id, ...(member.aliasIds || [])].filter(Boolean)));
    merged.mergedSources = Array.from(new Set([...(head.mergedSources || [head.source]), member.source]));
    return merged;
}

function blockKeys(variants: string[]) {
    // Candidate lookup: every title variant plus its first 3 chars (국립발레단 vs 국립발레단지젤).
    const keys = new Set<string>();
    variants.forEach((v) => {
        keys.add(v);
        if (v.length >= 3) keys.add(`p:${v.slice(0, 3)}`);
    });
    return [...keys];
}

export function dedupeCrossSourcePerformances(items: Item[], options: DedupeJudgments = {}): DedupeResult {
    const judgments = options.judgments || {};
    const eligible: { item: Item; index: number }[] = [];
    items.forEach((item, index) => {
        if (isEligible(item)) eligible.push({ item, index });
    });

    eligible.sort((a, b) => {
        const pa = DEDUPE_SOURCE_PRIORITY[a.item.source];
        const pb = DEDUPE_SOURCE_PRIORITY[b.item.source];
        return pa - pb || a.index - b.index;
    });

    type Cluster = { head: Item; variants: string[]; sources: Set<string>; members: Item[] };
    const clusters: Cluster[] = [];
    const byBlock = new Map<string, Cluster[]>();
    const byTicket = new Map<string, Cluster[]>();
    const grayZone: DedupePair[] = [];
    const absorbed = new Set<number>();

    const register = (cluster: Cluster) => {
        blockKeys(cluster.variants).forEach((key) => {
            if (!byBlock.has(key)) byBlock.set(key, []);
            byBlock.get(key)!.push(cluster);
        });
        referencedTicketIds(cluster.head).forEach((id) => {
            if (!byTicket.has(id)) byTicket.set(id, []);
            byTicket.get(id)!.push(cluster);
        });
    };

    for (const { item, index } of eligible) {
        const variants = titleVariants(item.title);
        // Clusters that list this seller page come first: that link is the most reliable signal.
        const candidates = new Set<Cluster>();
        ownTicketIds(item).forEach((id) => (byTicket.get(id) || []).forEach((c) => candidates.add(c)));
        blockKeys(variants).forEach((key) => (byBlock.get(key) || []).forEach((c) => candidates.add(c)));

        let best: Cluster | null = null;
        const pendingGray: DedupePair[] = [];
        for (const cluster of candidates) {
            // Never fold two rows of the same source together here; that is the exact-key merger's job.
            if (cluster.sources.has(item.source)) continue;
            const match = matchPair(cluster.head, item, cluster.variants, variants);
            if (!match) continue;
            if (match.kind === 'gray') {
                const verdict = judgments[judgmentKey(String(cluster.head.id), String(item.id))];
                if (verdict?.same && verdict.confidence >= AI_MIN_CONFIDENCE) {
                    best = cluster;
                    break;
                }
                if (!verdict) {
                    pendingGray.push({ key: judgmentKey(String(cluster.head.id), String(item.id)), a: cluster.head, b: item, titleScore: match.titleScore });
                }
                continue;
            }
            best = cluster;
            break;
        }

        if (!best) grayZone.push(...pendingGray);
        if (best) {
            best.members.push(item);
            best.sources.add(item.source);
            absorbed.add(index);
            continue;
        }
        const cluster: Cluster = { head: item, variants, sources: new Set([item.source]), members: [] };
        clusters.push(cluster);
        register(cluster);
    }

    const replacement = new Map<Item, Item>();
    const bySourcePair: Record<string, number> = {};
    let merged = 0;
    for (const cluster of clusters) {
        if (cluster.members.length === 0) continue;
        let result = cluster.head;
        for (const member of cluster.members) {
            result = absorbMember(result, member);
            const pair = `${cluster.head.source}+${member.source}`;
            bySourcePair[pair] = (bySourcePair[pair] || 0) + 1;
            merged += 1;
        }
        replacement.set(cluster.head, result);
    }

    const output = items
        .filter((_, index) => !absorbed.has(index))
        .map((item) => replacement.get(item) || item);

    return { items: output, merged, bySourcePair, grayZone };
}
