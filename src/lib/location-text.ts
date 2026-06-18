export function normalizeLocationWhitespace(value?: string) {
    return value?.replace(/\s+/g, ' ').trim() || '';
}

export function collapseDuplicateLeadingLocationToken(value?: string) {
    const cleaned = normalizeLocationWhitespace(value);
    if (!cleaned) return '';

    const parts = cleaned.split(' ').filter(Boolean);
    if (parts.length < 2) return cleaned;

    const [first, second, ...rest] = parts;
    const firstKey = first.replace(/\s+/g, '').toLowerCase();
    const secondKey = second.replace(/\s+/g, '').toLowerCase();
    const shouldDropFirst =
        firstKey.length >= 2 &&
        (
            secondKey === firstKey ||
            secondKey.startsWith(firstKey)
        );

    return shouldDropFirst ? [second, ...rest].join(' ') : cleaned;
}
