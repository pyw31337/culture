function normalizeSearchText(value: unknown) {
    return String(value || '').toLowerCase().normalize('NFC');
}

/**
 * Hangul-aware includes.
 * - Latin queries: whitespace-insensitive substring match.
 * - Hangul queries: require a token boundary before the match so mid-word
 *   hits like "업싸이클" for "싸이" are rejected, while spaced/punctuated
 *   titles like "가족뮤지컬 콧구멍을 후비면" still match "콧구멍".
 *
 * IMPORTANT: do not strip whitespace/punctuation before the Hangul boundary
 * check — those characters are the boundaries users type between tokens.
 */
export function includesSearchTerm(value: unknown, query: unknown) {
    const rawHaystack = normalizeSearchText(value);
    const rawNeedle = normalizeSearchText(query);
    const needle = rawNeedle.replace(/\s+/g, '');
    if (!needle) return false;

    if (!/[가-힣]/.test(needle)) {
        return rawHaystack.replace(/\s+/g, '').includes(needle);
    }

    // Collapse separators to a single boundary marker so preceding-char checks
    // still see a non-Hangul boundary between genre prefixes and titles.
    const haystack = rawHaystack.replace(/[^a-z0-9가-힣]+/gi, '\0');

    let matchIndex = haystack.indexOf(needle);
    while (matchIndex >= 0) {
        const precedingCharacter = matchIndex > 0 ? haystack[matchIndex - 1] : '';
        if (!precedingCharacter || precedingCharacter === '\0' || !/[가-힣]/.test(precedingCharacter)) {
            return true;
        }
        matchIndex = haystack.indexOf(needle, matchIndex + 1);
    }

    return false;
}
