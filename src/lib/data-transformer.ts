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
        'volleyball': '수원실내체육관',
        'soccer': '수원월드컵경기장'
    },
    '고척': '고척스카이돔',
    '고척돔': '고척스카이돔',
    '광주': {
        'baseball': '광주기아챔피언스필드',
        'soccer': '광주월드컵경기장',
        'volleyball': '광주페퍼스타디움'
    },
    '기아챔피언스필드': '광주기아챔피언스필드',
    '대구': {
        'baseball': '대구삼성라이온즈파크',
        'basketball': '대구체육관',
        'soccer': '대구iM뱅크PARK'
    },
    '라이온즈파크': '대구삼성라이온즈파크',
    '대전': {
        'baseball': '한화생명이글스파크',
        'soccer': '대전월드컵경기장',
        'volleyball': '대전충무체육관'
    },
    '이글스파크': '한화생명이글스파크',
    '사직': {
        'baseball': '부산사직종합운동장사직야구장',
        'basketball': '부산사직실내체육관'
    },
    '창원': {
        'baseball': '창원NC파크',
        'soccer': '창원 축구센터'
    },
    'NC파크': '창원NC파크',
    '포항': {
        'baseball': '포항야구장',
        'soccer': '포항 스틸야드'
    },
    '울산': {
        'baseball': '울산문수야구장',
        'soccer': '울산 문수 축구경기장',
        'basketball': '울산동천체육관'
    },
    '청주': {
        'baseball': '청주야구장',
        'handball': '청주 SK호크스아레나'
    },
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
    '서울장충체육관': '장충체육관',
    '천안': '천안유관순체육관',
    '안산': {
        'volleyball': '안산상록수체육관',
        'soccer': '안산 와~스타디움'
    },
    '인천': {
        'volleyball': '인천계양체육관',
        'v-womens': '인천삼산월드체육관',
        'baseball': '인천SSG 랜더스필드',
        'soccer': '인천축구전용경기장'
    },
    '의정부': '의정부실내체육관',
    '구미': '구미박정희체육관',
    '김천': {
        'volleyball': '김천실내체육관',
        'soccer': '김천 종합 운동장'
    },
    '의정부실내체육관': '의정부실내체육관',
    '화성': {
        'volleyball': '화성종합실내체육관',
        'soccer': '화성종합경기타운'
    },

    // Basketball (KBL)
    '잠실학생': '잠실학생체육관',
    '잠실실내': '잠실실내체육관',
    '잠실실내체육관': '잠실실내체육관',
    '원주': '원주DB프로미아레나',
    '원주DB프로미아레나': '원주DB프로미아레나',
    '안양': '안양 정관장 아레나',
    '안양실내체육관': '안양 정관장 아레나',
    '정관장아레나': '안양 정관장 아레나',
    '전주': '전주실내체육관',
    '군산': '군산월명체육관',
    '창원체육관': '창원체육관',
    '고양': '고양소노아레나',
    '고양소노아레나': '고양소노아레나',
    '수원KT': '수원 KT 소닉붐 아레나',
    '소닉붐아레나': '수원 KT 소닉붐 아레나',
    '울산동천': '울산동천체육관',
    '울산동천체육관': '울산동천체육관',
    '경희대 선승관': '경희대 선승관',

    // Soccer (K-League)
    '서울월드컵경기장': '서울 월드컵 경기장',
    '수원월드컵경기장': '수원 월드컵 경기장',
    '전주월드컵경기장': '전주 월드컵 경기장',
    '광주월드컵경기장': '광주 월드컵 경기장',
    '대전월드컵경기장': '대전 월드컵 경기장',
    '제주월드컵경기장': '제주 월드컵 경기장',
    '빅버드': '수원 월드컵 경기장',
    '스틸야드': '포항 스틸야드',
    '포항스틸야드': '포항 스틸야드',
    '퍼플아레나': '대전 월드컵 경기장',
    '광양전용구장': '광양 축구전용구장',
    '광양 축구전용구장': '광양 축구전용구장',
    '솔터축구장': '김포솔터축구장',
    '와~스타디움': '안산 와~스타디움',
    '미르스타디움': '용인 미르스타디움',
    '대구iM뱅크PARK': '대구iM뱅크PARK',

    // Handball (H-League)
    '핸드볼경기장': '티켓링크 라이브 아레나(핸드볼경기장)',
    '티켓링크 라이브 아레나(핸드볼경기장)': '티켓링크 라이브 아레나(핸드볼경기장)',
    '인천선학체육관': '인천선학체육관',
    'SK호크스아레나': '청주 SK호크스아레나',
    '광명시민체육관': '광명 시민체육관',
    '광명 시민체육관': '광명 시민체육관',
    '빛고을체육관': '광주 빛고을체육관',
    '광주 빛고을체육관': '광주 빛고을체육관',
    '기장체육관': '부산 기장체육관',
    '삼척시민체육관': '삼척 시민체육관',
    '삼척 시민체육관': '삼척 시민체육관'
};

