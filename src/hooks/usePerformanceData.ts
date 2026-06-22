import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Performance } from '@/types';
import type { CinemaData, VenueData } from '@/lib/performance-data';

type PerformanceLoadPolicy = 'full' | 'initial-only' | 'paged';
type BackgroundLoadPriority = 'immediate' | 'deferred';

interface UsePerformanceDataProps {
    initialPerformances: Performance[];
    performanceLoadPolicy?: PerformanceLoadPolicy;
    performanceDataPath?: string;
    dataVersion?: string | null;
    backgroundLoadPriority?: BackgroundLoadPriority;
    loadCinemas?: boolean;
    loadVenues?: boolean;
}

let performancesCache: Performance[] | null = null;
let performancesPromise: Promise<Performance[]> | null = null;
const performancesCacheByPath = new Map<string, Performance[]>();
const performancesPromiseByPath = new Map<string, Promise<Performance[]>>();
const manifestCacheByPath = new Map<string, PerformancePageManifest>();
const manifestPromiseByPath = new Map<string, Promise<PerformancePageManifest>>();
const pageCacheByPath = new Map<string, Performance[]>();
const pagePromiseByPath = new Map<string, Promise<Performance[]>>();
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

function buildVersionedDataPath(path: string, dataVersion?: string | null) {
    if (!dataVersion) return path;
    if (!path.startsWith('/data/')) return path;
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}v=${encodeURIComponent(dataVersion)}`;
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
    if (next.length === 0) return current;
    const byId = new Map<string, Performance>();
    current.forEach((item) => byId.set(item.id, item));
    next.forEach((item) => byId.set(item.id, item));
    return Array.from(byId.values());
}

function getManifest(path: string): Promise<PerformancePageManifest> {
    const cached = manifestCacheByPath.get(path);
    if (cached) return Promise.resolve(cached);

    const existing = manifestPromiseByPath.get(path);
    if (existing) return existing;

    const promise = fetchJson<PerformancePageManifest>(path, { total: 0, pageSize: 0, pages: [] })
        .then((manifest) => {
            manifestCacheByPath.set(path, manifest);
            return manifest;
        })
        .finally(() => manifestPromiseByPath.delete(path));

    manifestPromiseByPath.set(path, promise);
    return promise;
}

function getPage(path: string): Promise<Performance[]> {
    const cached = pageCacheByPath.get(path);
    if (cached) return Promise.resolve(cached);

    const existing = pagePromiseByPath.get(path);
    if (existing) return existing;

    const promise = fetchJson<Performance[]>(path, [])
        .then((page) => {
            pageCacheByPath.set(path, page);
            return page;
        })
        .finally(() => pagePromiseByPath.delete(path));

    pagePromiseByPath.set(path, promise);
    return promise;
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
        ? getManifest(path)
            .then(async (manifest) => {
                let merged: Performance[] = [];
                for (let index = 0; index < manifest.pages.length; index += 1) {
                    const page = await getPage(manifest.pages[index]);
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
    dataVersion,
    backgroundLoadPriority = 'deferred',
    loadCinemas: shouldLoadCinemas = false,
    loadVenues: shouldLoadVenues = false,
}: UsePerformanceDataProps) {
    const effectivePerformanceDataPath = useMemo(
        () => buildVersionedDataPath(performanceDataPath, dataVersion),
        [dataVersion, performanceDataPath]
    );
    const isPagedMode = performanceLoadPolicy === 'paged' && performanceDataPath.endsWith('/manifest.json');
    const [allPerformances, setAllPerformances] = useState<Performance[]>(() => {
        const cachedPerformances = getCachedPerformances(effectivePerformanceDataPath);
        if (performanceLoadPolicy === 'full' && cachedPerformances) {
            return cachedPerformances;
        }
        return initialPerformances;
    });
    const [cinemas, setCinemas] = useState<CinemaData[]>(() => shouldLoadCinemas && cinemasCache ? cinemasCache : []);
    const [venues, setVenues] = useState<Record<string, VenueData>>(() => shouldLoadVenues && venuesCache ? venuesCache : {});
    const [pagedManifest, setPagedManifest] = useState<PerformancePageManifest | null>(() => manifestCacheByPath.get(effectivePerformanceDataPath) || null);
    const [loadedPageCount, setLoadedPageCount] = useState(0);
    const [isPerformancePageLoading, setIsPerformancePageLoading] = useState(false);
    const pageLoadCursorRef = useRef(0);
    const pageLoadPromiseRef = useRef<Promise<void> | null>(null);
    const [isDataFullyLoaded, setIsDataFullyLoaded] = useState(() => {
        if (isPagedMode) return false;
        const performancesReady = performanceLoadPolicy !== 'full' || Boolean(getCachedPerformances(effectivePerformanceDataPath));
        const cinemasReady = !shouldLoadCinemas || Boolean(cinemasCache);
        const venuesReady = !shouldLoadVenues || Boolean(venuesCache);
        return performancesReady && cinemasReady && venuesReady;
    });

    useEffect(() => {
        if (!isPagedMode) return;
        let isCancelled = false;
        getManifest(effectivePerformanceDataPath)
            .then((manifest) => {
                if (isCancelled) return;
                setPagedManifest(manifest);
                const firstPage = manifest.pages[0];
                // If page 1 was already fetched in this browser session, hydrate it
                // back into the current list before advancing the cursor. Otherwise a
                // route return could skip items that were only present in cached page 1.
                if (firstPage && pageCacheByPath.has(firstPage)) {
                    const cachedPage = pageCacheByPath.get(firstPage) || [];
                    startTransition(() => {
                        setAllPerformances((current) => mergePerformances(current, cachedPage));
                    });
                    pageLoadCursorRef.current = Math.max(pageLoadCursorRef.current, 1);
                    setLoadedPageCount(pageLoadCursorRef.current);
                }
            })
            .catch((error) => console.error('Failed to load performance manifest', error));
        return () => {
            isCancelled = true;
        };
    }, [effectivePerformanceDataPath, isPagedMode]);

    const loadNextPerformancePage = useCallback(async () => {
        if (!isPagedMode || pageLoadPromiseRef.current) return;
        const manifest = pagedManifest || await getManifest(effectivePerformanceDataPath);
        setPagedManifest(manifest);

        const pagePath = manifest.pages[pageLoadCursorRef.current];
        if (!pagePath) return;

        setIsPerformancePageLoading(true);
        const loadPromise = getPage(pagePath)
            .then((page) => {
                pageLoadCursorRef.current += 1;
                setLoadedPageCount(pageLoadCursorRef.current);
                startTransition(() => {
                    setAllPerformances((current) => mergePerformances(current, page));
                });
            })
            .catch((error) => {
                console.error('Failed to load performance page', error);
            })
            .finally(() => {
                pageLoadPromiseRef.current = null;
                setIsPerformancePageLoading(false);
            });

        pageLoadPromiseRef.current = loadPromise;
        await loadPromise;
    }, [effectivePerformanceDataPath, isPagedMode, pagedManifest]);

    const loadAllPerformancePages = useCallback(async () => {
        if (!isPagedMode) return;
        if (pageLoadPromiseRef.current) {
            await pageLoadPromiseRef.current;
        }

        const manifest = pagedManifest || await getManifest(effectivePerformanceDataPath);
        setPagedManifest(manifest);
        const startIndex = pageLoadCursorRef.current;
        const remainingPaths = manifest.pages.slice(startIndex);
        if (remainingPaths.length === 0) return;

        setIsPerformancePageLoading(true);
        const loadPromise = Promise.all(remainingPaths.map((path) => getPage(path)))
            .then((pages) => {
                const completeBatch = pages.flat();
                setAllPerformances((current) => mergePerformances(current, completeBatch));
                pageLoadCursorRef.current = manifest.pages.length;
                setLoadedPageCount(manifest.pages.length);
            })
            .catch((error) => {
                console.error('Failed to load complete performance search data', error);
            })
            .finally(() => {
                pageLoadPromiseRef.current = null;
                setIsPerformancePageLoading(false);
            });

        pageLoadPromiseRef.current = loadPromise;
        await loadPromise;
    }, [effectivePerformanceDataPath, isPagedMode, pagedManifest]);

    useEffect(() => {
        let isCancelled = false;

        const loadRequestedData = async () => {
            const requiresColdLoad =
                (!isPagedMode && performanceLoadPolicy === 'full' && !getCachedPerformances(effectivePerformanceDataPath)) ||
                (shouldLoadCinemas && !cinemasCache) ||
                (shouldLoadVenues && !venuesCache);

            if (requiresColdLoad) {
                setIsDataFullyLoaded(false);
            }

            const tasks: Promise<void>[] = [];

            if (!isPagedMode && performanceLoadPolicy === 'full') {
                const handleProgress = performanceDataPath.endsWith('/manifest.json')
                    ? (data: Performance[]) => {
                        if (isCancelled || data.length === 0) return;
                        startTransition(() => {
                            setAllPerformances((current) => mergePerformances(current, data));
                        });
                    }
                    : undefined;

                tasks.push(
                    loadPerformances(effectivePerformanceDataPath, handleProgress)
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
                setIsDataFullyLoaded(!isPagedMode || pageLoadCursorRef.current >= (pagedManifest?.pages.length || 0));
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
    }, [backgroundLoadPriority, effectivePerformanceDataPath, initialPerformances.length, isPagedMode, performanceDataPath, performanceLoadPolicy, shouldLoadCinemas, shouldLoadVenues]);

    const hasMorePerformancePages = useMemo(() => {
        if (!isPagedMode) return false;
        return loadedPageCount < (pagedManifest?.pages.length || 0);
    }, [isPagedMode, loadedPageCount, pagedManifest?.pages.length]);

    useEffect(() => {
        if (!isPagedMode) return;
        setIsDataFullyLoaded(loadedPageCount >= (pagedManifest?.pages.length || 0));
    }, [isPagedMode, loadedPageCount, pagedManifest?.pages.length]);

    return {
        allPerformances,
        setAllPerformances,
        cinemas,
        venues,
        isDataFullyLoaded,
        isPerformancePageLoading,
        hasMorePerformancePages,
        loadNextPerformancePage,
        loadAllPerformancePages,
        performanceTotal: pagedManifest?.total || allPerformances.length,
    };
}
