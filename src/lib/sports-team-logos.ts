import { FUTURES_TEAM_LOGOS } from '@/lib/constants';

export const SPORTS_TEAM_LOGO_GENRES = new Set(['volleyball', 'basketball', 'baseball', 'handball', 'soccer']);

type SportsTeamLogoInput = {
    genre?: string;
    homeTeam?: string;
    awayTeam?: string;
    homeTeamLogo?: string;
    awayTeamLogo?: string;
};

export function getSportsTeamLogo(performance: SportsTeamLogoInput, side: 'home' | 'away') {
    const team = side === 'home' ? performance.homeTeam : performance.awayTeam;
    const logo = side === 'home' ? performance.homeTeamLogo : performance.awayTeamLogo;

    if (team && FUTURES_TEAM_LOGOS[team]) {
        return FUTURES_TEAM_LOGOS[team];
    }

    return logo || '';
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
