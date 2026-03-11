import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';

const API_KEY = 'da895f03-f155-420f-a63d-ab4e21782334';
const BASE_URL = 'https://api.kcisa.kr/openapi/CNV_060/request';
const DATA_DIR = path.resolve(process.cwd(), 'src/data');
const OUTPUT_FILE = path.resolve(DATA_DIR, 'culture-portal.json');
const VENUE_FILE = path.resolve(DATA_DIR, 'venues.json');

const RATE_LIMIT_DELAY = 100;
const START_YEAR = '2026'; // Focusing on current year for now

interface CulturePerformance {
    id: string;
    title: string;
    image: string;
    date: string;
    venue: string;
    link: string;
    genre: string;
    lat?: number;
    lng?: number;
    address?: string;
    source: 'culture-portal';
    isFestival?: boolean;
}

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

async function scrapeCulturePortal() {
    console.log("🚀 Starting Culture Portal Scraper...");
    
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    let venues: any = {};
    if (fs.existsSync(VENUE_FILE)) {
        try {
            venues = JSON.parse(fs.readFileSync(VENUE_FILE, 'utf-8'));
            console.log(`Loaded ${Object.keys(venues).length} venues for lookup.`);
        } catch (e) {
            console.warn('Could not parse venues.json.');
        }
    }

    const allItems: CulturePerformance[] = [];
    const parser = new XMLParser();

    let pageNo = 1;
    let hasMore = true;

    while (hasMore) {
        process.stdout.write(`Fetching Page ${pageNo}... `);
        try {
            const data = await fetchWithRetry(BASE_URL, {
                serviceKey: API_KEY,
                numOfRows: 100,
                pageNo: pageNo
            });

            // Axios might automatically parse JSON
            const obj = typeof data === 'string' ? parser.parse(data) : data;
            const response = obj.response || obj; 
            const header = response?.header;
            const body = response?.body;

            if (String(header?.resultCode) !== '0000' && String(header?.resultCode) !== '0') {
                console.error(`API Error Code: ${header?.resultCode}, Msg: ${header?.resultMsg}`);
                console.log("Raw object:", JSON.stringify(obj).substring(0, 500));
                break;
            }

            const items = body?.items?.item;
            if (!items) {
                console.log('No more items.');
                break;
            }

            const list = Array.isArray(items) ? items : [items];
            
            for (const item of list) {
                let genre = 'exhibition';
                const title = item.title || '';
                
                if (title.includes('콘서트') || title.includes('연주회')) genre = 'classic_tradition';
                if (title.includes('뮤지컬')) genre = 'musical';
                if (title.includes('연극')) genre = 'play';
                if (title.includes('축제') || title.includes('페스티벌')) genre = 'festival';
                if (title.includes('교육') || title.includes('체험')) genre = 'activity';

                let rawVenue = item.eventSite || '';
                if (!rawVenue || typeof rawVenue !== 'string') rawVenue = '미상';
                rawVenue = rawVenue.split(',')[0].trim();

                const perf: CulturePerformance = {
                    id: `culture_portal_${title.replace(/\s/g, '').substring(0,20)}_${pageNo}_${Math.floor(Math.random() * 1000)}`,
                    title: title,
                    image: item.imageObject || '',
                    date: item.eventPeriod || '',
                    venue: rawVenue,
                    link: item.url || '',
                    genre: genre,
                    source: 'culture-portal',
                    isFestival: genre === 'festival'
                };

                const v = venues[rawVenue];
                if (v && v.lat && v.lng) {
                    perf.lat = v.lat;
                    perf.lng = v.lng;
                    perf.address = v.address;
                }

                // Active date filter (Skip ONLY if BOTH start and end exist AND end is past)
                let isActive = true;
                if (perf.date && perf.date.includes('~')) {
                    try {
                        const parts = perf.date.split('~');
                        const startStr = parts[0].trim();
                        const endStr = parts[1].trim();

                        const datePattern = /(\d{2,4})[-.](\d{1,2})[-.](\d{1,2})/;
                        if (datePattern.test(startStr) && datePattern.test(endStr)) {
                            const [y, m, d] = endStr.split(/[-.]/).map(Number);
                            if (y && m && d) {
                                const year = y < 100 ? y + 2000 : y;
                                const endDate = new Date(year, m - 1, d);
                                const today = new Date();
                                today.setDate(today.getDate() - 7); // 7 days grace period
                                if (endDate < today) isActive = false;
                            }
                        }
                    } catch (e) {}
                }

                if (isActive) {
                    allItems.push(perf);
                }
            }

            console.log(`Fetched ${list.length} items. Active: ${list.filter(item => {
                const period = item.eventPeriod || '';
                if (period.includes('~')) {
                    const endStr = period.split('~')[1].trim();
                    const datePattern = /(\d{2,4})[-.](\d{1,2})[-.](\d{1,2})/;
                    if (datePattern.test(endStr)) {
                        const [y, m, d] = endStr.split(/[-.]/).map(Number);
                        const year = y < 100 ? y + 2000 : y;
                        const endDate = new Date(year, m - 1, d);
                        const today = new Date();
                        today.setDate(today.getDate() - 1); // Strict: end date must be at least today
                        return endDate >= today;
                    }
                }
                return true;
            }).length}. Total items so far: ${allItems.length}`);
            
            // Early exit if all items on the page are in the past
            const pageActiveCount = list.filter(item => {
                const period = item.eventPeriod || '';
                if (!period.includes('~')) return true;
                const endStr = period.split('~')[1].trim();
                const datePattern = /(\d{2,4})[-.](\d{1,2})[-.](\d{1,2})/;
                if (datePattern.test(endStr)) {
                    const [y, m, d] = endStr.split(/[-.]/).map(Number);
                    const endDate = new Date(y < 100 ? y + 2000 : y, m - 1, d);
                    return endDate >= new Date();
                }
                return true;
            }).length;

            if (pageActiveCount === 0 && list.length > 0 && pageNo > 2) {
                console.log("Page contains only past events. Stopping early to save bandwidth.");
                hasMore = false;
            }

            if (body.totalCount && allItems.length >= parseInt(body.totalCount)) {
                hasMore = false;
            } else if (list.length < 100 || allItems.length > 8000) {
                console.log("Reached limit. Stopping.");
                hasMore = false;
            }

            pageNo++;
            await delay(RATE_LIMIT_DELAY);

        } catch (e: any) {
            console.error(`\nError fetching page ${pageNo}:`, e.message);
            break;
        }
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allItems, null, 2));
    console.log(`\n✅ Saved ${allItems.length} Culture Portal performances to ${OUTPUT_FILE}`);
}

scrapeCulturePortal();
