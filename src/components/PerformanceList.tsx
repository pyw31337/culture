'use client';
// UI Deployment Trigger: 2026-01-12


import Link from 'next/link';
import { useState, useMemo, useEffect, useRef } from 'react';
import { Performance } from '@/types';
import { Share2, Link2, Check, Search, MapPin, Calendar, Menu, X, Filter, ChevronDown, List, LayoutGrid, LayoutList, Heart, Flame, Star, Bell, RotateCw, RotateCcw, Map as MapIcon, ChevronUp, Plane, CalendarDays, Navigation, ChevronRight, Tag, Home } from 'lucide-react';
import ImageWithFallback from './ImageWithFallback'; // Import the new component
import BuildingStadium from './BuildingStadium';
import { clsx } from 'clsx';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import venueData from '@/data/venues.json';
import { GENRES, GENRE_STYLES, REGIONS, NATIONWIDE_REGIONS, RADIUS_OPTIONS, OTT_PLATFORMS, FUTURES_TEAM_LOGOS } from '@/lib/constants';
import { getOptimizedUrl } from '@/lib/utils'; // Import centralized helper
import { safeStorage } from '@/lib/safeStorage';
import { motion, AnimatePresence } from 'framer-motion';
import LZString from 'lz-string';
import Portal from './ui/Portal';
import BottomNav, { BottomMenuType } from './BottomNav';
import BottomNavSheet from './BottomNavSheet';
import { getGenreIcon } from '@/components/GenreIcons';
import { isChoseongMatch } from '@/lib/hangul'; // Choseong Search Utility
import { useUserActivity } from '@/hooks/useUserActivity';
import { useRecommendation } from '@/hooks/useRecommendation';
import RecommendedSection from './performance/RecommendedSection';


const KakaoMapModal = dynamic(() => import('./KakaoMapModal'), { ssr: false });
const CalendarModal = dynamic(() => import('./CalendarModal'), { ssr: false });
const PerformanceDetailModal = dynamic(() => import('./PerformanceDetailModal'), { ssr: false });
const FavoriteVenuesModal = dynamic(() => import('./FavoriteVenuesModal'), { ssr: false });
import { useSearchParams, useRouter } from 'next/navigation';
import HeroSection from './performance/HeroSection';

import SkeletonGrid from './performance/SkeletonGrid';
import PerformanceGrid from './performance/PerformanceGrid';
import EmptyState from './performance/EmptyState';
import PerformanceCard from './performance/PerformanceCard';
import PerformanceListItem from './performance/PerformanceListItem';
import { getDistanceFromLatLonInKm } from '@/lib/utils';
import ErrorBoundary from './ErrorBoundary';
import { HERO_TEMPLATES, HeroTemplate } from '@/lib/hero-templates';

interface Venue {
    name: string;
    address: string;
    district?: string;
    lat?: number;
    lng?: number;
}

const venues = venueData as Record<string, Venue>;

interface PerformanceListProps {
    initialPerformances: Performance[];
    lastUpdated: string;
    initialGenre?: string; // Pre-selected genre from URL
    isCategoryPage?: boolean; // Is this a category-specific page
    categoryLabel?: string; // Label for the category page
}


// --- Text Templates for Hero Section ---
// Structure:
// Line 1: line1
// Line 2: line2Pre + <Highlight> + suffix

