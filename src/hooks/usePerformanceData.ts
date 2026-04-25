import { useState, useEffect } from 'react';
import { Performance } from '@/types';
import type { CinemaData, VenueData } from '@/lib/performance-data';

interface UsePerformanceDataProps {
    initialPerformances: Performance[];
}

export function usePerformanceData({ initialPerformances }: UsePerformanceDataProps) {
    const [allPerformances, setAllPerformances] = useState<Performance[]>(initialPerformances);
    const [cinemas, setCinemas] = useState<CinemaData[]>([]);
    const [venues, setVenues] = useState<Record<string, VenueData>>({});
    const [isDataFullyLoaded, setIsDataFullyLoaded] = useState(false);

    useEffect(() => {
        const loadAllData = async () => {
            try {
                const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

                const results = await Promise.allSettled([
                    fetch(`${basePath}/data/performances.json`).then(r => r.ok ? r.json() : []),
                    fetch(`${basePath}/data/cinemas.json`).then(r => r.ok ? r.json() : []),
                    fetch(`${basePath}/data/venues.json`).then(r => r.ok ? r.json() : {})
                ]);

                const mergedData: Performance[] = [];

                results.forEach((res, index) => {
                    if (res.status === 'fulfilled') {
                        if (index === 1) {
                            setCinemas(res.value);
                        } else if (index === 2) {
                            setVenues(res.value);
                        } else if (Array.isArray(res.value)) {
                            mergedData.push(...res.value);
                        }
                    } else {
                        console.error(`Failed to load data source index ${index}`, res.reason);
                    }
                });

                if (mergedData.length > 0) {
                    setAllPerformances(mergedData);
                }
                setIsDataFullyLoaded(true);

            } catch (e) {
                console.error("Background data load failed", e);
                setIsDataFullyLoaded(true); // Still mark as loaded to stop spinners
            }
        };

        const isDeepLink = typeof window !== 'undefined' && window.location.hash.startsWith('#p=');
        const shouldPrioritizeFetch = isDeepLink || initialPerformances.length === 0;
        const timer = setTimeout(() => {
            loadAllData();
        }, shouldPrioritizeFetch ? 0 : 500);

        return () => clearTimeout(timer);
    }, [initialPerformances.length]);

    return {
        allPerformances,
        setAllPerformances,
        cinemas,
        venues,
        isDataFullyLoaded
    };
}
