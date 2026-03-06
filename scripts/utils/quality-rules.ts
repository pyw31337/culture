
import path from 'path';

export const QUALITY_THRESHOLDS = {
    MIN_POSTER_SIZE: 5120, // 5KB (Some KOBIS images are naturally small)
    VENUE_DENSITY_THRESHOLD: 10,
    STALE_DATA_DAYS: 30
};

export const POISON_PATTERNS = {
    TITLE_D_DAY: / D-\d+$/,
    GENRE_COUNTRY: /(드라마|액션|스릴러|로맨스|판타지|SF|코미디|애니메이션|범죄|모험|미스터리|가족|공포|다큐멘터리|전쟁|역사|음악|서부|느와르|멜로|애정)(한국|대한민국|미국|일본|중국|영국|프랑스|독일|캐나다|스페인|이탈리아|홍콩|대만|태국)/,
    PLACEHOLDER_DIR: /감독_미상|정보_없음|미정/,
    NON_VENUE: /관람가|등급|관람불가|미정|모두투어|온라인투어|노랑풍선|하나투어|인터파크/
};

export const REGION_MAPPING: Record<string, string[]> = {
    'seoul': ['서울'],
    'gyeonggi': ['경기'],
    'incheon': ['인천'],
    'gangwon': ['강원'],
    'chungbuk': ['충북', '충청북도'],
    'chungnam': ['충남', '충청남도'],
    'daejeon': ['대전'],
    'sejong': ['세종'],
    'jeonbuk': ['전북', '전라북도'],
    'jeonnam': ['전남', '전라남도'],
    'gwangju': ['광주'],
    'gyeongbuk': ['경북', '경상북도'],
    'gyeongnam': ['경남', '경상남도'],
    'daegu': ['대구'],
    'ulsan': ['울산'],
    'busan': ['부산'],
    'jeju': ['제주']
};

export function isPosterBroken(fileSize: number): boolean {
    return fileSize < QUALITY_THRESHOLDS.MIN_POSTER_SIZE;
}

export function cleanTitle(title: string): string {
    return title.replace(POISON_PATTERNS.TITLE_D_DAY, '').trim();
}

export function cleanGenre(genre: string): string {
    const match = genre.match(POISON_PATTERNS.GENRE_COUNTRY);
    if (match) return match[1]; // Return only the genre part
    return genre;
}

export function isVenueSuspicious(count: number, venueName: string): boolean {
    if (POISON_PATTERNS.NON_VENUE.test(venueName)) return false;
    const FAMOUS_VENUES = ['예술의전당', '세종문화회관', '국립극장', 'LG아트센터', '롯데콘서트홀', '코엑스', '킨텍스', '예술의 전당'];
    if (FAMOUS_VENUES.some(v => venueName.includes(v))) return false;
    return count > QUALITY_THRESHOLDS.VENUE_DENSITY_THRESHOLD;
}

export function isRegionMismatch(region: string, address: string, title: string = ''): boolean {
    if (!region || region === '전국' || region === 'overseas' || region === 'all' || !address || address === '정보 없음') return false;

    // Check if title mentions a different region than the assigned region (likely wrong scrape)
    const allRegions = Object.entries(REGION_MAPPING);
    for (const [key, keywords] of allRegions) {
        if (key !== region && keywords.some(k => title.includes(k))) {
            return true; // Title clearly says another region
        }
    }

    const keywords = REGION_MAPPING[region];
    if (!keywords) return false;
    return !keywords.some(k => address.includes(k));
}
