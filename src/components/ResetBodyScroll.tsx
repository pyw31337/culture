'use client';

import { useEffect } from 'react';

/**
 * Resets body scroll lock on mount.
 * When navigating from a page with an open modal (SharedDetailModal, etc.),
 * the body may still have overflow:hidden / position:fixed stuck.
 * This component clears those styles on mount.
 */
export default function ResetBodyScroll() {
    useEffect(() => {
        // Reset any leftover body scroll locks from modals / previous pages
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.width = '';
        document.documentElement.style.overflow = '';
    }, []);

    return null;
}
