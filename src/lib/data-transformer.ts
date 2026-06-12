/**
 * CultureFlow Master Data Transformer
 * The single source of truth for normalizing disparate data sources.
 */

import { Performance, Genre } from '@/types';
import { FUTURES_TEAM_LOGOS } from '@/lib/constants';
import { getOptimizedUrl, cleanTitle, formatUnifiedDate } from '@/lib/utils';
import { getSportsTicketBaySummary, getSportsTicketingInfo } from '@/lib/sports-ticketing';

// Genre-specific fallback images
const _BP = process.env.NEXT_PUBLIC_BASE_PATH || '';
const GENRE_FALLBACKS: Record<string, string> = {
    soccer: `${_BP}/images/soccer_goal_poster_20260528.jpg`,
    baseball: `${_BP}/images/fallbacks/baseball.jpg`,
    basketball: `${_BP}/images/fallbacks/basketball.jpg`,
    volleyball: `${_BP}/images/fallbacks/volleyball.jpg`,
    handball: `${_BP}/images/fallbacks/handball.jpg`,
    museum: `${_BP}/images/fallbacks/museum.jpg`,
    exhibition: `${_BP}/images/fallbacks/exhibition.jpg`,
    classic_tradition: `${_BP}/images/fallbacks/classic.jpg`,
    activity: `${_BP}/images/fallbacks/activity.jpg`,
    movie: `${_BP}/images/fallbacks/movie.svg`,
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

const REGION_MAP: Record<string, string> = {
    '서울': 'seoul', '경기': 'gyeonggi', '인천': 'incheon',
    '부산': 'busan', '대구': 'daegu', '광주': 'gwangju',
    '대전': 'daejeon', '울산': 'ulsan', '세종': 'sejong',
    '강원': 'gangwon', '충북': 'chungbuk', '충남': 'chungnam',
    '전북': 'jeonbuk', '전남': 'jeonnam', '경북': 'gyeongbuk',
    '경남': 'gyeongnam', '제주': 'jeju'
};

const SPORTS_GENRES = new Set(['baseball', 'basketball', 'volleyball', 'soccer', 'handball']);

const SPORT_LABELS: Record<string, string> = {
    baseball: '야구',
    basketball: '농구',
    volleyball: '배구',
    soccer: '축구',
    handball: '핸드볼',
};

const SPORT_LEAGUE_LABELS: Record<string, string> = {
    baseball: 'KBO',
    basketball: 'KBL',
    volleyball: 'V-리그',
    soccer: 'K리그',
    handball: '핸드볼 H리그',
};

const SPORT_RECORD_URLS: Record<string, string> = {
    baseball: 'https://www.koreabaseball.com/Record/TeamRank/TeamRank.aspx',
    basketball: 'https://www.kbl.or.kr/team/team-rank',
    volleyball: 'https://www.kovo.co.kr/game/v-league/11210_team-ranking.asp',
    soccer: 'https://www.kleague.com/record.do',
    handball: 'https://www.handballkorea.com/',
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

function compactDetailText(value?: string) {
    return value?.replace(/\s+/g, ' ').trim() || '';
}

const WEEKDAY_FULL_PATTERN = '(?:월요일|화요일|수요일|목요일|금요일|토요일|일요일)';
const WEEKDAY_SHORT_PATTERN = '(?:월|화|수|목|금|토|일):';

function normalizeMultilineDetailText(value?: string) {
    return String(value || '')
        .replace(/\r/g, '')
        .split('\n')
        .map(line => line.replace(/[ \t]+/g, ' ').trim())
        .filter(Boolean)
        .join('\n')
        .trim();
}

function formatReadableSchedule(value?: string) {
    const text = normalizeMultilineDetailText(value);
    if (!text) return '';

    const weekdayMatches = text.match(new RegExp(WEEKDAY_FULL_PATTERN, 'g')) || [];
    const shortWeekdayMatches = text.match(new RegExp(WEEKDAY_SHORT_PATTERN, 'g')) || [];
    const hasWeeklyPattern = weekdayMatches.length >= 3 || shortWeekdayMatches.length >= 3;
    if (!hasWeeklyPattern) return text;

    let formatted = text
        .replace(/\s*(\[[^\]\n]{2,24}\])\s*/g, '\n$1\n')
        .replace(new RegExp(`\\s*-\\s*(?=${WEEKDAY_FULL_PATTERN})`, 'g'), '\n- ')
        .replace(new RegExp(`\\s*-\\s*(?=${WEEKDAY_SHORT_PATTERN})`, 'g'), '\n- ')
        .replace(/\s*(※)\s*/g, '\n$1 ')
        .replace(new RegExp(`,\\s*(?=${WEEKDAY_FULL_PATTERN}\\s)`, 'g'), ',\n')
        .replace(new RegExp(`,\\s*(?=${WEEKDAY_SHORT_PATTERN})`, 'g'), ',\n');

    if (formatted === text) {
        formatted = formatted
            .replace(new RegExp(`\\s+(?=(?:화요일|수요일|목요일|금요일|토요일|일요일)\\s)`, 'g'), '\n')
            .replace(/\s+(?=(?:화|수|목|금|토|일):)/g, '\n');
    }

    return formatted
        .split('\n')
        .map(line => line.replace(/[ \t]+/g, ' ').trim())
        .filter(Boolean)
        .join('\n');
}

function formatReadableSectionBlock(value?: string) {
    const text = normalizeMultilineDetailText(value);
    if (!text) return '';

    return text
        .replace(/\s*(\[[^\]\n]{2,24}\])\s*/g, '\n$1\n')
        .replace(/(?<!^)\s*[ㆍ•]\s*/g, '\n- ')
        .replace(/(?<!^)\s*-\s*(?=[가-힣A-Za-z])/g, '\n- ')
        .replace(/\s*(※)\s*/g, '\n$1 ')
        .replace(/\s+(?=\d+\.\s*[가-힣A-Za-z])/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .split('\n')
        .map(line => line.replace(/[ \t]+/g, ' ').trim())
        .filter(Boolean)
        .join('\n');
}

function formatReadableParagraphBlock(value?: string) {
    const text = normalizeMultilineDetailText(value);
    if (!text) return '';

    const sectioned = text
        .replace(/\s*(\[행사내용\]|\[상세내용\]|\[이용안내\]|\[요금\]|\[프로그램\])\s*/g, '\n\n$1\n')
        .replace(/\s+(?=\d+\.\s*[가-힣A-Za-z])/g, '\n')
        .replace(/\s*(※)\s*/g, '\n$1 ');

    if (sectioned.includes('\n')) {
        return sectioned
            .split('\n')
            .map(line => line.replace(/[ \t]+/g, ' ').trim())
            .filter(Boolean)
            .join('\n');
    }

    if (sectioned.length < 130) return sectioned;

    return sectioned
        .replace(/([가-힣A-Za-z0-9)"'’”\]](?:다|요|음|함|됨|임|한다|된다|있다|없다|이다|입니다|습니다)\.)\s+(?=[가-힣A-Za-z0-9"'“‘\[])/g, '$1\n\n')
        .replace(/([.!?])\s+(?=[가-힣A-Za-z"'“‘\[])/g, '$1\n\n')
        .split('\n')
        .map(line => line.replace(/[ \t]+/g, ' ').trim())
        .filter(Boolean)
        .join('\n');
}

function trimWebsiteForDisplay(value?: string) {
    return String(value || '').trim().replace(/\/+$/, '');
}

function isSportsGenre(genre?: string) {
    return SPORTS_GENRES.has(genre || '');
}

function looksUnknownPrice(value?: string) {
    const text = compactDetailText(value);
    return !text || /정보\s*없음|미정|문의|예매처\s*확인|가격\s*확인/i.test(text);
}

function compactUrlLabel(value?: string | null) {
    return String(value || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

function buildSportsDescription(raw: RawPerformance, genre: string, venue: string) {
    const sportLabel = SPORT_LABELS[genre] || '스포츠';
    const leagueLabel = raw.league || SPORT_LEAGUE_LABELS[genre] || sportLabel;
    const homeTeam = compactDetailText(raw.homeTeam);
    const awayTeam = compactDetailText(raw.awayTeam);
    const matchup = homeTeam && awayTeam ? `${homeTeam} vs ${awayTeam}` : cleanTitle(raw.title || '');
    const officialSchedule = raw.link || '';
    const recordUrl = SPORT_RECORD_URLS[genre] || '';

    return [
        '[관람 포인트]',
        `- ${leagueLabel} ${sportLabel} 일정 중 ${matchup} 매치업입니다.`,
        venue ? `- 경기장은 ${venue}입니다. 좌석 구역, 원정석 운영, 우천/취소 규정은 예매처 공지를 함께 확인하는 편이 안전합니다.` : '',
        '- 실제 티켓 오픈 시간, 잔여석, 취소표, 현장 운영은 홈팀 또는 공식 예매처 기준으로 바뀔 수 있습니다.',
        '',
        '[확인 링크]',
        officialSchedule ? `- 공식 일정: ${compactUrlLabel(officialSchedule)}` : '',
        recordUrl ? `- 리그 기록/순위: ${compactUrlLabel(recordUrl)}` : '',
    ].filter(Boolean).join('\n');
}

function buildSportsBookingNotice(raw: RawPerformance, genre: string, currentNotice?: string) {
    const baseNotice = formatReadableParagraphBlock(currentNotice);
    const tempPerformance = {
        genre,
        title: cleanTitle(raw.title || ''),
        link: raw.link || raw.website || '',
        website: raw.website || '',
        source: '',
        date: raw.date || '',
        homeTeam: raw.homeTeam,
        awayTeam: raw.awayTeam,
        venue: raw.venue || raw.place || '',
    };
    const ticketingInfo = getSportsTicketingInfo(tempPerformance);
    const ticketBay = getSportsTicketBaySummary(tempPerformance);
    const lines = [
        '[예매 참고]',
        ticketingInfo?.bookingProvider && ticketingInfo.bookingUrl
            ? `- 공식 예매처: ${ticketingInfo.bookingProvider} (${compactUrlLabel(ticketingInfo.bookingUrl)})`
            : '- 공식 예매처와 홈팀 공지를 우선 확인하세요.',
        ticketingInfo?.officialLabel && ticketingInfo.officialUrl
            ? `- 공식 사이트: ${ticketingInfo.officialLabel} (${compactUrlLabel(ticketingInfo.officialUrl)})`
            : '',
        ticketBay
            ? `- ${ticketBay.sourceLabel}: ${ticketBay.label} · ${ticketBay.detail}`
            : '- 가격이 변동되는 스포츠 경기는 좌석 등급과 예매 오픈 시점에 따라 실제 결제 금액이 달라질 수 있습니다.',
    ].filter(Boolean).join('\n');

    if (!baseNotice) return lines;
    if (baseNotice.includes('[예매 참고]')) return baseNotice;
    return `${baseNotice}\n\n${lines}`;
}

function buildSportsPriceDetail(raw: RawPerformance, genre: string, currentPriceDetail?: string) {
    const base = formatReadableSectionBlock(currentPriceDetail);
    const ticketBay = getSportsTicketBaySummary({
        genre,
        date: raw.date || '',
        homeTeam: raw.homeTeam,
        awayTeam: raw.awayTeam,
        venue: raw.venue || raw.place || '',
    });

    if (!ticketBay) return base;

    const lines = [
        '티켓베이 참고가',
        `최저 참고가: ${ticketBay.label.replace(/^티켓베이\s*참고\s*/u, '')}`,
        ticketBay.detail,
    ].join('\n');

    return base ? `${base}\n\n${lines}` : lines;
}

function isLowValueDescription(value?: string) {
    const text = compactDetailText(value);
    if (!text) return false;
    return /^\[[^\]]+\]\s*장소\s*:/u.test(text)
        || /^서울시\s*문화분야\s*종합\s*정보\s*제공\s*사이트/u.test(text)
        || /장소\s*확인\s*필요에서\s*진행되는\s*(클래스|영화)입니다/u.test(text)
        || (/일정은\s*20\d{2}[.\-]\d{2}[.\-]\d{2}.+기준입니다/u.test(text)
            && /에서\s*진행되는\s*(영화|클래스)입니다/u.test(text));
}

function isDurationOnly(value?: string) {
    const text = compactDetailText(value);
    return Boolean(text && /^\d{1,3}(?:시간)?(?:\d{1,2})?분$|^\d{1,2}시간(?:\d{1,2}분)?$/.test(text));
}

function pickBestImageFromRaw(raw: RawPerformance, genre: string) {
    const candidates = [
        raw.image,
        raw.poster,
        raw.posterUrl,
        raw.thumbnail,
        raw.thumbnailUrl,
        raw.ogImage,
        raw.coverImage,
        raw.mainImage,
        raw.photoUrl,
        raw.imageUrl,
        Array.isArray(raw.images) ? raw.images[0] : undefined,
        Array.isArray(raw.synopsisImages) ? raw.synopsisImages[0] : undefined,
        Array.isArray(raw.stillImages) ? raw.stillImages[0] : undefined,
    ]
        .map((value) => typeof value === 'string' ? value.trim() : '')
        .filter(Boolean);

    const fallback = GENRE_FALLBACKS[genre] || GENRE_FALLBACKS.default;
    return candidates.find((candidate) => !/정보\s*없음|placeholder|no[-_ ]?image|noimage/i.test(candidate)) || fallback;
}

function looksLikeKoreanAddress(value?: string) {
    const text = compactDetailText(value);
    if (!text) return false;
    return /^(서울특별시|서울시|부산광역시|부산시|대구광역시|대구시|인천광역시|인천시|광주광역시|광주시|대전광역시|대전시|울산광역시|울산시|세종특별자치시|세종시|경기도|강원특별자치도|강원도|충청북도|충청남도|전북특별자치도|전라북도|전라남도|경상북도|경상남도|제주특별자치도|제주도|충북|충남|전북|전남|경북|경남)\s+/.test(text);
}

function splitAddressLikeVenue(rawVenue: string, title: string) {
    const venueText = compactDetailText(rawVenue);
    const titleText = compactDetailText(title);
    if (!looksLikeKoreanAddress(venueText)) return null;

    if (titleText && venueText.includes(titleText)) {
        return {
            venue: titleText,
            address: venueText
        };
    }

    const tokens = venueText.split(' ').filter(Boolean);
    const trailingName = tokens.slice(-2).join(' ');
    if (tokens.length >= 4 && trailingName && !/[0-9]/.test(trailingName)) {
        return {
            venue: trailingName,
            address: venueText
        };
    }

    return null;
}

/**
 * Normalizes any raw performance object into a strict Performance interface.
 */
export function transformPerformance(raw: RawPerformance, source?: string): Performance {
    // 1. Source-specific field normalization
    let title = raw.title || '';
    let rawVenue = raw.venue || raw.place || raw.title || '';
    let price = raw.price || raw.cost || '';
    let date = raw.date || '';
    let performanceTime = raw.time || raw.performanceTime || '';
    let region = raw.region || '';
    let genre = (raw.genre as Genre) || 'activity';
    let image = pickBestImageFromRaw(raw, genre);
    let address = raw.address || '';
    const addressLikeVenue = splitAddressLikeVenue(rawVenue, title);
    if (addressLikeVenue) {
        rawVenue = addressLikeVenue.venue;
        address = addressLikeVenue.address;
    }
    
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
    let age = raw.age || raw.ageRating || raw.rating;
    let description = raw.description || raw.synopsis || '';
    let production = raw.production || '';
    let host = raw.host || '';
    let organizer = raw.organizer || '';
    let planner = raw.planner || '';
    let producer = raw.producer || '';
    let sponsor = raw.sponsor || '';
    let priceList = raw.priceList;
    let ageDetail = raw.ageDetail;
    let bookingNotice = raw.bookingNotice;
    let website = raw.website;
    let parking = raw.parking;
    let parkingFee = raw.parkingFee;
    let restrooms = raw.restrooms;
    let originalTitle = raw.originalTitle;
    let productionCountry = raw.productionCountry;
    let productionYear = raw.productionYear;
    let movieInfo = raw.movieInfo;
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
    let sourceUpdatedAt = raw.sourceUpdatedAt || '';
    let instagram = raw.instagram || raw.instagramUrl || '';
    let foodInfo = raw.foodInfo || '';
    let foodVendors = raw.foodVendors;
    let facilities = raw.facilities || '';
    let closedDays = raw.closedDays || '';
    let contact = raw.contact || '';
    let reservationInfo = raw.reservationInfo || '';
    let openRun = raw.openRun;
    let performanceState = raw.performanceState || raw.state || raw.prfstate || '';
    let lastModifiedAt = raw.lastModifiedAt || raw.updatedAt || '';
    let dataCollectedAt = raw.dataCollectedAt || raw.lastCollected || raw.lastEnriched || '';
    let venuePhone = raw.venuePhone || raw.phone || '';
    let venueHomepage = raw.venueHomepage || raw.homepage || '';
    let venueFacilityType = raw.venueFacilityType || raw.facilityType || '';
    let venueSeatScale = raw.venueSeatScale || raw.seatScale || '';
    let venueTheaterCount = raw.venueTheaterCount || raw.theaterCount || '';
    let venueOpenedAt = raw.venueOpenedAt || '';
    let venueAmenities = raw.venueAmenities;
    let placeProvider = raw.placeProvider || '';
    let placeId = raw.placeId || '';
    let placeUrl = raw.placeUrl || '';
    let placeCategory = raw.placeCategory || '';
    let platforms = raw.platforms;
    let stillImages = raw.stillImages;
    let synopsisImages = raw.synopsisImages;
    let keywords = raw.keywords;
    let tagline = raw.tagline || '';
    let voteAverage = raw.voteAverage;
    let voteCount = raw.voteCount;
    let popularity = raw.popularity;
    const statsCollectedAt =
        (typeof raw.statsCollectedAt === 'string' && raw.statsCollectedAt.trim())
            ? raw.statsCollectedAt
            : (typeof raw.lastCollected === 'string' && raw.lastCollected.trim() ? raw.lastCollected : undefined);
    let backupPoster = raw.backupPoster
        || raw.posterUrl
        || raw.poster
        || (typeof raw.image === 'string' && raw.image.startsWith('http') ? raw.image : undefined);

    // Specific Source Overrides
    if (source === 'seoul') {
        venue = raw.place || '';
        image = raw.poster || '';
        price = raw.cost || '';
        date = raw.time ? `${raw.date} (${raw.time})` : (raw.date || '');
        region = raw.region || '서울';
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
    } else if (genre === 'kids' || genre === 'leisure' || genre === 'activity' || genre === 'festival' || genre === 'travel') {
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

    if (!image || image === '정보 없음' || /placeholder|no[-_ ]?image|noimage/i.test(image)) {
        image = pickBestImageFromRaw(raw, genre);
    }

    if (isSportsGenre(genre)) {
        const descriptionText = compactDetailText(description);
        const shouldReplaceDescription = !descriptionText
            || /경기입니다|일정은\s*20\d{2}|위치는\s*|기준입니다/i.test(descriptionText);
        if (shouldReplaceDescription) {
            description = buildSportsDescription(raw, genre, venue);
        }
        bookingNotice = buildSportsBookingNotice(raw, genre, bookingNotice);
        if (looksUnknownPrice(price)) {
            price = '';
        }
        priceDetail = buildSportsPriceDetail(raw, genre, priceDetail);
    }

    // 3. Region Mapping
    const regionIds = new Set(Object.values(REGION_MAP));
    const mappedRegion = REGION_MAP[region] || (regionIds.has(region) ? region : (region ? 'etc' : 'unknown'));

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
    backupPoster = addBP(backupPoster) || backupPoster;

    // 7. Discount Integrity Fix
    let discount = raw.discount;
    const nPrice = getNumericPrice(price);
    const nOriginal = getNumericPrice(raw.originalPrice);

    if (nPrice !== null && nOriginal !== null && nPrice >= nOriginal) {
        // If price is same or higher than original, it's not a discount
        discount = undefined;
    }

    operatingHours = formatReadableSchedule(operatingHours);
    performanceTime = formatReadableSchedule(performanceTime);
    if (compactDetailText(performanceTime) && compactDetailText(performanceTime) === compactDetailText(operatingHours)) {
        // Avoid rendering the same time information twice in detail views.
        performanceTime = '';
    }
    if (isDurationOnly(date)) {
        runningTime = runningTime && !/소요\s*시간|예약페이지\s*참조/i.test(runningTime)
            ? runningTime
            : date;
        date = genre === 'class' ? '상시/예약' : '';
    }
    closedDays = formatReadableSchedule(closedDays);
    priceDetail = formatReadableSectionBlock(priceDetail);
    feesAndPrograms = formatReadableSectionBlock(feesAndPrograms);
    if (isLowValueDescription(description)) {
        description = '';
    }
    description = formatReadableParagraphBlock(description);
    synopsis = formatReadableParagraphBlock(synopsis);
    bookingNotice = formatReadableParagraphBlock(bookingNotice);
    ageDetail = formatReadableSectionBlock(ageDetail);
    parking = formatReadableParagraphBlock(parking);
    parkingFee = formatReadableSectionBlock(parkingFee);
    reservationInfo = formatReadableParagraphBlock(reservationInfo);
    foodInfo = formatReadableSectionBlock(foodInfo);
    website = trimWebsiteForDisplay(website);
    venueHomepage = trimWebsiteForDisplay(venueHomepage);

    return {
        ...raw,
        id: String(raw.id),
        title: cleanTitle(title),
        link: raw.link || raw.website || '',
        image: image,
        venue: venue.trim(),
        address,
        date: formatUnifiedDate(date),
        region: mappedRegion,
        genre,
        source: source,
        description,
        homeTeamLogo: homeLogo,
        awayTeamLogo: awayLogo,
        price,
        discount, // Use validated discount
        originalPrice: raw.originalPrice,
        cast,
        crew,
        runningTime,
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
        originalTitle,
        productionCountry,
        productionYear,
        movieInfo,
        backupPoster,
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
        sourceUpdatedAt,
        instagram,
        foodInfo,
        foodVendors,
        facilities,
        closedDays,
        contact,
        reservationInfo,
        statsCollectedAt,
        openRun,
        performanceState,
        lastModifiedAt,
        dataCollectedAt,
        venuePhone,
        venueHomepage,
        venueFacilityType,
        venueSeatScale,
        venueTheaterCount,
        venueOpenedAt,
        venueAmenities,
        placeProvider,
        placeId,
        placeUrl,
        placeCategory,
        platforms,
        stillImages,
        synopsisImages,
        keywords,
        tagline,
        voteAverage,
        voteCount,
        popularity
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
