import { safeArray, safePerformanceList } from '@/lib/data-safety';
import { processAndMergePerformances } from '@/lib/performance-merger';
import { transformPerformance } from '@/lib/data-transformer';

import interparkData from '@/data/interpark.json';
import kovoData from '@/data/kovo.json';
import kblData from '@/data/kbl.json';
import kboData from '@/data/kbo.json';
import festivalsData from '@/data/festivals.json';
import timeticketData from '@/data/timeticket.json';
import moviesData from '@/data/movies.json';
import kidsData from '@/data/myrealtrip-kids.json';
import classData from '@/data/sssd-class.json';
import cinemaData from '@/data/cinemas.json';


import handballData from '@/data/handball.json';
import kleagueData from '@/data/kleague.json';
// import hockeyData from '@/data/hockey.json'; 
import umclassData from '@/data/umclass.json';
import seoulData from '@/data/seoul-culture.json';
import culturePortalData from '@/data/culture-portal.json';

import mochaclassData from '@/data/mochaclass.json';
import mommomData from '@/data/mommom.json';
import mommomActivityData from '@/data/mommom-activities.json';
import mommomProductData from '@/data/mommom-products.json';
import museumData from '@/data/museum.json';
// import musicalData from '@/data/musical.json';
import kopisData from '@/data/kopis-performances.json';
import tourismData from '@/data/tourism.json';
import venueData from '@/data/venues.json';

const venues = venueData as Record<string, { address: string; lat?: number | null; lng?: number | null }>;
const cinemas = cinemaData as { name: string; address: string; lat: number; lng: number }[];

