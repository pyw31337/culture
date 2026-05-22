import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
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
const ROWS_PER_PAGE = 100;
const MAX_API_PAGES = positiveInt(process.env.CULTURE_PORTAL_MAX_API_PAGES, 360);
const MAX_ACTIVE_ITEMS = positiveInt(process.env.CULTURE_PORTAL_MAX_ACTIVE_ITEMS, 8500);
const DETAIL_LIMIT = positiveInt(process.env.CULTURE_PORTAL_DETAIL_LIMIT, 400);
const DETAIL_STALE_DAYS = positiveInt(process.env.CULTURE_PORTAL_DETAIL_STALE_DAYS, 30);
const DETAIL_CONCURRENCY = positiveInt(process.env.CULTURE_PORTAL_DETAIL_CONCURRENCY, 5);
const DEBUG_DETAILS = process.env.CULTURE_PORTAL_DEBUG_DETAILS === '1';
const RUN_CHECKED_AT = new Date().toISOString();

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
    sourceKey?: string;
    detailCheckedAt?: string;
    detailStatus?: 'enriched' | 'checked';
    [key: string]: any; // Allow indexing
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function positiveInt(value: string | undefined, fallback: number): number {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function itemKey(title: string, date: string): string {
    return `${title.trim()}::${date.trim()}`;
}

function stableId(title: string, date: string, link: string): string {
    const hash = crypto
        .createHash('sha1')
        .update(`${title.trim()}|${date.trim()}|${link.trim()}`)
        .digest('hex')
        .slice(0, 14);
    return `culture_portal_${hash}`;
}

function isDetailStale(item: CulturePerformance): boolean {
    if (!item.detailCheckedAt) return true;
    const checkedAt = Date.parse(item.detailCheckedAt);
    if (!Number.isFinite(checkedAt)) return true;
    return Date.now() - checkedAt > DETAIL_STALE_DAYS * 24 * 60 * 60 * 1000;
}

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

function mapGenre(s: string): string {
    if (!s) return 'exhibition';
    if (s.includes('뮤지컬')) return 'musical';
    if (s.includes('연극')) return 'play';
    if (s.includes('클래식') || s.includes('오악') || s.includes('음악') || s.includes('국악')) return 'classic_tradition';
    if (s.includes('축제') || s.includes('페스티벌')) return 'festival';
    if (s.includes('교육') || s.includes('체험')) return 'activity';
    return 'exhibition';
}

function normalizeDate(s: string): string {
    if (!s) return '';
    // Handle "20260313 ~ 20260313" -> "2026.03.13 ~ 2026.03.13"
    // Handle "20260313" -> "2026.03.13"
    return s.replace(/\d{8}/g, (match) => {
        return `${match.substring(0, 4)}.${match.substring(4, 6)}.${match.substring(6, 8)}`;
    });
}

// Extract detail metadata securely using Cheerios
async function enrichDetails(item: CulturePerformance): Promise<CulturePerformance> {
    if (!item.link || !item.link.includes('mcst.go.kr')) return item;

    try {
        const response = await axios.get(item.link, { 
            timeout: 15000, 
            maxRedirects: 3,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const html = response.data;
        const $ = cheerio.load(html);

        const isUseless = (s: string) => !s || s.trim() === '' || s.includes('해당정보') || s === '없음' || s === '010-0000-0000';

        // 1. DL/DT/DD processing (Modern MCST Layout)
        $('.board_detail dl dt, .view_info_list dl dt, .view_info dt, dl.board_detail dt, .view-detail dl dt').each((_, el) => {
            const label = $(el).text().trim();
            const value = $(el).next('dd').text().trim();
            
            if (isUseless(value)) return;

            if (label.includes('시간')) {
                item.time = value;
            } else if (label.includes('요금') || label.includes('가격') || label.includes('관람료')) {
                item.price = value;
            } else if (label.includes('문의') || label.includes('연락처')) {
                // Priority for '문의' labels
                item.contact = value;
            } else if (label.includes('전화') && !item.contact) {
                item.contact = value;
            } else if (label.includes('장소')) {
                if (value.length > item.venue.length) item.venue = value;
            } else if (label.includes('관람연령')) {
                item.age = value;
            } else if (label.includes('소요시간')) {
                item.runtime = value;
            } else if (label.includes('등   급')) {
                item.ageRating = value;
            }
        });

        // 2. Board detail processing (li with tit/data spans - Fallback)
        $('.board_detail li, .view_info_list li, .view-detail li').each((_, el) => {
            const label = $(el).find('.tit, strong, b').first().text().trim();
            const value = $(el).find('.data, span').last().text().trim();
            
            if (isUseless(value)) return;

            if (label.includes('시간') && !item.time) {
                item.time = value;
            } else if ((label.includes('요금') || label.includes('가격') || label.includes('관람료')) && !item.price) {
                item.price = value;
            } else if ((label.includes('문의') || label.includes('전화')) && !item.contact) {
                item.contact = value;
            } else if (label.includes('주최') || label.includes('주관')) {
                item.host = value;
            } else if (label.includes('홈페이지') || label.includes('웹사이트')) {
                item.website = value;
            } else if (label.includes('주차')) {
                item.parking = value;
            } else if (label.includes('관람연령') && !item.age) {
                item.age = value;
            } else if (label.includes('출연진')) {
                item.cast = value.split(',').map(s => s.trim()).filter(Boolean);
            }
        });

        // 3. Exhibition Introduction (Broadened)
        const introContainer = $('.view_con, #content .view-detail .view_con, .view_con_area');
        if (introContainer.length > 0) {
            const clone = introContainer.clone();
            clone.find('script, style, .btn_area, h3.title02, h3.board_tit').remove();
            const fullText = clone.text().trim();
            if (fullText.length > 10) {
                item.description = fullText.replace(/\s+/g, ' ').substring(0, 2000); 
            }
        }

        // 4. Booking Link
        const goLinkStr = $('a.btn_detail_blue, a.btn_blue').attr('href');
        if (goLinkStr && goLinkStr.includes('goPage(')) {
            const match = goLinkStr.match(/goPage\('([^']+)'\)/);
            if (match && match[1]) {
                const actualLink = match[1].replace(/&amp;/g, '&');
                if (actualLink.startsWith('http')) {
                    item.bookingLink = actualLink;
                }
            }
        } else if (goLinkStr && goLinkStr.startsWith('http')) {
            item.bookingLink = goLinkStr;
        }

    } catch (e: any) {
        console.warn(`[WARN] Failed to enrich details for ${item.link}: ${e.message}`);
    }

    item.detailCheckedAt = RUN_CHECKED_AT;
    item.detailStatus = item.price || item.time || item.contact || item.description || item.bookingLink
        ? 'enriched'
        : 'checked';
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
    existingItems.forEach(it => {
        existingMap.set(itemKey(it.title || '', it.date || ''), it);
        if (it.sourceKey) existingMap.set(it.sourceKey, it);
    });

    const newList: CulturePerformance[] = [];
    const seenKeys = new Set<string>();
    const parser = new XMLParser();

    let pageNo = 1;
    let hasMore = true;
    let fetchedRows = 0;

    // Phase 1: API Collection
    console.log(`Phase 1: API Index Collection (max pages: ${MAX_API_PAGES}, max active: ${MAX_ACTIVE_ITEMS})...`);
    while (hasMore) {
        process.stdout.write(`Fetching Page ${pageNo}... `);
        try {
            const data = await fetchWithRetry(BASE_URL, {
                serviceKey: API_KEY,
                numOfRows: ROWS_PER_PAGE,
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
            fetchedRows += list.length;
            
            for (const item of list) {
                let genre = 'exhibition';
                const title = item.title || '';
                const normalizedDate = normalizeDate(item.eventPeriod || '');
                const sourceKey = itemKey(title, normalizedDate);
                if (seenKeys.has(sourceKey)) continue;
                seenKeys.add(sourceKey);
                
                if (title.includes('콘서트') || title.includes('연주회')) genre = 'classic_tradition';
                if (title.includes('뮤지컬')) genre = 'musical';
                if (title.includes('연극')) genre = 'play';
                if (title.includes('축제') || title.includes('페스티벌')) genre = 'festival';
                if (title.includes('교육') || title.includes('체험')) genre = 'activity';

                let rawVenue = item.eventSite || '';
                if (!rawVenue || typeof rawVenue !== 'string') rawVenue = '미상';
                rawVenue = rawVenue.split(',')[0].trim();

                let perf = existingMap.get(sourceKey);

                if (!perf) {
                    perf = {
                        id: stableId(title, normalizedDate, item.url || ''),
                        title: title,
                        image: item.imageObject || '',
                        date: normalizedDate,
                        venue: rawVenue,
                        link: item.url || '',
                        genre: genre,
                        source: 'culture-portal',
                        isFestival: genre === 'festival',
                        sourceKey
                    };
                } else {
                    perf = {
                        ...perf,
                        title,
                        image: item.imageObject || perf.image || '',
                        date: normalizedDate,
                        venue: rawVenue || perf.venue,
                        link: item.url || perf.link || '',
                        genre,
                        source: 'culture-portal',
                        isFestival: genre === 'festival',
                        sourceKey
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
            const totalCount = Number.parseInt(String(body?.totalCount || ''), 10);
            
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

            if (Number.isFinite(totalCount) && totalCount > 0 && fetchedRows >= totalCount) {
                console.log("Reached API totalCount. Stopping.");
                hasMore = false;
            } else if (MAX_API_PAGES > 0 && pageNo >= MAX_API_PAGES) {
                console.log("Reached API page limit. Stopping.");
                hasMore = false;
            } else if (list.length < ROWS_PER_PAGE) {
                console.log("Reached last short page. Stopping.");
                hasMore = false;
            } else if (MAX_ACTIVE_ITEMS > 0 && newList.length >= MAX_ACTIVE_ITEMS) {
                console.log("Reached active item safety limit. Stopping.");
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
    
    // Process a bounded rolling subset so daily runs do not re-check thousands of low-value detail pages.
    const detailCandidates = newList.filter(item => {
        const missingCoreDetails = !item.price && !item.time && !item.contact;
        return missingCoreDetails && item.link && item.link.includes('mcst.go.kr') && isDetailStale(item);
    });
    const toEnrich = DETAIL_LIMIT > 0 ? detailCandidates.slice(0, DETAIL_LIMIT) : [];
    console.log(`${detailCandidates.length} items need detail checks. This run: ${toEnrich.length}. Deferred: ${Math.max(0, detailCandidates.length - toEnrich.length)}.`);

    const limit = pLimit(DETAIL_CONCURRENCY); // Parallel requests
    let enrichedCount = 0;

    const tasks = toEnrich.map((item, idx) => limit(async () => {
        const enriched = await enrichDetails({ ...item });
        
        if (DEBUG_DETAILS && (enriched.price || enriched.time || enriched.contact)) {
            console.log(`[DEBUG] Enriched: ${item.title} | Price: ${enriched.price} | Time: ${enriched.time}`);
        }

        // Find the index in the actual newList to update it
        const origIdx = newList.findIndex(i => i.id === item.id);
        if (origIdx !== -1) {
            newList[origIdx] = { ...newList[origIdx], ...enriched };
        }
        
        enrichedCount++;
        if (enrichedCount % 10 === 0) {
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
