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
}

export interface MoviePerformance extends BasePerformance {
    genre: 'movie';
    ageRating?: string;
    subGenre?: string;
    runningTime?: string;
    director?: string;
    originalTitle?: string;
    productionCountry?: string;
    productionYear?: string;
    movieInfo?: string;
    crew?: string[];
    cast?: (string | { name: string; url?: string })[];
    castWithLinks?: { name: string; url?: string }[];
    synopsis?: string;
    synopsisImages?: string[];
    trailer?: string;
    budget?: number | string;
    revenue?: number | string;
    budgetKRW?: string | number;
    revenueKRW?: string | number;
    roi?: string | number;
    reservationRate?: string;
    audienceCount?: string;
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
    cast?: (string | { name: string; url?: string })[];
    castWithLinks?: { name: string; url?: string }[];
    platforms?: { name: string; url?: string }[];
    production?: string;
    host?: string;
    organizer?: string;
    planner?: string;
    producer?: string;
    sponsor?: string;
    contact?: string;
    ageDetail?: string;
    bookingNotice?: string;
    website?: string;
    parking?: string;
    parkingFee?: string;
    facilities?: string;
    restrooms?: string;
    targetAudience?: string;
    operatingHours?: string;
    priceDetail?: string;
    closedDays?: string;
    feesAndPrograms?: string;
    petFriendly?: string;
}

export interface MuseumPerformance extends BasePerformance {
    genre: 'exhibition' | 'museum';
    operatingHours?: string;
    closedDays?: string;
    feesAndPrograms?: string;
}

export type Performance = MoviePerformance | SportsPerformance | ClassPerformance | MuseumPerformance | BasePerformance;