function isPerformanceActive(dateStr: string, today: Date): boolean {
    if (!dateStr || dateStr.trim() === '') return true; // Lenient: Treat items without dates as active (e.g., Museums)

    try {
        // Strip day-of-week suffixes (e.g., "(목)") to prevent Invalid Date errors
        let cleanDate = dateStr.replace(/\s*\([가-힣]\)/g, '').trim();
        let targetDate: Date | null = null;

        // Type 1: Range "YYYY.MM.DD ~ YYYY.MM.DD"
        if (cleanDate.includes('~')) {
            const parts = cleanDate.split('~');
            const endStr = parts[1].trim();
            // Support both dots and dashes in ranges
            const [y, m, d] = endStr.split(/[-.]/).map(Number);
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
        else if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
            const [y, m, d] = cleanDate.split('-').map(Number);
            targetDate = new Date(y, m - 1, d);
            targetDate.setHours(23, 59, 59, 999);
        }
        // Type 4: Numeric "YYYYMMDD"
        else if (/^\d{8}$/.test(cleanDate)) {
            const y = parseInt(cleanDate.substring(0, 4));
            const m = parseInt(cleanDate.substring(4, 6));
            const d = parseInt(cleanDate.substring(6, 8));
            targetDate = new Date(y, m - 1, d);
            targetDate.setHours(23, 59, 59, 999);
        }
        // Fallback
        else {
            targetDate = new Date(cleanDate);
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

// Global cache to prevent Next.js from parsing massive JSON files 12,000 times during static build
let cachedPerformances: any[] | null = null;

export function getAllPerformances() {
    if (cachedPerformances) return cachedPerformances;

    // 1. Load and Transform all data sources
    const allSources: { data: any, source?: string }[] = [
        { data: interparkData, source: 'interpark' },
        { data: timeticketData, source: 'timeticket' },
        { data: festivalsData, source: 'festival' },
        { data: kovoData, source: 'volleyball' },
        { data: kblData, source: 'basketball' },
        { data: kboData, source: 'baseball' },
        { data: handballData, source: 'handball' },
        { data: kleagueData, source: 'football' },
        { data: moviesData, source: 'movie' },
        { data: kidsData, source: 'myrealtrip-kids' },
        { data: classData, source: 'sssd-class' },
        { data: umclassData, source: 'umclass' },
        { data: mochaclassData, source: 'mochaclass' },
        { data: seoulData, source: 'seoul' },
        { data: culturePortalData, source: 'culture-portal' },
        { data: mommomData, source: 'mommom' },
        { data: mommomActivityData, source: 'mommom-activity' },
        { data: mommomProductData, source: 'mommom-product' },
        { data: museumData, source: 'museum' },
        { data: kopisData, source: 'kopis' },
        { data: tourismData, source: 'tourism' },
    ];

    const allPerformances = allSources.flatMap(({ data, source }) => {
        const rawItems = safeArray<any>(data);
        console.log(`[DEBUG] Source: ${source}, Raw items: ${rawItems.length}`);
        return rawItems.map(p => transformPerformance(p, source));
    });

    // 3. Filter
    const now = new Date();
    // Valid regions including broad ones
    const validRegions = ['seoul', 'gyeonggi', 'incheon', 'busan', 'daegu', 'gwangju', 'etc'];
    const BLOCKLIST = ['블루마린 스쿠버 다이브', '광주 조선대학교 해오름관'];

    const filtered = allPerformances.filter(p => {
        // Filter out deprecated genres eagerly
        if (p.genre === 'popup' || p.genre === 'travel') return false;

        // Always show specific genres (Bypass Date & Region)
        if (p.genre === 'movie') {
            const cinema = cinemas.find(c => c.name === p.venue);
            if (cinema && cinema.lat && cinema.lng) {
                p.lat = cinema.lat;
                p.lng = cinema.lng;
                p.address = cinema.address;
            }
        }

        if (p.genre !== 'movie' && !isPerformanceActive(p.date, now)) return false;



        // Sports: Strict Region Filter -> Relaxed to Nationwide? 
        // User said: "movie excluded, expand others to nationwide". 
        // This is necessary because they don't have lat/lng? (User said so)
        // Correct approach: if p.genre === 'movie' return true;m for now?
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
        // Only allow 'movie' to bypass location check.
        // Everything else MUST have a valid geolocation to be displayed.
        if (p.genre !== 'movie') {
            let v = venues[p.venue];

            // Disambiguation for regional tags [창원], [제주] etc.
            if (p.bracketRegion) {
                const bRegion = p.bracketRegion;
                // If current venue is missing or address doesn't match the bracket region, search for a better one
                if (!v || (v.address && !v.address.includes(bRegion))) {
                    const venueKeys = Object.keys(venues);
                    const cleanName = p.venue.replace(/홀$|센터$|관$|장$/, '').trim();
                    // Search for a venue that matches both the name and the bracketed region
                    const bestMatchKey = venueKeys.find(k => k.includes(p.venue) && k.includes(bRegion)) ||
                                       venueKeys.find(k => k.includes(cleanName) && k.includes(bRegion)) ||
                                       venueKeys.find(k => k.includes(p.venue) && (venues[k] as any).address.includes(bRegion)) ||
                                       venueKeys.find(k => k.includes(cleanName) && (venues[k] as any).address.includes(bRegion)) ||
                                       venueKeys.find(k => (venues[k] as any).address.includes(p.venue) && (venues[k] as any).address.includes(bRegion));
                    
                    if (bestMatchKey) {
                        v = venues[bestMatchKey];
                    }
                }
            }

            // 1. Prefer inherent geodata if available (New: Fix for MomMom/Museum)
            const parseCoord = (val: any) => {
                if (typeof val === 'number') return val;
                if (typeof val === 'string') return parseFloat(val);
                return 0;
            };
            const lat = parseCoord(p.lat || p.latitude);
            const lng = parseCoord(p.lng || p.longitude);
            const hasInherentGeo = lat !== 0 && lng !== 0 && !isNaN(lat) && !isNaN(lng);
            const hasAddress = p.address && p.address !== '정보 없음' && p.address !== '';

            if (hasInherentGeo) {
                // Attach for consistent usage
                p.lat = lat;
                p.lng = lng;
                // If address is missing but we have coordinates, use venue as fallback address
                if (!hasAddress) p.address = p.venue || '주소 정보 없음';
            } else if (v && v.address && v.address !== '정보 없음' && v.lat && v.lng) {
                // 2. Use Venue DB
                p.lat = v.lat as number;
                p.lng = v.lng as number;
                p.address = v.address;
            } else {
                // 3. Reject if neither exists
                return false;
            }
        }

        if (BLOCKLIST.some(b => p.venue.includes(b))) return false;
        return true;
    });

    console.log(`[DEBUG] Total performances after filter: ${filtered.length}`);
    const sourceCounts: Record<string, number> = {};
    filtered.forEach(p => {
        sourceCounts[p.source || 'unknown'] = (sourceCounts[p.source || 'unknown'] || 0) + 1;
    });
    console.log(`[DEBUG] Source breakdown after filter:`, sourceCounts);

    // 4. Deduplication & Stable ID Logic (Unified via Utility)
    const stablePerformances = processAndMergePerformances(filtered);

    cachedPerformances = safePerformanceList(stablePerformances);
    return cachedPerformances;
}
