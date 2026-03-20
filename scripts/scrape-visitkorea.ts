
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
    '1': '서울',
    '2': '인천',
    '3': '대전',
    '4': '대구',
    '5': '광주',
    '6': '부산',
    '7': '울산',
    '8': '세종',
    '31': '경기',
    '32': '강원',
    '33': '충북',
    '34': '충남',
    '35': '경북',
    '36': '경남',
    '37': '전북',
    '38': '전남',
    '39': '제주'
};

const limit = pLimit(5); // Limit parallel detail fetching

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
            }
        });
        const $ = cheerio.load(response.data);

        // Intro: #detailGo > div:nth-child(2) > div > div.inr_wrap > div > p
        const description = clean($('#detailGo > div:nth-child(2) > div > div.inr_wrap > div > p').text());
        
        // Detailed info: #detailinfoview > div > div.inr_wrap > div
        const detailedInfo = clean($('#detailinfoview > div > div.inr_wrap > div').text());

        // Also try to find a more robust info list
        const infoList: Record<string, string> = {};
        $('.detail_info li').each((_, el) => {
            const label = $(el).find('strong').text().trim().replace(':', '');
            const value = $(el).find('span').text().trim();
            if (label && value) infoList[label] = value;
        });

        // Contact info often in detailed list
        const contact = infoList['문의 및 안내'] || infoList['전화번호'] || '';
        const price = infoList['이용요금'] || infoList['입장료'] || '';
        const time = infoList['이용시간'] || '';

        return {
            description,
            detailedInfo,
            contact,
            price,
            time
        };
    } catch (error: any) {
        console.error(`Error fetching details for ${cotId}:`, error.message);
        return null;
    }
}

async function scrapeTourism(innerType: 'popular' | 'hotPlace', maxPages = 2) {
    console.log(`Scraping VisitKorea: ${innerType}...`);
    const endpoint = `${baseApiUrl}/api/v2/hot-place/tmap/list`;
    const results: Performance[] = [];

    for (let page = 1; page <= maxPages; page++) {
        console.log(`  Page ${page}...`);
        try {
            const response = await axios.get(endpoint, {
                params: {
                    innerType,
                    regionCode: 0,
                    page,
                    ageGroup: 0,
                    latitude: 37.5665,
                    longitude: 126.9780,
                    offset: 20
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://korean.visitkorea.or.kr/main/area_tmap.do?regionCode=0',
                }
            });

            if (response.data?.code === 0 && response.data?.data?.items) {
                const items = response.data.data.items;
                
                const enrichedItems = await Promise.all(items.map((item: any) => limit(async () => {
                    const details = await fetchDetails(item.cotId);
                    
                    const areaCode = item.detailDatabase?.areaCode || '';
                    const region = AREA_MAP[areaCode] || '전국';
                    
                    const perf: Performance = {
                        id: `visitkorea_${item.cotId}`,
                        title: item.title,
                        venue: item.title,
                        region: region,
                        date: '상시', // Added date field
                        image: item.detailDatabase?.firstImage 
                            ? (item.detailDatabase.firstImage.startsWith('http') ? item.detailDatabase.firstImage : `${baseImageURL}${item.detailDatabase.firstImage}`)
                            : '', // Also use 'image' or 'poster'
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
                    };

                    return perf;
                })));

                results.push(...enrichedItems);
            }
        } catch (error: any) {
            console.error(`Error on page ${page}:`, error.message);
            break;
        }
    }
    return results;
}

async function main() {
    const popular = await scrapeTourism('popular', 2);
    const hotPlace = await scrapeTourism('hotPlace', 2);
    
    const allResults = [...popular, ...hotPlace];
    
    // Deduplicate by ID
    const uniqueMap = new Map();
    allResults.forEach(r => uniqueMap.set(r.id, r));
    const uniqueResults = Array.from(uniqueMap.values());

    console.log(`Total unique tourism items: ${uniqueResults.length}`);

    // Merge with existing data
    let existingData: Performance[] = [];
    if (fs.existsSync(DATA_FILE)) {
        existingData = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }

    // Remove old VisitKorea entries and add new ones
    const filteredData = existingData.filter(p => !p.id.startsWith('visitkorea_'));
    const finalData = [...filteredData, ...uniqueResults];

    fs.writeFileSync(DATA_FILE, JSON.stringify(finalData, null, 2), 'utf-8');
    console.log('Successfully saved tourism data to performances.json');
}

main();
