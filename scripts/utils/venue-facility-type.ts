/**
 * Derives a short facility type from a Kakao/Naver place `category_name`
 * (e.g. "문화,예술 > 종교 > 불교 > 절,사찰", "종교>천주교", "문화,예술 > 영화,영상 > 영화관").
 * Classification is category-based (k-skill religious-facility-search) instead of
 * guessing from venue names. Returns undefined when the category is not specific.
 */
const RELIGION_LABELS: Array<[RegExp, string]> = [
    [/원불교/, '종교시설(원불교)'],
    [/천주교|성당/, '종교시설(천주교)'],
    [/불교|사찰|절/, '종교시설(불교)'],
    [/기독교|교회|개신교/, '종교시설(기독교)'],
    [/성공회/, '종교시설(성공회)'],
];

const FACILITY_LABELS: Array<[RegExp, string]> = [
    [/영화관/, '영화관'],
    [/공연장|연극극장|공연,연극/, '공연장'],
    [/미술관/, '미술관'],
    [/박물관/, '박물관'],
    [/과학관/, '과학관'],
    [/갤러리|화랑/, '갤러리'],
    [/전시관|전시장|컨벤션/, '전시장'],
    [/도서관/, '도서관'],
    [/문화,예술회관|문화예술회관/, '문화예술회관'],
    [/문화원/, '문화원'],
    [/문화센터/, '문화센터'],
    [/복합문화공간/, '복합문화공간'],
    [/야구장|축구장|경기장|체육관|스타디움/, '체육시설'],
    [/테마파크|놀이공원/, '테마파크'],
    [/문화,유적|문화유적|세계문화유산|고궁|궁궐/, '문화유산'],
];

export function deriveVenueFacilityType(categoryName?: string | null): string | undefined {
    const category = String(categoryName || '').replace(/\s+/g, ' ').trim();
    if (!category) return undefined;
    const segments = category.split(/\s*>\s*/);
    if (segments.includes('종교') || segments[0] === '종교' || /종교유적지/.test(category)) {
        if (/종교유적지/.test(category)) return '종교유적지';
        const tail = segments.slice(segments.indexOf('종교') + 1).join(' ');
        const matched = RELIGION_LABELS.find(([pattern]) => pattern.test(tail));
        return matched ? matched[1] : '종교시설';
    }
    const matched = FACILITY_LABELS.find(([pattern]) => pattern.test(category));
    return matched ? matched[1] : undefined;
}

export function isReligiousFacilityType(facilityType?: string | null): boolean {
    return /^종교/.test(String(facilityType || ''));
}
