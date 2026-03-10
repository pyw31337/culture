import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import fs from 'fs';
import path from 'path';

// --- Configuration ---
const API_KEY = 'ba7dc8feda8a4e66a90e43fcdb03c35a';
const BASE_URL = 'http://www.kopis.or.kr/openApi/restful';
const DATA_DIR = path.join(process.cwd(), 'src/data');
const OUTPUT_FILE = path.join(DATA_DIR, 'kopis-performances.json');
const RATE_LIMIT_DELAY = 100; // ms between requests

const parser = new XMLParser();

// --- Types ---
interface KopisPerformance {
    id: string;
    title: string;
    image: string;
    date: string; // "YYYY.MM.DD ~ YYYY.MM.DD"
    venue: string;
    link: string;
    genre: string;
    price: string;
    time?: string;
    region?: string;
    source: 'kopis';
}

// --- Utils ---
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function slugify(text: string): string {
    return text
        .replace(/[^a-zA-Z0-9가-힣]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

async function fetchWithRetry(url: string, params: any, retries = 3): Promise<any> {
    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.get(url, { params, timeout: 10000 });
            return response.data;
        } catch (e: any) {
            if (i === retries - 1) throw e;
            console.warn(`Retrying ${url} (${i + 1}/${retries})...`);
            await delay(1000 * (i + 1));
        }
    }
}

// --- Main Logic ---
async function scrapeKopis() {
    console.log("🚀 Starting KOPIS 'Currently Running' Scraper...");
    
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    let existingData: KopisPerformance[] = [];
    if (fs.existsSync(OUTPUT_FILE)) {
        try {
            existingData = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf-8'));
            console.log(`Loaded ${existingData.length} existing items.`);
        } catch (e) {
            console.warn('Could not parse existing data, starting fresh.');
        }
    }

    const today = new Date();
    const stdate = today.toISOString().split('T')[0].replace(/-/g, '');
    const eddate = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate())
        .toISOString().split('T')[0].replace(/-/g, '');

    console.log(`Searching from ${stdate} to ${eddate}...`);

    let allItems: KopisPerformance[] = [];
    let page = 1;
    let hasMore = true;

    // 1. Fetch List
    while (hasMore) {
        console.log(`Fetching List Page ${page}...`);
        const xmlData = await fetchWithRetry(`${BASE_URL}/pblprfr`, {
            service: API_KEY,
            stdate: '20260101', // Wide range to catch all current
            eddate: '20261231',
            cpage: page,
            rows: 100,
            prfstate: '02' // Currently Running
        });

        const jsonObj = parser.parse(xmlData);
        const dbs = jsonObj.dbs?.db;

        if (!dbs) {
            hasMore = false;
            break;
        }

        const list = Array.isArray(dbs) ? dbs : [dbs];
        
        for (const item of list) {
            const mt20id = item.mt20id;
            
            // Optimization: Skip detail fetch if it exists and is recent (Basic check for now)
            const existing = existingData.find(e => e.id === `kopis_${mt20id}`);
            
            if (existing) {
                allItems.push(existing);
                continue;
            }

            // 2. Fetch Detail
            try {
                process.stdout.write(`.`);
                await delay(RATE_LIMIT_DELAY);
                const detailXml = await fetchWithRetry(`${BASE_URL}/pblprfr/${mt20id}`, {
                    service: API_KEY
                });
                
                const detailObj = parser.parse(detailXml);
                const db = detailObj.dbs?.db;

                if (db) {
                    allItems.push({
                        id: `kopis_${mt20id}`,
                        title: db.prfnm,
                        image: db.poster,
                        date: `${db.prfpdfrom} ~ ${db.prfpdto}`,
                        venue: db.fcltynm,
                        link: `https://www.kopis.or.kr/por/db/pblprfr/pblprfrView.do?menuId=MNU_00020&mt20Id=${mt20id}`,
                        genre: db.genrenm,
                        price: db.pcseguidance || '정보없음',
                        time: db.dtguidance,
                        region: db.area,
                        source: 'kopis'
                    });
                }
            } catch (e: any) {
                console.error(`\nFailed to fetch detail for ${mt20id}:`, e.message);
                // Push minimal data if detail fails
                allItems.push({
                    id: `kopis_${mt20id}`,
                    title: item.prfnm,
                    image: item.poster,
                    date: `${item.prfpdfrom} ~ ${item.prfpdto}`,
                    venue: item.fcltynm,
                    link: `https://www.kopis.or.kr/por/db/pblprfr/pblprfrView.do?menuId=MNU_00020&mt20Id=${mt20id}`,
                    genre: item.genrenm,
                    price: '정보없음',
                    source: 'kopis'
                });
            }
        }

        console.log(`\nPage ${page} processed. Total: ${allItems.length}`);
        
        // Save intermediate results
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allItems, null, 2));

        if (list.length < 100 || page > 30) { // Limit to 3000 items for safety in first run
            hasMore = false;
        } else {
            page++;
        }
    }

    console.log(`✅ Scrape Complete! Saved ${allItems.length} items to ${OUTPUT_FILE}`);
}

scrapeKopis().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
