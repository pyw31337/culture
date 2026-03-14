import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import fs from 'fs';
import path from 'path';

// --- Configuration ---
const API_KEY = process.env.KOPIS_API_KEY || 'ba7dc8feda8a4e66a90e43fcdb03c35a'; // Fallback for local run without .env
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
}

// --- Utils ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const isUseless = (s: string) => !s || typeof s !== 'string' || s.trim() === '' || s.includes('해당정보') || s === '없음';

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
        if (it.venueId && (!v || !v.phone || !v.homepage || !v.lat)) {
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
            try {
                process.stdout.write(`v`);
                await delay(RATE_LIMIT_DELAY);
                const vXml = await fetchWithRetry(`${BASE_URL}/prfplc/${vid}`, { service: API_KEY });
                const vObj = parser.parse(vXml);
                const vdb = vObj.dbs?.db;

                if (vdb && vdb.la && vdb.lo) {
                    const phone = !isUseless(vdb.telno) ? vdb.telno : (venues[vdb.fcltynm]?.phone);
                    const homepage = !isUseless(vdb.relateurl) ? vdb.relateurl : (venues[vdb.fcltynm]?.homepage);

                    const venueData = {
                        name: vdb.fcltynm,
                        address: vdb.adres || '',
                        lat: parseFloat(vdb.la),
                        lng: parseFloat(vdb.lo),
                        district: (vdb.adres || '').split(' ')[1],
                        phone,
                        homepage
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
    const futureLimit = new Date();
    futureLimit.setFullYear(futureLimit.getFullYear() + 1);
    const eddate = futureLimit.toISOString().split('T')[0].replace(/-/g, '');

    const fetchList = async (endpoint: string, isFestival = false) => {
        const states = isFestival ? ['01', '02', '03', '04'] : ['02', '01']; 
        for (const state of states) {
            let page = 1;
            let hasMore = true;
            while (hasMore) {
                console.log(`Fetching ${isFestival ? 'Festival' : 'Performance'} State ${state} Page ${page}...`);
                const xmlData = await fetchWithRetry(`${BASE_URL}/${endpoint}`, {
                    service: API_KEY,
                    stdate: isFestival ? stdate : '20230101', // Wide window for perfs
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
                    const mt20id = item.mt20id;
                    const fullId = `kopis_${mt20id}`;
                    
                    const existing = existingItems.find(it => it.id === fullId);
                    if (existing && existing.synopsis && existing.venueId) {
                        process.stdout.write(`s`);
                        continue;
                    }

                    try {
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

                            const perf: KopisPerformance = {
                                id: fullId,
                                title: db.prfnm,
                                image: db.poster,
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
                                synopsis: !isUseless(db.sty) ? db.sty : undefined,
                                description: !isUseless(db.sty) ? db.sty : undefined,
                                synopsisImages: db.styurls?.styurl ? (Array.isArray(db.styurls.styurl) ? db.styurls.styurl : [db.styurls.styurl]) : undefined,
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
    };

    await fetchList('pblprfr', false);
    await fetchList('prffest', true);

    // Phase 3: Final Venue Sweep
    await enrichVenues();

    console.log(`\n🎉 Final result: ${allItems.length} items saved.`);
}

scrapeKopis().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
