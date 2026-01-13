import { fetchPerformances } from '@/lib/interpark';
import PerformanceList from '@/components/PerformanceList';
import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';

import interparkData from '@/data/interpark.json';
import kovoData from '@/data/kovo.json';
import kblData from '@/data/kbl.json';
import kboData from '@/data/kbo.json';
import handballData from '@/data/handball.json';
// import hockeyData from '@/data/hockey.json'; // Removed
import museumData from '@/data/museum.json'; // Added
import travelData from '@/data/travel.json';
import festivalsData from '@/data/festivals.json';
import yes24Data from '@/data/yes24.json';
import timeticketData from '@/data/timeticket.json';
import moviesData from '@/data/movies.json';
import kidsData from '@/data/myrealtrip-kids.json';
import classData from '@/data/sssd-class.json';

import ottData from '@/data/ott.json';

import umclassData from '@/data/umclass.json';
import seoulData from '@/data/seoul-culture.json';

import mochaclassData from '@/data/mochaclass.json';
import mommomData from '@/data/mommom.json';
import venueData from '@/data/venues.json';

import { VALID_GENRE_SLUGS, SPORTS_GENRES, GENRES } from '@/lib/constants';

const venues = venueData as Record<string, { address: string }>;

// Map URL slugs to actual genre IDs (some differ)
const SLUG_TO_GENRE: Record<string, string> = {
    'theater': 'play', // URL uses 'theater', internal uses 'play'
};

// Helper to check if performance is effectively expired
function isPerformanceActive(dateStr: string, today: Date): boolean {
    if (!dateStr) return false;

    try {
        let targetDate: Date | null = null;

        if (dateStr.includes('~')) {
            const parts = dateStr.split('~');
            const endStr = parts[1].trim();
            const [y, m, d] = endStr.split('.').map(Number);
            targetDate = new Date(y, m - 1, d);
            targetDate.setHours(23, 59, 59, 999);
        }
        else if (dateStr.includes('-') && dateStr.includes(':')) {
            const [datePart] = dateStr.split(' ');
            const [y, m, d] = datePart.split('-').map(Number);
            targetDate = new Date(y, m - 1, d);
            targetDate.setHours(23, 59, 59, 999);
        }
        else {
            targetDate = new Date(dateStr);
        }

        if (!targetDate || isNaN(targetDate.getTime())) return true;

        return targetDate.getTime() >= today.getTime();

    } catch (e) {
        return true;
    }
}

