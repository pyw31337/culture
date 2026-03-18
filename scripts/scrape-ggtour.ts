
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { Performance } from '../src/types';
import pLimit from 'p-limit';

const DATA_FILE = path.join(process.cwd(), 'src/data/performances.json');
const BASE_URL = 'https://www.ggtour.or.kr';
const LIST_API = `${BASE_URL}/api/v1/travel-info/tourism-info`;
const DETAIL_API = `${BASE_URL}/api/v1/travel-info/tourism-info/`;

const GGT_SGG_MAP: Record<string, string> = {
    '10': '수원', '12': '안성', '15': '안산', '16': '시흥', '17': '남양주', '18': '양평',
    '21': '광명', '22': '부천', '23': '안양', '24': '군포', '26': '과천', '27': '성남', '29': '구리',
    '30': '고양', '31': '의정부', '32': '양주', '33': '김포', '36': '동두천', '8': '광주', '44': '연천',
    '41': '포천', '43': '가평', '45': '여주', '46': '이천', '48': '용인', '40': '파주', '20': '의왕',
    '25': '하남', '13': '오산', '14': '화성', '11': '평택'
};

const limit = pLimit(5); // Concurrency for details

function cleanHtml(html: string | undefined | null): string {
    if (!html) return '';
    return html.replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();
}

async function fetchGGTDetail(cotId: string) {
    try {
        const response = await axios.get(`${DETAIL_API}${cotId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': `${BASE_URL}/travel-info/tourism-info`,
                'Accept': 'application/json, text/plain, */*'
            },
            timeout: 10000
        });

        if (response.data?.code === 0 && response.data?.data) {
            const d = response.data.data;
            return {
                description: cleanHtml(d.overview || d.intro),
                price: cleanHtml(d.additionalDetail?.useFee || d.additionalDetail?.parkingFee),
                time: cleanHtml(d.additionalDetail?.useTime),
                contact: d.tel || '',
                address: d.addr1 || '',
                website: cleanHtml(d.homepage),
                closedDays: cleanHtml(d.additionalDetail?.restDate),
                parking: cleanHtml(d.additionalDetail?.parkingInfo),
                petFriendly: cleanHtml(d.additionalDetail?.petInfo)
            };
        }
    } catch (error: any) {
        // Silently skip if detail fails
    }
    return null;
}

async function scrapeGGTour(maxPages = 230) {
    console.log(`Starting GGTour Scraper (Max Pages: ${maxPages})...`);
    const results: Performance[] = [];

    for (let page = 1; page <= maxPages; page++) {
        console.log(`  Processing GGTour Page ${page}...`);
        try {
            const response = await axios.get(LIST_API, {
                params: {
                    page,
                    sortBy: 'RECENTLY',
                    sgg: 0,
                    dbCategory2: 0,
                    keyword: ''
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': `${BASE_URL}/travel-info/tourism-info`,
                }
            });

            if (response.data?.code === 0 && response.data?.data?.items) {
                const items = response.data.data.items;
                if (items.length === 0) {
                    console.log(`    Empty items on page ${page}. Stopping.`);
                    break;
                }
                
                console.log(`    Found ${items.length} items on page ${page}.`);
                
                const enrichedItems = await Promise.all(items.map((item: any) => limit(async () => {
                    const details = await fetchGGTDetail(item.cotId);
                    const sggName = GGT_SGG_MAP[String(item.sgg)] || '';
                    const venue = sggName ? `${sggName} ${item.title}` : item.title;

                    const perf: Performance = {
                        id: `ggt_${item.cotId}`,
                        title: item.title,
                        venue: venue,
                        region: '경기',
                        date: '상시',
                        image: item.image ? (item.image.startsWith('http') ? item.image : `${BASE_URL}${item.image}`) : '',
                        poster: item.image ? (item.image.startsWith('http') ? item.image : `${BASE_URL}${item.image}`) : '',
                        link: `${BASE_URL}/travel-info/tourism-info/${item.cotId}`,
                        genre: 'tourism',
                        category: '관광/여행',
                        description: details?.description || '',
                        price: details?.price || '무료',
                        performanceTime: details?.time || '',
                        contact: details?.contact || '',
                        address: details?.address || '',
                        website: details?.website || '',
                        closedDays: details?.closedDays || '',
                        parking: details?.parking || '',
                        petFriendly: details?.petFriendly || '',
                        source: 'GGTour',
                        lat: item.coordinate?.mapY,
                        lng: item.coordinate?.mapX
                    };

                    // Specific Override for Jihyesaeme Children's Library
                    if (item.title.includes('지혜샘어린이도서관')) {
                        perf.address = '경기도 수원시 권선구 동탄원천로 818 지혜샘도서관';
                    }

                    return perf;
                })));

                results.push(...enrichedItems.filter(Boolean));
            } else {
                break;
            }
        } catch (error: any) {
            console.error(`Error on GGTour page ${page}:`, error.message);
            break;
        }
    }
    return results;
}

async function main() {
    const results = await scrapeGGTour(30); // 30 pages ~ 450 items for now
    
    const uniqueMap = new Map();
    results.forEach(r => uniqueMap.set(r.id, r));
    const uniqueResults = Array.from(uniqueMap.values());

    console.log(`Total unique GGTour places gathered: ${uniqueResults.length}`);

    let existingData: Performance[] = [];
    if (fs.existsSync(DATA_FILE)) {
        existingData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }

    const filteredData = existingData.filter(p => !p.id.startsWith('ggt_'));
    const finalData = [...filteredData, ...uniqueResults];

    fs.writeFileSync(DATA_FILE, JSON.stringify(finalData, null, 2), 'utf-8');
    console.log(`Saved ${uniqueResults.length} GGTour items to performances.json`);
}

main();
