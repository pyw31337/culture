/**
 * CultureFlow Master Data Transformer
 * The single source of truth for normalizing disparate data sources.
 */

import { Performance, Genre } from '@/types';
import { FUTURES_TEAM_LOGOS } from '@/lib/constants';
import { getOptimizedUrl, cleanTitle, formatUnifiedDate } from '@/lib/utils';

// Genre-specific fallback images
const _BP = process.env.NEXT_PUBLIC_BASE_PATH || '';
const GENRE_FALLBACKS: Record<string, string> = {
    soccer: `${_BP}/images/soccer_poster.png`,
    baseball: `${_BP}/images/fallbacks/baseball.jpg`,
    basketball: `${_BP}/images/fallbacks/basketball.jpg`,
    volleyball: `${_BP}/images/fallbacks/volleyball.jpg`,
    handball: `${_BP}/images/fallbacks/handball.jpg`,
    museum: `${_BP}/images/fallbacks/museum.jpg`,
    exhibition: `${_BP}/images/fallbacks/exhibition.jpg`,
    classic_tradition: `${_BP}/images/fallbacks/classic.jpg`,
    activity: `${_BP}/images/fallbacks/activity.jpg`,
    movie: `${_BP}/images/kbo-thumbnail.png`,
    default: `${_BP}/images/placeholder.png`
};

const OFFICIAL_SPORTS_VENUES: Record<string, string | Record<string, string>> = {
    // Baseball (KBO)
    '잠실': '잠실종합운동장잠실야구장',
    '마산': '마산야구장',
    '마산야구장': '마산야구장',
    '문학': '인천SSG 랜더스필드',
    'SSG랜더스필드': '인천SSG 랜더스필드',
    '수원': {
        'baseball': '수원KT위즈파크',
        'volleyball': '수원실내체육관'
    },
    '고척': '고척스카이돔',
    '고척돔': '고척스카이돔',
    '광주': '광주기아챔피언스필드',
    '기아챔피언스필드': '광주기아챔피언스필드',
    '대구': '대구삼성라이온즈파크',
    '라이온즈파크': '대구삼성라이온즈파크',
    '대전': '한화생명이글스파크',
    '이글스파크': '한화생명이글스파크',
    '사직': '부산사직종합운동장사직야구장',
    '창원': '창원NC파크',
    'NC파크': '창원NC파크',
    '포항': '포항야구장',
    '울산': '울산문수야구장',
    '청주': '청주야구장',
    '이천': {
        'LG': '이천LG챔피언스파크',
        '두산': '이천(두산)',
        'default': '이천LG챔피언스파크'
    },
    '이천LG챔피언스파크': '이천LG챔피언스파크',
    '이천베어스파크': '이천(두산)',
    '상동': '상동야구장',
    '함평': '함평기아챌린저스필드',
    '경산': '삼성라이온즈볼파크',
    '강화': 'SSG퓨처스필드',
    '서산': '한화이글스서산구장',

    // Volleyball (KOVO)
    '장충': '장충체육관',
    '천안': '천안유관순체육관',
    '안산': '안산상록수체육관',
    '인천': {
        'volleyball': '인천계양체육관',
        'baseball': '인천SSG 랜더스필드',
        'soccer': '인천축구전용경기장'
    },
    '의정부': '의정부실내체육관',
    '구미': '구미박정희체육관',
    '김천': '김천실내체육관',

    // Basketball (KBL)
    '잠실학생': '잠실학생체육관',
    '잠실실내': '잠실실내체육관',
    '원주': '원주종합체육관',
    '안양': '안양실내체육관',
    '전주': '전주실내체육관',
    '군산': '군산월명체육관',
    '창원체육관': '창원체육관',

    // Soccer (K-League)
    '빅버드': '수원월드컵경기장',
    '스틸야드': '포항스틸야드',
    '퍼플아레나': '대전월드컵경기장'
};

const REGION_MAP: Record<string, string> = {
    '서울': 'seoul', '경기': 'gyeonggi', '인천': 'incheon',
    '부산': 'busan', '대구': 'daegu', '광주': 'gwangju',
    '대전': 'daejeon', '울산': 'ulsan', '세종': 'sejong',
    '강원': 'gangwon', '충북': 'chungbuk', '충남': 'chungnam',
    '전북': 'jeonbuk', '전남': 'jeonnam', '경북': 'gyeongbuk',
    '경남': 'gyeongnam', '제주': 'jeju'
};