export default function PerformanceList({ initialPerformances, lastUpdated, initialGenre = 'all', isCategoryPage = false, categoryLabel }: PerformanceListProps) {



    const [selectedRegion, setSelectedRegion] = useState<string>('all');
    const [selectedDistrict, setSelectedDistrict] = useState<string>('all');
    const [selectedVenue, setSelectedVenue] = useState<string>('all');
    const [selectedGenre, setSelectedGenre] = useState<string>(initialGenre);
    const [isLikesExpanded, setIsLikesExpanded] = useState(true);
    const [isStorageLoaded, setIsStorageLoaded] = useState(false); // Guard against overwriting LS

    // Hero Text State (Hydration Safe: Start with Default, then randomize)
    const [heroText, setHeroText] = useState<HeroTemplate>(HERO_TEMPLATES.general[0]);
    // Random seed for default view shuffling
    const [shuffleSeed, setShuffleSeed] = useState<number | null>(null);

    useEffect(() => {
        setShuffleSeed(Math.random());
    }, []);





    const [contextKeywords, setContextKeywords] = useState<string[]>([]);

    // 🧠 Recommendation Engine Logic




    // Bottom Navigation State
    const [activeBottomMenu, setActiveBottomMenu] = useState<BottomMenuType>(null);
    const [viewMode, setViewMode] = useState<string>('grid'); // 'list' | 'grid' | 'calendar' | 'map' | 'likes-perf' | 'likes-venue'
    const [isMapOpen, setIsMapOpen] = useState(false); // Map Modal State

    // Debug Logging
    // Debug logging moved to end of logic chain

    // Debug logging moved to end of logic chain

    // Alarm Panel State
    const [isAlarmOpen, setIsAlarmOpen] = useState(false);
    const [keywordInput, setKeywordInput] = useState('');
    const [savedKeywords, setSavedKeywords] = useState<string[]>([]); // User-saved keywords (persisted)

    // Like & Venue State (Moved to top for scope access)
    const [likedIds, setLikedIds] = useState<string[]>([]);
    const [showLikes, setShowLikes] = useState(true);
    const [favoriteVenues, setFavoriteVenues] = useState<string[]>([]);
    const [isFavoriteVenuesModalOpen, setIsFavoriteVenuesModalOpen] = useState(false);
    const [isFavoriteVenuesExpanded, setIsFavoriteVenuesExpanded] = useState(true);
    const [showFavoriteVenues, setShowFavoriteVenues] = useState(true);
    const [isHeroVisible, setIsHeroVisible] = useState(true); // Track visibility for pausing animation
    const [isInitialLoading, setIsInitialLoading] = useState(true); // Initial content loading state

    // Detail Modal State & Deep Linking
    const [selectedPerformance, setSelectedPerformance] = useState<Performance | null>(null);
    const searchParams = useSearchParams();
    const router = useRouter();

    // 🧠 Recommendation Engine Logic
    const { trackGenreView, trackItemView } = useUserActivity();
    const { recommendedItems } = useRecommendation({
        allPerformances: initialPerformances,
        likedIds,
        recentSearches: savedKeywords
    });

    // Track initial genre
    useEffect(() => {
        if (selectedGenre !== 'all') {
            trackGenreView(selectedGenre);
        }
    }, [selectedGenre]);
    // Deep Linking Effect
    useEffect(() => {
        if (!initialPerformances || initialPerformances.length === 0) return;

        const id = searchParams.get('id');
        if (id) {
            const target = initialPerformances.find(p => p.id === id);
            if (target) {
                setSelectedPerformance(target);
                // Optional: Scroll to card? Maybe just showing modal is enough.
            }
        }
    }, [searchParams, initialPerformances]);

    // Modal Handlers
    const handleDetailOpen = (perf: Performance) => {
        window.open(perf.link, '_blank');
    };

    const handleDetailClose = () => {
        setSelectedPerformance(null);
        // Remove ID from URL
        // const newUrl = new URL(window.location.href);
        // newUrl.searchParams.delete('id');
        // window.history.pushState({}, '', newUrl.toString());
    };

    const handleBooking = (link: string) => {
        window.open(link, '_blank');
    };

    const handleCopyLink = (id: string) => {
        const url = `${window.location.origin}${window.location.pathname}?id=${id}`;
        navigator.clipboard.writeText(url).then(() => {
            alert('공유 링크가 복사되었습니다!');
        });
    };

    // Intersection Observer for Hero Section & Scroll Monitoring
    const heroRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsHeroVisible(entry.isIntersecting);
            },
            { threshold: 0 } // Any part visible = visible. Fully hidden = paused.
        );

        if (heroRef.current) {
            observer.observe(heroRef.current);
        }

        // Scroll Listener to enforce pausing more strictly when scrolled down
        // (IntersectionObserver is good, but scroll offset check adds immediate responsiveness)
        const handleScroll = () => {
            if (window.scrollY > 150) { // If scrolled down past potential hero height
                setIsHeroVisible(false);
            } else {
                if (heroRef.current) {
                    // Re-check visibility or just assume visible if at top
                    // We let Observer handle the "appearing" logic, but force "disappearing" on scroll
                    setIsHeroVisible(true);
                }
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });

        return () => {
            observer.disconnect();
            window.removeEventListener('scroll', handleScroll);
        };
    }, []);

    // Template Pool & Selector System
    const templatePoolRef = useRef<HeroTemplate[]>([]);

    const selectNextTemplate = () => {
        const pool = templatePoolRef.current.length > 0 ? templatePoolRef.current : HERO_TEMPLATES.general;
        let selectedTemplate: HeroTemplate = HERO_TEMPLATES.general[0];
        let attempts = 0;
        const maxAttempts = 20;

        while (pool.length > 0 && attempts < maxAttempts) {
            const idx = Math.floor(Math.random() * pool.length);
            const candidate = pool[idx];
            attempts++;

            if (candidate.line1 === heroText.line1) continue;

            // Validate: If template has keywords, at least one must yield results
            if (candidate.keywords && candidate.keywords.length > 0) {
                const hasMatch = initialPerformances.some(p =>
                    candidate.keywords!.some(k =>
                        (p.title || '').includes(k) ||
                        (p.genre || '').includes(k) ||
                        (p.venue || '').includes(k) ||
                        (venues[p.venue || '']?.district?.includes(k))
                    )
                );

                if (!hasMatch) {
                    continue;
                }
            }

            selectedTemplate = candidate;
            break;
        }

        // Fail-safe: If loop exhausts, force a random general template DIFFERENT from current
        if (selectedTemplate === heroText || attempts >= maxAttempts) {
            const backups = HERO_TEMPLATES.general.filter(t => t.line1 !== heroText.line1);
            selectedTemplate = backups[Math.floor(Math.random() * backups.length)] || HERO_TEMPLATES.general[0];
        }

        setHeroText(selectedTemplate);
    };


    // Sync contextKeywords with heroText whenever heroText changes
    // This ensures sorting always uses the current hero's keywords
    useEffect(() => {
        if (heroText.keywords && heroText.keywords.length > 0) {
            setContextKeywords(heroText.keywords);
        }
    }, [heroText]);

    // Cycle Handler for Typing Effect
    const handleHeroCycle = () => {
        // Prevent duplicate immediate text
        selectNextTemplate();
    };

    // Context-Aware Hero Text Initialization
    useEffect(() => {
        const updateHeroText = async () => {
            const now = new Date();
            const month = now.getMonth() + 1; // 1-12
            const date = now.getDate();
            const day = now.getDay(); // 0(Sun) - 6(Sat)
            const hour = now.getHours();

            let pool: typeof HERO_TEMPLATES.general = [...HERO_TEMPLATES.general];

            // 1. Holiday Check (High Priority)
            // Fixed Dates
            if (month === 1 && date === 1) pool.push(...HERO_TEMPLATES.holiday.newYear);
            if (month === 2 && date === 14) pool.push(...HERO_TEMPLATES.holiday.valentine);
            if (month === 3 && date === 1) pool.push(...HERO_TEMPLATES.holiday.samil);
            if (month === 5 && date === 5) pool.push(...HERO_TEMPLATES.holiday.children);
            if (month === 10 && date === 31) pool.push(...HERO_TEMPLATES.holiday.halloween);
            if (month === 12 && (date >= 23 && date <= 25)) pool.push(...HERO_TEMPLATES.holiday.christmas);
            if (month === 12 && (date >= 26 && date <= 31)) pool.push(...HERO_TEMPLATES.holiday.yearEnd);

            // Lunar Dates (2025 Specific Approximation)
            // Seollal 2025: 1.28 - 1.30
            if (month === 1 && (date >= 28 && date <= 30)) pool.push(...HERO_TEMPLATES.holiday.seollal);
            // Chuseok 2025: 10.5 - 10.8
            // Chuseok 2025: 10.5 - 10.8
            if (month === 10 && (date >= 5 && date <= 8)) pool.push(...HERO_TEMPLATES.holiday.chuseok);

            // 1.5 Genre Availability Check (Contextual Promotion)
            // Check if specific genres exist in the current list to promote them
            // Logic: If we have > 0 items of a genre, add its templates to pool
            // Travel (Always check)
            if (initialPerformances.some(p => p.genre === 'travel')) {
                // High priority for travel if near weekend (Fri/Sat)
                const weight = (day === 5 || day === 6) ? 2 : 1;
                for (let i = 0; i < weight; i++) pool.push(...HERO_TEMPLATES.genre.travel);
            }
            // Sports (Check for matches)
            if (initialPerformances.some(p => p.genre === 'volleyball')) pool.push(...HERO_TEMPLATES.genre.volleyball);
            if (initialPerformances.some(p => p.genre === 'basketball')) pool.push(...HERO_TEMPLATES.genre.basketball);
            if (initialPerformances.some(p => p.genre === 'soccer')) pool.push(...HERO_TEMPLATES.genre.soccer);
            if (initialPerformances.some(p => p.genre === 'baseball')) pool.push(...HERO_TEMPLATES.genre.baseball);
            if (initialPerformances.some(p => p.genre === 'handball')) pool.push(...HERO_TEMPLATES.genre.handball);
            if (initialPerformances.some(p => p.genre === 'hockey')) pool.push(...HERO_TEMPLATES.genre.hockey);

            // Arts & Lifestyle
            // Randomly promote genres to diversify (20% chance each to add to pool if available)
            if (Math.random() > 0.3) {
                if (initialPerformances.some(p => p.genre === 'musical')) pool.push(...HERO_TEMPLATES.genre.musical);
                if (initialPerformances.some(p => p.genre === 'play')) pool.push(...HERO_TEMPLATES.genre.play);
                if (initialPerformances.some(p => p.genre === 'classical')) pool.push(...HERO_TEMPLATES.genre.classical);
                if (initialPerformances.some(p => p.genre === 'exhibition')) pool.push(...HERO_TEMPLATES.genre.exhibition);
                if (initialPerformances.some(p => p.genre === 'kids')) pool.push(...HERO_TEMPLATES.genre.kids);

                // New Genres
                if (initialPerformances.some(p => p.genre === 'movie')) pool.push(...HERO_TEMPLATES.genre.movie);
                if (initialPerformances.some(p => p.genre === 'ott')) pool.push(...HERO_TEMPLATES.genre.ott);
                if (initialPerformances.some(p => p.genre === 'hotdeal')) pool.push(...HERO_TEMPLATES.genre.hotdeal);
                if (initialPerformances.some(p => p.genre === 'class')) pool.push(...HERO_TEMPLATES.genre.class);
                if (initialPerformances.some(p => p.genre === 'activity')) pool.push(...HERO_TEMPLATES.genre.activity);
                if (initialPerformances.some(p => p.genre === 'festival')) pool.push(...HERO_TEMPLATES.genre.festival);
                if (initialPerformances.some(p => p.genre === 'leisure')) pool.push(...HERO_TEMPLATES.genre.leisure);
            }

            // 2. Keyword Check
            const savedKeywords: string[] = safeStorage.get<string[]>('culture_keywords', []);
            if (savedKeywords.length > 0) {
                // Add keyword templates (weight: higher)
                const keywordTemplates = HERO_TEMPLATES.keyword.map(t => {
                    const randomKeyword = savedKeywords[Math.floor(Math.random() * savedKeywords.length)];
                    return {
                        ...t,
                        highlight: t.highlight.replace('{keyword}', randomKeyword),
                        keywords: t.keywords.map(k => k.replace('{keyword}', randomKeyword)) // Fix: Replace keyword in array too
                    };
                });
                for (let i = 0; i < 3; i++) pool.push(...keywordTemplates);
            }

            // Always ensure general templates are in the pool for fallback
            if (pool.filter(t => t.keywords.length === 0).length === 0) {
                pool.push(...HERO_TEMPLATES.general);
            }

            // 3. Time/Day Context
            // Friday
            if (day === 5) {
                for (let i = 0; i < 2; i++) pool.push(...HERO_TEMPLATES.time.friday);
            }
            // Evening (After 16:00)
            if (hour >= 16) {
                for (let i = 0; i < 2; i++) pool.push(...HERO_TEMPLATES.time.evening);
            }

            // 4. Season Context
            let currentSeasonTemplates: typeof HERO_TEMPLATES.general = [];
            if (month >= 3 && month <= 5) currentSeasonTemplates = HERO_TEMPLATES.season.spring;
            else if (month >= 6 && month <= 8) currentSeasonTemplates = HERO_TEMPLATES.season.summer;
            else if (month >= 9 && month <= 11) currentSeasonTemplates = HERO_TEMPLATES.season.autumn;
            else currentSeasonTemplates = HERO_TEMPLATES.season.winter;

            // Add season templates (Weight: Normal)
            pool.push(...currentSeasonTemplates);


            // 5. Weather Check (Async) - with timeout to prevent blocking
            try {
                // 30% chance to consider weather heavily
                if (Math.random() < 0.3) {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
                    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780&current_weather=true', {
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);
                    const data = await res.json();
                    const code = data.current_weather?.weathercode;

                    let weatherType: 'rain' | 'snow' | 'clear' | null = null;
                    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) weatherType = 'rain';
                    else if ([71, 73, 75, 77, 85, 86].includes(code)) weatherType = 'snow';
                    else if (code === 0 || code === 1) weatherType = 'clear';

                    if (weatherType && HERO_TEMPLATES.weather[weatherType]) {
                        // If rain/snow, VERY high priority (add 5 times)
                        const weight = (weatherType === 'rain' || weatherType === 'snow') ? 5 : 2;
                        for (let i = 0; i < weight; i++) pool.push(...HERO_TEMPLATES.weather[weatherType]);
                    }
                }
            } catch (e) {
                // Silently ignore weather fetch failures (network issues, timeout, etc.)
                console.log("Weather fetch failed (ignoring).");
            }

            // 6. Location Context (District/Venue) - New!
            // Pick a random performance to promote its location
            if (initialPerformances.length > 0) {
                // Filter specifically for Seoul, Gyeonggi, Incheon events to promote local context
                const targetPerformances = initialPerformances.filter(p => ['seoul', 'gyeonggi', 'incheon'].includes(p.region));
                const candidates = targetPerformances.length > 0 ? targetPerformances : initialPerformances;

                // Try 3 times to find a suitable location candidate
                for (let i = 0; i < 3; i++) {
                    const randomPerf = candidates[Math.floor(Math.random() * candidates.length)];
                    const v = venues[randomPerf.venue];

                    // Candidate strings: District or Venue Name
                    const locationCandidates: string[] = [];
                    if (v && v.district) locationCandidates.push(v.district);
                    if (randomPerf.venue) locationCandidates.push(randomPerf.venue);

                    // Pick one location (District preferred if available and brief, else Venue)
                    let chosenLocation = locationCandidates.length > 0 ? locationCandidates[0] : null;

                    // Strict Blocklist for Non-Metropolitan Areas (Leaked Data)
                    const BLOCKED_REGIONS = ['부산', '대구', '대전', '광주', '울산', '창원', '경상', '전라', '충청', '강원'];
                    if (chosenLocation && BLOCKED_REGIONS.some(region => chosenLocation!.includes(region))) {
                        chosenLocation = null;
                    }

                    if (chosenLocation) {
                        const genreLabel = GENRES.find(g => g.id === randomPerf.genre)?.label || "공연";

                        // Map location templates
                        const locTemplates = HERO_TEMPLATES.location.map(t => ({
                            ...t,
                            line1: t.line1.replace('{location}', chosenLocation),
                            line2Pre: t.line2Pre.replace('{location}', chosenLocation),
                            highlight: t.highlight.replace('{genre}', genreLabel),
                            keywords: [
                                ...t.keywords.map(k => k.replace('{location}', chosenLocation)),
                                genreLabel,
                                randomPerf.genre
                            ]
                        }));

                        pool.push(...locTemplates);
                    }
                }
            }

            // Save pool to ref for cycling
            templatePoolRef.current = pool;

            // Initial Selection
            selectNextTemplate();
        };

        updateHeroText();
    }, []);

    // Debug Data Availability
    useEffect(() => {
        // console.log(`[PerformanceList] Initial Count: ${initialPerformances.length}, Last Updated: ${lastUpdated}`);
    }, [initialPerformances, lastUpdated]);

    // Search State
    const [searchText, setSearchText] = useState('');
    const [debouncedSearchText, setDebouncedSearchText] = useState(''); // Debounced value
    const [searchLocation, setSearchLocation] = useState<{ lat: number, lng: number, name: string } | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]); // New: Store multiple results
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);   // New: Dropdown visibility
    const [activeSearchSource, setActiveSearchSource] = useState<'hero' | 'sticky'>('hero'); // New: Track active input
    const [isSdkLoaded, setIsSdkLoaded] = useState(false);         // New: Track SDK Load Status
    const [highlightedIndex, setHighlightedIndex] = useState(-1);  // New: Keyboard Navigation

    // Search History State
    const [recentSearches, setRecentSearches] = useState<string[]>([]);

    // Load recent searches
    useEffect(() => {
        if (!isStorageLoaded) return;
        setRecentSearches(safeStorage.get<string[]>('culture_recent_searches', []));
    }, [isStorageLoaded]);

    const addRecentSearch = (term: string) => {
        if (!term.trim()) return;
        setRecentSearches(prev => {
            const updated = [term.trim(), ...prev.filter(t => t !== term.trim())].slice(0, 10);
            safeStorage.set('culture_recent_searches', updated);
            return updated;
        });
    };

    const removeRecentSearch = (term: string) => {
        setRecentSearches(prev => {
            const updated = prev.filter(t => t !== term);
            safeStorage.set('culture_recent_searches', updated);
            return updated;
        });
    };

    const clearRecentSearches = () => {
        setRecentSearches([]);
        safeStorage.set('culture_recent_searches', []);
    };

    // Keyword Notification System (kept as is)
    const [keywords, setKeywords] = useState<string[]>([]);
    const [showKeywordInput, setShowKeywordInput] = useState(false);
    const [newKeyword, setNewKeyword] = useState('');

    useEffect(() => {
        // Consolidated Loader for all LocalStorage items (using safeStorage for SSR safety)
        setSavedKeywords(safeStorage.get<string[]>('culture_keywords', []));
        setLikedIds(safeStorage.get<string[]>('culture_likes', []));
        setFavoriteVenues(safeStorage.get<string[]>('culture_favorite_venues', []));
        setIsLikesExpanded(safeStorage.get<boolean>('culture_likes_expanded', true));
        setIsFavoriteVenuesExpanded(safeStorage.get<boolean>('culture_venues_expanded', true));
        setShowFavoriteVenues(safeStorage.get<boolean>('culture_show_favorite_venues', true));
        setShowLikes(safeStorage.get<boolean>('culture_show_likes', true));
        setViewMode(safeStorage.get<string>('culture_view_mode', 'grid'));

        setIsStorageLoaded(true);
        // Delay to allow content to render before removing skeleton
        setTimeout(() => setIsInitialLoading(false), 100);

        // Check for Kakao SDK availability
        const checkSdk = setInterval(() => {
            if (window.kakao && window.kakao.maps) {
                setIsSdkLoaded(true);
                clearInterval(checkSdk);
            }
        }, 500);
        return () => clearInterval(checkSdk);
    }, []);

    useEffect(() => {
        if (!isStorageLoaded) return;
        safeStorage.set('culture_keywords', savedKeywords);
    }, [savedKeywords, isStorageLoaded]);

    useEffect(() => {
        if (!isStorageLoaded) return;
        safeStorage.set('culture_show_favorite_venues', showFavoriteVenues);
    }, [showFavoriteVenues, isStorageLoaded]);

    useEffect(() => {
        if (!isStorageLoaded) return;
        safeStorage.set('culture_show_likes', showLikes);
    }, [showLikes, isStorageLoaded]);

    useEffect(() => {
        if (!isStorageLoaded) return;
        safeStorage.set('culture_view_mode', viewMode);
    }, [viewMode, isStorageLoaded]);

    const addKeyword = () => {
        if (!newKeyword.trim()) return;
        if (keywords.length >= 5) {
            alert("키워드는 최대 5개까지 설정 가능합니다.");
            return;
        }
        if (keywords.includes(newKeyword.trim())) {
            alert("이미 등록된 키워드입니다.");
            return;
        }
        setKeywords([...keywords, newKeyword.trim()]);
        setNewKeyword('');
    };

    const removeKeyword = (k: string) => {
        setKeywords(keywords.filter(key => key !== k));
    };

    // Like System State
    // Like System State
    // [State moved to top]

    // Persist Likes Expanded State
    useEffect(() => {
        if (!isStorageLoaded) return;
        safeStorage.set('culture_likes_expanded', isLikesExpanded);
    }, [isLikesExpanded, isStorageLoaded]);

    // Load Likes Expanded State (Removed - handled by consolidated loader)
    // Load Likes from LocalStorage (Removed - handled by consolidated loader)

    // Save Likes to LocalStorage
    // Save Likes to LocalStorage
    useEffect(() => {
        if (!isStorageLoaded) return;
        safeStorage.set('culture_likes', likedIds);
    }, [likedIds, isStorageLoaded]);

    const toggleLike = (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setLikedIds(prev =>
            prev.includes(id) ? prev.filter(lid => lid !== id) : [...prev, id]
        );
    };

    const likedPerformances = useMemo(() => {
        return initialPerformances.filter(p => likedIds.includes(p.id));
    }, [initialPerformances, likedIds]);

    // Favorite Venues State
    // Favorite Venues State
    // [State moved to top]

    // Initial Load for Favorite Venues Expanded State
    // Initial Load for Favorite Venues Expanded State (Removed - handled by consolidated loader)

    // Persist Favorite Venues Expanded State
    useEffect(() => {
        if (!isStorageLoaded) return;
        safeStorage.set('culture_venues_expanded', isFavoriteVenuesExpanded);
    }, [isFavoriteVenuesExpanded, isStorageLoaded]);

    // [State moved to top]
    const [showFavoriteListModal, setShowFavoriteListModal] = useState(false); // Controls List Modal visibility
    const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid'); // Default to Grid (Thumbnail) view

    // Sync layoutMode when viewMode changes to grid or list
    useEffect(() => {
        if (viewMode === 'grid' || viewMode === 'list') {
            setLayoutMode(viewMode);
        }
    }, [viewMode]);

    const [shareUrlCopied, setShareUrlCopied] = useState(false); // Share URL copy feedback
    const [sharedPerformanceId, setSharedPerformanceId] = useState<string | null>(null); // Shared Item ID

    // NEW: Notification System for New Keyword Matches
    const [newMatches, setNewMatches] = useState<Performance[]>([]);
    const [showNewMatchesModal, setShowNewMatchesModal] = useState(false);

    useEffect(() => {
        if (!isStorageLoaded || keywords.length === 0) return;

        // 1. Find all current matches
        const currentMatches = initialPerformances.filter(p =>
            keywords.some(k => p.title.toLowerCase().includes(k.toLowerCase()) || (p.venue || '').toLowerCase().includes(k.toLowerCase()))
        );

        if (currentMatches.length === 0) return;

        // 2. Load Seen IDs
        const seenIds: string[] = safeStorage.get<string[]>('culture_seen_keyword_matches', []);

        // 3. Identify truly new items
        const newItems = currentMatches.filter(p => !seenIds.includes(p.id));

        if (newItems.length > 0) {
            setNewMatches(newItems);
            setShowNewMatchesModal(true);
        }
    }, [initialPerformances, keywords, isStorageLoaded]);

    const handleCloseNotification = () => {
        // Mark checked items as seen
        const seenIds: string[] = safeStorage.get<string[]>('culture_seen_keyword_matches', []);
        const newIds = newMatches.map(p => p.id);
        const updatedSeenIds = Array.from(new Set([...seenIds, ...newIds]));

        safeStorage.set('culture_seen_keyword_matches', updatedSeenIds);
        setShowNewMatchesModal(false);
        setNewMatches([]);
    };

    // Share Item URL Generation (Kakao Share Integration)
    const copyItemShareUrl = async (id: string): Promise<boolean> => {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
        const url = `${baseUrl}#p=${id}`;

        let clipboardSuccess = false;

        // 1. Always try Clipboard Copy first
        try {
            await navigator.clipboard.writeText(url);
            setShareUrlCopied(true);
            setTimeout(() => setShareUrlCopied(false), 2000);
            clipboardSuccess = true;
        } catch (err) {
            console.error('Failed to copy URL:', err);
            // Fallback for older browsers
            try {
                const textArea = document.createElement('textarea');
                textArea.value = url;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                setShareUrlCopied(true);
                setTimeout(() => setShareUrlCopied(false), 2000);
                clipboardSuccess = true;
            } catch (fallbackErr) {
                console.error('Fallback copy failed:', fallbackErr);
            }
        }

        // 2. Try Kakao Share (Simultaneously)
        if (typeof window !== 'undefined' && (window as any).Kakao) {
            if (!(window as any).Kakao.isInitialized()) {
                (window as any).Kakao.init('0236cfffa7cfef34abacd91a6d7c73c0');
            }
            const perf = initialPerformances.find(p => p.id === id);
            if (perf) {
                (window as any).Kakao.Share.sendDefault({
                    objectType: 'feed',
                    content: {
                        title: perf.title,
                        description: `${perf.date} | ${perf.venue}`,
                        imageUrl: perf.image,
                        link: {
                            mobileWebUrl: url,
                            webUrl: url,
                        },
                    },
                    buttons: [
                        {
                            title: '공연 상세 보기',
                            link: {
                                mobileWebUrl: url,
                                webUrl: url,
                            },
                        },
                    ],
                });
            }
        }

        // Return true if clipboard copy succeeded (to show local toast)
        // Even if Kakao launched, user wants clipboard copy, so showing "Copied" is appropriate now.
        return clipboardSuccess;
    };

    // Share URL Generation
    const generateShareUrl = () => {
        const shareData = {
            l: likedIds,      // liked performance IDs
            v: favoriteVenues, // favorite venue names
            k: keywords        // keywords
        };
        const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(shareData));
        const baseUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
        return `${baseUrl}#s=${compressed}`;
    };

    const copyShareUrl = async () => {
        const url = generateShareUrl();
        try {
            await navigator.clipboard.writeText(url);
            setShareUrlCopied(true);
            setTimeout(() => setShareUrlCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy URL:', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = url;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            setShareUrlCopied(true);
            setTimeout(() => setShareUrlCopied(false), 2000);
        }
    };

    // Load shared data from URL on mount
    // Load shared data from URL on mount & hash change
    useEffect(() => {
        if (typeof window === 'undefined') return;

        // 1. Check for Category Query (e.g. /?travel or /?category=travel) - One time check on mount
        const params = new URLSearchParams(window.location.search);
        let targetGenre = '';

        // Check for ?travel, ?movie keys directly
        GENRES.forEach(g => {
            if (params.has(g.id)) {
                targetGenre = g.id;
            }
        });

        // Check for ?category=travel
        if (!targetGenre && params.get('category')) {
            const cat = params.get('category');
            if (GENRES.some(g => g.id === cat)) {
                targetGenre = cat!;
            }
        }

        if (targetGenre && targetGenre !== 'all') {
            setSelectedGenre(targetGenre);
            console.log(`[DeepLink] Activated category: ${targetGenre}`);
        }

        // 1.5 Check for Search Query (search= or q=)
        const searchQuery = params.get('search') || params.get('q');
        if (searchQuery) {
            setSearchText(searchQuery);
            setSelectedGenre('all'); // Force global search context
            setIsSearching(false); // Done effectively
            setIsDropdownOpen(false); // Do not auto-open dropdown for deep links

            // Trigger local search logic immediately for the param
            const lowerSearch = searchQuery.toLowerCase().normalize('NFC');
            const matches = initialPerformances.filter(p =>
                p.title.toLowerCase().normalize('NFC').includes(lowerSearch) ||
                p.venue.toLowerCase().normalize('NFC').includes(lowerSearch) ||
                (p.cast && (Array.isArray(p.cast) ? p.cast.join(' ') : p.cast).toLowerCase().normalize('NFC').includes(lowerSearch))
            ).slice(0, 10);
            setSearchResults(matches);
        }

        // 2. Hash Change Handler for Share Data (#s=) and Performance Popup (#p=)
        const handleHashCheck = () => {
            const hash = window.location.hash;

            // Type A: Share Settings (#s=)
            if (hash.startsWith('#s=')) {
                try {
                    const compressed = hash.substring(3);
                    const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
                    if (decompressed) {
                        const shareData = JSON.parse(decompressed);
                        if (shareData.l && Array.isArray(shareData.l)) {
                            setLikedIds(prev => Array.from(new Set([...prev, ...shareData.l])));
                        }
                        if (shareData.v && Array.isArray(shareData.v)) {
                            setFavoriteVenues(prev => Array.from(new Set([...prev, ...shareData.v])));
                        }
                        if (shareData.k && Array.isArray(shareData.k)) {
                            setKeywords(prev => Array.from(new Set([...prev, ...shareData.k])));
                        }
                        // Clear the hash after loading settings to avoid re-triggering?
                        // Or keep it? Usually better to clean up if it's "consumable".
                        // Logic in previous version cleaned it up.
                        window.history.replaceState(null, '', window.location.pathname);
                        console.log('[Share] Loaded shared data:', shareData);
                    }
                } catch (e) {
                    console.error('Failed to parse shared URL:', e);
                }
            }
            // Type B: Single Item Share (#p=)
            else if (hash.startsWith('#p=')) {
                const pId = hash.substring(3);
                if (pId) {
                    setSharedPerformanceId(pId);
                    console.log('[Share] Loaded shared item:', pId);
                }
            }
        };

        // Initial Check
        handleHashCheck();

        // Listen for hash changes (SPA Navigation)
        window.addEventListener('hashchange', handleHashCheck);
        return () => {
            window.removeEventListener('hashchange', handleHashCheck);
        };
    }, []);



    useEffect(() => {
        if (!isStorageLoaded) return;
        safeStorage.set('culture_favorite_venues', favoriteVenues);
    }, [favoriteVenues, isStorageLoaded]);

    const toggleFavoriteVenue = (venueName: string) => {
        setFavoriteVenues(prev =>
            prev.includes(venueName) ? prev.filter(v => v !== venueName) : [...prev, venueName]
        );
    };

    const favoriteVenuePerformances = useMemo(() => {
        return initialPerformances.filter(p => p.venue && favoriteVenues.includes(p.venue));
    }, [initialPerformances, favoriteVenues]);



    const [isSticky, setIsSticky] = useState(false); // Track if filters are pinned to top
    const [isStickyFilterExpanded, setIsStickyFilterExpanded] = useState(false); // Sticky Header Filter
    const [isHeroFilterExpanded, setIsHeroFilterExpanded] = useState(false); // Hero Inline Filter

    // New: Keyword Section Toggle
    const [isKeywordsExpanded, setIsKeywordsExpanded] = useState(true);

    // Auto-collapse logic: Collapse when sticky (top reached)
    useEffect(() => {
        if (isSticky) {
            setIsStickyFilterExpanded(false);
        }
    }, [isSticky]);

    // Infinite Scroll State
    // Fake Loading State for UX
    const [isFiltering, setIsFiltering] = useState(false);
    const [visibleCount, setVisibleCount] = useState(24);




    // Radius (User Location or Search Location)
    const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [radius, setRadius] = useState<number>(10);

    // Consolidated "Center" for radius calculation (User Loc OR Search Loc)
    const activeLocation = searchLocation || userLocation;

    useEffect(() => {
        setIsFiltering(true);
        const timer = setTimeout(() => setIsFiltering(false), 600);
        return () => clearTimeout(timer);
    }, [selectedGenre, selectedRegion, selectedDistrict, selectedVenue, searchText, activeLocation]);

    // Debounce Effect
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchText(searchText);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchText]);

    // Load Kakao Maps & Link SDK
    useEffect(() => {
        const mapScriptId = 'kakao-map-script';
        const linkScriptId = 'kakao-link-script';
        const APP_KEY = '0236cfffa7cfef34abacd91a6d7c73c0';

        // Internal handler for Maps
        const handleMapLoad = () => {
            window.kakao.maps.load(() => {
                setIsSdkLoaded(true);
            });
        };

        // Internal handler for Link
        const handleLinkLoad = () => {
            if ((window as any).Kakao && !(window as any).Kakao.isInitialized()) {
                (window as any).Kakao.init(APP_KEY);
                console.log('Kakao Link Initialized');
            }
        };

        // 1. Load Maps SDK
        if (document.getElementById(mapScriptId)) {
            if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
                setIsSdkLoaded(true);
            } else {
                const existingScript = document.getElementById(mapScriptId) as HTMLScriptElement;
                existingScript.addEventListener('load', handleMapLoad);
            }
        } else {
            const script = document.createElement('script');
            script.id = mapScriptId;
            script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${APP_KEY}&autoload=false&libraries=services,clusterer`;
            script.async = true;
            script.onload = handleMapLoad;
            document.head.appendChild(script);
        }

        // 2. Load Link SDK (for Sharing)
        if (document.getElementById(linkScriptId)) {
            if ((window as any).Kakao && !(window as any).Kakao.isInitialized()) {
                (window as any).Kakao.init(APP_KEY);
            }
        } else {
            const script = document.createElement('script');
            script.id = linkScriptId;
            script.src = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js';
            script.async = true;
            script.crossOrigin = 'anonymous';
            script.onload = handleLinkLoad;
            document.head.appendChild(script);
        }

        return () => {
            // Cleanup listeners if needed
        };
    }, []);

    // Handle Input Change (Real-time Text Filter)
    const handleSearchTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;

        // Enforce Global Search: Reset ViewMode and Category on ANY input
        if (val) {
            if (viewMode === 'likes-perf' || viewMode === 'likes-venue') {
                setViewMode('grid');
            }
            // User Request: Reset category to 'all' when searching to show global results
            // (Works fully on Home page where data is complete)
            if (selectedGenre !== 'all') {
                setSelectedGenre('all');
            }
        }

        // Auto-close lists when starting a search (UI refinement)
        if (val && !searchText) {
            setShowFavoriteVenues(false);
            setShowLikes(false);
        }

        setSearchText(val);
        // Reset location search when user types (revert to text filter)
        if (searchLocation) {
            setSearchLocation(null);
            setSearchResults([]); // specific clear
        }
        if (val) setIsDropdownOpen(true);
        setHighlightedIndex(-1); // Reset highlight on typing

        // Close dropdown if text is cleared
        if (!val) {
            setIsDropdownOpen(false);
            setSearchResults([]);
            setIsSearching(false);
        }
    };

    const [userAddress, setUserAddress] = useState<string | null>(null); // New: Store address text

    // 📍 Handle Current Location Click
    const handleCurrentLocationClick = () => {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser');
            return;
        }

        setIsSearching(true); // Set loading state
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                // Update Layout State
                setUserLocation({ lat: latitude, lng: longitude });
                setSelectedRegion('all');
                setSelectedDistrict('all');
                setSelectedVenue('all');
                setSearchLocation(null);
                setRadius(5); // Default radius 5km

                const shortAddr = addr.split(' ').slice(0, 2).join(' ');
                setUserAddress(shortAddr);
            } else {
            setUserAddress('내 위치');
        }
                    });
} else {
    setUserAddress('내 위치');
}

// Update Hero Text
setHeroText({
    line1: "현재 계신 곳 주변,",
    line2Pre: "가장 가까운 ",
    highlight: "핫플레이스",
    suffix: "를 모아봤어요.",
    keywords: ["내주변"]
});

setIsSearching(false);
            },
(error) => {
    console.error("Geolocation error:", error);
    alert("위치 정보를 가져올 수 없습니다. (HTTPS 연결이 필요하거나 권한이 차단되었을 수 있습니다.)");
    setIsSearching(false);
},
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    };

// Handle Search (Enter / Button -> Location Search)
const handleKeywordSelect = (keyword: string) => {
    setSearchText(keyword);
    addRecentSearch(keyword);
    setIsDropdownOpen(false);
};

const handleSearch = async () => {
    if (!searchText.trim()) {
        setSearchLocation(null);
        setIsDropdownOpen(false);
        return;
    }

    setIsSearching(true);
    setSearchLocation(null); // Reset previous location
    setSearchResults([]);    // Reset previous results
    setIsDropdownOpen(false);

    // Save to History if typed
    if (searchText.trim()) {
        addRecentSearch(searchText);
    }

    const candidates: any[] = [];

    // 1. Try to find in existing Venues first (Exact Match / High Priority)
    const matchedVenueKeys = Object.keys(venues).filter(k => k.includes(searchText));
    matchedVenueKeys.forEach(k => {
        if (venues[k].lat && venues[k].lng) {
            candidates.push({
                name: k,
                lat: venues[k].lat,
                lng: venues[k].lng,
                address: venues[k].address,
                type: 'venue'
            });
        }
    });

    // 2. Kakao Places Search
    // Check SDK status
    if (!isSdkLoaded || !window.kakao || !window.kakao.maps) {
        console.warn("Kakao SDK not ready yet. Retrying in 500ms...");
        // Simple Retry once?
        setTimeout(() => handleSearch(), 500);
        return;
    }

    window.kakao.maps.load(() => {
        if (!window.kakao.maps.services) {
            console.error("Kakao Maps Services library failed to load.");
            alert("지도 검색 기능을 불러오는데 실패했습니다. (새로고침 권장)");
            setIsSearching(false);
            if (candidates.length > 0) {
                setSearchResults(candidates);
                setIsDropdownOpen(true);
            }
            return;
        }

        const ps = new window.kakao.maps.services.Places();

        ps.keywordSearch(searchText, (data: any[], status: any) => {
            const results: any[] = [];

            if (status === window.kakao.maps.services.Status.OK) {
                data.forEach((item: any) => {
                    results.push({
                        name: item.place_name,
                        lat: parseFloat(item.y),
                        lng: parseFloat(item.x),
                        address: item.road_address_name || item.address_name,
                        type: 'location',
                        category: item.category_name
                    });
                });
            } else if (status === window.kakao.maps.services.Status.ZERO_RESULT) {
                // Normal behavior, just no results
            } else if (status === window.kakao.maps.services.Status.ERROR) {
                console.error("Kakao Search API Error", status);
                alert("검색 중 오류가 발생했습니다. (API 설정 또는 도메인 확인 필요)");
            }

            const finalResults = [...candidates, ...results];

            setIsSearching(false);
            if (finalResults.length > 0) {
                setSearchResults(finalResults);
                setIsDropdownOpen(true);
            } else {
                setSearchResults([]);
                // Optional: Toast "No results found"
            }
        });
    });

    // Auto-collapse special sections on search
    setIsLikesExpanded(false);
    setIsFavoriteVenuesExpanded(false);
};

const handleSelectResult = (candidate: any) => {
    setSearchLocation({
        lat: candidate.lat,
        lng: candidate.lng,
        name: candidate.name
    });
    setSearchText(''); // Clear text filter to allow radius search to show all nearby items
    setIsDropdownOpen(false);
    setHighlightedIndex(-1);

    // Auto-collapse special sections
    setIsLikesExpanded(false);
    setIsFavoriteVenuesExpanded(false);
};

const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return; // Ignore IME composition

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (isDropdownOpen && searchResults.length > 0) {
            setHighlightedIndex(prev => (prev + 1) % searchResults.length);
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (isDropdownOpen && searchResults.length > 0) {
            setHighlightedIndex(prev => (prev - 1 + searchResults.length) % searchResults.length);
        }
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (isDropdownOpen && highlightedIndex >= 0 && searchResults[highlightedIndex]) {
            handleSelectResult(searchResults[highlightedIndex]);
        } else {
            handleSearch();
        }
    } else if (e.key === 'Escape') {
        setIsDropdownOpen(false);
    }
};

// Extract districts for the selected region
const districts = useMemo(() => {
    if (selectedRegion === 'all') return [];

    const distinctDistricts = new Set<string>();
    initialPerformances.forEach(p => {
        const v = venues[p.venue || ''];
        // Priority: Check Mapped Region ID from Verification
        if (selectedRegion !== 'all') {
            if (v && (v as any).mapped_region_id) {
                if ((v as any).mapped_region_id !== selectedRegion) return;
            } else {
                if (p.region !== selectedRegion) return;
            }
        } else {
            if (p.region !== selectedRegion) return;
        }

        if (v && v.district) {
            distinctDistricts.add(v.district);
        }
    });
    return Array.from(distinctDistricts).sort();
}, [initialPerformances, selectedRegion]);

// Extract venues for the selected region & district
const availableVenues = useMemo(() => {
    const distinctVenues = new Set<string>();
    initialPerformances.forEach(p => {
        // Filter by Region if selected
        const v = venues[p.venue || ''];
        if (selectedRegion !== 'all') {
            if (v && (v as any).mapped_region_id) {
                if ((v as any).mapped_region_id !== selectedRegion) return;
            } else if (p.region !== selectedRegion) {
                return;
            }
        }

        // If district is selected, filter by district
        if (selectedDistrict !== 'all') {
            const v = venues[p.venue || ''];
            if (!v || v.district !== selectedDistrict) return;
        }

        if (p.venue) distinctVenues.add(p.venue);
    });
    // Sort alphabetically
    return Array.from(distinctVenues).sort();
}, [initialPerformances, selectedRegion, selectedDistrict]);

// --- Bottom Nav Handlers ---
const handleMenuClick = (menu: BottomMenuType) => {
    if (activeBottomMenu === menu) {
        setActiveBottomMenu(null); // Toggle off
    } else {
        setActiveBottomMenu(menu);
    }
};

const handleKeywordAdd = (keyword: string) => {
    if (!savedKeywords.includes(keyword)) {
        const updated = [...savedKeywords, keyword];
        setSavedKeywords(updated);
        safeStorage.set('culture_keywords', updated);
    }
};

const handleKeywordRemove = (keyword: string) => {
    const updated = savedKeywords.filter(k => k !== keyword);
    setSavedKeywords(updated);
    safeStorage.set('culture_keywords', updated);
};

// --- Bottom Nav Wrapper Handlers ---


const handleViewModeChange = (mode: string) => {
    setViewMode(mode);
    // Don't scroll to top for calendar and map modes - they are layer popups
    // User requested to remove scroll to top for all modes
    if (mode !== 'calendar' && mode !== 'map') {
        // scrollToTop();
    }
    if (mode === 'map') {
        setIsMapOpen(true);
    }
}

const handleGenreSelect = (genre: string) => {
    // If on a category page and selecting a different genre, navigate to that category's URL
    if (isCategoryPage && genre !== initialGenre) {
        const baseUrl = 'https://pyw31337.github.io/culture/';
        if (genre === 'all') {
            window.location.href = baseUrl;
        } else {
            window.location.href = `${baseUrl}${genre}/`;
        }
        return;
    }
    setSelectedGenre(genre);

    // Reset location for global categories (Movie, OTT) to ensure content is visible
    if (genre === 'movie' || genre === 'ott') {
        setSelectedRegion('all');
        setSelectedDistrict('all');
        setSelectedVenue('all');
        setSearchLocation(null); // Reset distance/map filter
    }

    scrollToTop();
};

const handleRegionSelect = (region: string) => {
    setSelectedRegion(region);
    setSelectedDistrict('all');
};

const handleDistrictSelect = (district: string) => {
    setSelectedDistrict(district);
};

const handleLikePerfClick = () => {
    if (viewMode === 'likes-perf') {
        setViewMode('grid');
    } else {
        setViewMode('likes-perf');
    }
    setActiveBottomMenu(null);
    scrollToTop();
};

const handleLikeVenueClick = () => {
    if (viewMode === 'likes-venue') {
        setViewMode('grid');
    } else {
        setViewMode('likes-venue');
    }
    setActiveBottomMenu(null);
    scrollToTop();
};

const handleRemoveFavoriteVenue = (venueName: string) => {
    setFavoriteVenues(prev => prev.filter(v => v !== venueName));
};

// --- Derived Filters for Search/Region ---
const filteredPerformances = useMemo(() => {
    let filtered = initialPerformances;

    // [OTT Filter] Hide foreign series (not KR/JP/US) if "Season" in title or Genre is Drama
    filtered = filtered.filter(p => {
        if (p.genre !== 'ott') return true;

        // Allow if country is KR/JP/US (or unknown/empty, to be safe? No, user said "if NOT... hide")
        // Actually, if country is missing, we usually shouldn't hide unless we are sure.
        // But let's follow strict instruction: "If production country is NOT..."
        const country = p.productionCountry ? p.productionCountry.replace(/\s+/g, '') : '';

        // [Denylist] Explicitly hide works from China, Thailand, India, Brazil
        const denylist = ['중국', 'China', '태국', 'Thailand', '인도', 'India', '브라질', 'Brazil'];
        const isDeniedCountry = denylist.some(c => country.includes(c));
        if (isDeniedCountry) return false;

        // [Allowlist] Allow if country is KR/JP/US
        const allowlist = ['한국', '대한민국', '일본', '미국', 'UnitedStates'];
        const isMajorCountry = allowlist.some(c => country.includes(c));

        if (isMajorCountry) return true;

        // [Fallback] Hide other foreign series if "Season" in title or Genre/SubGenre is "Drama"
        const titleHasSeason = p.title.includes('시즌') || p.title.toLowerCase().includes('season');
        const isDrama = p.subGenre === '드라마';

        if (titleHasSeason || isDrama) {
            return false; // Hide
        }
        return true;
    });

    // Search Filter
    if (searchText) {
        console.log(`[Search Debug] Searching for: ${searchText}`);
        filtered = filtered.filter(p => {
            const lowerSearch = searchText.toLowerCase().normalize('NFC');

            // 1. Title Match (Choseong supported)
            if (isChoseongMatch(p.title, searchText)) return true;

            // 2. Cast Match (Choseong)
            const castStr = p.cast ? (Array.isArray(p.cast) ? p.cast.join(' ') : p.cast) : '';
            if (isChoseongMatch(castStr, searchText)) return true;

            // 3. Venue Match
            if (p.venue.toLowerCase().normalize('NFC').includes(lowerSearch)) return true;

            return false;
        });
    }

    // Genre Filter
    if (selectedGenre !== 'all') {
        if (selectedGenre === 'hotdeal') {
            filtered = filtered.filter(p => p.discount && p.discount !== '' && p.discount !== '0');
        } else if (selectedGenre === 'ott') {
            // Include items with 'ott' genre OR items that have platform info (merged movies)
            filtered = filtered.filter(p => p.genre === 'ott' || (p.platforms && p.platforms.length > 0));
        } else {
            filtered = filtered.filter(p => p.genre === selectedGenre);
        }
    }

    // Region Filter
    if (selectedRegion !== 'all') {
        const beforeRegionCount = filtered.length;
        filtered = filtered.filter(p => {
            const venueInfo = venues[p.venue];

            // 0. Use Strict Mapped Region ID if available (Verification Script Result)
            if (venueInfo && (venueInfo as any).mapped_region_id) {
                return (venueInfo as any).mapped_region_id === selectedRegion;
            }

            // 1. Trust server-side region assignment if available
            if (p.region === selectedRegion) return true;
            if (!venueInfo) {
                // Fallback check if venue name contains region
                const regionLabel = REGIONS.find(r => r.id === selectedRegion)?.label;
                return regionLabel ? p.venue.includes(regionLabel) : false;
            }
            const regionLabel = REGIONS.find(r => r.id === selectedRegion)?.label;
            if (!regionLabel) return false;

            // Matches "서울" part of address
            const isRegionMatch = venueInfo.address.startsWith(regionLabel);

            if (!isRegionMatch) {
                // Log dropped items for volleyball
                if (p.genre === 'volleyball') {
                    // console.log(`[PerformanceList Debug] Dropped by Client Region: ${p.title} (${venueInfo.address}) vs ${regionLabel}`);
                }
                return false;
            }

            if (selectedDistrict !== 'all') {
                // Check district
                return venueInfo.district === selectedDistrict || venueInfo.address.includes(selectedDistrict);
            }
            return true;
        });
        if (selectedGenre === 'volleyball') {
            console.log(`[PerformanceList Debug] Region Filter ('${selectedRegion}'): ${beforeRegionCount} -> ${filtered.length}`);
        }
    }

    // Venue Filter (Modified: Include 10km Radius)
    if (selectedVenue !== 'all') {
        const centerVenue = venues[selectedVenue];
        if (centerVenue && centerVenue.lat && centerVenue.lng) {
            // Include: 1. Exact Venue Match OR 2. Within 10km
            filtered = filtered.filter(p => {
                if (p.venue === selectedVenue) return true;
                const pVenue = venues[p.venue];
                if (!pVenue?.lat || !pVenue?.lng) return false;
                const dist = getDistanceFromLatLonInKm(centerVenue.lat!, centerVenue.lng!, pVenue.lat, pVenue.lng);
                return dist <= 10;
            });
        } else {
            filtered = filtered.filter(p => p.venue === selectedVenue);
        }
    }

    return filtered;
}, [initialPerformances, searchText, selectedGenre, selectedRegion, selectedDistrict, selectedVenue]);

// Derived: Available Venues based on current Region/District selection
const availableVenues_unused = useMemo(() => {
    // Start with all venues from the loaded data
    let venueList = Object.keys(venues);

    if (selectedRegion !== 'all') {
        venueList = venueList.filter(vName => {
            const v = venues[vName];
            if (!v) return false;
            const regionLabel = REGIONS.find(r => r.id === selectedRegion)?.label;
            if (!regionLabel) return false;

            const isRegionMatch = v.address.startsWith(regionLabel);
            if (!isRegionMatch) return false;

            if (selectedDistrict !== 'all') {
                return v.district === selectedDistrict || v.address.includes(selectedDistrict);
            }
            return true;
        });
    }

    return venueList.sort();
}, [venues, selectedRegion, selectedDistrict]);


// "Page" Selection Logic
const basePerformances = useMemo(() => {
    if (viewMode === 'likes-perf') {
        return initialPerformances.filter(p => likedIds.includes(p.id));
    }
    if (viewMode === 'likes-venue') {
        return initialPerformances.filter(p => favoriteVenues.includes(p.venue));
    }
    return filteredPerformances;
}, [initialPerformances, likedIds, favoriteVenues, viewMode, filteredPerformances]);

// Sorting (Keyword Match desc with shuffle, then Date asc)
const sortedPerformances = useMemo(() => {
    // Sports: Strict Date ASC Sort (Nearest First)
    if (['volleyball', 'basketball', 'baseball', 'handball', 'soccer', 'hockey'].includes(selectedGenre)) {
        return [...basePerformances].sort((a, b) => {
            // Remove (Time) or ~ range for comparison
            const dateA = (a.date || '').split('(')[0].split('~')[0].trim();
            const dateB = (b.date || '').split('(')[0].split('~')[0].trim();
            return dateA.localeCompare(dateB);
        });
    }

    // Movie/OTT: Strict Date DESC Sort (Newest First)
    if (selectedGenre === 'movie' || selectedGenre === 'ott') {
        return [...basePerformances].sort((a, b) => {
            const dateA = (a.date || '').split('(')[0].split('~')[0].trim();
            const dateB = (b.date || '').split('(')[0].split('~')[0].trim();
            // Descending: B - A
            return dateB.localeCompare(dateA);
        });
    }

    // Create a seeded random value based on keywords to ensure consistent shuffle within a template cycle
    // but different shuffle when template/keywords change
    const shuffleSeed = contextKeywords.join(',');
    const seededRandom = (seed: string) => {
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            hash = ((hash << 5) - hash) + seed.charCodeAt(i);
            hash |= 0;
        }
        // Simple LCG for seeded random
        let state = Math.abs(hash) || Date.now();
        return () => {
            state = (state * 1103515245 + 12345) & 0x7fffffff;
            return state / 0x7fffffff;
        };
    };

    const random = seededRandom(shuffleSeed);

    if (contextKeywords.length > 0) {
        // Separate matching and non-matching items
        const hasMatch = (p: Performance) => contextKeywords.some(k => {
            // Direct text matching
            const textMatch =
                p.title.includes(k) ||
                p.venue.includes(k) ||
                (p.cast && (Array.isArray(p.cast) ? p.cast.join(' ') : p.cast).includes(k));

            // Genre matching: Check if keyword matches genre ID exactly OR genre label
            const genreLabel = GENRES.find(g => g.id === p.genre)?.label || '';
            const genreMatch = p.genre === k || genreLabel === k || genreLabel.includes(k);

            return textMatch || genreMatch;
        });

        const matched = basePerformances.filter(hasMatch);
        const unmatched = basePerformances.filter(p => !hasMatch(p));

        // Shuffle matched items using seeded random
        const shuffledMatched = [...matched].sort(() => random() - 0.5);

        // Sort unmatched by date
        const sortedUnmatched = [...unmatched].sort((a, b) => a.date.localeCompare(b.date));

        return [...shuffledMatched, ...sortedUnmatched];
    }

    // Default: Sort by date, then randomize top 40 for variety
    let sortedByDate = [...basePerformances].sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    // Priority Sort: If Venue selected, put exact matches first
    if (selectedVenue !== 'all') {
        sortedByDate.sort((a, b) => {
            const aMatch = a.venue === selectedVenue ? 0 : 1;
            const bMatch = b.venue === selectedVenue ? 0 : 1;
            return aMatch - bMatch;
        });
    }

    // If sorting for "Recommended" (default view with no keywords), shuffle the top items
    // We use shuffleSeed to ensure it only changes on mount/refresh
    if (shuffleSeed) {
        // Only shuffle if NOT in split venue mode (to preserve exact match order)
        if (selectedVenue === 'all') {
            const randomForDefault = seededRandom(shuffleSeed.toString());
            const TOP_COUNT = 40;
            const topItems = sortedByDate.slice(0, TOP_COUNT);
            const remainingItems = sortedByDate.slice(TOP_COUNT);

            const shuffledTop = topItems.sort(() => randomForDefault() - 0.5);
            return [...shuffledTop, ...remainingItems];
        }
    }

    return sortedByDate;
}, [basePerformances, contextKeywords, shuffleSeed]);

// Apply Radius Filter if active (Geolocation)
const displayPerformances = useMemo(() => {
    if (!activeLocation) return sortedPerformances;

    // Radius Logic ... (simplified re-implementation)
    // If activeLocation is set, we filter sortedPerformances by radius
    const origin = searchLocation || userLocation;
    if (!origin) return sortedPerformances;

    return sortedPerformances.filter(p => {
        const v = venues[p.venue];
        if (!v || !v.lat || !v.lng) return false;
        const d = getDistanceFromLatLonInKm(origin.lat, origin.lng, v.lat, v.lng);
        return d <= radius;
    });

}, [sortedPerformances, activeLocation, searchLocation, userLocation, radius]);

// Debug Logging for Derived Values
useEffect(() => {
    // Log derived counts when genre is volleyball
    if (selectedGenre === 'volleyball' || initialGenre === 'volleyball') {
        console.log(`[PerformanceList Debug] Filtered Count: ${filteredPerformances.length}`);
        console.log(`[PerformanceList Debug] Display Count: ${displayPerformances.length}`);
    }
}, [filteredPerformances, displayPerformances, selectedGenre, initialGenre]);

// Split logic for Keyword Notification
const { keywordMatches, normalPerformances } = useMemo(() => {
    if (savedKeywords.length === 0) {
        return { keywordMatches: [], normalPerformances: filteredPerformances };
    }

    const matches: typeof filteredPerformances = [];
    const others: typeof filteredPerformances = [];

    filteredPerformances.forEach(p => {
        const isMatch = savedKeywords.some(k => p.title.includes(k));
        if (isMatch) {
            matches.push(p);
        } else {
            others.push(p);
        }
    });

    return { keywordMatches: matches, normalPerformances: others };
}, [filteredPerformances, savedKeywords]);

// Reset visible count when filters change
useEffect(() => {
    setVisibleCount(24);
}, [filteredPerformances]);

// Intersection Observer for Infinite Scroll
const observerTarget = useMemo(() => {
    return (node: HTMLDivElement | null) => {
        if (!node) return;
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                setVisibleCount(prev => prev + 24);
            }
        }, { threshold: 0.1, rootMargin: '2000px' });
        observer.observe(node);
        return () => observer.disconnect();
    }
}, []);

// 🚀 Image Preloading Logic
useEffect(() => {
    const nextBatch = filteredPerformances.slice(visibleCount, visibleCount + 24);
    nextBatch.forEach((perf) => {
        if (perf.image) {
            const img = new window.Image();
            img.src = perf.image;
        }
    });
}, [visibleCount, filteredPerformances]);

const visiblePerformances = filteredPerformances.slice(0, visibleCount);

// View Mode State (Declared at top)








// Dynamically Import Components


// Sticky Sentinel Observer
// Sticky Logic with getBoundingClientRect + Scroll Listener (More Robust)
// Sticky Sentinel Logic with Scroll Listener (Robust)
const sentinelRef = useRef<HTMLDivElement>(null);

useEffect(() => {
    const handleScroll = () => {
        if (!sentinelRef.current) return;
        // Native sticky behavior kicks in when sticky element hits top.
        // But we want to detect when it hits top.
        // The sentinel is placed immediately ABOVE the sticky element.
        // If sentinel is scrolled out of view (top <= 0), we are sticky.
        const rect = sentinelRef.current.getBoundingClientRect();

        // Improved Logic with Hysteresis
        // Prevent flickering by requiring a buffer to switch states.
        const currentTop = rect.top;

        setIsSticky(prev => {
            if (prev) {
                // Currently Sticky (Collapsed).
                // Only expand if we scroll back UP significantly (e.g., reach the top).
                // Using 0 ensures we are really back at the anchor before expanding.
                return currentTop <= 0;
            } else {
                // Currently Not Sticky (Expanded).
                // Only collapse if we scroll DOWN past a threshold (e.g., -20px).
                // This prevents jitter at the precise boundary.
                return currentTop <= -20;
            }
        });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial

    return () => window.removeEventListener('scroll', handleScroll);
}, []);

// Scroll to Top Logic
const [showScrollTop, setShowScrollTop] = useState(false);



useEffect(() => {
    const handleScroll = () => {
        if (window.scrollY > 300) {
            setShowScrollTop(true);
        } else {
            setShowScrollTop(false);
        }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
}, []);

const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
};

// --- Bottom Nav Handlers ---
return (
    <div
        className="min-h-screen bg-transparent text-gray-100 light:text-gray-900 light:bg-white font-sans pb-20 relative"
    >
        {/* 🌌 Aurora Background */}
        {/* 🌌 Aurora Background Removed as per request */}
        {/* <div className="aurora-container ..."></div> */}
        <div className="noise-texture z-0 mix-blend-overlay opacity-20 fixed inset-0 pointer-events-none"></div>
        {/* Right-side Gradient Blobs (Neon & Saturated) */}
        <div className="fixed top-[-10%] right-[-5%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] bg-[#7c3aed] blur-[100px] rounded-full pointer-events-none z-0 opacity-60 light:opacity-25 mix-blend-screen light:mix-blend-multiply animate-pulse-slow"></div>
        <div className="fixed top-[10%] right-[-15%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] bg-[#db2777] blur-[120px] rounded-full pointer-events-none z-0 opacity-50 light:opacity-20 mix-blend-screen light:mix-blend-multiply animate-pulse-slow delay-1000"></div>
        {/* Header: Logo & Last Updated */}
        {/* Header */}
        <header className="relative z-40 bg-transparent backdrop-blur-none border-b border-transparent light:border-transparent">
            <div className="max-w-7xl 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
                <div
                    className="flex items-center gap-3 cursor-pointer group"
                    onClick={() => {
                        window.location.href = 'https://pyw31337.github.io/culture/';
                    }}
                >
                    <div className="relative w-10 h-10 transition-transform group-hover:scale-110 duration-300">
                        <Image
                            src="/culture/images/ticket_icon.png"
                            alt="Culture Flow Icon"
                            fill
                            className="object-cover"
                            sizes="40px"
                            priority
                        />
                    </div>
                    <h1 className="text-[1.5rem] md:text-3xl font-extrabold text-white light:text-black tracking-tight flex items-center gap-2 group-hover:text-[#a78bfa] transition-colors leading-[0.9]">
                        Culture Flow
                    </h1>
                    <span className="text-xs md:text-sm text-gray-400 light:text-gray-600 font-bold hidden sm:inline-block tracking-widest border-l border-gray-600 light:border-gray-400 pl-3 ml-1">
                        {(() => {
                            switch (selectedGenre) {
                                case 'festival': return '전국 축제 정보 검색';
                                case 'ott': return '오늘 뭐 볼까? OTT 콘텐츠';
                                case 'movie': return '최신 영화 개봉 정보';
                                case 'travel': return '국내 여행 상품 검색';
                                case 'class': return '취미 클래스 검색';
                                case 'kids': return '아이와 함께하는 체험';
                                case 'baseball': return 'KBO 프로야구 일정';
                                case 'basketball': return 'KBL 프로농구 일정';
                                case 'volleyball': return 'V-리그 프로배구 일정';
                                case 'soccer': return 'K-리그 축구 일정';
                                case 'hockey': return '아시아리그 아이스하키';
                                case 'museum': return '박물관/체험관';
                                case 'handball': return '핸드볼 H리그 일정';
                                case 'musical': return '뮤지컬 공연 정보';
                                case 'concert': return '콘서트 공연 정보';
                                case 'play': return '연극 공연 정보';
                                case 'classic': return '클래식 · 무용 공연';
                                case 'exhibition': return '전시 · 행사 정보';
                                case 'activity': return '액티비티 체험';
                                case 'leisure': return '레저 · 테마파크';
                                case 'hotdeal': return '🔥 오늘의 핫딜 특가';
                                default: return '전국 통합 문화 검색';
                            }
                        })()}
                    </span>
                </div>

                <div className="flex items-center gap-1 ml-4">
                    {/* Map Toggle Button */}
                    <button
                        onClick={() => setIsMapOpen(!isMapOpen)}
                        className={clsx(
                            "p-2 rounded-full transition-all duration-300 relative",
                            isMapOpen ? "bg-purple-500/20 text-purple-300 light:bg-purple-600 light:text-white" : "text-gray-400 light:text-gray-500 hover:text-white light:hover:text-black hover:bg-white/5 light:hover:bg-black/5"
                        )}
                        aria-label="지도 보기"
                    >
                        <MapIcon size={24} strokeWidth={isMapOpen ? 2.5 : 2} />
                    </button>

                    {/* Calendar Toggle Button */}
                    <button
                        onClick={() => setViewMode(viewMode === 'calendar' ? 'grid' : 'calendar')}
                        className={clsx(
                            "p-2 rounded-full transition-all duration-300 relative",
                            viewMode === 'calendar' ? "bg-purple-500/20 text-purple-300 light:bg-purple-600 light:text-white" : "text-gray-400 light:text-gray-500 hover:text-white light:hover:text-black hover:bg-white/5 light:hover:bg-black/5"
                        )}
                        aria-label="달력 보기"
                    >
                        <CalendarDays size={24} strokeWidth={viewMode === 'calendar' ? 2.5 : 2} />
                    </button>

                    {/* Alarm Toggle Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsAlarmOpen(!isAlarmOpen);
                        }}
                        className={clsx(
                            "p-2 rounded-full transition-all duration-300 relative",
                            isAlarmOpen ? "bg-purple-500/20 text-purple-300 light:bg-purple-600 light:text-white" : "text-gray-400 light:text-gray-500 hover:text-white light:hover:text-black hover:bg-white/5 light:hover:bg-black/5"
                        )}
                        aria-label="알림 설정"
                    >
                        <Bell size={24} strokeWidth={isAlarmOpen ? 2.5 : 2} className={clsx(isAlarmOpen && "animate-pulse")} />
                        {/* Keyword count badge */}
                        {savedKeywords.length > 0 && (
                            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-lg shadow-purple-500/30 border border-white/20">
                                {savedKeywords.length > 99 ? '99+' : savedKeywords.length}
                            </span>
                        )}
                    </button>
                </div>
            </div>
        </header>

        {/* Alarm Panel (Slide Down) - Moved Outside Header to avoid mix-blend-mode issues */}
        <div className={clsx(
            "absolute top-16 sm:top-20 left-0 right-0 bg-[#1a0b2e]/95 light:bg-white/95 backdrop-blur-3xl border-b border-purple-500/20 light:border-black/5 shadow-2xl transition-all duration-300 ease-out overflow-hidden origin-top z-40",
            isAlarmOpen ? "max-h-[500px] opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-4"
        )}>
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-white light:text-black flex items-center gap-2">
                        <Bell size={18} className="text-purple-400 light:text-purple-600" />
                        <span className="text-purple-100 light:text-gray-800">키워드 알림</span>
                    </h3>
                    <button
                        onClick={() => setIsAlarmOpen(false)}
                        className="p-1 rounded-full text-gray-500 hover:text-white light:hover:text-black hover:bg-white/10 light:hover:bg-black/10 transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="bg-purple-900/20 light:bg-purple-50 border border-purple-500/20 light:border-purple-200 rounded-xl p-3 mb-4">
                    <p className="text-xs text-purple-200/80 light:text-purple-900 leading-relaxed">
                        등록한 키워드가 포함된 공연이 오픈되면 홈 화면에서 알려드려요! 🔔
                    </p>
                </div>

                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        if (keywordInput.trim()) {
                            handleKeywordAdd(keywordInput.trim());
                            setKeywordInput('');
                        }
                    }}
                    className="flex gap-2 mb-4"
                >
                    <input
                        type="text"
                        value={keywordInput}
                        onChange={(e) => setKeywordInput(e.target.value)}
                        placeholder="키워드 추가 (예: 아이유)"
                        className="flex-1 bg-gray-900/80 light:bg-gray-100 border border-white/10 light:border-black/10 rounded-lg px-3 py-2 text-sm text-white light:text-black focus:outline-none focus:border-purple-500/50 transition-colors"
                    />
                    <button
                        type="submit"
                        disabled={!keywordInput.trim()}
                        className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-purple-500 disabled:opacity-50 transition-all font-medium"
                    >
                        추가
                    </button>
                </form>

                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">등록된 키워드</label>
                    {savedKeywords.length === 0 ? (
                        <div className="text-center py-6 text-gray-500 bg-gray-800/30 rounded-xl border border-dashed border-white/5 text-xs">
                            키워드를 등록해보세요.
                        </div>
                    ) : (
                        <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto custom-scrollbar">
                            {savedKeywords.map(k => (
                                <div key={k} className="flex items-center gap-1.5 bg-gray-800 light:bg-white text-white light:text-black pl-3 pr-1.5 py-1.5 rounded-full border border-gray-700 light:border-gray-300 hover:border-purple-500/30 transition-all">
                                    <span className="text-xs font-medium">{k}</span>
                                    <button
                                        onClick={() => handleKeywordRemove(k)}
                                        className="p-0.5 rounded-full text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>

        <ErrorBoundary fallback={<div className="h-[40vh] flex items-center justify-center text-gray-500">메인 배너를 불러올 수 없습니다.</div>}>
            <HeroSection
                heroText={heroText}
                onCycle={handleHeroCycle}
                isHeroVisible={isHeroVisible}
                viewMode={viewMode}
                selectedGenre={selectedGenre}
                selectedRegion={selectedRegion}
                selectedDistrict={selectedDistrict}
                selectedVenue={selectedVenue}
                activeLocation={searchLocation || userLocation ? { name: searchLocation?.name || userAddress || '내 위치' } : null}
                userAddress={userAddress}
                radius={radius}
                lastUpdated={lastUpdated}
                searchLocation={searchLocation}
                searchText={searchText}
                searchResults={searchResults}
                isDropdownOpen={isDropdownOpen}
                activeSearchSource={activeSearchSource}
                highlightedIndex={highlightedIndex}

                setIsHeroFilterExpanded={setIsHeroFilterExpanded}
                isHeroFilterExpanded={isHeroFilterExpanded}
                setSelectedRegion={setSelectedRegion}
                setSelectedDistrict={setSelectedDistrict}
                setSelectedVenue={setSelectedVenue}
                setUserLocation={setUserLocation}
                setSearchLocation={setSearchLocation}
                setRadius={setRadius}
                setSearchText={setSearchText}
                setActiveSearchSource={setActiveSearchSource}
                setIsDropdownOpen={setIsDropdownOpen}
                handleSearch={handleSearch}
                handleSelectResult={handleSelectResult}
                handleKeyDown={handleKeyDown}
                handleCurrentLocationClick={handleCurrentLocationClick}

                availableVenues={availableVenues}
                districts={districts}

                recentKeywords={recentSearches}
                onKeywordSelect={handleKeywordSelect}
                onRemoveRecent={removeRecentSearch}
                onClearRecent={clearRecentSearches}
            />
        </ErrorBoundary>


        {/* Keyword Input Section (Collapsible) */}
        {/* Removed Separated Keyword Section - Moved to Sticky Filter */}



        {/* Sticky feature removed as per user request */}

        {/* Recommendation Section (Visible only in 'all' genre or if explicit items exist) */}
        {viewMode === 'grid' && searchText === '' && selectedGenre === 'all' && (
            <div className="max-w-7xl 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 mt-6">
                <RecommendedSection
                    recommendedItems={recommendedItems}
                    onDetail={handleDetailOpen}
                    onLocationClick={handleSelectResult}
                    onToggleLike={toggleLike}
                    likedIds={new Set(likedIds)}
                />
            </div>
        )}



        {/* Favorite Venues Section (Highest Priority) - Visible if Toggled */}
        {
            viewMode === 'list' && showFavoriteVenues && favoriteVenuePerformances.length > 0 && (
                <div className="max-w-7xl 2xl:max-w-[1800px] mx-auto px-4 mt-6 mb-8 relative z-10">
                    <div
                        className="flex items-center justify-between mb-4 pl-2 border-l-4 border-emerald-500 cursor-pointer group"
                        onClick={() => setIsFavoriteVenuesExpanded(!isFavoriteVenuesExpanded)}
                    >
                        <div className="flex items-center gap-3">
                            <h3 className="text-xl font-bold text-emerald-500 flex items-center">
                                <BuildingStadium className="w-6 h-6 text-emerald-500 mr-2" />
                                찜한 공연장
                                <span className="text-base sm:text-xl text-gray-400 font-normal ml-[12px]">({favoriteVenuePerformances.length})</span>
                            </h3>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowFavoriteListModal(true);
                                }}
                                className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500 hover:text-black transition-colors"
                            >
                                목록보기
                            </button>
                        </div>
                        <button className="p-1 rounded-full text-gray-400 group-hover:text-white transition-colors">
                            {isFavoriteVenuesExpanded ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                        </button>
                    </div>
                    {isFavoriteVenuesExpanded && (
                        <div className={clsx(
                            "grid gap-4 sm:gap-6",
                            layoutMode === 'grid'
                                ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5"
                                : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
                        )}>
                            <AnimatePresence mode="popLayout">
                                {favoriteVenuePerformances
                                    .filter(p => selectedGenre === 'all' || p.genre === selectedGenre)
                                    .map((performance, index) => (
                                        <motion.div
                                            key={`fav-venue-${performance.id}`}
                                            layout
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                                            transition={{ duration: 0.3, delay: index * 0.05 }}
                                        >
                                            {layoutMode === 'grid' ? (
                                                <PerformanceCard
                                                    perf={performance}
                                                    distLabel={null}
                                                    venueInfo={venues[performance.venue] || null}
                                                    onLocationClick={(loc) => {
                                                        setSearchLocation(loc);
                                                        setViewMode('map');
                                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                                    }}
                                                    isLiked={likedIds.includes(performance.id)}
                                                    onToggleLike={(e) => toggleLike(performance.id, e)}
                                                    enableActions={true}
                                                    onShare={() => copyItemShareUrl(performance.id)}
                                                    onDetail={() => handleDetailOpen(performance)}
                                                    variant="emerald"
                                                />
                                            ) : (
                                                <PerformanceListItem
                                                    perf={performance}
                                                    distLabel={null}
                                                    venueInfo={venues[performance.venue] || null}
                                                    onLocationClick={(loc) => {
                                                        setSearchLocation(loc);
                                                        setViewMode('map');
                                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                                    }}
                                                    isLiked={likedIds.includes(performance.id)}
                                                    onToggleLike={(e) => toggleLike(performance.id, e)}
                                                    variant="emerald"
                                                    onShare={() => copyItemShareUrl(performance.id)}
                                                    onDetail={() => handleDetailOpen(performance)}
                                                />
                                            )}
                                        </motion.div>
                                    ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            )
        }



        {/* 🎁 Shared Item Layer Popup (Dimmed Background) */}
        <Portal>
            <AnimatePresence>
                {sharedPerformanceId && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 sm:p-8"
                        onClick={() => setSharedPerformanceId(null)} // Close on background click
                    >
                        {(() => {
                            const sharedItem = initialPerformances.find(p => p.id === sharedPerformanceId);
                            if (!sharedItem) return (
                                <div className="text-white text-xl font-bold flex flex-col items-center">
                                    <span className="mb-2">⚠️</span>
                                    찾을 수 없는 공연입니다. (ID: {sharedPerformanceId})
                                </div>
                            );

                            return (
                                <motion.div
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.9, opacity: 0 }}
                                    className="bg-gray-900 w-full max-w-5xl rounded-[15px] overflow-hidden shadow-[0_35px_60px_-15px_rgba(0,0,0,0.9)] border border-white/20 relative flex flex-col md:flex-row max-h-[90vh]"
                                    onClick={e => e.stopPropagation()}
                                >
                                    {/* Neon Stroke Effect for Popup */}
                                    <div className="absolute inset-[-2px] z-[-1] rounded-[17px] animate-neon-flow bg-linear-to-tr from-[#ff00cc] via-[#3333ff] to-[#ff00cc] bg-[length:200%_auto] pointer-events-none" />
                                    {/* Close Button */}
                                    <button
                                        onClick={() => setSharedPerformanceId(null)}
                                        className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/50 text-white hover:bg-white hover:text-black transition-colors"
                                    >
                                        <X className="w-6 h-6" />
                                    </button>

                                    {/* Image Section */}
                                    <div className="w-full md:w-1/2 relative h-[40vh] md:h-auto bg-black">
                                        <ImageWithFallback
                                            src={sharedItem.image}
                                            optimizationWidth={800}
                                            alt={sharedItem.title}
                                            fill
                                            className="object-contain md:object-cover"
                                            referrerPolicy="no-referrer"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-gray-900" />

                                        {/* Ribbon for Shared View */}
                                        <div className="absolute top-0 left-0 z-[60] w-32 h-32 pointer-events-none overflow-hidden rounded-tl-xl">
                                            <div className="absolute top-0 left-0 bg-[#a78bfa] text-white text-base font-extrabold py-2 w-48 text-center origin-top-left -rotate-45 translate-y-[96px] -translate-x-[42px] shadow-lg box-border border-b-2 border-white/20 tracking-wider">
                                                추천 공연
                                            </div>
                                        </div>
                                    </div>

                                    {/* Content Section */}
                                    <div className="w-full md:w-1/2 p-6 md:p-10 flex flex-col overflow-y-auto bg-gradient-to-br from-gray-900 via-purple-900/40 to-gray-900">
                                        <div className="flex flex-col gap-4">
                                            {/* Header */}
                                            <div>
                                                <span className="text-[#a78bfa] font-bold tracking-wider text-sm uppercase mb-2 block">Recommended Performance</span>
                                                <h2 className="text-2xl md:text-4xl font-black text-white leading-tight mb-2">
                                                    {sharedItem.title}
                                                </h2>
                                                <div className="flex flex-wrap gap-2">
                                                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-gray-800 text-gray-300 border border-gray-700">
                                                        {GENRES.find(g => g.id === sharedItem.genre)?.label || sharedItem.genre}
                                                    </span>
                                                    <span className="flex items-center gap-1 text-gray-400 text-xs px-2 py-0.5 rounded">
                                                        <Calendar className="w-3 h-3" />
                                                        {sharedItem.date}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Details Grid */}
                                            <div className="grid grid-cols-1 gap-4 py-6 border-t border-white/10 border-b">
                                                <div className="flex items-start gap-3">
                                                    <MapPin className="w-5 h-5 text-gray-400 mt-1" />
                                                    <div>
                                                        <div className="text-white font-medium text-lg cursor-pointer hover:text-[#a78bfa] hover:underline transition-colors"
                                                            onClick={() => {
                                                                // Open Map Modal over this popup
                                                                // Ensure KakaoMapModal Z-Index is > 99999
                                                                if (venues[sharedItem.venue]?.lat) {
                                                                    setSearchLocation({
                                                                        lat: venues[sharedItem.venue].lat!,
                                                                        lng: venues[sharedItem.venue].lng!,
                                                                        name: sharedItem.venue
                                                                    });
                                                                    setViewMode('map');
                                                                }
                                                            }}
                                                        >
                                                            {sharedItem.venue}
                                                        </div>
                                                        {venues[sharedItem.venue]?.address && (
                                                            <div className="text-gray-500 text-sm mt-1 cursor-pointer hover:text-gray-300 transition-colors"
                                                                onClick={() => {
                                                                    if (venues[sharedItem.venue]?.lat) {
                                                                        setSearchLocation({
                                                                            lat: venues[sharedItem.venue].lat!,
                                                                            lng: venues[sharedItem.venue].lng!,
                                                                            name: sharedItem.venue
                                                                        });
                                                                        setViewMode('map');
                                                                    }
                                                                }}
                                                            >
                                                                {venues[sharedItem.venue].address}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                {(sharedItem.price || sharedItem.discount) && (
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-5 flex justify-center mt-1"><span className="text-emerald-500 font-bold">₩</span></div>
                                                        <div>

                                                            <div className="flex items-baseline gap-2">
                                                                {sharedItem.discount && <span className="text-red-400 font-bold text-xl">{sharedItem.discount}</span>}
                                                                {sharedItem.price && <span className="text-white font-bold text-xl">{sharedItem.price}</span>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Action Button */}
                                            <div className="mt-auto pt-6">
                                                <a
                                                    href={sharedItem.link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="block w-full py-4 rounded-xl bg-[#a78bfa] hover:bg-[#8b5cf6] text-white font-bold text-center text-lg shadow-lg hover:shadow-none transition-all transform hover:-translate-y-1 relative overflow-hidden group/btn"
                                                >
                                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover/btn:animate-[shine_1s_ease-in-out_infinite]" />
                                                    예매하러 가기
                                                </a>
                                                <p className="text-center text-gray-500 text-xs mt-3">
                                                    * 예매처로 이동합니다.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })()}
                    </motion.div>
                )}
            </AnimatePresence>
        </Portal>

        {/* Favorite Venues List Modal */}
        <Portal>
            {
                showFavoriteListModal && (
                    <div
                        className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
                        onClick={() => setShowFavoriteListModal(false)}
                    >
                        <div
                            className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                                <h3 className="text-lg font-bold text-emerald-500 flex items-center gap-2">
                                    <BuildingStadium className="w-5 h-5" />
                                    찜한 공연장 목록
                                </h3>
                                <button
                                    onClick={() => setShowFavoriteListModal(false)}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Modal Body: List */}
                            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2 scrollbar-hide">
                                {favoriteVenues.length === 0 ? (
                                    <p className="text-center text-gray-500 py-4">찜한 공연장이 없습니다.</p>
                                ) : (
                                    favoriteVenues.map((venueName) => (
                                        <div key={venueName} className="flex items-center justify-between bg-gray-800/50 hover:bg-gray-800 p-3 rounded-lg border border-gray-700/50 transition-colors">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-gray-200">{venueName}</span>
                                                {venues[venueName]?.address && (
                                                    <span className="text-xs text-gray-500 truncate max-w-[200px]">{venues[venueName].address}</span>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => toggleFavoriteVenue(venueName)}
                                                className="p-1.5 rounded-full text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-colors"
                                                title="삭제"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
        </Portal>

        {/* Liked Performances Section (Above Keywords) - Visible if Toggled */}
        {
            viewMode === 'list' && showLikes && likedPerformances.length > 0 && (
                <div className="max-w-7xl 2xl:max-w-[1800px] mx-auto px-4 mt-6 mb-8 relative z-10">
                    <div
                        className="flex items-center justify-between mb-4 pl-2 border-l-4 border-pink-500 cursor-pointer group"
                        onClick={() => setIsLikesExpanded(!isLikesExpanded)}
                    >
                        <h3 className="text-xl font-bold text-pink-500 flex items-center">
                            <Heart className="w-6 h-6 fill-pink-500 text-pink-500 mr-2" />
                            좋아요
                            <span className="text-base sm:text-xl text-gray-400 font-normal ml-[12px]">({likedPerformances.length})</span>
                        </h3>
                        <button className="p-1 rounded-full text-gray-400 group-hover:text-white transition-colors">
                            {isLikesExpanded ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                        </button>
                    </div>
                    {isLikesExpanded && (
                        <div className={clsx(
                            "grid gap-4 sm:gap-6",
                            layoutMode === 'grid'
                                ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5"
                                : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
                        )}>

                            <AnimatePresence mode="popLayout">
                                {likedPerformances
                                    .filter(p => selectedGenre === 'all' || p.genre === selectedGenre)
                                    .map((performance, index) => (
                                        <motion.div
                                            key={`liked-${performance.id}`}
                                            layout
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                                            transition={{ duration: 0.3, delay: index * 0.05 }}
                                        >
                                            {layoutMode === 'grid' ? (
                                                <PerformanceCard
                                                    perf={performance}
                                                    distLabel={null}
                                                    venueInfo={venues[performance.venue] || null}
                                                    onLocationClick={(loc) => {
                                                        setSearchLocation(loc);
                                                        setIsMapOpen(true);
                                                    }}
                                                    isLiked={true}
                                                    onToggleLike={(e) => toggleLike(performance.id, e)}
                                                    enableActions={true}
                                                    onShare={() => copyItemShareUrl(performance.id)}
                                                    onDetail={() => handleDetailOpen(performance)}
                                                    variant="pink"
                                                />
                                            ) : (
                                                <PerformanceListItem
                                                    perf={performance}
                                                    distLabel={null}
                                                    venueInfo={venues[performance.venue] || null}
                                                    onLocationClick={(loc) => {
                                                        setSearchLocation(loc);
                                                        setIsMapOpen(true);
                                                    }}
                                                    isLiked={true}
                                                    onToggleLike={(e) => toggleLike(performance.id, e)}
                                                    variant="pink"
                                                    onShare={() => copyItemShareUrl(performance.id)}
                                                    onDetail={() => handleDetailOpen(performance)}
                                                />
                                            )}
                                        </motion.div>
                                    ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            )
        }

        {/* Keyword Matches Section (Always visible, always list layout) */}
        {
            keywordMatches.length > 0 && viewMode !== 'likes-perf' && viewMode !== 'likes-venue' && (
                <div className="max-w-7xl 2xl:max-w-[1800px] mx-auto px-4 mt-6 mb-8 relative z-10">
                    <div
                        className="flex items-center justify-between mb-4 pl-2 border-l-4 border-yellow-500 cursor-pointer group"
                        onClick={() => setIsKeywordsExpanded(!isKeywordsExpanded)}
                    >
                        <h3 className="text-xl font-bold text-yellow-500 flex items-center">
                            <Star className="w-6 h-6 fill-yellow-500 text-yellow-500 mr-2" />
                            키워드
                            <span className="text-base sm:text-xl text-gray-400 font-normal ml-[12px]">({keywordMatches.length})</span>
                        </h3>
                        <button className="p-1 rounded-full text-gray-400 group-hover:text-white transition-colors">
                            {isKeywordsExpanded ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                        </button>
                    </div>
                    {isKeywordsExpanded && (
                        <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                            <AnimatePresence mode="popLayout">
                                {keywordMatches.map((performance, idx) => (
                                    <motion.div
                                        key={`keyword-${performance.id}`}
                                        layout
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                                        transition={{ duration: 0.3, delay: idx * 0.05 }}
                                    >
                                        {/* Keyword matches always use list view */}
                                        <PerformanceListItem
                                            perf={performance}
                                            distLabel={null}
                                            venueInfo={venues[performance.venue] || null}
                                            onLocationClick={(loc) => {
                                                setSearchLocation(loc);
                                                setIsMapOpen(true);
                                            }}
                                            isLiked={likedIds.includes(performance.id)}
                                            onToggleLike={(e) => toggleLike(performance.id, e)}
                                            variant="yellow"
                                            onShare={() => copyItemShareUrl(performance.id)}
                                            onDetail={() => window.open(performance.link, '_blank')}
                                        />
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            )
        }


        {/* Main Content */}
        <div className="max-w-7xl 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
            {/* Results Info */}
            <div className="flex flex-col sm:flex-row justify-between items-end mb-6 mt-8 gap-2">
                <div className="w-full sm:w-auto">
                    <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
                        <h2 className="text-xl sm:text-2xl font-extrabold text-gray-200 light:text-black flex items-center gap-2">
                            {viewMode === 'likes-perf' ? (
                                <>
                                    <Heart className="text-pink-500 w-6 h-6 fill-pink-500" />
                                    <span>좋아요</span>
                                    <span className="text-base sm:text-xl text-gray-400 font-normal ml-2">({displayPerformances.length})</span>
                                </>
                            ) : viewMode === 'likes-venue' ? (
                                <>
                                    <Star className="text-emerald-500 w-6 h-6 fill-emerald-500" />
                                    <span>찜한 공연장</span>
                                    <span className="text-base sm:text-xl text-gray-400 font-normal ml-2">({displayPerformances.length})</span>
                                    <button
                                        onClick={() => setIsFavoriteVenuesModalOpen(true)}
                                        className="ml-3 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs sm:text-sm text-gray-300 font-medium transition-colors flex items-center gap-1.5 border border-white/10 light:bg-white light:text-black light:border-gray-300 light:hover:bg-gray-100 shadow-sm"
                                    >
                                        <List size={14} className="light:text-black" />
                                        <span className="hidden sm:inline">찜한공연장 목록</span>
                                        <span className="sm:hidden">목록</span>
                                    </button>
                                </>
                            ) : activeLocation ? (
                                <>
                                    <MapPin className="text-green-500 w-5 h-5" />
                                    <span className="truncate max-w-[150px] sm:max-w-xs">
                                        {searchLocation ? `'${searchLocation.name}'` : (userAddress || '내 위치')}
                                    </span>
                                    <span className="text-base sm:text-xl shrink-0">{searchLocation ? '공연장 주변' : '주변'} ({displayPerformances.length})</span>
                                    <button
                                        onClick={() => {
                                            setSearchLocation(null);
                                            setSearchText('');
                                        }}
                                        className="ml-2 p-1.5 rounded-full bg-white/10 hover:bg-white/20 light:bg-black/5 light:hover:bg-black/10 text-gray-400 hover:text-white light:text-gray-600 light:hover:text-black transition-all border border-white/5 hover:border-white/20 light:border-black/5 light:hover:border-black/10 group/reload"
                                        title="지역 설정 초기화"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 group-hover/reload:rotate-180 transition-transform"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M19.933 13.041a8 8 0 1 1 -9.925 -8.788c3.899 -1.002 7.935 1.007 9.425 4.747" /><path d="M20 4v5h-5" /></svg>
                                    </button>
                                </>
                            ) : searchText ? (
                                <>
                                    <span className="flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="icon icon-tabler icons-tabler-outline icon-tabler-input-search"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M20 11v-2a2 2 0 0 0 -2 -2h-12a2 2 0 0 0 -2 2v5a2 2 0 0 0 2 2h5" /><path d="M15 18a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /><path d="M20.2 20.2l1.8 1.8" /></svg>
                                        검색 공연
                                    </span>
                                    <span className="text-base sm:text-xl text-gray-400 font-normal ml-2">({displayPerformances.length})</span>
                                </>
                            ) : (
                                <>
                                    <span className="flex items-center gap-2">
                                        {getGenreIcon(selectedGenre, 28)}
                                        {selectedGenre === 'all'
                                            ? '추천 공연'
                                            : `추천 ${GENRES.find(g => g.id === selectedGenre)?.label || '공연'}`
                                        }
                                    </span>
                                    <span className="text-base sm:text-xl text-gray-400 font-normal ml-2">({displayPerformances.length})</span>
                                </>
                            )}
                        </h2>
                        <div className="flex items-center gap-2 pb-[3px]">
                            <p className="text-gray-400 text-xs sm:text-sm font-medium">
                                {activeLocation
                                    ? `${radius}km 이내 공연을 거리순으로 보여줍니다.`
                                    : null}
                            </p>
                            {activeLocation && (
                                <button
                                    onClick={() => {
                                        setIsMapOpen(true);
                                    }}
                                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-white/10 text-white hover:bg-white/20 transition-colors border border-white/10 ml-1 light:bg-gray-100 light:text-gray-900 light:border-gray-300 light:hover:bg-gray-200"
                                >
                                    <MapIcon className="w-3 h-3 text-[#a78bfa] light:text-purple-600" />
                                    <span className="hidden sm:inline text-gray-200 light:text-gray-900">지도보기</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* View Toggle */}

            </div>

            {/* Grid/List View */}
            <div className="min-h-[50vh]">
                <ErrorBoundary fallback={
                    <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                        <span className="text-4xl mb-4">😵</span>
                        <p>목록을 불러오는 중 오류가 발생했습니다.</p>
                        <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-gray-800 rounded hover:bg-gray-700">새로고침</button>
                    </div>
                }>
                    {isInitialLoading ? (
                        <SkeletonGrid count={12} isListMode={layoutMode === 'list'} />
                    ) : (
                        displayPerformances.length > 0 ? (
                            <PerformanceGrid
                                items={displayPerformances.slice(0, visibleCount)}
                                hasMore={visibleCount < displayPerformances.length}
                                observerRef={observerTarget}
                                layoutMode={layoutMode}
                                selectedVenue={selectedVenue}
                                activeLocation={searchLocation || userLocation}
                                venues={venues}
                                likedIds={likedIds}
                                onToggleLike={toggleLike}
                                handleDetailOpen={handleDetailOpen}
                                setSearchLocation={setSearchLocation}
                                setIsMapOpen={setIsMapOpen}
                                copyItemShareUrl={copyItemShareUrl}
                                selectedGenre={selectedGenre}
                                viewMode={viewMode}
                            />
                        ) : (
                            <EmptyState
                                viewMode={viewMode}
                                selectedGenre={selectedGenre}
                                setSelectedRegion={setSelectedRegion}
                                setSelectedDistrict={setSelectedDistrict}
                                setSearchText={setSearchText}
                                setUserLocation={setUserLocation}
                                setIsMapOpen={setIsMapOpen}
                            />
                        )
                    )}
                </ErrorBoundary>
            </div>

            {/* Scroll to Top Button */}
            {
                showScrollTop && (
                    <button
                        onClick={scrollToTop}
                        className="fixed bottom-20 right-6 p-3 bg-black/60 backdrop-blur-md border-[1.5px] border-transparent bg-origin-border rounded-full shadow-lg hover:shadow-[#f472b6]/50 transition-all z-50 animate-bounce group"
                        style={{
                            backgroundImage: 'linear-gradient(#000, #000), linear-gradient(to right, #a78bfa, #f472b6)',
                            backgroundClip: 'padding-box, border-box'
                        }}
                        aria-label="Scroll to top"
                    >
                        <div className="text-white">
                            <svg className="w-6 h-6 stroke-current" fill="none" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                        </div>
                    </button>
                )
            }

            {/* Render View Modals */}
            {
                viewMode === 'calendar' && (
                    <CalendarModal
                        performances={filteredPerformances} // Pass filtered!
                        onClose={() => setViewMode('grid')}
                    />
                )
            }

            {
                isMapOpen && (
                    <KakaoMapModal
                        performances={filteredPerformances} // Pass filtered!
                        centerLocation={
                            searchLocation ||
                            (selectedVenue !== 'all' && venues[selectedVenue]?.lat && venues[selectedVenue]?.lng
                                ? { lat: venues[selectedVenue].lat!, lng: venues[selectedVenue].lng!, name: selectedVenue }
                                : null)
                        }
                        favoriteVenues={favoriteVenues}
                        onToggleFavorite={toggleFavoriteVenue}
                        onClose={() => setIsMapOpen(false)}
                        onVenueLocationChange={(venueName, lat, lng) => {
                            setSearchLocation({ lat, lng, name: venueName });
                            setIsMapOpen(false);
                        }}
                    />
                )
            }

            {/* Detail View Modal (Deep Linking) */}
            {selectedPerformance && (
                <PerformanceDetailModal
                    performance={selectedPerformance}
                    isOpen={!!selectedPerformance}
                    onClose={handleDetailClose}
                    onBooking={() => handleBooking(selectedPerformance.link)}
                    onShare={() => handleCopyLink(selectedPerformance.id)}
                />
            )}

            {/* 🔔 New Matches Notification Modal */}
            <Portal>
                <AnimatePresence>
                    {showNewMatchesModal && newMatches.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
                            onClick={handleCloseNotification}
                        >
                            <motion.div
                                initial={{ scale: 0.9, y: 20 }}
                                animate={{ scale: 1, y: 0 }}
                                exit={{ scale: 0.9, y: 20 }}
                                className="bg-gray-900 border border-yellow-500/50 rounded-2xl w-full max-w-md overflow-hidden shadow-[0_0_50px_rgba(234,179,8,0.3)] relative"
                                onClick={e => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="bg-yellow-500/10 p-5 flex items-start gap-4 border-b border-yellow-500/20">
                                    <div className="p-3 bg-yellow-500 rounded-full text-black shadow-lg shadow-yellow-500/20">
                                        <Bell className="w-6 h-6 fill-black" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-1">새로운 공연 알림</h3>
                                        <p className="text-gray-400 text-sm">
                                            설정하신 키워드({keywords.length}개)에 해당하는 <br />
                                            <span className="text-yellow-400 font-bold">{newMatches.length}개</span>의 새로운 공연이 발견되었습니다!
                                        </p>
                                    </div>
                                </div>

                                {/* List */}
                                <div className="p-4 max-h-[50vh] overflow-y-auto space-y-3 custom-scrollbar">
                                    {newMatches.slice(0, 5).map(perf => (
                                        <div key={perf.id} className="flex gap-3 bg-black/40 p-3 rounded-xl border border-white/5 hover:border-yellow-500/30 transition-colors">
                                            <div className="relative w-16 h-20 bg-gray-800 rounded-lg overflow-hidden shrink-0">
                                                <ImageWithFallback
                                                    src={perf.image}
                                                    optimizationWidth={100}
                                                    alt={perf.title}
                                                    fill
                                                    className="object-cover"
                                                    referrerPolicy="no-referrer"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0 py-1">
                                                <div className="text-xs text-yellow-500 font-bold mb-1">
                                                    {GENRES.find(g => g.id === perf.genre)?.label || perf.genre}
                                                </div>
                                                <h4 className="text-white font-bold text-sm truncate leading-tight mb-1">{perf.title}</h4>
                                                <p className="text-gray-500 text-xs truncate">{perf.venue} • {perf.date}</p>
                                            </div>
                                        </div>
                                    ))}
                                    {newMatches.length > 5 && (
                                        <div className="text-center py-2 text-gray-500 text-sm">
                                            외 {newMatches.length - 5}개의 공연이 더 있습니다.
                                        </div>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="p-4 border-t border-white/10 flex gap-3">
                                    <button
                                        onClick={handleCloseNotification}
                                        className="flex-1 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl transition-all shadow-lg shadow-yellow-500/10"
                                    >
                                        확인했습니다
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </Portal>



            {/* Bottom Navigation Sheet */}
            <Portal>
                <BottomNavSheet
                    activeMenu={activeBottomMenu}
                    onClose={() => setActiveBottomMenu(null)}
                    viewMode={viewMode}
                    onViewModeChange={handleViewModeChange}
                    selectedGenre={selectedGenre}
                    onGenreSelect={handleGenreSelect}
                    searchText={searchText}
                    onSearchChange={(text) => {
                        setSearchText(text);
                        if (text && selectedGenre !== 'all') {
                            setSelectedGenre('all');
                        }
                    }}
                    selectedRegion={selectedRegion}
                    onRegionSelect={handleRegionSelect}
                    selectedDistrict={selectedDistrict}
                    onDistrictSelect={handleDistrictSelect}
                    keywords={contextKeywords}
                    onKeywordAdd={handleKeywordAdd}
                    onKeywordRemove={handleKeywordRemove}
                    districts={districts}
                    availableVenues={availableVenues}
                    selectedVenue={selectedVenue}
                    onVenueSelect={(v) => {
                        setSelectedVenue(v);
                        scrollToTop();
                    }}
                />
            </Portal>

            {/* Fixed Bottom Navigation Bar */}
            <Portal>
                <BottomNav
                    activeMenu={activeBottomMenu}
                    onMenuClick={handleMenuClick}
                    currentViewMode={viewMode}
                    onLikePerfClick={handleLikePerfClick}
                    onLikeVenueClick={handleLikeVenueClick}
                    likeCount={likedPerformances.length}
                    venueCount={favoriteVenues.length}
                    selectedGenre={selectedGenre}
                />
            </Portal>


            <FavoriteVenuesModal
                isOpen={isFavoriteVenuesModalOpen}
                onClose={() => setIsFavoriteVenuesModalOpen(false)}
                favoriteVenues={favoriteVenues}
                onRemove={handleRemoveFavoriteVenue}
                onVenueClick={(venueName) => {
                    const venue = venues[venueName];
                    if (venue && venue.lat && venue.lng) {
                        setSearchLocation({
                            lat: venue.lat,
                            lng: venue.lng,
                            name: venueName
                        });
                        setIsMapOpen(true);
                        // Optional: Close the favorites modal if desired, or keep it open.
                        // User request: "그 위로 지도보기 레이어팝업을 띄워서" (Pop map OVER it)
                        // KakaoMapModal has higher z-index (100001) than FavoriteVenuesModal (9999), 
                        // so keeping it open works perfectly for stacking.
                    } else {
                        alert('공연장 위치 정보를 찾을 수 없습니다.');
                    }
                }}
            />
        </div>
    </div>
);
}


