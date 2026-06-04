import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import fs from 'fs';
import path from 'path';
import { normalizeImageUrl } from '../src/lib/utils';

// --- Configuration ---
const API_KEY = process.env.KOPIS_API_KEY || 'ba7dc8feda8a4e66a90e43fcdb03c35a'; // Fallback for local run without .env
const BASE_URL = 'http://www.kopis.or.kr/openApi/restful';
const DATA_DIR = path.join(process.cwd(), 'src/data');
const VENUE_FILE = path.join(DATA_DIR, 'venues.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'kopis-performances.json');
const RATE_LIMIT_DELAY = 150; // ms between requests
const DETAIL_LIMIT = Number.parseInt(process.env.KOPIS_DETAIL_LIMIT || '0', 10);
const VENUE_LIMIT = Number.parseInt(process.env.KOPIS_VENUE_LIMIT || '0', 10);
const RUN_BUDGET_SECONDS = Number.parseInt(process.env.KOPIS_RUN_BUDGET_SECONDS || '0', 10);
const LOOKBACK_DAYS = Number.parseInt(process.env.KOPIS_LOOKBACK_DAYS || '0', 10);
const REQUEST_RETRIES = Number.parseInt(process.env.KOPIS_REQUEST_RETRIES || '3', 10);
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.KOPIS_REQUEST_TIMEOUT_MS || '15000', 10);
const scraperStartedAt = Date.now();
let budgetWarningPrinted = false;

const parser = new XMLParser();

// --- Types ---
interface KopisPerformance {
    id: string;
    title: string;
    image: string;
    date: string;
    venue: string;
    venueId?: string;
    link: string;
    genre: string;
    price: string;
    time?: string;
    region?: string;
    lat?: number;
    lng?: number;
    address?: string;
    source: 'kopis';
    isFestival?: boolean;
    backupPoster?: string;
    cast?: string[];
    crew?: string[];
    runtime?: string;
    age?: string;
    production?: string;
    host?: string;
    organizer?: string;
    planner?: string;
    producer?: string;
    sponsor?: string;
    priceList?: { label: string; price: string; discount?: string }[];
    ageDetail?: string;
    bookingNotice?: string;
    synopsis?: string;
    description?: string;
    synopsisImages?: string[];
    openRun?: boolean;
    performanceState?: string;
    lastModifiedAt?: string;
    dataCollectedAt?: string;
    venueFacilityType?: string;
    venueSeatScale?: string | number;
    venueTheaterCount?: string | number;
    venuePhone?: string;
    venueHomepage?: string;
    venueAmenities?: string[];
    parking?: string;
    restrooms?: string;
    facilities?: string;
}

interface VenueInfo {
    name: string;
    address: string;
    lat: number;
    lng: number;
    district?: string;
    mapped_region_id?: string;
    phone?: string;
    homepage?: string;
    facilityType?: string;
    seatScale?: string | number;
    theaterCount?: string | number;
    openedAt?: string;
    amenities?: string[];
    parking?: string;
    restrooms?: string;
    facilities?: string;
}

// --- Utils ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const isUseless = (s: string) => !s || typeof s !== 'string' || s.trim() === '' || s.includes('해당정보') || s === '없음';

const cleanText = (value: unknown) => {
    if (value === undefined || value === null) return '';
    return String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
};

const firstUseful = (...values: unknown[]) => {
    for (const value of values) {
        const text = cleanText(value);
        if (text && !isUseless(text)) return text;
    }
    return '';
};

const splitPeople = (value: unknown) => {
    const text = firstUseful(value);
    if (!text) return undefined;

    const people = text
        .split(/[,，ㆍ·/|]|(?:\s{2,})|(?:\n+)/)
        .map((item) => item
            .replace(/\([^)]*\)/g, '')
            .replace(/\s*(?:등|외\s*\d*명?)$/u, '')
            .trim()
        )
        .filter((item) => item && !isUseless(item));

    return people.length > 0 ? [...new Set(people)].slice(0, 16) : undefined;
};

