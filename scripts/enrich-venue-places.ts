import fs from 'fs';
import path from 'path';
import type { VenueMasterEntry } from './utils/venue-master';
import {
    buildVenuePlaceMatchingReport,
    chooseBestVenuePlaceCandidate,
    getVenuePlaceLookupQuery,
    type VenuePlaceCache,
    type VenuePlaceCandidate,
    type VenuePlaceProvider,
} from './utils/venue-place-matching';

const VENUE_MASTER_PATH = path.join(process.cwd(), 'public', 'data', 'venue-master.json');
const CACHE_PATH = path.join(process.cwd(), 'src', 'data', 'venue-place-cache.json');
const REPORT_PATH = path.join(process.cwd(), 'public', 'data', 'venue-place-report.json');

function readJsonIfExists<T>(filePath: string, fallback: T): T {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function writeJson(filePath: string, value: unknown) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
}

function getConfiguredProviders(): VenuePlaceProvider[] {
    const providerOverride = process.env.VENUE_PLACE_PROVIDERS
        ?.split(',')
        .map((provider) => provider.trim())
        .filter((provider): provider is VenuePlaceProvider => provider === 'kakao' || provider === 'naver');
    if (providerOverride?.length) return [...new Set(providerOverride)];

    const providers: VenuePlaceProvider[] = [];
    if (process.env.KAKAO_REST_API_KEY || process.env.KAKAO_LOCAL_REST_API_KEY) providers.push('kakao');
    if (
        (process.env.NAVER_SEARCH_CLIENT_ID || process.env.NAVER_CLIENT_ID) &&
        (process.env.NAVER_SEARCH_CLIENT_SECRET || process.env.NAVER_CLIENT_SECRET)
    ) {
        providers.push('naver');
    }
    return providers;
}

