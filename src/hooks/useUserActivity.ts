import { useState, useEffect, useCallback } from 'react';
import { safeStorage } from '@/lib/safeStorage';

interface UserActivity {
    viewedGenres: Record<string, number>; // genre -> count
    viewedItems: string[]; // item IDs
    lastActive: number; // timestamp
}

const STORAGE_KEY = 'culture_user_activity_v1';

export function useUserActivity() {
    const [activity, setActivity] = useState<UserActivity>({
        viewedGenres: {},
        viewedItems: [],
        lastActive: Date.now()
    });

    // Load from storage on mount
    useEffect(() => {
        const stored = safeStorage.get<UserActivity>(STORAGE_KEY, {
            viewedGenres: {},
            viewedItems: [],
            lastActive: Date.now()
        });
        if (stored) {
            setActivity(prev => ({ ...prev, ...stored }));
        }
    }, []);

    // Persist to storage whenever activity changes
    useEffect(() => {
        if (Object.keys(activity.viewedGenres).length > 0 || activity.viewedItems.length > 0) {
            safeStorage.set(STORAGE_KEY, activity);
        }
    }, [activity]);

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
            return {
                ...prev,
                viewedItems: newItems,
                lastActive: Date.now()
            };
        });
    }, []);

    return {
        activity,
        trackGenreView,
        trackItemView
    };
}
