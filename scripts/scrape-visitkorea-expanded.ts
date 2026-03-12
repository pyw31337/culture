
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { Performance } from '../src/types';
import pLimit from 'p-limit';

const DATA_FILE = path.join(process.cwd(), 'src/data/tourism.json');
const baseApiUrl = 'https://korean.visitkorea.or.kr';
const baseImageURL = 'https://cdn.visitkorea.or.kr/img/call?cmd=VIEW&id=';

const AREA_MAP: Record<string, string> = {
    '1': '서울', '2': '인천', '3': '대전', '4': '대구', '5': '광주', '6': '부산', '7': '울산', '8': '세종',
    '31': '경기', '32': '강원', '33': '충북', '34': '충남', '35': '경북', '36': '경남', '37': '전북', '38': '전남', '39': '제주'
};

const limit = pLimit(3); 

/**
 * Clean string by removing extra whitespace and newlines
 */
function clean(str: string | undefined): string {
    return str ? str.replace(/\s+/g, ' ').trim() : '';
}

async function fetchDetails(cotId: string) {
    const url = `${baseApiUrl}/detail/ms_detail.do?cotid=${cotId}`;
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            },
            timeout: 10000
        });
        const html = response.data;
        const $ = cheerio.load(html);

        // 1. Improved Introduction Selectors
        let description = clean($('.inr_wrap .inr p, .char_cont p, .detail_cont, #detailinfoview .inr_wrap p').first().text());
        
        // 2. Info List processing (ul.detail_info li)
        const infoList: Record<string, string> = {};
        $('.detail_info li, .detail_info_list li').each((_, el) => {
            const label = $(el).find('strong').text().trim().replace(':', '');
            // For values, favor span but fall back to direct text concatenation
            const value = $(el).find('span').text().trim() || $(el).text().replace(label, '').replace(':', '').trim();
            if (label && value) infoList[label] = value;
        });

        // 3. Robust field mapping
        const contact = infoList['문의 및 안내'] || infoList['전화번호'] || infoList['문의'] || '';
        const price = infoList['이용요금'] || infoList['입장료'] || infoList['관람료'] || '';
        const time = infoList['이용시간'] || infoList['운영시간'] || '';
        const address = infoList['주소'] || '';
        const holiday = infoList['휴일'] || infoList['쉬는날'] || '';

        // Case for missing data via Cheerio -> Usually means JS-only rendering
        if (!description && !contact && !time) {
            console.log(`[DEBUG] No details for ${cotId} via Cheerio. Trying Puppeteer fallback...`);
            return await fetchDetailsWithPuppeteer(url);
        }

        return {
            description,
            contact,
            price,
            time,
            address,
            holiday
        };
    } catch (error: any) {
        console.error(`Error fetching details for ${cotId}:`, error.message);
        return null;
    }
}

// Global browser instance for detail fetching (reusable)
let _browser: any = null;

async function fetchDetailsWithPuppeteer(url: string) {
    const puppeteer = require('puppeteer-extra');
    const StealthPlugin = require('puppeteer-extra-plugin-stealth');
    puppeteer.use(StealthPlugin());

    if (!_browser) {
        _browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
    }

    const page = await _browser.newPage();
    // Shim for tsx/esbuild injected __name helper
    await page.evaluateOnNewDocument(() => {
        (window as any).__name = (f: any) => f;
    });
    try {
        await page.setViewport({ width: 1280, height: 800 });
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
        
        // Wait for potential dynamic content
        await page.waitForSelector('.inr_wrap', { timeout: 15000 }).catch(() => {});
        
        // Scroll slightly to trigger lazy loads
        await page.evaluate(() => window.scrollBy(0, 1000));
        await new Promise(r => setTimeout(r, 2000));

        const data = await page.evaluate(() => {
            // Description
            const descEl = document.querySelector('.inr_wrap .inr p, .char_cont p, .detail_cont, #detailinfoview .inr_wrap p');
            const description = descEl ? descEl.textContent?.replace(/\s+/g, ' ').trim() || '' : '';

            // Info items
            const info: Record<string, string> = {};
            document.querySelectorAll('.detail_info li').forEach(li => {
                const strong = li.querySelector('strong');
                const label = (strong ? strong.textContent?.replace(/\s+/g, ' ').trim() : '')?.replace(':', '') || '';
                const span = li.querySelector('span');
                let value = span ? span.textContent?.replace(/\s+/g, ' ').trim() : '';
                
                if (!value && label) {
                    value = li.textContent?.replace(label, '').replace(':', '').trim() || '';
                }
                if (label) info[label] = value || '';
            });

            return {
                description,
                contact: info['문의 및 안내'] || info['전화번호'] || info['문의'] || '',
                price: info['이용요금'] || info['입장료'] || '',
                time: info['이용시간'] || info['운영시간'] || '',
                address: info['주소'] || '',
                holiday: info['휴일'] || info['쉬는날'] || ''
            };
        });

        return data;
    } catch (e: any) {
        console.warn(`[Puppeteer WARN] ${url}: ${e.message}`);
        return null;
    } finally {
        await page.close();
    }
}

