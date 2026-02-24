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
    platforms?: string[];
    cast?: (string | { name: string; url?: string })[];
    director?: string;
    movieInfo?: string;
    homeTeam?: string;
    awayTeam?: string;
    homeTeamLogo?: string;
    awayTeamLogo?: string;
    runningTime?: string;
    ageRating?: string;
    originalTitle?: string;
    productionCountry?: string;
    productionYear?: string;
    subGenre?: string;
    backupPoster?: string; // Original remote URL for fallback
    posterUrl?: string; // Manual override for missing images
    category?: string; // High-level category override
    poster?: string; // Original remote URL for OTT/Movies
};
