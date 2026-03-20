/**
 * fix-mislocated-venues-v2.ts
 * 
 * Phase 1: Delete garbage venues (URLs, HTML, placeholders, overseas)
 * Phase 2: Delete venues with known bad fallback addresses that can't be resolved
 * Phase 3: For well-known Korean venues, try Naver search geocoding
 */
import fs from 'fs';
import path from 'path';

const VENUES_PATH = path.resolve(process.cwd(), 'src/data/venues.json');
const INTERPARK_PATH = path.resolve(process.cwd(), 'src/data/interpark.json');
const PERFORMANCES_PATH = path.resolve(process.cwd(), 'public/data/performances.json');

interface VenueData {
    name: string;
    address: string;
    district?: string;
    lat: number;
    lng: number;
    mapped_region_id?: string;
}

const BAD_FALLBACK = '서울 용산구 후암로 97-1';
const BAD_FALLBACKS = [
    '서울 용산구 후암로 97-1',
    '서울 영등포구 문래로 180',
    '서울 영등포구 당산로 83',
];

function isGarbageVenue(name: string): boolean {
    if (name.length > 100) return true;
    if (/Move left|Map data|Zoom in|Keyboard shortcuts|imperial units|TMap Mobility/.test(name)) return true;
    if (/©|주식회사|사업자등록번호|통신판매번호/.test(name)) return true;
    if (name.startsWith('위치대한민국')) return true;
    if (name.startsWith('http')) return true;
    if (/^(부산광역시|대구광역시|인천광역시|광주광역시|대전광역시|울산광역시)\s/.test(name)) return true;
    if (/공간\s*소개|지도보기|지도길찾기|좋아요\d|공유가격/.test(name)) return true;
    if (/←|→|↑|↓/.test(name)) return true;
    if (name === '' || name === ' ') return true;
    if (['해당없음(No information)', '정보 없음', '상세페이지 참조', '해당없음', ''].includes(name)) return true;
    // Placeholder patterns
    if (/^해당공연\s*공연장/.test(name)) return true;
    return false;
}

function isOverseasVenue(name: string): boolean {
    const overseas = ['Zepp Namba', 'Zepp Haneda', '크레욜라 익스피어리언스 펜실베니아',
        '뉴저지 리버티 사이언스', '싱가포르 사이언스', '오키나와', '도쿄 포켓몬센터',
        '키즈플라자 오사카', '나트랑 국립해양박물관', '올랜도 사이언스', '애틀랜타 어린이 박물관',
        '괌 박물관', '응꼬뮤지엄 오키나와', '누치마스 소금공장'];
    return overseas.some(ov => name.includes(ov));
}

