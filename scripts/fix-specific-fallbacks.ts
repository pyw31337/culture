import fs from 'fs';
import path from 'path';

const KAKAO_API_KEY = 'e18ee199818819d830c3fe479aa1ca71';
const VENUES_PATH = path.join(process.cwd(), 'src/data/venues.json');

interface Venue {
    name?: string;
    address: string;
    district?: string;
    lat?: number;
    lng?: number;
    refined_name?: string;
    mapped_region_id?: string;
}

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanKoreanAddress(address: string): string {
    if (!address) return '';
    
    // Normalize spaces
    let clean = address.replace(/\s+/g, ' ').trim();
    
    // 1. Remove parenthetical descriptions at the end
    clean = clean.replace(/\s*\(.*?\)\s*$/, '');
    clean = clean.replace(/\s*\(.*?\)\s*\d+호\s*$/, '');
    
    // 2. Remove room/floor/building details at the end
    clean = clean.replace(/\s*\d+동\s*\d+층\s*\d+호.*$/, '');
    clean = clean.replace(/\s*\d+동\s*\d+호.*$/, '');
    clean = clean.replace(/\s*\d+층\s*\d+호.*$/, '');
    clean = clean.replace(/\s*\d+호.*$/, '');
    clean = clean.replace(/\s*\d+층.*$/, '');
    clean = clean.replace(/\s*상가\s*\d+호.*$/, '');
    clean = clean.replace(/\s*상가동.*$/, '');
    clean = clean.replace(/\s*지하\s*\d+층.*$/, '');
    clean = clean.replace(/\s*지하\s*\d+호.*$/, '');
    
    return clean.trim();
}

function getFallbackRegionQueries(name: string, address: string): string[] {
    const text = (address && address !== '정보 없음') ? address : name;
    if (!text) return [];

    const parts = text.replace(/\s+/g, ' ').trim().split(/\s+/);
    const cleanParts = parts.filter(p => !p.match(/\d/) && !p.includes('호') && !p.includes('층'));
    
    const queries: string[] = [];
    if (cleanParts.length >= 3) {
        queries.push(cleanParts.slice(0, 3).join(' '));
    }
    if (cleanParts.length >= 2) {
        queries.push(cleanParts.slice(0, 2).join(' '));
    }
    if (cleanParts.length >= 1) {
        queries.push(cleanParts.slice(0, 1).join(' '));
    }

    return queries;
}

async function kakaoKeywordSearch(query: string): Promise<any | null> {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`;
    try {
        const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` } });
        if (!res.ok) return null;
        const data = await res.json();
        return data.documents?.[0] || null;
    } catch { return null; }
}

async function kakaoAddressSearch(query: string): Promise<any | null> {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}&size=1`;
    try {
        const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` } });
        if (!res.ok) return null;
        const data = await res.json();
        return data.documents?.[0] || null;
    } catch { return null; }
}

