import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import fs from 'fs';
import path from 'path';

// --- Configuration ---
const API_KEY = 'ba7dc8feda8a4e66a90e43fcdb03c35a';
const BASE_URL = 'http://www.kopis.or.kr/openApi/restful';
const DATA_DIR = path.join(process.cwd(), 'src/data');
const VENUE_FILE = path.join(DATA_DIR, 'venues.json');
const OUTPUT_FILE = path.join(DATA_DIR, 'kopis-performances.json');
const RATE_LIMIT_DELAY = 150; // ms between requests

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
    cast?: string[];
    crew?: string[];
    runtime?: string;
    age?: string;
}

interface VenueInfo {
    name: string;
    address: string;
    lat: number;
    lng: number;
    district?: string;
    mapped_region_id?: string;
}

// --- Utils ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, params: any, retries = 3): Promise<any> {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.get(url, { params, timeout: 15000 });
            return response.data;
        } catch (e: any) {
            if (i === retries - 1) throw e;
            console.warn(`\nRetrying ${url} (${i + 1}/${retries})... Error: ${e.message}`);
            await delay(2000 * (i + 1));
        }
    }
}

// --- Main Logic ---
async function scrapeKopis() {
    console.log("🚀 Starting Elaborate KOPIS Scraper (Performances & Festivals)...");
    
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    // Load existing venues for coordinate lookup
    let venues: Record<string, VenueInfo> = {};
    if (fs.existsSync(VENUE_FILE)) {
        try {
            venues = JSON.parse(fs.readFileSync(VENUE_FILE, 'utf-8'));
            console.log(`Loaded ${Object.keys(venues).length} venues for coordinate lookup.`);
        } catch (e) {
            console.warn('Could not parse venues.json, starting fresh for venues.');
        }
    }

    // Optimized Date Logic: Rolling Window
    // Capture long-running open-runs by setting start date to 6 months ago
    const today = new Date();
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const futureLimit = new Date();
    futureLimit.setFullYear(futureLimit.getFullYear() + 1);

    const fmtDate = (d: Date) => d.toISOString().split('T')[0].replace(/-/g, '');
    
    const stdate = fmtDate(sixMonthsAgo); 
    const eddate = fmtDate(futureLimit);

    // Load existing items for incremental skip
    let existingItems: KopisPerformance[] = [];
    if (fs.existsSync(OUTPUT_FILE)) {
        try {
            existingItems = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
        } catch (e) {}
    }
    const existingIds = new Set(existingItems.map(it => it.id));

    let allItems: KopisPerformance[] = existingItems;
    const uniqueVenueIds = new Set<string>();

    const fetchList = async (endpoint: string, isFestival = false) => {
        // Optimization: For performances, we only care about Running (02) and Upcoming (01).
        // Festivals can include 01-04 as they are seasonal.
        const states = isFestival ? ['01', '02', '03', '04'] : ['02', '01']; 
        
        for (const state of states) {
            let page = 1;
            let hasMore = true;
            while (hasMore) {
                console.log(`Fetching ${isFestival ? 'Festival' : 'Performance'} State ${state} Page ${page}...`);
                const xmlData = await fetchWithRetry(`${BASE_URL}/${endpoint}`, {
                    service: API_KEY,
                    stdate, 
                    eddate: state === '01' ? fmtDate(new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000)) : eddate,
                    cpage: page,
                    rows: 100,
                    prfstate: state
                });

            const jsonObj = parser.parse(xmlData);
            const dbs = jsonObj.dbs?.db;
            if (!dbs) break;

            const list = Array.isArray(dbs) ? dbs : [dbs];
            for (const item of list) {
                const mt20id = item.mt20id;
                const fullId = `kopis_${mt20id}`;
                const prfpdfrom = item.prfpdfrom;
                const prfpdto = item.prfpdto;

                // Skip ONLY if BOTH start and end dates exist AND end date is past
                if (prfpdfrom && prfpdto) {
                    const endDate = new Date(prfpdto.replace(/\./g, '-'));
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    if (endDate < yesterday) {
                        continue;
                    }
                }

                // Incremental Skip: Only fetch details if new
                if (existingIds.has(fullId)) {
                    process.stdout.write(`s`);
                    continue;
                }

                // Fetch Detail
                try {
                    process.stdout.write(`.`);
                    await delay(RATE_LIMIT_DELAY);
                    const detailXml = await fetchWithRetry(`${BASE_URL}/pblprfr/${mt20id}`, { service: API_KEY });
                    const detailObj = parser.parse(detailXml);
                    const db = detailObj.dbs?.db;

                    if (db) {
                        const cast = db.prfcast ? db.prfcast.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined;
                        const crew = db.prfcrew ? db.prfcrew.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined;

                        const perf: KopisPerformance = {
                            id: `kopis_${mt20id}`,
                            title: db.prfnm,
                            image: db.poster,
                            date: `${db.prfpdfrom} ~ ${db.prfpdto}`,
                            venue: db.fcltynm,
                            venueId: db.mt10id,
                            link: `https://www.kopis.or.kr/por/db/pblprfr/pblprfrView.do?menuId=MNU_00020&mt20Id=${mt20id}`,
                            genre: db.genrenm,
                            price: db.pcseguidance || '정보없음',
                            time: db.dtguidance,
                            region: db.area,
                            source: 'kopis',
                            isFestival,
                            cast: cast?.length ? cast : undefined,
                            crew: crew?.length ? crew : undefined,
                            runtime: db.prfruntime && db.prfruntime !== ' ' ? db.prfruntime : undefined,
                            age: db.prfage && db.prfage !== ' ' ? db.prfage : undefined
                        };
                        allItems.push(perf);
                        if (db.mt10id) uniqueVenueIds.add(db.mt10id);
                    }
                } catch (e: any) {
                    process.stdout.write(`X`);
                }
            }
            console.log(`\nPage ${page} done. Total: ${allItems.length}`);
            if (list.length < 100 || page > 50) hasMore = false;
            else page++;
            
            // Iterative save
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allItems, null, 2));
            } // Added missing closing brace for while loop
        } // Added missing closing brace for for loop
    };

    // 1. Collect Performances & Festivals
    await fetchList('pblprfr', false);
    await fetchList('prffest', true);

    // 2. Enrich with Venue Details (Coordinates)
    console.log(`\n🔍 Enriching ${uniqueVenueIds.size} unique venues with coordinates...`);
    let venueUpdateCount = 0;
    for (const vid of uniqueVenueIds) {
        // Find venue name from allItems to check cache
        const sample = allItems.find(it => it.venueId === vid);
        if (sample && venues[sample.venue]) {
            // Already have coordinates, skip
            continue;
        }

        try {
            process.stdout.write(`v`);
            await delay(RATE_LIMIT_DELAY);
            const vXml = await fetchWithRetry(`${BASE_URL}/prfplc/${vid}`, { service: API_KEY });
            const vObj = parser.parse(vXml);
            const vdb = vObj.dbs?.db;

            if (vdb && vdb.la && vdb.lo) {
                venues[vdb.fcltynm] = {
                    name: vdb.fcltynm,
                    address: vdb.adres || '',
                    lat: parseFloat(vdb.la),
                    lng: parseFloat(vdb.lo),
                    district: (vdb.adres || '').split(' ')[1] // Simple district extraction
                };
                venueUpdateCount++;
            }
        } catch (e) {
            process.stdout.write(`e`);
        }
    }

    // 3. Apply coordinates to all items and Save
    console.log(`\n✅ Updated ${venueUpdateCount} new venues in cache.`);
    const enrichedItems = allItems.map(item => {
        const v = venues[item.venue];
        if (v) {
            return { ...item, lat: v.lat, lng: v.lng, address: v.address };
        }
        return item;
    });

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(enrichedItems, null, 2));
    fs.writeFileSync(VENUE_FILE, JSON.stringify(venues, null, 2));
    
    console.log(`\n🎉 Final result: ${enrichedItems.length} items saved to ${OUTPUT_FILE}`);
}

scrapeKopis().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
