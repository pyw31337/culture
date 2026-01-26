/**
 * Hangul Choseong (Initial Consonant) Utilities
 * Allows searching '뮤지컬' with 'ㅁㅈㅋ'.
 */

const CHO_HANGUL = [
    'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
];

const HANGUL_START_CHAR = 0xAC00;
const HANGUL_END_CHAR = 0xD7A3;

/**
 * Extracts initial consonants from a Hangul string.
 * Non-Hangul characters are kept as is.
 * @param str Input string
 * @returns String with initial consonants
 */
export function getChoseong(str: string): string {
    let result = '';
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code >= HANGUL_START_CHAR && code <= HANGUL_END_CHAR) {
            const choIndex = Math.floor((code - HANGUL_START_CHAR) / 588);
            result += CHO_HANGUL[choIndex];
        } else {
            result += str.charAt(i);
        }
    }
    return result;
}

/**
 * Checks if target string matches query using Choseong logic.
 * Supports mixed input (e.g. '뮤지ㅋ' -> Matches '뮤지컬').
 * @param target Target string (e.g., "뮤지컬 시카고")
 * @param query Query string (e.g., "ㅁㅈㅋ")
 * @returns Boolean match result
 */
export function isChoseongMatch(target: string, query: string): boolean {
    if (!query) return true;

    // Normalize: Remove spaces, lowercase
    const t = target.replace(/\s/g, '').toLowerCase();
    const q = query.replace(/\s/g, '').toLowerCase();

    // 1. Exact/Substring Match
    if (t.includes(q)) return true;

    // 2. Choseong Match Logic
    // Only apply Choseong match if the query actually contains standalone Jamo (e.g. 'ㄱ', 'ㄴ')
    // If the query is fully formed Hangul syllables (e.g. '주토피아'), we essentially require a substring match (checked above).
    // This prevents "주토피아" (zootopia) matching "강아지 토피어리" (puppy topiary) solely because '지' ends with 'ㅈ' and '토' starts with 'ㅌ'.
    const hasJamo = /[ㄱ-ㅎ]/.test(q);
    if (!hasJamo) return false;

    const tCho = getChoseong(t);
    const qCho = getChoseong(q); // Convert query to choseong too (handles mixed '뮤지ㅋ' -> 'ㅁㅈㅋ')

    return tCho.includes(qCho);
}