export interface RawPerformance {
    id: string | number;
    title?: string;
    image?: string;
    poster?: string;
    posterUrl?: string;
    date?: string;
    time?: string;
    venue?: string;
    place?: string;
    region?: string;
    district?: string;
    genre?: string;
    homeTeam?: string;
    awayTeam?: string;
    homeTeamLogo?: string;
    awayTeamLogo?: string;
    price?: string;
    cost?: string;
    codename?: string;
    [key: string]: any;
}

/**
 * Normalizes sports venue names to official long-form names.
 */
function normalizeVenueName(rawVenue: string, homeTeam?: string, genre?: string): string {
    if (!rawVenue) return '';

    // 1. Initial cleanup (corrupted map UI strings from some scrapers)
    let name = rawVenue.split('←Move left')[0] // Catch mocha/umclass garbage
        .split('Map data ©')[0]
        .split('Keyboard shortcuts')[0]
        .trim();

    // 2. Remove common informal suffixes and parentheses
    name = name.replace(/ (구장|경기장|체육관)$/, '');
    name = name.replace(/\(두산\)|\(LG\)/g, '').trim();

    // 3. Exact matching in official map
    const entry = OFFICIAL_SPORTS_VENUES[name] ||
        OFFICIAL_SPORTS_VENUES[name.replace(/야구장$/, '')] ||
        OFFICIAL_SPORTS_VENUES[name.replace(/잠실야구장$/, '잠실')];

    if (!entry) return name; // Return cleaned name at least

    if (typeof entry === 'string') return entry;

    // Team-aware mapping (e.g., Icheon)
    if (homeTeam) {
        const teamMatch = Object.keys(entry).find(key => homeTeam.toLowerCase().includes(key.toLowerCase()));
        if (teamMatch) return entry[teamMatch];
    }

    // Genre-aware mapping (e.g., Incheon)
    if (genre && entry[genre]) {
        return entry[genre];
    }

    return entry.default || (typeof entry === 'object' ? Object.values(entry)[0] : name);
}

/**
 * Normalizes any raw performance object into a strict Performance interface.
 */
