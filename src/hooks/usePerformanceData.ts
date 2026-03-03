import { useState, useEffect } from 'react';
import { Performance } from '@/types';

interface UsePerformanceDataProps {
    initialPerformances: Performance[];
}

export function usePerformanceData({ initialPerformances }: UsePerformanceDataProps) {
    const [allPerformances, setAllPerformances] = useState<Performance[]>(initialPerformances);
    const [cinemas, setCinemas] = useState<any[]>([]);
    const [venues, setVenues] = useState<Record<string, any>>({});
    const [isDataFullyLoaded, setIsDataFullyLoaded] = useState(false);

    useEffect(() => {
        const loadAllData = async () => {
            try {
                const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
                const ts = new Date().getTime();

                const results = await Promise.allSettled([
                    fetch(`${basePath}/data/performances.json?v=${ts}`).then(r => r.ok ? r.json() : []),
                    fetch(`${basePath}/data/movies.json?v=${ts}`).then(r => r.ok ? r.json() : []),
                    fetch(`${basePath}/data/cinemas.json?v=${ts}`).then(r => r.ok ? r.json() : []),
                    fetch(`${basePath}/data/venues.json?v=${ts}`).then(r => r.ok ? r.json() : {})
                ]);

                const mergedData: Performance[] = [];

                results.forEach((res, index) => {
                    if (res.status === 'fulfilled') {
                        if (index === 2) {
                            setCinemas(res.value);
                        } else if (index === 3) {
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
        const timer = setTimeout(() => {
            loadAllData();
        }, isDeepLink ? 0 : 500);

        return () => clearTimeout(timer);
    }, []);

    return {
        allPerformances,
        setAllPerformances,
        cinemas,
        venues,
        isDataFullyLoaded
    };
}
