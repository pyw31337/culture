'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BellRing, RefreshCcw, X } from 'lucide-react';
import { formatKoreanDateTime } from '@/lib/build-info';
import { safeStorage } from '@/lib/safeStorage';

interface VersionUpdateBannerProps {
    currentVersion?: string | null;
    currentGeneratedAt?: string | null;
}

interface UpdateState {
    version: string | null;
    generatedAt: string | null;
    source: 'version-check' | 'service-worker';
}

interface WorkboxLike {
    addEventListener?: (type: string, listener: EventListener) => void;
    removeEventListener?: (type: string, listener: EventListener) => void;
    messageSkipWaiting?: () => void;
}

const DISMISSED_VERSION_KEY = 'culture_dismissed_version';
const DISMISSED_AT_KEY = 'culture_dismissed_version_at';
const DISMISS_COOLDOWN_MS = 6 * 60 * 60 * 1000;

function parseVersionText(value: string) {
    const match = value.match(/Version:\s*([^\s]+)/i);
    return match?.[1] ?? null;
}

async function fetchCurrentLiveVersion(basePath: string) {
    // Prefer build-info.json — same field as VersionUpdateBanner currentVersion prop.
    // version.txt often drifts and caused permanent "update available" modals.
    try {
        const response = await fetch(`${basePath}/data/build-info.json?ts=${Date.now()}`, {
            cache: 'no-store',
            headers: { 'cache-control': 'no-store' },
        });
        if (response.ok) {
            const payload = await response.json() as { version?: unknown };
            if (typeof payload.version === 'string' || typeof payload.version === 'number') {
                return String(payload.version);
            }
        }
    } catch {
        // fall through to version.txt
    }

    try {
        const response = await fetch(`${basePath}/version.txt?ts=${Date.now()}`, {
            cache: 'no-store',
            headers: { 'cache-control': 'no-store' },
        });
        if (!response.ok) return null;
        return parseVersionText(await response.text());
    } catch {
        return null;
    }
}

async function fetchCurrentBuildGeneratedAt(basePath: string) {
    const response = await fetch(`${basePath}/data/build-info.json?ts=${Date.now()}`, {
        cache: 'no-store',
        headers: {
            'cache-control': 'no-store',
        },
    });

    if (!response.ok) return null;

    const payload = await response.json() as { generatedAt?: unknown };
    return typeof payload.generatedAt === 'string' ? payload.generatedAt : null;
}