function sleep(ms: number) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function getLookupDelayMs() {
    const parsed = Number.parseInt(process.env.VENUE_PLACE_LOOKUP_DELAY_MS || '500', 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 500;
}

async function fetchKakaoPlaces(query: string): Promise<VenuePlaceCandidate[]> {
    const key = process.env.KAKAO_REST_API_KEY || process.env.KAKAO_LOCAL_REST_API_KEY;
    if (!key) return [];

    const url = new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
    url.searchParams.set('query', query);
    url.searchParams.set('size', '5');

    const response = await fetch(url, {
        headers: {
            Authorization: `KakaoAK ${key}`,
        },
    });

    if (!response.ok) {
        throw new Error(`Kakao local search failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
        documents?: Array<{
            id?: string;
            place_name?: string;
            road_address_name?: string;
            address_name?: string;
            x?: string;
            y?: string;
            phone?: string;
            place_url?: string;
            category_name?: string;
        }>;
    };

    return (data.documents || []).map((item) => ({
        provider: 'kakao' as const,
        providerPlaceId: item.id || '',
        name: item.place_name || '',
        roadAddressName: item.road_address_name || undefined,
        addressName: item.address_name || undefined,
        lat: item.y ? Number.parseFloat(item.y) : null,
        lng: item.x ? Number.parseFloat(item.x) : null,
        phone: item.phone || undefined,
        url: item.place_url || undefined,
        categoryName: item.category_name || undefined,
    })).filter((item) => item.providerPlaceId && item.name);
}

function stripHtml(value?: string) {
    return value?.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim() || '';
}

async function fetchNaverPlaces(query: string): Promise<VenuePlaceCandidate[]> {
    const clientId = process.env.NAVER_SEARCH_CLIENT_ID || process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_SEARCH_CLIENT_SECRET || process.env.NAVER_CLIENT_SECRET;
    if (!clientId || !clientSecret) return [];

    const url = new URL('https://openapi.naver.com/v1/search/local.json');
    url.searchParams.set('query', query);
    url.searchParams.set('display', '5');
    url.searchParams.set('sort', 'comment');

    let response: Response | null = null;
    const maxAttempts = Number.parseInt(process.env.VENUE_PLACE_NAVER_RETRY_LIMIT || '3', 10);

    for (let attempt = 1; attempt <= Math.max(1, maxAttempts); attempt += 1) {
        response = await fetch(url, {
            headers: {
                'X-Naver-Client-Id': clientId,
                'X-Naver-Client-Secret': clientSecret,
            },
        });

        if (response.ok || (response.status !== 429 && response.status < 500)) break;

        const retryAfter = Number.parseInt(response.headers.get('retry-after') || '', 10);
        const backoffMs = Number.isFinite(retryAfter)
            ? retryAfter * 1000
            : 1200 * attempt;
        await sleep(backoffMs);
    }

    if (!response) {
        throw new Error('Naver local search failed: no response');
    }

    if (!response.ok) {
        throw new Error(`Naver local search failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as {
        items?: Array<{
            title?: string;
            link?: string;
            category?: string;
            address?: string;
            roadAddress?: string;
            mapx?: string;
            mapy?: string;
            telephone?: string;
        }>;
    };

    return (data.items || []).map((item) => ({
        provider: 'naver' as const,
        providerPlaceId: item.link || `${item.title || ''}:${item.roadAddress || item.address || ''}`,
        name: stripHtml(item.title),
        roadAddressName: item.roadAddress || undefined,
        addressName: item.address || undefined,
        lat: item.mapy ? Number.parseFloat(item.mapy) / 10000000 : null,
        lng: item.mapx ? Number.parseFloat(item.mapx) / 10000000 : null,
        phone: item.telephone || undefined,
        url: item.link || undefined,
        categoryName: item.category || undefined,
    })).filter((item) => item.providerPlaceId && item.name);
}

async function lookupVenue(entry: VenueMasterEntry, providers: VenuePlaceProvider[]) {
    const query = getVenuePlaceLookupQuery(entry);
    const candidates: VenuePlaceCandidate[] = [];
    const errors: string[] = [];

    for (const provider of providers) {
        try {
            const results = provider === 'kakao'
                ? await fetchKakaoPlaces(query)
                : await fetchNaverPlaces(query);
            candidates.push(...results);
        } catch (error) {
            errors.push(error instanceof Error ? error.message : `${provider} lookup failed`);
        }
    }

    if (candidates.length === 0 && errors.length > 0) {
        throw new Error(errors.join(' | '));
    }

    return { candidates, providerErrors: errors };
}

async function main() {
    const checkedAt = new Date().toISOString();
    const entries = readJsonIfExists<VenueMasterEntry[]>(VENUE_MASTER_PATH, []);
    const cache = readJsonIfExists<VenuePlaceCache>(CACHE_PATH, {});
    const providers = getConfiguredProviders();
    const lookupLimit = Number.parseInt(process.env.VENUE_PLACE_LOOKUP_LIMIT || '80', 10);
    const lookupDelayMs = getLookupDelayMs();
    const initialReport = buildVenuePlaceMatchingReport(entries, cache, providers, checkedAt);

    if (providers.length === 0) {
        writeJson(REPORT_PATH, initialReport);
        console.log('🔎 공식 장소 매칭 대기열 생성 완료');
        console.log('- API 키가 없어 외부 조회는 건너뜁니다.');
        console.log(`- 대기열: ${initialReport.pendingLookupCount.toLocaleString()}개`);
        console.log(`- 리포트: ${REPORT_PATH}`);
        return;
    }

    const queue = initialReport.queue.slice(0, Math.max(0, lookupLimit));
    console.log(`🔎 공식 장소 조회 시작: ${queue.length.toLocaleString()}개 (${providers.join(', ')}, delay ${lookupDelayMs}ms)`);

    for (const item of queue) {
        const entry = entries.find((venue) => venue.id === item.venueId);
        if (!entry) continue;

        try {
            const { candidates, providerErrors } = await lookupVenue(entry, providers);
            cache[entry.id] = chooseBestVenuePlaceCandidate(entry, candidates, checkedAt);
            if (providerErrors.length > 0) {
                cache[entry.id].reason = `${cache[entry.id].reason}; provider warnings: ${providerErrors.join(' | ')}`;
            }
            console.log(`- ${entry.officialName}: ${cache[entry.id].status} (${cache[entry.id].confidence})`);
        } catch (error) {
            cache[entry.id] = {
                venueId: entry.id,
                status: 'needs_review',
                confidence: 0,
                matchedAt: '',
                checkedAt,
                query: item.query,
                reason: error instanceof Error ? error.message : 'unknown lookup error',
            };
            console.warn(`- ${entry.officialName}: lookup failed`);
        }

        if (lookupDelayMs > 0) {
            await sleep(lookupDelayMs);
        }
    }

    writeJson(CACHE_PATH, cache);
    const finalReport = buildVenuePlaceMatchingReport(entries, cache, providers, checkedAt);
    writeJson(REPORT_PATH, finalReport);
    console.log(`✅ 공식 장소 매칭 완료: matched ${finalReport.matchedCount.toLocaleString()}개 · pending ${finalReport.pendingLookupCount.toLocaleString()}개`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
