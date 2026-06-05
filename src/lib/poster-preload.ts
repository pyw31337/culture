import type { Performance } from '@/types';
import { getOptimizedUrl, normalizeImageUrl } from '@/lib/utils';

type WarmPosterOptions = {
    limit?: number;
    width?: number;
    quality?: number;
    concurrency?: number;
    immediate?: boolean;
    includeOriginalFallback?: boolean;
};

const warmedUrls = new Set<string>();
const MAX_WARMED_URLS_PER_SESSION = 48;
const SLOW_CONNECTIONS = new Set(['slow-2g', '2g']);

function getConnectionInfo() {
    if (typeof navigator === 'undefined') return null;
    return (navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
    }).connection || null;
}

function canWarmImages() {
    if (typeof window === 'undefined') return false;

    const connection = getConnectionInfo();
    if (connection?.saveData) return false;
    if (connection?.effectiveType && SLOW_CONNECTIONS.has(connection.effectiveType)) return false;

    return true;
}

function scheduleWarmup(task: () => void, immediate?: boolean) {
    if (typeof window === 'undefined') return () => undefined;
    if (immediate) {
        task();
        return () => undefined;
    }

    const idleWindow = window as Window & typeof globalThis & {
        requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
        cancelIdleCallback?: (handle: number) => void;
    };

    if (typeof idleWindow.requestIdleCallback === 'function') {
        const id = idleWindow.requestIdleCallback(task, { timeout: 1400 });
        return () => idleWindow.cancelIdleCallback?.(id);
    }

    const timer = globalThis.setTimeout(task, 500);
    return () => globalThis.clearTimeout(timer);
}

function unique(values: string[]) {
    return Array.from(new Set(values.filter(Boolean)));
}

export function getPosterWarmupUrls(
    performance: Pick<Performance, 'image' | 'poster' | 'backupPoster' | 'posterUrl'>,
    {
        width = 360,
        quality = 62,
        includeOriginalFallback = false,
    }: Pick<WarmPosterOptions, 'width' | 'quality' | 'includeOriginalFallback'> = {}
) {
    const rawUrls = unique([
        normalizeImageUrl(performance.image),
        normalizeImageUrl(performance.posterUrl),
        normalizeImageUrl(performance.poster),
        normalizeImageUrl(performance.backupPoster),
    ]);

    const optimizedUrls = rawUrls.map((url) => getOptimizedUrl(url, width, quality));
    return includeOriginalFallback ? unique([...optimizedUrls, ...rawUrls]) : unique(optimizedUrls);
}

function preloadUrl(url: string) {
    return new Promise<void>((resolve) => {
        const img = new window.Image();
        let settled = false;

        const finish = () => {
            if (settled) return;
            settled = true;
            resolve();
        };

        const timeout = window.setTimeout(finish, 3000);
        img.decoding = 'async';
        img.loading = 'eager';
        img.onload = () => {
            window.clearTimeout(timeout);
            finish();
        };
        img.onerror = () => {
            window.clearTimeout(timeout);
            finish();
        };
        img.src = url;
    });
}

export function warmPosterImages(
    performances: Array<Pick<Performance, 'id' | 'image' | 'poster' | 'backupPoster' | 'posterUrl'>>,
    options: WarmPosterOptions = {}
) {
    if (!canWarmImages()) return () => undefined;

    const connection = getConnectionInfo();
    const isConstrainedConnection = connection?.effectiveType === '3g';
    const limit = Math.min(
        isConstrainedConnection ? Math.floor((options.limit ?? 24) / 2) : (options.limit ?? 24),
        MAX_WARMED_URLS_PER_SESSION
    );
    const concurrency = Math.max(1, Math.min(options.concurrency ?? 3, 4));
    const urls = unique(
        performances.flatMap((performance) => (
            getPosterWarmupUrls(performance, {
                width: options.width,
                quality: options.quality,
                includeOriginalFallback: options.includeOriginalFallback,
            })
        ))
    )
        .filter((url) => !warmedUrls.has(url))
        .slice(0, limit);

    if (urls.length === 0) return () => undefined;

    urls.forEach((url) => warmedUrls.add(url));
    while (warmedUrls.size > MAX_WARMED_URLS_PER_SESSION) {
        const first = warmedUrls.values().next().value;
        if (!first) break;
        warmedUrls.delete(first);
    }

    let cancelled = false;
    const cancelWarmup = scheduleWarmup(() => {
        let cursor = 0;
        const runNext = async (): Promise<void> => {
            if (cancelled) return;
            const url = urls[cursor];
            cursor += 1;
            if (!url) return;
            await preloadUrl(url);
            await runNext();
        };

        Array.from({ length: Math.min(concurrency, urls.length) }, () => runNext());
    }, options.immediate);

    return () => {
        cancelled = true;
        cancelWarmup();
    };
}
