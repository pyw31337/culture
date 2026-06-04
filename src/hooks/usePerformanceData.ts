import { startTransition, useEffect, useState } from 'react';
import { Performance } from '@/types';
import type { CinemaData, VenueData } from '@/lib/performance-data';

type PerformanceLoadPolicy = 'full' | 'initial-only';
type BackgroundLoadPriority = 'immediate' | 'deferred';

interface UsePerformanceDataProps {
    initialPerformances: Performance[];
    performanceLoadPolicy?: PerformanceLoadPolicy;
    performanceDataPath?: string;
    backgroundLoadPriority?: BackgroundLoadPriority;
    loadCinemas?: boolean;
    loadVenues?: boolean;
}

let performancesCache: Performance[] | null = null;
let performancesPromise: Promise<Performance[]> | null = null;
const performancesCacheByPath = new Map<string, Performance[]>();
const performancesPromiseByPath = new Map<string, Promise<Performance[]>>();
let cinemasCache: CinemaData[] | null = null;
let cinemasPromise: Promise<CinemaData[]> | null = null;
let venuesCache: Record<string, VenueData> | null = null;
let venuesPromise: Promise<Record<string, VenueData>> | null = null;

const getBasePath = () => process.env.NEXT_PUBLIC_BASE_PATH || '';

type PerformancePageManifest = {
    total: number;
    pageSize: number;
    pages: string[];
};

async function fetchJson<T>(path: string, fallback: T): Promise<T> {
    const response = await fetch(`${getBasePath()}${path}`);
    if (!response.ok) return fallback;
    return response.json() as Promise<T>;
}

function getCachedPerformances(path: string) {
    if (path === '/data/performances.json' && performancesCache) return performancesCache;
    return performancesCacheByPath.get(path) || null;
}

function waitForBrowserIdle() {
    if (typeof window === 'undefined') return Promise.resolve();

    return new Promise<void>((resolve) => {
        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(() => resolve(), { timeout: 250 });
            return;
        }
        globalThis.setTimeout(resolve, 16);
    });
}

function mergePerformances(current: Performance[], next: Performance[]) {
    const byId = new Map<string, Performance>();
    current.forEach((item) => byId.set(item.id, item));
    next.forEach((item) => byId.set(item.id, item));
    return Array.from(byId.values());
}

function loadPerformances(
    path = '/data/performances.json',
    onProgress?: (data: Performance[]) => void,
): Promise<Performance[]> {
    const cached = getCachedPerformances(path);
    if (cached) return Promise.resolve(cached);

    const existingPromise = path === '/data/performances.json'
        ? performancesPromise
        : performancesPromiseByPath.get(path);
    if (existingPromise) return existingPromise;

    const promise = (path.endsWith('/manifest.json')
        ? fetchJson<PerformancePageManifest>(path, { total: 0, pageSize: 0, pages: [] })
            .then(async (manifest) => {
                let merged: Performance[] = [];
                for (let index = 0; index < manifest.pages.length; index += 1) {
                    const page = await fetchJson<Performance[]>(manifest.pages[index], []);
                    merged = mergePerformances(merged, page);
                    if (onProgress && (index === 0 || index % 2 === 1 || index === manifest.pages.length - 1)) {
                        onProgress(merged);
                    }
                    await waitForBrowserIdle();
                }
                return merged;
            })
        : fetchJson<Performance[]>(path, []))
        .then((data) => {
            performancesCacheByPath.set(path, data);
            if (path === '/data/performances.json') {
                performancesCache = data;
            }
            return data;
        })
        .finally(() => {
            performancesPromiseByPath.delete(path);
            if (path === '/data/performances.json') {
                performancesPromise = null;
            }
        });

    performancesPromiseByPath.set(path, promise);
    if (path === '/data/performances.json') {
        performancesPromise = promise;
    }

    return promise;
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
    performanceDataPath = '/data/performances.json',
    backgroundLoadPriority = 'deferred',
    loadCinemas: shouldLoadCinemas = false,
    loadVenues: shouldLoadVenues = false,
}: UsePerformanceDataProps) {
    const [allPerformances, setAllPerformances] = useState<Performance[]>(() => {
        const cachedPerformances = getCachedPerformances(performanceDataPath);
        if (performanceLoadPolicy === 'full' && cachedPerformances) {
            return cachedPerformances;
        }
        return initialPerformances;
    });
    const [cinemas, setCinemas] = useState<CinemaData[]>(() => shouldLoadCinemas && cinemasCache ? cinemasCache : []);
    const [venues, setVenues] = useState<Record<string, VenueData>>(() => shouldLoadVenues && venuesCache ? venuesCache : {});
    const [isDataFullyLoaded, setIsDataFullyLoaded] = useState(() => {
        const performancesReady = performanceLoadPolicy !== 'full' || Boolean(getCachedPerformances(performanceDataPath));
        const cinemasReady = !shouldLoadCinemas || Boolean(cinemasCache);
        const venuesReady = !shouldLoadVenues || Boolean(venuesCache);
        return performancesReady && cinemasReady && venuesReady;
    });

    useEffect(() => {
        let isCancelled = false;

        const loadRequestedData = async () => {
            const requiresColdLoad =
                (performanceLoadPolicy === 'full' && !getCachedPerformances(performanceDataPath)) ||
                (shouldLoadCinemas && !cinemasCache) ||
                (shouldLoadVenues && !venuesCache);

            if (requiresColdLoad) {
                setIsDataFullyLoaded(false);
            }

            const tasks: Promise<void>[] = [];

            if (performanceLoadPolicy === 'full') {
                const handleProgress = performanceDataPath.endsWith('/manifest.json')
                    ? (data: Performance[]) => {
                        if (isCancelled || data.length === 0) return;
                        startTransition(() => {
                            setAllPerformances((current) => mergePerformances(current, data));
                        });
                    }
                    : undefined;

                tasks.push(
                    loadPerformances(performanceDataPath, handleProgress)
                        .then((data) => {
                            if (isCancelled || data.length === 0) return;
                            startTransition(() => {
                                setAllPerformances((current) => mergePerformances(current, data));
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
    }, [backgroundLoadPriority, initialPerformances.length, performanceDataPath, performanceLoadPolicy, shouldLoadCinemas, shouldLoadVenues]);

    return {
        allPerformances,
        setAllPerformances,
        cinemas,
        venues,
        isDataFullyLoaded
    };
}
