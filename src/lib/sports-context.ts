import type { Performance } from '@/types';
import { getSourceLabel, getSourceOfficialUrl } from '@/lib/source-registry';

const SPORTS_GENRES = new Set(['soccer', 'baseball', 'basketball', 'volleyball', 'handball']);

const GENRE_SPORT_LABEL: Record<string, string> = {
    soccer: '축구',
    baseball: '야구',
    basketball: '농구',
    volleyball: '배구',
    handball: '핸드볼',
};

const LEAGUE_INFO: Record<string, { label: string; official: string; schedule: string; standings?: string }> = {
    soccer: {
        label: 'K리그',
        official: 'https://www.kleague.com/',
        schedule: 'https://www.kleague.com/schedule.do',
        standings: 'https://www.kleague.com/record.do',
    },
    baseball: {
        label: 'KBO',
        official: 'https://www.koreabaseball.com/',
        schedule: 'https://www.koreabaseball.com/Schedule/Schedule.aspx',
        standings: 'https://www.koreabaseball.com/Record/TeamRank/TeamRank.aspx',
    },
    basketball: {
        label: 'KBL',
        official: 'https://www.kbl.or.kr/',
        schedule: 'https://www.kbl.or.kr/game/schedule-list',
        standings: 'https://www.kbl.or.kr/team/team-rank',
    },
    volleyball: {
        label: 'V-리그',
        official: 'https://www.kovo.co.kr/',
        schedule: 'https://www.kovo.co.kr/game/v-league/11110_schedule_list.asp',
        standings: 'https://www.kovo.co.kr/game/v-league/11210_team-ranking.asp',
    },
    handball: {
        label: '핸드볼 H리그',
        official: 'https://www.handballkorea.com/',
        schedule: 'https://www.handballkorea.com/',
    },
};

const TEAM_SEARCH_NAME: Record<string, string> = {
    강원: '강원 FC',
    경남: '경남 FC',
    광주: '광주 FC',
    김천: '김천 상무 FC',
    김포: '김포 FC',
    김해: '김해시청 축구단',
    대구: '대구 FC',
    대전: '대전 하나 시티즌',
    부산: '부산 아이파크',
    부천: '부천 FC 1995',
    서울: 'FC 서울',
    서울E: '서울 이랜드 FC',
    성남: '성남 FC',
    수원: '수원 삼성 블루윙즈',
    수원FC: '수원 FC',
    안산: '안산 그리너스 FC',
    안양: 'FC 안양',
    용인: '용인시축구센터',
    울산: '울산 HD FC',
    인천: '인천 유나이티드 FC',
    전남: '전남 드래곤즈',
    전북: '전북 현대 모터스',
    제주: '제주 유나이티드 FC',
    천안: '천안시티 FC',
    충남아산: '충남아산 FC',
    충북청주: '충북청주 FC',
    파주: '파주시민축구단',
    포항: '포항 스틸러스',
    화성: '화성 FC',
    KIA: 'KIA 타이거즈',
    KT: 'KT 위즈',
    LG: 'LG 트윈스',
    NC: 'NC 다이노스',
    SSG: 'SSG 랜더스',
    두산: '두산 베어스',
    롯데: '롯데 자이언츠',
    삼성: '삼성 라이온즈',
    키움: '키움 히어로즈',
    한화: '한화 이글스',
};

export type SportsContextFact = {
    label: string;
    value: string;
};

export type SportsContextLink = {
    label: string;
    href: string;
    helper?: string;
};

export type SportsContextRelatedGame = {
    label: string;
    title: string;
    date: string;
    venue: string;
};

export type SportsContext = {
    title: string;
    summary: string;
    facts: SportsContextFact[];
    links: SportsContextLink[];
    relatedGames: SportsContextRelatedGame[];
};

const compactText = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();

const comparableText = (value: unknown) => compactText(value)
    .replace(/[·ㆍ,./\\\-_:|"'“”‘’()[\]\s]/g, '')
    .toLowerCase();

const searchUrl = (query: string) =>
    `https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=${encodeURIComponent(query)}`;

const wikipediaSearchUrl = (query: string) =>
    `https://ko.wikipedia.org/w/index.php?search=${encodeURIComponent(query)}`;

const teamSearchName = (team?: string, genre?: string) => {
    const name = compactText(team);
    if (!name) return '';
    if (TEAM_SEARCH_NAME[name]) return TEAM_SEARCH_NAME[name];
    if (genre === 'soccer' && !/(fc|축구단|시티즌|유나이티드|아이파크|스틸러스|드래곤즈|모터스)$/i.test(name)) {
        return `${name} 축구단`;
    }
    return name;
};

const parseDateTimeValue = (value?: string | null) => {
    const text = compactText(value);
    const match = text.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?:\s*\([^)]*\))?(?:\s*(\d{1,2}):(\d{2}))?/);
    if (!match) return Number.POSITIVE_INFINITY;

    const [, year, month, day, hour = '0', minute = '0'] = match;
    return new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
    ).getTime();
};

const includesTeam = (performance: Performance, team?: string) => {
    const key = comparableText(team);
    if (!key) return false;
    return comparableText(performance.homeTeam) === key || comparableText(performance.awayTeam) === key;
};

export const isSportsGenre = (genre?: string | null) => SPORTS_GENRES.has(genre || '');

