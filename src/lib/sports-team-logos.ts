import { FUTURES_TEAM_LOGOS } from '@/lib/constants';

export const SPORTS_TEAM_LOGO_GENRES = new Set(['volleyball', 'basketball', 'baseball', 'handball', 'soccer']);

export type SportsTeamLogoInput = {
    genre?: string;
    homeTeam?: string;
    awayTeam?: string;
    homeTeamLogo?: string;
    awayTeamLogo?: string;
};

function normalizeTeamName(value: string) {
    return value
        .replace(/\((?:홈|원정|상무|배구)\)/g, '')
        .replace(/[\s._-]/g, '')
        .toUpperCase();
}

function findMappedTeamLogo(team: string) {
    if (FUTURES_TEAM_LOGOS[team]) return FUTURES_TEAM_LOGOS[team];

    const normalized = normalizeTeamName(team);
    const key = Object.keys(FUTURES_TEAM_LOGOS)
        .sort((a, b) => b.length - a.length)
        .find(candidate => {
            const normalizedCandidate = normalizeTeamName(candidate);
            return normalized === normalizedCandidate || normalized.includes(normalizedCandidate);
        });

    return key ? FUTURES_TEAM_LOGOS[key] : undefined;
}

const KBL_OFFICIAL_LOGOS: Record<string, string> = {
    SK: '/images/logos/kbl/sk_official.svg',
    KCC: '/images/logos/kbl/kcc_official.svg',
    DB: '/images/logos/kbl/db_official.svg',
    현대모비스: '/images/logos/kbl/mobis_official.svg',
    한국가스공사: '/images/logos/kbl/kogas_official.svg',
    소노: '/images/logos/kbl/sono_official.svg',
    LG: '/images/logos/kbl/lg_official.svg',
    삼성: '/images/logos/kbl/samsung_official.svg',
    KT: '/images/logos/kbl/kt_official.svg',
    정관장: '/images/logos/kbl/kgc_official.svg',
    KGC: '/images/logos/kbl/kgc_official.svg',
};

function getBasePath() {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/culture')) {
        return '/culture';
    }
    return process.env.NEXT_PUBLIC_BASE_PATH || (process.env.NODE_ENV === 'production' ? '/culture' : '');
}

export function normalizeLogoSrc(src: string) {
    if (!src || src.startsWith('http') || src.startsWith('data:')) {
        return src;
    }

    const basePath = getBasePath();
    let clean = src;
    if (basePath && clean.startsWith(basePath + '/')) {
        clean = clean.slice(basePath.length);
    }
    if (!clean.startsWith('/')) {
        clean = '/' + clean;
    }
    const path = basePath ? `${basePath}${clean}` : clean;
    return encodeURI(path);
}

export function getSportsTeamLogo(performance: SportsTeamLogoInput, side: 'home' | 'away') {
    const team = side === 'home' ? performance.homeTeam : performance.awayTeam;
    const directLogo = side === 'home' ? performance.homeTeamLogo : performance.awayTeamLogo;

    if (directLogo) {
        return normalizeLogoSrc(directLogo);
    }

    if (team) {
        const mappedLogo = findMappedTeamLogo(team);
        if (mappedLogo) return normalizeLogoSrc(mappedLogo);
    }

    return '';
}

export function getSportsTeamLogoCandidates(performance: SportsTeamLogoInput, side: 'home' | 'away') {
    const primary = getSportsTeamLogo(performance, side);
    const team = side === 'home' ? performance.homeTeam : performance.awayTeam;
    const candidates = primary ? [primary] : [];

    if (performance.genre === 'basketball' && team) {
        const normalizedTeam = normalizeTeamName(team);
        const officialKey = Object.keys(KBL_OFFICIAL_LOGOS).find((key) => {
            const normalizedKey = normalizeTeamName(key);
            return normalizedTeam === normalizedKey || normalizedTeam.includes(normalizedKey);
        });
        if (officialKey) {
            candidates.push(normalizeLogoSrc(KBL_OFFICIAL_LOGOS[officialKey]));
        }
    }

    return [...new Set(candidates)];
}

export function shouldShowSportsTeamLogoOverlay(performance: SportsTeamLogoInput) {
    if (!performance.genre || !SPORTS_TEAM_LOGO_GENRES.has(performance.genre)) {
        return false;
    }

    return Boolean(
        performance.homeTeam &&
        performance.awayTeam &&
        getSportsTeamLogo(performance, 'home') &&
        getSportsTeamLogo(performance, 'away')
    );
}
