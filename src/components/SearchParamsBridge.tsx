'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

interface SearchParamsBridgeProps {
    onParams: (params: URLSearchParams) => void;
}

/**
 * Isolated bridge component that calls useSearchParams() and forwards the
 * value to its parent via callback.
 *
 * Why this exists:
 * - We use Next.js `output: 'export'` (static prerender for GitHub Pages).
 * - In static prerendering, any client component that calls useSearchParams()
 *   in its render body forces the nearest <Suspense> boundary to be serialized
 *   as the fallback in the prerendered HTML. The real markup only appears
 *   after client-side hydration.
 * - That breaks first-paint SSR and SEO (Googlebot's first pass sees the
 *   fallback). Page data is still in the HTML (RSC payload), it just isn't
 *   visually rendered.
 *
 * The fix:
 * - Keep useSearchParams() in this tiny component, which renders `null`.
 * - Parent components hold the URLSearchParams in state and read it
 *   synchronously - their main markup no longer calls useSearchParams() and is
 *   prerendered normally.
 * - Wrap <SearchParamsBridge> in <Suspense fallback={null}> at the consumer
 *   site so only this invisible component bails out to client-side rendering.
 *
 * The reactive behavior of useSearchParams (auto-update on router.replace /
 * popstate) is preserved because the effect re-runs whenever the underlying
 * URLSearchParams reference changes.
 */
export default function SearchParamsBridge({ onParams }: SearchParamsBridgeProps) {
    const params = useSearchParams();

    useEffect(() => {
        onParams(params);
    }, [params, onParams]);

    return null;
}
