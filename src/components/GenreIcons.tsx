
import React from 'react';
import { LayoutGrid } from 'lucide-react'; // Default icon

export const FlameIcon = ({ size = 16 }: { size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 10.941c2.333 -3.308 .167 -7.823 -1 -8.941c0 3.395 -2.235 5.299 -3.667 6.706c-1.43 1.408 -2.333 3.621 -2.333 5.588c0 3.704 3.134 6.706 7 6.706s7 -3.002 7 -6.706c0 -1.712 -1.232 -4.403 -2.333 -5.588c-2.084 3.353 -3.257 3.353 -4.667 2.235" />
    </svg>
);

export const MovieIcon = ({ size = 16 }: { size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4m0 2a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z" />
        <path d="M8 4l0 16" /><path d="M16 4l0 16" /><path d="M4 8l4 0" /><path d="M4 16l4 0" /><path d="M4 12l16 0" /><path d="M16 8l4 0" /><path d="M16 16l4 0" />
    </svg>
);

// Musical: Butterfly masks
export const MusicalIcon = ({ size = 16 }: { size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 8.918S9.394 7.74 8 7.5c-1.807-.31-3.833 0-5.5 0c0 0-.371 3.22 0 4.763c.257 1.069.716 2.166 1.5 2.937c.662.65 1.59 1.042 2.5 1.226c1.309.265 2.778.312 4-.226c.64-.282 1.5-1.464 1.5-1.464m0-5.818S14.606 7.74 16 7.5c1.807-.31 3.833 0 5.5 0c0 0 .371 3.22 0 4.763c-.257 1.069-.716 2.166-1.5 2.937c-.662.65-1.59 1.042-2.5 1.226c-1.309.265-2.778.312-4-.226c-.64-.282-1.5-1.464-1.5-1.464" />
        <path d="M9.931 12.25c-.095.756-1.061 1.257-2.157 1.12c-1.097-.139-1.908-.864-1.813-1.62s1.061-1.257 2.158-1.12c1.096.139 1.907.864 1.812 1.62m4.138 0c.095.756 1.061 1.257 2.157 1.12c1.097-.139 1.908-.864 1.813-1.62s-1.061-1.257-2.158-1.12c-1.096.139-1.907.864-1.812 1.62" />
    </svg>
);

// Concert: MicVocal
export const MicVocalIcon = ({ size = 16 }: { size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m11 7.601-5.994 8.19a1 1 0 0 0 .1 1.298l.817.818a1 1 0 0 0 1.314.087L15.09 12" />
        <path d="M16.5 21.174C15.5 20.5 14.372 20 13 20c-2.058 0-3.928 2.356-6 2-2.072-.356-2.775-3.369-1.5-4.5" />
        <circle cx="16" cy="7" r="5" />
    </svg>
);

// Theater: Spotlight
export const DramaIcon = ({ size = 16 }: { size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15.295 19.562 16 22" />
        <path d="m17 16 3.758 2.098" />
        <path d="m19 12.5 3.026-.598" />
        <path d="M7.61 6.3a3 3 0 0 0-3.92 1.3l-1.38 2.79a3 3 0 0 0 1.3 3.91l6.89 3.597a1 1 0 0 0 1.342-.447l3.106-6.211a1 1 0 0 0-.447-1.341z" />
        <path d="M8 9V2" />
    </svg>
);

// Classic: Piano
export const PianoIcon = ({ size = 16 }: { size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10" />
        <path d="M9 19v-6" />
        <path d="M8 5v8h2v-8" />
        <path d="M15 19v-6" />
        <path d="M14 5v8h2v-8" />
    </svg>
);

// Exhibition: Sailboat / Event
export const FanIcon = ({ size = 16 }: { size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 22H2l1.5-9.5c2-.5 6-2.5 8.5-6.5c2.5 4 6.5 6 8.5 6.5zM12 2v4l4.5-2z" />
        <path d="m15.5 22l-2-7.5h-3l-2 7.5" />
    </svg>
);

// Activity/Leisure: Ticket
export const TicketIcon = ({ size = 16 }: { size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 5l0 2" />
        <path d="M15 11l0 2" />
        <path d="M15 17l0 2" />
        <path d="M5 5h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-3a2 2 0 0 0 0 -4v-3a2 2 0 0 1 2 -2" />
    </svg>
);

// Travel: PlaneTilt
export const PlaneTiltIcon = ({ size = 16 }: { size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.5 6.5l3 -2.9a2.05 2.05 0 0 1 2.9 2.9l-2.9 3l2.5 7.5l-2.5 2.55l-3.5 -6.55l-3 3v3l-2 2l-1.5 -4.5l-4.5 -1.5l2 -2h3l3 -3l-6.5 -3.5l2.5 -2.5l7.5 2.5" />
    </svg>
);

// Kids: HorseToy
export const HorseToyIcon = ({ size = 16 }: { size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3.5 17.5c5.667 4.667 11.333 4.667 17 0" />
        <path d="M19 18.5l-2 -8.5l1 -2l2 1l1.5 -1.5l-2.5 -4.5c-5.052 .218 -5.99 3.133 -7 6h-6a3 3 0 0 0 -3 3" />
        <path d="M5 18.5l2 -9.5" />
        <path d="M8 20l2 -5h4l2 5" />
    </svg>
);

// Class icon (kept for backwards compatibility)
export const ClassIcon = ({ size = 16 }: { size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 9l-10 -4l-10 4l10 4l10 -4v6" />
        <path d="M6 10.6v5.4a6 3 0 0 0 12 0v-5.4" />
    </svg>
);

export const FestivalIcon = ({ size = 16 }: { size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 5h2" /><path d="M5 4v2" /><path d="M11.5 4l-.5 2" /><path d="M18 5h2" /><path d="M19 4v2" />
        <path d="M15 9l-1 1" /><path d="M18 13l2 -.5" /><path d="M18 19h2" /><path d="M19 18v2" />
        <path d="M14 16.518l-6.518 -6.518l-4.39 9.58a1 1 0 0 0 1.329 1.329l9.579 -4.39z" />
    </svg>
);

export const VolleyballIcon = ({ size = 16 }: { size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
        <path d="M12 12a8 8 0 0 0 8 4" /><path d="M7.5 13.5a12 12 0 0 0 8.5 6.5" />
        <path d="M12 12a8 8 0 0 0 -7.464 4.928" /><path d="M12.951 7.353a12 12 0 0 0 -9.88 4.111" />
        <path d="M12 12a8 8 0 0 0 -.536 -8.928" /><path d="M15.549 15.147a12 12 0 0 0 1.38 -10.611" />
    </svg>
);

export const BasketballIcon = ({ size = 16 }: { size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
        <path d="M5.65 5.65l12.7 12.7" /><path d="M5.65 18.35l12.7 -12.7" />
        <path d="M12 3a9 9 0 0 0 9 9" /><path d="M3 12a9 9 0 0 1 9 9" />
    </svg>
);

export const BaseballIcon = ({ size = 16 }: { size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5.636 18.364a9 9 0 1 0 12.728 -12.728a9 9 0 0 0 -12.728 12.728z" />
        <path d="M12.495 3.02a9 9 0 0 1 -9.475 9.475" /><path d="M20.98 11.505a9 9 0 0 0 -9.475 9.475" />
        <path d="M9 9l2 2" /><path d="M13 13l2 2" /><path d="M11 7l2 1" /><path d="M7 11l1 2" />
        <path d="M16 11l1 2" /><path d="M11 16l2 1" />
    </svg>
);

export const FootballIcon = ({ size = 16 }: { size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
        <path d="M12 7l4.76 3.45l-1.76 5.55h-6l-1.76 -5.55z" />
        <path d="M12 7v-4m3 13l2.5 3m-.74 -8.55l3.74 -1.45m-11.44 7.05l-2.56 2.95m.74 -8.55l-3.74 -1.45" />
    </svg>
);

// Leisure: Kayak
export const KayakIcon = ({ size = 16 }: { size?: number }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.414 6.414a2 2 0 0 0 0 -2.828l-1.414 -1.414l-2.828 2.828l1.414 1.414a2 2 0 0 0 2.828 0" />
        <path d="M17.586 17.586a2 2 0 0 0 0 2.828l1.414 1.414l2.828 -2.828l-1.414 -1.414a2 2 0 0 0 -2.828 0" />
        <path d="M6.5 6.5l11 11" />
        <path d="M22 2.5c-9.983 2.601 -17.627 7.952 -20 19.5c9.983 -2.601 17.627 -7.952 20 -19.5" />
        <path d="M6.5 12.5l5 5" />
        <path d="M12.5 6.5l5 5" />
    </svg>
);

// Helper to get genre icon
export const getGenreIcon = (id: string, size = 16) => {
    switch (id) {
        case 'hotdeal': return <FlameIcon size={size} />;
        case 'movie': return <MovieIcon size={size} />;
        case 'musical': return <MusicalIcon size={size} />;
        case 'theater': return <DramaIcon size={size} />;
        case 'concert': return <MicVocalIcon size={size} />;
        case 'classic': return <PianoIcon size={size} />;
        case 'exhibition': return <FanIcon size={size} />;
        case 'activity': return <TicketIcon size={size} />;
        case 'class': return <ClassIcon size={size} />;
        case 'travel': return <PlaneTiltIcon size={size} />;
        case 'kids': return <HorseToyIcon size={size} />;
        case 'festival': return <FestivalIcon size={size} />;
        case 'leisure': return <KayakIcon size={size} />;
        case 'volleyball': return <VolleyballIcon size={size} />;
        case 'basketball': return <BasketballIcon size={size} />;
        case 'baseball': return <BaseballIcon size={size} />;
        case 'football': return <FootballIcon size={size} />;
        case 'soccer': return <FootballIcon size={size} />;
        default: return <LayoutGrid size={size} />;
    }
};
