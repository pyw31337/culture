
import axios from 'axios';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import crypto from 'crypto';
import cliProgress from 'cli-progress';
import { atomicWriteJson, atomicWriteJsonPreserve } from './utils/scraper-utils';
import { fetchInterparkApiEnrichment, getInterparkApiStats, type InterparkSession } from './utils/interpark-api';

puppeteer.use(StealthPlugin());

function slugify(text: string): string {
    return text
        .replace(/[^a-zA-Z0-9가-힣]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

interface Performance {
    id: string;
    title: string;
    image: string;
    date: string;
    venue: string;
    link: string;
    region: string;
    genre: string;
    // New fields
    address?: string;
    runningTime?: string;
    performanceTime?: string;
    ageRating?: string;
    price?: string;
    originalPrice?: string;
    discount?: string;
    priceList?: { label: string; price: string; discount?: string }[];
    ageDetail?: string;
    bookingNotice?: string;
    synopsis?: string;
    description?: string;
    synopsisImages?: string[];
    lastEnriched?: string; // ISO Date string
    /** Upcoming performance sessions from the public playSeq API (schedule only). */
    sessions?: InterparkSession[];
    sessionsCheckedAt?: string;
    lastApiEnriched?: string;
}

const outputPath = path.resolve(process.cwd(), 'src/data/interpark.json');
const BROWSER_EVAL_BOOTSTRAP = 'window.__name = window.__name || function(fn){ return fn; };';
const INTERPARK_ENRICH_LIMIT = Number(process.env.INTERPARK_ENRICH_LIMIT || 250);
const INTERPARK_FAST_MODE = process.env.INTERPARK_FAST_MODE === '1';
const INTERPARK_CONCURRENCY = Number(process.env.INTERPARK_CONCURRENCY || (INTERPARK_FAST_MODE ? 2 : 5));
const INTERPARK_NAVIGATION_TIMEOUT_MS = Number(process.env.INTERPARK_NAVIGATION_TIMEOUT_MS || (INTERPARK_FAST_MODE ? 15000 : 30000));
const INTERPARK_SELECTOR_TIMEOUT_MS = Number(process.env.INTERPARK_SELECTOR_TIMEOUT_MS || (INTERPARK_FAST_MODE ? 3000 : 5000));
const INTERPARK_PROTOCOL_TIMEOUT_MS = Number(process.env.INTERPARK_PROTOCOL_TIMEOUT_MS || (INTERPARK_FAST_MODE ? 25000 : 60000));
const INTERPARK_POST_LOAD_DELAY_MS = Number(process.env.INTERPARK_POST_LOAD_DELAY_MS || (INTERPARK_FAST_MODE ? 800 : 1500));
// Hard wall-clock budget for the whole scraper. When it is reached the browser
// enrich loop stops starting new pages and the run saves and exits 0, instead of
// being killed by the workflow `timeout` (exit 143), which discarded the freshly
// collected list (the cause of every GitHub fallback failure since 2026-09-09).
const INTERPARK_RUN_BUDGET_SECONDS = Number(process.env.INTERPARK_RUN_BUDGET_SECONDS || 0);
const INTERPARK_ITEM_TIMEOUT_MS = Number(process.env.INTERPARK_ITEM_TIMEOUT_MS || 90000);
// Public JSON API enrichment (summary/prices/playSeq): fast, CI-safe, no browser.
const INTERPARK_API_ENRICH_LIMIT = Number(process.env.INTERPARK_API_ENRICH_LIMIT ?? 300);
const INTERPARK_SESSION_LIMIT = Number(process.env.INTERPARK_SESSION_LIMIT ?? 200);
const INTERPARK_SESSION_WINDOW_DAYS = Number(process.env.INTERPARK_SESSION_WINDOW_DAYS ?? 60);
const INTERPARK_SESSION_LOOKAHEAD_DAYS = Number(process.env.INTERPARK_SESSION_LOOKAHEAD_DAYS ?? 120);
const INTERPARK_API_DELAY_MS = Math.max(300, Number(process.env.INTERPARK_API_DELAY_MS ?? 350));
const INTERPARK_API_CONCURRENCY = Math.max(1, Math.min(3, Number(process.env.INTERPARK_API_CONCURRENCY ?? 2)));
const RUN_STARTED_AT = Date.now();

function isRunBudgetExhausted(reserveMs = 0) {
    if (!INTERPARK_RUN_BUDGET_SECONDS || INTERPARK_RUN_BUDGET_SECONDS <= 0) return false;
    return Date.now() + reserveMs >= RUN_STARTED_AT + INTERPARK_RUN_BUDGET_SECONDS * 1000;
}

function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => T): Promise<T> {
    return new Promise((resolve) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            resolve(onTimeout());
        }, ms);
        promise.then((value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(value);
        }, () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(onTimeout());
        });
    });
}

const REGIONS = {
    seoul: '42001',
    gyeonggi: '42010',
    incheon: '42011',
};

async function getRegions() {
    console.log('Fetching region list...');
    const url = 'https://ticket.interpark.com/TiKi/Special/TPRegionReserve.asp?Region=42001';

    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            timeout: 10000,
        });

        const decoded = iconv.decode(response.data, 'euc-kr');
        const $ = cheerio.load(decoded);
        const regions: { name: string, code: string }[] = [];

        // Helper to decode EUC-KR %-encoded string
        const decodeEucKrParam = (encoded: string) => {
            try {
                const hex = encoded.replace(/%/g, '');
                const buffer = Buffer.from(hex, 'hex');
                return iconv.decode(buffer, 'euc-kr');
            } catch (e) {
                return null;
            }
        };

        $('.Rg_list_tab a').each((_, el) => {
            const $el = $(el);
            const href = $el.attr('href') || '';
            const regionMatch = href.match(/Region=(\d+)/);
            const nameMatch = href.match(/RegionName=([^&]+)/);

            if (regionMatch && nameMatch) {
                const code = regionMatch[1];
                let name = decodeEucKrParam(nameMatch[1]);

                if (name && name !== '전체') {
                    if (!regions.find(r => r.code === code)) {
                        regions.push({ name: name.trim(), code });
                    }
                }
            }
        });

        // Fallback
        if (regions.length === 0) {
            $('a[href*="Region="]').each((_, el) => {
                const $el = $(el);
                const href = $el.attr('href') || '';
                const regionMatch = href.match(/Region=(\d+)/);
                const nameMatch = href.match(/RegionName=([^&]+)/);

                if (regionMatch && nameMatch) {
                    const code = regionMatch[1];
                    let name = decodeEucKrParam(nameMatch[1]);
                    if (name && name.length < 10 && !name.includes('booking') && name !== '전체') {
                        if (!regions.find(r => r.code === code)) {
                            regions.push({ name: name.trim(), code });
                        }
                    }
                }
            });
        }

        console.log(`Found ${regions.length} regions.`);
        return regions;

    } catch (error) {
        console.error('Error fetching region list, using defaults.');
        return [
            { name: '서울', code: '42001' },
            { name: '경기', code: '42010' },
            { name: '인천', code: '42011' }
        ];
    }
}

