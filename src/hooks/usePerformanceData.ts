import { startTransition, useEffect, useState } from 'react';
import { Performance } from '@/types';
import type { CinemaData, VenueData } from '@/lib/performance-data';

type PerformanceLoadPolicy = 'full' | 'initial-only';
type BackgroundLoadPriority = 'immediate' | 'deferred';

interface UsePerformanceDataProps {
    initialPerformances: Performance[];
    performanceLoadPolicy?: PerformanceLoadPolicy;
    backgroundLoadPriority?: BackgroundLoadPriority;
    loadCinemas?: boolean;
    loadVenues?: boolean;
}

let performancesCache: Performance[] | null = null;
let performancesPromise: Promise<Performance[]> | null = null;
let cinemasCache: CinemaData[] | null = null;
let cinemasPromise: Promise<CinemaData[]> | null = null;
let venuesCache: Record<string, VenueData> | null = null;
let venuesPromise: Promise<Record<string, VenueData>> | null = null;

const getBasePath = () => process.env.NEXT_PUBLIC_BASE_PATH || '';

async function fetchJson<T>(path: string, fallback: T): Promise<T> {
    const response = await fetch(`${getBasePath()}${path}`);
    if (!response.ok) return fallback;
    return response.json() as Promise<T>;
}

function loadPerformances(): Promise<Performance[]> {
    if (performancesCache) return Promise.resolve(performancesCache);
    if (performancesPromise) return performancesPromise;

    performancesPromise = fetchJson<Performance[]>('/data/performances.json', [])
        .then((data) => {
            performancesCache = data;
            return data;
        })
        .finally(() => {
            performancesPromise = null;
        });

    return performancesPromise;
}

function loadCinemas(): Promise<CinemaData[]> {
    if (cinemasCache) return Promise.resolve(cinemasCache);
    if (cinemasPromise) return cinemasPromise;

    cinemasPromise = fetchJson<CinemaData[]>('/data/cinemas.json', [])
        .then((data) => {
            cinemasCache = data;
            return data;
        })
        .finally(() => {
            cinemasPromise = null;
        });

    return cinemasPromise;
}

function loadVenues(): Promise<Record<string, VenueData>> {
    if (venuesCache) return Promise.resolve(venuesCache);
    if (venuesPromise) return venuesPromise;

    venuesPromise = fetchJson<Record<string, VenueData>>('/data/venues.json', {})
        .then((data) => {
            venuesCache = data;
            return data;
        })
        .finally(() => {
            venuesPromise = null;
        });

    return venuesPromise;
}

function scheduleDeferredLoad(task: () => void) {
    if (typeof window === 'undefined') return () => undefined;

    if ('requestIdleCallback' in window) {
        const idleCallbackId = window.requestIdleCallback(task, { timeout: 1200 });
        return () => window.cancelIdleCallback(idleCallbackId);
    }

    const timer = globalThis.setTimeout(task, 500);
    return () => globalThis.clearTimeout(timer);
}

export function usePerformanceData({
    initialPerformances,
    performanceLoadPolicy = 'full',
    backgroundLoadPriority = 'deferred',
    loadCinemas: shouldLoadCinemas = false,
    loadVenues: shouldLoadVenues = false,
}: UsePerformanceDataProps) {
    const [allPerformances, setAllPerformances] = useState<Performance[]>(() => {
        if (performanceLoadPolicy === 'full' && performancesCache) {
            return performancesCache;
        }
        return initialPerformances;
    });
    const [cinemas, setCinemas] = useState<CinemaData[]>(() => shouldLoadCinemas && cinemasCache ? cinemasCache : []);
    const [venues, setVenues] = useState<Record<string, VenueData>>(() => shouldLoadVenues && venuesCache ? venuesCache : {});
    const [isDataFullyLoaded, setIsDataFullyLoaded] = useState(() => {
        const performancesReady = performanceLoadPolicy !== 'full' || Boolean(performancesCache);
        const cinemasReady = !shouldLoadCinemas || Boolean(cinemasCache);
        const venuesReady = !shouldLoadVenues || Boolean(venuesCache);
        return performancesReady && cinemasReady && venuesReady;
    });

    useEffect(() => {
        let isCancelled = false;

        const loadRequestedData = async () => {
            const requiresColdLoad =
                (performanceLoadPolicy === 'full' && !performancesCache) ||
                (shouldLoadCinemas && !cinemasCache) ||
                (shouldLoadVenues && !venuesCache);

            if (requiresColdLoad) {
                setIsDataFullyLoaded(false);
            }

            const tasks: Promise<void>[] = [];

            if (performanceLoadPolicy === 'full') {
                tasks.push(
                    loadPerformances()
                        .then((data) => {
                            if (isCancelled || data.length === 0) return;
                            startTransition(() => {
                                setAllPerformances(data);
                            });
                        })
                        .catch((error) => {
                            console.error('Failed to load performances data', error);
                        })
                );
            }

            if (shouldLoadCinemas) {
                tasks.push(
                    loadCinemas()
                        .then((data) => {
                            if (isCancelled) return;
                            startTransition(() => {
                                setCinemas(data);
                            });
                        })
                        .catch((error) => {
                            console.error('Failed to load cinemas data', error);
                        })
                );
            }

            if (shouldLoadVenues) {
                tasks.push(
                    loadVenues()
                        .then((data) => {
                            if (isCancelled) return;
                            startTransition(() => {
                                setVenues(data);
                            });
                        })
                        .catch((error) => {
                            console.error('Failed to load venues data', error);
                        })
                );
            }

            if (tasks.length === 0) {
                setIsDataFullyLoaded(true);
                return;
            }

            await Promise.allSettled(tasks);
            if (!isCancelled) {
                setIsDataFullyLoaded(true);
            }
        };

        const isDeepLink = typeof window !== 'undefined' && window.location.hash.startsWith('#p=');
        const shouldPrioritizeFetch = backgroundLoadPriority === 'immediate' || isDeepLink || initialPerformances.length === 0;

        if (shouldPrioritizeFetch) {
            void loadRequestedData();
            return () => {
                isCancelled = true;
            };
        }

        const cancelDeferredLoad = scheduleDeferredLoad(() => {
            void loadRequestedData();
        });

        return () => {
            isCancelled = true;
            cancelDeferredLoad();
        };
    }, [backgroundLoadPriority, initialPerformances.length, performanceLoadPolicy, shouldLoadCinemas, shouldLoadVenues]);

    return {
        allPerformances,
        setAllPerformances,
        cinemas,
        venues,
        isDataFullyLoaded
    };
}
