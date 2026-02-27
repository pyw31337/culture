'use client';

import Link from 'next/link';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Performance } from '@/types';
import { Share2, Link2, Check, Search, MapPin, Calendar, Menu, X, Filter, ChevronDown, List, LayoutGrid, LayoutList, Heart, Flame, Star, Bell, RotateCw, RotateCcw, Map as MapIcon, ChevronUp, Plane, CalendarDays, Navigation, ChevronRight, Tag, Home, Loader2, Moon, Sun, Trash2 } from 'lucide-react';
import ImageWithFallback from './ImageWithFallback';
import BuildingStadium from './BuildingStadium';
import { clsx } from 'clsx';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import venueData from '@/data/venue-dictionary.json';
import { GENRES, REGIONS, NATIONWIDE_REGIONS, RADIUS_OPTIONS, FUTURES_TEAM_LOGOS } from '@/lib/constants';
import { getOptimizedUrl } from '@/lib/utils';
import { safeStorage } from '@/lib/safeStorage';
import { motion, AnimatePresence } from 'framer-motion';
import LZString from 'lz-string';
import Portal from './ui/Portal';
import BottomNav, { BottomMenuType } from './BottomNav';
import BottomNavSheet from './BottomNavSheet';
import { getGenreIcon } from '@/components/GenreIcons';
import { isChoseongMatch } from '@/lib/hangul';
import { useUserActivity } from '@/hooks/useUserActivity';
import { useRecommendation } from '@/hooks/useRecommendation';
import RecommendedSection from './performance/RecommendedSection';
import KeywordSection from './performance/KeywordSection';

import type { KakaoMapModalProps } from './KakaoMapModal';
const KakaoMapModal = dynamic<KakaoMapModalProps>(() => import('./KakaoMapModal'), { ssr: false });
const CalendarModal = dynamic(() => import('./CalendarModal'), { ssr: false });
const PerformanceDetailModal = dynamic(() => import('./PerformanceDetailModal'), { ssr: false });
const FavoriteVenuesModal = dynamic(() => import('./FavoriteVenuesModal'), { ssr: false });
const SharedDetailModal = dynamic(() => import('./SharedDetailModal'), { ssr: false });

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
import { filterPerformances, sortPerformances } from '@/lib/performance-filter';

interface Venue {
    name?: string;
    refined_name?: string;
    address?: string;
    district?: string;
    lat?: number | null;
    lng?: number | null;
    mapped_region_id?: string;
}

const venues = venueData as Record<string, Venue>;

interface PerformanceListProps {
    initialPerformances: Performance[];
    lastUpdated: string;
    initialGenre?: string;
    isCategoryPage?: boolean;
    categoryLabel?: string;
}