const VENUE_ADDRESS_OVERRIDES: Record<string, string> = {
    '지혜샘어린이도서관': '경기도 수원시 권선구 세지로 3번길 17',
    '지해샘어린이도서관': '경기도 수원시 권선구 세지로 3번길 17'
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

    // 1. Initial cleanup
    let name = rawVenue.split('←Move left')[0]
        .split('Map data ©')[0]
        .split('Keyboard shortcuts')[0]
        .trim();

    // 2. KOPIS Specific Normalization (e.g., "예술의전당 [서울] (콘서트홀)")
    // Remove regional tags: [서울], [부산] etc.
    name = name.replace(/\s*\[[가-힣]+\]/g, '').trim();

    // Handle Hall designations in parentheses
    // Pattern: "Venue Name (Hall Name)" -> "Venue Name Hall Name" or just "Venue Name" if it's a dupe
    const hallMatch = name.match(/^(.*?)\s*\((.*?)\)$/);
    if (hallMatch) {
        const venueBase = hallMatch[1].trim();
        const hallPart = hallMatch[2].trim();
        
        // If hallPart starts with venueBase, it's redundant (e.g., "세종문화회관 (세종체임버홀)")
        if (hallPart.startsWith(venueBase)) {
            name = hallPart;
        } else if (venueBase.includes(hallPart)) {
            name = venueBase;
        } else {
            // Combine naturally (e.g. "예술의전당 (콘서트홀)" -> "예술의전당 콘서트홀")
            name = `${venueBase} ${hallPart}`;
        }
    }

    // 3. Remove common informal suffixes and parentheses
    name = name.replace(/ (구장|경기장|체육관)$/, '');
    name = name.replace(/\(두산\)|\(LG\)/g, '').trim();

    // 4. Exact matching in official map
    const entry = OFFICIAL_SPORTS_VENUES[name] ||
        OFFICIAL_SPORTS_VENUES[name.replace(/야구장$/, '')] ||
        OFFICIAL_SPORTS_VENUES[name.replace(/잠실야구장$/, '잠실')];

    if (!entry) return name; 

    if (typeof entry === 'string') return entry;

    if (homeTeam) {
        const teamMatch = Object.keys(entry).find(key => homeTeam.toLowerCase().includes(key.toLowerCase()));
        if (teamMatch) return entry[teamMatch];
    }

    if (genre && entry[genre]) {
        return entry[genre];
    }

    return entry.default || (typeof entry === 'object' ? Object.values(entry)[0] : name);
}

/**
 * Extracts numeric value from a price string (e.g. "40,000원" -> 40000)
 */
function getNumericPrice(priceStr: string | undefined): number | null {
    if (!priceStr) return null;
    const numeric = priceStr.replace(/[^0-9]/g, '');
    return numeric ? parseInt(numeric, 10) : null;
}

/**
 * Sanitize URL strings, removing junk prefixes and ensuring protocols.
 */
function sanitizeUrl(rawUrl: string | undefined): string {
    if (!rawUrl) return '';
    let url = rawUrl.trim();
    
    // Remove known garbage prefixes
    url = url.replace(/^(강원관광|홈페이지|지도보기|공식홈페이지|사이트|바로가기)\s*/, '');
    
    // If it starts with www, prepend https://
    if (url.startsWith('www.')) {
        url = 'https://' + url;
    }
    
    // Basic protocol check
    if (url && !url.startsWith('http')) {
        // If it looks like a domain, prepend https://
        if (url.includes('.') && !url.includes(' ')) {
            url = 'https://' + url;
        } else {
            return ''; // Invalid URL
        }
    }
    return url;
}

/**
 * Normalizes address by adding missing Sido/Sigungu prefixes based on region.
 */
