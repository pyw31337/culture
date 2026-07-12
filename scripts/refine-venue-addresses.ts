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

const DISTRICT_COORDS: Record<string, { lat: number, lng: number }> = {
    '강남구': { lat: 37.5172, lng: 127.0473 },
    '강동구': { lat: 37.5301, lng: 127.1238 },
    '강북구': { lat: 37.6396, lng: 127.0257 },
    '강서구': { lat: 37.5509, lng: 126.8497 },
    '관악구': { lat: 37.4784, lng: 126.9516 },
    '광진구': { lat: 37.5385, lng: 127.0824 },
    '구로구': { lat: 37.4954, lng: 126.8874 },
    '금천구': { lat: 37.4565, lng: 126.8954 },
    '노원구': { lat: 37.6542, lng: 127.0568 },
    '도봉구': { lat: 37.6688, lng: 127.0471 },
    '동대문구': { lat: 37.5744, lng: 127.0400 },
    '동작구': { lat: 37.5124, lng: 126.9393 },
    '마포구': { lat: 37.5665, lng: 126.9018 },
    '서대문구': { lat: 37.5791, lng: 126.9368 },
    '서초구': { lat: 37.4837, lng: 127.0324 },
    '성동구': { lat: 37.5633, lng: 127.0371 },
    '성북구': { lat: 37.5891, lng: 127.0182 },
    '송파구': { lat: 37.5145, lng: 127.1066 },
    '양천구': { lat: 37.5169, lng: 126.8660 },
    '영등포구': { lat: 37.5264, lng: 126.8962 },
    '용산구': { lat: 37.5323, lng: 126.9906 },
    '은평구': { lat: 37.6027, lng: 126.9291 },
    '종로구': { lat: 37.5730, lng: 126.9794 },
    '중구': { lat: 37.5637, lng: 126.9975 },
    '중랑구': { lat: 37.6066, lng: 127.0924 },
    '수원시': { lat: 37.2636, lng: 127.0286 },
    '성남시': { lat: 37.4386, lng: 127.1378 },
    '고양시': { lat: 37.6584, lng: 126.8320 },
    '용인시': { lat: 37.2410, lng: 127.1775 },
    '부천시': { lat: 37.5034, lng: 126.7660 },
    '안산시': { lat: 37.368, lng: 126.836 },
    '인천': { lat: 37.4563, lng: 126.7052 },
    '연수구': { lat: 37.4102, lng: 126.6782 },
    '남동구': { lat: 37.4473, lng: 126.7314 },
    '부평구': { lat: 37.5074, lng: 126.7217 }
};

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
    const firstPart = parts[0];
    const isSido = SIDO_PATTERNS.some(p => firstPart.includes(p));
    if (!isSido) return false;
    const secondPart = parts[1];
    const hasSGG = SIGUNGU_SUFFIXES.some(s => secondPart.endsWith(s));
    return hasSGG;
}