function isTicketPackage(name: string): boolean {
    // These are ticket bundles/passes, not real venues
    return /투어패스|입장권\s*\(|입장권\s*\/|패밀리\s*파크|시티투어버스|렌탈샵\s*스키|한복\s*대여/.test(name);
}

function getRegionId(address: string): string {
    if (address.includes('제주')) return 'jeju';
    if (address.includes('부산')) return 'busan';
    if (address.includes('대구')) return 'daegu';
    if (address.includes('인천')) return 'incheon';
    if (address.includes('광주')) return 'gwangju';
    if (address.includes('대전')) return 'daejeon';
    if (address.includes('울산')) return 'ulsan';
    if (address.includes('세종')) return 'sejong';
    if (address.includes('경기')) return 'gyeonggi';
    if (address.includes('강원')) return 'gangwon';
    if (address.includes('충청북') || address.includes('충북')) return 'chungbuk';
    if (address.includes('충청남') || address.includes('충남')) return 'chungnam';
    if (address.includes('전라북') || address.includes('전북')) return 'jeonbuk';
    if (address.includes('전라남') || address.includes('전남')) return 'jeonnam';
    if (address.includes('경상북') || address.includes('경북')) return 'gyeongbuk';
    if (address.includes('경상남') || address.includes('경남')) return 'gyeongnam';
    if (address.includes('서울')) return 'seoul';
    return '';
}

async function main() {
    const venues: Record<string, VenueData> = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf-8'));
    const totalBefore = Object.keys(venues).length;

    // Check which venues are actually referenced by performances
    let referencedVenues = new Set<string>();
    try {
        const perfData = JSON.parse(fs.readFileSync(PERFORMANCES_PATH, 'utf-8'));
        for (const p of perfData) {
            if (p.venue) referencedVenues.add(p.venue);
        }
    } catch (e) {
        // If performances file doesn't exist, try interpark
        try {
            const ipData = JSON.parse(fs.readFileSync(INTERPARK_PATH, 'utf-8'));
            for (const p of ipData) {
                if (p.venue) referencedVenues.add(p.venue);
            }
        } catch (e2) { }
    }
    console.log(`Referenced venues in performances: ${referencedVenues.size}`);

    // Phase 1: Remove garbage venue names
    let garbageCount = 0;
    for (const name of Object.keys(venues)) {
        if (isGarbageVenue(name) || isOverseasVenue(name) || isTicketPackage(name)) {
            delete venues[name];
            garbageCount++;
        }
    }
    console.log(`Phase 1: Removed ${garbageCount} garbage/overseas/package venues`);

    // Phase 2: Fix venues with bad fallback addresses
    // For venues with known bad addresses, check if they're real Korean venues that need geocoding
    const needsGeocode: string[] = [];
    const unreferencedBad: string[] = [];

    for (const [name, v] of Object.entries(venues)) {
        if (!BAD_FALLBACKS.some(bad => v.address.includes(bad))) continue;

        if (!referencedVenues.has(name)) {
            // Not referenced by any performance - safe to delete
            unreferencedBad.push(name);
        } else {
            needsGeocode.push(name);
        }
    }

    // Delete unreferenced bad venues
    for (const name of unreferencedBad) {
        delete venues[name];
    }
    console.log(`Phase 2a: Removed ${unreferencedBad.length} unreferenced venues with bad addresses`);
    console.log(`Phase 2b: ${needsGeocode.length} referenced venues still need geocoding`);

    // For the referenced ones, we need to try geocoding
    // Since Kakao API key is expired, use Naver Map search
    if (needsGeocode.length > 0) {
        console.log('\nVenues needing geocoding (referenced in performances):');
        for (const name of needsGeocode) {
            console.log(`  ${name}`);
        }
    }

    // Phase 3: Also check for region mismatch (address says Seoul but name suggests elsewhere)
    const regionMismatched: string[] = [];
    for (const [name, v] of Object.entries(venues)) {
        const addr = v.address;
        const isSeoulAddr = addr.startsWith('서울') || addr.includes('서울특별시');

        // Seoul address + region mismatch keywords
        const nonSeoulKeywords = ['부산', '대구', '인천', '광주', '대전', '울산', '제주', '강원', '충청', '전라', '경상', '경기'];
        const regionId = v.mapped_region_id || '';

        if (isSeoulAddr && nonSeoulKeywords.some(k => name.includes(k)) && regionId === 'seoul') {
            regionMismatched.push(name);
        }
    }

    // Phase 4: Clean garbage address strings (>200 chars)
    let longAddrCleaned = 0;
    for (const [name, v] of Object.entries(venues)) {
        if (v.address && v.address.length > 200) {
            // Try to extract a clean address from the garbage
            const match = v.address.match(/^(.*?(?:시|군|구|읍|면|리|동|로|길)\s*\d*[-\d]*)/);
            if (match) {
                v.address = match[1].trim();
                longAddrCleaned++;
            }
        }
    }
    console.log(`Phase 4: Cleaned ${longAddrCleaned} overly long addresses`);

    const totalAfter = Object.keys(venues).length;
    console.log(`\nTotal: ${totalBefore} -> ${totalAfter} venues (removed ${totalBefore - totalAfter})`);

    fs.writeFileSync(VENUES_PATH, JSON.stringify(venues, null, 2), 'utf-8');
    console.log(`Saved to ${VENUES_PATH}`);
}

main().catch(console.error);