async function scrapeVisitKoreaPlaces(maxPages = 25) {
    console.log(`Starting VisitKorea Expanded Scraper (Max Pages: ${maxPages})...`);
    const endpoint = `${baseApiUrl}/api/v2/hot-place/place/list`;
    const results: Performance[] = [];

    for (let page = 1; page <= maxPages; page++) {
        console.log(`  Processing Page ${page}...`);
        try {
            const response = await axios.get(endpoint, {
                params: {
                    page,
                    offset: 15,
                    device: 'PC',
                    hotPlaceType: 'Place',
                    regionCode: '',
                    order: 'POPULAR',
                    type: 'place'
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://korean.visitkorea.or.kr/main/area_list.do?type=Place',
                }
            });

            if (response.data?.code === 0 && response.data?.data?.items) {
                const items = response.data.data.items;
                console.log(`    Found ${items.length} items on page ${page}.`);
                
                const enrichedItems = await Promise.all(items.map((item: any) => limit(async () => {
                    const details = await fetchDetails(item.cotId);
                    const areaCode = item.detailDatabase?.areaCode || '';
                    const region = AREA_MAP[areaCode] || '전국';
                    
                    const perf: Performance = {
                        id: `visitkorea_${item.cotId}`,
                        title: item.title,
                        venue: item.title,
                        region: region,
                        date: '상시',
                        image: item.detailDatabase?.firstImage 
                            ? (item.detailDatabase.firstImage.startsWith('http') ? item.detailDatabase.firstImage : `${baseImageURL}${item.detailDatabase.firstImage}`)
                            : '',
                        poster: item.detailDatabase?.firstImage 
                            ? (item.detailDatabase.firstImage.startsWith('http') ? item.detailDatabase.firstImage : `${baseImageURL}${item.detailDatabase.firstImage}`)
                            : '',
                        link: `${baseApiUrl}/detail/ms_detail.do?cotid=${item.cotId}`,
                        genre: 'tourism',
                        category: '관광/여행',
                        description: details?.description || '',
                        price: details?.price || '무료',
                        performanceTime: details?.time || '',
                        contact: details?.contact || '',
                        address: details?.address || item.detailDatabase?.addr1 || '',
                        bookingNotice: details?.holiday ? `휴무: ${details.holiday}` : '',
                        source: 'VisitKorea',
                        lat: item.detailDatabase?.mapCoords?.latitude,
                        lng: item.detailDatabase?.mapCoords?.longitude
                    };

                    return perf;
                })));

                results.push(...enrichedItems);
            } else {
                console.log(`    No more items found at page ${page}.`);
                break;
            }
        } catch (error: any) {
            console.error(`Error on page ${page}:`, error.message);
            break;
        }
    }

    if (_browser) {
        await _browser.close();
        _browser = null;
    }

    return results;
}

async function main() {
    const results = await scrapeVisitKoreaPlaces(25); // Increased to 25 pages
    
    // Deduplicate
    const uniqueMap = new Map();
    results.forEach(r => uniqueMap.set(r.id, r));
    const uniqueResults = Array.from(uniqueMap.values());

    console.log(`Total unique VisitKorea places: ${uniqueResults.length}`);

    let existingData: Performance[] = [];
    if (fs.existsSync(DATA_FILE)) {
        existingData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }

    // Replace VK entries in existing tourism data
    const filteredData = existingData.filter(p => !p.id.startsWith('visitkorea_'));
    const finalData = [...filteredData, ...uniqueResults];

    fs.writeFileSync(DATA_FILE, JSON.stringify(finalData, null, 2), 'utf-8');
    console.log(`Saved ${uniqueResults.length} unique VisitKorea items to tourism.json`);
}

main();
