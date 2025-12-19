'use client';
// UI Deployment Trigger: 2025-12-12


import Link from 'next/link';
import { useState, useMemo, useEffect, useRef } from 'react';
import { Performance } from '@/types';
import { MapPin, Calendar, Search, Filter, X, ChevronDown, ChevronUp, Share2, Navigation, Star, Heart, LayoutGrid, List, CalendarDays, Map as MapIcon, RotateCcw, Link2, Check, Flame, Plane, Bell } from 'lucide-react';
import BuildingStadium from './BuildingStadium';
import { clsx } from 'clsx';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import venueData from '@/data/venues.json';
import { GENRES, REGIONS, RADIUS_OPTIONS, GENRE_STYLES } from '@/lib/constants';
import { getOptimizedUrl } from '@/lib/utils'; // Import centralized helper
import { motion, AnimatePresence } from 'framer-motion';
import LZString from 'lz-string';

const KakaoMapModal = dynamic(() => import('./KakaoMapModal'), { ssr: false });
const CalendarModal = dynamic(() => import('./CalendarModal'), { ssr: false });

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
}

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    var R = 6371; // Radius of the earth in km
    var dLat = deg2rad(lat2 - lat1);  // deg2rad below
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180)
}

// --- Text Templates for Hero Section ---
const HERO_TEMPLATES = {
    general: [
        { prefix: "특별한 오늘, 당신을 위한", highlight: "Spotlight", suffix: "는 어디일까요?" },
        { prefix: "반복되는 일상 속, 당신을 위한", highlight: "새로운 영감", suffix: "은 어디일까요?" },
        { prefix: "감성이 메마른 날, 당신을 위한", highlight: "설레는 경험", suffix: "은 어디일까요?" },
        { prefix: "소중한 사람과 함께, 당신을 위한", highlight: "잊지 못할 추억", suffix: "은 어디일까요?" },
        { prefix: "혼자만의 시간이 필요할 때, 당신을 위한", highlight: "특별한 순간", suffix: "은 어디일까요?" },
        { prefix: "이번 주말, 당신을 위한", highlight: "취향 저격 공연", suffix: "은 어디일까요?" },
        { prefix: "문득 떠나고 싶은 지금, 당신을 위한", highlight: "뜻밖의 발견", suffix: "은 어디일까요?" }
    ],
    keyword: [
        { prefix: "드디어 오늘 기다리던", highlight: "{keyword}", suffix: "공연이 오픈했어요!" },
        { prefix: "요즘 가장 핫한", highlight: "{keyword}", suffix: "소식, 놓치지 않으셨나요?" },
        { prefix: "당신의 취향 저격,", highlight: "{keyword}", suffix: "컬렉션을 준비했습니다." },
        { prefix: "지금 딱 예매하기 좋은", highlight: "{keyword}", suffix: "공연을 만나보세요." },
        { prefix: "망설이면 늦어요!", highlight: "{keyword}", suffix: "인기 공연 총집합." }
    ],
    weather: {
        rain: [
            { prefix: "비 예보가 있는 오늘,", highlight: "촉촉한 감성", suffix: "공연 어떠신가요?" },
            { prefix: "우산 챙기셨나요?", highlight: "비 오는 날", suffix: "더 운치 있는 실내 데이트." },
            { prefix: "흐린 날씨엔 역시", highlight: "기분 전환", suffix: "공연이 최고죠." }
        ],
        snow: [
            { prefix: "하얀 눈이 내리는 날,", highlight: "포근한", suffix: "공연장에서 몸을 녹이세요." },
            { prefix: "온 세상이 하얀 오늘,", highlight: "따뜻한 감동", suffix: "을 만나보세요." }
        ],
        clear: [
            { prefix: "날씨 좋은 오늘,", highlight: "산책하듯", suffix: "즐기기 좋은 공연들을 모았어요." },
            { prefix: "화창한 하늘 아래,", highlight: "설레는 마음", suffix: "으로 공연장 나들이 어때요?" },
            { prefix: "오늘 같은 날씨엔", highlight: "야외 활동", suffix: "대신 시원한 공연장 데이트!" }
        ]
    }
};

