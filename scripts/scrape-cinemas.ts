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
                const mapped = data.documents
                    .filter((doc: any) => {
                        // 1. Exclude non-cinema facilities by keyword
                        const invalidKeywords = ['주차장', '화장실', '매표소', '매점', '본사', '고객센터', '오피스', '사무실', '물류', '엘리베이터', '타워'];
                        if (invalidKeywords.some(kw => doc.place_name.includes(kw))) return false;
                        if (doc.category_name && (doc.category_name.includes('주차장') || doc.category_name.includes('화장실'))) return false;

                        // 2. Category-based filter: Kakao categories for cinemas typically include '영화관' or '문화시설'
                        // Exclude obvious non-cinema categories
                        const nonCinemaCategories = ['음식점', '카페', '편의점', '주유소', '통신', '은행', '미용', '세탁', '약국', '학원', '부동산', '숙박', '주차', '자동차', '골프', '노래', '치킨', '피자', '버거', '족발', '감자탕', '네일'];
                        if (doc.category_name && nonCinemaCategories.some(cat => doc.category_name.includes(cat))) return false;

                        // 3. Name-prefix filter: Real cinemas start with cinema brand names
                        const name = doc.place_name || '';
                        const cinemaPrefixes = ['CGV', 'cgv', '메가박스', 'MEGABOX', '롯데시네마', '롯데 시네마', 'LOTTE', '씨네', '시네마', '극장', '영화', '필름', '아트하우스', '인디스페이스', '에무시네마', '오오극장', '브로드웨이'];
                        const startsWithCinema = cinemaPrefixes.some(prefix => name.toLowerCase().startsWith(prefix.toLowerCase()));
                        if (!startsWithCinema) return false;

                        return true;
                    })
                    .map((doc: any) => ({
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
    console.log(`Total cinemas collected before coordinate dedup: ${cinemaList.length}`);

    // Deduplicate by Coordinates (Same physical building/address)
    const uniqueByCoords = new Map<string, Cinema>();
    for (const c of cinemaList) {
        // Use 4 decimal places (~11m resolution) for the strict same location
        const key = `${c.lat.toFixed(4)}_${c.lng.toFixed(4)}`;

        if (uniqueByCoords.has(key)) {
            const existing = uniqueByCoords.get(key)!;
            // Prefer the shorter name to drop suffixes like 'CGV 대학로 개방화장실' or 'CGV 대학로점'
            if (c.name.length < existing.name.length) {
                uniqueByCoords.set(key, c);
            }
        } else {
            uniqueByCoords.set(key, c);
        }
    }

    const finalCinemaList = Array.from(uniqueByCoords.values());
    console.log(`Total unique root cinemas after deduplication: ${finalCinemaList.length}`);

    // Sort by name
    finalCinemaList.sort((a, b) => a.name.localeCompare(b.name));

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(finalCinemaList, null, 2), 'utf8');
    console.log(`Saved cinema data to ${OUTPUT_PATH}`);
}

main().then(() => {
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
