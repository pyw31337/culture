import { fetchPerformances } from '@/lib/interpark';
import PerformanceList from '@/components/PerformanceList';
import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';

import interparkData from '@/data/interpark.json';
import kovoData from '@/data/kovo.json';
import kblData from '@/data/kbl.json';
import kboData from '@/data/kbo.json';
import handballData from '@/data/handball.json';
import hockeyData from '@/data/hockey.json';
import travelData from '@/data/travel.json';
import festivalsData from '@/data/festivals.json';
import yes24Data from '@/data/yes24.json';
import timeticketData from '@/data/timeticket.json';
import moviesData from '@/data/movies.json';
import kidsData from '@/data/myrealtrip-kids.json';
import classData from '@/data/sssd-class.json';

import umclassData from '@/data/umclass.json';
import seoulData from '@/data/seoul-culture.json';

import mochaclassData from '@/data/mochaclass.json';
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
    const hockey = hockeyData as unknown as any[];
    const festivals = festivalsData as unknown as any[];
    const yes24 = yes24Data as unknown as any[];
    const timeticket = timeticketData as unknown as any[];
    const movies = moviesData as unknown as any[];
    const travels = travelData as unknown as any[];
    const kids = kidsData as unknown as any[];
    const classes = classData as unknown as any[];
    const umclasses = umclassData as unknown as any[];
    const mochaclasses = mochaclassData as unknown as any[];
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
        ...handball,
        ...hockey,
        ...movies,
        ...travels,
        ...kids,
        ...classes,
        ...umclasses,
        ...mochaclasses,
        ...seoulCulture,
    ].map(p => ({
        ...p,
        id: String(p.id)
    }));

    const now = new Date();
    const validRegions = ['seoul', 'gyeonggi', 'incheon', 'etc'];
    const BLOCKLIST = ['블루마린 스쿠버 다이브', '광주 조선대학교 해오름관'];

    const filtered = allPerformances.filter(p => {
        if (p.genre === 'movie' || p.genre === 'travel' || p.genre === 'kids' || p.genre === 'class') return true;

        if (!isPerformanceActive(p.date, now)) return false;

        if (p.genre === 'volleyball' || p.genre === 'basketball' || p.genre === 'baseball' || p.genre === 'handball' || p.genre === 'hockey') {
            // Updated to allow all regions for collected sports when possible, or just verified list
            // For now, let's keep it restricted but ensure hockey regions are covered.
            // Hockey uses 'gyeonggi' (Anyang) and 'etc' (Japan). 
            // 'etc' should be allowed in filtering if we want Japan games to show.
            // The existing code: if (!['seoul', 'gyeonggi', 'incheon'].includes(p.region)) return false;
            // This blocks 'etc'.

            // Let's modify the condition to allow 'etc' for hockey/handball if needed, or better, allow verifiedRegions + others for sports.
            // Actually, `validRegions` logic follows below at line 122: `if (!validRegions.includes(p.region)) return false;`
            // `validRegions` includes 'seoul', 'gyeonggi', 'incheon', 'etc'.
            // So we just need to REMOVE or RELAX this specific sports block.

            if (!['seoul', 'gyeonggi', 'incheon', 'busan', 'daegu', 'gwangju', 'etc'].includes(p.region)) return false;
        }

        if (!validRegions.includes(p.region)) return false;

        if (p.genre === 'hockey') {
            // console.log(`[Hockey Check] ${p.title} | Region: ${p.region} | ValidRegions: ${validRegions.includes(p.region)} | Blocklist: ${BLOCKLIST.some(b => p.venue.includes(b))}`);
        }

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

        // Explicit Debug for Hockey
        if (p.genre === 'hockey') {
            // Check if it's being dropped by Venue Address Filter
            if (venues[p.venue]) {
                const addr = venues[p.venue].address;
                const isServiceArea = addr.startsWith('서울') || addr.startsWith('경기') || addr.startsWith('인천');
                if (!isServiceArea) {
                    console.log(`[Hockey Drop] Venue Address Filter: ${p.title} (${p.venue} -> ${addr})`);
                    // This might be the culprit for 'Etc' regions if they have venue entries but non-compliant addresses.
                }
            }
        }

        if (venues[p.venue]) {
            const addr = venues[p.venue].address;
            if (addr && addr !== '정보 없음') {
                const isServiceArea = addr.startsWith('서울') || addr.startsWith('경기') || addr.startsWith('인천');
                if (!isServiceArea) return false;
            }
        }

        if (BLOCKLIST.some(b => p.venue.includes(b))) return false;
        return true;
    });

    console.log(`[Debug] Post-Filter Count: ${filtered.length}`);
    const hockeyFiltered = filtered.filter(p => p.genre === 'hockey');
    console.log(`[Debug] Post-Filter Hockey: ${hockeyFiltered.length}`);

    // Apply genre filter
    let genreFiltered = filtered;
    if (genreFilter) {
        const genresToInclude = Array.isArray(genreFilter) ? genreFilter : [genreFilter];
        genreFiltered = filtered.filter(p => genresToInclude.includes(p.genre));
    }

    // Deduplication
    const uniqueMap = new Map<string, any>();

    genreFiltered.forEach(p => {
        let key = p.title.replace(/[\s\(\)\[\]\-\_\!\~\.\,]/g, '').toLowerCase();

        if (p.genre === 'travel' || ['baseball', 'basketball', 'volleyball', 'soccer', 'handball', 'hockey'].includes(p.genre)) {
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
