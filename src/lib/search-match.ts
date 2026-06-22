function normalizeSearchText(value: unknown) {
    return String(value || '').replace(/\s+/g, '').toLowerCase().normalize('NFC');
}

export function includesSearchTerm(value: unknown, query: unknown) {
    const haystack = normalizeSearchText(value);
    const needle = normalizeSearchText(query);
    if (!needle) return false;

    if (!/[가-힣]/.test(needle)) {
        return haystack.includes(needle);
    }

    let matchIndex = haystack.indexOf(needle);
    while (matchIndex >= 0) {
        const precedingCharacter = matchIndex > 0 ? haystack[matchIndex - 1] : '';
        if (!/[가-힣]/.test(precedingCharacter)) return true;
        matchIndex = haystack.indexOf(needle, matchIndex + 1);
    }

    return false;
}