export default function VersionUpdateBanner({
    currentVersion,
    currentGeneratedAt,
}: VersionUpdateBannerProps) {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    const [pendingUpdate, setPendingUpdate] = useState<UpdateState | null>(null);
    const isCheckingRef = useRef(false);
    const currentVersionRef = useRef(currentVersion ?? null);

    useEffect(() => {
        currentVersionRef.current = currentVersion ?? null;
    }, [currentVersion]);

    const announceUpdate = useCallback((update: UpdateState) => {
        const dismissedVersion = safeStorage.get<string | null>(DISMISSED_VERSION_KEY, null);
        const dismissedAt = safeStorage.get<number | null>(DISMISSED_AT_KEY, null);
        if (update.version && dismissedVersion === update.version) return;
        if (typeof dismissedAt === 'number' && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS) {
            if (!update.version || update.version === dismissedVersion) return;
        }
        setPendingUpdate(update);
    }, []);

    const checkForUpdate = useCallback(async () => {
        if (process.env.NODE_ENV !== 'production') return;
        if (typeof window === 'undefined' || isCheckingRef.current) return;
        if (!navigator.onLine || !currentVersionRef.current) return;

        isCheckingRef.current = true;

        try {
            const liveVersion = await fetchCurrentLiveVersion(basePath);
            if (!liveVersion || liveVersion === currentVersionRef.current) {
                return;
            }

            const generatedAt = await fetchCurrentBuildGeneratedAt(basePath);
            announceUpdate({
                version: liveVersion,
                generatedAt,
                source: 'version-check',
            });
        } catch {
            // Ignore transient network/cache errors. We will retry on focus/interval.
        } finally {
            isCheckingRef.current = false;
        }
    }, [announceUpdate, basePath]);

    useEffect(() => {
        if (process.env.NODE_ENV !== 'production' || typeof window === 'undefined') return;

        void checkForUpdate();

        const handleFocus = () => {
            void checkForUpdate();
        };
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void checkForUpdate();
            }
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        const intervalId = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
                void checkForUpdate();
            }
        }, 900000);

        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.clearInterval(intervalId);
        };
    }, [checkForUpdate]);

    useEffect(() => {
        if (process.env.NODE_ENV !== 'production' || typeof window === 'undefined') return;

        const workbox = (window as Window & { workbox?: WorkboxLike }).workbox;
        if (!workbox?.addEventListener) return;

        const handleWaiting: EventListener = () => {
            announceUpdate({
                version: currentVersionRef.current,
                generatedAt: currentGeneratedAt ?? null,
                source: 'service-worker',
            });
            void checkForUpdate();
        };

        const handleControlling: EventListener = () => {
            window.location.reload();
        };

        workbox.addEventListener('waiting', handleWaiting);
        workbox.addEventListener('controlling', handleControlling);

        return () => {
            workbox.removeEventListener?.('waiting', handleWaiting);
            workbox.removeEventListener?.('controlling', handleControlling);
        };
    }, [announceUpdate, checkForUpdate, currentGeneratedAt]);

    const handleDismiss = useCallback(() => {
        if (pendingUpdate?.version) {
            safeStorage.set(DISMISSED_VERSION_KEY, pendingUpdate.version);
        }
        safeStorage.set(DISMISSED_AT_KEY, Date.now());
        setPendingUpdate(null);
    }, [pendingUpdate]);

    const handleRefresh = useCallback(async () => {
        safeStorage.remove(DISMISSED_VERSION_KEY);
        safeStorage.remove(DISMISSED_AT_KEY);

        if (typeof window === 'undefined') return;

        const workbox = (window as Window & { workbox?: WorkboxLike }).workbox;
        if (workbox?.messageSkipWaiting) {
            workbox.messageSkipWaiting();
            window.setTimeout(() => {
                window.location.reload();
            }, 1200);
            return;
        }

        try {
            const registration = await navigator.serviceWorker?.getRegistration();
            await registration?.update();
        } catch {
            // Fallback to a hard reload below.
        }

        window.location.reload();
    }, []);

    if (!pendingUpdate) return null;

    const isWorkerReady = pendingUpdate.source === 'service-worker';
    const updateLabel = pendingUpdate.generatedAt
        ? formatKoreanDateTime(pendingUpdate.generatedAt, '방금 갱신')
        : formatKoreanDateTime(currentGeneratedAt, '방금 갱신');

    return (
        <div className="fixed top-4 left-4 right-4 z-[9999] md:left-auto md:right-8 md:w-[28rem] animate-in slide-in-from-top-5 duration-500">
            <div className="rounded-3xl border border-sky-400/30 bg-[#07111f]/90 p-4 text-white shadow-[0_18px_60px_rgba(14,165,233,0.24)] backdrop-blur-xl light:border-sky-500/20 light:bg-white/95 light:text-slate-900">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 rounded-2xl bg-sky-500/15 p-2.5 text-sky-300 light:bg-sky-100 light:text-sky-700">
                            {isWorkerReady ? <BellRing className="h-5 w-5" /> : <RefreshCcw className="h-5 w-5" />}
                        </div>
                        <div>
                            <p className="text-sm font-black tracking-tight">
                                {isWorkerReady ? '새 버전이 준비되었습니다' : '더 최신 데이터가 확인되었습니다'}
                            </p>
                            <p className="mt-1 text-sm text-sky-100/80 light:text-slate-600">
                                {updateLabel} 기준 운영 상태로 바뀌었습니다. 새로고침하면 최신 카테고리와 데이터를 바로 볼 수 있습니다.
                            </p>
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-sky-100/75 light:text-slate-500">
                                {pendingUpdate.version && (
                                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 light:border-slate-200 light:bg-slate-100">
                                        버전 {pendingUpdate.version}
                                    </span>
                                )}
                                <Link
                                    href="/status/"
                                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 transition hover:border-sky-300/40 hover:text-white light:border-slate-200 light:bg-slate-100 light:hover:border-sky-300 light:hover:text-sky-700"
                                >
                                    상태 페이지 보기
                                </Link>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleDismiss}
                        className="rounded-full p-1.5 text-sky-100/70 transition hover:bg-white/10 hover:text-white light:text-slate-500 light:hover:bg-slate-100 light:hover:text-slate-900"
                        aria-label="업데이트 배너 닫기"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="mt-4 flex items-center justify-end gap-2">
                    <button
                        onClick={handleDismiss}
                        className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-sky-100/80 transition hover:bg-white/10 hover:text-white light:border-slate-200 light:text-slate-600 light:hover:bg-slate-100 light:hover:text-slate-900"
                    >
                        나중에
                    </button>
                    <button
                        onClick={() => void handleRefresh()}
                        className="rounded-full bg-sky-500 px-4 py-2 text-sm font-black text-white shadow-lg shadow-sky-500/25 transition hover:bg-sky-400"
                    >
                        지금 새로고침
                    </button>
                </div>
            </div>
        </div>
    );
}
