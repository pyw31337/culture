
import { NextRequest, NextResponse } from 'next/server';
import { getAllPerformances } from '@/lib/performance-data';
import { filterPerformances, sortPerformances } from '@/lib/performance-filter';

// Force dynamic since we read query params
export const dynamic = 'force-dynamic';

// Minimal Cache for 'getAllPerformances' to avoid reading JSONs on every request
// Since we are server-side, this variable persists broadly in warm lambdas/servers
let cachedPerformances: any[] | null = null;
let lastCacheTime = 0;
const CACHE_DURATION = 1000 * 60 * 5; // 5 Minutes

async function getCachedPerformances() {
    const now = Date.now();
    if (cachedPerformances && (now - lastCacheTime < CACHE_DURATION)) {
        return cachedPerformances;
    }
    const data = await getAllPerformances(); // This loads from JSON files
    cachedPerformances = data;
    lastCacheTime = now;
    return data;
}

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '24', 10);

    const genre = searchParams.get('genre') || 'all';
    const region = searchParams.get('region') || 'all';
    const district = searchParams.get('district') || 'all';
    const venue = searchParams.get('venue') || 'all';
    const search = searchParams.get('search') || '';

    // GPS
    const latStr = searchParams.get('lat');
    const lngStr = searchParams.get('lng');
    const radiusStr = searchParams.get('radius');

    const lat = latStr ? parseFloat(latStr) : undefined;
    const lng = lngStr ? parseFloat(lngStr) : undefined;
    const radius = radiusStr ? parseFloat(radiusStr) : undefined;

    try {
        const allData = await getCachedPerformances();

        // 1. Filter
        const filtered = filterPerformances(allData, {
            genre,
            region,
            district,
            venue,
            search,
            lat,
            lng,
            radius
        });

        // 2. Sort
        // Passing empty keywords for now as server-side context doesn't have partial hero state
        const sorted = sortPerformances(filtered, genre);

        // 3. Paginate
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        const paginatedData = sorted.slice(startIndex, endIndex);

        const hasMore = endIndex < sorted.length;

        // Optionally, if Page 1 and random shuffle is requested by client (e.g. seed), we might handle it.
        // But implementation used Date sort for stability.

        return NextResponse.json({
            data: paginatedData,
            meta: {
                total: sorted.length,
                page,
                limit,
                hasMore
            }
        });

    } catch (error) {
        console.error("API Error:", error);
        return NextResponse.json({ error: 'Failed to fetch performances' }, { status: 500 });
    }
}