async function fetchPerformances(regionCode: string, regionName: string): Promise<Performance[]> {
    const url = `https://ticket.interpark.com/TiKi/Special/TPRegionReserve.asp?Region=${regionCode}`;

    try {
        const response = await axios.get(url, {
            responseType: 'arraybuffer',
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 10000,
        });

        const decoded = iconv.decode(response.data, 'euc-kr');
        const $ = cheerio.load(decoded);
        const performances: Performance[] = [];

        $('.obj').each((_, obj) => {
            const $obj = $(obj);
            const $genreAnchor = $obj.find('.obj_tit a');
            let genre = 'etc';
            if ($genreAnchor.length) {
                const name = $genreAnchor.attr('name') || '';
                const lowerName = name.toLowerCase();
                if (lowerName.includes('musical')) genre = 'musical';
                else if (lowerName.includes('concert')) genre = 'concert';
                else if (lowerName.includes('play')) genre = 'play';
                else if (lowerName.includes('classic') || lowerName.includes('opera') || lowerName.includes('dance') || lowerName.includes('ballet') || lowerName.includes('traditional')) genre = 'classic';
                else if (lowerName.includes('exhibit')) genre = 'exhibition';
                else if (lowerName.includes('theme') || lowerName.includes('kid')) genre = 'leisure';
            }

            // Fallback for remaining 'etc' - if it contains 'museum', 'exhibit', 'gallery' etc.
            if (genre === 'etc') {
                const title = $obj.find('.obj_tit').text().toLowerCase();
                if (title.includes('전시') || title.includes('박물관') || title.includes('미술관')) {
                    genre = 'exhibition';
                }
            }

            $obj.find('.content').each((i, el) => {
                const $el = $(el);
                const $nameDd = $el.find('dd.name');
                const $titleLink = $nameDd.find('p.txt a');
                const title = $titleLink.text().trim();
                const href = $titleLink.attr('href') || '';
                let link = href.startsWith('http') ? href : `https://ticket.interpark.com${href}`;

                // Convert to new link format if possible for better detail scraping alignment
                // Link is usually: http://ticket.interpark.com/Ticket/Goods/GoodsInfo.asp?GoodsCode=24017373
                const idMatch = link.match(/GoodsCode=([A-Za-z0-9]+)/);
                let id = idMatch ? idMatch[1] : null;

                const $img = $nameDd.find('img');
                let image = $img.attr('src') || '';
                if (image.includes('/rz/image/play/goods/poster/')) {
                    image = image.replace('/rz/image/play/goods/poster/', '/Play/image/large/')
                        .replace('_p_s.jpg', '_p.gif');
                }
                if (image && image.startsWith('http://')) {
                    image = image.replace('http://', 'https://');
                }

                const venue = $el.find('dd.place').text().trim();
                const date = $el.find('dd.date').text().trim();

                if (!id && title) {
                    const uniqueString = `${title}-${date}-${venue}`;
                    id = `unknown-${crypto.createHash('md5').update(uniqueString).digest('hex').substring(0, 8)}`;
                }

                if (title && id) {
                    const stableId = `perf_${slugify(title)}`;
                    performances.push({
                        id: stableId,
                        title,
                        image,
                        date,
                        venue,
                        link: `https://tickets.interpark.com/goods/${id}`, // Keep numeric ID in link for detail scraping
                        region: regionName,
                        genre
                    });
                }
            });
        });

        return performances;
    } catch (error) {
        console.error(`Error fetching data for ${regionName}:`, error);
        return [];
    }
}


const NOL_API_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Origin': 'https://tickets.interpark.com',
    'Referer': 'https://tickets.interpark.com/',
    'Accept': 'application/json, text/plain, */*',
};

const NOL_RANKING_GENRES = ['MUSICAL', 'DRAMA', 'KIDS', 'CLASSIC', 'CONCERT', 'EXHIBIT', 'LEISURE', 'SPORTS', 'ALL'];
const NOL_RANKING_PERIODS = ['D', 'W', 'M'];
const NOL_GENRE_PAGES = ['musical', 'play', 'family', 'classic', 'concert', 'sports', 'leisure'];
const NOL_UPCOMING_GENRES = ['musical', 'play', 'kids', 'classic', 'concert', 'sports', 'exhibit', 'family'];

const GENRE_CODE_MAP: Record<string, string> = {
    '01011': 'musical',
    '01003': 'concert',
    '01005': 'play',
    '01009': 'classic',
    '01007': 'classic',
    '01013': 'exhibition',
    '01015': 'leisure',
    '01017': 'leisure',
    musical: 'musical',
    concert: 'concert',
    drama: 'play',
    play: 'play',
    classic: 'classic',
    kids: 'leisure',
    exhibit: 'exhibition',
    leisure: 'leisure',
    sports: 'etc',
};

function mapGenre(raw?: string | null): string {
    if (!raw) return 'etc';
    const key = String(raw).trim().toLowerCase();
    if (GENRE_CODE_MAP[key]) return GENRE_CODE_MAP[key];
    if (key.includes('musical') || key.includes('뮤지컬')) return 'musical';
    if (key.includes('concert') || key.includes('콘서트')) return 'concert';
    if (key.includes('drama') || key.includes('play') || key.includes('연극')) return 'play';
    if (key.includes('classic') || key.includes('클래식') || key.includes('무용')) return 'classic';
    if (key.includes('exhibit') || key.includes('전시')) return 'exhibition';
    if (key.includes('kid') || key.includes('family') || key.includes('아동') || key.includes('가족') || key.includes('leisure')) return 'leisure';
    return 'etc';
}

function formatPlayDate(start?: string | null, end?: string | null): string {
    const fmt = (value?: string | null) => {
        if (!value || !/^\d{8}$/.test(value)) return '';
        return `${value.slice(0, 4)}.${value.slice(4, 6)}.${value.slice(6, 8)}`;
    };
    const s = fmt(start);
    const e = fmt(end) || s;
    if (!s) return '';
    return `${s} ~ ${e}`;
}

function inferRegionFromText(...parts: Array<string | undefined | null>): string {
    const text = parts.filter(Boolean).join(' ');
    const rules: Array<[RegExp, string]> = [
        [/서울|구로|강남|강동|마포|송파|용산|종로|영등포/, '서울'],
        [/경기|과천|성남|수원|고양|부천|용인|안양|화성/, '경기'],
        [/인천/, '인천'],
        [/부산/, '부산'],
        [/대구/, '대구'],
        [/광주/, '광주'],
        [/대전/, '대전'],
        [/울산/, '울산'],
        [/세종/, '세종'],
        [/강원/, '강원'],
        [/충북|충청북/, '충북'],
        [/충남|충청남/, '충남'],
        [/전북|전라북/, '전북'],
        [/전남|전라남|목포/, '전남'],
        [/경북|경상북/, '경북'],
        [/경남|경상남|김해/, '경남'],
        [/제주/, '제주'],
    ];
    for (const [re, name] of rules) {
        if (re.test(text)) return name;
    }
    return '기타';
}

function performanceFromGoods(input: {
    goodsCode: string;
    title: string;
    venue?: string;
    image?: string;
    date?: string;
    region?: string;
    genre?: string;
}): Performance | null {
    const goodsCode = String(input.goodsCode || '').trim();
    const title = String(input.title || '').trim();
    if (!goodsCode || !title) return null;
    const venue = String(input.venue || '').trim() || '미상';
    return {
        id: `perf_${slugify(title)}`,
        title,
        image: input.image || '',
        date: input.date || '',
        venue,
        link: `https://tickets.interpark.com/goods/${goodsCode}`,
        region: input.region || inferRegionFromText(title, venue),
        genre: mapGenre(input.genre),
    };
}

function extractGoodsCode(linkOrId?: string | null): string | null {
    if (!linkOrId) return null;
    const fromLink = String(linkOrId).match(/\/goods\/([A-Za-z0-9]+)/);
    if (fromLink) return fromLink[1];
    if (/^[A-Za-z0-9]{5,}$/.test(String(linkOrId))) return String(linkOrId);
    return null;
}

async function fetchGoodsSummary(goodsCode: string): Promise<any | null> {
    try {
        const { data } = await axios.get(`https://api-ticketfront.interpark.com/v1/goods/${goodsCode}/summary`, {
            headers: NOL_API_HEADERS,
            timeout: 15000,
        });
        return data?.data || null;
    } catch {
        return null;
    }
}

async function hydrateGoodsCode(goodsCode: string, seed?: Partial<Performance>): Promise<Performance | null> {
    const summary = await fetchGoodsSummary(goodsCode);
    if (summary?.goodsName) {
        const image = summary.goodsLargeImageUrl || summary.goodsSmallImageUrl || seed?.image || '';
        const normalizedImage = String(image).startsWith('//') ? `https:${image}` : image;
        return performanceFromGoods({
            goodsCode,
            title: summary.goodsName,
            venue: summary.placeName || seed?.venue,
            image: normalizedImage,
            date: formatPlayDate(summary.playStartDate, summary.playEndDate) || seed?.date,
            region: inferRegionFromText(summary.goodsName, summary.placeName, seed?.region),
            genre: summary.genreCode || summary.genreName || summary.genreSubName || seed?.genre,
        });
    }
    if (seed?.title) {
        return performanceFromGoods({
            goodsCode,
            title: seed.title,
            venue: seed.venue,
            image: seed.image,
            date: seed.date,
            region: seed.region,
            genre: seed.genre,
        });
    }
    return null;
}

