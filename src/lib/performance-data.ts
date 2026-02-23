import { safeArray, safePerformanceList } from '@/lib/data-safety';
import { processAndMergePerformances } from '@/lib/performance-merger';

import interparkData from '@/data/interpark.json';
import kovoData from '@/data/kovo.json';
import kblData from '@/data/kbl.json';
import kboData from '@/data/kbo.json';
import travelData from '@/data/travel.json';
import festivalsData from '@/data/festivals.json';
import yes24Data from '@/data/yes24.json';
import timeticketData from '@/data/timeticket.json';
import moviesData from '@/data/movies.json';
import kidsData from '@/data/myrealtrip-kids.json';
import classData from '@/data/sssd-class.json';
import ottData from '@/data/ott.json';

import handballData from '@/data/handball.json';
// import hockeyData from '@/data/hockey.json'; 
import umclassData from '@/data/umclass.json';
import seoulData from '@/data/seoul-culture.json';

import mochaclassData from '@/data/mochaclass.json';
import mommomData from '@/data/mommom.json';
import mommomProductData from '@/data/mommom-products.json';
import museumData from '@/data/museum.json';
// import musicalData from '@/data/musical.json';
import venueData from '@/data/venues.json';

const venues = venueData as Record<string, { address: string; lat?: number; lng?: number }>;

function isPerformanceActive(dateStr: string, today: Date): boolean {
    if (!dateStr) return false;

    try {
        let targetDate: Date | null = null;

        // Type 1: Range "YYYY.MM.DD ~ YYYY.MM.DD"
        if (dateStr.includes('~')) {
            const parts = dateStr.split('~');
            const endStr = parts[1].trim();
            const [y, m, d] = endStr.split('.').map(Number);
            targetDate = new Date(y, m - 1, d);
            targetDate.setHours(23, 59, 59, 999);
        }
        // Type 2: Single "YYYY-MM-DD HH:mm" (KOVO style)
        else if (dateStr.includes('-') && dateStr.includes(':')) {
            const [datePart] = dateStr.split(' ');
            const [y, m, d] = datePart.split('-').map(Number);
            targetDate = new Date(y, m - 1, d);
            targetDate.setHours(23, 59, 59, 999);
        }
        // Type 3: Simple "YYYY-MM-DD" (Mommom/General)
        else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
            const [y, m, d] = dateStr.split('-').map(Number);
            targetDate = new Date(y, m - 1, d);
            targetDate.setHours(23, 59, 59, 999);
        }
        // Fallback
        else {
            targetDate = new Date(dateStr);
            if (targetDate && !isNaN(targetDate.getTime())) {
                targetDate.setHours(23, 59, 59, 999);
            }
        }

        if (!targetDate || isNaN(targetDate.getTime())) return true;

        return targetDate.getTime() >= today.getTime();

    } catch (e) {
        return true;
    }
}

