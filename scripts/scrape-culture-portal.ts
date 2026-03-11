import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';

const API_KEY = 'da895f03-f155-420f-a63d-ab4e21782334';
const BASE_URL = 'https://api.kcisa.kr/openapi/CNV_060/request';
const DATA_DIR = path.resolve(process.cwd(), 'src/data');
const OUTPUT_FILE = path.resolve(DATA_DIR, 'culture-portal.json');
const VENUE_FILE = path.resolve(DATA_DIR, 'venues.json');

const RATE_LIMIT_DELAY = 100;

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
    // Enriched fields
    price?: string;
    time?: string;
    age?: string;
    runtime?: string;
    cast?: string[];
    crew?: string[];
    bookingLink?: string;
    [key: string]: any; // Allow indexing
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Safe write to prevent corruption during crash
function safeWrite(file: string, data: any) {
    const tmpFile = `${file}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2));
    fs.renameSync(tmpFile, file);
}

async function fetchWithRetry(url: string, params: any, retries = 3): Promise<any> {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.get(url, { params, timeout: 15000 });
            return response.data;
        } catch (e: any) {
            if (i === retries - 1) throw e;
            await delay(2000 * (i + 1));
        }
    }
}

// Extract detail metadata securely using Cheerios
async function enrichDetails(item: CulturePerformance): Promise<CulturePerformance> {
    if (!item.link || !item.link.includes('mcst.go.kr')) return item;

    try {
        const response = await axios.get(item.link, { timeout: 15000, maxRedirects: 3 });
        const html = response.data;
        const $ = cheerio.load(html);

        const isUseless = (s: string) => !s || s.trim() === '' || s.includes('해당정보') || s === '없음';

        $('.view_info_list li').each((_, el) => {
            const text = $(el).text();
            if (text.includes('정가')) {
                const p = $(el).find('span.data').text().trim();
                if (!isUseless(p)) item.price = p;
            } else if (text.includes('관람연령')) {
                const a = $(el).find('span.data').text().trim();
                if (!isUseless(a)) item.age = a;
            } else if (text.includes('관람소요시간')) {
                const r = $(el).find('span.data').text().trim();
                if (!isUseless(r)) item.runtime = r;
            } else if (text.includes('출연진')) {
                const c = $(el).find('span.data').text().trim();
                if (!isUseless(c)) item.cast = c.split(',').map(s => s.trim()).filter(Boolean);
            } else if (text.includes('제작진')) {
                const cr = $(el).find('span.data').text().trim();
                if (!isUseless(cr)) item.crew = cr.split(',').map(s => s.trim()).filter(Boolean);
            } else if (text.includes('기타안내')) {
                const t = $(el).find('span.data').text().trim();
                if (!isUseless(t)) item.time = t;
            }
        });

        // Booking Link: mcst gives a goPage script tag generally or a href
        const goLinkStr = $('a.btn_detail_blue').attr('href');
        if (goLinkStr && goLinkStr.includes('goPage(')) {
            const match = goLinkStr.match(/goPage\('([^']+)'\)/);
            if (match && match[1]) {
                const actualLink = match[1].replace(/&amp;/g, '&');
                if (actualLink.startsWith('http')) {
                    item.bookingLink = actualLink;
                }
            }
        }

    } catch (e: any) {
        // Ignore errors, return un-enriched item
    }
    return item;
}


async function scrapeCulturePortal() {
    console.log("🚀 Starting Culture Portal Scraper...");
    
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    let venues: any = {};
    if (fs.existsSync(VENUE_FILE)) {
        try {
            venues = JSON.parse(fs.readFileSync(VENUE_FILE, 'utf-8'));
        } catch (e) {}
    }

    // Load existing mapping to support incremental saving
    let existingItems: CulturePerformance[] = [];
    if (fs.existsSync(OUTPUT_FILE)) {
        try {
            existingItems = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
        } catch (e) {}
    }
    const existingMap = new Map<string, CulturePerformance>();
    existingItems.forEach(it => existingMap.set(it.title + it.date, it));

    const newList: CulturePerformance[] = [];
    const parser = new XMLParser();

    let pageNo = 1;
    let hasMore = true;

    // Phase 1: API Collection
    console.log("Phase 1: API Index Collection...");
    while (hasMore) {
        process.stdout.write(`Fetching Page ${pageNo}... `);
        try {
            const data = await fetchWithRetry(BASE_URL, {
                serviceKey: API_KEY,
                numOfRows: 100,
                pageNo: pageNo
            });

            const obj = typeof data === 'string' ? parser.parse(data) : data;
            const response = obj.response || obj; 
            const header = response?.header;
            const body = response?.body;

            if (String(header?.resultCode) !== '0000' && String(header?.resultCode) !== '0') {
                console.error(`API Error Code: ${header?.resultCode}`);
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

                const key = title + (item.eventPeriod || '');
                let perf = existingMap.get(key);

                if (!perf) {
                    perf = {
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
                }

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
                        const endStr = parts[1].trim();

                        const datePattern = /(\d{2,4})[-.](\d{1,2})[-.](\d{1,2})/;
                        if (datePattern.test(endStr)) {
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
                    newList.push(perf);
                }
            }

            console.log(`Pushed ${list.length}. Accumulated: ${newList.length}`);
            
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
                console.log("Page contains only past events. Stopping early to save API calls.");
                hasMore = false;
            }

            if (body.totalCount && newList.length >= parseInt(body.totalCount)) {
                hasMore = false;
            } else if (list.length < 100 || newList.length > 8000) {
                console.log("Reached safety limit. Stopping.");
                hasMore = false;
            }

            pageNo++;
            await delay(RATE_LIMIT_DELAY);

        } catch (e: any) {
            console.error(`\nError fetching API page ${pageNo}:`, e.message);
            break;
        }
    }

    safeWrite(OUTPUT_FILE, newList);
    
    // Phase 2: Detail Enrichment
    console.log(`\nPhase 2: HTML Enrichment for ${newList.length} items...`);
    
    // Process only items that lack price/age mappings and have an mcst link
    const toEnrich = newList.filter(item => !item.price && item.link && item.link.includes('mcst.go.kr'));
    console.log(`${toEnrich.length} items need enrichment.`);

    const limit = pLimit(5); // Parallel requests
    let enrichedCount = 0;

    const tasks = toEnrich.map((item, idx) => limit(async () => {
        const enriched = await enrichDetails(item);
        // Replace in original list
        const origIdx = newList.findIndex(i => i.id === item.id);
        if (origIdx !== -1) newList[origIdx] = enriched;
        
        enrichedCount++;
        if (enrichedCount % 50 === 0) {
            console.log(`Enriched ${enrichedCount} / ${toEnrich.length}...`);
            safeWrite(OUTPUT_FILE, newList); // Incremental safe save
        }
    }));

    await Promise.all(tasks);

    // Final Save
    safeWrite(OUTPUT_FILE, newList);
    console.log(`\n✅ Finished Processing Culture Portal.`);
    console.log(`Collected total valid entries: ${newList.length}`);
}

scrapeCulturePortal();
