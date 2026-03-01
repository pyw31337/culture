import fs from 'fs';
import path from 'path';

const KAKAO_API_KEY = 'e18ee199818819d830c3fe479aa1ca71';
const VENUES_PATH = path.join(__dirname, '../src/data/venues.json');

interface Venue {
    name?: string;
    address: string;
    district?: string;
    lat?: number;
    lng?: number;
    refined_name?: string;
    mapped_region_id?: string;
}

// === Korean address structure knowledge ===
// Valid 시/도: 서울, 부산, 대구, 인천, 광주, 대전, 울산, 세종, 경기, 강원, 충북, 충남, 전북, 전남, 경북, 경남, 제주
// Next level: 시/군/구 (e.g., 강남구, 수원시, 태안군)
// Pattern: "시/도 시/군/구 ..." — we need at least 2 administrative levels

const SIDO_PATTERNS = [
    '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
    '경기도', '경기', '강원도', '강원특별자치도', '강원',
    '충청북도', '충북', '충청남도', '충남',
    '전라북도', '전북', '전북특별자치도', '전라남도', '전남',
    '경상북도', '경북', '경상남도', '경남',
    '제주특별자치도', '제주', '제주도',
    '서울특별시', '부산광역시', '대구광역시', '인천광역시',
    '광주광역시', '대전광역시', '울산광역시', '세종특별자치시',
];

const SIGUNGU_SUFFIXES = ['시', '군', '구'];

function hasSiGunGu(address: string): boolean {
    if (!address || address.trim().length === 0) return false;

    const parts = address.trim().split(/\s+/);
    if (parts.length < 2) return false;

    // Check if the first part is a sido
    const firstPart = parts[0];
    const isSido = SIDO_PATTERNS.some(p => firstPart.includes(p));
    if (!isSido) return false;

    // Check if second part ends with 시, 군, or 구
    const secondPart = parts[1];
    const hasSGG = SIGUNGU_SUFFIXES.some(s => secondPart.endsWith(s));
    return hasSGG;
}

function isAddressLikelyIncomplete(venueName: string, address: string): string | null {
    if (!address || address.trim().length === 0) return '주소 없음';
    if (address.length < 5) return '주소 너무 짧음';

    // Check if starts with a known sido
    const parts = address.trim().split(/\s+/);
    const firstPart = parts[0];
    const isSido = SIDO_PATTERNS.some(p => firstPart.includes(p));

    if (!isSido) {
        // Address doesn't start with a province/city — might be road name only
        return '시/도 정보 없음';
    }

    if (!hasSiGunGu(address)) {
        return '시/군/구 정보 없음';
    }

    return null; // Address looks OK
}

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Kakao API: Keyword search (best for venue names)
async function kakaoKeywordSearch(query: string): Promise<any | null> {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`;
    try {
        const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` } });
        if (!res.ok) return null;
        const data = await res.json();
        return data.documents?.[0] || null;
    } catch { return null; }
}

// Kakao API: Address search
async function kakaoAddressSearch(query: string): Promise<any | null> {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}&size=1`;
    try {
        const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` } });
        if (!res.ok) return null;
        const data = await res.json();
        return data.documents?.[0] || null;
    } catch { return null; }
}

// Kakao API: Coordinate to address (reverse geocoding)
async function kakaoCoord2Address(lat: number, lng: number): Promise<any | null> {
    const url = `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${lng}&y=${lat}&input_coord=WGS84`;
    try {
        const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` } });
        if (!res.ok) return null;
        const data = await res.json();
        return data.documents?.[0] || null;
    } catch { return null; }
}

// Kakao API: Coordinate to region (reverse geocoding for region info)
async function kakaoCoord2Region(lat: number, lng: number): Promise<any | null> {
    const url = `https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${lng}&y=${lat}&input_coord=WGS84`;
    try {
        const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_API_KEY}` } });
        if (!res.ok) return null;
        const data = await res.json();
        // Return the H (행정동) type result
        return data.documents?.find((d: any) => d.region_type === 'H') || data.documents?.[0] || null;
    } catch { return null; }
}

