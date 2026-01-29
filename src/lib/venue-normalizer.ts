
import fs from 'fs';
import path from 'path';

// Load dictionary
const DICT_PATH = path.resolve(process.cwd(), 'src/data/venue-dictionary.json');
let dictionary: Record<string, any> = {};

try {
    if (fs.existsSync(DICT_PATH)) {
        const content = fs.readFileSync(DICT_PATH, 'utf-8');
        dictionary = JSON.parse(content);
    }
} catch (e) {
    console.error('Failed to load venue dictionary:', e);
}

// Regex Rules
const SUFFIXES = [
    '대공연장', '대극장', '소공연장', '콘서트홀', '대강당', '소강당',
    '전시실', '전시관', '체육관', '운동장', '아트센터', '문화회관',
    '예술회관', '구민회관', '시민회관', '안내데스크 앞', '로비',
    '2층', '3층', '4층', '5층', 'B1', '지하'
];
const SUFFIX_REGEX = new RegExp(`\\s*(${SUFFIXES.join('|')})$`, 'g');
const CORP_PREFIX_REGEX = /^\s*[\(（](주|사|재)[\)）]\s*/;
const REGION_PREFIX_REGEX = /^(경기|서울|충남|충북|경남|경북|전남|전북|제주|강원|인천|대구|대전|광주|부산|울산|세종)\s+(.+?)\s+/;

export class VenueNormalizer {

    static normalize(dirtyName: string, potentialAddress?: string) {
        // 1. Check Dictionary
        if (dictionary[dirtyName]) {
            return {
                ...dictionary[dirtyName],
                source: 'dictionary'
            };
        }

        // 2. Apply Rules
        let refined = dirtyName;

        // Remove Corporate Prefix: (주)에버랜드 -> 에버랜드
        refined = refined.replace(CORP_PREFIX_REGEX, '');

        // Remove Address Prefix: "경기 가평군 ..." -> "..."
        // Strategy: If name starts with a region, tries to strip it.
        // Be careful: "서울랜드" captures "서울". We need to ensure it looks like an address structure (Region + City/Gu).
        // The regex `REGION_PREFIX_REGEX` checks for "Region + Space + Something + Space".
        const addressMatch = refined.match(REGION_PREFIX_REGEX);
        if (addressMatch) {
            // Check if the remaining part is substantial
            // Example: "경기 가평군 청평면 경춘로 157" -> "157"? No.
            // The CSV analysis showed removing the *entire* address string if it's purely an address.
            // But usually there is a venue name *after* or *mixed*?
            // Actually the rule was: If original matches address pattern and Key is completely different or substring.

            // Heuristic: If we have a potentialAddress that matches, verified.
            // Or strip standard administrative prefixes.
            // Let's rely on stripping strictly recognizable address parts.
            // Simpler rule: If refined matches the 'address' field provided, it's just an address.
            // If potentialAddress is provided, compare?
        }

        // Better Rule: "Remove Address-like prefix"
        // e.g. "강원 영월군 주천면 송학주천로 1467-9 영월 젊은달와이파크" -> "영월 젊은달와이파크"
        // Regex: Start with Region, followed by non-space, space, non-space...
        // Let's look for a split point?
        // Often format is "Address Name".
        // Or just Name?

        // Remove Address Prefix: "경기 가평군 ... 123" -> ""
        // Pattern: Region + (Any chars) + Number + (Optional hyphen+Number) + Space
        const addressPrefixMatch = refined.match(/^(경기|서울|충남|충북|경남|경북|전남|전북|제주|강원|인천|대구|대전|광주|부산|울산|세종)\s+(.+?)\d+(?:-\d+)?\s+/);
        if (addressPrefixMatch) {
            // If the remaining string is not empty, use it.
            const stripped = refined.replace(addressPrefixMatch[0], '').trim();
            if (stripped.length > 0) {
                refined = stripped;
            }
        }

        // Applying rule: Strip Suffixes
        refined = refined.replace(SUFFIX_REGEX, '').trim();

        return {
            name: dirtyName,
            refined_name: refined,
            address: potentialAddress || '',
            district: '', // Needs logic
            mapped_region_id: '', // Needs logic
            lat: null,
            lng: null,
            source: 'rule'
        };
    }

    static getDictionary() {
        return dictionary;
    }
}
