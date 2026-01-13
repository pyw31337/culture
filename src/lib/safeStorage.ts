/**
 * SSR-safe localStorage wrapper
 * Handles all edge cases: server-side rendering, JSON parsing errors, quota exceeded
 */
export const safeStorage = {
    /**
     * Get a value from localStorage with safe fallbacks
     * @param key - Storage key
     * @param defaultValue - Value to return if key doesn't exist or parsing fails
     */
    get<T>(key: string, defaultValue: T): T {
        // Guard: SSR environment
        if (typeof window === 'undefined') return defaultValue;

        try {
            const item = localStorage.getItem(key);
            if (item === null) return defaultValue;
            return JSON.parse(item) as T;
        } catch (e) {
            console.warn(`[safeStorage] Failed to parse "${key}":`, e);
            return defaultValue;
        }
    },

    /**
     * Set a value in localStorage with error handling
     * @param key - Storage key
     * @param value - Value to store (will be JSON stringified)
     * @returns true if successful, false otherwise
     */
    set<T>(key: string, value: T): boolean {
        // Guard: SSR environment
        if (typeof window === 'undefined') return false;

        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            // Handle quota exceeded or other errors
            console.error(`[safeStorage] Failed to save "${key}":`, e);
            return false;
        }
    },

    /**
     * Remove a key from localStorage
     * @param key - Storage key to remove
     * @returns true if successful, false otherwise
     */
    remove(key: string): boolean {
        if (typeof window === 'undefined') return false;

        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.error(`[safeStorage] Failed to remove "${key}":`, e);
            return false;
        }
    },

    /**
     * Check if a key exists in localStorage
     * @param key - Storage key to check
     */
    has(key: string): boolean {
        if (typeof window === 'undefined') return false;

        try {
            return localStorage.getItem(key) !== null;
        } catch {
            return false;
        }
    }
};

export default safeStorage;
