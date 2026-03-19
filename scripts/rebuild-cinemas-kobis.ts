/**
 * Rebuild cinemas.json from the official KOBIS theater list
 * Source: https://www.kobis.or.kr/kobis/business/mast/thea/findTheaterInfoList.do
 * 
 * Steps:
 * 1. Fetch all ~600 theaters from KOBIS paginated list API
 * 2. Fetch detailed address for each theater
 * 3. Geocode addresses using Kakao API to get lat/lng
 * 4. Write to src/data/cinemas.json
 */

import * as fs from 'fs';
import * as path from 'path';

const KAKAO_API_KEY = process.env.KAKAO_REST_API_KEY || '';
const OUTPUT_PATH = path.resolve(process.cwd(), 'src/data/cinemas.json');

interface Cinema {
    name: string;
    address: string;
    lat: number;
    lng: number;
    brand: string;
    theaCode?: string;
}

// Detect brand from theater name
function detectBrand(name: string): string {
    const n = name.toLowerCase();
    if (n.startsWith('cgv') || n.includes('cgv')) return 'CGV';
    if (n.includes('메가박스') || n.includes('megabox')) return '메가박스';
    if (n.includes('롯데시네마') || n.includes('롯데 시네마') || n.includes('lotte')) return '롯데시네마';
    if (n.includes('씨네') || n.includes('시네마') || n.includes('cine')) return '기타';
    if (n.includes('극장')) return '기타';
    return '독립영화관';
}

// Step 1: Fetch all theater codes from KOBIS list API
async function fetchAllTheaterCodes(): Promise<{ theaCd: string; theaNm: string }[]> {
    const allTheaters: { theaCd: string; theaNm: string }[] = [];
    let page = 1;
    const PAGE_SIZE = 10;

    console.log('Fetching theater list from KOBIS...');

    while (true) {
        const formData = new URLSearchParams();
        formData.append('pageIndex', page.toString());

        const res = await fetch('https://www.kobis.or.kr/kobis/business/mast/thea/findTheaterInfoList.do', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                'Referer': 'https://www.kobis.or.kr/kobis/business/mast/thea/findTheaterInfoList.do'
            },
            body: formData.toString()
        });

        if (!res.ok) {
            console.error(`KOBIS list API error: ${res.status}`);
            break;
        }

        const html = await res.text();

        // Parse theater codes and names from HTML table
        // Pattern: fn_detail(event, $(this), '001154');...>CGV 왕십리</a>
        const regex = /fn_detail\(event,\s*\$\(this\),\s*'(\d+)'\)[^>]*>([^<]+)<\/a>/g;
        let match;
        let pageCount = 0;

        while ((match = regex.exec(html)) !== null) {
            allTheaters.push({
                theaCd: match[1],
                theaNm: match[2].trim()
            });
            pageCount++;
        }

        console.log(`  Page ${page}: ${pageCount} theaters (total: ${allTheaters.length})`);

        if (pageCount < PAGE_SIZE) break;
        page++;
        await new Promise(r => setTimeout(r, 100));
    }

    console.log(`Total theaters fetched: ${allTheaters.length}`);
    return allTheaters;
}