function normalizeAddress(address: string | undefined, region: string | undefined, venue: string): string {
    if (!address || address === '정보 없음' || address === 'undefined') {
        // If address is missing, try to use venue name as a fallback if it's reputable, 
        // but generally we'll return a placeholder to be caught by geocoding
        return ''; 
    }
    
    let cleaned = address.trim();
    const SIDO_LIST = ['서울', '경기', '인천', '강원', '충북', '충남', '대전', '경북', '경남', '대구', '울산', '부산', '전북', '전남', '광주', '세종', '제주'];
    const startsWithSido = SIDO_LIST.some(sido => cleaned.startsWith(sido));

    if (!startsWithSido && region) {
        // Find the full Sido name from REGION_MAP keys
        const sidoName = Object.keys(REGION_MAP).find(k => REGION_MAP[k] === region);
        if (sidoName) {
            // Mapping short names to long official names if necessary
            const longSido: Record<string, string> = {
                '서울': '서울특별시', '경기': '경기도', '인천': '인천광역시',
                '부산': '부산광역시', '대구': '대구광역시', '광주': '광주광역시',
                '대전': '대전광역시', '울산': '울산광역시', '세종': '세종특별자치시',
                '제주': '제주특별자치도'
            };
            const prefix = longSido[sidoName] || sidoName;
            cleaned = `${prefix} ${cleaned}`;
        }
    }
    return cleaned;
}

/**
 * Cleans price strings, removing redundant qualifiers.
 */
function cleanPrice(price: string): string {
    if (!price) return '무료';
    let p = price.trim();
    if (p === '0' || p === '0원') return '무료';
    return p;
}

/**
 * Normalizes any raw performance object into a strict Performance interface.
 */
