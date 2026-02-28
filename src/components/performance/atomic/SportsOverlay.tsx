import React from 'react';
import { FUTURES_TEAM_LOGOS } from '@/lib/constants';
import { getGenreIcon } from '../../GenreIcons';
import { clsx } from 'clsx';

interface SportsOverlayProps {
    genre: string;
    homeTeam?: string;
    homeTeamLogo?: string;
    awayTeam?: string;
    awayTeamLogo?: string;
    size?: 'sm' | 'md' | 'lg';
}

export const SportsOverlay = ({ genre, homeTeam, homeTeamLogo, awayTeam, awayTeamLogo, size = 'md' }: SportsOverlayProps) => {
    if (!['volleyball', 'basketball', 'baseball', 'handball', 'soccer'].includes(genre) || !homeTeam || !awayTeam) return null;

    const isLarge = size === 'lg';
    const isSmall = size === 'sm';

    const hLogo = (genre === 'baseball' && homeTeam && FUTURES_TEAM_LOGOS[homeTeam]) ? FUTURES_TEAM_LOGOS[homeTeam] : homeTeamLogo;
    const aLogo = (genre === 'baseball' && awayTeam && FUTURES_TEAM_LOGOS[awayTeam]) ? FUTURES_TEAM_LOGOS[awayTeam] : awayTeamLogo;

    return (
        <div
            className={clsx(
                "absolute top-1/2 left-0 w-full -translate-y-1/2 flex justify-between items-center pointer-events-none",
                isSmall ? "px-2" : isLarge ? "px-6" : "px-4"
            )}
            style={{
                transform: 'translateZ(25px)',
                zIndex: 'var(--z-card-logo)'
            }}
        >
            {/* Background Decorative Icon */}
            {!isSmall && (
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.06] text-white pointer-events-none z-[-1]">
                    {React.isValidElement(getGenreIcon(genre, isLarge ? 220 : 160)) ?
                        React.cloneElement(getGenreIcon(genre, isLarge ? 220 : 160) as React.ReactElement<React.SVGProps<SVGSVGElement>>, { strokeWidth: 1 }) :
                        null}
                </div>
            )}

            <img
                src={hLogo}
                alt={homeTeam}
                className={clsx(
                    "object-contain drop-shadow-[0_0_15px_rgba(0,0,0,0.5)]",
                    isSmall ? "w-[28%]" : "w-[35%] max-w-[96px]"
                )}
            />

            <div className={clsx(
                "text-white/90 font-black italic bg-black/40 px-2 py-0.5 rounded-full backdrop-blur-[1px] shadow-lg border border-white/10",
                isSmall ? "text-[10px]" : "text-sm md:text-base"
            )}>
                VS
            </div>

            <img
                src={aLogo}
                alt={awayTeam}
                className={clsx(
                    "object-contain drop-shadow-[0_0_15px_rgba(0,0,0,0.5)]",
                    isSmall ? "w-[28%]" : "w-[35%] max-w-[96px]"
                )}
            />
        </div>
    );
};
