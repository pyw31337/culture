import type { Performance } from '@/types';
import { GENRES } from './constants';

export type KeywordMatchedPerformance = Performance & {
    matchedKeyword?: string;
};

const normalizeKeyword = (value: string) => value.replace(/^#/, '').trim();

const normalizeText = (value: string) => {
    return value.replace(/\s+/g, '').toLowerCase().normalize('NFC');
};

const castToSearchableText = (cast: Performance['cast']) => {
    if (!Array.isArray(cast)) return '';

    return cast
        .map((member) => {
            if (typeof member === 'string') return member;
            return member?.name || '';
        })
        .join(' ');
};

const buildSearchFields = (performance: Performance) => {
    const genreLabel = GENRES.find((genre) => genre.id === performance.genre)?.label || '';

    return [
        performance.title,
        performance.venue,
        performance.genre,
        genreLabel,
        performance.region,
        performance.district,
        performance.address,
        performance.originalTitle,
        castToSearchableText(performance.cast),
    ]
        .filter((value): value is string => Boolean(value && value.trim()))
        .map(normalizeText);
};

export function findMatchedKeyword(performance: Performance, keywords: string[]): string | null {
    const searchableFields = buildSearchFields(performance);

    for (const keyword of keywords) {
        const cleanedKeyword = normalizeKeyword(keyword);
        if (!cleanedKeyword) continue;

        const normalizedKeyword = normalizeText(cleanedKeyword);
        if (!normalizedKeyword) continue;

        const isMatch = searchableFields.some((field) => field.includes(normalizedKeyword));
        if (isMatch) return cleanedKeyword;
    }

    return null;
}

export function getKeywordMatchedItems(
    performances: Performance[],
    keywords: string[],
    limit: number = 15
): KeywordMatchedPerformance[] {
    if (!keywords.length || !performances.length) return [];

    const matchedItems: KeywordMatchedPerformance[] = [];

    for (const performance of performances) {
        const matchedKeyword = findMatchedKeyword(performance, keywords);

        if (matchedKeyword) {
            matchedItems.push({ ...performance, matchedKeyword });
        }

        if (matchedItems.length >= limit) {
            break;
        }
    }

    return matchedItems;
}