async function queryKakaoLocation(name: string, address: string): Promise<{ lat: number; lng: number; address: string } | null> {
    const queries = [];

    // Strategy 1: Cleaned specific address (if valid)
    if (address && address !== '정보 없음') {
        const cleanedAddr = cleanKoreanAddress(address);
        queries.push({ type: 'address', q: cleanedAddr });
        
        // Strip dong name from address (e.g. "신호동" -> "")
        const noDong = cleanedAddr.replace(/\b\S+동\b/g, '').replace(/\s+/g, ' ').trim();
        if (noDong !== cleanedAddr && noDong.length > 5) {
            queries.push({ type: 'address', q: noDong });
        }
    }

    // Strategy 2: Cleaned venue name as address (if it looks like an address)
    if (name.includes('서울') || name.includes('부산') || name.includes('경기') || name.includes('인천')) {
        const cleanedNameAddr = cleanKoreanAddress(name);
        queries.push({ type: 'address', q: cleanedNameAddr });
        
        const noDongName = cleanedNameAddr.replace(/\b\S+동\b/g, '').replace(/\s+/g, ' ').trim();
        if (noDongName !== cleanedNameAddr && noDongName.length > 5) {
            queries.push({ type: 'address', q: noDongName });
        }
    }

    // Strategy 3: Keyword search on the venue name
    let cleanName = name.replace(/\s*\d+호.*$/, '').replace(/\s*\d+층.*$/, '').trim();
    cleanName = cleanName.replace(/^(서울특별시|부산광역시|인천광역시|대구광역시|광주광역시|대전광역시|울산광역시|경기도|서울|부산|경기|인천|대구)\s+(\S+구\s+)?/, '');
    if (cleanName.length > 1) {
        queries.push({ type: 'keyword', q: cleanName });
        
        if (address && address !== '정보 없음') {
            const sido = address.split(/\s+/)[0];
            queries.push({ type: 'keyword', q: `${sido} ${cleanName}` });
        } else if (name.includes('부산') || name.includes('서울')) {
            const sido = name.startsWith('부산') ? '부산' : '서울';
            queries.push({ type: 'keyword', q: `${sido} ${cleanName}` });
        }
    }

    // Strategy 4: Final region fallback queries
    const fallbackRegions = getFallbackRegionQueries(name, address);
    for (const r of fallbackRegions) {
        queries.push({ type: 'address', q: r });
    }

    for (const item of queries) {
        console.log(`  -> Querying: [${item.type}] "${item.q}"`);
        let doc = null;
        if (item.type === 'address') {
            doc = await kakaoAddressSearch(item.q);
        } else {
            doc = await kakaoKeywordSearch(item.q);
        }
        await sleep(100);
        
        if (doc) {
            const newAddr = doc.road_address_name || doc.address_name || doc.road_address?.address_name || doc.address?.address_name;
            const lat = parseFloat(doc.y);
            const lng = parseFloat(doc.x);
            if (lat && lng && newAddr) {
                return { lat, lng, address: newAddr };
            }
        }
    }

    return null;
}

async function main() {
    console.log('Starting specific address refinement with fallback region strategy...');
    const raw = fs.readFileSync(VENUES_PATH, 'utf-8');
    const venues: Record<string, Venue> = JSON.parse(raw);
    const keys = Object.keys(venues);

    let updated = 0;

    for (const key of keys) {
        const v = venues[key];
        const isGangseoFallback = v.lat && v.lng && 
            Math.abs(v.lat - 37.5509) < 0.001 && 
            Math.abs(v.lng - 126.8497) < 0.001;

        const isBusanMismatch = key.includes('부산') || (v.address && (v.address.includes('부산') || v.address.includes('신호동') || v.address.includes('명지')));
        const hasSpecificAddress = (v.address && v.address !== '정보 없음' && v.address.length > 5) || key.length > 8;

        if (isGangseoFallback && (isBusanMismatch || hasSpecificAddress)) {
            console.log(`Processing: "${key}" | Current Coords: ${v.lat}, ${v.lng} | Address: "${v.address}"`);

            const result = await queryKakaoLocation(key, v.address);

            if (result) {
                console.log(`  -> SUCCESS! New Coords: ${result.lat}, ${result.lng} | New Addr: "${result.address}"`);
                v.lat = result.lat;
                v.lng = result.lng;
                v.address = result.address;
                
                // Parse district
                const parts = result.address.split(/\s+/);
                if (parts.length >= 2) {
                    const secondPart = parts[1];
                    if (secondPart.endsWith('구') || secondPart.endsWith('시') || secondPart.endsWith('군')) {
                        v.district = secondPart;
                    }
                }
                updated++;
            } else {
                console.log(`  -> FAILED: All queries returned no results`);
            }
        }
    }

    if (updated > 0) {
        fs.writeFileSync(VENUES_PATH, JSON.stringify(venues, null, 2), 'utf-8');
        console.log(`Updated ${updated} venues in venues.json.`);
    } else {
        console.log('No venues needed update.');
    }
}

main().catch(console.error);
