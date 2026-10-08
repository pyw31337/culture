/**
 * 국가유산청 국가유산 활용 행사 (k-skill korean-heritage-search)
 *
 *   GET https://www.khs.go.kr/cha/openapi/selectEventListOpenapi.do?searchYear=YYYY&searchMonth=M
 *   → <result><item><subTitle/><subContent/><sDate/><eDate/><subDate/><sido/><gugun/>
 *        <subDesc/><groupName/><subDesc_2/><subDesc_3/><contact/><subPath/></item>…</result>
 *
 * Fetches the current and next month (KST) and writes src/data/heritage-events.json.
 * No API key. The host blocks many foreign IPs, so this runs in the LOCAL pipeline only.
 * Only API-provided values are stored: fee/audience/contact are copied verbatim when
 * present and never guessed; operating hours are not provided by the API and are omitted.
 */
import path from 'path';
import crypto from 'crypto';
import { XMLParser } from 'fast-xml-parser';
import { atomicWriteJsonPreserve } from './utils/scraper-utils';
import { normalizeRegionId } from '../src/lib/region-normalize';

const EVENT_URL = process.env.HERITAGE_EVENT_URL || 'https://www.khs.go.kr/cha/openapi/selectEventListOpenapi.do';
const OFFICIAL_LIST_URL = 'https://www.khs.go.kr/main.html';
const OUTPUT_PATH = path.join(process.cwd(), 'src/data/heritage-events.json');
const MONTHS_AHEAD = Math.max(1, Math.min(3, Number(process.env.HERITAGE_MONTHS || 2)));
// khs.go.kr answers slowly even from Korea (~19s observed from the Mac mini on
// 2026-10-08), so the old 20s timeout was right at the edge.
const TIMEOUT_MS = Number(process.env.HERITAGE_TIMEOUT_MS || 60000);
const MONTH_ATTEMPTS = Math.max(1, Number(process.env.HERITAGE_MONTH_ATTEMPTS || 3));
const USER_AGENT = 'Mozilla/5.0 (compatible; CultureFlowBot/1.0; +https://pyw31337.github.io/culture/)';

const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true });

interface HeritageEventRecord {
    id: string;
    title: string;
    date: string;
    venue: string;
    address?: string;
    region?: string;
    link: string;
    genre: 'festival';
    category: string;
    source: 'heritage';
    description?: string;
    price?: string;
    targetAudience?: string;
    organizer?: string;
    contact?: string;
    dataCollectedAt: string;
}

function cleanText(value: unknown): string {
    if (value === undefined || value === null) return '';
    return String(value)
        .replace(/&nbsp;/gi, ' ')
        .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&amp;/gi, '&')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/?(?:p|div|li|ul|ol|h[1-6])[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/[ \t\f\v]+/g, ' ')
        .replace(/\n\s+/g, '\n')
        .trim();
}

function toDotDate(value: string): string | null {
    const match = value.match(/(20\d{2})[-.\/]?(\d{1,2})[-.\/]?(\d{1,2})/);
    if (!match) return null;
    return `${match[1]}.${match[2].padStart(2, '0')}.${match[3].padStart(2, '0')}`;
}

function kstYearMonth(offset: number) {
    const now = new Date(Date.now() + 9 * 3600 * 1000);
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
    return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

async function fetchMonthWithRetry(year: number, month: number): Promise<Record<string, unknown>[]> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MONTH_ATTEMPTS; attempt++) {
        try {
            return await fetchMonth(year, month);
        } catch (error) {
            lastError = error;
            if (attempt < MONTH_ATTEMPTS) {
                console.warn(`[heritage] ${year}-${month} attempt ${attempt} failed; retrying`);
                await new Promise((resolve) => setTimeout(resolve, 3000 * attempt));
            }
        }
    }
    throw lastError;
}

