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
import soccerData from '@/data/soccer.json';

import ottData from '@/data/ott.json';

import handballData from '@/data/handball.json';
// import hockeyData from '@/data/hockey.json'; 
import umclassData from '@/data/umclass.json';
import seoulData from '@/data/seoul-culture.json';

import mochaclassData from '@/data/mochaclass.json';
import mommomData from '@/data/mommom.json';
import museumData from '@/data/museum.json';
import musicalData from '@/data/musical.json';
import venueData from '@/data/venues.json';

const venues = venueData as Record<string, { address: string }>;

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
    const interpark = safeArray<any>(interparkData);
    const volleyball = safeArray<any>(kovoData);
    const basketball = safeArray<any>(kblData);
    const baseball = safeArray<any>(kboData);
    const handball = safeArray<any>(handballData);
    const festivals = safeArray<any>(festivalsData);
    const yes24 = safeArray<any>(yes24Data);
    const timeticket = safeArray<any>(timeticketData);
    const movies = safeArray<any>(moviesData);
    const travels = safeArray<any>(travelData);
    const kids = safeArray<any>(kidsData);
    const classes = safeArray<any>(classData);
    const umclasses = safeArray<any>(umclassData);
    const mochaclasses = safeArray<any>(mochaclassData);
    const ott = safeArray<any>(ottData);
    const mommom = safeArray<any>(mommomData);
    const museum = safeArray<any>(museumData);
    const musical = safeArray<any>(musicalData);

    const seoulCulture = safeArray<any>(seoulData).map((p: any) => ({
        ...p,
        venue: p.place,
        region: 'seoul',
        image: p.poster, // Map 'poster' from JSON to 'image'
        price: p.cost,   // Map 'cost' from JSON to 'price'
        date: p.time ? `${p.date} (${p.time})` : p.date // Append time to date
    }));

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
        ...soccerData,
        ...ott.map(p => ({ ...p, venue: 'OTT' })),
        ...movies,
        ...travels,
        ...kids,
        ...classes,
        ...umclasses,
        ...mochaclasses,
        ...seoulCulture,
        ...mommom,
        ...museum,
        ...musical,
    ].map(p => ({
        ...p,
        id: String(p.id)
    }));

    // 3. Filter
    const now = new Date();
    // Valid regions including broad ones
    const validRegions = ['seoul', 'gyeonggi', 'incheon', 'busan', 'daegu', 'gwangju', 'etc'];
    const BLOCKLIST = ['블루마린 스쿠버 다이브', '광주 조선대학교 해오름관'];

    const filtered = allPerformances.filter(p => {
        // Always show specific genres (Bypass Date & Region)
        if (p.genre === 'movie' || p.genre === 'ott' || p.genre === 'museum' || p.genre === 'leisure' || p.genre === 'hotdeal') return true;

        // Date Check (Enforced for everything else)
        if (!isPerformanceActive(p.date, now)) return false;

        // Region Check Exemptions (Nationwide content that expires)
        if (p.genre === 'festival' || p.genre === 'travel' || p.genre === 'kids' || p.genre === 'class') return true;

        if (!isPerformanceActive(p.date, now)) return false;

        // Sports: Strict Region Filter
        if (p.genre === 'volleyball' || p.genre === 'basketball' || p.genre === 'baseball' || p.genre === 'handball') {
            if (!validRegions.includes(p.region)) return false;
        }

        if (!validRegions.includes(p.region)) return false;

        // Filter out bad venues
        if (p.venue === '예매하기') return false;
        if (/^\d{1,2}\.\d{1,2}/.test(p.venue)) return false;

        // Address-based Filtering
        if (venues[p.venue]) {
            const addr = venues[p.venue].address;
            if (addr && addr !== '정보 없음') {
                const isServiceArea = addr.startsWith('서울') || addr.startsWith('경기') || addr.startsWith('인천');
                // Allow if in validRegions (broad support) or service area
                if (!isServiceArea && !validRegions.includes(p.region)) return false;
            }
        }

        if (BLOCKLIST.some(b => p.venue.includes(b))) return false;
        return true;
    });

    // 4. Deduplication & Stable ID Logic (Unified via Utility)
    const stablePerformances = processAndMergePerformances(filtered);

    return safePerformanceList(stablePerformances);
}
