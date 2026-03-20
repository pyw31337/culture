'use client';

import { useEffect } from 'react';

interface ShareRedirectProps {
    id: string;
}

export default function ShareRedirect({ id }: ShareRedirectProps) {
    useEffect(() => {
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
        // Use a slight delay to allow the Bridge UI to be perceived but fast enough to be responsive
        const timer = setTimeout(() => {
            window.location.replace(`${basePath}/#p=${id}`);
        }, 500);
        return () => clearTimeout(timer);
    }, [id]);

    return null; // Invisible, as the parent page provides the Bridge UI
}
