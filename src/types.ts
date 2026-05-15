export type Genre = string;

export type DiscoveryContextId =
    | 'all'
    | 'today'
    | 'this_weekend'
    | 'indoor'
    | 'with_kids'
    | 'date_night'
    | 'under_10000'
    | 'ending_soon';

export type FavoriteVenuePreference = {
    id: string;
    venueName: string;
    venueKey?: string;
    locationKey?: string;
    address?: string;
    lat?: number;
    lng?: number;
};

export type Performance = {
    id: string;
    title: string;
    date: string;
    venue: string;
    venueKey?: string;
    locationKey?: string;
    venueCanonicalId?: string;
    venueHallName?: string;
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
    contact?: string;
    reservationInfo?: string;
    priceList?: { label: string; price: string; discount?: string }[];
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
    sourceUpdatedAt?: string;
    instagram?: string;
    foodInfo?: string;
    foodVendors?: string[];
    reservationRate?: string;
    audienceCount?: string;
    budget?: number | string;
    revenue?: number | string;
    budgetKRW?: string | number;
    revenueKRW?: string | number;
    roi?: string | number;
    synopsis?: string;
    synopsisImages?: string[];
    trailer?: string;
    status?: string;
    statsCollectedAt?: string;
    matchedKeyword?: string;
    recommendationReasons?: string[];
    comparisonTags?: string[];
    matchedDiscoveryContexts?: DiscoveryContextId[];
    openRun?: boolean | string;
    performanceState?: string;
    lastModifiedAt?: string;
    dataCollectedAt?: string;
    venuePhone?: string;
    venueHomepage?: string;
    venueFacilityType?: string;
    venueSeatScale?: string | number;
    venueTheaterCount?: string | number;
    venueOpenedAt?: string;
    venueAmenities?: string[];
    placeProvider?: string;
    placeId?: string;
    placeUrl?: string;
    placeCategory?: string;
    platforms?: string[];
    stillImages?: string[];
    keywords?: string[];
    tagline?: string;
    voteAverage?: number | string;
    voteCount?: number | string;
    popularity?: number | string;
};
