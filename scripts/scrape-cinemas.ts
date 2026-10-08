import fs from 'fs';
import path from 'path';
import { atomicWriteJson } from './utils/scraper-utils';
import { requireKakaoRestKey } from './utils/env';

const OUTPUT_PATH = path.resolve(process.cwd(), 'src/data/cinemas.json');
const KAKAO_API_DISABLED = process.env.DISABLE_KAKAO_API === '1';

interface Cinema {
    name: string;
    address: string;
    lat: number;
    lng: number;
    brand: string;
}

/**
 * Kakao category-based filter (k-skill religious/place docs: trust Kakao `category_name`
 * rather than name heuristics). Cinemas are "문화,예술 > 영화,영화관 > ...".
 */
function isCinemaPlace(doc: { place_name?: string; category_name?: string }): boolean {
    const name = doc.place_name || '';
    const category = doc.category_name || '';
    if (!category.includes('영화관')) return false;
    // Sub-facilities that Kakao files under the cinema category.
    const invalidKeywords = ['주차장', '화장실', '매표소', '매점', '본사', '고객센터', '사무실', '물류', '엘리베이터', '출입구', '정문', '후문'];
    return !invalidKeywords.some((keyword) => name.includes(keyword));
}

function detectCinemaBrand(name = '', category = ''): string | null {
    const text = `${category} ${name}`.toLowerCase();
    if (/cgv/.test(text)) return 'CGV';
    if (/롯데\s?시네마|lotte\s?cinema/.test(text)) return '롯데시네마';
    if (/메가박스|megabox/.test(text)) return '메가박스';
    if (/씨네q|씨네큐(?!브)/.test(text)) return '씨네Q';
    return null;
}

async function fetchCinemasByKeyword(keyword: string, label: string): Promise<Cinema[]> {
    const KAKAO_API_KEY = requireKakaoRestKey();
    let allResults: Cinema[] = [];
    let page = 1;
    let isEnd = false;

    console.log(`Searching for ${label} (${keyword})...`);

    while (!isEnd && page <= 15) { // Max 15 pages for Kakao API
        try {
            const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(keyword)}&page=${page}&size=15`;
            const res = await fetch(url, {
                headers: { 'Authorization': `KakaoAK ${KAKAO_API_KEY}` },
                signal: AbortSignal.timeout(10000),
            });

            if (!res.ok) {
                console.error(`Kakao API Error: ${res.status}`);
                break;
            }

            const data = await res.json();
            if (data.documents) {
                const mapped = data.documents
                    .filter((doc: any) => isCinemaPlace(doc))
                    .map((doc: any) => ({
                        name: doc.place_name,
                        address: doc.road_address_name || doc.address_name,
                        lat: parseFloat(doc.y),
                        lng: parseFloat(doc.x),
                        // Brand comes from the place itself, not from the search query
                        // (e.g. "광주극장" also returns CGV/롯데시네마 branches in 광주).
                        brand: detectCinemaBrand(doc.place_name, doc.category_name) || '독립영화관',
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
    if (KAKAO_API_DISABLED) {
        if (fs.existsSync(OUTPUT_PATH)) {
            console.log('Kakao API disabled for this run; retaining existing cinema data.');
            return;
        }
        throw new Error('Kakao API disabled and no existing cinema data is available.');
    }

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
        const results = (await fetchCinemasByKeyword(kw, '독립영화관'))
            // Keep only real independents; chain branches near the keyword are collected above.
            .filter((cinema) => cinema.brand === '독립영화관');
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

    atomicWriteJson(OUTPUT_PATH, finalCinemaList);
    console.log(`Saved cinema data to ${OUTPUT_PATH}`);
}

main().then(() => {
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