export function transformPerformance(raw: RawPerformance, source?: string): Performance {
    // 1. Source-specific field normalization
    let title = raw.title || '';
    let rawVenue = raw.venue || raw.place || '';
    let image = raw.image || raw.poster || raw.posterUrl || '';
    let price = raw.price || raw.cost || '';
    let date = raw.date || '';
    let region = raw.region || '';
    let genre = (raw.genre as Genre) || 'activity';
    let venue = normalizeVenueName(rawVenue, raw.homeTeam, genre);
    if (!venue) venue = rawVenue;

    // Specific Source Overrides
    if (source === 'seoul') {
        venue = raw.place || '';
        image = raw.poster || '';
        price = raw.cost || '';
        date = raw.time ? `${raw.date} (${raw.time})` : (raw.date || '');
    }

    // 2. Genre Refinement Logic
    if (source === 'seoul') {
        genre = inferSeoulGenre(title, venue, raw.codename || '') as Genre;
    }

    // Genre Consolidation & Quality Override (Master Policy)
    if (genre === 'classic' || genre === 'korean_music') {
        genre = 'classic_tradition';
    } else if (genre === 'theater') {
        genre = 'play';
    } else if (genre === 'kids' || genre === 'festival' || genre === 'leisure' || genre === 'activity') {
        const t = (title + ' ' + venue).toLowerCase();
        if (t.includes('뮤지컬') || t.includes('티니핑') || t.includes('핑크퐁') || t.includes('오페라') || t.includes('싱어롱')) {
            genre = 'musical';
        } else if (t.includes('연극') || t.includes('아동극') || t.includes('인형극')) {
            genre = 'play';
        } else if (t.includes('클래식') || t.includes('음악회') || t.includes('발레') || t.includes('오케스트라')) {
            genre = 'classic_tradition';
        } else if (t.includes('도슨트') || t.includes('박물관') || t.includes('역사') || t.includes('서대문형무소') || t.includes('경복궁') || t.includes('미술관') || t.includes('기념관') || t.includes('에듀') || t.includes('투어')) {
            genre = 'museum';
        } else {
            genre = 'activity';
        }
    }


    // 3. Region Mapping
    const mappedRegion = REGION_MAP[region] || (region ? 'etc' : 'unknown');

    // 4. Fallback Handling
    if (!image || image === '정보 없음') {
        image = GENRE_FALLBACKS[genre] || GENRE_FALLBACKS.default;
    }

    // 5. Sports Logos — RESPECT data-supplied logos; only fallback to FUTURES_TEAM_LOGOS
    let homeLogo = raw.homeTeamLogo;
    let awayLogo = raw.awayTeamLogo;
    if (['baseball', 'basketball', 'volleyball', 'soccer', 'handball'].includes(genre)) {
        const normalizeTeam = (name: string | undefined): string => (name || '').replace(/\(홈\)|\(원정\)|\(상무\)/g, '').trim();
        const hTeam = normalizeTeam(raw.homeTeam);
        const aTeam = normalizeTeam(raw.awayTeam);

        // Only override logos when data doesn't provide them
        if (!homeLogo && hTeam && FUTURES_TEAM_LOGOS[hTeam]) {
            homeLogo = FUTURES_TEAM_LOGOS[hTeam];
        }
        if (!awayLogo && aTeam && FUTURES_TEAM_LOGOS[aTeam]) {
            awayLogo = FUTURES_TEAM_LOGOS[aTeam];
        }
    }

    // 6. Add BASE_PATH prefix to local image/logo paths missing it
    const addBP = (p: string | undefined): string | undefined => {
        if (!p) return p;
        // Skip external URLs, already-prefixed paths, or data URIs
        if (p.startsWith('http') || p.startsWith('data:') || p.startsWith(_BP + '/')) return p;
        // Local paths starting with /
        if (p.startsWith('/')) return `${_BP}${p}`;
        return p;
    };
    image = addBP(image) || image;
    homeLogo = addBP(homeLogo);
    awayLogo = addBP(awayLogo);

    return {
        ...raw,
        id: String(raw.id),
        title: cleanTitle(title),
        image: image,
        venue: venue.trim(),
        date: formatUnifiedDate(date),
        region: mappedRegion,
        genre,
        homeTeamLogo: homeLogo,
        awayTeamLogo: awayLogo
    } as Performance;
}

function inferSeoulGenre(title: string, venue: string, codename: string): string {
    const text = (title + ' ' + venue + ' ' + codename).toLowerCase();
    if (text.includes('콘서트') || text.includes('음악회') || text.includes('연주회') || text.includes('교향악단') || text.includes('리사이틀') || text.includes('앙상블') || text.includes('오케스트라') || text.includes('독창회') || text.includes('독주회') || text.includes('클래식') || text.includes('내한')) return 'classic_tradition';
    if (text.includes('전시') || text.includes('특별전') || text.includes('초대전') || text.includes('갤러리') || text.includes('미술관') || text.includes('박물관') || text.includes('비엔날레') || text.includes('도슨트') || text.includes('개인전') || text.includes('기획전') || text.includes('과학관') || text.includes('기념관') || text.includes('조각전') || text.includes('책보고')) return 'exhibition';
    if (text.includes('국악') || text.includes('판소리') || text.includes('마당놀이') || text.includes('전통') || text.includes('무형문화재') || text.includes('풍물') || text.includes('굿')) return 'classic_tradition';
    if (text.includes('강좌') || text.includes('교육') || text.includes('체험') || text.includes('아카데미') || text.includes('워크숍') || text.includes('교실') || text.includes('특강') || text.includes('도서관') || text.includes('캠프')) return 'activity';
    if (text.includes('축제') || text.includes('페스티벌') || text.includes('행사') || text.includes('스케이트장') || text.includes('눈썰매장')) return 'activity';
    if (text.includes('뮤지컬')) return 'musical';
    if (text.includes('연극')) return 'play';
    if (text.includes('무용') || text.includes('발레')) return 'classic_tradition';
    return 'activity';
}
