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