async function main() {
    console.log('=========================================');
    console.log('  공연장/경기장 주소 정밀화 스크립트');
    console.log('=========================================\n');

    // Load venues
    const raw = fs.readFileSync(VENUES_PATH, 'utf-8');
    const venues: Record<string, Venue> = JSON.parse(raw);
    const keys = Object.keys(venues);

    console.log(`📊 전체 공연장/경기장 수: ${keys.length}\n`);

    // ==========================================
    // PHASE 1: Audit all addresses
    // ==========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Phase 1: 주소 전수 조사');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const problematic: { key: string; venue: Venue; reason: string }[] = [];
    let goodCount = 0;

    for (const key of keys) {
        const v = venues[key];
        const reason = isAddressLikelyIncomplete(key, v.address);
        if (reason) {
            problematic.push({ key, venue: v, reason });
        } else {
            goodCount++;
        }
    }

    console.log(`✅ 정상 주소: ${goodCount}건`);
    console.log(`⚠️  문제 주소: ${problematic.length}건\n`);

    // Categorize problems
    const byReason: Record<string, typeof problematic> = {};
    for (const p of problematic) {
        if (!byReason[p.reason]) byReason[p.reason] = [];
        byReason[p.reason].push(p);
    }

    for (const [reason, items] of Object.entries(byReason)) {
        console.log(`  [${reason}]: ${items.length}건`);
        // Show first 5 examples
        items.slice(0, 5).forEach(i => {
            console.log(`    - "${i.key}" → "${i.venue.address}" (${i.venue.lat ? '좌표O' : '좌표X'})`);
        });
        if (items.length > 5) console.log(`    ... +${items.length - 5}건 더`);
        console.log();
    }

    if (problematic.length === 0) {
        console.log('✨ 모든 주소가 정상입니다!');
        return;
    }

    // ==========================================
    // PHASE 2: Refine addresses using Kakao API
    // ==========================================
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Phase 2: 주소 정밀화 (Kakao API)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let fixedCount = 0;
    let failedCount = 0;
    const fixed: { key: string; oldAddress: string; newAddress: string; newLat: number; newLng: number }[] = [];
    const failed: { key: string; address: string; reason: string }[] = [];

    for (let i = 0; i < problematic.length; i++) {
        const { key, venue } = problematic[i];
        const progress = `[${i + 1}/${problematic.length}]`;

        // Strategy 1: Keyword search by venue name
        let result = await kakaoKeywordSearch(key);
        await sleep(100);

        if (result && result.road_address_name && hasSiGunGu(result.road_address_name)) {
            const newAddr = result.road_address_name;
            const newLat = parseFloat(result.y);
            const newLng = parseFloat(result.x);

            console.log(`${progress} ✅ "${key}"`);
            console.log(`    이전: "${venue.address}"`);
            console.log(`    이후: "${newAddr}" (키워드검색)`);
            console.log(`    좌표: ${newLat}, ${newLng}\n`);

            fixed.push({ key, oldAddress: venue.address, newAddress: newAddr, newLat, newLng });
            fixedCount++;
            continue;
        }

        // If keyword search returned address_name instead of road_address_name
        if (result && result.address_name && hasSiGunGu(result.address_name)) {
            const newAddr = result.address_name;
            const newLat = parseFloat(result.y);
            const newLng = parseFloat(result.x);

            console.log(`${progress} ✅ "${key}"`);
            console.log(`    이전: "${venue.address}"`);
            console.log(`    이후: "${newAddr}" (키워드검색-지번)`);
            console.log(`    좌표: ${newLat}, ${newLng}\n`);

            fixed.push({ key, oldAddress: venue.address, newAddress: newAddr, newLat, newLng });
            fixedCount++;
            continue;
        }

        // Strategy 2: Address search by current address text
        if (venue.address && venue.address.length > 3) {
            result = await kakaoAddressSearch(venue.address);
            await sleep(100);

            if (result) {
                const newAddr = result.road_address?.address_name || result.address?.address_name || '';
                if (newAddr && hasSiGunGu(newAddr)) {
                    const newLat = parseFloat(result.y);
                    const newLng = parseFloat(result.x);

                    console.log(`${progress} ✅ "${key}"`);
                    console.log(`    이전: "${venue.address}"`);
                    console.log(`    이후: "${newAddr}" (주소검색)`);
                    console.log(`    좌표: ${newLat}, ${newLng}\n`);

                    fixed.push({ key, oldAddress: venue.address, newAddress: newAddr, newLat, newLng });
                    fixedCount++;
                    continue;
                }
            }
        }

        // Strategy 3: Reverse geocoding from existing coordinates
        if (venue.lat && venue.lng && venue.lat !== 0 && venue.lng !== 0) {
            const revResult = await kakaoCoord2Address(venue.lat, venue.lng);
            await sleep(100);

            if (revResult) {
                const roadAddr = revResult.road_address?.address_name;
                const jibunAddr = revResult.address?.address_name;
                const bestAddr = roadAddr || jibunAddr || '';

                if (bestAddr && hasSiGunGu(bestAddr)) {
                    console.log(`${progress} ✅ "${key}"`);
                    console.log(`    이전: "${venue.address}"`);
                    console.log(`    이후: "${bestAddr}" (역지오코딩)`);
                    console.log(`    좌표: ${venue.lat}, ${venue.lng} (기존유지)\n`);

                    fixed.push({ key, oldAddress: venue.address, newAddress: bestAddr, newLat: venue.lat, newLng: venue.lng });
                    fixedCount++;
                    continue;
                }
            }

            // Strategy 3b: Region info from coordinates
            const regionResult = await kakaoCoord2Region(venue.lat, venue.lng);
            await sleep(100);

            if (regionResult) {
                const regionAddr = regionResult.address_name;
                if (regionAddr && hasSiGunGu(regionAddr)) {
                    // We have region info but need to geocode for precise address
                    // Use the region + original road info
                    const refinedAddr = regionAddr + ' ' + (venue.address || '');

                    console.log(`${progress} ⚡ "${key}"`);
                    console.log(`    이전: "${venue.address}"`);
                    console.log(`    이후: "${refinedAddr}" (지역코드+기존주소)`);
                    console.log(`    좌표: ${venue.lat}, ${venue.lng} (기존유지)\n`);

                    fixed.push({ key, oldAddress: venue.address, newAddress: refinedAddr, newLat: venue.lat, newLng: venue.lng });
                    fixedCount++;
                    continue;
                }
            }
        }

        // Strategy 4: Keyword search with "address" as query
        if (venue.address && venue.address.length > 3) {
            result = await kakaoKeywordSearch(venue.address);
            await sleep(100);

            if (result) {
                const newAddr = result.road_address_name || result.address_name || '';
                if (newAddr && hasSiGunGu(newAddr)) {
                    const newLat = parseFloat(result.y);
                    const newLng = parseFloat(result.x);

                    console.log(`${progress} ✅ "${key}"`);
                    console.log(`    이전: "${venue.address}"`);
                    console.log(`    이후: "${newAddr}" (주소키워드검색)`);
                    console.log(`    좌표: ${newLat}, ${newLng}\n`);

                    fixed.push({ key, oldAddress: venue.address, newAddress: newAddr, newLat, newLng });
                    fixedCount++;
                    continue;
                }
            }
        }

        // All strategies failed
        console.log(`${progress} ❌ "${key}" → 정밀화 실패`);
        console.log(`    현재주소: "${venue.address}"`);
        console.log(`    좌표: ${venue.lat || 'N/A'}, ${venue.lng || 'N/A'}\n`);
        failed.push({ key, address: venue.address, reason: '모든 전략 실패' });
        failedCount++;
    }

    // ==========================================
    // PHASE 3: Apply fixes to venues.json
    // ==========================================
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Phase 3: 수정사항 적용');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let updatedCount = 0;
    for (const fix of fixed) {
        const v = venues[fix.key];
        if (v) {
            v.address = fix.newAddress;
            // Update coordinates if different from existing
            if (fix.newLat && fix.newLng) {
                v.lat = fix.newLat;
                v.lng = fix.newLng;
            }
            // Extract district from new address
            const parts = fix.newAddress.split(/\s+/);
            if (parts.length >= 2) {
                const secondPart = parts[1];
                if (SIGUNGU_SUFFIXES.some(s => secondPart.endsWith(s))) {
                    v.district = secondPart;
                }
            }
            updatedCount++;
        }
    }

    // Save
    fs.writeFileSync(VENUES_PATH, JSON.stringify(venues, null, 2), 'utf-8');

    // ==========================================
    // Summary
    // ==========================================
    console.log('\n=========================================');
    console.log('  최종 결과 요약');
    console.log('=========================================\n');
    console.log(`📊 전체 문제 주소: ${problematic.length}건`);
    console.log(`✅ 정밀화 성공: ${fixedCount}건`);
    console.log(`❌ 정밀화 실패: ${failedCount}건`);
    console.log(`📝 venues.json 업데이트: ${updatedCount}건\n`);

    if (failed.length > 0) {
        console.log('━━━ 실패 목록 ━━━');
        failed.forEach(f => {
            console.log(`  - "${f.key}" → "${f.address}"`);
        });
    }

    console.log('\n✨ 주소 정밀화 작업 완료!');
}

main().catch(console.error);