async function fetchMonth(year: number, month: number): Promise<Record<string, unknown>[]> {
    const url = `${EVENT_URL}?searchYear=${year}&searchMonth=${month}`;
    const response = await fetch(url, {
        headers: { Accept: 'application/xml', 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    const xml = await response.text();
    const parsed = parser.parse(xml) as { result?: { item?: unknown } };
    if (!parsed?.result) throw new Error(`unexpected XML root for ${url}`);
    const items = parsed.result.item;
    if (!items) return [];
    return (Array.isArray(items) ? items : [items]) as Record<string, unknown>[];
}

function toRecord(item: Record<string, unknown>, collectedAt: string): HeritageEventRecord | null {
    const title = cleanText(item.subTitle);
    if (!title) return null;
    const start = toDotDate(cleanText(item.sDate));
    const end = toDotDate(cleanText(item.eDate)) || start;
    const displayDate = cleanText(item.subDate);
    const date = start ? (end && end !== start ? `${start} ~ ${end}` : start) : displayDate;
    if (!date) return null;

    const sido = cleanText(item.sido);
    const gugun = cleanText(item.gugun);
    const venue = cleanText(item.subDesc) || [sido, gugun].filter(Boolean).join(' ');
    const address = [sido, gugun].filter(Boolean).join(' ') || undefined;
    const rawLink = cleanText(item.subPath);
    const link = /^https?:\/\//i.test(rawLink) ? rawLink : OFFICIAL_LIST_URL;
    const id = `heritage_${crypto.createHash('sha1').update(`${title}|${start || displayDate}|${venue}`).digest('hex').slice(0, 16)}`;

    const record: HeritageEventRecord = {
        id,
        title,
        date,
        venue: venue || '장소 확인 필요',
        address,
        region: normalizeRegionId(sido) || undefined,
        link,
        genre: 'festival',
        category: '국가유산 행사',
        source: 'heritage',
        dataCollectedAt: collectedAt,
    };
    const description = cleanText(item.subContent);
    if (description) record.description = description.slice(0, 2000);
    const fee = cleanText(item.subDesc_3);
    if (fee) record.price = fee; // verbatim from the API only
    const audience = cleanText(item.subDesc_2);
    if (audience) record.targetAudience = audience;
    const organizer = cleanText(item.groupName);
    if (organizer) record.organizer = organizer;
    const contact = cleanText(item.contact);
    if (contact) record.contact = contact;
    return record;
}

async function main() {
    const collectedAt = new Date().toISOString();
    const byId = new Map<string, HeritageEventRecord>();
    let fetchedMonths = 0;
    for (let offset = 0; offset < MONTHS_AHEAD; offset++) {
        const { year, month } = kstYearMonth(offset);
        try {
            const items = await fetchMonthWithRetry(year, month);
            fetchedMonths++;
            items.forEach((item) => {
                const record = toRecord(item, collectedAt);
                if (record) byId.set(record.id, record);
            });
            console.log(`[heritage] ${year}-${String(month).padStart(2, '0')}: ${items.length} items`);
        } catch (error) {
            console.error(`[heritage] ${year}-${month} failed: ${error instanceof Error ? error.message : String(error)}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
    }

    if (fetchedMonths === 0) {
        // Keep the previous file (atomicWriteJsonPreserve also refuses empty overwrites).
        console.error('[heritage] khs.go.kr unreachable (foreign IPs are often blocked). Previous data retained.');
        process.exit(1);
    }
    if (fetchedMonths < MONTHS_AHEAD) {
        // A partial pull would silently drop a whole month; keep the previous file.
        console.error(`[heritage] only ${fetchedMonths}/${MONTHS_AHEAD} month(s) fetched. Previous data retained.`);
        process.exit(1);
    }

    const todayKey = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, '.');
    const records = [...byId.values()]
        .filter((record) => {
            const end = record.date.split('~').pop()?.trim() || '';
            return !/^20\d{2}\.\d{2}\.\d{2}$/.test(end) || end >= todayKey;
        })
        .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'ko'));
    const result = atomicWriteJsonPreserve(OUTPUT_PATH, records, { label: 'heritage-events.json' });
    console.log(`[heritage] saved ${records.length} events → ${OUTPUT_PATH}`, result);
}

main().catch((error) => {
    console.error('[heritage] fatal:', error);
    process.exit(1);
});