const parsePriceList = (value: unknown) => {
    const text = firstUseful(value);
    if (!text) return undefined;

    const parts = text
        .replace(/[\uff0c\u3001]/g, ',')
        .replace(/\r/g, '\n')
        .split(/\n+|(?<=원)\s*,\s*/)
        .map((part) => part.trim())
        .filter(Boolean);

    const rows = parts.map((part) => {
        const priceMatch = part.match(/((?:\d{1,3},)*\d{1,3}|무료)\s*원?/);
        if (!priceMatch) return null;
        const label = part.slice(0, priceMatch.index).replace(/[:：-]\s*$/, '').trim() || '기본';
        const price = priceMatch[0].includes('무료') ? '무료' : `${priceMatch[1]}원`;
        return { label, price };
    }).filter((row): row is { label: string; price: string } => Boolean(row));

    return rows.length > 0 ? rows : undefined;
};

const collectAmenities = (vdb: Record<string, unknown>) => {
    const amenities: string[] = [];
    const maybePush = (field: string, label: string) => {
        const value = firstUseful(vdb[field]);
        if (value && !/N|없음|무/i.test(value)) amenities.push(label);
    };

    maybePush('restaurant', '식당');
    maybePush('cafe', '카페');
    maybePush('store', '편의점');
    maybePush('nolibang', '놀이방');
    maybePush('suyu', '수유실');
    maybePush('parkbarrier', '장애인 주차');
    maybePush('restbarrier', '장애인 화장실');
    maybePush('runwbarrier', '장애인 경사로');
    maybePush('elevbarrier', '엘리베이터');
    return [...new Set(amenities)];
};

const hasRichKopisDetails = (item?: KopisPerformance) => Boolean(
    item &&
    item.venueId &&
    item.synopsisImages &&
    item.synopsisImages.length > 0 &&
    (
        item.runtime ||
        item.age ||
        (item.cast && item.cast.length > 0) ||
        item.production ||
        item.host ||
        item.organizer ||
        item.priceList ||
        item.performanceState
    )
);

const isBudgetExceeded = () => {
    if (RUN_BUDGET_SECONDS <= 0) return false;
    const exceeded = Date.now() - scraperStartedAt >= RUN_BUDGET_SECONDS * 1000;
    if (exceeded && !budgetWarningPrinted) {
        budgetWarningPrinted = true;
        console.warn(`\n⏱️ KOPIS run budget reached (${RUN_BUDGET_SECONDS}s). Saving progress and exiting cleanly.`);
    }
    return exceeded;
};

async function fetchWithRetry(url: string, params: any, retries = REQUEST_RETRIES): Promise<any> {
    for (let i = 0; i < retries; i++) {
        if (isBudgetExceeded()) throw new Error('KOPIS_RUN_BUDGET_EXCEEDED');
        try {
            const response = await axios.get(url, { params, timeout: REQUEST_TIMEOUT_MS });
            return response.data;
        } catch (e: any) {
            if (i === retries - 1) throw e;
            console.warn(`\nRetrying ${url} (${i + 1}/${retries})... Error: ${e.message}`);
            await delay((1000 * (2 ** i)) + Math.floor(Math.random() * 400));
        }
    }
}

function safeWrite(filePath: string, data: any) {
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
    fs.renameSync(tmpPath, filePath);
}