export const isRedundantSportsDescription = (performance: Performance, value?: string | null) => {
    if (!isSportsGenre(performance.genre)) return false;

    const text = compactText(value);
    if (!text) return false;

    const sportLabel = GENRE_SPORT_LABEL[performance.genre] || '스포츠';
    const hasTeamPair = Boolean(
        performance.homeTeam
        && performance.awayTeam
        && text.includes(performance.homeTeam)
        && text.includes(performance.awayTeam)
    );
    const hasGenericSportPhrase = text.includes(`${sportLabel} 경기`) || text.includes('경기입니다');
    const repeatsScheduleOrPlace = /일정은|위치는|장소는|기준입니다/u.test(text);

    return hasTeamPair && hasGenericSportPhrase && repeatsScheduleOrPlace;
};

export function buildSportsContext(
    performance: Performance,
    allPerformances: Performance[] = [],
): SportsContext | null {
    if (!isSportsGenre(performance.genre) || !performance.homeTeam || !performance.awayTeam) return null;

    const league = LEAGUE_INFO[performance.genre] || {
        label: getSourceLabel(performance.source || ''),
        official: getSourceOfficialUrl(performance.source, performance.link) || performance.link,
        schedule: getSourceOfficialUrl(performance.source, performance.link) || performance.link,
    };

    const homeTeamName = teamSearchName(performance.homeTeam, performance.genre);
    const awayTeamName = teamSearchName(performance.awayTeam, performance.genre);
    const sportLabel = GENRE_SPORT_LABEL[performance.genre] || '스포츠';
    const sameLeagueGames = allPerformances.filter((item) => item.genre === performance.genre);
    const homeTeamGames = sameLeagueGames.filter((item) => includesTeam(item, performance.homeTeam));
    const awayTeamGames = sameLeagueGames.filter((item) => includesTeam(item, performance.awayTeam));
    const headToHeadGames = sameLeagueGames.filter((item) => (
        includesTeam(item, performance.homeTeam) && includesTeam(item, performance.awayTeam)
    ));
    const venueGames = performance.venue
        ? sameLeagueGames.filter((item) => comparableText(item.venue) === comparableText(performance.venue))
        : [];

    const relatedGames = [...sameLeagueGames]
        .filter((item) => item.id !== performance.id)
        .filter((item) => includesTeam(item, performance.homeTeam) || includesTeam(item, performance.awayTeam) || comparableText(item.venue) === comparableText(performance.venue))
        .sort((a, b) => parseDateTimeValue(a.date) - parseDateTimeValue(b.date))
        .slice(0, 3)
        .map((item): SportsContextRelatedGame => {
            const label = includesTeam(item, performance.homeTeam)
                ? `${performance.homeTeam} 일정`
                : includesTeam(item, performance.awayTeam)
                    ? `${performance.awayTeam} 일정`
                    : '같은 경기장';

            return {
                label,
                title: item.title,
                date: item.date,
                venue: item.venue,
            };
        });

    const facts: SportsContextFact[] = [
        { label: '리그', value: league.label },
        { label: '홈팀', value: homeTeamName },
        { label: '원정팀', value: awayTeamName },
    ];

    if (sameLeagueGames.length > 0) {
        facts.push({ label: '수집 일정', value: `${sameLeagueGames.length.toLocaleString('ko-KR')}경기` });
    }
    if (homeTeamGames.length > 0) {
        facts.push({ label: `${performance.homeTeam} 일정`, value: `${homeTeamGames.length.toLocaleString('ko-KR')}경기` });
    }
    if (awayTeamGames.length > 0) {
        facts.push({ label: `${performance.awayTeam} 일정`, value: `${awayTeamGames.length.toLocaleString('ko-KR')}경기` });
    }
    if (headToHeadGames.length > 1) {
        facts.push({ label: '맞대결', value: `${headToHeadGames.length.toLocaleString('ko-KR')}경기` });
    }
    if (venueGames.length > 1) {
        facts.push({ label: '같은 경기장', value: `${venueGames.length.toLocaleString('ko-KR')}경기` });
    }

    const links: SportsContextLink[] = [
        {
            label: `${homeTeamName} 정보`,
            href: searchUrl(homeTeamName),
            helper: '네이버 팀 정보 검색',
        },
        {
            label: `${awayTeamName} 정보`,
            href: searchUrl(awayTeamName),
            helper: '네이버 팀 정보 검색',
        },
        {
            label: `${homeTeamName} 위키`,
            href: wikipediaSearchUrl(homeTeamName),
            helper: '위키 기반 배경 정보',
        },
        {
            label: `${awayTeamName} 위키`,
            href: wikipediaSearchUrl(awayTeamName),
            helper: '위키 기반 배경 정보',
        },
    ];

    if (performance.venue) {
        links.push({
            label: `${performance.venue} 경기장`,
            href: searchUrl(performance.venue),
            helper: '경기장 위치와 관람 정보',
        });
    }

    links.push({
        label: `${league.label} 공식 일정`,
        href: league.schedule || league.official,
        helper: '공식 일정/결과 확인',
    });

    if (league.standings) {
        links.push({
            label: `${league.label} 순위/기록`,
            href: league.standings,
            helper: '리그 흐름 확인',
        });
    }

    const summary = sameLeagueGames.length > 0
        ? `현재 수집된 ${league.label} ${sportLabel} 일정 ${sameLeagueGames.length.toLocaleString('ko-KR')}경기를 기준으로, ${homeTeamName}와 ${awayTeamName}의 팀 정보·경기장·리그 공식 기록을 함께 볼 수 있게 묶었습니다.`
        : `${homeTeamName} 홈 경기입니다. 팀 정보, 경기장 정보, ${league.label} 공식 일정과 기록 링크를 함께 확인할 수 있게 묶었습니다.`;

    return {
        title: '경기 브리핑',
        summary,
        facts,
        links,
        relatedGames,
    };
}
