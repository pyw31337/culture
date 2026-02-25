import fs from 'fs';
import path from 'path';

const KAKAO_API_KEY = 'e18ee199818819d830c3fe479aa1ca71';
const OUTPUT_PATH = path.resolve(process.cwd(), 'src/data/cinemas.json');

interface Cinema {
    name: string;
    address: string;
    lat: number;
    lng: number;
    brand: string;
}

async function fetchCinemasByKeyword(keyword: string, brand: string): Promise<Cinema[]> {
    let allResults: Cinema[] = [];
    let page = 1;
    let isEnd = false;

    console.log(`Searching for ${brand} (${keyword})...`);

    while (!isEnd && page <= 15) { // Max 15 pages for Kakao API
        try {
            const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(keyword)}&page=${page}&size=15`;
            const res = await fetch(url, {
                headers: { 'Authorization': `KakaoAK ${KAKAO_API_KEY}` }
            });

            if (!res.ok) {
                console.error(`Kakao API Error: ${res.status}`);
                break;
            }

            const data = await res.json();
            if (data.documents) {
                const mapped = data.documents.map((doc: any) => ({
                    name: doc.place_name,
                    address: doc.road_address_name || doc.address_name,
                    lat: parseFloat(doc.y),
                    lng: parseFloat(doc.x),
                    brand
                }));
                allResults.push(...mapped);
            }

            isEnd = data.meta.is_end;
            page++;

            // Wait slightly to avoid rate limit
            await new Promise(r => setTimeout(r, 100));
        } catch (error) {
            console.error(`Failed to fetch ${keyword}:`, error);
            break;
        }
    }

    return allResults;
}

async function main() {
    console.log('Starting nationwide cinema data collection (Comprehensive Region Search)...');

    const brands = [
        { name: 'CGV', keyword: 'CGV' },
        { name: '메가박스', keyword: '메가박스' },
        { name: '롯데시네마', keyword: '롯데시네마' },
        { name: '씨네Q', keyword: '씨네Q' }
    ];

    const regions = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];

    // Additional special independent cinemas
    const independentKeywords = ['인디스페이스', '에무시네마', '아트나인', '씨네큐브', '오오극장', '광주극장', '더숲 아트시네마', '필름포럼'];

    const allCinemas: Record<string, Cinema> = {};

    for (const region of regions) {
        for (const brand of brands) {
            const query = `${region} ${brand.keyword}`;
            const results = await fetchCinemasByKeyword(query, brand.name);
            results.forEach(c => {
                allCinemas[c.name] = c;
            });
        }
    }

    // Fetch independent ones separately
    for (const kw of independentKeywords) {
        const results = await fetchCinemasByKeyword(kw, '독립영화관');
        results.forEach(c => {
            allCinemas[c.name] = c;
        });
    }

    const cinemaList = Object.values(allCinemas);
    console.log(`Total unique cinemas collected: ${cinemaList.length}`);

    // Sort by name
    cinemaList.sort((a, b) => a.name.localeCompare(b.name));

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(cinemaList, null, 2), 'utf8');
    console.log(`Saved cinema data to ${OUTPUT_PATH}`);
}

main().then(() => {
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
