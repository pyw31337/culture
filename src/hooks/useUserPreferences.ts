import { useState, useEffect } from 'react';
import { safeStorage } from '@/lib/safeStorage';

export function useUserPreferences() {
    const [likedIds, setLikedIds] = useState<string[]>([]);
    const [favoriteVenues, setFavoriteVenues] = useState<string[]>([]);
    const [savedKeywords, setSavedKeywords] = useState<string[]>([]);
    const [isStorageLoaded, setIsStorageLoaded] = useState(false);
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');

    // Initial Load
    useEffect(() => {
        setSavedKeywords(safeStorage.get<string[]>('culture_keywords', []));
        setLikedIds(safeStorage.get<string[]>('culture_likes', []));
        setFavoriteVenues(safeStorage.get<string[]>('culture_favorite_venues', []));

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

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        if (newTheme === 'light') {
            document.documentElement.classList.remove('dark');
        } else {
            document.documentElement.classList.add('dark');
        }
        safeStorage.set('theme', newTheme);
    };

    const toggleLike = (id: string) => {
        setLikedIds(prev => prev.includes(id) ? prev.filter(lid => lid !== id) : [...prev, id]);
    };

    const toggleFavoriteVenue = (venueName: string) => {
        setFavoriteVenues(prev => prev.includes(venueName) ? prev.filter(v => v !== venueName) : [...prev, venueName]);
    };

    const addKeyword = (keyword: string) => {
        if (!savedKeywords.includes(keyword)) {
            setSavedKeywords(prev => [...prev, keyword]);
        }
    };

    const removeKeyword = (keyword: string) => {
        setSavedKeywords(prev => prev.filter(k => k !== keyword));
    };

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
