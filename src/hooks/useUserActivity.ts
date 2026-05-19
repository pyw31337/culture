import { useState, useEffect, useCallback } from 'react';
import { safeStorage } from '@/lib/safeStorage';

interface UserActivity {
    viewedGenres: Record<string, number>; // genre -> count
    viewedItems: string[]; // item IDs
    itemClicks: Record<string, number>; // item ID -> click count
    lastActive: number; // timestamp
}

const STORAGE_KEY = 'culture_user_activity_v1';
const DEFAULT_ACTIVITY: UserActivity = {
    viewedGenres: {},
    viewedItems: [],
    itemClicks: {},
    lastActive: 0
};

export function useUserActivity() {
    const [activity, setActivity] = useState<UserActivity>(() => ({
        ...DEFAULT_ACTIVITY,
        lastActive: Date.now()
    }));
    const [isActivityReady, setIsActivityReady] = useState(false);

    // Load from storage on mount
    useEffect(() => {
        const stored = safeStorage.get<UserActivity>(STORAGE_KEY, {
            ...DEFAULT_ACTIVITY,
            lastActive: Date.now()
        });
        if (stored) {
            setActivity(prev => ({ ...prev, ...stored }));
        }
        setIsActivityReady(true);
    }, []);

    // Persist to storage whenever activity changes
    useEffect(() => {
        if (!isActivityReady) return;
        if (Object.keys(activity.viewedGenres).length > 0 || activity.viewedItems.length > 0) {
            safeStorage.set(STORAGE_KEY, activity);
        }
    }, [activity, isActivityReady]);

    const trackGenreView = useCallback((genre: string) => {
        if (!genre || genre === 'all') return;

        setActivity(prev => {
            const currentCount = prev.viewedGenres[genre] || 0;
            return {
                ...prev,
                viewedGenres: {
                    ...prev.viewedGenres,
                    [genre]: currentCount + 1
                },
                lastActive: Date.now()
            };
        });
    }, []);

    const trackItemView = useCallback((itemId: string) => {
        if (!itemId) return;

        setActivity(prev => {
            // Keep only last 50 items to save space
            const newItems = [itemId, ...prev.viewedItems.filter(id => id !== itemId)].slice(0, 50);
            const currentClicks = prev.itemClicks?.[itemId] || 0;

            return {
                ...prev,
                viewedItems: newItems,
                itemClicks: {
                    ...prev.itemClicks,
                    [itemId]: currentClicks + 1
                },
                lastActive: Date.now()
            };
        });
    }, []);

    return {
        activity,
        trackGenreView,
        trackItemView,
        isActivityReady
    };
}
