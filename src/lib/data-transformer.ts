/**
 * CultureFlow Master Data Transformer
 * The single source of truth for normalizing disparate data sources.
 */

import { Performance, Genre } from '@/types';
import { FUTURES_TEAM_LOGOS } from '@/lib/constants';
import { getOptimizedUrl, cleanTitle, formatUnifiedDate } from '@/lib/utils';

// Genre-specific fallback images
const GENRE_FALLBACKS: Record<string, string> = {
    soccer: '/images/fallbacks/soccer.jpg',
    baseball: '/images/fallbacks/baseball.jpg',
    basketball: '/images/fallbacks/basketball.jpg',
    volleyball: '/images/fallbacks/volleyball.jpg',
    handball: '/images/fallbacks/handball.jpg',
    museum: '/images/fallbacks/museum.jpg',
    exhibition: '/images/fallbacks/exhibition.jpg',
    classic_tradition: '/images/fallbacks/classic.jpg',
    activity: '/images/fallbacks/activity.jpg',
    movie: '/images/kbo-thumbnail.png',
    default: '/images/placeholder.png'
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
 * Normalizes any raw performance object into a strict Performance interface.
 */
export function transformPerformance(raw: RawPerformance, source?: string): Performance {
    // 1. Source-specific field normalization
    let title = raw.title || '';
    let venue = raw.venue || raw.place || '';
    let image = raw.image || raw.poster || raw.posterUrl || '';
    let price = raw.price || raw.cost || '';
    let date = raw.date || '';
    let region = raw.region || '';
    let genre = (raw.genre as Genre) || 'activity';

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

    // 5. Sports Logos
    let homeLogo = raw.homeTeamLogo;
    let awayLogo = raw.awayTeamLogo;
    if (['baseball', 'basketball', 'volleyball', 'soccer', 'handball'].includes(genre)) {
        if (raw.homeTeam && FUTURES_TEAM_LOGOS[raw.homeTeam]) {
            homeLogo = FUTURES_TEAM_LOGOS[raw.homeTeam];
        }
        if (raw.awayTeam && FUTURES_TEAM_LOGOS[raw.awayTeam]) {
            awayLogo = FUTURES_TEAM_LOGOS[raw.awayTeam];
        }
    }

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