async function getPerformances(genreFilter: string | string[] | null) {
    const interpark = interparkData as unknown as any[];
    const volleyball = kovoData as unknown as any[];
    const basketball = kblData as unknown as any[];
    const baseball = kboData as unknown as any[];
    const handball = handballData as unknown as any[];
    // const hockey = hockeyData as unknown as any[];
    const museums = museumData as unknown as any[];
    const festivals = festivalsData as unknown as any[];
    const yes24 = yes24Data as unknown as any[];
    const timeticket = timeticketData as unknown as any[];
    const movies = moviesData as unknown as any[];
    const travels = travelData as unknown as any[];
    const kids = kidsData as unknown as any[];
    const classes = classData as unknown as any[];
    const umclasses = umclassData as unknown as any[];
    const mochaclasses = mochaclassData as unknown as any[];
    const mommoms = mommomData as unknown as any[];
    const ott = ottData as unknown as any[];
    const seoulCulture = (seoulData as unknown as any[]).map(p => ({
        ...p,
        venue: p.place,
        region: 'seoul',
        image: p.poster,
        price: p.cost,
        date: p.time ? `${p.date} (${p.time})` : p.date
    }));

    const allPerformances = [
        ...interpark,
        ...yes24,
        ...timeticket,
        ...festivals,
        ...volleyball,
        ...basketball,
        ...baseball,
        ...handball, // Handball
        // ...hockey,   // Hockey - Removed
        ...ott,
        ...movies,
        ...travels,
        ...kids,
        ...classes,
        ...umclasses,
        ...mochaclasses,
        ...mommoms,
        ...seoulCulture,
    ].map(p => ({
        ...p,
        venue: p.venue || 'Online',
        id: String(p.id)
    }));

    const now = new Date();
    const validRegions = ['seoul', 'gyeonggi', 'incheon', 'etc', 'ott'];
    const BLOCKLIST = ['블루마린 스쿠버 다이브', '광주 조선대학교 해오름관'];

    const filtered = allPerformances.filter(p => {
        // Special logic for 'hotdeal': Show matching genre OR discounted MomMom items
        if (genreFilter === 'hotdeal') {
            const isHotDealGenre = p.genre === 'hotdeal';
            const isDiscountedMomMom = p.platform === 'mommom' && (p.rate > 0 || p.originalPrice > p.price);
            if (!isHotDealGenre && !isDiscountedMomMom) return false;
        } else if (genreFilter && p.genre !== genreFilter) {
            // Standard genre filtering
            return false;
        }

        // Movies & Travel & Kids & Class & Leisure: Always show regardless of region/date logic (mostly)
        if (p.genre === 'movie' || p.genre === 'travel' || p.genre === 'kids' || p.genre === 'class' || p.genre === 'ott' || p.genre === 'leisure' || p.genre === 'museum') return true;

        if (!isPerformanceActive(p.date, now)) return false;

        // Sports: Strict Region Filter & Past Game Filter
        if (['volleyball', 'basketball', 'baseball', 'handball', 'soccer', 'hockey'].includes(p.genre)) {
            // Region check
            if (!['seoul', 'gyeonggi', 'incheon', 'busan', 'daegu', 'gwangju', 'etc'].includes(p.region)) return false;

            // Strict Date check: Hide if game date is strictly before today (Yesterday or older)
            // Note: 'now' is build time.
            try {
                const gameDate = new Date(p.date.split('(')[0]); // Remove time info like (17:00)
                // Reset time to 00:00:00 for comparison
                const todayMidnight = new Date(now);
                todayMidnight.setHours(0, 0, 0, 0);
                gameDate.setHours(0, 0, 0, 0);

                if (gameDate < todayMidnight) return false;
            } catch (e) {
                // If date parse fails, keep it (safety)
            }
        }

        // if (!validRegions.includes(p.region)) {
        //     // Allow nationwide festivals (passed date check above)
        //     if (p.genre === 'festival') return true;

        //     if (p.genre === 'volleyball') {
        //         // Check if it was allowed by the specific list above but then caught here?
        //         // No, logic flow:
        //         // 1. Matches sports check: passes if in allowed list.
        //         // 2. Then hits this line: validRegions = ['seoul', 'gyeonggi', 'incheon', 'etc', 'ott']
        //         // This effectively double-filters. If p.region is 'daegu' (allowed above), it will be caught here because 'daegu' is not in validRegions.
        //         // console.log(`[Volleyball Debug] Filtered by Region (General List): ${p.title} (${p.region})`);
        //     }
        //     return false;
        // }

        // Hockey filter removed


        if (p.venue === '예매하기') return false;
        if (/^\d{1,2}\.\d{1,2}/.test(p.venue)) return false;

        if (venues[p.venue]) {
            const addr = venues[p.venue].address;
            if (addr && addr !== '정보 없음') {
                const isServiceArea = addr.startsWith('서울') || addr.startsWith('경기') || addr.startsWith('인천');
                // For hockey, we might have added a logic to bypass this? 
                // Wait, the previous logic (lines 131) checks region.
                // But this venue check (lines 139-145) explicitly checks address string for '서울|경기|인천'.
                // If validRegions=['etc'], but address is not Seoul/Gyeonggi/Incheon (e.g. Japan address or no address),
                // this block MIGHT drop it if venues[p.venue] exists.
                // However, for Japanese venues, do they exist in venues.json?
            }
        }

        // Hockey explicit venue filter removed


        if (venues[p.venue]) {
            const addr = venues[p.venue].address;
            if (addr && addr !== '정보 없음') {
                // REMOVED: isServiceArea check for Seoul/Gyeonggi/Incheon
                // const isServiceArea = addr.startsWith('서울') || addr.startsWith('경기') || addr.startsWith('인천');
                // if (!isServiceArea) return false;
            }
        }

        if (BLOCKLIST.some(b => p.venue.includes(b))) return false;
        return true;
    });

    // console.log(`[Debug] Post-Filter Count: ${filtered.length}`);
    // Hockey debug removed


    // Apply genre filter
    // Apply genre filter - Already done in main filter loop above
    let genreFiltered = filtered;
    // Redundant block removed

    // Deduplication
    const uniqueMap = new Map<string, any>();

    genreFiltered.forEach(p => {
        let key = p.title.replace(/[\s\(\)\[\]\-\_\!\~\.\,]/g, '').toLowerCase();

        if (p.genre === 'travel' || ['baseball', 'basketball', 'volleyball', 'soccer', 'handball'].includes(p.genre)) {
            key += `_${p.date}`;
        }

        if (uniqueMap.has(key)) {
            const existing = uniqueMap.get(key);
            if (!existing.price && p.price) {
                uniqueMap.set(key, p);
            }
        } else {
            uniqueMap.set(key, p);
        }
    });

    // Assign Stable IDs
    const stablePerformances = Array.from(uniqueMap.entries()).map(([key, p]) => {
        let hash = 0;
        const str = key + (p.date?.split('~')[0] || '');
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        const stableId = `perf_${Math.abs(hash).toString(16)}`;

        return {
            ...p,
            id: stableId,
            originalId: p.id
        };
    });

    return stablePerformances;
}

