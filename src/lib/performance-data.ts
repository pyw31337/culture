import { safeArray, safePerformanceList } from '@/lib/data-safety';
import { processAndMergePerformances } from '@/lib/performance-merger';
import { transformPerformance } from '@/lib/data-transformer';

import interparkData from '@/data/interpark.json';
import kovoData from '@/data/kovo.json';
import kblData from '@/data/kbl.json';
import kboData from '@/data/kbo.json';
import festivalsData from '@/data/festivals.json';
import yes24Data from '@/data/yes24.json';
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

import mochaclassData from '@/data/mochaclass.json';
import mommomData from '@/data/mommom.json';
import mommomProductData from '@/data/mommom-products.json';
import museumData from '@/data/museum.json';
// import musicalData from '@/data/musical.json';
import yes24ExclusiveData from '@/data/yes24-exclusive.json';
import kopisData from '@/data/kopis-performances.json';
import venueData from '@/data/venues.json';

const venues = venueData as Record<string, { address: string; lat?: number | null; lng?: number | null }>;
const cinemas = cinemaData as { name: string; address: string; lat: number; lng: number }[];

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

// Global cache to prevent Next.js from parsing massive JSON files 12,000 times during static build
let cachedPerformances: any[] | null = null;

export function getAllPerformances() {
    if (cachedPerformances) return cachedPerformances;

    // 1. Load and Transform all data sources
    const allSources: { data: any, source?: string }[] = [
        { data: interparkData },
        { data: yes24Data },
        { data: timeticketData },
        { data: festivalsData },
        { data: kovoData },
        { data: kblData },
        { data: kboData },
        { data: handballData },
        { data: kleagueData },
        { data: moviesData, source: 'movie' },
        { data: kidsData },
        { data: classData },
        { data: umclassData },
        { data: mochaclassData },
        { data: seoulData, source: 'seoul' },
        { data: mommomData },
        { data: mommomProductData },
        { data: museumData },
        { data: yes24ExclusiveData, source: 'yes24_exclusive' },
        { data: kopisData, source: 'kopis' },
    ];

    const allPerformances = allSources.flatMap(({ data, source }) =>
        safeArray<any>(data).map(p => transformPerformance(p, source))
    );

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

        // Date Check (Enforced for everything else)
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
            const v = venues[p.venue];
            // If venue data is missing, or address is invalid, or lat/lng is missing/invalid
            if (!v || !v.address || v.address === '정보 없음' || !v.lat || !v.lng) {
                return false;
            }
            // Attach venue data for interactive links
            p.lat = v.lat as number;
            p.lng = v.lng as number;
            p.address = v.address;
        }

        if (BLOCKLIST.some(b => p.venue.includes(b))) return false;
        return true;
    });

    // 4. Deduplication & Stable ID Logic (Unified via Utility)
    const stablePerformances = processAndMergePerformances(filtered);

    cachedPerformances = safePerformanceList(stablePerformances);
    return cachedPerformances;
}
