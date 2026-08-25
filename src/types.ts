/**
 * Culture Flow shared types.
 * Structured for readability while remaining backward-compatible with existing JSON.
 */

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

/** Core fields every list card needs */
export type PerformanceCore = {
  id: string;
  title: string;
  date: string;
  venue: string;
  image: string;
  link: string;
  /** Canonical region id preferred (seoul, gyeonggi, ...). Legacy labels still accepted. */
  region: string;
  genre: string;
  source?: string;
};

/** Venue / geo enrichment */
export type PerformanceLocation = {
  venueKey?: string;
  locationKey?: string;
  venueCanonicalId?: string;
  venueHallName?: string;
  address?: string;
  district?: string;
  lat?: number;
  lng?: number;
  /** @deprecated prefer lat/lng */
  latitude?: number | string;
  /** @deprecated prefer lat/lng */
  longitude?: number | string;
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
  parking?: string;
  parkingFee?: string;
  facilities?: string;
  restrooms?: string;
};

/** Pricing / ticketing */
export type PerformancePricing = {
  price?: string;
  originalPrice?: string;
  discount?: string;
  priceList?: { label: string; price: string; discount?: string }[];
  priceDetail?: string;
  reservationInfo?: string;
  bookingNotice?: string;
  reservationRate?: string;
};

/** Creative / production credits */
export type PerformanceCredits = {
  cast?: (string | { name: string; url?: string })[];
  director?: string;
  crew?: string[];
  host?: string;
  organizer?: string;
  planner?: string;
  producer?: string;
  sponsor?: string;
  production?: string;
  contact?: string;
};

/** Media / presentation */
export type PerformanceMedia = {
  description?: string;
  synopsis?: string;
  synopsisImages?: string[];
  trailer?: string;
  stillImages?: string[];
  backupPoster?: string;
  posterUrl?: string;
  poster?: string;
  gradeIcon?: string;
  platforms?: string[];
  tagline?: string;
  keywords?: string[];
};

/** Schedule / status */
export type PerformanceSchedule = {
  dateRaw?: string;
  performanceTime?: string;
  runningTime?: string;
  ageRating?: string;
  age?: string;
  ageDetail?: string;
  openRun?: boolean | string;
  performanceState?: string;
  status?: string;
  operatingHours?: string;
  closedDays?: string;
  targetAudience?: string;
  website?: string;
  instagram?: string;
};

/** Sports-specific */
export type PerformanceSports = {
  homeTeam?: string;
  awayTeam?: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  versusLink?: string;
  highlightsLink?: string;
  bracketRegion?: string;
};

/** Movie / OTT extras */
export type PerformanceMovie = {
  movieInfo?: string;
  originalTitle?: string;
  productionCountry?: string;
  productionYear?: string;
  subGenre?: string;
  voteAverage?: number | string;
  voteCount?: number | string;
  popularity?: number | string;
  audienceCount?: string;
  budget?: number | string;
  revenue?: number | string;
  budgetKRW?: string | number;
  revenueKRW?: string | number;
  roi?: string | number;
  rank?: number;
  statsCollectedAt?: string;
};

/** Discovery / UX helpers */
export type PerformanceDiscovery = {
  category?: string;
  matchedKeyword?: string;
  recommendationReasons?: string[];
  comparisonTags?: string[];
  matchedDiscoveryContexts?: DiscoveryContextId[];
  foodInfo?: string;
  foodVendors?: string[];
  feesAndPrograms?: string;
  sourceUpdatedAt?: string;
  lastModifiedAt?: string;
  dataCollectedAt?: string;
};

/**
 * Full performance record used across scrapers, merge, and UI.
 * Prefer composing partials in new code; this intersection keeps legacy imports working.
 */
export type Performance = PerformanceCore &
  PerformanceLocation &
  PerformancePricing &
  PerformanceCredits &
  PerformanceMedia &
  PerformanceSchedule &
  PerformanceSports &
  PerformanceMovie &
  PerformanceDiscovery;
