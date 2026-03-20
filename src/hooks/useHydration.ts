'use client';
import { useState, useEffect } from 'react';

/**
 * Hook to safely detect client-side hydration.
 * Use this to guard code that depends on browser APIs (localStorage, window, etc.)
 * 
 * @returns true after component has mounted on client, false during SSR/initial render
 * 
 * @example
 * const isHydrated = useHydration();
 * 
 * // Guard localStorage access
 * useEffect(() => {
 *   if (!isHydrated) return;
 *   // Safe to access localStorage here
 * }, [isHydrated]);
 */
export function useHydration(): boolean {
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        setIsHydrated(true);
    }, []);

    return isHydrated;
}

export default useHydration;