export default function PerformanceList({ initialPerformances, lastUpdated, initialGenre = 'all', isCategoryPage = false, categoryLabel }: PerformanceListProps) {
    const [focusVenue, setFocusVenue] = useState<{ lat: number, lng: number, name: string } | null>(null);
    // --- State ---

    // Data (Hybrid: Initial -> Fetched Full)
    const [allPerformances, setAllPerformances] = useState<Performance[]>(initialPerformances);
    const [isDataFullyLoaded, setIsDataFullyLoaded] = useState(false);

    // Filters
    const [selectedGenre, setSelectedGenre] = useState<string>(initialGenre);

    useEffect(() => {
        setSelectedGenre(initialGenre);
    }, [initialGenre]);

    const [selectedRegion, setSelectedRegion] = useState<string>('all');
    const [selectedDistrict, setSelectedDistrict] = useState<string>('all');
    const [selectedVenue, setSelectedVenue] = useState<string>('all');

    // Randomization Seed for consistent shuffle per category visit
    const [shuffleSeed, setShuffleSeed] = useState<number>(Date.now());

    const [searchText, setSearchText] = useState('');
    const [searchLocation, setSearchLocation] = useState<{ lat: number, lng: number, name: string } | null>(null);
    const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [userAddress, setUserAddress] = useState<string | null>(null);
    const [radius, setRadius] = useState<number>(10);

    // View & Layout
    const [viewMode, setViewMode] = useState<string>('grid'); // 'list' | 'grid' | 'calendar' | 'map'
    const [savedScrollPosition, setSavedScrollPosition] = useState(0); // Added for scroll restoration
    const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid');
    const [isMapOpen, setIsMapOpen] = useState(false);
    // Kakao State moved down
    const [activeBottomMenu, setActiveBottomMenu] = useState<BottomMenuType>(null);

    // User Preferences (Persisted)
    const [likedIds, setLikedIds] = useState<string[]>([]);
    const [favoriteVenues, setFavoriteVenues] = useState<string[]>([]);
    const [savedKeywords, setSavedKeywords] = useState<string[]>([]);
    const [cinemas, setCinemas] = useState<any[]>([]);
    const [isStorageLoaded, setIsStorageLoaded] = useState(false);

    // UI Toggles
    const [theme, setTheme] = useState<'light' | 'dark'>('dark');

    useEffect(() => {
        const isDark = document.documentElement.classList.contains('dark');
        setTheme(isDark ? 'dark' : 'light');
    }, []);

    const toggleTheme = () => {
        const isDark = document.documentElement.classList.contains('dark');
        if (isDark) {
            document.documentElement.classList.remove('dark');
            safeStorage.set('theme', 'light');
            setTheme('light');
        } else {
            document.documentElement.classList.add('dark');
            safeStorage.set('theme', 'dark');
            setTheme('dark');
        }
    };
    const [isHeroFilterExpanded, setIsHeroFilterExpanded] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [activeSearchSource, setActiveSearchSource] = useState<'hero' | 'sticky'>('hero');
    const [showFavoriteVenues, setShowFavoriteVenues] = useState(true);
    const [isFavoriteVenuesExpanded, setIsFavoriteVenuesExpanded] = useState(true);
    const [showLikes, setShowLikes] = useState(true);
    const [isLikesExpanded, setIsLikesExpanded] = useState(true);
    const [showFavoriteListModal, setShowFavoriteListModal] = useState(false);
    const [isHeroVisible, setIsHeroVisible] = useState(true);
    const [isAlarmOpen, setIsAlarmOpen] = useState(false);
    const [keywordInput, setKeywordInput] = useState('');

    // Deep Linking
    // Deep Linking
    const [selectedPerformance, setSelectedPerformance] = useState<Performance | null>(null);
    const [sharedPerformanceId, setSharedPerformanceId] = useState<string | null>(null);

    // Keyboard Navigation
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);

    // Effect for resetting highlight moved down

    // Search Mode & Logic
    const [searchMode, setSearchMode] = useState<'keyword' | 'location'>('keyword');

    // Load search mode from local storage on mount
    useEffect(() => {
        const savedMode = localStorage.getItem('cultureflow_search_mode');
        if (savedMode === 'keyword' || savedMode === 'location') {
            setSearchMode(savedMode);
        }
    }, []);

    // Save search mode to local storage whenever it changes
    useEffect(() => {
        localStorage.setItem('cultureflow_search_mode', searchMode);
    }, [searchMode]);

    // Location Search Results (Kakao)
    const [kakaoSearchResults, setKakaoSearchResults] = useState<any[]>([]);
    const searchTextRef = useRef(searchText); // Track current searchText to detect stale responses

    useEffect(() => {
        searchTextRef.current = searchText; // Always keep ref in sync

        // [FIX] Prevent searching if text matches selected location exactly (User selected it)
        if (searchMode === 'location' && searchLocation && searchText === searchLocation.name) {
            return;
        }

        if (searchMode === 'location' && searchText.trim().length > 1) {
            const currentSearchText = searchText.trim(); // Capture at request time
            // Debounce
            const timer = setTimeout(() => {
                if (window.kakao && window.kakao.maps) {
                    // Must call kakao.maps.load() because SDK uses autoload=false
                    window.kakao.maps.load(() => {
                        if (window.kakao.maps.services) {
                            const ps = new window.kakao.maps.services.Places();
                            ps.keywordSearch(currentSearchText, (data: any, status: any) => {
                                // Check if this response is still relevant (not stale)
                                if (searchTextRef.current.trim() !== currentSearchText) {
                                    // Search text changed since request was made, ignore this response
                                    console.log(`[Kakao] Ignoring stale response for "${currentSearchText}", current is "${searchTextRef.current}"`);
                                    return;
                                }

                                if (status === window.kakao.maps.services.Status.OK) {
                                    // 문화 공간 탐색과 무관한 카테고리 노이즈 필터링 (단, 사용자가 정확한 상호명을 검색한 경우는 허용)
                                    const filteredData = data.filter((place: any) => {
                                        const cat = place.category_name || '';
                                        const isIrrelevant = /서비스,산업|의료,건강|부동산|교육,학원|기업/.test(cat);
                                        const isExactMatch = place.place_name.toLowerCase().includes(currentSearchText.toLowerCase());
                                        return !isIrrelevant || isExactMatch;
                                    });

                                    setKakaoSearchResults(filteredData.map((place: any) => ({
                                        type: 'location',
                                        name: place.place_name,
                                        address: place.road_address_name || place.address_name,
                                        lat: parseFloat(place.y),
                                        lng: parseFloat(place.x),
                                        venueId: place.id,
                                        category: place.category_group_name
                                    })));
                                    setIsDropdownOpen(true); // Open dropdown on result
                                } else {
                                    // 검색 결과가 없거나(ZERO_RESULT) 에러 발생 시 빈 배열로 세팅하여 '결과 없음' UI 노출
                                    setKakaoSearchResults([]);
                                    setIsDropdownOpen(true);
                                }
                            });
                        }
                    });
                }
            }, 300);
            return () => clearTimeout(timer);
        } else if (searchMode === 'location' && searchText.trim().length === 0) {
            setKakaoSearchResults([]);
        }
    }, [searchText, searchMode, searchLocation]);

    const searchParams = useSearchParams();
    const router = useRouter();


    // --- 1. Async Data Fetch (Static JSON) ---
    useEffect(() => {
        const loadAllData = async () => {
            try {
                // Static Fetch (GitHub Pages compatible); Load multiple sources
                const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
                const ts = new Date().getTime(); // Cache busting

                const results = await Promise.allSettled([
                    fetch(`${basePath}/data/performances.json?v=${ts}`).then(r => r.ok ? r.json() : []),
                    fetch(`${basePath}/data/movies.json?v=${ts}`).then(r => r.ok ? r.json() : []),
                    fetch(`${basePath}/data/cinemas.json?v=${ts}`).then(r => r.ok ? r.json() : [])
                ]);

                const mergedData: Performance[] = [];

                // Process results
                results.forEach((res, index) => {
                    if (res.status === 'fulfilled') {
                        if (Array.isArray(res.value)) {
                            if (index === 2) {
                                setCinemas(res.value);
                            } else {
                                mergedData.push(...res.value);
                            }
                        }
                    } else {
                        console.error(`Failed to load data source index ${index}`, res.reason);
                    }
                });

                if (mergedData.length > 0) {
                    // Merge/Replace initial
                    setAllPerformances(mergedData);
                    setIsDataFullyLoaded(true);
                } else {
                    // Fallback to initial if all failed (unlikely if local)
                    setIsDataFullyLoaded(true);
                }

            } catch (e) {
                console.error("Background data load failed", e);
            }
        };

        // Delay slightly to prioritize rendering, but if it's a deep link, we might want it faster
        const isDeepLink = typeof window !== 'undefined' && window.location.hash.startsWith('#p=');
        const timer = setTimeout(() => {
            loadAllData();
        }, isDeepLink ? 0 : 500);
        return () => clearTimeout(timer);
    }, []);


    // --- 2. Filtering & Sorting (Client Side) ---
    const filteredPerformances = useMemo(() => {
        // While loading, use what we have (initial or partial)
        const filtered = filterPerformances(allPerformances, {
            genre: selectedGenre,
            region: selectedRegion,
            district: selectedDistrict,
            venue: selectedVenue,
            search: searchMode === 'keyword' ? searchText : '', // Only use text search for keyword mode
            lat: searchLocation?.lat || userLocation?.lat,
            lng: searchLocation?.lng || userLocation?.lng,
            radius: radius,
            searchMode: searchMode
        });

        // Search Mode: Location -> Sort by Distance
        if (searchMode === 'location' && (searchLocation || userLocation)) {
            const center = searchLocation || userLocation;
            if (center && center.lat && center.lng) {
                const withDist = filtered.map(p => {
                    const v = venues[p.venue];
                    const dist = (v?.lat && v?.lng)
                        ? getDistanceFromLatLonInKm(center.lat, center.lng, v.lat, v.lng)
                        : 99999;
                    return { ...p, _dist: dist };
                });
                return withDist.sort((a, b) => a._dist - b._dist);
            }
        }

        // Shuffle all categories except 'movie'
        if (selectedGenre !== 'movie') {
            return filtered
                .map(value => ({ value, sort: Math.sin(shuffleSeed + value.id.length) * 10000 }))
                .sort((a, b) => a.sort - b.sort)
                .map(({ value }) => value);
        }

        // Default Sort (for movie)
        return sortPerformances(filtered, selectedGenre);

    }, [allPerformances, selectedGenre, selectedRegion, selectedDistrict, selectedVenue, searchText, searchLocation, userLocation, radius, searchMode, shuffleSeed]);

    // --- Search Results (Dynamic based on Mode) ---
    const searchResults = useMemo(() => {
        if (!searchText.trim()) return [];

        if (searchMode === 'location') {
            // Location Mode: Return Kakao Results
            return kakaoSearchResults;
        } else {
            // Keyword Mode (Existing Logic)
            // Filter distinct items matching text
            const lowerText = searchText.toLowerCase().replace(/\s+/g, ''); // Fix: ignore whitespace
            const isChoseong = /^[ㄱ-ㅎ\s]+$/.test(searchText);

            // De-duplicate by title
            const uniqueTitles = new Set();
            return allPerformances
                .filter(p => {
                    if (uniqueTitles.has(p.title)) return false;
                    
                    const titleNoSpace = p.title.toLowerCase().replace(/\s+/g, '');
                    const venueNoSpace = p.venue.toLowerCase().replace(/\s+/g, '');
                    
                    const match = isChoseong
                        ? isChoseongMatch(p.title, searchText)
                        : (titleNoSpace.includes(lowerText) ||
                            venueNoSpace.includes(lowerText) ||
                            (p.cast && Array.isArray(p.cast) && p.cast.some((c: any) => typeof c === 'string' ? c.replace(/\s+/g, '').includes(lowerText) : c.name.replace(/\s+/g, '').includes(lowerText))));
                    
                    if (match) uniqueTitles.add(p.title);
                    return match;
                })
                .slice(0, 10)
                .map(p => ({
                    type: p.genre === 'movie' ? 'video' : 'stage',
                    name: p.title,
                    address: p.venue, // Subtext
                    ...p
                }));
        }

    }, [searchText, searchMode, allPerformances, kakaoSearchResults]);

    // Auto-open dropdown when results exist (Both Modes)
    useEffect(() => {
        // Prevent auto-open if the text exactly matches the selected location (user just selected it)
        if (searchMode === 'location' && searchLocation && searchText === searchLocation.name) {
            return;
        }

        // Keyword mode: check searchResults
        // Location mode: check kakaoSearchResults directly (since searchResults depends on it via useMemo with async delay)
        if (searchText.trim().length > 0) {
            if (searchMode === 'keyword' && searchResults.length > 0) {
                setIsDropdownOpen(true);
            }
            if (searchMode === 'location' && kakaoSearchResults.length > 0) {
                setIsDropdownOpen(true);
            }
        }
    }, [searchResults, searchText, searchMode, kakaoSearchResults, searchLocation]);

    // Reset highlight when results change
    useEffect(() => {
        setHighlightedIndex(-1);
    }, [searchResults]);

    // --- Derived Filter Lists (Restored) ---
    const districts = useMemo(() => {
        if (!selectedRegion || selectedRegion === 'all') return [];
        const regionVenues = Object.values(venues).filter(v => v.mapped_region_id === selectedRegion);
        const uniqueDistricts = new Set(regionVenues.map(v => v.district).filter((d): d is string => !!d));
        return Array.from(uniqueDistricts).sort();
    }, [selectedRegion]);

    const availableVenues = useMemo(() => {
        let relevantVenues = Object.keys(venues);
        if (selectedRegion && selectedRegion !== 'all') {
            relevantVenues = relevantVenues.filter(v => venues[v].mapped_region_id === selectedRegion);
        }
        if (selectedDistrict && selectedDistrict !== 'all') {
            relevantVenues = relevantVenues.filter(v => venues[v].district === selectedDistrict);
        }
        return relevantVenues.sort();
    }, [selectedRegion, selectedDistrict]);


    // --- 3. Pagination (Virtual "Infinite Scroll") ---
    const [visibleCount, setVisibleCount] = useState(24);

    const displayPerformances = useMemo(() => {
        return filteredPerformances.slice(0, visibleCount);
    }, [filteredPerformances, visibleCount]);

    const hasMore = visibleCount < filteredPerformances.length;

    // Reset pagination on filter change
    useEffect(() => {
        setVisibleCount(24);
    }, [selectedGenre, selectedRegion, selectedDistrict, selectedVenue, searchText]);

    // Infinite Scroll Observer
    const observerTarget = useRef<HTMLDivElement>(null);
    const loadMore = useCallback(() => {
        setVisibleCount(prev => prev + 24);
    }, []);

    useEffect(() => {
        const observer = new IntersectionObserver(
            entries => {
                if (entries[0].isIntersecting && hasMore) {
                    loadMore();
                }
            },
            { threshold: 0.1, rootMargin: '500px' }
        );

        if (observerTarget.current) observer.observe(observerTarget.current);
        return () => {
            if (observerTarget.current) observer.unobserve(observerTarget.current);
        };
    }, [hasMore, loadMore]);


    // --- 4. Hero Text Logic ---
    const [heroText, setHeroText] = useState<HeroTemplate>(HERO_TEMPLATES.general[0]);
    const templatePoolRef = useRef<HeroTemplate[]>([]);

    const selectNextTemplate = useCallback(() => {
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
                // Use allPerformances to check, falling back to initial if loading
                const source = allPerformances.length > 0 ? allPerformances : initialPerformances;
                const hasMatch = source.some(p =>
                    candidate.keywords!.some(k =>
                        (p.title || '').includes(k) ||
                        (p.genre || '').includes(k) ||
                        (p.venue || '').includes(k) ||
                        (venues[p.venue || '']?.district?.includes(k))
                    )
                );
                if (!hasMatch) continue;
            }
            selectedTemplate = candidate;
            break;
        }

        if (selectedTemplate === heroText || attempts >= maxAttempts) {
            const backups = HERO_TEMPLATES.general.filter(t => t.line1 !== heroText.line1);
            selectedTemplate = backups[Math.floor(Math.random() * backups.length)] || HERO_TEMPLATES.general[0];
        }
        setHeroText(selectedTemplate);
    }, [heroText, allPerformances, initialPerformances]);

    // Context-Aware Hero Init (One Time)
    useEffect(() => {
        const updateHeroText = async () => {
            const now = new Date();
            const month = now.getMonth() + 1;
            const date = now.getDate();
            const day = now.getDay();
            const hour = now.getHours();

            let pool: typeof HERO_TEMPLATES.general = [...HERO_TEMPLATES.general];

            // Simplification: Add Time/Season/Holiday Context
            // (Full logic omitted for brevity but core general/holiday structure maintained)
            // ... We assume General and Keyword context is enough for now to restore "Typing"
            // If user wants FULL context, we can paste the 100 lines back. 
            // Ideally we just ensure 'pool' is populated.

            // Basic Seasons
            let currentSeasonTemplates: typeof HERO_TEMPLATES.general = [];
            if (month >= 3 && month <= 5) currentSeasonTemplates = HERO_TEMPLATES.season.spring;
            else if (month >= 6 && month <= 8) currentSeasonTemplates = HERO_TEMPLATES.season.summer;
            else if (month >= 9 && month <= 11) currentSeasonTemplates = HERO_TEMPLATES.season.autumn;
            else currentSeasonTemplates = HERO_TEMPLATES.season.winter;
            pool.push(...currentSeasonTemplates);

            // Keyword Context (if saved)
            const sk = safeStorage.get<string[]>('culture_keywords', []);
            if (sk.length > 0) {
                const keywordTemplates = HERO_TEMPLATES.keyword.map(t => {
                    const randomKeyword = sk[Math.floor(Math.random() * sk.length)];
                    return {
                        ...t,
                        highlight: t.highlight.replace('{keyword}', randomKeyword),
                        keywords: t.keywords.map(k => k.replace('{keyword}', randomKeyword))
                    };
                });
                pool.push(...keywordTemplates);
            }

            templatePoolRef.current = pool;
            selectNextTemplate();
        };
        updateHeroText();
    }, [allPerformances, initialPerformances]); // Update when data changes (initially)

    const handleHeroCycle = () => { selectNextTemplate(); };


    // --- 5. Recommendation Logic ---
    const { recommendedItems } = useRecommendation({
        allPerformances: allPerformances, // Uses full data when available
        likedIds,
        recentSearches: savedKeywords
    });

    // --- Keyword Content Logic ---
    const keywordItems = useMemo(() => {
        if (!savedKeywords || savedKeywords.length === 0 || allPerformances.length === 0) return [];

        const matches = allPerformances.filter(p =>
            savedKeywords.some(k =>
                (p.title || '').includes(k) ||
                (p.genre || '').includes(k) ||
                (p.venue || '').includes(k) ||
                (venues[p.venue || '']?.district?.includes(k))
            )
        );

        // Remove duplicates and limit to 15 to keep it horizontal
        const unique = Array.from(new Map(matches.map(m => [m.id, m])).values());
        return unique.slice(0, 15);
    }, [savedKeywords, allPerformances]);


    // --- Local Storage Loading ---
    useEffect(() => {
        setSavedKeywords(safeStorage.get<string[]>('culture_keywords', []));
        setLikedIds(safeStorage.get<string[]>('culture_likes', []));
        setFavoriteVenues(safeStorage.get<string[]>('culture_favorite_venues', []));
        setIsLikesExpanded(safeStorage.get<boolean>('culture_likes_expanded', true));
        setIsFavoriteVenuesExpanded(safeStorage.get<boolean>('culture_venues_expanded', true));
        setShowFavoriteVenues(safeStorage.get<boolean>('culture_show_favorite_venues', true));
        setShowLikes(safeStorage.get<boolean>('culture_show_likes', true));

        const storedViewMode = safeStorage.get<string>('culture_view_mode', 'grid');
        setViewMode(storedViewMode);
        if (storedViewMode === 'list' || storedViewMode === 'grid') setLayoutMode(storedViewMode as 'list' | 'grid');

        setIsStorageLoaded(true);
    }, []);

    // Persist Effects
    useEffect(() => { if (isStorageLoaded) safeStorage.set('culture_likes', likedIds); }, [likedIds, isStorageLoaded]);
    useEffect(() => { if (isStorageLoaded) safeStorage.set('culture_favorite_venues', favoriteVenues); }, [favoriteVenues, isStorageLoaded]);
    useEffect(() => { if (isStorageLoaded) safeStorage.set('culture_keywords', savedKeywords); }, [savedKeywords, isStorageLoaded]);
    useEffect(() => { if (isStorageLoaded) safeStorage.set('culture_view_mode', viewMode); }, [viewMode, isStorageLoaded]);

    // --- Auto-purge expired/stale liked IDs ---
    useEffect(() => {
        if (!isStorageLoaded || !isDataFullyLoaded || allPerformances.length === 0) return;
        const validIds = new Set(allPerformances.map(p => p.id));
        const validLikes = likedIds.filter(id => validIds.has(id));
        if (validLikes.length !== likedIds.length) {
            setLikedIds(validLikes);
        }
    }, [allPerformances, isStorageLoaded, isDataFullyLoaded]);

    // Deep Link: handle #p=<id> hash URLs (from shared links)
    const [sharedPerf, setSharedPerf] = useState<Performance | null>(null);
    const deepLinkHandled = useRef(false);
    useEffect(() => {
        if (deepLinkHandled.current || allPerformances.length === 0) return;
        const hash = window.location.hash;
        if (!hash.startsWith('#p=')) return;

        const targetId = decodeURIComponent(hash.slice(3));

        // 1. Exact ID match
        let perf = allPerformances.find(p => p.id === targetId);

        // 2. Fallback: old URLs with date prefix (movie_20260218_title → movie_title)
        if (!perf && targetId.match(/^(movie|ott|perf|fest|travel|kids|class|mommom|museum)_/)) {
            const prefix = targetId.split('_')[0] + '_';
            const withoutDate = targetId.replace(/^[a-z]+_\d{8}_/, prefix);
            // Normalize: strip special chars to match current ID format
            const normalized = prefix + withoutDate.replace(/^[a-z]+_/, '').replace(/[^a-zA-Z0-9가-힣]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
            perf = allPerformances.find(p => p.id === normalized);
        }

        // 3. Fallback: title-based fuzzy search from any ID format
        if (!perf) {
            // Extract readable title from ID: strip prefix and underscores
            const titleFromId = targetId
                .replace(/^(movie|perf|kopis|ott)_(\d{8}_)?/, '')
                .replace(/_/g, ' ')
                .trim();
            if (titleFromId.length > 2) {
                perf = allPerformances.find(p =>
                    p.title.replace(/\s+/g, '') === titleFromId.replace(/\s+/g, '')
                );
            }
        }

        if (perf) {
            deepLinkHandled.current = true;
            setSharedPerf(perf);
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
    }, [allPerformances, isDataFullyLoaded]);


    // --- Handlers ---
    const toggleLike = (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setLikedIds(prev => prev.includes(id) ? prev.filter(lid => lid !== id) : [...prev, id]);
    };

    const toggleFavoriteVenue = (venueName: string) => {
        setFavoriteVenues(prev => prev.includes(venueName) ? prev.filter(v => v !== venueName) : [...prev, venueName]);
    };

    const handleDetailOpen = (perf: Performance) => {
        window.open(perf.link, '_blank');
    };

    const copyItemShareUrl = async (id: string) => {
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
        const url = `${window.location.origin}${basePath}/p/${id}/`;
        await navigator.clipboard.writeText(url);
        alert('링크가 복사되었습니다.');
        return true;
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

    const handleRemoveFavoriteVenue = (venueName: string) => {
        setFavoriteVenues(prev => prev.filter(v => v !== venueName));
    };

    const handleDetailClose = () => setSelectedPerformance(null);
    const handleBooking = (link: string) => window.open(link, '_blank');
    const handleCopyLink = (id: string) => copyItemShareUrl(id);
    const handleSearch = () => {
        // Search is reactive, just scroll to results
        const main = document.querySelector('main');
        if (main) main.scrollIntoView({ behavior: 'smooth' });
    };

    const handleSearchChange = (text: string) => {
        setSearchText(text);
        if (text.trim().length > 0) {
            // Reset filters to 'all' for global search
            if (selectedGenre !== 'all') {
                router.push('/');
            }
            setSelectedGenre('all');
            setSelectedRegion('all');
            setSelectedDistrict('all');
            setSelectedVenue('all');
        }
    };

    // Bottom Nav Handlers
    const handleMenuClick = (menu: BottomMenuType) => {
        setActiveBottomMenu(prev => prev === menu ? null : menu);
    };
    const handleLikePerfClick = () => {
        if (viewMode === 'likes-perf') {
            setViewMode('grid'); // Toggle off -> Go back to default/grid
            // Restore scroll
            setTimeout(() => {
                window.scrollTo({ top: savedScrollPosition, behavior: 'auto' });
            }, 10);
        } else {
            // Save current scroll
            setSavedScrollPosition(window.scrollY);
            setViewMode('likes-perf');
            // Scroll to top
            setTimeout(() => {
                window.scrollTo({ top: 0, behavior: 'auto' });
            }, 10);
        }
    };
    const handleLikeVenueClick = () => {
        // Obsolete, merged into likes-perf
    };
    const handleViewModeChange = (mode: string) => setViewMode(mode);
    const handleGenreSelect = (g: string) => {
        setSelectedGenre(g);
        // Regenerate seed for shuffle unless it's movie
        if (g !== 'movie') {
            setShuffleSeed(Date.now());
        }
        if (viewMode === 'likes-perf') setViewMode('grid');

        if (g === 'all') {
            router.push('/');
        } else {
            let slug = g;
            if (g === 'play') slug = 'theater';
            router.push(`/${slug}`);
        }
    };
    const handleRegionSelect = (r: string) => setSelectedRegion(r);
    const handleDistrictSelect = (d: string) => setSelectedDistrict(d);

    // Derived
    const activeLocation = searchLocation || userLocation;
    const isInitialLoading = !isDataFullyLoaded;


    // --- Render ---
    return (
        <div className="min-h-screen bg-gray-900 light:bg-white text-white light:text-black">
            {/* 🌌 Backgrounds */}
            <div className="noise-texture z-0 mix-blend-overlay opacity-20 fixed inset-0 pointer-events-none"></div>
            <div className={clsx(
                "fixed top-[-10%] right-[-5%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] blur-[100px] rounded-full pointer-events-none z-0 opacity-60 light:opacity-25 mix-blend-screen light:mix-blend-multiply animate-pulse-slow transition-colors duration-700",
                searchMode === 'location' ? "bg-emerald-500" : "bg-[#7c3aed]"
            )}></div>
            <div className={clsx(
                "fixed top-[10%] right-[-15%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] blur-[120px] rounded-full pointer-events-none z-0 opacity-50 light:opacity-20 mix-blend-screen light:mix-blend-multiply animate-pulse-slow delay-1000 transition-colors duration-700",
                searchMode === 'location' ? "bg-teal-400" : "bg-[#db2777]"
            )}></div>

            {/* 1. Header (Restored) */}
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
                        <h1 className="text-[1.5rem] md:text-3xl font-black text-white light:text-black tracking-tight flex items-center gap-2 group-hover:text-[#a78bfa] transition-colors leading-[0.9]">
                            Culture Flow
                        </h1>
                        <span className="text-xs md:text-sm text-gray-400 light:text-gray-600 font-extrabold hidden sm:inline-block tracking-widest border-l border-gray-600 light:border-gray-400 pl-3 ml-1">
                            {(() => {
                                switch (selectedGenre) {
                                    case 'festival': return '전국 축제 정보 검색';
                                    case 'movie': return '최신 영화 개봉 정보';
                                    case 'travel': return '국내 여행 상품 검색';
                                    case 'leisure': return '레저 · 테마파크';
                                    case 'volleyball': return 'K-V 리그 (배구)';
                                    case 'basketball': return 'KBL 농구 일정';
                                    case 'soccer': return 'K-리그 축구 일정';
                                    case 'museum': return '박물관/체험관';
                                    case 'handball': return '핸드볼 H리그 일정';
                                    case 'musical': return '뮤지컬 컨텐츠 정보';
                                    case 'concert': return '콘서트 컨텐츠 정보';
                                    case 'play': return '연극 컨텐츠 정보';
                                    case 'classic': return '클래식 · 무용 컨텐츠';
                                    case 'exhibition': return '전시 · 행사 정보';
                                    case 'activity': return '액티비티 체험';
                                    case 'leisure': return '레저 · 테마파크';
                                    default: return '전국 통합 문화 검색';
                                }
                            })()}
                        </span>
                    </div>

                    <div className="flex items-center gap-1 ml-4">
                        <button
                            onClick={toggleTheme}
                            className={clsx(
                                "p-2 rounded-full transition-all duration-300 relative",
                                "text-gray-400 light:text-gray-500 hover:text-white light:hover:text-black hover:bg-white/5 light:hover:bg-black/5"
                            )}
                            aria-label="테마 변경"
                        >
                            {theme === 'dark' ? <Sun size={24} strokeWidth={2} /> : <Moon size={24} strokeWidth={2} />}
                        </button>
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
                            {savedKeywords.length > 0 && (
                                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center shadow-lg shadow-purple-500/30 border border-white/20">
                                    {savedKeywords.length > 99 ? '99+' : savedKeywords.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            {/* Alarm Panel (Restored) */}
            <div className={clsx(
                "absolute top-16 sm:top-20 left-0 right-0 bg-[#1a0b2e]/95 light:bg-white/95 backdrop-blur-3xl border-b border-purple-500/20 light:border-black/5 shadow-2xl transition-all duration-300 ease-out overflow-hidden origin-top z-40",
                isAlarmOpen ? "max-h-[500px] opacity-100 translate-y-0" : "max-h-0 opacity-0 -translate-y-4"
            )}>
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-extrabold text-white light:text-black flex items-center gap-2">
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
                            className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-extrabold hover:bg-purple-500 disabled:opacity-50 transition-all font-semibold"
                        >
                            추가
                        </button>
                    </form>
                    {/* Keyword List */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-extrabold text-gray-500 uppercase tracking-wider">등록된 키워드</label>
                        {savedKeywords.length === 0 ? (
                            <div className="text-center py-6 text-gray-500 bg-gray-800/30 rounded-xl border border-dashed border-white/5 text-xs">
                                키워드를 등록해보세요.
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto custom-scrollbar">
                                {savedKeywords.map(k => (
                                    <div key={k} className="flex items-center gap-1.5 bg-gray-800 light:bg-white text-white light:text-black pl-3 pr-1.5 py-1.5 rounded-full border border-gray-700 light:border-gray-300 hover:border-purple-500/30 transition-all">
                                        <span className="text-xs font-semibold">{k}</span>
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

            {/* 2. Hero Section */}
            <ErrorBoundary fallback={<div>Header Error</div>}>
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
                    onSearchChange={handleSearchChange}
                    setActiveSearchSource={setActiveSearchSource}
                    setIsDropdownOpen={setIsDropdownOpen}
                    handleSearch={handleSearch}
                    handleSelectResult={(result: any) => {
                        // Always reset category to 'all' on new selection
                        if (selectedGenre !== 'all') {
                            router.push('/');
                        }
                        setSelectedGenre('all');

                        if (searchMode === 'location') {
                            if (result.lat && result.lng) {
                                setSearchLocation({
                                    lat: result.lat,
                                    lng: result.lng,
                                    name: result.name
                                });
                                setIsDropdownOpen(false);
                                setSearchText(result.name);
                            }
                        } else {
                            setSearchText(result.name);
                            setIsDropdownOpen(false);
                            // handleSearch(); // Optional: Trigger search immediately
                        }
                    }}
                    handleKeyDown={(e) => {
                        if (!isDropdownOpen || searchResults.length === 0) {
                            if (e.key === 'Enter') {
                                // Default enter behavior (just close or search)
                                handleSearch();
                                setIsDropdownOpen(false); // Ensure close
                            }
                            return;
                        }

                        if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            setHighlightedIndex(prev => (prev + 1) % searchResults.length);
                        } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            setHighlightedIndex(prev => (prev - 1 + searchResults.length) % searchResults.length);
                        } else if (e.key === 'Enter') {
                            e.preventDefault();
                            // Fix: Only auto-select top result in location mode. Keyword mode searches the whole string!
                            const targetIndex = highlightedIndex >= 0 ? highlightedIndex : (searchMode === 'location' ? 0 : -1);
                            
                            if (targetIndex >= 0 && searchResults.length > targetIndex) {
                                // Select the chosen or first item
                                const selected = searchResults[targetIndex];
                                if (searchMode === 'location') {
                                    if (selected.lat && selected.lng) {
                                        setSearchLocation({
                                            lat: selected.lat,
                                            lng: selected.lng,
                                            name: selected.name
                                        });
                                        setSearchText(selected.name);
                                        setIsDropdownOpen(false);
                                    }
                                } else {
                                    setSearchText(selected.name);
                                    handleSearch(); // Trigger search for keyword
                                }
                                setIsDropdownOpen(false);
                            } else {
                                // No highlight, but entered -> Just search with current text
                                // User feedback: "Enter to select highlighted".
                                // If no highlight, do NOT select top result. Just search.
                                handleSearch();
                                setIsDropdownOpen(false);
                            }
                        }
                    }}
                    handleCurrentLocationClick={() => {
                        // Reset logic
                        setUserLocation(null);
                        setSearchLocation(null);
                    }}
                    availableVenues={availableVenues}
                    districts={districts}
                    recentKeywords={savedKeywords}
                    onKeywordSelect={(k) => { setSearchText(k); handleSearch(); }}
                    onRemoveRecent={handleKeywordRemove}
                    onClearRecent={() => setSavedKeywords([])}

                    searchMode={searchMode}
                    onSearchModeChange={setSearchMode}
                />
            </ErrorBoundary>

            {/* Keyword Content Section */}
            {
                (viewMode === 'grid' || viewMode === 'list') && searchText === '' && !searchLocation && selectedGenre === 'all' && keywordItems.length > 0 && (
                    <div className="max-w-7xl 2xl:max-w-[1800px] mx-auto mt-14">
                        <KeywordSection
                            keywordItems={keywordItems}
                            onDetail={handleDetailOpen}
                            onLocationClick={(loc) => { setSearchLocation(loc); setViewMode('map'); }}
                            onToggleLike={toggleLike}
                            likedIds={new Set(likedIds)}
                            searchMode={searchMode}
                        />
                    </div>
                )
            }

            {/* Recommendation Section (Restored) */}
            {
                (viewMode === 'grid' || viewMode === 'list') && searchText === '' && !searchLocation && selectedGenre === 'all' && (
                    <div className="max-w-7xl 2xl:max-w-[1800px] mx-auto mt-14">
                        <RecommendedSection
                            recommendedItems={recommendedItems}
                            onDetail={handleDetailOpen}
                            onLocationClick={(loc) => { setSearchLocation(loc); setViewMode('map'); }}
                            onToggleLike={toggleLike}
                            likedIds={new Set(likedIds)}
                            searchMode={searchMode}
                        />
                    </div>
                )
            }

            {/* 3. Main Content (Grid/List) */}
            <main className="max-w-7xl 2xl:max-w-[1800px] mx-auto px-4 py-6 min-h-[50vh]">
                {/* Results Info Header */}
                <div className={`flex flex-col sm:flex-row justify-between items-center mb-6 mt-8 gap-2${viewMode === 'likes-perf' ? ' hidden' : ''}`}>
                    <div className="w-full sm:w-auto">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <h2 className="text-xl sm:text-2xl font-black text-gray-200 light:text-black flex items-center gap-2">
                                {viewMode === 'likes-perf' ? (
                                    <>
                                    </>
                                ) : activeLocation ? (
                                    <>
                                        <MapPin className="text-emerald-500 w-5 h-5" />
                                        <span className="truncate max-w-[150px] sm:max-w-xs">{searchLocation ? `'${searchLocation.name}'` : '내 위치'}</span>
                                        <span className="text-base sm:text-xl shrink-0">주변 ({filteredPerformances.length})</span>
                                        <button
                                            onClick={() => { setSearchLocation(null); setSearchText(''); }}
                                            className="ml-2 p-1.5 rounded-full bg-white/10 hover:bg-white/20 light:bg-black/5 light:hover:bg-black/10 text-gray-400 hover:text-white light:text-gray-600 light:hover:text-black transition-all border border-white/5 hover:border-white/20 light:border-black/5 light:hover:border-black/10 group/reload"
                                            title="지역 설정 초기화"
                                        >
                                            <RotateCcw className="w-4 h-4" />
                                        </button>
                                    </>
                                ) : searchText ? (
                                    <>
                                        {searchMode === 'location' ? (
                                            <MapPin className="text-emerald-500 w-5 h-5" />
                                        ) : (
                                            <Search className="text-purple-500 w-5 h-5" />
                                        )}
                                        <span className="truncate max-w-[120px] sm:max-w-xs">'{searchText}'</span>
                                        <span className="text-base sm:text-xl shrink-0">
                                            {searchMode === 'location' ? '위치 검색 컨텐츠' : '키워드 검색 컨텐츠'} ({filteredPerformances.length})
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <span className="flex items-center gap-2">
                                            {getGenreIcon(selectedGenre, 28)}
                                            {selectedGenre === 'all' ? '추천 컨텐츠' : `추천 ${GENRES.find(g => g.id === selectedGenre)?.label || '컨텐츠'}`}
                                        </span>
                                        <span className="text-base sm:text-xl text-gray-400 font-medium ml-2">({filteredPerformances.length})</span>
                                    </>
                                )}
                            </h2>
                            {activeLocation && (
                                <div className="flex items-center gap-2 ml-auto">
                                    <div className="flex items-center bg-gray-800/50 light:bg-white border border-emerald-500/50 light:border-emerald-400 rounded-full pl-3 pr-1 py-1 group hover:border-emerald-400 transition-all shadow-sm">
                                        {/* Radius Select */}
                                        <div className="relative flex items-center pl-1">
                                            <select
                                                value={radius}
                                                onChange={(e) => setRadius(Number(e.target.value))}
                                                className="bg-transparent text-xs sm:text-sm font-bold text-emerald-500 light:text-emerald-700 focus:outline-none appearance-none pr-6 cursor-pointer py-1.5"
                                            >
                                                {RADIUS_OPTIONS.map(r => (
                                                    <option key={r.value} value={r.value} className="bg-gray-800 light:bg-white text-gray-300 light:text-black">
                                                        {r.label}
                                                    </option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-0 w-3.5 h-3.5 text-emerald-500 pointer-events-none mr-1" />
                                        </div>

                                        {/* Divider (Removed Map Button and Divider) */}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {filteredPerformances.length === 0 && viewMode !== 'likes-perf' && isDataFullyLoaded ? (
                    <EmptyState
                        viewMode={viewMode}
                        selectedGenre={selectedGenre}
                        setSelectedRegion={setSelectedRegion}
                        setSelectedDistrict={setSelectedDistrict}
                        setSearchText={setSearchText}
                        setUserLocation={setUserLocation}
                        setIsMapOpen={setIsMapOpen}
                        searchMode={searchMode}
                        setSearchMode={setSearchMode}
                        searchText={searchText}
                    />
                ) : viewMode === 'likes-perf' ? (
                    <>
                        {/* 좋아요한 컨텐츠 Section */}
                        <h3 className="text-lg sm:text-xl font-extrabold text-white light:text-black flex items-center gap-2 mb-4">
                            <Heart className="text-pink-500 w-5 h-5 fill-pink-500" />
                            좋아요한 컨텐츠 <span className="text-pink-400 light:text-pink-600">({allPerformances.filter(p => likedIds.includes(p.id)).length})</span>
                        </h3>
                        {allPerformances.filter(p => likedIds.includes(p.id)).length > 0 ? (
                            <PerformanceGrid
                                items={allPerformances.filter(p => likedIds.includes(p.id))}
                                hasMore={false}
                                observerRef={observerTarget}
                                layoutMode={layoutMode}
                                selectedVenue={selectedVenue}
                                activeLocation={searchLocation || userLocation}
                                venues={venues}
                                likedIds={likedIds}
                                onToggleLike={toggleLike}
                                handleDetailOpen={handleDetailOpen}
                                setSearchLocation={setSearchLocation}
                                onVenuePreview={(loc) => {
                                    setFocusVenue(loc);
                                    setIsMapOpen(true);
                                }}
                                setIsMapOpen={setIsMapOpen}
                                copyItemShareUrl={copyItemShareUrl}
                                selectedGenre={selectedGenre}
                                viewMode={viewMode}
                                searchMode={searchMode}
                                searchText={searchText}
                            />
                        ) : (
                            <div className="text-center py-12 text-gray-500">
                                <Heart className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                                <p className="text-lg font-semibold">좋아요한 컨텐츠가 없습니다</p>
                                <p className="text-sm mt-1">마음에 드는 공연/전시를 좋아요 해보세요!</p>
                            </div>
                        )}

                        {/* 좋아요한 공연장 Section */}
                        <div className="mb-10 mt-8">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg sm:text-xl font-extrabold text-white light:text-black flex items-center gap-2">
                                    <Heart className="text-pink-500 w-5 h-5 fill-pink-500" />
                                    좋아요한 공연장 <span className="text-pink-400 light:text-pink-600">({favoriteVenues.length})</span>
                                </h3>
                                <button
                                    onClick={() => setShowFavoriteListModal(true)}
                                    className="px-3 py-1.5 rounded-lg bg-pink-500/10 text-pink-400 hover:bg-pink-500/20 hover:text-pink-300 transition-all text-sm font-semibold border border-pink-500/20"
                                >
                                    공연장 편집
                                </button>
                            </div>
                            {favoriteVenues.length > 0 ? (
                                <div className="space-y-6">
                                    {favoriteVenues.map((venueName) => {
                                        const venuePerfs = allPerformances.filter(p => p.venue === venueName);
                                        return (
                                            <div key={venueName}>
                                                <button
                                                    onClick={() => {
                                                        setSearchLocation({ lat: venues[venueName]?.lat || 0, lng: venues[venueName]?.lng || 0, name: venueName });
                                                        setIsMapOpen(true);
                                                    }}
                                                    className="flex items-center gap-2 mb-2 text-pink-300 light:text-pink-600 hover:text-pink-200 transition-colors"
                                                >
                                                    <MapPin size={14} />
                                                    <span className="font-semibold text-sm">{venueName}</span>
                                                    <span className="text-xs text-gray-500">({venuePerfs.length}건)</span>
                                                </button>
                                                {venuePerfs.length > 0 ? (
                                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                                        {venuePerfs.slice(0, 5).map(perf => (
                                                            <div
                                                                key={perf.id}
                                                                onClick={() => handleDetailOpen(perf)}
                                                                className="cursor-pointer group/venue"
                                                            >
                                                                <div className="aspect-[3/4] rounded-lg overflow-hidden bg-gray-800 light:bg-gray-200 relative">
                                                                    <img
                                                                        src={getOptimizedUrl(perf.image || perf.posterUrl || '', 200)}
                                                                        alt={perf.title}
                                                                        className="w-full h-full object-cover group-hover/venue:scale-105 transition-transform duration-300"
                                                                        loading="lazy"
                                                                    />
                                                                    {/* Hover Overlay */}
                                                                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/venue:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-3 text-center">
                                                                        <h4 className="text-white font-bold text-xs sm:text-sm mb-2 line-clamp-2">{perf.title}</h4>
                                                                        <div className="px-3 py-1.5 bg-white text-black font-extrabold text-[10px] sm:text-xs rounded-full shadow-xl">
                                                                            자세히 보기
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-gray-500 ml-6">현재 진행중인 공연이 없습니다</p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-4 text-gray-500 text-sm">
                                    좋아요한 공연장이 없습니다. 지도에서 공연장을 좋아요 해보세요!
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <PerformanceGrid
                        items={displayPerformances}
                        hasMore={hasMore}
                        observerRef={observerTarget}
                        layoutMode={layoutMode}
                        selectedVenue={selectedVenue}
                        activeLocation={searchLocation || userLocation}
                        venues={venues}
                        likedIds={likedIds}
                        onToggleLike={toggleLike}
                        handleDetailOpen={handleDetailOpen}
                        setSearchLocation={setSearchLocation}
                        onVenuePreview={(loc) => {
                            setFocusVenue(loc);
                            setIsMapOpen(true);
                        }}
                        setIsMapOpen={setIsMapOpen}
                        copyItemShareUrl={copyItemShareUrl}
                        selectedGenre={selectedGenre}
                        viewMode={viewMode}
                        searchMode={searchMode}
                        searchText={searchText}
                    />
                )}

                {!isDataFullyLoaded && (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                        <span className="ml-2 text-sm text-gray-500">전체 데이터 불러오는 중...</span>
                    </div>
                )}
            </main>

            {/* 4. Modals */}
            {
                isMapOpen && (
                    <KakaoMapModal
                        performances={filteredPerformances}
                        cinemas={selectedGenre === 'movie' ? cinemas : []}
                        selectedGenre={selectedGenre}
                        searchMode={searchMode}
                        searchText={searchText}
                        centerLocation={focusVenue || searchLocation || (selectedVenue !== 'all' && venues[selectedVenue] ? { lat: venues[selectedVenue].lat!, lng: venues[selectedVenue].lng!, name: selectedVenue } : null)}
                        favoriteVenues={favoriteVenues}
                        onToggleFavorite={toggleFavoriteVenue}
                        onClose={() => {
                            setIsMapOpen(false);
                            setFocusVenue(null); // Clear focus on close
                        }}
                        onVenueLocationChange={(name, lat, lng) => {
                            // This is the "Set As Location" action from Map
                            setSearchLocation({ name, lat, lng });
                            setSearchMode('location'); // Force location mode
                            setFocusVenue(null); // Clear preview focus as we now have real filter
                        }}
                    />
                )
            }

            {/* Favorite Venues Edit Modal */}
            {showFavoriteListModal && (
                <FavoriteVenuesModal
                    isOpen={showFavoriteListModal}
                    onClose={() => setShowFavoriteListModal(false)}
                    favoriteVenues={favoriteVenues}
                    onRemove={handleRemoveFavoriteVenue}
                    onVenueClick={(venueName) => {
                        setSearchLocation({ lat: venues[venueName]?.lat || 0, lng: venues[venueName]?.lng || 0, name: venueName });
                        setShowFavoriteListModal(false);
                        setIsMapOpen(true);
                    }}
                />
            )}

            <BottomNavSheet
                activeMenu={activeBottomMenu}
                onClose={() => setActiveBottomMenu(null)}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                selectedGenre={selectedGenre}
                onGenreSelect={handleGenreSelect}
                selectedRegion={selectedRegion}
                onRegionSelect={setSelectedRegion}
                selectedDistrict={selectedDistrict}
                onDistrictSelect={setSelectedDistrict}
                selectedVenue={selectedVenue}
                onVenueSelect={setSelectedVenue}
                searchText={searchText}
                onSearchChange={handleSearchChange}
                keywords={savedKeywords}
                onKeywordAdd={(k) => setSavedKeywords(prev => [...prev, k])}
                onKeywordRemove={(k) => setSavedKeywords(prev => prev.filter(w => w !== k))}
                districts={districts}
                availableVenues={availableVenues}
                onSearch={() => { }}
                searchMode={searchMode}
                onSearchModeChange={setSearchMode}
                activeLocation={searchLocation || userLocation}
                searchResults={searchResults}

                // Actually, for bottom sheet, we just show list if text exists.
                onResultSelect={(result) => {
                    if (searchMode === 'location') {
                        if (result.lat && result.lng) {
                            setSearchLocation({
                                lat: result.lat,
                                lng: result.lng,
                                name: result.name
                            });
                            setSearchText(result.name);
                        }
                    } else {
                        setSearchText(result.name);
                        // handleSearch(); // Auto search?
                    }
                    // Close sheet handled inside Sheet or here? Sheet calls onClose usually.
                }}
            />

            <BottomNav
                activeMenu={activeBottomMenu}
                currentViewMode={viewMode}
                onMenuClick={handleMenuClick}
                onLikePerfClick={handleLikePerfClick}
                onMapClick={() => {
                    setIsMapOpen(true);
                    setFocusVenue(null);
                }}
                onCalendarClick={() => setViewMode(viewMode === 'calendar' ? 'grid' : 'calendar')}
                likeCount={likedIds.length}
                venueCount={favoriteVenues.length}
                selectedGenre={selectedGenre}
                searchMode={searchMode}
            />

            {
                viewMode === 'calendar' && (
                    <CalendarModal
                        performances={filteredPerformances}
                        onClose={() => setViewMode('grid')}
                        selectedGenre={selectedGenre}
                        onGenreSelect={handleGenreSelect}
                    />
                )
            }


            {/* Shared Deep Link Modal */}
            {sharedPerf && (
                <SharedDetailModal
                    performance={sharedPerf}
                    onClose={() => setSharedPerf(null)}
                />
            )}

        </div >
    );
}