async function collectFromAspRegions(): Promise<Performance[]> {
    const regions = await getRegions();
    const allItems: Performance[] = [];
    let successfulRegions = 0;

    for (const r of regions) {
        console.log(`Scanning ASP region ${r.name}...`);
        const items = await fetchPerformances(r.code, r.name);
        if (items.length > 0) successfulRegions += 1;
        allItems.push(...items);
        await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log(`ASP region collect: ${successfulRegions}/${regions.length} regions, ${allItems.length} items`);
    return allItems;
}

async function collectFromNolRanking(): Promise<Performance[]> {
    const items: Performance[] = [];
    const seen = new Set<string>();

    for (const period of NOL_RANKING_PERIODS) {
        for (const genre of NOL_RANKING_GENRES) {
            try {
                const url = `https://tickets.interpark.com/contents/api/ranking?genre=${genre}&page=1&pageSize=100&period=${period}`;
                const { data } = await axios.get(url, { headers: NOL_API_HEADERS, timeout: 20000 });
                for (const arr of Object.values(data || {})) {
                    if (!Array.isArray(arr)) continue;
                    for (const row of arr) {
                        const goodsCode = String(row?.goodsCode || '');
                        if (!goodsCode || seen.has(goodsCode)) continue;
                        seen.add(goodsCode);
                        const item = performanceFromGoods({
                            goodsCode,
                            title: row.goodsName,
                            venue: row.placeName,
                            image: row.imageUrl,
                            date: formatPlayDate(row.playStartDate || row.sDate, row.playEndDate || row.eDate),
                            region: inferRegionFromText(row.goodsName, row.placeName),
                            genre: row.genre || row.genreCode || genre,
                        });
                        if (item) items.push(item);
                    }
                }
            } catch (error) {
                console.warn(`NOL ranking failed genre=${genre} period=${period}:`, (error as Error)?.message || error);
            }
            await new Promise(resolve => setTimeout(resolve, 120));
        }
    }

    console.log(`NOL ranking collect: ${items.length} items`);
    return items;
}

async function collectGoodsCodesFromNolHtml(): Promise<string[]> {
    const codes = new Set<string>();
    const pages = [
        ...NOL_GENRE_PAGES.map(g => `https://nol.yanolja.com/ticket/genre/${g}`),
        ...NOL_UPCOMING_GENRES.map(g => `https://nol.yanolja.com/ticket/display/upcoming?genre=${g}`),
    ];

    for (const url of pages) {
        try {
            const { data } = await axios.get(url, {
                headers: {
                    'User-Agent': NOL_API_HEADERS['User-Agent'],
                    'Accept': 'text/html,application/xhtml+xml',
                },
                timeout: 25000,
                responseType: 'text',
                // axios may follow redirects to NOL genre pages
                maxRedirects: 5,
            });
            const html = String(data || '');
            for (const match of html.matchAll(/\/(?:ticket\/(?:places\/[^/]+\/)?products|goods)\/([A-Za-z0-9]+)/g)) {
                if (match[1] && !match[1].startsWith('L')) codes.add(match[1]);
            }
            for (const match of html.matchAll(/productId["']?\s*[:=]\s*["']?([0-9]{5,})/g)) {
                codes.add(match[1]);
            }
        } catch (error) {
            console.warn(`NOL HTML harvest failed ${url}:`, (error as Error)?.message || error);
        }
        await new Promise(resolve => setTimeout(resolve, 150));
    }

    console.log(`NOL HTML harvest: ${codes.size} goods codes`);
    return Array.from(codes);
}

async function collectFromNolCatalog(_existingCodes: Set<string>): Promise<Performance[]> {
    const rankingItems = await collectFromNolRanking();
    const htmlCodes = await collectGoodsCodesFromNolHtml();
    // Hydrate only newly discovered NOL codes. Existing long-tail goods are
    // carried forward separately so daily runs do not hammer summary for 3k+ SKUs.
    const codeSet = new Set<string>([
        ...rankingItems.map(i => extractGoodsCode(i.link)).filter(Boolean) as string[],
        ...htmlCodes,
    ]);

    console.log(`Hydrating ${codeSet.size} NOL-discovered goods via summary API...`);
    const hydrated: Performance[] = [];
    const rankingByCode = new Map<string, Performance>();
    for (const item of rankingItems) {
        const code = extractGoodsCode(item.link);
        if (code) rankingByCode.set(code, item);
    }

    const codes = Array.from(codeSet);
    const concurrency = Number(process.env.INTERPARK_SUMMARY_CONCURRENCY || 4);
    for (let i = 0; i < codes.length; i += concurrency) {
        const batch = codes.slice(i, i + concurrency);
        const results = await Promise.all(batch.map(async (code) => {
            const seed = rankingByCode.get(code);
            return hydrateGoodsCode(code, seed);
        }));
        for (const item of results) {
            if (item) hydrated.push(item);
        }
        if ((i / concurrency) % 10 === 0) {
            console.log(`  summary progress ${Math.min(i + concurrency, codes.length)}/${codes.length}`);
        }
        await new Promise(resolve => setTimeout(resolve, 80));
    }

    console.log(`NOL catalog hydrated: ${hydrated.length} items`);
    return hydrated;
}

function mergePerformanceLists(...lists: Performance[][]): Performance[] {
    const byGoods = new Map<string, Performance>();
    const byId = new Map<string, Performance>();

    const prefer = (a: Performance, b: Performance) => {
        const score = (p: Performance) => (
            (p.venue && p.venue !== '미상' ? 2 : 0) +
            (p.date ? 2 : 0) +
            (p.image ? 1 : 0) +
            (p.region && p.region !== '기타' ? 1 : 0) +
            (p.genre && p.genre !== 'etc' ? 1 : 0)
        );
        return score(b) > score(a) ? b : a;
    };

    for (const list of lists) {
        for (const item of list) {
            const goods = extractGoodsCode(item.link);
            if (goods) {
                const prev = byGoods.get(goods);
                byGoods.set(goods, prev ? prefer(prev, item) : item);
            } else {
                const prev = byId.get(item.id);
                byId.set(item.id, prev ? prefer(prev, item) : item);
            }
        }
    }

    const merged = [...byGoods.values(), ...byId.values()];
    // Final stable id dedupe
    const finalMap = new Map<string, Performance>();
    for (const item of merged) {
        const prev = finalMap.get(item.id);
        finalMap.set(item.id, prev ? prefer(prev, item) : item);
    }
    return Array.from(finalMap.values());
}

async function collectAllInterparkPerformances(existingMap: Map<string, Performance>): Promise<Performance[]> {
    const existingCodes = new Set<string>();
    for (const item of existingMap.values()) {
        const code = extractGoodsCode(item.link);
        if (code) existingCodes.add(code);
    }

    const aspItems = await collectFromAspRegions();
    const nolItems = await collectFromNolCatalog(existingCodes);

    // Keep not-yet-expired existing rows even if summary temporarily fails,
    // so regional long-tail goods (e.g. 구로 오류아트홀) are not dropped.
    const carriedExisting: Performance[] = [];
    const coveredCodes = new Set(
        [...aspItems, ...nolItems]
            .map(i => extractGoodsCode(i.link))
            .filter(Boolean) as string[]
    );
    for (const item of existingMap.values()) {
        const code = extractGoodsCode(item.link);
        if (!code || coveredCodes.has(code)) continue;
        carriedExisting.push(item);
    }

    const merged = mergePerformanceLists(aspItems, nolItems, carriedExisting);
    console.log(`Combined Interpark list: ASP=${aspItems.length}, NOL=${nolItems.length}, carried=${carriedExisting.length}, merged=${merged.length}`);
    if (merged.length === 0) {
        throw new Error('Interpark list collection returned no items; existing data was preserved.');
    }
    return merged;
}


async function scrapeDetails(browser: any, items: Performance[], existingEnriched: Map<string, Performance>) {
    const targetGenres = ['musical', 'play', 'concert', 'classic', 'leisure', 'exhibition', 'etc'];
    const candidates = items.filter(i => targetGenres.includes(i.genre));
    const others = items.filter(i => !targetGenres.includes(i.genre));

    // Split candidates into 'already done' vs 'todo'
    const alreadyDone: Performance[] = [];
    const todo: Performance[] = [];

    // Helper: Check if item was enriched recently (e.g., within 7 days)
    const isRecentlyEnriched = (ex: Performance) => {
        if (!ex.lastEnriched) return false;
        try {
            const last = new Date(ex.lastEnriched);
            const now = new Date();
            const diffDays = (now.getTime() - last.getTime()) / (1000 * 3600 * 24);
            return diffDays < 7;
        } catch { return false; }
    };

    const hasUsefulPrice = (price?: string) => Boolean(price && /[0-9]/.test(price) && !['무료/이벤트', '이벤트', '가격정보없음'].includes(price));

    const parseStartDate = (date?: string) => {
        const match = (date || '').match(/(\d{4})[.-](\d{2})[.-](\d{2})/);
        if (!match) return null;
        const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const enrichPriority = (item: Performance) => {
        const existing = existingEnriched.get(item.id);
        let score = 0;
        if (!existing) score += 20;
        if (!hasUsefulPrice(existing?.price)) score += 50;
        if (!existing?.ageRating) score += 25;
        if (!existing?.runningTime) score += 15;
        if (!existing?.synopsis) score += 5;

        const startDate = parseStartDate(item.date || existing?.date);
        const endMatch = [...String(item.date || existing?.date || '').matchAll(/(\d{4})[.-](\d{2})[.-](\d{2})/g)].pop();
        const endDate = endMatch ? new Date(Number(endMatch[1]), Number(endMatch[2]) - 1, Number(endMatch[3])) : null;
        const isOngoing = Boolean(endDate && endDate.getTime() >= new Date().setHours(0, 0, 0, 0));
        if (startDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const daysFromToday = Math.floor((startDate.getTime() - today.getTime()) / 86400000);
            if (daysFromToday >= -2 && daysFromToday <= 30) {
                score += 100 - Math.max(0, daysFromToday) * 2;
            } else if (daysFromToday < -2 && !isOngoing) {
                score -= 40;
            } else if (isOngoing) {
                score += 40;
            }
        }

        if (['musical', 'play', 'concert', 'classic', 'exhibition'].includes(item.genre)) score += 5;
        return score;
    };

    candidates.forEach(c => {
        if (existingEnriched.has(c.id)) {
            const ex = existingEnriched.get(c.id)!;

            // Criteria for skipping:
            // 1. Has important details (MUST have a REAL price to be considered fully enriched)
            // 2. Was checked recently (lastEnriched < 7 days), preventing infinite retry of empty items
            const hasBadPrice = !hasUsefulPrice(ex.price);
            const hasCompleteData = !hasBadPrice && Boolean(ex.runningTime) && Boolean(ex.ageRating) && Boolean(ex.synopsis);

            if (hasCompleteData || (isRecentlyEnriched(ex) && hasCompleteData)) {
                alreadyDone.push({ ...c, ...ex });
            } else {
                todo.push(c);
            }
        } else {
            todo.push(c);
        }
    });

    todo.sort((a, b) => enrichPriority(b) - enrichPriority(a));

    const enrichQueue = todo.slice(0, INTERPARK_ENRICH_LIMIT);
    const deferred = todo.slice(INTERPARK_ENRICH_LIMIT).map((item) => {
        const existing = existingEnriched.get(item.id);
        return existing ? { ...existing, ...item } : item;
    });

    console.log(`Total Candidates: ${candidates.length}. Smart Skip: ${alreadyDone.length}. To Enrich: ${enrichQueue.length}. Deferred/retained: ${deferred.length}.`);

    const enrichedResult: Performance[] = [...alreadyDone, ...deferred];

    // Progress bar for ToDo
    const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic);
    if (enrichQueue.length > 0) {
        bar.start(enrichQueue.length, 0);
    }

    const CONCURRENCY = Math.max(1, INTERPARK_CONCURRENCY);
    for (let i = 0; i < enrichQueue.length; i += CONCURRENCY) {
        if (!browser || isRunBudgetExhausted(INTERPARK_ITEM_TIMEOUT_MS + 15000)) {
            const remaining = enrichQueue.slice(i).map((item) => {
                const existing = existingEnriched.get(item.id);
                return existing ? { ...existing, ...item } : item;
            });
            if (browser) {
                console.warn(`[interpark] run budget ${INTERPARK_RUN_BUDGET_SECONDS}s reached; deferring ${remaining.length} browser enrich item(s) to the next run.`);
            }
            enrichedResult.push(...remaining);
            break;
        }
        const chunk = enrichQueue.slice(i, i + CONCURRENCY);

        const promises = chunk.map((item) => withTimeout(enrichOne(item), INTERPARK_ITEM_TIMEOUT_MS, () => {
            console.warn(`[interpark] enrich timed out after ${INTERPARK_ITEM_TIMEOUT_MS}ms: ${item.id}`);
            const existing = existingEnriched.get(item.id);
            return existing ? { ...existing, ...item } : item;
        }));

        async function enrichOne(item: Performance): Promise<Performance> {
            const page = await browser.newPage();
            try {
                await page.evaluateOnNewDocument(BROWSER_EVAL_BOOTSTRAP);
                page.setDefaultNavigationTimeout(INTERPARK_NAVIGATION_TIMEOUT_MS);
                page.setDefaultTimeout(INTERPARK_SELECTOR_TIMEOUT_MS);
                // The CI fallback only needs list freshness. Local deep runs keep
                // styles so detailed selectors remain available.
                await page.setRequestInterception(true);
                page.on('request', (req: any) => {
                    const blockedTypes = INTERPARK_FAST_MODE
                        ? ['image', 'media', 'font']
                        : ['image', 'media'];
                    if (blockedTypes.includes(req.resourceType())) {
                        req.abort();
                    } else {
                        req.continue();
                    }
                });

                await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                await page.setViewport({ width: 1280, height: 800 });

                // Extract original GoodsCode from link
                const goodsIdMatch = item.link.match(/\/goods\/([A-Za-z0-9]+)/);
                const goodsId = goodsIdMatch ? goodsIdMatch[1] : null;
                if (!goodsId) {
                    return item;
                }
                const detailUrl = `https://tickets.interpark.com/goods/${goodsId}`;

                await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: INTERPARK_NAVIGATION_TIMEOUT_MS });
                await page.evaluate(BROWSER_EVAL_BOOTSTRAP).catch(() => undefined);

                // [FIX] Force close popups that might block content scraping
                try {
                    await page.evaluate(function () {
                        document.querySelectorAll('#popup-prdGuide, .popupLayer, .layerPopup').forEach(function (el) { el.remove(); });
                    });
                } catch (e) { }

                try {
                    await page.waitForSelector('.infoList, .infoItem', { timeout: INTERPARK_SELECTOR_TIMEOUT_MS });
                    await page.waitForFunction(function () {
                        return Array.from(document.querySelectorAll('.infoItem')).some(function (el) {
                            return /장소|공연기간|공연시간|관람연령|가격/.test(el.textContent || '');
                        });
                    }, { timeout: INTERPARK_SELECTOR_TIMEOUT_MS });
                } catch (e) { }
                if (INTERPARK_POST_LOAD_DELAY_MS > 0) {
                    await new Promise(resolve => setTimeout(resolve, INTERPARK_POST_LOAD_DELAY_MS));
                }

                // 1. Basic Info & Base Price
                const basicInfo = await page.evaluate(function () {
                    // 1. Info Items (Runtime, Age)
                    let runningTime = '';
                    let performanceTime = '';
                    let ageRating = '';

                    const normalizeInlineText = function (value: string) {
                        return (value || '').replace(/\s+/g, ' ').trim();
                    };

                    const bodyLines = function () {
                        return (document.body.innerText || '')
                            .split('\n')
                            .map(line => normalizeInlineText(line))
                            .filter(Boolean);
                    };

                    const readValueAfterLabel = function (labels: string[]) {
                        const lines = bodyLines();
                        for (let i = 0; i < lines.length; i += 1) {
                            for (const label of labels) {
                                const line = lines[i];
                                if (line === label || line.startsWith(label)) {
                                    const inline = normalizeInlineText(line.slice(label.length));
                                    if (inline && !inline.includes('자세히') && inline !== label) return inline;

                                    for (let j = i + 1; j < Math.min(lines.length, i + 6); j += 1) {
                                        const next = lines[j];
                                        if (!next || labels.includes(next)) continue;
                                        if (next.includes('자세히') || next.includes('전체가격보기')) continue;
                                        return next;
                                    }
                                }
                            }
                        }
                        return '';
                    };

                    // Try finding .infoList items first, or just .infoItem globally if .infoList class is missing
                    const readInfoPair = function (item: Element) {
                        let label = item.querySelector('.infoLabel')?.textContent?.trim() || '';
                        let text = item.querySelector('.infoText')?.textContent?.trim() || '';
                        if (!label || !text) {
                            const lines = ((item as HTMLElement).innerText || '')
                                .split('\n')
                                .map(line => normalizeInlineText(line))
                                .filter(Boolean);
                            label = label || lines[0] || '';
                            text = text || lines.slice(1).find(line => !line.includes('자세히') && line !== label) || '';
                        }
                        return { label, text };
                    };

                    const infoItems = Array.from(document.querySelectorAll('.infoList .infoItem, li.infoItem, .infoItem'));
                    if (infoItems.length > 0) {
                        infoItems.forEach(item => {
                            const { label, text } = readInfoPair(item);

                            if (label.includes('공연시간') || label.includes('관람시간')) runningTime = text;
                            if (label.includes('관람연령') || label.includes('이용등급')) {
                                ageRating = text;
                                // Clean up age rating if it has extra junk
                                if (ageRating.includes('\n')) ageRating = ageRating.split('\n')[0].trim();
                            }
                        });
                    }

                    // Fallback to old structure (dl > dd) if not found
                    if (!runningTime || !ageRating) {
                        const items = Array.from(document.querySelectorAll('li.infoItem, .infoItem, dl > div, dl > .item'));
                        items.forEach(item => {
                            const pair = readInfoPair(item);
                            const label = item.querySelector('.infoLabel, dt')?.textContent?.trim() || pair.label;
                            const text = item.querySelector('.infoDesc .infoText, dd')?.textContent?.trim() || pair.text;

                            if (!runningTime && (label.includes('공연시간') || label.includes('관람시간'))) runningTime = text;
                            if (!ageRating && (label.includes('관람연령') || label.includes('이용등급'))) ageRating = text;
                        });
                    }

                    // 3. Fallback: Regex Search on Body Text (for cases like 26001154 where structural markup might differ or be hidden)
                    if (!runningTime || !ageRating) {
                        const bodyText = document.body.innerText;

                        if (!runningTime) {
                            // Match "공연시간" OR "관람시간" followed by newline/spaces and then likely "XXX분"
                            // "공연시간 \n 100분"
                            const timeMatch = bodyText.match(/(?:공연시간|관람시간)\s*\n*([0-9,]+분)/);
                            if (timeMatch) runningTime = timeMatch[1];
                        }

                        if (!ageRating) {
                            // Match "관람연령" followed by newline/spaces and then text ending in "관람가능" or "이상"
                            // E.g. "관람연령\n24개월이상 관람가능"
                            const ageMatch = bodyText.match(/관람연령\s*\n*(.*?관람가능|.*?\s이상)/);
                            if (ageMatch) ageRating = ageMatch[1].trim();
                        }
                    }

                    if (!runningTime) {
                        runningTime = readValueAfterLabel(['공연시간', '관람시간']);
                    }
                    if (!ageRating) {
                        ageRating = readValueAfterLabel(['관람연령', '이용등급']);
                    }
                    if (ageRating) {
                        ageRating = normalizeInlineText(ageRating)
                            .replace(/세이상/g, '세 이상')
                            .replace(/세\s*이상/g, '세 이상');
                    }

                    // 2. Price Info
                    let price = '';
                    let originalPrice = '';
                    let discount = '';

                    // Strategy A: Main Page Price List (New Structure)
                    // Added .infoPriceList .infoPriceItem based on Y5000131 debugging
                    const priceItems = Array.from(document.querySelectorAll('.infoList .infoItem .infoDesc .priceList .priceItem, .infoPriceList .infoPriceItem, .infoPriceItem'));

                    // 1. Try finding detailed text list first (e.g., "전석 (정상가) 66,000원")
                    // This is common in newer Interpark pages (e.g. 25018004)
                    const detailContainer = document.querySelector('.prdPriceDetail');
                    if (detailContainer) {
                        const text = detailContainer.textContent || '';
                        // Extract all "Label Price" pairs
                        // Regex to match "Sort (Type) 00,000원"
                        // Handle multiline
                        const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

                        let normalPrice = 0;
                        let salePrice = 0;

                        lines.forEach(line => {
                            const match = line.match(/(.*?)\s*([0-9,]+)원/);
                            if (match) {
                                const label = match[1];
                                const val = parseInt(match[2].replace(/,/g, ''), 10);

                                if (label.includes('정상가')) {
                                    normalPrice = val;
                                } else if (label.includes('예매가') || label.includes('할인가')) {
                                    salePrice = val;
                                } else if (!salePrice && !normalPrice) {
                                    // If no specific keyword, assume it's the main price
                                    salePrice = val;
                                }
                            }
                        });

                        if (normalPrice > 0 && salePrice > 0) {
                            originalPrice = normalPrice.toLocaleString() + '원';
                            price = salePrice.toLocaleString() + '원';
                            const rateVal = Math.round((1 - (salePrice / normalPrice)) * 100);
                            discount = `${rateVal}%`;
                        } else if (salePrice > 0) {
                            price = salePrice.toLocaleString() + '원';
                        }
                    }

                    // 2. If Detail Text Failed, try structured elements (.sale, .price)
                    if (!price && priceItems.length > 0) {
                        // Filter out items that are ONLY the "View All Prices" button with no actual price elements
                        const validPriceItems = priceItems.filter(i => {
                            const text = i.textContent || '';
                            const hasPriceEl = i.querySelector('.price') || i.querySelector('.sale');
                            // Keep if it has structured price elements, even if it also contains '전체가격보기'
                            if (hasPriceEl) return true;
                            // Otherwise, exclude '전체가격보기'-only items and require '원' in text
                            return !text.includes('전체가격보기') && text.includes('원');
                        });

                        let bestItem = validPriceItems.find(i => i.querySelector('.sale') && i.querySelector('.price'));
                        if (!bestItem) bestItem = validPriceItems.find(i => i.querySelector('.sale'));
                        if (!bestItem) bestItem = validPriceItems.find(i => i.querySelector('.price')); // Fallback (sometimes .price is the final price if no discount)
                        if (!bestItem && validPriceItems.length > 0) bestItem = validPriceItems[0];

                        if (bestItem) {
                            // Collect ALL prices found in the price list to show full breakdown (e.g. 전석 30,000원, 할인석 20,000원)
                            const allPriceElements = Array.from(bestItem.querySelectorAll('.priceItem, .priceUnit, .priceCell, li'));
                            const priceParts: string[] = [];
                            
                            validPriceItems.forEach(item => {
                                const label = item.querySelector('.priceLabel, .name, .type')?.textContent?.trim() || '';
                                const sale = item.querySelector('.sale')?.textContent?.trim() || '';
                                const priceVal = item.querySelector('.price')?.textContent?.trim() || '';
                                
                                const finalPrice = sale || priceVal;
                                if (finalPrice && /[0-9]/.test(finalPrice)) {
                                    if (label) {
                                        priceParts.push(`${label} ${finalPrice}`);
                                    } else {
                                        priceParts.push(finalPrice);
                                    }
                                }
                            });

                            if (priceParts.length > 0) {
                                price = priceParts.join('\n');
                            }

                            // Still try to get single best price/discount for metadata fields
                            const primary = bestItem;
                            const sale = primary.querySelector('.sale')?.textContent?.trim() || '';
                            const priceVal = primary.querySelector('.price')?.textContent?.trim() || '';
                            const rate = primary.querySelector('.rate')?.textContent?.trim() || '';

                            if (sale && priceVal && rate) {
                                // Discount Case (keep for metadata, but 'price' above is richer)
                                if (!price) price = sale;
                                originalPrice = priceVal;
                                discount = rate;
                            } else if (sale && !price) {
                                price = sale;
                            } else if (priceVal && !price) {
                                price = priceVal;
                            }
                        }
                    }

                    // Strategy C: Traverse .infoItem for labels like "가격" or "금액" (observed on 26001972)
                    if (!price) {
                        const items = Array.from(document.querySelectorAll('.infoList .infoItem, li.infoItem, .infoItem'));
                        items.forEach(item => {
                            const pair = readInfoPair(item);
                            const label = item.querySelector('.infoLabel')?.textContent?.trim() || pair.label;
                            const textSource = item.querySelector('.infoText, .infoDesc') || item;
                            const text = textSource.textContent?.trim() || pair.text;

                            if (label.includes('가격') || label.includes('판매가') || label.includes('티켓가격')) {
                                // Try finding a price pattern in the item text
                                const match = text.match(/([0-9,]+원)/);
                                if (match) {
                                    price = match[1];
                                } else if (text && text.includes('원')) {
                                    // Fallback to full text if it contains '원' but regex failed for some reason
                                    price = text.split('\n')[0].trim();
                                }
                            }
                        });
                    }

                    // Strategy B: Old Structure text parsing
                    if (!price) {
                        const dlPriceText = document.querySelector('.infoItem.infoPrice .infoDesc')?.textContent?.trim() || '';
                        if (dlPriceText && !dlPriceText.includes('전체가격보기')) {
                            const match = dlPriceText.match(/([0-9,]+원)/);
                            if (match) price = match[1];
                            else price = dlPriceText;
                        }
                    }

                    // Strict validation: if price doesn't have a number, clear it
                    if (price && !/[0-9]/.test(price)) {
                        price = '';
                    }

                    // Final ultimate global fallback: scan for any price-like format in info list
                    if (!price) {
                        const genericItems = Array.from(document.querySelectorAll('.infoItem, .infoPriceItem'));
                        for (let el of genericItems) {
                            const txt = el.textContent || '';
                            if (!txt.includes('전체가격보기') && txt.match(/[0-9,]{3,}원/)) {
                                price = txt.match(/([0-9,]{3,}원)/)![1];
                                break;
                            }
                        }

                        // Also try: price area that has '전체가격보기' button but also shows a price number
                        if (!price) {
                            const priceAreaItems = Array.from(document.querySelectorAll('.infoItem, .infoDesc'));
                            for (let el of priceAreaItems) {
                                const txt = el.textContent || '';
                                // Match items that have both '전체가격보기' AND a price number - extract the price
                                if (txt.includes('전체가격보기') && txt.match(/[0-9,]{3,}원/)) {
                                    const priceMatch = txt.match(/([0-9,]{3,}원)/);
                                    if (priceMatch) {
                                        price = priceMatch[1];
                                        // Look for discount info too
                                        const discountMatch = txt.match(/(\d+)%/);
                                        const origMatch = txt.match(/([0-9,]{3,}원)\s*\n*\s*([0-9,]{3,}원)/);
                                        if (discountMatch) discount = discountMatch[1] + '%';
                                        if (origMatch) {
                                            const p1 = parseInt(origMatch[1].replace(/[^0-9]/g, ''));
                                            const p2 = parseInt(origMatch[2].replace(/[^0-9]/g, ''));
                                            if (p1 > p2) {
                                                originalPrice = origMatch[1];
                                                price = origMatch[2];
                                            } else if (p2 > p1) {
                                                originalPrice = origMatch[2];
                                                price = origMatch[1];
                                            }
                                        }
                                        break;
                                    }
                                }
                            }
                        }
                    }

                    // Ultimate Price Fallback: Search for ANY number + '원' in the entire body if still missing
                    if (!price || price === '가격정보없음') {
                        const allText = document.body.innerText;
                        // RegEx to look for "전석" or "정상가" or "판매가" etc near a price
                        const pricePattern = /(?:전석|정상가|판매가|일반)\s*(?:[:\s]|[^0-9])*([0-9,]{3,}원)/;
                        const match = allText.match(pricePattern);
                        if (match) price = match[1];
                    }

                    // --- 4. Address Extraction (Upgraded) ---
                    // ONLY look within venue-specific info sections, NOT global page elements
                    let address = '';
                    try {
                        // Strategy 0: JSON-LD (Most reliable structured data)
                        const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
                        for (const script of jsonLdScripts) {
                            try {
                                const data = JSON.parse(script.textContent || '{}');
                                // Could be an array or single object
                                const ds = Array.isArray(data) ? data : [data];
                                for (const d of ds) {
                                    if (d.location?.address?.streetAddress) {
                                        address = d.location.address.streetAddress;
                                        break;
                                    }
                                    if (d.address?.streetAddress) {
                                        address = d.address.streetAddress;
                                        break;
                                    }
                                }
                            } catch (e) { }
                            if (address) break;
                        }

                        // Strategy 1: Look for address ONLY within .infoPlace section
                        if (!address) {
                            const placeItem = document.querySelector('.infoItem.infoPlace, .infoPlace');
                            if (placeItem) {
                                const placeText = placeItem.textContent || '';
                                const addrMatch = placeText.match(/주소\s*[:\s]*([^\n]+)/);
                                if (addrMatch) {
                                    address = addrMatch[1].trim();
                                }
                            }
                        }

                        // Strategy 2: Look for address in structured info items with explicit '주소' label
                        if (!address) {
                            const infoItems = Array.from(document.querySelectorAll('.infoItem'));
                            for (const item of infoItems) {
                                const label = item.querySelector('.infoLabel')?.textContent?.trim() || '';
                                if (label.includes('장소') || label.includes('공연장')) {
                                    const desc = item.querySelector('.infoText, .infoDesc')?.textContent?.trim() || '';
                                    if (desc.length > 3 && desc.length < 100) {
                                        address = desc;
                                    }
                                    break;
                                }
                            }
                        }
                    } catch (e) { }

                    // Validate address: reject garbage, known bad fallbacks, and too-long strings
                    const KNOWN_BAD_ADDRS = ['용산구 후암로 97', '영등포구 문래로 180', '영등포구 당산로 83', 'NOL 티켓 파트너'];
                    if (address) {
                        const isTooLong = address.length > 120;
                        const isBadFallback = KNOWN_BAD_ADDRS.some(bad => address.includes(bad));
                        const isNotAddress = !/시|군|구|읍|면|동|로|길/.test(address);
                        if (isTooLong || isBadFallback || isNotAddress) {
                            address = '';
                        }
                    }

                    // 5. Booking Notice (New: Search in prdGuide or special notice areas)
                    let bookingNotice = '';
                    const inlineBookingNotice = document.querySelector('.prdContents.detail .content .contentDetailText')?.textContent?.trim() || '';
                    if (inlineBookingNotice && inlineBookingNotice.includes('예매가능시간')) {
                        bookingNotice = normalizeInlineText(inlineBookingNotice);
                    }
                    const guideItems = Array.from(document.querySelectorAll('.prdGuide strong'));
                    guideItems.forEach(strong => {
                        const title = strong.textContent?.trim() || '';
                        if (title.includes('티켓수령') || title.includes('예매취소') || title.includes('안내')) {
                            const parent = strong.parentElement;
                            if (parent) {
                                // Just get first few lines as a meaningful notice
                                bookingNotice = parent.innerText.split('\n').slice(0, 5).join('\n').trim();
                            }
                        }
                    });

                    // 6. Detailed Age Rule Extraction
                    let ageDetail = '';
                    const ageItems = Array.from(document.querySelectorAll('.prdGuide strong'));
                    ageItems.forEach(strong => {
                        if (strong.textContent?.includes('입장') || strong.textContent?.includes('관람')) {
                            const parent = strong.parentElement;
                            if (parent) {
                                ageDetail = parent.innerText.split('\n').slice(0, 3).join('\n').trim();
                            }
                        }
                    });

                    // 7. Structured Price List
                    const priceList: { label: string, price: string, discount?: string }[] = [];
                    const pItems = Array.from(document.querySelectorAll('.infoPriceList .infoPriceItem, .priceList .priceItem'));
                    pItems.forEach(item => {
                        const label = item.querySelector('.name, .type, .priceLabel')?.textContent?.trim() || '';
                        const priceV = item.querySelector('.price, .sale')?.textContent?.trim() || '';
                        const disc = item.querySelector('.rate, .discount')?.textContent?.trim() || '';
                        if (label && priceV) {
                            priceList.push({ label, price: priceV, discount: disc || undefined });
                        }
                    });

                    if (priceList.length === 0) {
                        const lines = bodyLines();
                        for (let i = 0; i < lines.length; i += 1) {
                            const inlineMatch = lines[i].match(/^(전석|일반석|R석|S석|A석|VIP석|스탠딩|지정석|자유석)\s+([0-9,]+원)/);
                            if (inlineMatch) {
                                priceList.push({ label: inlineMatch[1], price: inlineMatch[2] });
                                continue;
                            }

                            if (/^(전석|일반석|R석|S석|A석|VIP석|스탠딩|지정석|자유석)$/.test(lines[i])) {
                                const next = lines[i + 1] || '';
                                const priceMatch = next.match(/^([0-9,]+원)$/);
                                if (priceMatch) {
                                    priceList.push({ label: lines[i], price: priceMatch[1] });
                                }
                            }
                        }
                    }

                    if (!price && priceList.length > 0) {
                        price = priceList.map(item => `${item.label} ${item.price}`).join('\n');
                    }

                    const scheduleList = document.querySelector('.prdContents.detail .content .contentDetail .contentDetailList');
                    if (scheduleList) {
                        performanceTime = Array.from(scheduleList.querySelectorAll('li, div, p'))
                            .map(el => normalizeInlineText(el.textContent || ''))
                            .filter(line => line && !line.includes('예매가능시간'))
                            .join('\n');
                    }

                    const synopsis = document.querySelector('.prdContents.detail .content .contentDetailText, .prdContents.detail .content .contentDetail')?.textContent?.trim();
                    const synopsisImages = Array.from(document.querySelectorAll('.prdContents.detail .content .contentDetail img')).map(img => (img as HTMLImageElement).src);

                    const cast: string[] = [];
                    const castElements = Array.from(document.querySelectorAll('.prdCastItem .name, .castList .name, .prdCast .name, .prdCastList .castName, .castItem .name'));
                    castElements.forEach(el => {
                        const name = el.textContent?.trim();
                        if (name && !cast.includes(name)) {
                            cast.push(name);
                        }
                    });

                    if (cast.length === 0) {
                        const castImgs = Array.from(document.querySelectorAll('.prdCast img, .castList img, .castArea img'));
                        castImgs.forEach(img => {
                            const alt = img.getAttribute('alt')?.trim();
                            if (alt && !alt.includes('사진') && !alt.includes('프로필') && !cast.includes(alt)) {
                                cast.push(alt);
                            }
                        });
                    }

                    return { runningTime, performanceTime, ageRating, price, originalPrice, discount, address, priceList, ageDetail, bookingNotice, synopsis, synopsisImages, cast };
                });

                let { runningTime, performanceTime, ageRating, price, originalPrice, discount, address, priceList, ageDetail, bookingNotice, synopsis, synopsisImages, cast } = basicInfo;

                // 3. Click "Venue Info" Layer if address is missing
                if (!address) {
                    try {
                        const venueDetailBtn = await page.$('.infoItem.infoPlace .infoText a, .infoItem.infoPlace a[data-popup="info-place"], a[data-popup="popup-info-place"]');
                        if (venueDetailBtn) {
                            await venueDetailBtn.click();
                            await page.waitForSelector('.layerPopup, .popupLayer, .popVenueInfo, #popup-info-place', { visible: true, timeout: 3000 });

                            address = await page.evaluate(() => {
                                const popup = document.querySelector('.layerPopup, .popupLayer, .popVenueInfo, #popup-info-place') as HTMLElement;
                                if (!popup) return '';
                                const text = popup.innerText || '';
                                const match = text.match(/주소\s*[:\s]*(.*)/);
                                if (!match) return '';
                                const addr = match[1].split('\n')[0].trim();
                                // Validate popup address too
                                const BAD = ['용산구 후암로 97', '영등포구 문래로 180', '영등포구 당산로 83', 'NOL 티켓 파트너'];
                                if (addr.length > 120 || BAD.some(b => addr.includes(b))) return '';
                                return addr;
                            });
                        }
                    } catch (e) { }
                }

                // 3. Click Price Popup for Detailed Breakdown if basic info is insufficient
                // Only try if we don't have a discount but suspect there is one, or just to get the base General price.
                try {
                    // Update selector to support button or a tag
                    const priceBtn = await page.$('[data-popup="info-price"]');
                    if (priceBtn && (!price || price === '무료/이벤트' || price === '이벤트' || price === '가격정보없음' || !originalPrice)) {
                        await priceBtn.click();
                        await page.waitForSelector('.popPriceTable', { visible: true, timeout: 3000 });

                        const popupData = await page.evaluate(function () {
                            const rows = Array.from(document.querySelectorAll('.popPriceTable tbody tr'));
                            let prices: number[] = [];

                            rows.forEach(function (tr) {
                                const tds = tr.querySelectorAll('td');
                                const valStr = tds[tds.length - 1]?.textContent?.trim() || '';
                                const val = parseInt(valStr.replace(/[^0-9]/g, ''), 10);
                                if (!isNaN(val) && val > 0) prices.push(val);
                            });

                            // Simple logic: Max price = Original, Min price (if different) = Discounted
                            // This assumes the table lists BOTH standard and discounted prices.
                            // If it only lists the final price, we can't derive discount here.
                            if (prices.length > 0) {
                                const max = Math.max(...prices);
                                const min = Math.min(...prices);
                                return { max, min, hasDiff: max !== min };
                            }
                            return null;
                        });

                        if (popupData) {
                            if (!price) price = popupData.min.toLocaleString() + '원';

                            // Only infer discount if we found a spread and didn't have specific discount info yet
                            if (popupData.hasDiff && !originalPrice) {
                                originalPrice = popupData.max.toLocaleString() + '원';
                                const rateVal = Math.round((1 - (popupData.min / popupData.max)) * 100);
                                discount = `${rateVal}%`;
                            }
                        }
                    }
                } catch (e) {
                    // Ignore popup errors
                }

                return {
                    ...item,
                    runningTime,
                    performanceTime,
                    ageRating,
                    price,
                    originalPrice,
                    discount,
                    address,
                    priceList,
                    ageDetail,
                    bookingNotice,
                    synopsis,
                    description: synopsis,
                    synopsisImages,
                    cast: cast.length > 0 ? cast : undefined,
                    lastEnriched: new Date().toISOString()
                };

            } catch (e) {
                console.error(`Failed to enrich ${item.id}:`, e);
                const existing = existingEnriched.get(item.id);
                return existing ? { ...existing, ...item } : item;
            } finally {
                await page.close().catch(() => undefined);
            }
        }

        const results = await Promise.all(promises);
        enrichedResult.push(...results);
        if (enrichQueue.length > 0) bar.increment(results.length);

        // Autosave every 20 items (4 chunks)
        if (i % 20 === 0 || i + CONCURRENCY >= enrichQueue.length) {
            const currentSave = [...enrichedResult, ...others];
            // Note: 'others' might have items that are in 'existingEnriched' but we filtered 'others' by genre.
            // If non-musical items were in 'existing', they are not in 'targets'. They are in 'others'.
            // So we just save 'enrichedResult' + 'others'.
            atomicWriteJson(outputPath, currentSave);
        }
    }
    if (enrichQueue.length > 0) bar.stop();

    // Final merge
    const finalItems = [...enrichedResult, ...others];
    return finalItems;
}

const runScraper = async () => {
    console.log('Starting Interpark Scraper (TS) with Resume...');

    const outputPath = path.resolve(process.cwd(), 'src/data/interpark.json');

    // 0. Load existing data
    const existingMap = new Map<string, Performance>();
    if (fs.existsSync(outputPath)) {
        try {
            const raw = fs.readFileSync(outputPath, 'utf-8');
            const data = JSON.parse(raw) as Performance[];
            data.forEach(d => existingMap.set(d.id, d));
            console.log(`Loaded ${data.length} existing items for resume check.`);
        } catch (e) { console.log('No existing data or parse error.'); }
    }

    // 1. Collect list from legacy ASP regions (if alive) + NOL ranking/genre catalog
    //    + carry-forward of existing goods codes. Old TPRegionReserve.asp now 301s to NOL,
    //    so regional/family long-tail shows would otherwise disappear from future crawls.
    const uniqueItems = await collectAllInterparkPerformances(existingMap);
    console.log(`Found ${uniqueItems.length} total items. Enriching Items...`);

    // 2a. Fast JSON API enrichment (price/age/runtime + session schedule).
    await enrichViaInterparkApi(uniqueItems, existingMap);
    // Persist list + API enrichment right away so a later browser hang cannot lose it.
    atomicWriteJsonPreserve(outputPath, uniqueItems.map((item) => mergeWithExisting(item, existingMap)), {
        allowEmpty: process.env.SCRAPE_ALLOW_EMPTY === '1',
        label: 'interpark.json',
    });

    // 2b. Browser enrichment (synopsis/cast/etc). Skipped when INTERPARK_ENRICH_LIMIT=0.
    const useBrowser = INTERPARK_ENRICH_LIMIT > 0 && !isRunBudgetExhausted(60000);
    const browser = useBrowser
        ? await puppeteer.launch({
            headless: true,
            protocolTimeout: INTERPARK_PROTOCOL_TIMEOUT_MS,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        })
        : null;
    if (!useBrowser) console.log('[interpark] browser enrichment skipped (limit 0 or run budget reached).');

    try {
        const finalItems = (await scrapeDetails(browser, uniqueItems, existingMap))
            .map((item) => reapplyApiFields(item, existingMap));

        // 3. Final Save
        atomicWriteJsonPreserve(outputPath, finalItems, { allowEmpty: process.env.SCRAPE_ALLOW_EMPTY === '1', label: 'interpark.json' });
        console.log(`Saved ${finalItems.length} items to ${outputPath}`);

    } finally {
        if (browser) await browser.close();
    }
};

function mergeWithExisting(item: Performance, existingMap: Map<string, Performance>): Performance {
    const existing = existingMap.get(item.id);
    return existing ? { ...existing, ...item } : item;
}

function hasUsefulPriceValue(item: Partial<Performance>) {
    if (Array.isArray(item.priceList) && item.priceList.length > 0) return true;
    return Boolean(item.price && /[0-9]/.test(item.price) && !['무료/이벤트', '이벤트', '가격정보없음'].includes(item.price));
}

/** Browser results are built from the list item; carry API-only fields over. */
function reapplyApiFields(item: Performance, existingMap: Map<string, Performance>): Performance {
    const existing = existingMap.get(item.id);
    if (!existing) return item;
    const next: Performance = { ...item };
    if (existing.sessions) {
        next.sessions = existing.sessions;
        next.sessionsCheckedAt = existing.sessionsCheckedAt;
    }
    if (!hasUsefulPriceValue(next) && hasUsefulPriceValue(existing)) {
        next.price = existing.price;
        next.priceList = existing.priceList;
    }
    if (!next.ageRating && existing.ageRating) next.ageRating = existing.ageRating;
    if (!next.runningTime && existing.runningTime) next.runningTime = existing.runningTime;
    if (!next.performanceTime && existing.performanceTime) next.performanceTime = existing.performanceTime;
    if (existing.lastApiEnriched) next.lastApiEnriched = existing.lastApiEnriched;
    return next;
}

function kstMidnight(offsetDays = 0) {
    const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    return new Date(`${ymd}T00:00:00+09:00`).getTime() + offsetDays * 86400000;
}

function parseDateWindow(date?: string) {
    const matches = [...String(date || '').matchAll(/(20\d{2})[.-](\d{1,2})[.-](\d{1,2})/g)];
    if (matches.length === 0) return { start: null as number | null, end: null as number | null };
    const toTs = (m: RegExpMatchArray) => new Date(`${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}T00:00:00+09:00`).getTime();
    return { start: toTs(matches[0]), end: toTs(matches[matches.length - 1]) };
}

function extendDateRangeToSessions(date: string | undefined, sessions: InterparkSession[]): string | null {
    if (!date || sessions.length === 0) return null;
    const matches = [...date.matchAll(/(20\d{2})[.-](\d{1,2})[.-](\d{1,2})/g)];
    if (matches.length === 0) return null;
    const last = matches[matches.length - 1];
    const currentEnd = `${last[1]}-${last[2].padStart(2, '0')}-${last[3].padStart(2, '0')}`;
    const lastSession = sessions[sessions.length - 1].date;
    if (!lastSession || lastSession <= currentEnd) return null;
    const startText = matches[0][0];
    return `${startText.replace(/-/g, '.')} ~ ${lastSession.replace(/-/g, '.')}`;
}

async function enrichViaInterparkApi(items: Performance[], existingMap: Map<string, Performance>) {
    if (INTERPARK_API_ENRICH_LIMIT <= 0 && INTERPARK_SESSION_LIMIT <= 0) return;
    const today = kstMidnight();
    const sessionHorizon = kstMidnight(INTERPARK_SESSION_WINDOW_DAYS);
    const liveGenres = new Set(['musical', 'play', 'concert', 'classic', 'leisure', 'exhibition', 'etc']);
    const hoursSince = (iso?: string) => (iso ? (Date.now() - new Date(iso).getTime()) / 36e5 : Infinity);

    type Candidate = { item: Performance; code: string; start: number; merged: Performance };
    const candidates: Candidate[] = [];
    for (const item of items) {
        const code = extractGoodsCode(item.link);
        if (!code || !liveGenres.has(item.genre)) continue;
        const merged = mergeWithExisting(item, existingMap);
        const { start, end } = parseDateWindow(merged.date);
        if (end !== null && end < today) continue; // already finished
        candidates.push({ item, code, start: start ?? Number.MAX_SAFE_INTEGER, merged });
    }
    candidates.sort((a, b) => a.start - b.start);

    const needsDetails = (c: Candidate) => (
        (!hasUsefulPriceValue(c.merged) || !c.merged.ageRating || !c.merged.runningTime)
        && hoursSince(c.merged.lastApiEnriched) > 72
    );
    const needsSessions = (c: Candidate) => c.start <= sessionHorizon && hoursSince(c.merged.sessionsCheckedAt) > 18;

    const detailIds = new Set(candidates.filter(needsDetails).slice(0, Math.max(0, INTERPARK_API_ENRICH_LIMIT)).map((c) => c.item.id));
    const sessionIds = new Set(candidates.filter(needsSessions).slice(0, Math.max(0, INTERPARK_SESSION_LIMIT)).map((c) => c.item.id));
    const queue = candidates.filter((c) => detailIds.has(c.item.id) || sessionIds.has(c.item.id));
    console.log(`[interpark-api] candidates=${candidates.length} details=${detailIds.size} sessions=${sessionIds.size} (delay ${INTERPARK_API_DELAY_MS}ms, concurrency ${INTERPARK_API_CONCURRENCY})`);

    let cursor = 0;
    let done = 0;
    let filled = 0;
    let sessionHits = 0;
    let apiUnavailable = false;
    const worker = async () => {
        while (cursor < queue.length) {
            if (isRunBudgetExhausted(30000)) return;
            // If the API refuses this network outright (seen on GitHub-hosted runners),
            // stop early instead of spending minutes on guaranteed failures.
            if (done >= 30 && !(getInterparkApiStats()['200'] > 0)) {
                if (!apiUnavailable) console.warn(`[interpark-api] no successful responses after ${done} item(s); stopping API enrichment for this run. stats=${JSON.stringify(getInterparkApiStats())}`);
                apiUnavailable = true;
                return;
            }
            const c = queue[cursor++];
            const wantDetails = detailIds.has(c.item.id);
            const wantSessions = sessionIds.has(c.item.id);
            const api = await fetchInterparkApiEnrichment(c.code, {
                details: wantDetails,
                sessions: wantSessions,
                delayMs: INTERPARK_API_DELAY_MS,
                lookaheadDays: INTERPARK_SESSION_LOOKAHEAD_DAYS,
            });
            const base = existingMap.get(c.item.id) || { ...c.item };
            const next: Performance = { ...base };
            if (wantDetails) {
                if (!hasUsefulPriceValue(next) && api.priceList?.length) {
                    next.price = api.price;
                    next.priceList = api.priceList;
                }
                if (!next.ageRating && api.ageRating) next.ageRating = api.ageRating;
                if (!next.runningTime && api.runningTime) next.runningTime = api.runningTime;
                if (!next.performanceTime && api.performanceTime) next.performanceTime = api.performanceTime;
                next.lastApiEnriched = new Date().toISOString();
                if (api.priceList?.length || api.ageRating || api.runningTime) filled += 1;
            }
            if (wantSessions && api.sessions) {
                next.sessions = api.sessions;
                next.sessionsCheckedAt = api.sessionsCheckedAt;
                if (api.sessions.length > 0) sessionHits += 1;
                // Open-run shows are often extended after the listing date was
                // scraped; trust the official session schedule for the end date.
                const extendedDate = extendDateRangeToSessions(next.date, api.sessions);
                if (extendedDate) next.date = extendedDate;
            }
            existingMap.set(c.item.id, next);
            done += 1;
            if (done % 50 === 0) console.log(`[interpark-api] progress ${done}/${queue.length}`);
            await new Promise((resolve) => setTimeout(resolve, INTERPARK_API_DELAY_MS));
        }
    };
    await Promise.all(Array.from({ length: INTERPARK_API_CONCURRENCY }, () => worker()));
    console.log(`[interpark-api] processed ${done}/${queue.length}; detail fields filled for ${filled}, sessions found for ${sessionHits}; http=${JSON.stringify(getInterparkApiStats())}`);
}

runScraper().then(() => {
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