// Step 2: Fetch address from KOBIS detail API
async function fetchTheaterAddress(theaCd: string): Promise<string> {
    try {
        const res = await fetch(`https://www.kobis.or.kr/kobis/business/mast/thea/findTheaterCodeLayer.do?theaCd=${theaCd}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
                'Referer': 'https://www.kobis.or.kr/kobis/business/mast/thea/findTheaterInfoList.do'
            }
        });

        if (!res.ok) return '';

        const html = await res.text();

        // Parse address from detail popup HTML
        // Pattern: 주소</th>\n<td colspan="3">\n(ZIP) 서울특별시 성동구...
        const addrMatch = html.match(/주\s*소[\s\S]*?<td[^>]*>\s*(?:\([\d\s-]+\))?\s*([^<]+)/i);

        if (addrMatch) {
            // Clean up: remove leading/trailing whitespace, zip codes
            let addr = addrMatch[1].trim().replace(/^\([\d\s-]+\)\s*/, '');
            return addr;
        }

        // Fallback: try to find any Korean address pattern
        const korAddrMatch = html.match(/([가-힣]+(?:특별시|광역시|도)\s+[가-힣]+(?:시|구|군)[^\n<]{5,50})/);
        if (korAddrMatch) return korAddrMatch[1].trim();

        return '';
    } catch (e) {
        return '';
    }
}

// Step 3: Geocode address using Kakao API
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    if (!address) return null;

    try {
        const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`;
        const res = await fetch(url, {
            headers: { 'Authorization': `KakaoAK ${KAKAO_API_KEY}` }
        });

        if (!res.ok) return null;

        const data = await res.json();
        if (data.documents && data.documents.length > 0) {
            const doc = data.documents[0];
            return {
                lat: parseFloat(doc.y),
                lng: parseFloat(doc.x)
            };
        }

        // Fallback: try keyword search
        const keywordUrl = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(address)}`;
        const keywordRes = await fetch(keywordUrl, {
            headers: { 'Authorization': `KakaoAK ${KAKAO_API_KEY}` }
        });

        if (keywordRes.ok) {
            const keywordData = await keywordRes.json();
            if (keywordData.documents && keywordData.documents.length > 0) {
                return {
                    lat: parseFloat(keywordData.documents[0].y),
                    lng: parseFloat(keywordData.documents[0].x)
                };
            }
        }

        return null;
    } catch (e) {
        return null;
    }
}

async function main() {
    console.log('=== KOBIS 기반 영화관 데이터 재정비 ===\n');

    // Step 1: Get all theater codes
    const theaters = await fetchAllTheaterCodes();

    if (theaters.length === 0) {
        console.error('No theaters found! Aborting.');
        process.exit(1);
    }

    // Step 2 & 3: Get address + geocode for each theater
    const cinemas: Cinema[] = [];
    let noAddress = 0;
    let noCoords = 0;

    for (let i = 0; i < theaters.length; i++) {
        const t = theaters[i];
        const progress = `[${i + 1}/${theaters.length}]`;

        // Get address
        const address = await fetchTheaterAddress(t.theaCd);
        await new Promise(r => setTimeout(r, 50));

        if (!address) {
            // Fallback: try geocoding the theater name directly
            const nameCoords = await geocodeAddress(t.theaNm);
            if (nameCoords) {
                cinemas.push({
                    name: t.theaNm,
                    address: '',
                    lat: nameCoords.lat,
                    lng: nameCoords.lng,
                    brand: detectBrand(t.theaNm),
                    theaCode: t.theaCd
                });
                console.log(`${progress} ${t.theaNm} - addr not found, geocoded by name: ✓`);
            } else {
                noAddress++;
                console.log(`${progress} ${t.theaNm} - ✗ no address or coords`);
            }
            continue;
        }

        // Geocode address
        const coords = await geocodeAddress(address);
        await new Promise(r => setTimeout(r, 30));

        if (!coords) {
            // Try geocoding by name
            const nameCoords = await geocodeAddress(t.theaNm);
            if (nameCoords) {
                cinemas.push({
                    name: t.theaNm,
                    address,
                    lat: nameCoords.lat,
                    lng: nameCoords.lng,
                    brand: detectBrand(t.theaNm),
                    theaCode: t.theaCd
                });
                console.log(`${progress} ${t.theaNm} - geocoded by name: ${address}`);
            } else {
                noCoords++;
                cinemas.push({
                    name: t.theaNm,
                    address,
                    lat: 0,
                    lng: 0,
                    brand: detectBrand(t.theaNm),
                    theaCode: t.theaCd
                });
                console.log(`${progress} ${t.theaNm} - ✗ coords failed: ${address}`);
            }
        } else {
            cinemas.push({
                name: t.theaNm,
                address,
                lat: coords.lat,
                lng: coords.lng,
                brand: detectBrand(t.theaNm),
                theaCode: t.theaCd
            });
            console.log(`${progress} ${t.theaNm} - ✓ ${address} (${coords.lat}, ${coords.lng})`);
        }
    }

    // Remove theaCode before saving (internal use only)
    const output = cinemas
        .filter(c => c.lat !== 0 && c.lng !== 0)  // Only keep geocoded entries
        .map(({ theaCode, ...rest }) => rest)
        .sort((a, b) => a.name.localeCompare(b.name));

    console.log(`\n=== Results ===`);
    console.log(`Total theaters from KOBIS: ${theaters.length}`);
    console.log(`Successfully geocoded: ${output.length}`);
    console.log(`No address: ${noAddress}`);
    console.log(`No coordinates: ${noCoords}`);

    // Brand distribution
    const brandCounts: Record<string, number> = {};
    output.forEach(c => { brandCounts[c.brand] = (brandCounts[c.brand] || 0) + 1; });
    console.log(`\nBrand distribution:`);
    Object.entries(brandCounts).sort((a, b) => b[1] - a[1]).forEach(([brand, count]) => {
        console.log(`  ${brand}: ${count}`);
    });

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');
    console.log(`\nSaved ${output.length} cinemas to ${OUTPUT_PATH}`);
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