// Generate static params for all valid genre slugs
export async function generateStaticParams() {
    return VALID_GENRE_SLUGS.map(genre => ({
        genre: genre,
    }));
}

interface PageProps {
    params: Promise<{ genre: string }>;
}

export default async function GenrePage({ params }: PageProps) {
    const { genre } = await params;

    // Validate genre slug
    if (!VALID_GENRE_SLUGS.includes(genre)) {
        notFound();
    }

    // Determine which genre(s) to filter
    let genreFilter: string | string[];
    let initialGenre: string;

    if (genre === 'sports') {
        // Composite sports URL - include all sports genres
        genreFilter = SPORTS_GENRES;
        initialGenre = 'all'; // Show "all" in UI, but data is already filtered to sports
    } else {
        // Map URL slug to internal genre ID
        const internalGenre = SLUG_TO_GENRE[genre] || genre;
        genreFilter = internalGenre;
        initialGenre = internalGenre;
    }

    const performances = await getPerformances(genreFilter);

    // Generate last updated time
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'short',
        hour12: false
    });

    const parts = formatter.formatToParts(now);
    const getPart = (type: string) => parts.find(p => p.type === type)?.value;

    const year = getPart('year');
    const month = getPart('month');
    const day = getPart('day');
    const weekday = getPart('weekday');
    const hour = getPart('hour');
    const minute = getPart('minute');

    const lastUpdated = `${year}.${month}.${day}.(${weekday}) ${hour}:${minute} `;

    // Get genre label for page title
    const genreLabel = genre === 'sports'
        ? '스포츠'
        : GENRES.find(g => g.id === initialGenre)?.label || genre;

    return (
        <main className="min-h-screen bg-gray-900 light:bg-white pb-20">
            <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">Loading...</div>}>
                <PerformanceList
                    initialPerformances={performances}
                    lastUpdated={lastUpdated}
                    initialGenre={initialGenre}
                    isCategoryPage={true}
                    categoryLabel={genreLabel}
                />
            </Suspense>
        </main>
    );
}