// --- Main Logic ---
async function scrapeKopis() {
    console.log("🚀 Starting Optimized KOPIS Scraper...");
    
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    // 1. Load Caches
    let venues: Record<string, VenueInfo> = {};
    if (fs.existsSync(VENUE_FILE)) {
        try {
            venues = JSON.parse(fs.readFileSync(VENUE_FILE, 'utf-8'));
        } catch (e) {}
    }

    let existingItems: KopisPerformance[] = [];
    if (fs.existsSync(OUTPUT_FILE)) {
        try {
            existingItems = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
        } catch (e) {}
    }

    let allItems: KopisPerformance[] = existingItems;
    const uniqueVenueIds = new Set<string>();
    
    // Initial scan for missing venues
    existingItems.forEach(it => {
        const v = it.venueId ? venues[it.venue] : null;
        if (it.venueId && (!v || !v.phone || !v.homepage || !v.lat || !v.facilityType || !v.seatScale || !v.amenities)) {
            uniqueVenueIds.add(it.venueId);
        }
    });

    const enrichVenues = async () => {
        if (uniqueVenueIds.size === 0) return;
        console.log(`\n🏠 Enriching ${uniqueVenueIds.size} unique venues...`);
        let venueUpdateCount = 0;
        const ids = Array.from(uniqueVenueIds);
        uniqueVenueIds.clear();

        for (const vid of ids) {
            if (isBudgetExceeded()) break;
            if (VENUE_LIMIT > 0 && venueUpdateCount >= VENUE_LIMIT) {
                console.log(`\n⏸️ Venue enrichment limit reached (${VENUE_LIMIT}). Remaining venues will continue next run.`);
                break;
            }
            try {
                process.stdout.write(`v`);
                await delay(RATE_LIMIT_DELAY);
                const vXml = await fetchWithRetry(`${BASE_URL}/prfplc/${vid}`, { service: API_KEY });
                const vObj = parser.parse(vXml);
                const vdb = vObj.dbs?.db;

                if (vdb && vdb.la && vdb.lo) {
                    const phone = !isUseless(vdb.telno) ? vdb.telno : (venues[vdb.fcltynm]?.phone);
                    const homepage = !isUseless(vdb.relateurl) ? vdb.relateurl : (venues[vdb.fcltynm]?.homepage);
                    const amenities = collectAmenities(vdb);
                    const parking = firstUseful(vdb.parkinglot);
                    const restrooms = [
                        firstUseful(vdb.restbarrier) ? '장애인 화장실' : '',
                        firstUseful(vdb.suyu) ? '수유실' : '',
                    ].filter(Boolean).join(', ');
                    const facilities = [
                        firstUseful(vdb.fcltychartr),
                        amenities.length > 0 ? amenities.join(', ') : '',
                    ].filter(Boolean).join(' · ');

                    const venueData = {
                        name: vdb.fcltynm,
                        address: vdb.adres || '',
                        lat: parseFloat(vdb.la),
                        lng: parseFloat(vdb.lo),
                        district: (vdb.adres || '').split(' ')[1],
                        phone,
                        homepage,
                        facilityType: firstUseful(vdb.fcltychartr),
                        seatScale: firstUseful(vdb.seatscale),
                        theaterCount: firstUseful(vdb.mt13cnt),
                        openedAt: firstUseful(vdb.opende),
                        amenities,
                        parking,
                        restrooms,
                        facilities,
                    };

                    // Save canonical
                    venues[vdb.fcltynm] = venueData;

                    // Propagate to variants
                    Object.keys(venues).forEach(vkey => {
                        if (vkey.startsWith(vdb.fcltynm) || vdb.fcltynm.startsWith(vkey)) {
                            const vcache = venues[vkey];
                            if (phone && !vcache.phone) vcache.phone = phone;
                            if (homepage && !vcache.homepage) vcache.homepage = homepage;
                            if (!vcache.lat) vcache.lat = venueData.lat;
                            if (!vcache.lng) vcache.lng = venueData.lng;
                            if (venueData.facilityType && !vcache.facilityType) vcache.facilityType = venueData.facilityType;
                            if (venueData.seatScale && !vcache.seatScale) vcache.seatScale = venueData.seatScale;
                            if (venueData.theaterCount && !vcache.theaterCount) vcache.theaterCount = venueData.theaterCount;
                            if (venueData.openedAt && !vcache.openedAt) vcache.openedAt = venueData.openedAt;
                            if (venueData.amenities.length > 0 && !vcache.amenities) vcache.amenities = venueData.amenities;
                            if (venueData.parking && !vcache.parking) vcache.parking = venueData.parking;
                            if (venueData.restrooms && !vcache.restrooms) vcache.restrooms = venueData.restrooms;
                            if (venueData.facilities && !vcache.facilities) vcache.facilities = venueData.facilities;
                        }
                    });

                    venueUpdateCount++;
                    if (venueUpdateCount % 20 === 0) {
                        safeWrite(VENUE_FILE, venues);
                        process.stdout.write(`(s)`);
                    }
                }
            } catch (e) {
                process.stdout.write(`e`);
            }
        }
        safeWrite(VENUE_FILE, venues);
        console.log(`\n✅ Updated ${venueUpdateCount} venues.`);
    };

    // Phase 1: Initial Venue Enrichment
    await enrichVenues();

    // Phase 2: Live Performances
    const today = new Date();
    const stdate = today.toISOString().split('T')[0].replace(/-/g, '');
    const performanceStart = new Date(today);
    if (LOOKBACK_DAYS > 0) performanceStart.setDate(performanceStart.getDate() - LOOKBACK_DAYS);
    const performanceStdate = LOOKBACK_DAYS > 0
        ? performanceStart.toISOString().split('T')[0].replace(/-/g, '')
        : '20230101';
    const futureLimit = new Date();
    futureLimit.setFullYear(futureLimit.getFullYear() + 1);
    const eddate = futureLimit.toISOString().split('T')[0].replace(/-/g, '');

    const fetchList = async (endpoint: string, isFestival = false): Promise<boolean> => {
        let detailFetchCount = 0;
        const states = isFestival ? ['01', '02', '03', '04'] : ['02', '01']; 
        for (const state of states) {
            let page = 1;
            let hasMore = true;
            while (hasMore) {
                if (isBudgetExceeded()) {
                    safeWrite(OUTPUT_FILE, allItems);
                    return false;
                }
                console.log(`Fetching ${isFestival ? 'Festival' : 'Performance'} State ${state} Page ${page}...`);
                const xmlData = await fetchWithRetry(`${BASE_URL}/${endpoint}`, {
                    service: API_KEY,
                    stdate: isFestival ? stdate : performanceStdate,
                    eddate,
                    cpage: page,
                    rows: 100,
                    prfstate: state
                });

                const jsonObj = parser.parse(xmlData);
                const dbs = jsonObj.dbs?.db;
                if (!dbs) break;

                const list = Array.isArray(dbs) ? dbs : [dbs];
                for (const item of list) {
                    if (isBudgetExceeded()) {
                        safeWrite(OUTPUT_FILE, allItems);
                        return false;
                    }
                    const mt20id = item.mt20id;
                    const fullId = `kopis_${mt20id}`;
                    
                    const existing = existingItems.find(it => it.id === fullId);
                    if (existing && hasRichKopisDetails(existing) && process.env.KOPIS_FORCE_DETAIL_REFRESH !== '1') {
                        process.stdout.write(`s`);
                        continue;
                    }

                    try {
                        if (DETAIL_LIMIT > 0 && detailFetchCount >= DETAIL_LIMIT) {
                            console.log(`\n⏸️ Detail enrichment limit reached (${DETAIL_LIMIT}). Remaining performances will continue next run.`);
                            safeWrite(OUTPUT_FILE, allItems);
                            return true;
                        }
                        detailFetchCount++;
                        process.stdout.write(`.`);
                        await delay(RATE_LIMIT_DELAY);
                        const detailXml = await fetchWithRetry(`${BASE_URL}/pblprfr/${mt20id}`, { service: API_KEY });
                        const db = parser.parse(detailXml).dbs?.db;

                        if (db) {
                            const cleanPrice = (s: string) => {
                                if (isUseless(s)) return '정보없음';
                                let res = s.replace(/[\uff0c\u3001\n\r\t]/g, ',').replace(/\s+/g, ' ');
                                return res.split(/(?<=원)\s*,\s*/).map(p => p.trim()).filter(p => p).join('\n');
                            };
                            const cast = splitPeople(db.prfcast);
                            const crew = splitPeople(db.prfcrew);
                            const producer = firstUseful(db.entrpsnmP, db.producer);
                            const planner = firstUseful(db.entrpsnmA, db.planner);
                            const host = firstUseful(db.entrpsnmH, db.host);
                            const organizer = firstUseful(db.entrpsnmS, db.organizer);
                            const sponsor = firstUseful(db.sponsor, db.entrpsnmSponsor);
                            const runtime = firstUseful(db.prfruntime, db.runtime);
                            const age = firstUseful(db.prfage, db.age);
                            const performanceState = firstUseful(db.prfstate, item.prfstate);
                            const priceList = parsePriceList(db.pcseguidance);
                            const currentVenue = venues[db.fcltynm] || venues[item.fcltynm];
                            const poster = normalizeImageUrl(firstUseful(db.poster));
                            const synopsisImages = db.styurls?.styurl
                                ? (Array.isArray(db.styurls.styurl) ? db.styurls.styurl : [db.styurls.styurl])
                                    .map((url: unknown) => normalizeImageUrl(firstUseful(url)))
                                    .filter(Boolean)
                                : undefined;

                            const perf: KopisPerformance = {
                                id: fullId,
                                title: db.prfnm,
                                image: poster,
                                backupPoster: poster,
                                date: `${db.prfpdfrom} ~ ${db.prfpdto}`,
                                venue: db.fcltynm,
                                venueId: db.mt10id,
                                link: `https://www.kopis.or.kr/por/db/pblprfr/pblprfrView.do?menuId=MNU_00020&mt20Id=${mt20id}`,
                                genre: db.genrenm,
                                price: cleanPrice(db.pcseguidance),
                                time: db.dtguidance,
                                region: db.area,
                                source: 'kopis',
                                isFestival,
                                cast,
                                crew,
                                runtime,
                                age,
                                production: producer || planner || host || organizer,
                                host,
                                organizer,
                                planner,
                                producer,
                                sponsor,
                                priceList,
                                ageDetail: age,
                                openRun: firstUseful(db.openrun).toUpperCase() === 'Y',
                                performanceState,
                                lastModifiedAt: firstUseful(db.updatedate, db.modifydate),
                                dataCollectedAt: new Date().toISOString(),
                                venuePhone: currentVenue?.phone,
                                venueHomepage: currentVenue?.homepage,
                                venueFacilityType: currentVenue?.facilityType,
                                venueSeatScale: currentVenue?.seatScale,
                                venueTheaterCount: currentVenue?.theaterCount,
                                venueAmenities: currentVenue?.amenities,
                                parking: currentVenue?.parking,
                                restrooms: currentVenue?.restrooms,
                                facilities: currentVenue?.facilities,
                                synopsis: !isUseless(db.sty) ? db.sty : undefined,
                                description: !isUseless(db.sty) ? db.sty : undefined,
                                synopsisImages,
                            };
                            allItems = allItems.filter(it => it.id !== fullId);
                            allItems.push(perf);
                            if (db.mt10id) uniqueVenueIds.add(db.mt10id);
                        }
                    } catch (e) {
                        process.stdout.write(`X`);
                    }
                }
                console.log(`\nPage ${page} done. Total: ${allItems.length}`);
                if (list.length < 100) hasMore = false;
                else page++;
                safeWrite(OUTPUT_FILE, allItems);
            }
        }
        return true;
    };

    const performancePassCompleted = await fetchList('pblprfr', false);
    if (performancePassCompleted && !isBudgetExceeded()) {
        await fetchList('prffest', true);
    }

    // Phase 3: Final Venue Sweep
    if (!isBudgetExceeded()) await enrichVenues();

    console.log(`\n🎉 Final result: ${allItems.length} items saved.`);
}

scrapeKopis().catch(err => {
    if (err?.message === 'KOPIS_RUN_BUDGET_EXCEEDED') {
        console.warn('KOPIS budget reached between requests. Existing checkpoint retained.');
        process.exit(0);
    }
    console.error('Fatal Error:', err);
    process.exit(1);
});
