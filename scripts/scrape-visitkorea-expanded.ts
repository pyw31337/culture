
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { Performance } from '../src/types';
import pLimit from 'p-limit';

const DATA_FILE = path.join(process.cwd(), 'src/data/performances.json');
const baseApiUrl = 'https://korean.visitkorea.or.kr';
const baseImageURL = 'https://cdn.visitkorea.or.kr/img/call?cmd=VIEW&id=';

const AREA_MAP: Record<string, string> = {
    '1': '서울', '2': '인천', '3': '대전', '4': '대구', '5': '광주', '6': '부산', '7': '울산', '8': '세종',
    '31': '경기', '32': '강원', '33': '충북', '34': '충남', '35': '경북', '36': '경남', '37': '전북', '38': '전남', '39': '제주'
};

const limit = pLimit(3); // Conservative limit to avoid overloading

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
        const $ = cheerio.load(response.data);

        // Intro: #detailGo > div:nth-child(2) > div > div.inr_wrap > div > p
        let description = clean($('#detailGo > div:nth-child(2) > div > div.inr_wrap > div > p').text());
        if (!description) {
            description = clean($('.inr_wrap .char_cont p').first().text());
        }
        
        // Detailed info
        const infoList: Record<string, string> = {};
        $('.detail_info li').each((_, el) => {
            const label = $(el).find('strong').text().trim().replace(':', '');
            const value = $(el).find('span').text().trim();
            if (label && value) infoList[label] = value;
        });

        const contact = infoList['문의 및 안내'] || infoList['전화번호'] || '';
        const price = infoList['이용요금'] || infoList['입장료'] || '';
        const time = infoList['이용시간'] || '';

        return {
            description,
            contact,
            price,
            time
        };
    } catch (error: any) {
        console.error(`Error fetching details for ${cotId}:`, error.message);
        return null;
    }
}

async function scrapeVisitKoreaPlaces(maxPages = 10) {
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
                        id: `vk_place_${item.cotId}`,
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
    return results;
}

async function main() {
    const results = await scrapeVisitKoreaPlaces(15); // Start with 15 pages (approx 225 items)
    
    // Deduplicate
    const uniqueMap = new Map();
    results.forEach(r => uniqueMap.set(r.id, r));
    const uniqueResults = Array.from(uniqueMap.values());

    console.log(`Total unique VisitKorea places: ${uniqueResults.length}`);

    let existingData: Performance[] = [];
    if (fs.existsSync(DATA_FILE)) {
        existingData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }

    // Replace VK place entries
    const filteredData = existingData.filter(p => !p.id.startsWith('vk_place_'));
    const finalData = [...filteredData, ...uniqueResults];

    fs.writeFileSync(DATA_FILE, JSON.stringify(finalData, null, 2), 'utf-8');
    console.log('Saved data to performances.json');
}

main();
