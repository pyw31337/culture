'use client';

import { Suspense } from 'react';
import { AppProgressBar as ProgressBar } from 'next-nprogress-bar';

/**
 * next-nprogress-bar's AppProgressBar calls useSearchParams() internally to
 * detect route changes. Under Next.js `output: 'export'` that forces the
 * nearest Suspense boundary (which used to be the page-level one wrapping
 * <PerformanceList>) to be serialized as its fallback in the prerendered
 * HTML. To prevent that, we wrap AppProgressBar in its own Suspense with a
 * null fallback so the bail-out is contained here and never reaches the
 * caller's children.
 */
function ProgressBarInner() {
    return (
        <ProgressBar
            height="4px"
            color="#3b82f6" // blue-500
            options={{ showSpinner: false }}
            shallowRouting
        />
    );
}

export default function ProgressBarProvider({ children }: { children: React.ReactNode }) {
    return (
        <>
            <Suspense fallback={null}>
                <ProgressBarInner />
            </Suspense>
            {children}
        </>
    );
}
