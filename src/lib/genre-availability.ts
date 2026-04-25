import type { Performance } from '@/types';
import { GENRES, SPORTS_GENRES, VALID_GENRE_SLUGS } from '@/lib/constants';

export type GenreCounts = Record<string, number>;

const SLUG_TO_GENRE: Record<string, string> = {
    theater: 'play',
};

export function buildGenreCounts(performances: Array<Pick<Performance, 'genre'>>): GenreCounts {
    return performances.reduce<GenreCounts>((counts, performance) => {
        const genre = performance.genre?.trim();
        if (!genre) return counts;
        counts[genre] = (counts[genre] ?? 0) + 1;
        return counts;
    }, {});
}

export function getGenreCount(counts: GenreCounts, genre: string): number {
    if (genre === 'all') {
        return Object.values(counts).reduce((sum, count) => sum + count, 0);
    }

    if (genre === 'sports') {
        return SPORTS_GENRES.reduce((sum, sportGenre) => sum + (counts[sportGenre] ?? 0), 0);
    }

    const normalizedGenre = SLUG_TO_GENRE[genre] ?? genre;
    return counts[normalizedGenre] ?? 0;
}

export function isGenreAvailable(counts: GenreCounts, genre: string): boolean {
    return getGenreCount(counts, genre) > 0;
}

export function getAvailableGenres(counts: GenreCounts) {
    return GENRES.filter((genre) => genre.id === 'all' || isGenreAvailable(counts, genre.id));
}

export function getAvailableGenreIds(counts: GenreCounts): string[] {
    return getAvailableGenres(counts).map((genre) => genre.id);
}

export function getAvailableGenreSlugs(counts: GenreCounts): string[] {
    return VALID_GENRE_SLUGS.filter((slug) => isGenreAvailable(counts, slug));
}

export function getGenreFilterFromSlug(genre: string): string | string[] {
    if (genre === 'sports') return SPORTS_GENRES;
    return SLUG_TO_GENRE[genre] ?? genre;
}
