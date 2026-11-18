export function normalizeLocationWhitespace(value?: string) {
    return value?.replace(/\s+/g, ' ').trim() || '';
}

/**
 * "제주특별자치도" -> "제주", "서울특별시" -> "서울", "경기도" -> "경기".
 * Only province/metropolitan level suffixes are stripped, so a district name such as
 * "강남구" or "제주시" keeps its own identity.
 */
const PROVINCE_SUFFIX_PATTERN = /(특별자치도|특별자치시|특별시|광역시|도)$/;
const PROVINCE_NAME_MAX_LENGTH = 6;

function provinceRoot(token: string) {
    if (!token) return '';
    const stripped = token.replace(PROVINCE_SUFFIX_PATTERN, '');
    if (!stripped || stripped === token) return '';
    return stripped.length >= 2 ? stripped.toLowerCase() : '';
}

/**
 * Drop a leading location token that only repeats the region the next token already names.
 *
 *   "서울 서울시 강남구 ..."        -> "서울시 강남구 ..."   (existing rule)
 *   "제주특별자치도 제주시 청사로 11" -> "제주시 청사로 11"      (province prefix)
 *   "부산광역시 부산진구 ..."        -> "부산진구 ..."
 *
 * This keeps "제주특별자치도 제주시 청사로 11" and "제주시 청사로 11" - the same address -
 * comparable, while a genuinely different address ("서울특별시 강남구 ...") is left intact.
 */
export function collapseDuplicateLeadingLocationToken(value?: string) {
    const cleaned = normalizeLocationWhitespace(value);
    if (!cleaned) return '';

    const parts = cleaned.split(' ').filter(Boolean);
    if (parts.length < 2) return cleaned;

    const [first, second, ...rest] = parts;
    const firstKey = first.replace(/\s+/g, '').toLowerCase();
    const secondKey = second.replace(/\s+/g, '').toLowerCase();
    if (firstKey.length < 2) return cleaned;

    const repeatsFirstToken = secondKey === firstKey || secondKey.startsWith(firstKey);
    const provinceRootOfFirst = provinceRoot(firstKey);
    const repeatsProvince =
        provinceRootOfFirst.length >= 2 &&
        provinceRootOfFirst.length <= PROVINCE_NAME_MAX_LENGTH &&
        secondKey.startsWith(provinceRootOfFirst);

    return repeatsFirstToken || repeatsProvince ? [second, ...rest].join(' ') : cleaned;
}