export default function PerformanceList({ initialPerformances, lastUpdated }: PerformanceListProps) {
    const [selectedRegion, setSelectedRegion] = useState<string>('all');
    const [selectedDistrict, setSelectedDistrict] = useState<string>('all');
    const [selectedVenue, setSelectedVenue] = useState<string>('all');
    const [selectedGenre, setSelectedGenre] = useState<string>('all');
    const [isLikesExpanded, setIsLikesExpanded] = useState(true);
    const [isStorageLoaded, setIsStorageLoaded] = useState(false); // Guard against overwriting LS

    // Hero Text State (Hydration Safe: Start with Default, then randomize)
    const [heroText, setHeroText] = useState(HERO_TEMPLATES.general[0]);

    // Context-Aware Hero Text Logic
    useEffect(() => {
        const updateHeroText = async () => {
            const roll = Math.random(); // 0.0 ~ 1.0

            // 1. Keyword Check (40% chance if keywords exist)
            const savedKeywords: string[] = JSON.parse(localStorage.getItem('culture_keywords') || '[]');
            if (savedKeywords.length > 0 && roll < 0.4) {
                const randomKeyword = savedKeywords[Math.floor(Math.random() * savedKeywords.length)];
                const template = HERO_TEMPLATES.keyword[Math.floor(Math.random() * HERO_TEMPLATES.keyword.length)];
                setHeroText({
                    ...template,
                    highlight: template.highlight.replace('{keyword}', randomKeyword)
                });
                return;
            }

            // 2. Weather Check (30% chance - adjusted to 0.4~0.7 range)
            if (roll >= 0.4 && roll < 0.7) {
                try {
                    // Fetch Seoul Weather (Lightweight Open-Meteo API)
                    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780&current_weather=true');
                    const data = await res.json();
                    const code = data.current_weather?.weathercode; // WMO Code

                    let weatherType: 'rain' | 'snow' | 'clear' | null = null;

                    // WMO Codes
                    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) weatherType = 'rain'; // Drizzle / Rain
                    else if ([71, 73, 75, 77, 85, 86].includes(code)) weatherType = 'snow'; // Snow
                    else if (code === 0 || code === 1) weatherType = 'clear'; // Clear / Mainly Clear

                    if (weatherType && HERO_TEMPLATES.weather[weatherType]) {
                        const templates = HERO_TEMPLATES.weather[weatherType];
                        setHeroText(templates[Math.floor(Math.random() * templates.length)]);
                        return;
                    }
                } catch (e) {
                    // Fallback to general on error
                    console.log("Weather fetch failed, falling back to general.");
                }
            }

            // 3. Fallback: General (30% chance or fallback)
            setHeroText(HERO_TEMPLATES.general[Math.floor(Math.random() * HERO_TEMPLATES.general.length)]);
        };

        updateHeroText();
    }, []);

    // Debug Data Availability
    useEffect(() => {
        console.log(`[PerformanceList] Initial Count: ${initialPerformances.length}, Last Updated: ${lastUpdated}`);
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

    // Keyword Notification System
    const [keywords, setKeywords] = useState<string[]>([]);
    const [showKeywordInput, setShowKeywordInput] = useState(false);
    const [newKeyword, setNewKeyword] = useState('');

    useEffect(() => {
        // Consolidated Loader for all LocalStorage items
        const loadState = (key: string, setter: (val: any) => void) => {
            const saved = localStorage.getItem(key);
            if (saved) {
                try {
                    setter(JSON.parse(saved));
                } catch (e) {
                    console.error(`Failed to parse ${key}`, e);
                }
            }
        };

        loadState('culture_keywords', setKeywords);
        loadState('culture_likes', setLikedIds);
        loadState('culture_favorite_venues', setFavoriteVenues);
        loadState('culture_likes_expanded', setIsLikesExpanded);
        loadState('culture_venues_expanded', setIsFavoriteVenuesExpanded);

        setIsStorageLoaded(true);
    }, []);

    useEffect(() => {
        if (!isStorageLoaded) return;
        localStorage.setItem('culture_keywords', JSON.stringify(keywords));
    }, [keywords, isStorageLoaded]);

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
    const [likedIds, setLikedIds] = useState<string[]>([]);
    const [showLikes, setShowLikes] = useState(true);

    // Persist Likes Expanded State
    useEffect(() => {
        if (!isStorageLoaded) return;
        localStorage.setItem('culture_likes_expanded', JSON.stringify(isLikesExpanded));
    }, [isLikesExpanded, isStorageLoaded]);

    // Load Likes Expanded State (Removed - handled by consolidated loader)
    // Load Likes from LocalStorage (Removed - handled by consolidated loader)

    // Save Likes to LocalStorage
    // Save Likes to LocalStorage
    useEffect(() => {
        if (!isStorageLoaded) return;
        localStorage.setItem('culture_likes', JSON.stringify(likedIds));
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
    const [favoriteVenues, setFavoriteVenues] = useState<string[]>([]);
    const [isFavoriteVenuesExpanded, setIsFavoriteVenuesExpanded] = useState(true);

    // Initial Load for Favorite Venues Expanded State
    // Initial Load for Favorite Venues Expanded State (Removed - handled by consolidated loader)

    // Persist Favorite Venues Expanded State
    useEffect(() => {
        if (!isStorageLoaded) return;
        localStorage.setItem('culture_venues_expanded', JSON.stringify(isFavoriteVenuesExpanded));
    }, [isFavoriteVenuesExpanded, isStorageLoaded]);

    const [showFavoriteVenues, setShowFavoriteVenues] = useState(true); // Controls section visibility
    const [showFavoriteListModal, setShowFavoriteListModal] = useState(false); // Controls List Modal visibility
    const [layoutMode, setLayoutMode] = useState<'grid' | 'list'>('grid'); // Default to Grid (Thumbnail) view

    const [shareUrlCopied, setShareUrlCopied] = useState(false); // Share URL copy feedback
    const [sharedPerformanceId, setSharedPerformanceId] = useState<string | null>(null); // Shared Item ID

    // NEW: Notification System for New Keyword Matches
    const [newMatches, setNewMatches] = useState<Performance[]>([]);
    const [showNewMatchesModal, setShowNewMatchesModal] = useState(false);

    useEffect(() => {
        if (!isStorageLoaded || keywords.length === 0) return;

        // 1. Find all current matches
        const currentMatches = initialPerformances.filter(p =>
            keywords.some(k => p.title.toLowerCase().includes(k.toLowerCase()) || p.venue.toLowerCase().includes(k.toLowerCase()))
        );

        if (currentMatches.length === 0) return;

        // 2. Load Seen IDs
        const seenIds: string[] = JSON.parse(localStorage.getItem('culture_seen_keyword_matches') || '[]');

        // 3. Identify truly new items
        const newItems = currentMatches.filter(p => !seenIds.includes(p.id));

        if (newItems.length > 0) {
            setNewMatches(newItems);
            setShowNewMatchesModal(true);
        }
    }, [initialPerformances, keywords, isStorageLoaded]);

    const handleCloseNotification = () => {
        // Mark checked items as seen
        const seenIds: string[] = JSON.parse(localStorage.getItem('culture_seen_keyword_matches') || '[]');
        const newIds = newMatches.map(p => p.id);
        const updatedSeenIds = Array.from(new Set([...seenIds, ...newIds]));

        localStorage.setItem('culture_seen_keyword_matches', JSON.stringify(updatedSeenIds));
        setShowNewMatchesModal(false);
        setNewMatches([]);
    };

    // Share Item URL Generation
    const copyItemShareUrl = async (id: string) => {
        const baseUrl = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
        const url = `${baseUrl}#p=${id}`;

        try {
            await navigator.clipboard.writeText(url);
            setShareUrlCopied(true);
            setTimeout(() => setShareUrlCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy URL:', err);
            // Fallback
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
        localStorage.setItem('culture_favorite_venues', JSON.stringify(favoriteVenues));
    }, [favoriteVenues, isStorageLoaded]);

    const toggleFavoriteVenue = (venueName: string) => {
        setFavoriteVenues(prev =>
            prev.includes(venueName) ? prev.filter(v => v !== venueName) : [...prev, venueName]
        );
    };

    const favoriteVenuePerformances = useMemo(() => {
        return initialPerformances.filter(p => favoriteVenues.includes(p.venue));
    }, [initialPerformances, favoriteVenues]);



    const [isSticky, setIsSticky] = useState(false); // Track if filters are pinned to top
    const [isFilterExpanded, setIsFilterExpanded] = useState(true); // Toggle Detailed Search

    // New: Keyword Section Toggle
    const [isKeywordsExpanded, setIsKeywordsExpanded] = useState(true);

    // Auto-collapse logic: Collapse when sticky (top reached)
    useEffect(() => {
        if (isSticky) {
            setIsFilterExpanded(false);
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

    // Load Kakao Maps SDK for Search
    useEffect(() => {
        const scriptId = 'kakao-map-script';

        // internal handler
        const handleLoad = () => {
            window.kakao.maps.load(() => {
                setIsSdkLoaded(true);
            });
        };

        if (document.getElementById(scriptId)) {
            // Script already exists. Check if loaded.
            if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
                setIsSdkLoaded(true);
            } else {
                // Exist but might be loading? Add listener? 
                // It's safer to just assume it will load or is loaded.
                // We can manually trigger check or attach onload.
                const existingScript = document.getElementById(scriptId) as HTMLScriptElement;
                existingScript.addEventListener('load', handleLoad);
                // Fallback check
                setTimeout(() => {
                    if (window.kakao && window.kakao.maps) setIsSdkLoaded(true);
                }, 1000);
            }
            return;
        }

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=0236cfffa7cfef34abacd91a6d7c73c0&autoload=false&libraries=services`;
        script.async = true;

        script.onload = handleLoad;

        document.head.appendChild(script);

        return () => {
            // Cleanup listeners if strict, but script serves whole app.
        };
    }, []);

    // Handle Input Change (Real-time Text Filter)
    const handleSearchTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
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
        }
    };

    // Handle Search (Enter / Button -> Location Search)
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
        setSearchText(candidate.name); // Update input to selected name? User might want to refine.
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
            if (p.region !== selectedRegion) return;
            const v = venues[p.venue];
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
            if (selectedRegion !== 'all' && p.region !== selectedRegion) return;

            // If district is selected, filter by district
            if (selectedDistrict !== 'all') {
                const v = venues[p.venue];
                if (!v || v.district !== selectedDistrict) return;
            }

            distinctVenues.add(p.venue);
        });
        // Sort alphabetically
        return Array.from(distinctVenues).sort();
    }, [initialPerformances, selectedRegion, selectedDistrict]);

    const filteredPerformances = useMemo(() => {
        let results = initialPerformances.filter(p => {
            // 1. Region Filter
            if (selectedRegion !== 'all' && p.region !== selectedRegion) return false;

            // 2. Genre Filter
            if (selectedGenre === 'hotdeal') {
                const hasPrice = p.price && p.price.length > 0;
                const hasDiscount = p.discount && p.discount.length > 0;
                if (!hasPrice && !hasDiscount) return false;
            } else if (selectedGenre !== 'all' && p.genre !== selectedGenre) return false;

            // 3. District Filter (only if region is selected)
            if (selectedRegion !== 'all' && selectedDistrict !== 'all') {
                const v = venues[p.venue];
                if (!v || v.district !== selectedDistrict) return false;
            }

            // 3.5 Venue Filter
            if (selectedVenue !== 'all' && p.venue !== selectedVenue) return false;

            // 4. Radius Filter (if active location exists)
            if (activeLocation) {
                const v = venues[p.venue];
                if (v && v.lat && v.lng) {
                    const dist = getDistanceFromLatLonInKm(activeLocation.lat, activeLocation.lng, v.lat, v.lng);
                    if (dist > radius) return false;
                } else {
                    // Hide venues without coords if in radius mode
                    return false;
                }
            }

            // 5. Text Filter (Fallback if no location matched OR if we are just typing)
            // Logic: If searchLocation is SET, we ignore text filter (we show all nearby).
            // If searchLocation is NULL, we filter by searchText real-time.
            if (!searchLocation && debouncedSearchText) {
                const searchLower = debouncedSearchText.toLowerCase();
                return (
                    p.title.toLowerCase().includes(searchLower) ||
                    p.venue.toLowerCase().includes(searchLower)
                );
            }

            return true;
        });

        // SORTING: By Distance if activeLocation is set
        if (activeLocation) {
            results = results.sort((a, b) => {
                const vA = venues[a.venue];
                const vB = venues[b.venue];
                if (!vA?.lat || !vB?.lat) return 0;

                const distA = getDistanceFromLatLonInKm(activeLocation.lat, activeLocation.lng, vA.lat!, vA.lng!);
                const distB = getDistanceFromLatLonInKm(activeLocation.lat, activeLocation.lng, vB.lat!, vB.lng!);
                return distA - distB;
            });
        }

        // Secondary sort by Date
        results.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return results;
    }, [initialPerformances, debouncedSearchText, selectedRegion, selectedDistrict, selectedVenue, selectedGenre, radius, activeLocation, searchLocation]);

    // Split logic for Keyword Notification
    const { keywordMatches, normalPerformances } = useMemo(() => {
        if (keywords.length === 0) {
            return { keywordMatches: [], normalPerformances: filteredPerformances };
        }

        const matches: typeof filteredPerformances = [];
        const others: typeof filteredPerformances = [];

        filteredPerformances.forEach(p => {
            const isMatch = keywords.some(k => p.title.includes(k));
            if (isMatch) {
                matches.push(p);
            } else {
                others.push(p);
            }
        });

        return { keywordMatches: matches, normalPerformances: others };
    }, [filteredPerformances, keywords]);

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

    // View Mode State
    const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'map'>('list');








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

    return (
        <div
            className="min-h-screen bg-transparent text-gray-100 font-sans pb-20 relative"
        >
            {/* 🌌 Aurora Background */}
            {/* 🌌 Aurora Background Removed as per request */}
            {/* <div className="aurora-container ..."></div> */}
            <div className="noise-texture z-0 mix-blend-overlay opacity-20 fixed inset-0 pointer-events-none"></div>
            {/* Right-side Gradient Blobs (Neon & Saturated) */}
            <div className="fixed top-[-10%] right-[-5%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] bg-[#7c3aed] blur-[100px] rounded-full pointer-events-none z-0 opacity-60 mix-blend-screen animate-pulse-slow"></div>
            <div className="fixed top-[10%] right-[-15%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] bg-[#db2777] blur-[120px] rounded-full pointer-events-none z-0 opacity-50 mix-blend-screen animate-pulse-slow delay-1000"></div>
            {/* Header: Logo & Last Updated */}
            {/* Header */}
            <header className="relative z-[100] bg-gray-900/80 backdrop-blur-md border-b border-gray-700 mix-blend-lighten">
                <div className="max-w-7xl 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
                    <div
                        className="flex items-center gap-3 cursor-pointer group"
                        onClick={() => {
                            setSearchText('');
                            setSelectedRegion('all');
                            setSelectedDistrict('all');
                            setSelectedVenue('all');
                            setSelectedGenre('all');
                            setUserLocation(null);
                            setSearchLocation(null);
                            setSearchResults([]);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                            setIsFilterExpanded(true);
                        }}
                    >
                        <div className="relative w-10 h-10 transition-transform group-hover:scale-110 duration-300">
                            <Image
                                src="images/ticket_icon.png"
                                alt="Culture Flow Icon"
                                fill
                                className="object-cover"
                                sizes="40px"
                                priority
                            />
                        </div>
                        <h1 className="text-[1.5rem] md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2 group-hover:text-[#a78bfa] transition-colors leading-[0.9]">
                            Culture Flow
                        </h1>
                        <span className="text-xs md:text-sm text-gray-400 font-light hidden sm:inline-block tracking-widest border-l border-gray-600 pl-3 ml-1">
                            서울 · 경기 · 인천 통합 문화 검색
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* View Mode Toggles */}
                        <div className="flex gap-1 mix-blend-luminosity bg-black/20 p-1 rounded-full border border-white/5 backdrop-blur-sm">
                            {/* Combined Grid/List Toggle */}
                            <button
                                onClick={() => {
                                    if (viewMode !== 'list') {
                                        setViewMode('list');
                                    } else {
                                        setLayoutMode(prev => prev === 'grid' ? 'list' : 'grid');
                                    }
                                }}
                                className={clsx(
                                    "p-2 rounded-full hover:bg-white/10 transition-colors relative group",
                                    viewMode === 'list' ? "bg-white/20 text-white shadow-inner" : "text-gray-400"
                                )}
                                title={layoutMode === 'grid' ? "리스트 보기로 전환" : "썸네일 보기로 전환"}
                            >
                                {viewMode === 'list' && layoutMode === 'list' ? (
                                    <LayoutGrid className="w-5 h-5" />
                                ) : (
                                    <List className="w-5 h-5" />
                                )}
                            </button>

                            <button onClick={() => setViewMode('calendar')} className={clsx("p-2 rounded-full hover:bg-white/10 transition-colors", viewMode === 'calendar' ? "bg-white/20 text-white" : "text-gray-400")} title="캘린더 보기"><CalendarDays className="w-5 h-5" /></button>
                            <button onClick={() => setViewMode('map')} className={clsx("p-2 rounded-full hover:bg-white/10 transition-colors", viewMode === 'map' ? "bg-white/20 text-white" : "text-gray-400")} title="지도 보기"><MapIcon className="w-5 h-5" /></button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <div className={clsx(
                "relative max-w-7xl 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-10 flex flex-col lg:flex-row justify-between lg:items-end gap-8",
                (isDropdownOpen && activeSearchSource === 'hero') ? "z-[120]" : "z-[60]"
            )}>
                <div className="text-left">
                    <p className="text-[#a78bfa] font-bold mb-3 flex items-center gap-2 text-sm md:text-base">
                        <MapPin className="w-4 h-4" /> 현재 위치: <span className="text-white border-b border-[#a78bfa]">
                            {activeLocation
                                ? (searchLocation ? searchLocation.name : '내 위치 (GPS)')
                                : (
                                    selectedRegion !== 'all'
                                        ? `${REGIONS.find(r => r.id === selectedRegion)?.label || ''} ${selectedDistrict !== 'all' ? selectedDistrict : ''} ${selectedVenue !== 'all' ? selectedVenue : ''}`.trim()
                                        : '전체 지역'
                                )
                            }
                        </span>

                        {/* Reset Location Button */}
                        {(activeLocation || selectedRegion !== 'all') && (
                            <button
                                onClick={() => {
                                    setSelectedRegion('all');
                                    setSelectedDistrict('all');
                                    setSelectedVenue('all');
                                    setUserLocation(null);
                                    setSearchLocation(null);
                                }}
                                className="ml-2 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white transition-all border border-white/5 hover:border-white/20 group/reload"
                                title="전체 지역으로 초기화"
                            >
                                <RotateCcw className="w-3.5 h-3.5 group-hover/reload:-rotate-180 transition-transform duration-500" />
                            </button>
                        )}
                    </p>
                    {/* Hero Text: 2 lines on PC, 4 lines on Mobile */}
                    {/* Hero Text: Dynamic */}
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-light text-white leading-[1.15] tracking-tighter hidden sm:block">
                        {heroText.prefix}<br />
                        <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#a78bfa] via-[#f472b6] to-[#a78bfa] animate-shine bg-[length:200%_auto] tracking-normal py-1">
                            {heroText.highlight}
                        </span>
                        {heroText.suffix}
                    </h2>
                    {/* Mobile: Dynamic (Simplified Layout) */}
                    <h2 className="text-4xl font-light text-white leading-[1.2] tracking-tighter block sm:hidden">
                        {heroText.prefix}<br />
                        <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#a78bfa] via-[#f472b6] to-[#a78bfa] animate-shine bg-[length:200%_auto] tracking-normal py-1">
                            {heroText.highlight}
                        </span><br />
                        {heroText.suffix}
                    </h2>
                    <div className="text-xs text-gray-500 font-mono mt-2 tracking-tighter">
                        {lastUpdated} 기준
                    </div>
                </div>

                {/* Hero Search Bar */}
                <div className="w-full lg:w-auto relative group z-[60]">
                    <div className="p-[3px] rounded-full bg-linear-to-r from-[#a78bfa] via-purple-500 to-[#f472b6] shadow-lg shadow-purple-500/20 transition-all duration-300 group-hover:shadow-purple-500/40 opacity-90 group-hover:opacity-100">
                        <div className="bg-[#0a0a0a] rounded-full flex items-center p-1 relative mix-blend-hard-light">
                            {/* Radius Select for Hero */}
                            {activeLocation && (
                                <div className="border-r border-gray-700 pr-0 mr-2 ml-3 relative flex items-center">
                                    <div className="pointer-events-none absolute right-2 flex flex-col items-center justify-center opacity-70">
                                        <ChevronUp className="w-2 h-2 text-gray-400" />
                                        <ChevronDown className="w-2 h-2 text-gray-400" />
                                    </div>
                                    <select
                                        value={radius}
                                        onChange={(e) => setRadius(Number(e.target.value))}
                                        className="bg-transparent text-green-400 text-sm font-bold focus:outline-none cursor-pointer appearance-none pl-1 pr-6 py-2"
                                    >
                                        {RADIUS_OPTIONS.map(r => (
                                            <option key={r.value} value={r.value} className="bg-gray-900 text-white">{r.label}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <input
                                type="text"
                                value={searchText}
                                onFocus={() => setActiveSearchSource('hero')}
                                onChange={handleSearchTextChange}
                                onKeyDown={handleKeyDown}
                                className="bg-transparent border-none text-white text-lg font-bold px-4 py-3 w-full lg:w-[350px] focus:outline-none placeholder-gray-600"
                                placeholder={activeLocation ? "주변 공연장 검색..." : "공연명, 장소, 지역 검색..."}
                            />

                            {/* Reset Button */}
                            {searchText && (
                                <button
                                    onClick={() => {
                                        setSearchText('');
                                        setIsDropdownOpen(false);
                                        setSearchLocation(null); // Reset location when cleared
                                    }}
                                    className="p-2 text-gray-500 hover:text-white"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            )}

                            <button onClick={handleSearch} className="p-3.5 bg-gradient-to-r from-[#a78bfa] to-[#f472b6] rounded-full text-white shadow-md hover:scale-105 active:scale-95 transition-all">
                                <Search className="w-6 h-6 font-bold" />
                            </button>
                        </div>
                    </div>

                    {/* Search Results Dropdown (Attached to Hero Input) */}
                    {isDropdownOpen && activeSearchSource === 'hero' && searchResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-4 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl z-[120] overflow-hidden max-h-80 overflow-y-auto">
                            {searchResults.map((result, idx) => {
                                // Address Parsing: Only Region + Gu (e.g., 서울 영등포구)
                                const addressParts = result.address ? result.address.split(' ') : [];
                                const shortAddress = addressParts.length >= 2 ? `${addressParts[0]} ${addressParts[1]}` : result.address;

                                return (
                                    <div
                                        key={`search-hero-${idx}`}
                                        onClick={() => handleSelectResult(result)}
                                        className={`px-5 py-4 cursor-pointer flex items-center justify-between gap-4 border-b border-white/5 last:border-0 transition-colors ${idx === highlightedIndex ? 'bg-white/20' : 'bg-[#1a1a1a] hover:bg-white/10'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="bg-black/50 p-2.5 rounded-full shrink-0 border border-white/10">
                                                {result.type === 'video' ? <Star className="w-4 h-4 text-yellow-500" /> : <MapPin className="w-4 h-4 text-[#a78bfa]" />}
                                            </div>
                                            <div className="text-white text-base font-bold truncate">
                                                {result.name}
                                            </div>
                                        </div>

                                        <div className="text-gray-400 text-sm whitespace-nowrap shrink-0">
                                            {shortAddress}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>



            {/* Keyword Input Section (Collapsible) */}
            {/* Removed Separated Keyword Section - Moved to Sticky Filter */}



            {/* Sticky Sentinel - Fixed: Placed immediately above sticky header */}
            <div ref={sentinelRef} className="h-[1px] w-full pointer-events-none absolute" style={{ marginTop: '-1px' }} />

            {/* Sticky Filter Container - Glassmorphism */}
            <div
                className={
                    clsx(
                        "sticky top-0 z-[110] transition-all duration-300 ease-in-out border-b backdrop-blur-md w-full",
                        isSticky
                            ? "bg-[rgba(0,0,0,0.6)] py-2 shadow-2xl border-[rgba(255,255,255,0.2)]"
                            : "bg-transparent py-4 border-transparent border-white/5"
                    )
                }
            >

                <div
                    className={clsx(
                        "w-full max-w-7xl 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 space-y-2 transition-colors duration-300 rounded-lg",
                        !isFilterExpanded && "cursor-pointer py-1"
                    )}
                    onClick={() => !isFilterExpanded && setIsFilterExpanded(true)}
                >


                    {/* Collapsed View Redesigned - Recursive Layout */}
                    {!isFilterExpanded && (
                        <div className="flex flex-col lg:flex-row items-center gap-2 w-full relative">
                            {/* Row 1: Filter Summary Text */}
                            <div className="flex flex-col lg:flex-row items-center gap-2 w-full relative">
                                {/* Row 1: Filter Summary Text */}
                                <div className="flex items-center gap-4 text-gray-400 text-sm w-full lg:w-auto flex-1 overflow-hidden min-w-0">
                                    <Filter className="w-4 h-4 text-[#a78bfa] shrink-0" />
                                    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide whitespace-nowrap mask-gradient-right min-w-0">
                                        {selectedGenre !== 'all' && (
                                            <span className="text-white bg-[#a78bfa]/20 px-2 py-0.5 rounded text-xs font-extrabold border border-[#a78bfa]/30">
                                                {GENRES.find(g => g.id === selectedGenre)?.label}
                                            </span>
                                        )}
                                        {selectedRegion !== 'all' && (
                                            <span className="text-white bg-blue-500/20 px-2 py-0.5 rounded text-xs font-extrabold border border-blue-500/30">
                                                {REGIONS.find(r => r.id === selectedRegion)?.label}
                                                {selectedDistrict !== 'all' && ` ${selectedDistrict}`}
                                            </span>
                                        )}
                                        {selectedVenue !== 'all' && (
                                            <span className="text-white bg-green-500/20 px-2 py-0.5 rounded text-xs font-extrabold border border-green-500/30">
                                                {selectedVenue}
                                            </span>
                                        )}
                                        {activeLocation && (
                                            <span className="text-green-400 text-xs font-extrabold flex items-center gap-1">
                                                <MapPin className="w-3 h-3" />
                                                {radius}km 반경
                                            </span>
                                        )}
                                        {selectedGenre === 'all' && selectedRegion === 'all' && selectedVenue === 'all' && !activeLocation && (
                                            <span className="text-gray-500 font-extrabold">모든 공연 보기 (필터 미적용)</span>
                                        )}
                                    </div>

                                </div>

                                {/* Row 2: [Star] [Search] [Toggle] */}
                                <div className="flex items-center gap-2 w-full lg:w-auto justify-end overflow-hidden flex-nowrap shrink-0">
                                    {/* Venue Button (Collapsed) */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (favoriteVenues.length > 0) {
                                                setShowFavoriteVenues(!showFavoriteVenues);
                                            }
                                        }}
                                        disabled={favoriteVenues.length === 0}
                                        className={clsx(
                                            "shrink-0 p-1 px-2 rounded-full border text-xs font-bold flex items-center gap-1 transition-all",
                                            favoriteVenues.length > 0
                                                ? (showFavoriteVenues
                                                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black cursor-pointer shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                                                    : "border-gray-700 bg-gray-800/50 text-gray-400 hover:text-gray-200")
                                                : "border-gray-700 bg-gray-800/50 text-gray-600 cursor-not-allowed opacity-50"
                                        )}
                                    >
                                        <BuildingStadium className={clsx("w-3 h-3", showFavoriteVenues && favoriteVenues.length > 0 ? "fill-emerald-500" : "fill-none")} />
                                        <span className="hidden sm:inline">공연장</span>
                                    </button>

                                    {/* Like Button (Collapsed) */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (likedIds.length > 0) {
                                                setShowLikes(!showLikes);
                                            }
                                        }}
                                        disabled={likedIds.length === 0}
                                        className={clsx(
                                            "shrink-0 p-1 px-2 rounded-full border text-xs font-bold flex items-center gap-1 transition-all",
                                            likedIds.length > 0
                                                ? (showLikes
                                                    ? "border-pink-500/50 bg-pink-500/10 text-pink-500 hover:bg-pink-500 hover:text-black cursor-pointer shadow-[0_0_10px_rgba(236,72,153,0.3)]"
                                                    : "border-gray-700 bg-gray-800/50 text-gray-400 hover:text-gray-200")
                                                : "border-gray-700 bg-gray-800/50 text-gray-600 cursor-not-allowed opacity-50"
                                        )}
                                    >
                                        <Heart className={clsx("w-3 h-3", showLikes && likedIds.length > 0 ? "fill-pink-500" : "fill-none")} />
                                        <span className="hidden sm:inline">좋아요</span>
                                    </button>

                                    {/* Keyword Button (Collapsed) */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            // Open filter and focus keyword input
                                            setIsFilterExpanded(true);
                                            setShowKeywordInput(true);
                                        }}
                                        className="shrink-0 p-1 px-2 rounded-full border border-yellow-500/50 bg-yellow-500/10 text-yellow-500 text-xs font-bold hover:bg-yellow-500 hover:text-black flex items-center gap-1 transition-all"
                                    >
                                        <Star className="w-3 h-3 fill-current" />
                                        <span className="hidden sm:inline">키워드</span>
                                    </button>

                                    {/* Quick Search Bar - Reduced visual weight for mobile fit */}
                                    <div className="p-[1px] rounded-full bg-linear-to-r from-[#a78bfa] via-purple-500 to-[#f472b6] shadow-md opacity-90 hover:opacity-100 flex-1 lg:flex-none max-w-sm min-w-[60px] lg:w-56 shrink">
                                        <div className="bg-[#0a0a0a] rounded-full flex items-center px-2 py-1 relative">
                                            <Search className="w-3.5 h-3.5 text-white sm:mr-2" />
                                            <input
                                                type="text"
                                                value={searchText}
                                                onClick={(e) => e.stopPropagation()}
                                                onFocus={() => setActiveSearchSource('sticky')}
                                                onChange={handleSearchTextChange}
                                                onKeyDown={handleKeyDown}
                                                className="bg-transparent border-none text-white text-xs sm:text-sm font-bold w-full focus:outline-none placeholder-gray-500 min-w-0"
                                                placeholder="검색..."
                                            />
                                        </div>

                                        {/* Dropdown for Sticky Header */}
                                        {isDropdownOpen && activeSearchSource === 'sticky' && searchResults.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-[150] overflow-hidden max-h-60 overflow-y-auto">
                                                {searchResults.map((result, idx) => {
                                                    const addressParts = result.address ? result.address.split(' ') : [];
                                                    const shortAddress = addressParts.length >= 2 ? `${addressParts[0]} ${addressParts[1]}` : result.address;

                                                    return (
                                                        <div
                                                            key={`search-sticky-${idx}`}
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleSelectResult(result);
                                                            }}
                                                            className={`px-4 py-3 cursor-pointer flex items-center justify-between gap-3 border-b border-white/5 last:border-0 transition-colors ${idx === highlightedIndex ? 'bg-white/20' : 'bg-[#1a1a1a] hover:bg-white/10'
                                                                }`}
                                                        >
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <div className="bg-black/50 p-1.5 rounded-full shrink-0 border border-white/10">
                                                                    {result.type === 'video' ? <Star className="w-3 h-3 text-yellow-500" /> : <MapPin className="w-3 h-3 text-[#a78bfa]" />}
                                                                </div>
                                                                <div className="text-white text-sm font-bold truncate">
                                                                    {result.name}
                                                                </div>
                                                            </div>
                                                            <div className="text-gray-400 text-xs whitespace-nowrap shrink-0">
                                                                {shortAddress}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}


                                    </div>

                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsFilterExpanded(true);
                                            setShowKeywordInput(false);
                                        }}
                                        className="shrink-0 flex items-center justify-center p-1.5 rounded-full text-gray-400 hover:text-white bg-gray-800 border border-gray-700 hover:bg-gray-700 transition-colors ml-auto lg:ml-2"
                                    >
                                        <ChevronDown className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Expanded View */}
                    <div className={clsx(
                        "transition-all duration-300 overflow-hidden",
                        isFilterExpanded ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                    )}>
                        <div className="flex flex-col gap-3">
                            {/* Row 1: Filters & Search */}
                            <div className="flex flex-col xl:flex-row gap-3 sm:gap-4 justify-between items-start xl:items-center">

                                {/* Filter Controls (Venue, Region, District) */}
                                <div className="w-full xl:w-auto flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-center overflow-x-auto pb-1 scrollbar-hide">

                                    {/* Venue Select */}
                                    <div className="relative shrink-0 w-full sm:w-auto">
                                        <select
                                            value={selectedVenue}
                                            onChange={(e) => setSelectedVenue(e.target.value)}
                                            className="w-full sm:w-40 appearance-none bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 pr-8"
                                        >
                                            <option value="all">전체 공연장</option>
                                            {availableVenues.map(v => (
                                                <option key={v} value={v}>{v}</option>
                                            ))}
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                        </div>
                                    </div>

                                    {/* Region Buttons Filter Group */}
                                    <div className="flex bg-white/5 rounded-full p-1 shrink-0 overflow-x-auto scrollbar-hide w-full sm:w-auto justify-between sm:justify-start border border-white/10">
                                        {REGIONS.map(r => (
                                            <button
                                                key={r.id}
                                                onClick={() => {
                                                    setSelectedRegion(r.id);
                                                    setSelectedDistrict('all');
                                                    setSelectedVenue('all');
                                                }}
                                                className={clsx(
                                                    'flex-1 sm:flex-none px-4 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap text-center',
                                                    selectedRegion === r.id
                                                        ? 'bg-white text-black font-bold shadow-lg mix-blend-lighten'
                                                        : 'text-gray-400 hover:text-white hover:bg-white/10 mix-blend-lighten'
                                                )}
                                            >
                                                {r.label}
                                            </button>
                                        ))}
                                    </div>

                                    {/* District Select */}
                                    {selectedRegion !== 'all' && (
                                        <div className="relative w-full sm:w-auto">
                                            <select
                                                value={selectedDistrict}
                                                onChange={(e) => {
                                                    setSelectedDistrict(e.target.value);
                                                    setSelectedVenue('all'); // Reset venue when district changes
                                                }}
                                                className="w-full sm:w-32 appearance-none bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 pr-8"
                                            >
                                                <option value="all">전체 지역</option>
                                                {districts.map(d => (
                                                    <option key={d} value={d}>{d}</option>
                                                ))}
                                            </select>
                                            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                            </div>
                                        </div>
                                    )}


                                </div>

                                {/* Replaced Search Bar with Keyword Button in Expanded Mode */}
                                <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 sm:gap-3 w-full xl:w-auto items-center justify-end">
                                    {/* Venue Like Button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (favoriteVenues.length > 0) {
                                                setShowFavoriteVenues(!showFavoriteVenues);
                                            }
                                        }}
                                        disabled={favoriteVenues.length === 0 || selectedGenre !== 'all'}
                                        className={clsx(
                                            "flex items-center justify-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium border transition-all group w-full sm:w-auto",
                                            (favoriteVenues.length > 0 && selectedGenre === 'all')
                                                ? (showFavoriteVenues
                                                    ? "bg-transparent border-emerald-500 text-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                                                    : "border-gray-600 text-gray-500 hover:border-gray-400 hover:text-gray-300")
                                                : "border-gray-800 text-gray-600 cursor-not-allowed opacity-50 bg-gray-900/50"
                                        )}
                                    >
                                        <BuildingStadium className={clsx("w-4 h-4", showFavoriteVenues && favoriteVenues.length > 0 && selectedGenre === 'all' ? "fill-emerald-500" : "fill-none")} />
                                        <span>공연장</span>
                                        {favoriteVenues.length > 0 && (
                                            <span className={clsx(
                                                "ml-1 text-xs px-1.5 py-0.5 rounded-full transition-colors",
                                                (showFavoriteVenues && selectedGenre === 'all') ? "bg-emerald-500 text-black" : "bg-gray-700 text-gray-400"
                                            )}>
                                                {favoriteVenues.length}
                                            </span>
                                        )}
                                    </button>

                                    {/* Like Button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (likedIds.length > 0) {
                                                setShowLikes(!showLikes);
                                            }
                                        }}
                                        disabled={likedIds.length === 0 || selectedGenre !== 'all'}
                                        className={clsx(
                                            "flex items-center justify-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium border transition-all group w-full sm:w-auto",
                                            (likedIds.length > 0 && selectedGenre === 'all')
                                                ? (showLikes
                                                    ? "bg-transparent border-pink-500 text-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.3)]"
                                                    : "border-gray-600 text-gray-500 hover:border-gray-400 hover:text-gray-300")
                                                : "border-gray-800 text-gray-600 cursor-not-allowed opacity-50 bg-gray-900/50"
                                        )}
                                    >
                                        <Heart className={clsx("w-4 h-4", showLikes && likedIds.length > 0 && selectedGenre === 'all' ? "fill-pink-500" : "fill-none")} />
                                        <span>좋아요</span>
                                        {likedIds.length > 0 && (
                                            <span className={clsx(
                                                "ml-1 text-xs px-1.5 py-0.5 rounded-full transition-colors",
                                                (showLikes && selectedGenre === 'all') ? "bg-pink-500 text-black" : "bg-gray-700 text-gray-400"
                                            )}>
                                                {likedIds.length}
                                            </span>
                                        )}
                                    </button>

                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowKeywordInput(!showKeywordInput);
                                        }}
                                        className={clsx(
                                            "flex items-center justify-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium border transition-all group w-full sm:w-auto",
                                            showKeywordInput
                                                ? "bg-yellow-500 text-black border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.5)]"
                                                : "border-yellow-500/50 text-yellow-500 hover:bg-yellow-500 hover:text-black"
                                        )}
                                    >
                                        <Star className={clsx("w-4 h-4", showKeywordInput ? "fill-black" : "fill-current")} />
                                        <span>키워드</span>
                                        {keywords.length > 0 && (
                                            <span className={clsx(
                                                "ml-1 text-xs px-1.5 py-0.5 rounded-full transition-colors",
                                                showKeywordInput ? "bg-black text-yellow-500" : "bg-yellow-500 text-black group-hover:bg-black group-hover:text-yellow-500"
                                            )}>
                                                {keywords.length}
                                            </span>
                                        )}
                                    </button>

                                    {/* Share Button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            copyShareUrl();
                                        }}
                                        disabled={likedIds.length === 0 && favoriteVenues.length === 0 && keywords.length === 0}
                                        className={clsx(
                                            "flex items-center justify-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium border transition-all group w-full sm:w-auto",
                                            (likedIds.length > 0 || favoriteVenues.length > 0 || keywords.length > 0)
                                                ? (shareUrlCopied
                                                    ? "bg-green-500 border-green-500 text-black"
                                                    : "border-[#a78bfa]/50 text-[#a78bfa] hover:bg-[#a78bfa] hover:text-black")
                                                : "border-gray-800 text-gray-600 cursor-not-allowed opacity-50 bg-gray-900/50"
                                        )}
                                        title="내 설정 공유하기"
                                    >
                                        {shareUrlCopied ? (
                                            <Check className="w-4 h-4" />
                                        ) : (
                                            <Link2 className="w-4 h-4" />
                                        )}
                                        <span>{shareUrlCopied ? '복사됨!' : '공유'}</span>
                                    </button>
                                </div>


                            </div>

                            {/* Improved Keyword Input Toggle - Integrated in Sticky Filter */}
                            <div className={clsx(
                                "transition-all duration-300 overflow-hidden backdrop-blur-md bg-black/20",
                                showKeywordInput ? "max-h-60 opacity-100 border-b border-white/5 mb-2" : "max-h-0 opacity-0"
                            )} onClick={(e) => e.stopPropagation()}>
                                <div className="p-4 flex flex-col gap-3 border border-yellow-500/50 rounded-lg">
                                    <div className="flex flex-col sm:flex-row items-center gap-3">
                                        <input
                                            type="text"
                                            value={newKeyword}
                                            onChange={(e) => setNewKeyword(e.target.value)}
                                            onKeyDown={(e) => {
                                                if (e.nativeEvent.isComposing) return;
                                                if (e.key === 'Enter') addKeyword();
                                            }}
                                            placeholder="관심 키워드 입력 (최대 5개)"
                                            className="bg-gray-900 border border-gray-700 text-white text-sm rounded-md px-3 py-2 w-full sm:w-auto flex-1 focus:border-yellow-500 focus:outline-none"
                                        />
                                        <button
                                            onClick={addKeyword}
                                            className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-4 py-2 rounded-md text-sm whitespace-nowrap w-full sm:w-auto"
                                        >
                                            추가하기
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {keywords.map(k => (
                                            <div key={k} className="flex items-center bg-gray-900 border border-yellow-500/30 text-yellow-400 px-3 py-1.5 rounded-full text-sm font-medium">
                                                <span>{k}</span>
                                                <button onClick={() => removeKeyword(k)} className="ml-2 hover:text-white"><X className="w-3 h-3" /></button>
                                            </div>
                                        ))}
                                        {keywords.length === 0 && <span className="text-gray-500 text-sm">등록된 키워드가 없습니다.</span>}
                                    </div>
                                </div>
                            </div>

                            {/* Row 2: Genre List & Toggle Button */}
                            <div className="flex items-center gap-2">
                                <div className="flex-1 flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                                    {GENRES.map(g => (
                                        <button
                                            key={g.id}
                                            onClick={() => setSelectedGenre(g.id)}
                                            className={clsx(
                                                'px-4 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap shrink-0',
                                                selectedGenre === g.id
                                                    ? clsx(GENRE_STYLES[g.id]?.twActivebg || 'bg-blue-600', GENRE_STYLES[g.id]?.twBorder || 'border-blue-500', 'text-white shadow-md mix-blend-lighten')
                                                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 mix-blend-lighten'
                                            )}
                                        >
                                            {g.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="w-[1px] h-6 bg-gray-700 mx-1 hidden sm:block"></div>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsFilterExpanded(false);
                                    }}
                                    className="p-1.5 rounded-full text-gray-400 hover:text-white bg-gray-800 border border-gray-700 hover:bg-gray-700 shrink-0"
                                    title="검색창 접기"
                                >
                                    <ChevronUp className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Favorite Venues Section (Highest Priority) - Only Visible in 'All' Tab */}
            {
                viewMode === 'list' && selectedGenre === 'all' && showFavoriteVenues && favoriteVenuePerformances.length > 0 && (
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
                                    {favoriteVenuePerformances.map((performance, index) => (
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
                                                    onDetail={() => window.open(performance.link, '_blank')}
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
                                                    onDetail={() => window.open(performance.link, '_blank')}
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
                                        <Image
                                            src={getOptimizedUrl(sharedItem.image, 800) || "/api/placeholder/800/600"}
                                            alt={sharedItem.title}
                                            fill
                                            className="object-contain md:object-cover"
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
                                                            <div className="text-gray-400 text-xs font-bold uppercase">Price</div>
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

            {/* Favorite Venues List Modal */}
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

            {/* Liked Performances Section (Above Keywords) - Only Visible in 'All' Tab */}
            {
                viewMode === 'list' && selectedGenre === 'all' && showLikes && likedPerformances.length > 0 && (
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
                                    {likedPerformances.map((performance, index) => (
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
                                                        setViewMode('map');
                                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                                    }}
                                                    isLiked={true}
                                                    onToggleLike={(e) => toggleLike(performance.id, e)}
                                                    enableActions={true}
                                                    onShare={() => copyItemShareUrl(performance.id)}
                                                    onDetail={() => window.open(performance.link, '_blank')}
                                                    variant="pink"
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
                                                    isLiked={true}
                                                    onToggleLike={(e) => toggleLike(performance.id, e)}
                                                    variant="pink"
                                                    onShare={() => copyItemShareUrl(performance.id)}
                                                    onDetail={() => window.open(performance.link, '_blank')}
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

            {/* Keyword Matches Section (Only in List View) */}
            {
                viewMode === 'list' && keywordMatches.length > 0 && (
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
                            <div className={clsx(
                                "grid gap-4 sm:gap-6",
                                layoutMode === 'grid'
                                    ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5"
                                    : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
                            )}>
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
                                                    onDetail={() => window.open(performance.link, '_blank')}
                                                    variant="yellow"
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
                                                    variant="yellow"
                                                    onShare={() => copyItemShareUrl(performance.id)}
                                                    onDetail={() => window.open(performance.link, '_blank')}
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


            {/* Main Content */}
            <div className="max-w-7xl 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 relative z-30">
                {/* Results Info */}
                <div className="flex flex-col sm:flex-row justify-between items-end mb-6 mt-16 gap-2">
                    <div className="w-full sm:w-auto">
                        <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
                            <h2 className="text-xl sm:text-2xl font-extrabold text-gray-200 flex items-center gap-2">
                                {activeLocation ? (
                                    <>
                                        <MapPin className="text-green-500 w-5 h-5" />
                                        <span className="truncate max-w-[150px] sm:max-w-xs">
                                            {searchLocation ? `'${searchLocation.name}'` : '내 위치'}
                                        </span>
                                        <span className="text-base sm:text-xl shrink-0">주변 ({filteredPerformances.length})</span>
                                    </>
                                ) : (
                                    <>
                                        <span>
                                            {selectedGenre === 'all'
                                                ? '추천 공연'
                                                : `추천 ${GENRES.find(g => g.id === selectedGenre)?.label || '공연'}`
                                            }
                                        </span>
                                        <span className="text-base sm:text-xl text-gray-400 font-normal ml-2">({filteredPerformances.length})</span>
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
                                            setViewMode('map');
                                            // Optional: center map if needed, but 'activeLocation' usually drives map center anyway
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}
                                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-white/10 text-white hover:bg-white/20 transition-colors border border-white/10 ml-1"
                                    >
                                        <MapIcon className="w-3 h-3 text-[#a78bfa]" />
                                        <span className="hidden sm:inline text-gray-200">지도보기</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className={clsx(
                    "grid gap-6",
                    viewMode === 'list'
                        ? "grid-cols-1" // List Mode: Single Column Wrapper (Inner wrapper handles grid)
                        : viewMode === 'map'
                            ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4" // Map Mode
                            : "grid-cols-1" // Calendar Mode
                )}>
                    <AnimatePresence mode="popLayout">
                        {isFiltering ? (
                            Array.from({ length: 8 }).map((_, i) => (
                                <SkeletonCard key={i} />
                            ))
                        ) : (
                            <AnimatePresence mode="popLayout" initial={false}>
                                <div className={clsx(
                                    "w-full transition-all duration-300",
                                    layoutMode === 'grid'
                                        ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6"
                                        : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6"
                                )}>
                                    {filteredPerformances.length > 0 && (
                                        filteredPerformances.slice(0, visibleCount).map((perf, index) => {
                                            // Calculate District distance label if location is active is handled inside Card/Item usually or passed.
                                            // Logic for distLabel was: const distLabel = ... (calculated above loop)
                                            // But here 'distLabel' variable from outer scope is used?
                                            // checking context... line 1460 "const filteredPerformances = ..."
                                            // line 1485 "const visibleCount..."
                                            // Where is distLabel?
                                            // Ah, line 1513 passed distLabel={distLabel}.
                                            // Wait, distLabel variable must be defined inside the map?
                                            // Let's check original loop.
                                            // "filteredPerformances.slice(0, visibleCount).map((perf, index) => {"
                                            // "const dist = ..."
                                            // I need to preserve this logic!

                                            // Venue Info
                                            const venueInfo = venues[perf.venue];

                                            const dist = activeLocation && venueInfo?.lat && venueInfo?.lng
                                                ? getDistanceFromLatLonInKm(activeLocation.lat, activeLocation.lng, venueInfo.lat, venueInfo.lng)
                                                : null;
                                            const distLabel = dist !== null ? `${dist.toFixed(1)}km` : null;

                                            return (
                                                <motion.div
                                                    key={`${perf.id}-${perf.region}`}
                                                    className={clsx(layoutMode === 'grid' ? "h-full w-full" : "w-full")}
                                                    initial={{ opacity: 0, scale: 0.95 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                                                    transition={{ duration: 0.3, delay: index * 0.03 }}
                                                >
                                                    {layoutMode === 'grid' ? (
                                                        <PerformanceCard
                                                            perf={perf}
                                                            distLabel={distLabel}
                                                            venueInfo={venueInfo}
                                                            onLocationClick={(loc) => {
                                                                setSearchLocation(loc);
                                                                setViewMode('map');
                                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                                            }}
                                                            isLiked={likedIds.includes(perf.id)}
                                                            onToggleLike={(e) => toggleLike(perf.id, e)}
                                                            // Logic Update: 
                                                            // - Ribbon: REMOVE from here (pass false)
                                                            // - Gradient: KEEP for general recommended lists
                                                            // - Actions: ENABLE for these lists
                                                            showRibbon={false}
                                                            isGradient={selectedGenre === 'all' && !activeLocation}
                                                            enableActions={true}
                                                            onShare={() => copyItemShareUrl(perf.id)}
                                                            onDetail={() => window.open(perf.link, '_blank')}
                                                        />
                                                    ) : (
                                                        <PerformanceListItem
                                                            perf={perf}
                                                            distLabel={distLabel}
                                                            venueInfo={venueInfo}
                                                            onLocationClick={(loc) => {
                                                                setSearchLocation(loc);
                                                                setViewMode('map');
                                                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                                            }}
                                                            isLiked={likedIds.includes(perf.id)}
                                                            onToggleLike={(e) => toggleLike(perf.id, e)}
                                                            onShare={() => copyItemShareUrl(perf.id)}
                                                            onDetail={() => window.open(perf.link, '_blank')}
                                                        />
                                                    )}
                                                </motion.div>
                                            );
                                        })
                                    )}
                                </div>
                            </AnimatePresence>
                        )}
                    </AnimatePresence>
                </div>

                {/* Sentinel for Infinite Scroll - Only in List Mode */}
                {
                    viewMode === 'list' && visibleCount < filteredPerformances.length && (
                        <div ref={observerTarget} className="h-20 flex items-center justify-center opacity-50">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                        </div>
                    )
                }

                {/* Empty State */}
                {
                    filteredPerformances.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-500 w-full text-center px-4">
                            <Navigation className="w-12 h-12 mb-4 opacity-20" />
                            <p>
                                {(selectedGenre === 'baseball' || selectedGenre === 'soccer')
                                    ? '현재 경기 일정이 없습니다.'
                                    : '조건에 맞는 공연이 없습니다.'}
                            </p>
                            <button onClick={() => {
                                setSelectedRegion('all');
                                setSelectedDistrict('all');
                                setSelectedGenre('all');
                                setSearchText('');
                                setUserLocation(null);
                            }} className="mt-4 text-blue-400 hover:underline">
                                필터 초기화
                            </button>
                        </div>
                    )
                }
            </div >

            {/* Scroll to Top Button */}
            {
                showScrollTop && (
                    <button
                        onClick={scrollToTop}
                        className="fixed bottom-6 right-6 p-3 bg-black/60 backdrop-blur-md border-[1.5px] border-transparent bg-origin-border rounded-full shadow-lg hover:shadow-[#f472b6]/50 transition-all z-50 animate-bounce group"
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
                        onClose={() => setViewMode('list')}
                    />
                )
            }

            {
                viewMode === 'map' && (
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
                        onClose={() => setViewMode('list')}
                    />
                )
            }

            {/* 🔔 New Matches Notification Modal */}
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
                                            <Image
                                                src={getOptimizedUrl(perf.image, 100) || "/api/placeholder/100/130"}
                                                alt={perf.title}
                                                fill
                                                className="object-cover"
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

        </div >
    );
}

// ---------------------------
// 💀 Skeleton Loading Component
// ---------------------------
function SkeletonCard() {
    return (
        <div className="aspect-[2/3] bg-gray-900/50 rounded-2xl overflow-hidden relative isolate">
            {/* Shimmer Effect */}
            <div className="absolute inset-0 z-10 -translate-x-full animate-[shimmer_1.5s_infinite] bg-linear-to-r from-transparent via-white/10 to-transparent" />

            {/* Image Placeholder */}
            <div className="h-full w-full bg-gray-800/50" />

            {/* Content Placeholder */}
            <div className="absolute bottom-0 inset-x-0 p-5 space-y-3 z-20">
                <div className="flex gap-2">
                    <div className="h-5 w-12 bg-gray-700/50 rounded-full" />
                    <div className="h-5 w-20 bg-gray-700/50 rounded-full" />
                </div>
                <div className="h-7 w-3/4 bg-gray-700/50 rounded-md" />
                <div className="h-4 w-1/2 bg-gray-700/50 rounded-md" />
            </div>
        </div>
    );
}

// ---------------------------
// 📋 List View Item Component (Updated with Tilt/Shadow)
// ---------------------------
function PerformanceListItem({ perf, distLabel, venueInfo, onLocationClick, isLiked = false, onToggleLike, variant = 'default', onShare, onDetail }: { perf: any, distLabel: string | null, venueInfo: any, onLocationClick: (loc: any) => void, isLiked?: boolean, onToggleLike?: (e: React.MouseEvent) => void, variant?: 'default' | 'yellow' | 'pink' | 'emerald', onShare?: () => void, onDetail?: () => void }) {
    const genreStyle = GENRE_STYLES[perf.genre] || {};
    const [isCopied, setIsCopied] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);
    const glareRef = useRef<HTMLDivElement>(null);

    // Tilt handlers (same as PerformanceCard)
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current || !glareRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -5; // Less tilt for horizontal card
        const rotateY = ((x - centerX) / centerX) * 5;
        cardRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.01, 1.01, 1.01)`;
        glareRef.current.style.transform = `translateX(${(x - centerX) / 3}px) translateY(${(y - centerY) / 3}px)`;
        glareRef.current.style.opacity = '1';
    };

    const handleMouseLeave = () => {
        if (!cardRef.current || !glareRef.current) return;
        cardRef.current.style.transform = `rotateX(0) rotateY(0) scale(1)`;
        glareRef.current.style.opacity = '0';
    };

    const handleTouchStart = () => {
        if (!cardRef.current) return;
        cardRef.current.style.transform = `perspective(1000px) rotateX(3deg) scale3d(0.99, 0.99, 0.99)`;
    };

    const handleTouchEnd = () => {
        if (!cardRef.current) return;
        cardRef.current.style.transform = `rotateX(0) rotateY(0) scale(1)`;
    };

    // Variant styles for outer card border/shadow
    const outerVariantStyle = variant === 'emerald'
        ? "border-emerald-500/40 shadow-[0_4px_20px_-5px_rgba(16,185,129,0.25)] hover:shadow-[0_8px_30px_-5px_rgba(16,185,129,0.4)]"
        : variant === 'pink'
            ? "border-pink-500/40 shadow-[0_4px_20px_-5px_rgba(236,72,153,0.25)] hover:shadow-[0_8px_30px_-5px_rgba(236,72,153,0.4)]"
            : variant === 'yellow'
                ? "border-yellow-500/40 shadow-[0_4px_20px_-5px_rgba(234,179,8,0.25)] hover:shadow-[0_8px_30px_-5px_rgba(234,179,8,0.4)]"
                : "border-white/5 hover:border-white/20 shadow-xl hover:shadow-2xl";

    // Content background for colored variants
    const contentBgStyle = variant === 'emerald'
        ? "bg-emerald-950/40"
        : variant === 'pink'
            ? "bg-pink-950/40"
            : variant === 'yellow'
                ? "bg-yellow-950/40"
                : ""; // Default: transparent (no bg class)

    return (
        <div
            className="perspective-1000 cursor-pointer group relative hover:z-[9999]"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            <div
                ref={cardRef}
                className={clsx(
                    "relative transition-transform duration-100 ease-out transform-style-3d rounded-xl overflow-hidden flex border",
                    outerVariantStyle
                )}
                style={{ transformStyle: 'preserve-3d' }}
            >
                {/* Glare Effect */}
                <div
                    ref={glareRef}
                    className="absolute inset-0 pointer-events-none z-50 opacity-0 transition-opacity duration-200"
                    style={{
                        background: 'radial-gradient(circle at center, rgba(255,255,255,0.15) 0%, transparent 60%)',
                        mixBlendMode: 'overlay',
                    }}
                />

                {/* Image (Left) */}
                {/* Image (Left) - Link Wrapped */}
                {/* Image (Left) */}
                <div className="relative w-32 sm:w-48 shrink-0 aspect-[3/4] overflow-hidden">
                    <Image
                        src={getOptimizedUrl(perf.image, 200) || "/api/placeholder/400/300"}
                        alt={perf.title}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                        sizes="(max-width: 640px) 128px, 192px"
                        loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />

                    {/* Distance Badge on Image */}
                    {distLabel && (
                        <div className="absolute bottom-1 right-1 bg-black/80 text-green-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-green-500/30 backdrop-blur-md">
                            {distLabel}
                        </div>
                    )}

                    {/* Like Button (on Image) */}
                    <button
                        onClick={onToggleLike}
                        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 hover:bg-black/60 transition-colors group/heart"
                    >
                        <Heart
                            className={clsx(
                                "w-4 h-4 transition-all duration-300",
                                isLiked
                                    ? "text-pink-500 fill-pink-500 scale-110 drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]"
                                    : "text-gray-300 hover:text-pink-400 hover:scale-110"
                            )}
                        />
                    </button>
                    {/* Share Button (Bottom Left on Image) */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onShare?.();
                            setIsCopied(true);
                            setTimeout(() => setIsCopied(false), 2000);
                        }}
                        className="absolute bottom-1 left-1 p-1.5 rounded-full bg-black/40 backdrop-blur-sm border border-white/10 hover:bg-black/60 transition-colors z-[60] flex items-center justify-center group/share"
                    >
                        {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-green-400" />
                        ) : (
                            <Share2 className="w-3.5 h-3.5 text-white group-hover/share:text-emerald-400 transition-colors" />
                        )}
                    </button>

                    {/* Copied Toast for List Item */}
                    <AnimatePresence>
                        {isCopied && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.8, y: 10 }}
                                className="absolute bottom-8 left-1 bg-black/90 text-white text-[10px] font-bold px-2 py-1 round-md whitespace-nowrap border border-white/20 z-[200] shadow-xl"
                            >
                                복사됨!
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Content (Right) - Apply variant background here */}
                <div className={clsx(
                    "flex-1 p-3 sm:p-5 flex flex-col justify-between relative min-w-0",
                    contentBgStyle
                )}>

                    {/* Header: Badges & Title */}
                    <div className="flex flex-col gap-1">
                        <div className="flex flex-wrap gap-2 mb-1 items-center">
                            <span className={clsx(
                                "px-2 py-0.5 rounded text-[10px] sm:text-xs font-bold border whitespace-nowrap",
                                genreStyle.twBg ? `${genreStyle.twBg} border-white/10` : 'bg-gray-800 text-gray-400 border-gray-700'
                            )}>
                                {GENRES.find(g => g.id === perf.genre)?.label || perf.genre}
                            </span>

                            {/* Date - Condensed */}
                            <span className="text-[10px] sm:text-xs text-gray-400 flex items-center gap-1 ml-auto sm:ml-0">
                                <Calendar className="w-3 h-3" />
                                {perf.date.split('~')[0].trim()}
                            </span>
                        </div>

                        <a href={perf.link} target="_blank" rel="noopener noreferrer" className="block group/link" onClick={e => e.stopPropagation()}>
                            <h3 className="text-lg sm:text-xl font-bold text-white leading-tight mb-1 group-hover/link:text-[#a78bfa] transition-colors line-clamp-5">
                                {perf.title.trim()}
                            </h3>
                        </a>

                        <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-400 mt-1">

                            {perf.genre === 'movie' ? (
                                <div className="text-gray-400 text-xs flex items-center gap-1 mb-2 truncate">
                                    {perf.gradeIcon ? (
                                        <img src={perf.gradeIcon} alt="Grade" className="h-[18px] w-auto object-contain" />
                                    ) : (
                                        <>
                                            <span className="text-cyan-400 font-bold border border-cyan-400/30 px-1 rounded text-[10px]">등급</span>
                                            {perf.venue.split('|').find((s: string) => s.includes('관람'))?.trim() || perf.venue}
                                        </>
                                    )}
                                </div>
                            ) : perf.genre === 'travel' ? (
                                <div className="text-gray-400 text-xs flex flex-col gap-0.5 mb-2 truncate">
                                    {/* Agent */}
                                    <div className="flex items-center gap-1 font-bold text-sky-400">
                                        <Plane className="w-3 h-3" />
                                        {perf.venue.split('|')[0]?.trim()}
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (venueInfo?.lat) onLocationClick({ lat: venueInfo.lat, lng: venueInfo.lng, name: perf.venue });
                                    }}
                                    className="hover:text-white hover:underline truncate text-gray-400 text-xs flex items-center gap-1 mb-2"
                                >
                                    <MapPin className="w-3 h-3 flex-shrink-0" />
                                    {perf.venue}
                                </button>
                            )}
                        </div>

                        {/* Price & Discount info for List View */}
                        {/* Price & Discount info for List View - Redesigned (11st Style) */}
                        {(perf.price || perf.discount) && (
                            <div className="flex flex-col mt-2 w-full border-t border-white/5 pt-2">
                                <div className="flex justify-between items-end">
                                    {/* Left: Discount */}
                                    <div className="flex flex-col">
                                        {perf.discount && (
                                            <div className="text-red-500">
                                                <span className="text-xl font-extrabold">{perf.discount.replace(/[^0-9]/g, '')}</span>
                                                <span className="text-sm font-light">%</span>
                                            </div>
                                        )}
                                    </div>
                                    {/* Right: Price */}
                                    <div className="flex flex-col items-end">
                                        {perf.originalPrice && <span className="text-gray-500 text-[10px] line-through mb-[-2px]">{perf.originalPrice}</span>}
                                        {perf.price && (
                                            <div className="text-white">
                                                <span className="text-lg font-extrabold">{perf.price.replace(/[^0-9,]/g, '')}</span>
                                                <span className="text-xs font-light ml-0.5">원</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Travel Options (Bottom - Full Width & Formatted) */}
                                {perf.genre === 'travel' && perf.venue.split('|')[1] && (
                                    <div className="mt-2 pt-2 border-t border-dashed border-white/10 text-[11px] text-gray-400 leading-relaxed">
                                        {perf.venue.split('|')[1].split('/').map((opt: string, i: number) => (
                                            <div key={i} className="mb-0.5 last:mb-0">
                                                {opt.trim()}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                        )}

                        {/* Detail View Button */}
                        <div className="mt-3">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDetail?.();
                                }}
                                className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg text-xs sm:text-sm font-bold text-gray-400 hover:text-white transition-all flex items-center justify-center gap-1"
                            >
                                자세히 보기
                                <ChevronDown className="-rotate-90 w-3 h-3 opacity-50" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div >


    );
}


// ---------------------------
// 🌟 3D Tilt Card Component
// ---------------------------
function PerformanceCard({ perf, distLabel, venueInfo, onLocationClick, variant = 'default', isLiked = false, onToggleLike, showRibbon = false, enableActions = false, isGradient = false, onShare, onDetail }: { perf: any, distLabel: string | null, venueInfo: any, onLocationClick: (loc: any) => void, variant?: 'default' | 'yellow' | 'pink' | 'emerald', isLiked?: boolean, onToggleLike?: (e: React.MouseEvent) => void, showRibbon?: boolean, enableActions?: boolean, isGradient?: boolean, onShare?: () => void, onDetail?: () => void }) {
    const [isCopied, setIsCopied] = useState(false);
    const [showActions, setShowActions] = useState(false); // For Mobile Touch

    const cardRef = useRef<HTMLDivElement>(null);
    const glareRef = useRef<HTMLDivElement>(null);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!cardRef.current || !glareRef.current) return;
        const rect = cardRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -10; // Max 10deg
        const rotateY = ((x - centerX) / centerX) * 10;

        cardRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;

        glareRef.current.style.transform = `translateX(${(x - centerX) / 2}px) translateY(${(y - centerY) / 2}px)`;
        glareRef.current.style.opacity = '1';
    };

    const handleMouseLeave = () => {
        if (!cardRef.current || !glareRef.current) return;
        cardRef.current.style.transform = `rotateX(0) rotateY(0) scale(1)`;
        glareRef.current.style.opacity = '0';
    };

    const handleCardClick = (e: React.MouseEvent) => {
        if (!showActions) {
            setShowActions(true);
        } else {
            setShowActions(false);
        }
    }

    // Global listener to close actions on outside click (Mobile)
    useEffect(() => {
        if (!showActions) return;
        const handleGlobalClick = (e: any) => {
            if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
                setShowActions(false);
            }
        };
        document.addEventListener('touchstart', handleGlobalClick);
        return () => document.removeEventListener('touchstart', handleGlobalClick);
    }, [showActions]);

    const isInterestVariant = ['yellow', 'pink', 'emerald'].includes(variant);

    return (
        <div
            className="sm:perspective-1000 cursor-pointer group h-full relative hover:z-[9999]"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={handleCardClick}
        >
            {/* New Gold Shimmer Wrapper Structure */}
            <div
                ref={cardRef}
                className={
                    clsx(
                        "relative transition-transform duration-100 ease-out sm:transform-style-3d shadow-xl group-hover:shadow-[5px_30px_50px_-12px_rgba(0,0,0,1)] h-full rounded-[15px]",
                        variant === 'default' ? "gold-shimmer-wrapper aspect-[3/4]" : "",
                        variant === 'emerald'
                            ? "border border-emerald-500/40 shadow-[0_4px_20px_-5px_rgba(16,185,129,0.25)] hover:shadow-[0_8px_30px_-5px_rgba(16,185,129,0.4)]"
                            : variant === 'pink'
                                ? "border border-pink-500/40 shadow-[0_4px_20px_-5px_rgba(236,72,153,0.25)] hover:shadow-[0_8px_30px_-5px_rgba(236,72,153,0.4)]"
                                : variant === 'yellow'
                                    ? "border border-yellow-500/40 shadow-[0_4px_20px_-5px_rgba(234,179,8,0.25)] hover:shadow-[0_8px_30px_-5px_rgba(234,179,8,0.4)]"
                                    : "border-0"
                    )
                }
                style={{ transformStyle: 'preserve-3d' }}
            >
                {/* Glare Effect */}
                <div
                    ref={glareRef}
                    className="absolute inset-0 pointer-events-none z-50 opacity-0 transition-opacity duration-200 rounded-xl"
                    style={{
                        background: 'radial-gradient(circle at center, rgba(255,255,255,0.15) 0%, transparent 60%)',
                        mixBlendMode: 'overlay',
                    }}
                />

                {/* Shimmer Border (Default Only) */}
                {variant === 'default' && (
                    <div className="gold-shimmer-border" style={{ '--shimmer-color': isGradient ? '#a78bfa' : 'gold' } as React.CSSProperties} />
                )}

                {/* Main Card Content */}
                <div className={clsx(
                    "gold-shimmer-main flex flex-col overflow-hidden h-full rounded-[15px] isolate",
                    isGradient
                        ? "bg-gradient-to-br from-[#2e1065] to-[#0f172a]"
                        : "bg-gray-900"
                )}
                    style={{ transform: 'translateZ(0)' }} // Force stacking context for Safari overflow fix
                >

                    {/* 🎗️ Recommended Ribbon (Only if showRibbon is true) */}
                    {showRibbon && (
                        <div className="absolute top-0 left-0 z-[60] w-24 h-24 pointer-events-none overflow-hidden rounded-tl-xl">
                            <div className="absolute top-0 left-0 bg-[#a78bfa] text-white text-[10px] font-bold py-1 w-32 text-center origin-top-left -rotate-45 translate-y-[18px] -translate-x-[26px] shadow-lg box-border border-b-2 border-white/20">
                                추천 공연
                            </div>
                        </div>
                    )}


                    {/* Like Button (Heart) */}
                    <button
                        onClick={onToggleLike}
                        className="absolute top-3 right-3 z-[100] p-2 rounded-full hover:bg-black/20 transition-colors group/heart"
                        style={{ transform: 'translateZ(50px)' }}
                    >
                        <Heart
                            className={clsx(
                                "w-6 h-6 transition-all duration-300",
                                isLiked
                                    ? "text-pink-500 fill-pink-500 scale-110 drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]"
                                    : "text-gray-400 fill-black/20 hover:text-pink-400 hover:scale-110"
                            )}
                        />
                    </button>

                    {/* Neon Stroke Effect (Border Gradient) */}
                    {variant !== 'yellow' && variant !== 'pink' && (
                        <div className="absolute inset-[-2px] z-[-1] rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-neon-flow bg-linear-to-tr from-[#ff00cc] via-[#3333ff] to-[#ff00cc] bg-[length:200%_auto] pointer-events-none" />
                    )}

                    {/* Glare Effect 2 */}
                    <div
                        ref={glareRef}
                        className="hidden sm:block absolute inset-0 w-[200%] h-[200%] bg-linear-to-tr from-transparent via-white/10 via-[#a78bfa]/20 via-[#f472b6]/20 via-white/10 to-transparent opacity-0 pointer-events-none z-50 mix-blend-color-dodge transition-opacity duration-300"
                        style={{ left: '-25%', top: '-25%' }}
                    />

                    {/* ========================================================= */}
                    {/*             VARIANT LOGIC: Interest vs Default            */}
                    {/* ========================================================= */}

                    {isInterestVariant ? (
                        /* --- VARIANT: INTEREST (Yellow/Pink/Emerald) --- */
                        <>
                            {/* Image Section (Top, Aspect 3/4) */}
                            <div className="relative aspect-[3/4] overflow-hidden shrink-0">
                                <div className="absolute inset-0 z-0">
                                    <Image
                                        src={getOptimizedUrl(perf.image, 400) || "/api/placeholder/400/300"}
                                        alt={perf.title}
                                        fill
                                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                                        sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                                        loading="lazy"
                                        referrerPolicy="no-referrer"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-gray-900/40 via-transparent to-transparent opacity-60" />
                                </div>
                                {/* Badge */}
                                <div
                                    className={clsx(
                                        "absolute top-2 left-2 text-xs font-bold px-2 py-1 rounded-full shadow-md z-10 flex items-center gap-1 border",
                                        variant === 'yellow'
                                            ? "bg-black/80 text-yellow-500 border-yellow-500/30"
                                            : variant === 'pink'
                                                ? "bg-black/80 text-pink-500 border-pink-500/30"
                                                : "bg-black/80 text-emerald-500 border-emerald-500/30"
                                    )}
                                    style={{ transform: 'translateZ(20px)' }}
                                >
                                    {variant === 'yellow' ? <Star className="w-3 h-3 fill-yellow-500" /> : variant === 'pink' ? <Heart className="w-3 h-3 fill-pink-500" /> : <BuildingStadium className="w-3 h-3 fill-emerald-500" />}
                                    {variant === 'yellow' ? '알림' : variant === 'pink' ? '좋아요' : '찜한공연장'}
                                </div>

                                {/* Action Buttons (Slide Up inside Image) */}
                                {enableActions && (
                                    <div className={clsx(
                                        "absolute inset-x-0 bottom-0 z-50 p-4 pb-4 flex gap-2 items-center justify-between transition-transform duration-300 ease-out",
                                        "translate-y-[100%] group-hover:translate-y-0"
                                    )}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onShare?.();
                                                setIsCopied(true);
                                                setTimeout(() => setIsCopied(false), 2000);
                                            }}
                                            className="w-[20%] bg-black/40 hover:bg-black/90 hover:text-white text-white backdrop-blur-md border border-white/20 py-3 rounded-[15px] flex items-center justify-center transition-all font-bold shadow-lg h-[50px] relative group/share"
                                            aria-label="공유하기"
                                        >
                                            <Share2 className="w-5 h-5" />
                                            <AnimatePresence>
                                                {isCopied && (
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        exit={{ opacity: 0, scale: 0.8, y: 10 }}
                                                        className="absolute -top-12 left-1/2 -translate-x-1/2 bg-black/90 text-white text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap border border-white/20 z-[200] shadow-xl flex items-center gap-1"
                                                    >
                                                        <span className="text-emerald-400">✓</span> 복사됨!
                                                        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black/90 border-r border-b border-white/20 rotate-45 transform" />
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </button>
                                        <a
                                            href={perf.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="flex-1 bg-black/60 text-white hover:bg-black/90 backdrop-blur-md border border-white/20 py-3 rounded-[15px] flex items-center justify-center transition-all font-extrabold shadow-lg h-[50px] gap-2 text-sm"
                                        >
                                            자세히 보기
                                            <Search className="w-4 h-4" />
                                        </a>
                                    </div>
                                )}
                            </div>

                            {/* Content Section (Bottom, Yellow/Pink/Emerald) */}
                            <div className={clsx(
                                "relative flex-1 sm:transform-style-3d overflow-hidden p-4 flex flex-col min-h-0",
                                variant === 'yellow' ? "bg-yellow-400" : variant === 'emerald' ? "bg-emerald-500" : "bg-pink-500"
                            )} style={{ transform: 'translateZ(10px)' }}>

                                {/* Text Content Area */}
                                <a href={perf.link} target="_blank" rel="noopener noreferrer" className="block group/link relative z-[100]" onClick={e => e.stopPropagation()}>
                                    <h3 className="font-bold text-lg text-black mb-1 line-clamp-2 group-hover:opacity-80 transition-opacity">
                                        {perf.title.trim()}
                                    </h3>
                                </a>

                                {perf.genre === 'movie' ? (
                                    <div className="text-gray-800 text-sm flex items-center gap-1 mb-2 w-max cursor-default">
                                        {perf.gradeIcon ? (
                                            <img src={perf.gradeIcon} alt="Grade" className="h-[20px] w-auto object-contain" />
                                        ) : (
                                            <>
                                                <span className="text-cyan-600 font-bold text-xs border border-cyan-600/30 px-1 rounded">등급</span>
                                                {perf.venue.split('|').find((s: string) => s.includes('관람'))?.trim() || perf.venue}
                                            </>
                                        )}
                                    </div>
                                ) : perf.genre === 'travel' ? (
                                    <div className="text-gray-800 text-xs flex flex-col gap-0.5 mb-2 w-max cursor-default">
                                        <div className="flex items-center gap-1 font-bold text-sky-700">
                                            <Plane className="w-3 h-3" />
                                            {perf.venue.split('|')[0]?.trim()}
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (venueInfo?.lat) onLocationClick({ lat: venueInfo.lat, lng: venueInfo.lng, name: perf.venue });
                                        }}
                                        className="text-gray-800 text-sm flex items-center gap-1 mb-2 hover:text-black hover:font-bold cursor-pointer w-max"
                                    >
                                        <MapPin className="w-3 h-3 text-gray-700" />
                                        {perf.venue}
                                    </button>
                                )}
                                <div className="mt-auto mb-2">
                                    <div className="flex items-center gap-1.5 w-full">
                                        {perf.discount && <span className="text-rose-700 text-xl font-extrabold">{perf.discount}</span>}
                                        {perf.price && <span className="text-black text-xl font-black tracking-tighter">{perf.price}</span>}
                                        {perf.originalPrice && <span className="text-gray-700/60 text-xs line-through">{perf.originalPrice}</span>}
                                    </div>
                                </div>
                                <div className="flex justify-between items-center border-t border-black/10 pt-2 text-black">
                                    <span className="text-white text-xs font-bold bg-black px-2 py-1 rounded whitespace-nowrap">
                                        {GENRES.find(g => g.id === perf.genre)?.label || perf.genre}
                                    </span>
                                    <span className="text-[13px] font-bold opacity-70">{perf.date}</span>
                                </div>
                            </div>
                        </>
                    ) : (
                        /* --- VARIANT: DEFAULT (Spotlight/Standard) --- */
                        <>
                            <div className="relative h-full w-full">
                                <Image
                                    src={getOptimizedUrl(perf.image, 400) || "/api/placeholder/400/300"}
                                    alt={perf.title}
                                    fill
                                    className="object-cover transition-transform duration-500 group-hover:scale-110 rounded-[15px]"
                                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                    loading="lazy"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent rounded-xl" />

                                {/* Hot Deal Badge (Top Left) */}
                                {perf.discount && (
                                    <div
                                        className="absolute top-2 left-2 z-40 bg-black/80 text-rose-500 border border-rose-500/30 px-2 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1 backdrop-blur-sm"
                                        style={{ transform: 'translateZ(20px)' }}
                                    >
                                        <Flame className="w-3 h-3 fill-rose-500" />
                                        핫딜
                                    </div>
                                )}
                                <script dangerouslySetInnerHTML={{ __html: `console.log('Rendering Default Card: ${perf.title}');` }} />

                                <div
                                    className="absolute inset-x-0 bottom-0 z-[70] overflow-hidden rounded-[15px]"
                                    style={{ transform: 'translateZ(30px)', transformStyle: 'preserve-3d' }}
                                >
                                    <div className={clsx(
                                        "relative transition-transform duration-300 ease-out flex flex-col justify-end",
                                        enableActions ? "translate-y-[60px] group-hover:translate-y-0" : ""
                                    )}>
                                        {/* Gradient Background Layer - spans full height of content */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent pointer-events-none" />

                                        {/* Performance Info */}
                                        <div className="relative z-10 p-5 pb-2">
                                            {/* Tags/Badges */}
                                            <div className="flex flex-wrap gap-2 mb-2">
                                                <span className={clsx(
                                                    "px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md border shadow-sm transition-all",
                                                    GENRE_STYLES[perf.genre]?.twBg ? `${GENRE_STYLES[perf.genre].twBg} border-white/20` : 'bg-black/30 border-[#a78bfa]/50 text-[#a78bfa]'
                                                )}>
                                                    {GENRES.find(g => g.id === perf.genre)?.label || perf.genre}
                                                </span>
                                                <span className="text-xs text-gray-300 flex items-center gap-1 font-medium">
                                                    <Calendar className="w-3.5 h-3.5" />
                                                    {(() => {
                                                        const parts = perf.date.split('~').map((s: string) => s.trim());
                                                        return (parts.length === 2 && parts[0] === parts[1]) ? parts[0] : perf.date;
                                                    })()}
                                                </span>
                                            </div>

                                            <a href={perf.link} target="_blank" rel="noopener noreferrer" className="block group/link relative z-[100]" onClick={e => e.stopPropagation()}>
                                                <h3 className="text-xl md:text-2xl font-[800] tracking-tighter text-white mb-1 leading-none line-clamp-2 drop-shadow-lg group-hover/link:text-[#a78bfa] transition-colors">
                                                    {perf.title.trim()}
                                                </h3>
                                            </a>

                                            <div className="flex items-center gap-1.5 mt-2 text-gray-300 text-xs md:text-sm font-medium">
                                                {perf.genre === 'movie' ? (
                                                    <div className="text-gray-400 text-xs flex items-center gap-1 truncate h-[20px]">
                                                        {perf.gradeIcon ? (
                                                            <img src={perf.gradeIcon} alt="Grade" className="h-full w-auto object-contain" />
                                                        ) : (
                                                            <>
                                                                <span className="text-cyan-400 font-bold border border-cyan-400/30 px-1 rounded text-[10px]">등급</span>
                                                                {perf.venue.split('|').find((s: string) => s.includes('관람'))?.trim() || perf.venue}
                                                            </>
                                                        )}
                                                    </div>
                                                ) : perf.genre === 'travel' ? (
                                                    <div className="text-gray-400 text-xs flex flex-col gap-0.5 truncate h-auto">
                                                        <div className="flex items-center gap-1 font-bold text-sky-400">
                                                            <Plane className="w-3.5 h-3.5" />
                                                            {perf.venue.split('|')[0]?.trim()}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (onLocationClick) {
                                                                onLocationClick({
                                                                    lat: venueInfo?.lat || 0,
                                                                    lng: venueInfo?.lng || 0,
                                                                    name: perf.venue
                                                                });
                                                            }
                                                        }}
                                                        className="flex items-center gap-1 hover:text-[#a78bfa] hover:underline truncate relative z-[100] cursor-pointer"
                                                    >
                                                        <MapPin className="w-3.5 h-3.5 text-[#a78bfa]" />
                                                        {perf.venue}
                                                    </button>
                                                )}
                                            </div>

                                            {(perf.price || perf.discount) && (
                                                <div className="flex justify-between items-end mt-3 w-full border-t border-white/10 pt-3">
                                                    <div className="flex flex-col justify-end">
                                                        {perf.discount && (
                                                            <div className="text-rose-500 drop-shadow-md leading-none">
                                                                <span className="text-[2rem] font-extrabold">{perf.discount.replace(/[^0-9]/g, '')}</span>
                                                                <span className="text-sm font-light ml-0.5">%</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex items-baseline gap-1.5">
                                                        {perf.originalPrice && <span className="text-gray-400 text-xs line-through decoration-gray-500/70">{perf.originalPrice}</span>}
                                                        {perf.price && (
                                                            <div className="text-white drop-shadow-md leading-none">
                                                                <span className="text-xl font-extrabold">{perf.price.replace(/[^0-9,]/g, '')}</span>
                                                                <span className="text-xs font-light ml-0.5">원</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions (Hidden initially, slides up with info) */}
                                        {enableActions && (
                                            <div className="relative z-10 p-4 pt-3 flex items-center justify-center gap-2 h-[70px]">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onShare?.();
                                                        setIsCopied(true);
                                                        setTimeout(() => setIsCopied(false), 2000);
                                                    }}
                                                    className="w-[20%] bg-white/10 hover:bg-white hover:text-black text-white backdrop-blur-md border border-white/20 py-3 rounded-xl flex items-center justify-center transition-all font-bold shadow-lg h-full relative group/share"
                                                    aria-label="공유하기"
                                                >
                                                    <Share2 className="w-5 h-5" />
                                                    <AnimatePresence>
                                                        {isCopied && (
                                                            <motion.div
                                                                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                                exit={{ opacity: 0, scale: 0.8, y: 10 }}
                                                                className="absolute -top-12 left-1/2 -translate-x-1/2 bg-black/90 text-white text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap border border-white/20 z-[200] shadow-xl flex items-center gap-1"
                                                            >
                                                                <span className="text-emerald-400">✓</span> 복사됨!
                                                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black/90 border-r border-b border-white/20 rotate-45 transform" />
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onDetail?.(); }}
                                                    className="w-[80%] bg-[#a78bfa] hover:bg-[#8b5cf6] text-white py-3 rounded-xl flex items-center justify-center transition-all font-bold shadow-lg h-full"
                                                >
                                                    <Search className="w-5 h-5" />
                                                    <span className="ml-2">자세히보기</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

// Build Trigger: 2025-12-18 10:48