function isAddressLikelyIncomplete(venueName: string, address: string, lat?: number, lng?: number): string | null {
    if (lat && lng) {
        const isFallback = Object.values(DISTRICT_COORDS).some(fallback => 
            Math.abs(lat - fallback.lat) < 0.001 && 
            Math.abs(lng - fallback.lng) < 0.001
        );
        if (isFallback) {
            return '구청/대표 지점 임시 좌표';
        }
    }

    if (!address || address.trim().length === 0) return '주소 없음';
    if (address.length < 5) return '주소 너무 짧음';

    const parts = address.trim().split(/\s+/);
    const firstPart = parts[0];
    const isSido = SIDO_PATTERNS.some(p => firstPart.includes(p));
    if (!isSido) {
        return '시/도 정보 없음';
    }
    if (!hasSiGunGu(address)) {
        return '시/군/구 정보 없음';
    }
    return null;
}

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanKoreanAddress(address: string): string {
    if (!address) return '';
    let clean = address.replace(/\s+/g, ' ').trim();
    clean = clean.replace(/\s*\(.*?\)\s*$/, '');
    clean = clean.replace(/\s*\(.*?\)\s*\d+호\s*$/, '');
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

    if (address && address !== '정보 없음') {
        const cleanedAddr = cleanKoreanAddress(address);
        queries.push({ type: 'address', q: cleanedAddr });
        const noDong = cleanedAddr.replace(/\b\S+동\b/g, '').replace(/\s+/g, ' ').trim();
        if (noDong !== cleanedAddr && noDong.length > 5) {
            queries.push({ type: 'address', q: noDong });
        }
    }

    if (name.includes('서울') || name.includes('부산') || name.includes('경기') || name.includes('인천')) {
        const cleanedNameAddr = cleanKoreanAddress(name);
        queries.push({ type: 'address', q: cleanedNameAddr });
        const noDongName = cleanedNameAddr.replace(/\b\S+동\b/g, '').replace(/\s+/g, ' ').trim();
        if (noDongName !== cleanedNameAddr && noDongName.length > 5) {
            queries.push({ type: 'address', q: noDongName });
        }
    }

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

    const fallbackRegions = getFallbackRegionQueries(name, address);
    for (const r of fallbackRegions) {
        queries.push({ type: 'address', q: r });
    }

    for (const item of queries) {
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
    console.log('=========================================');
    console.log('  공연장/경기장 주소 정밀화 스크립트');
    console.log('=========================================\n');

    const raw = fs.readFileSync(VENUES_PATH, 'utf-8');
    const venues: Record<string, Venue> = JSON.parse(raw);
    const keys = Object.keys(venues);

    console.log(`📊 전체 공연장/경기장 수: ${keys.length}\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Phase 1: 주소 전수 조사');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const problematic: { key: string; venue: Venue; reason: string }[] = [];
    let goodCount = 0;

    for (const key of keys) {
        const v = venues[key];
        const reason = isAddressLikelyIncomplete(key, v.address, v.lat, v.lng);
        if (reason) {
            problematic.push({ key, venue: v, reason });
        } else {
            goodCount++;
        }
    }

    console.log(`✅ 정상 주소: ${goodCount}건`);
    console.log(`⚠️  문제 주소: ${problematic.length}건\n`);

    const byReason: Record<string, typeof problematic> = {};
    for (const p of problematic) {
        if (!byReason[p.reason]) byReason[p.reason] = [];
        byReason[p.reason].push(p);
    }

    for (const [reason, items] of Object.entries(byReason)) {
        console.log(`  [${reason}]: ${items.length}건`);
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

        const result = await queryKakaoLocation(key, venue.address);

        if (result) {
            console.log(`${progress} ✅ "${key}"`);
            console.log(`    이전: "${venue.address}"`);
            console.log(`    이후: "${result.address}"`);
            console.log(`    좌표: ${result.lat}, ${result.lng}\n`);

            fixed.push({ key, oldAddress: venue.address, newAddress: result.address, newLat: result.lat, newLng: result.lng });
            fixedCount++;
        } else {
            console.log(`${progress} ❌ "${key}" → 정밀화 실패`);
            console.log(`    현재주소: "${venue.address}"`);
            console.log(`    좌표: ${venue.lat || 'N/A'}, ${venue.lng || 'N/A'}\n`);
            failed.push({ key, address: venue.address, reason: '모든 전략 실패' });
            failedCount++;
        }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  Phase 3: 수정사항 적용');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    let updatedCount = 0;
    for (const fix of fixed) {
        const v = venues[fix.key];
        if (v) {
            v.address = fix.newAddress;
            v.lat = fix.newLat;
            v.lng = fix.newLng;
            
            const parts = fix.newAddress.split(/\s+/);
            if (parts.length >= 2) {
                const secondPart = parts[1];
                if (secondPart.endsWith('구') || secondPart.endsWith('시') || secondPart.endsWith('군')) {
                    v.district = secondPart;
                }
            }
            updatedCount++;
        }
    }

    if (updatedCount > 0) {
        fs.writeFileSync(VENUES_PATH, JSON.stringify(venues, null, 2), 'utf-8');
        console.log(`🎉 성공적으로 ${updatedCount}개 공연장의 주소/좌표를 수정 및 venues.json에 반영했습니다.`);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  작업 완료 리포트');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(` 총 대상: ${problematic.length}건`);
    console.log(` 정밀화 성공 (venues.json 수정됨): ${fixedCount}건`);
    console.log(` 정밀화 실패: ${failedCount}건\n`);
}

main().catch(console.error);
