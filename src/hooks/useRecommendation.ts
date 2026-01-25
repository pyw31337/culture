import { useMemo } from 'react';
import { Performance } from '@/types';
import { useUserActivity } from './useUserActivity';

interface UseRecommendationProps {
    allPerformances: Performance[];
    likedIds: string[];
    recentSearches: string[];
}

export function useRecommendation({ allPerformances, likedIds, recentSearches }: UseRecommendationProps) {
    const { activity } = useUserActivity();

    const recommendedItems = useMemo(() => {
        // Cold start check: If no activity, return empty (UI can fallback to "Popular" or "New")
        const hasActivity =
            Object.keys(activity.viewedGenres).length > 0 ||
            likedIds.length > 0 ||
            recentSearches.length > 0;

        if (!hasActivity) return [];

        // Helper: Normalize string for comparison
        const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '');

        // 1. Calculate Genre Weights
        const genreWeights: Record<string, number> = { ...activity.viewedGenres };

        // Boost genres from liked items
        likedIds.forEach(id => {
            const item = allPerformances.find(p => p.id === id);
            if (item) {
                genreWeights[item.genre] = (genreWeights[item.genre] || 0) + 5; // Heavy boost for liked genres
            }
        });

        // 2. Score Items
        const scoredItems = allPerformances.map(item => {
            // Exclude already liked items from recommendation (Optional, but usually better for discovery)
            // if (likedIds.includes(item.id)) return { item, score: -1 };

            let score = 0;

            // Factor A: Genre Affinity (Max ~20-30 pts)
            const genreCount = genreWeights[item.genre] || 0;
            score += Math.min(genreCount, 10) * 2;

            // Factor B: Keyword Match (Recent Searches) (Max ~15 pts)
            // Check title, cast, venue against recent searches
            const itemText = normalize(`${item.title} ${item.venue} ${Array.isArray(item.cast) ? item.cast.join(' ') : item.cast || ''}`);
            recentSearches.slice(0, 5).forEach(keyword => {
                if (itemText.includes(normalize(keyword))) {
                    score += 5; // 5 pts per keyword match
                }
            });

            // Factor C: Cast/Venue Similarity to Liked Items
            // (Simplified: Boost if venue matches a liked item's venue)
            // This is computationally expensive, doing simplified version
            // ...

            // Factor D: Date Freshness (Decay older items slightly)
            // ...

            // Factor E: Random Noise (Discovery)
            score += Math.random() * 2;

            return { item, score };
        });

        // 3. Filter & Sort
        return scoredItems
            .filter(x => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(x => x.item)
            .slice(0, 20); // Top 20

    }, [allPerformances, activity, likedIds, recentSearches]);

    return {
        recommendedItems,
        // Expose activity for debugging if needed
        activity
    };
}