export function getAllPerformances() {
    // 1. Safe Arrays
    const REGION_MAP: Record<string, string> = {
        '서울': 'seoul', '경기': 'gyeonggi', '인천': 'incheon',
        '부산': 'busan', '대구': 'daegu', '광주': 'gwangju',
        '대전': 'etc', '울산': 'etc', '세종': 'etc',
        '강원': 'etc', '충북': 'etc', '충남': 'etc',
        '전북': 'etc', '전남': 'etc', '경북': 'etc',
        '경남': 'etc', '제주': 'etc'
    };

    const interpark = safeArray<any>(interparkData).map((p: any) => ({
        ...p,
        // Map Korean region to English key if valid, or default to 'etc' if unknown but not empty
        region: REGION_MAP[p.region] || (p.region ? 'etc' : 'unknown')
    }));

    function inferSeoulGenre(title: string, venue: string, originalSubject: string): string {
        const text = (title + ' ' + venue + ' ' + originalSubject).toLowerCase();

        if (text.includes('콘서트') || text.includes('음악회') || text.includes('연주회') || text.includes('교향악단') || text.includes('리사이틀') || text.includes('앙상블') || text.includes('오케스트라') || text.includes('독창회') || text.includes('독주회') || text.includes('클래식') || text.includes('내한')) return 'classic';
        if (text.includes('전시') || text.includes('특별전') || text.includes('초대전') || text.includes('갤러리') || text.includes('미술관') || text.includes('박물관') || text.includes('비엔날레') || text.includes('도슨트') || text.includes('개인전') || text.includes('기획전') || text.includes('과학관') || text.includes('기념관') || text.includes('조각전') || text.includes('책보고')) return 'exhibition';
        if (text.includes('국악') || text.includes('판소리') || text.includes('마당놀이') || text.includes('전통') || text.includes('무형문화재') || text.includes('풍물') || text.includes('굿')) return 'korean_music';
        if (text.includes('강좌') || text.includes('교육') || text.includes('체험') || text.includes('아카데미') || text.includes('워크숍') || text.includes('교실') || text.includes('특강') || text.includes('도서관') || text.includes('캠프')) return 'class';
        if (text.includes('축제') || text.includes('페스티벌') || text.includes('행사') || text.includes('스케이트장') || text.includes('눈썰매장')) return 'festival';
        if (text.includes('뮤지컬')) return 'musical';
        if (text.includes('연극')) return 'play';
        if (text.includes('무용') || text.includes('발레')) return 'classic';

        return 'etc';
    }

    const seoulCulture = safeArray<any>(seoulData).map((p: any) => ({
        ...p,
        venue: p.place,
        region: 'seoul',
        image: p.poster, // Map 'poster' from JSON to 'image'
        price: p.cost,   // Map 'cost' from JSON to 'price'
        date: p.time ? `${p.date} (${p.time})` : p.date, // Append time to date
        genre: inferSeoulGenre(p.title || '', p.place || '', p.codename || '')
    }));

    const yes24 = safeArray<any>(yes24Data).map((p: any) => ({
        ...p,
        region: REGION_MAP[p.region] || (p.region ? 'etc' : 'unknown')
    }));

    const timeticket = safeArray<any>(timeticketData).map(p => ({ ...p, id: String(p.id) }));
    const festivals = safeArray<any>(festivalsData).map(p => ({ ...p, id: String(p.id) }));
    const volleyball = safeArray<any>(kovoData).map(p => ({ ...p, id: String(p.id) }));
    const basketball = safeArray<any>(kblData).map(p => ({ ...p, id: String(p.id) }));
    const baseball = safeArray<any>(kboData).map(p => ({ ...p, id: String(p.id) }));
    const handball = safeArray<any>(handballData).map(p => ({ ...p, id: String(p.id) }));
    const ott = safeArray<any>(ottData).map(p => ({ ...p, id: String(p.id) }));
    const movies = safeArray<any>(moviesData).map(p => ({ ...p, id: String(p.id), genre: 'movie' }));
    const travels = safeArray<any>(travelData).map(p => ({ ...p, id: String(p.id) }));
    const classes = safeArray<any>(classData).map(p => ({ ...p, id: String(p.id) }));
    const umclasses = safeArray<any>(umclassData).map(p => ({ ...p, id: String(p.id) }));
    const mochaclasses = safeArray<any>(mochaclassData).map(p => ({ ...p, id: String(p.id) }));
    const mommom = safeArray<any>(mommomData).map(p => ({ ...p, id: String(p.id) }));
    const mommomProduct = safeArray<any>(mommomProductData).map(p => ({ ...p, id: String(p.id) }));
    const museum = safeArray<any>(museumData).map(p => ({ ...p, id: String(p.id) }));

    // 2. Aggregate
    const allPerformances = [
        ...interpark,
        ...yes24,
        ...timeticket,
        ...festivals,
        ...volleyball,
        ...basketball,
        ...baseball,
        ...handball,
        // ...soccerData,
        ...ott.map(p => ({ ...p, venue: 'OTT' })),
        ...movies,
        ...travels,
        ...classes,
        ...umclasses,
        ...mochaclasses,
        ...seoulCulture,
        ...mommom,
        ...mommomProduct,
        ...museum,
        // ...musical,
    ].map(p => ({
        ...p,
        id: String(p.id)
    })).map(p => {
        // [Data Quality Override]
        // Reclassify kids content into more specific existing categories based on keywords.
        // It's possible that a source explicitly targets 'kids' genre, so we remap it safely here.
        if (p.genre === 'kids') {
            const t = (p.title + ' ' + (p.venue || '')).toLowerCase();
            if (t.includes('뮤지컬') || t.includes('티니핑') || t.includes('핑크퐁') || t.includes('오페라') || t.includes('싱어롱')) {
                return { ...p, genre: 'musical' };
            }
            if (t.includes('연극') || t.includes('아동극') || t.includes('인형극')) {
                return { ...p, genre: 'play' };
            }
            if (t.includes('클래식') || t.includes('음악회') || t.includes('발레') || t.includes('오케스트라')) {
                return { ...p, genre: 'classic_tradition' };
            }
            if (t.includes('도슨트') || t.includes('박물관') || t.includes('역사') || t.includes('서대문형무소') || t.includes('경복궁') || t.includes('법안발의') || t.includes('미술관') || t.includes('기념관') || t.includes('에듀') || t.includes('투어')) {
                return { ...p, genre: 'museum' };
            }
            // Fallback for kids content goes to kids
            return { ...p, genre: 'kids' };
        }
        return p;
    });

    // 3. Filter
    const now = new Date();
    // Valid regions including broad ones
    const validRegions = ['seoul', 'gyeonggi', 'incheon', 'busan', 'daegu', 'gwangju', 'etc'];
    const BLOCKLIST = ['블루마린 스쿠버 다이브', '광주 조선대학교 해오름관'];

    const filtered = allPerformances.filter(p => {
        // Always show specific genres (Bypass Date & Region)
        if (p.genre === 'movie' || p.genre === 'ott') return true;

        // Date Check (Enforced for everything else)
        if (!isPerformanceActive(p.date, now)) return false;

        // Region Check Exemptions (Nationwide content that expires)
        // Region Check Exemptions (Now practically everything is nationwide)
        // if (p.genre === 'festival' || p.genre === 'travel' || p.genre === 'kids' || p.genre === 'class') return true;

        if (!isPerformanceActive(p.date, now)) return false;

        // Sports: Strict Region Filter -> Relaxed to Nationwide? 
        // User said: "movie/OTT excluded, expand others to nationwide". 
        // Sports were strictly filtered. Let's allow them too if that's the intent, or keep them for now?
        // "나머지 서울/경기/인천 지역 한정을 전국단위로 범위를 확장했기 때문에, 지역 필터를 사용해서 비노출 시키는 컨텐츠는 없도록 해줘."
        // This implies NO content should be hidden by region filter.

        // if (p.genre === 'volleyball' || p.genre === 'basketball' || p.genre === 'baseball' || p.genre === 'handball') {
        //     if (!validRegions.includes(p.region)) return false;
        // }

        // if (!validRegions.includes(p.region)) return false;

        // Filter out bad venues
        if (p.venue === '예매하기') return false;
        if (/^\d{1,2}\.\d{1,2}/.test(p.venue)) return false;

        // Address/Location Validation (Strict Policy)
        // Only allow 'movie' and 'ott' to bypass location check.
        // Everything else MUST have a valid geolocation to be displayed.
        if (p.genre !== 'movie' && p.genre !== 'ott') {
            const v = venues[p.venue];
            // If venue data is missing, or address is invalid, or lat/lng is missing/invalid
            if (!v || !v.address || v.address === '정보 없음' || !v.lat || !v.lng) {
                return false;
            }
        }

        if (BLOCKLIST.some(b => p.venue.includes(b))) return false;
        return true;
    });

    // 4. Deduplication & Stable ID Logic (Unified via Utility)
    const stablePerformances = processAndMergePerformances(filtered);

    return safePerformanceList(stablePerformances);
}
