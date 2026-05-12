import { useState, useEffect, useCallback } from 'react';
import type { FavoriteVenuePreference } from '@/types';
import { safeStorage } from '@/lib/safeStorage';
import { dedupeFavoriteVenuePreferences, normalizeFavoriteVenuePreference } from '@/lib/favorite-venues';

export function useUserPreferences() {
    const [likedIds, setLikedIds] = useState<string[]>([]);
    const [favoriteVenues, setFavoriteVenues] = useState<FavoriteVenuePreference[]>([]);
    const [savedKeywords, setSavedKeywords] = useState<string[]>([]);
    const [isStorageLoaded, setIsStorageLoaded] = useState(false);
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');

    // Initial Load
    useEffect(() => {
        setSavedKeywords(safeStorage.get<string[]>('culture_keywords', []));
        setLikedIds(safeStorage.get<string[]>('culture_likes', []));
        const storedFavoriteVenues = safeStorage.get<unknown[]>('culture_favorite_venues', []);
        const migratedFavoriteVenues = Array.isArray(storedFavoriteVenues)
            ? dedupeFavoriteVenuePreferences(
                storedFavoriteVenues
                    .map(normalizeFavoriteVenuePreference)
                    .filter((item): item is FavoriteVenuePreference => Boolean(item))
            )
            : [];
        setFavoriteVenues(migratedFavoriteVenues);

        const storedTheme = safeStorage.get<'light' | 'dark'>('theme', 'dark');
        setTheme(storedTheme);
        if (storedTheme === 'light') {
            document.documentElement.classList.remove('dark');
        } else {
            document.documentElement.classList.add('dark');
        }

        setIsStorageLoaded(true);
    }, []);

    // Persistence
    useEffect(() => {
        if (isStorageLoaded) safeStorage.set('culture_likes', likedIds);
    }, [likedIds, isStorageLoaded]);

    useEffect(() => {
        if (isStorageLoaded) safeStorage.set('culture_favorite_venues', favoriteVenues);
    }, [favoriteVenues, isStorageLoaded]);

    useEffect(() => {
        if (isStorageLoaded) safeStorage.set('culture_keywords', savedKeywords);
    }, [savedKeywords, isStorageLoaded]);

    const toggleTheme = useCallback(() => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        if (newTheme === 'light') {
            document.documentElement.classList.remove('dark');
        } else {
            document.documentElement.classList.add('dark');
        }
        safeStorage.set('theme', newTheme);
    }, [theme]);

    const toggleLike = useCallback((id: string) => {
        setLikedIds(prev => prev.includes(id) ? prev.filter(lid => lid !== id) : [...prev, id]);
    }, []);

    const toggleFavoriteVenue = useCallback((favoriteVenue: FavoriteVenuePreference | string) => {
        const normalized = normalizeFavoriteVenuePreference(favoriteVenue);
        if (!normalized) return;

        setFavoriteVenues(prev => {
            const exists = prev.some((venue) => venue.id === normalized.id);
            if (exists) {
                return prev.filter((venue) => venue.id !== normalized.id);
            }
            return dedupeFavoriteVenuePreferences([...prev, normalized]);
        });
    }, []);

    const addKeyword = useCallback((keyword: string) => {
        setSavedKeywords(prev => {
            if (!prev.includes(keyword)) {
                return [...prev, keyword];
            }
            return prev;
        });
    }, []);

    const removeKeyword = useCallback((keyword: string) => {
        setSavedKeywords(prev => prev.filter(k => k !== keyword));
    }, []);

    return {
        likedIds,
        setLikedIds,
        favoriteVenues,
        setFavoriteVenues,
        savedKeywords,
        setSavedKeywords,
        isStorageLoaded,
        theme,
        toggleTheme,
        toggleLike,
        toggleFavoriteVenue,
        addKeyword,
        removeKeyword
    };
}
