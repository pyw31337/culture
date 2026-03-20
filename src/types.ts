export type Genre = string;

export interface BasePerformance {
    id: string;
    title: string;
    date: string;
    venue: string;
    image: string;
    link: string;
    region: string;
    genre: Genre;
    description?: string;
    discount?: string;
    originalPrice?: string;
    price?: string;
    grade?: string;
    gradeIcon?: string;
    lat?: number;
    lng?: number;
    latitude?: number | string;
    longitude?: number | string;
    address?: string;
    district?: string;
    source?: string;
    backupPoster?: string;
    posterUrl?: string;
    category?: string;
    poster?: string;
    rank?: number;
    dateRaw?: string;
    status?: string;
    priceList?: { label: string; price: string; discount?: string }[];
    bracketRegion?: string;
    
    // Shared metadata across different scrapers
    ageRating?: string;
    age?: string;
    ageDetail?: string;
    operatingHours?: string;
    performanceTime?: string;
    priceDetail?: string;
    closedDays?: string;
    contact?: string;
    website?: string;
    parking?: string;
    parkingFee?: string;
    facilities?: string;
    restrooms?: string;
    petFriendly?: string;
    feesAndPrograms?: string;
    bookingNotice?: string;
    
    // Organization / Production
    host?: string;
    organizer?: string;
    planner?: string;
    producer?: string;
    sponsor?: string;
    production?: string;
    
    // Movie specific
    originalTitle?: string;
    synopsis?: string;
    reservationRate?: string;
    audienceCount?: string;
    runtime?: number | string;
    director?: string;
    cast?: (string | { name: string; url?: string })[];
    crew?: string[];
    subGenre?: string;
    
    // Sports specific
    homeTeam?: string;
    awayTeam?: string;
    homeTeamLogo?: string;
    awayTeamLogo?: string;
    versusLink?: string;
    highlightsLink?: string;
}

export interface MoviePerformance extends BasePerformance {
    genre: 'movie';
}

export interface SportsPerformance extends BasePerformance {
    genre: 'sports' | 'baseball' | 'football' | 'basketball' | 'volleyball' | 'soccer';
    homeTeam?: string;
    awayTeam?: string;
    homeTeamLogo?: string;
    awayTeamLogo?: string;
    versusLink?: string;
    highlightsLink?: string;
}

export interface ClassPerformance extends BasePerformance {
    genre: 'class';
    platforms?: { name: string; url?: string }[];
}

export interface MuseumPerformance extends BasePerformance {
    genre: 'exhibition' | 'museum';
}

export type Performance = MoviePerformance | SportsPerformance | ClassPerformance | MuseumPerformance | BasePerformance;
