'use client';

import { AppProgressBar as ProgressBar } from 'next-nprogress-bar';

export default function ProgressBarProvider({ children }: { children: React.ReactNode }) {
    return (
        <>
            <ProgressBar
                height="4px"
                color="#3b82f6" // blue-500
                options={{ showSpinner: false }}
                shallowRouting
            />
            {children}
        </>
    );
}
