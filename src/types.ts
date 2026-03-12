export type Genre = string;

export type Performance = {
    id: string;
    title: string;
    date: string;
    venue: string;
    image: string;
    link: string;
    region: string;
    genre: string;
    description?: string;
    discount?: string;
    originalPrice?: string;
    price?: string;
    gradeIcon?: string;
    cast?: (string | { name: string; url?: string })[];
    director?: string;
    movieInfo?: string;
    homeTeam?: string;
    awayTeam?: string;
    homeTeamLogo?: string;
    awayTeamLogo?: string;
    runningTime?: string;
    ageRating?: string;
    age?: string;
    crew?: string[];
    originalTitle?: string;
    productionCountry?: string;
    productionYear?: string;
    subGenre?: string;
    backupPoster?: string; // Original remote URL for fallback
    posterUrl?: string; // Manual override for missing images
    category?: string; // High-level category override
    poster?: string; // Original remote URL for OTT/Movies
    rank?: number;
    dateRaw?: string; // Original parsed date used for sorting upcoming releases
    lat?: number;
    lng?: number;
    latitude?: number | string;
    longitude?: number | string;
    address?: string;
    district?: string;
    source?: string;
    production?: string;
    versusLink?: string;
    highlightsLink?: string;
    bracketRegion?: string;
    performanceTime?: string;
    host?: string;
    organizer?: string;
    planner?: string;
    producer?: string;
    sponsor?: string;
};
