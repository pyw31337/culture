export function compactVenueText(value?: string) {
    return value?.replace(/\s+/g, ' ').trim() || '';
}

export function normalizeVenueNameForComparison(value?: string) {
    return compactVenueText(value)
        .replace(/\[[^\]]+\]/g, '')
        .replace(/\([^)]*\)/g, ' ')
        .replace(/구\.?\s*/g, ' ')
        .replace(/[·ㆍ,./\\\-_:|"'“”‘’\s]/g, '')
        .toLowerCase();
}

function charSetSimilarity(left: string, right: string) {
    const leftChars = new Set(Array.from(left));
    const rightChars = new Set(Array.from(right));
    if (leftChars.size === 0 || rightChars.size === 0) return 0;

    const intersection = Array.from(leftChars).filter((char) => rightChars.has(char)).length;
    const union = new Set([...leftChars, ...rightChars]).size;
    return union > 0 ? intersection / union : 0;
}

function lengthRatio(left: string, right: string) {
    if (!left || !right) return 0;
    return Math.min(left.length, right.length) / Math.max(left.length, right.length);
}

export function venueNameSimilarity(left?: string, right?: string) {
    const normalizedLeft = normalizeVenueNameForComparison(left);
    const normalizedRight = normalizeVenueNameForComparison(right);
    if (!normalizedLeft || !normalizedRight) return 0;
    if (normalizedLeft === normalizedRight) return 1;

    if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) {
        return Math.max(0.45, lengthRatio(normalizedLeft, normalizedRight));
    }

    return charSetSimilarity(normalizedLeft, normalizedRight);
}

export function isCompatibleVenueDisplayName(venueKeyOrName?: string, displayName?: string) {
    const venueKey = compactVenueText(venueKeyOrName);
    const name = compactVenueText(displayName);
    if (!name) return false;
    if (!venueKey || venueKey === name) return true;

    const normalizedName = normalizeVenueNameForComparison(name);
    if (normalizedName.length <= 1) return false;

    const genericWrongNames = new Set([
        '상가',
        '정극장',
        '공간아울',
        '댕로홀',
        '소마미술관',
        '관악구청',
        '서울숲',
        '통인화랑',
        'A동상가'.toLowerCase(),
    ].map(normalizeVenueNameForComparison));

    if (genericWrongNames.has(normalizedName)) return false;

    return venueNameSimilarity(venueKey, name) >= 0.34;
}
