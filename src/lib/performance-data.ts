import { safeArray, safePerformanceList } from '@/lib/data-safety';
import { processAndMergePerformances } from '@/lib/performance-merger';
import { transformPerformance } from '@/lib/data-transformer';

import fs from 'fs';
import path from 'path';

function loadJSON(filename: string, defaultValue: any = []) {
    try {
        const filePath = path.join(process.cwd(), 'src/data', filename);
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(content);
        }
    } catch (e) {
        console.error(`[Error] Failed to load ${filename}:`, e);
    }
    return defaultValue;
}

// Global cache to prevent Next.js from parsing massive JSON files 12,000 times during static build
let cachedPerformances: any[] | null = null;
let cachedVenues: any = null;
let cachedCinemas: any = null;

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



export function getAllPerformances() {
    if (cachedPerformances) return cachedPerformances;

    // Load static data for filtering
    if (!cachedVenues) cachedVenues = loadJSON('venues.json', {});
    if (!cachedCinemas) cachedCinemas = loadJSON('cinemas.json', []);
    
    const venues = cachedVenues;
    const cinemas = cachedCinemas;

    // 1. Load and Transform all data sources
    const allSources: { file: string, source?: string }[] = [
        { file: 'interpark.json', source: 'interpark' },
        { file: 'timeticket.json', source: 'timeticket' },
        { file: 'festivals.json', source: 'festival' },
        { file: 'kovo.json', source: 'volleyball' },
        { file: 'kbl.json', source: 'basketball' },
        { file: 'kbo.json', source: 'baseball' },
        { file: 'handball.json', source: 'handball' },
        { file: 'kleague.json', source: 'football' },
        { file: 'movies.json', source: 'movie' },
        { file: 'myrealtrip-kids.json', source: 'myrealtrip-kids' },
        { file: 'sssd-class.json', source: 'sssd-class' },
        { file: 'umclass.json', source: 'umclass' },
        { file: 'mochaclass.json', source: 'mochaclass' },
        { file: 'seoul-culture.json', source: 'seoul' },
        { file: 'culture-portal.json', source: 'culture-portal' },
        { file: 'mommom.json', source: 'mommom' },
        { file: 'mommom-activities.json', source: 'mommom-activity' },
        { file: 'mommom-products.json', source: 'mommom-product' },
        { file: 'museum.json', source: 'museum' },
        { file: 'kopis-performances.json', source: 'kopis' },
        { file: 'tourism.json', source: 'tourism' },
    ];

    const allPerformances = allSources.flatMap(({ file, source }) => {
        const data = loadJSON(file);
        const rawItems = safeArray<any>(data);
        if (rawItems.length > 0) {
            console.log(`[DEBUG] Source: ${source}, Raw items: ${rawItems.length}`);
        }
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
            const cinema = cinemas.find((c: any) => c.name === p.venue);
            if (cinema && cinema.lat && cinema.lng) {
                p.lat = cinema.lat;
                p.lng = cinema.lng;
                p.address = cinema.address;
            }
        }

        if (p.genre !== 'movie' && !isPerformanceActive(p.date, now)) return false;

        // Correct approach: if p.genre === 'movie' return true; for now?
        // "나머지 서울/경기/인천 지역 한정을 전국단위로 범위를 확장했기 때문에, 지역 필터를 사용해서 비노출 시키는 컨텐츠는 없도록 해줘."
        // This implies NO content should be hidden by region filter.

        // Filter out bad venues
        if (p.venue === '예매하기') return false;
        if (/^\d{1,2}\.\d{1,2}/.test(p.venue)) return false;

        // Address/Location Validation (Strict Policy)
        if (p.genre !== 'movie') {
            let v = venues[p.venue];

            // Disambiguation for regional tags [창원], [제주] etc.
            if (p.bracketRegion) {
                const bRegion = p.bracketRegion;
                if (!v || (v.address && !v.address.includes(bRegion))) {
                    const venueKeys = Object.keys(venues);
                    const cleanName = p.venue.replace(/홀$|센터$|관$|장$/, '').trim();
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
                p.lat = lat;
                p.lng = lng;
                if (!hasAddress) p.address = p.venue || '주소 정보 없음';
            } else if (v && v.address && v.address !== '정보 없음' && (v.lat || v.latitude) && (v.lng || v.longitude)) {
                p.lat = (v.lat || v.latitude) as number;
                p.lng = (v.lng || v.longitude) as number;
                p.address = v.address;
            } else if (p.source?.startsWith('mommom')) {
                // Keep MomMom items even if geo fails (Fallback to Seoul/Central or just don't filter)
                if (!p.address) p.address = p.venue;
            } else {
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

    // 5. Custom Movie Sorting
    // Current Rule: Top 10 Ranked first, then Upcoming releases by date, then others.
    const movieItems = stablePerformances.filter(p => p.genre === 'movie');
    const otherItems = stablePerformances.filter(p => p.genre !== 'movie');

    movieItems.sort((a, b) => {
        const rankA = a.rank || 999;
        const rankB = b.rank || 999;
        
        // Priority 1: Ranked 1-10
        if (rankA <= 10 || rankB <= 10) {
            if (rankA !== rankB) return rankA - rankB;
        }

        // Priority 2: Upcoming/Active (Date >= Today)
        const dateA = new Date((a.dateRaw || '00000000').replace(/-/g, '').replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')).getTime();
        const dateB = new Date((b.dateRaw || '00000000').replace(/-/g, '').replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')).getTime();
        const today = new Date().setHours(0, 0, 0, 0);

        const isActiveA = dateA >= today;
        const isActiveB = dateB >= today;

        if (isActiveA && !isActiveB) return -1;
        if (!isActiveA && isActiveB) return 1;
        
        // If both are active/upcoming, sort by date (soonest first)
        if (isActiveA && isActiveB) {
            if (dateA !== dateB) return dateA - dateB;
        }

        // Tie-breaker: Rank (even if > 10) or Alphabetical
        if (rankA !== rankB) return rankA - rankB;
        return a.title.localeCompare(b.title);
    });

    const finalResult = [...otherItems, ...movieItems];

    cachedPerformances = safePerformanceList(finalResult);
    return cachedPerformances;
}
