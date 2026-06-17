/* eslint-disable @next/next/no-img-element */
import React, { memo } from 'react';
import { clsx } from 'clsx';
import { getGenreIcon } from '../GenreIcons';
import { getSportsTeamLogo, SPORTS_TEAM_LOGO_GENRES, type SportsTeamLogoInput } from '@/lib/sports-team-logos';

interface SportsTeamLogoOverlayProps {
    performance: SportsTeamLogoInput;
    className?: string;
    logoClassName?: string;
    vsClassName?: string;
    showBackgroundIcon?: boolean;
    backgroundIconSize?: number;
    backgroundIconClassName?: string;
    logoFrameClassName?: string;
    showTeamNames?: boolean;
    teamNameClassName?: string;
}

function SportsTeamLogoOverlay({
    performance,
    className,
    logoClassName,
    vsClassName,
    showBackgroundIcon = false,
    backgroundIconSize = 120,
    backgroundIconClassName,
    logoFrameClassName,
    showTeamNames = false,
    teamNameClassName,
}: SportsTeamLogoOverlayProps) {
    const homeLogo = getSportsTeamLogo(performance, 'home');
    const awayLogo = getSportsTeamLogo(performance, 'away');
    const backgroundIcon = showBackgroundIcon ? getGenreIcon(performance.genre || '', backgroundIconSize) : null;

    if (
        !performance.genre ||
        !SPORTS_TEAM_LOGO_GENRES.has(performance.genre) ||
        !performance.homeTeam ||
        !performance.awayTeam ||
        !homeLogo ||
        !awayLogo
    ) {
        return null;
    }

    const renderLogo = (side: 'home' | 'away') => {
        const team = side === 'home' ? performance.homeTeam : performance.awayTeam;
        const logo = side === 'home' ? homeLogo : awayLogo;
        const image = (
            <img
                src={logo}
                alt={team}
                className={logoFrameClassName ? 'w-full h-full object-contain' : logoClassName}
                width={96}
                height={96}
                loading="lazy"
                decoding="async"
                draggable={false}
            />
        );

        if (!logoFrameClassName && !showTeamNames) {
            return image;
        }

        return (
            <div className="flex flex-col items-center gap-1 min-w-0">
                {logoFrameClassName ? (
                    <div className={logoFrameClassName}>{image}</div>
                ) : image}
                {showTeamNames && (
                    <span className={teamNameClassName}>{team}</span>
                )}
            </div>
        );
    };

    return (
        <div className={className}>
            {showBackgroundIcon && (
                <div className={backgroundIconClassName}>
                    {React.isValidElement(backgroundIcon)
                        ? React.cloneElement(backgroundIcon as React.ReactElement<React.SVGProps<SVGSVGElement>>, { strokeWidth: 1 })
                        : null}
                </div>
            )}
            {renderLogo('home')}
            <div className={clsx(vsClassName)}>VS</div>
            {renderLogo('away')}
        </div>
    );
}

export default memo(SportsTeamLogoOverlay);