export function transformPerformance(raw: RawPerformance, source?: string): Performance {
    // 1. Source-specific field normalization
    let title = raw.title || '';
    let rawVenue = raw.venue || raw.place || raw.title || '';
    let image = raw.image || raw.poster || raw.posterUrl || '';
    
    // Unified Price Logic
    let priceRaw = raw.price || raw.cost || raw.admissionFee || raw.priceDetail || raw.feesAndPrograms || '';
    if (priceRaw === '정보 없음' || priceRaw === '상세페이지 참조') priceRaw = '';
    let price = cleanPrice(priceRaw);
    
    let date = raw.date || '';
    let performanceTime = raw.time || raw.performanceTime || '';
    let region = raw.region || '';
    let genre = (raw.genre as Genre) || 'activity';
    
    // Venue Address Override
    let manualAddress = VENUE_ADDRESS_OVERRIDES[rawVenue];

    // Extract bracketed region [창원], [제주] etc.
    const titleMatch = title.match(/\[([가-힣]+)\]/);
    const venueMatch = rawVenue.match(/\[([가-힣]+)\]/);
    const bracketRegion = titleMatch ? titleMatch[1] : (venueMatch ? venueMatch[1] : undefined);

    let venue = normalizeVenueName(rawVenue, raw.homeTeam, genre);
    if (!venue) venue = rawVenue;

    // Additional detailed fields
    let cast = raw.cast;
    let crew = raw.crew;
    let runningTime = raw.runtime || raw.runningTime;
    let age = raw.age || raw.rating;
    let production = raw.production || '';
    let host = raw.host || '';
    let organizer = raw.organizer || '';
    let planner = raw.planner || '';
    let producer = raw.producer || '';
    let sponsor = raw.sponsor || '';
    let priceList = raw.priceList;
    let ageDetail = raw.ageDetail;
    let bookingNotice = raw.bookingNotice;
    let website = sanitizeUrl(raw.website || raw.link || '');
    let parking = raw.parking;
    let parkingFee = raw.parkingFee;
    let restrooms = raw.restrooms;
    let rank = raw.rank;
    let reservationRate = raw.reservationRate;
    let audienceCount = raw.audienceCount;
    let budget = raw.budget;
    let revenue = raw.revenue;
    let budgetKRW = raw.budgetKRW;
    let revenueKRW = raw.revenueKRW;
    let synopsis = raw.synopsis;
    let trailer = raw.trailer;
    let roi = raw.roi;
    let feesAndPrograms = raw.feesAndPrograms || '';
    let targetAudience = raw.targetAudience || '';
    let operatingHours = raw.operatingHours || '';
    let priceDetail = raw.priceDetail || '';
    let facilities = raw.facilities || '';
    let closedDays = raw.closedDays || '';
    let contact = raw.contact || '';

    // Specific Source Overrides
    if (source === 'seoul') {
        venue = raw.place || '';
        image = raw.poster || '';
        price = raw.cost || '';
        date = raw.time ? `${raw.date} (${raw.time})` : (raw.date || '');
    } else if (source === 'movie') {
        genre = 'movie';
    } else if (source === 'kopis' && raw.genre) {
        // KOPIS specific normalization
        const kg = raw.genre;
        if (kg === '뮤지컬') genre = 'musical';
        else if (kg === '연극') genre = 'play';
        else if (kg === '대중음악' || kg === '대중무용') genre = 'concert';
        else if (kg.includes('클래식') || kg.includes('서양음악') || kg.includes('한국음악') || kg.includes('국악') || kg.includes('무용')) {
            genre = 'classic_tradition';
        }
        else if (kg.includes('전시') || kg.includes('미술')) genre = 'exhibition';
        else if (kg.includes('서커스') || kg.includes('마술') || kg === '복합') genre = 'activity';
        else if (kg.includes('축제')) genre = 'festival';
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
    } else if (genre === 'kids' || genre === 'leisure' || genre === 'activity' || genre === 'festival') {
        const t = (title + ' ' + venue).toLowerCase();
        if (t.includes('뮤지컬') || t.includes('티니핑') || t.includes('핑크퐁') || t.includes('오페라') || t.includes('싱어롱')) {
            genre = 'musical';
        } else if (t.includes('연극') || t.includes('아동극') || t.includes('인형극')) {
            genre = 'play';
        } else if (t.includes('클래식') || t.includes('음악회') || t.includes('발레') || t.includes('오케스트라')) {
            genre = 'classic_tradition';
        } else if (t.includes('도슨트') || t.includes('박물관') || t.includes('역사') || t.includes('서대문형무소') || t.includes('경복궁') || t.includes('미술관') || t.includes('기념관') || t.includes('에듀') || t.includes('투어')) {
            genre = 'museum';
        } else if (genre === 'festival' || t.includes('축제') || t.includes('페스티벌') || t.includes('체험') || t.includes('행사')) {
            genre = 'exhibition';
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
        if (!homeLogo && hTeam) {
            let lookupKey = hTeam;
            if (genre === 'baseball') lookupKey = `${hTeam}(야구)`;
            if (genre === 'basketball') lookupKey = `${hTeam}(농구)`;
            
            if (FUTURES_TEAM_LOGOS[lookupKey]) {
                homeLogo = FUTURES_TEAM_LOGOS[lookupKey];
            } else if (FUTURES_TEAM_LOGOS[hTeam]) {
                homeLogo = FUTURES_TEAM_LOGOS[hTeam];
            }
        }
        if (!awayLogo && aTeam) {
            let lookupKey = aTeam;
            if (genre === 'baseball') lookupKey = `${aTeam}(야구)`;
            if (genre === 'basketball') lookupKey = `${aTeam}(농구)`;
            
            if (FUTURES_TEAM_LOGOS[lookupKey]) {
                awayLogo = FUTURES_TEAM_LOGOS[lookupKey];
            } else if (FUTURES_TEAM_LOGOS[aTeam]) {
                awayLogo = FUTURES_TEAM_LOGOS[aTeam];
            }
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

    // 7. Discount Integrity Fix
    let discount = raw.discount;
    const nPrice = getNumericPrice(price);
    const nOriginal = getNumericPrice(raw.originalPrice);

    if (nPrice !== null && nOriginal !== null && nPrice >= nOriginal) {
        // If price is same or higher than original, it's not a discount
        discount = undefined;
    }

    if (title.includes('외옹치')) {
        console.log(`[DEBUG-TRANSFORM] 외옹치 raw.contact: ${raw.contact}, website: ${raw.website}`);
    }

    return {
        ...raw,
        id: String(raw.id),
        title: cleanTitle(title),
        link: raw.link || '',
        image: image,
        venue: venue.trim(),
        address: normalizeAddress(manualAddress || raw.address, mappedRegion, venue),
        date: formatUnifiedDate(date),
        region: mappedRegion,
        genre,
        source: source,
        homeTeamLogo: homeLogo,
        awayTeamLogo: awayLogo,
        price,
        discount, // Use validated discount
        originalPrice: raw.originalPrice,
        cast,
        crew,
        age: age || '',
        ageRating: age || '',
        bracketRegion,
        performanceTime,
        production,
        host,
        organizer,
        planner,
        producer,
        sponsor,
        priceList,
        ageDetail,
        bookingNotice,
        website,
        parking,
        parkingFee,
        restrooms,
        rank,
        reservationRate,
        audienceCount,
        budget,
        revenue,
        budgetKRW,
        revenueKRW,
        synopsis,
        trailer,
        roi,
        feesAndPrograms,
        targetAudience,
        operatingHours,
        priceDetail,
        facilities,
        closedDays,
        contact
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
