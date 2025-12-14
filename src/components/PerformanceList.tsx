'use client';
// UI Deployment Trigger: 2025-12-12


import Link from 'next/link';
import { useState, useMemo, useEffect, useRef } from 'react';
import { Performance } from '@/types';
import { MapPin, CalendarDays, Search, Map as MapIcon, RotateCw, Filter, ChevronUp, ChevronDown, LayoutGrid, Star, X, Calendar, Navigation, Heart } from 'lucide-react';
import { clsx } from 'clsx';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import venueData from '@/data/venues.json';
import { GENRES, REGIONS, RADIUS_OPTIONS, GENRE_STYLES } from '@/lib/constants';
import { motion, AnimatePresence } from 'framer-motion';

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

export default function PerformanceList({ initialPerformances, lastUpdated }: PerformanceListProps) {
    const [selectedRegion, setSelectedRegion] = useState<string>('all');
    const [selectedDistrict, setSelectedDistrict] = useState<string>('all');
    const [selectedVenue, setSelectedVenue] = useState<string>('all');
    const [selectedGenre, setSelectedGenre] = useState<string>('all');

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

    // Keyword Notification System
    const [keywords, setKeywords] = useState<string[]>([]);
    const [showKeywordInput, setShowKeywordInput] = useState(false);
    const [newKeyword, setNewKeyword] = useState('');

    useEffect(() => {
        const saved = localStorage.getItem('culture_keywords');
        if (saved) {
            try {
                setKeywords(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse keywords", e);
            }
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('culture_keywords', JSON.stringify(keywords));
    }, [keywords]);

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

    // Load Likes from LocalStorage
    useEffect(() => {
        const savedLikes = localStorage.getItem('culture_likes');
        if (savedLikes) {
            try {
                setLikedIds(JSON.parse(savedLikes));
            } catch (e) {
                console.error("Failed to parse likes", e);
            }
        }
    }, []);

    // Save Likes to LocalStorage
    useEffect(() => {
        localStorage.setItem('culture_likes', JSON.stringify(likedIds));
    }, [likedIds]);

    const toggleLike = (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setLikedIds(prev =>
            prev.includes(id) ? prev.filter(lid => lid !== id) : [...prev, id]
        );
    };

    const likedPerformances = useMemo(() => {
        return initialPerformances.filter(p => likedIds.includes(p.id));
    }, [initialPerformances, likedIds]);



    const [isSticky, setIsSticky] = useState(false); // Track if filters are pinned to top
    const [isFilterExpanded, setIsFilterExpanded] = useState(true); // Toggle Detailed Search

    // New: Keyword Section Toggle
    const [isKeywordsExpanded, setIsKeywordsExpanded] = useState(true);

    // Auto-collapse when sticky, Auto-expand when top
    useEffect(() => {
        if (isSticky) {
            setIsFilterExpanded(false);
        } else {
            setIsFilterExpanded(true);
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
        // Open dropdown if text exists
        if (val) setIsDropdownOpen(true);
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
    };

    const handleSelectResult = (candidate: any) => {
        setSearchLocation({
            lat: candidate.lat,
            lng: candidate.lng,
            name: candidate.name
        });
        setSearchText(candidate.name); // Update input to selected name? User might want to refine.
        setIsDropdownOpen(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSearch();
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
            if (selectedGenre !== 'all' && p.genre !== selectedGenre) return false;

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
            }, { threshold: 0.1 });
            observer.observe(node);
            return () => observer.disconnect();
        }
    }, []);

    const visiblePerformances = filteredPerformances.slice(0, visibleCount);

    // View Mode State
    const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'map'>('list');








    // Dynamically Import Components
    const KakaoMapModal = dynamic(() => import('./KakaoMapModal'), { ssr: false });
    const CalendarModal = dynamic(() => import('./CalendarModal'), { ssr: false });

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

            // Use 0 as threshold. If sentinel top <= 0, it means the sticky element (next sib)
            // is effectively at the viewport top.
            const isStuck = rect.top <= 0;

            setIsSticky(prev => {
                if (prev !== isStuck) return isStuck;
                return prev;
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
            style={{ overflowAnchor: 'none' }} // Prevent scroll anchoring from causing layout loops
        >
            {/* 🌌 Aurora Background */}
            {/* 🌌 Aurora Background Removed as per request */}
            {/* <div className="aurora-container ..."></div> */}
            <div className="noise-texture z-0 mix-blend-overlay opacity-20 fixed inset-0 pointer-events-none"></div>
            {/* Right-side Gradient Blobs (Neon & Saturated) */}
            <div className="fixed top-[-10%] right-[-5%] w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] bg-[#7c3aed] blur-[100px] rounded-full pointer-events-none z-0 opacity-60 mix-blend-screen animate-pulse-slow"></div>
            <div className="fixed top-[10%] right-[-15%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px] bg-[#db2777] blur-[120px] rounded-full pointer-events-none z-0 opacity-50 mix-blend-screen animate-pulse-slow delay-1000"></div>
            {/* Header: Logo & Last Updated */}
            {/* Header: Logo Only */}
            <header className="relative z-50 py-3 px-4 border-b border-gray-700 bg-transparent transition-all duration-300">
                <div className="max-w-7xl 2xl:max-w-[1800px] mx-auto flex justify-between items-center gap-4">
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
                            서울 · 경기 · 인천 통합 공연 검색
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* View Mode Toggles */}
                        <div className="flex gap-2 mix-blend-luminosity">
                            <button onClick={() => setViewMode('list')} className={clsx("p-2 rounded-full hover:bg-white/10", viewMode === 'list' && "bg-white/20")} title="목록 보기"><LayoutGrid className="w-5 h-5" /></button>
                            <button onClick={() => setViewMode('calendar')} className={clsx("p-2 rounded-full hover:bg-white/10", viewMode === 'calendar' && "bg-white/20")} title="캘린더 보기"><CalendarDays className="w-5 h-5" /></button>
                            <button onClick={() => setViewMode('map')} className={clsx("p-2 rounded-full hover:bg-white/10", viewMode === 'map' && "bg-white/20")} title="지도 보기"><MapIcon className="w-5 h-5" /></button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <div className="relative z-[60] max-w-7xl 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-10 flex flex-col lg:flex-row justify-between lg:items-end gap-8">
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
                    </p>
                    {/* Hero Text: 2 lines on PC, 4 lines on Mobile */}
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-light text-white leading-[1.15] tracking-tighter hidden sm:block">
                        특별한 오늘, 당신을 위한<br /><span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#a78bfa] via-[#f472b6] to-[#a78bfa] animate-shine bg-[length:200%_auto] tracking-normal mx-2 py-1">Spotlight</span>는 어디일까요?
                    </h2>
                    {/* Mobile: 2 lines (400px~640px) -> 4 lines (<400px) */}
                    <h2 className="text-4xl font-light text-white leading-[1.2] tracking-tighter block sm:hidden">
                        특별한 오늘,<br className="hidden max-[400px]:block" />
                        당신을 위한<br />
                        <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#a78bfa] via-[#f472b6] to-[#a78bfa] animate-shine bg-[length:200%_auto] tracking-normal py-1">Spotlight</span>는<br className="hidden max-[400px]:block" />
                        어디일까요?
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
                        <div className="absolute top-full left-0 right-0 mt-4 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl z-[100] overflow-hidden max-h-80 overflow-y-auto">
                            {searchResults.map((result, idx) => {
                                // Address Parsing: Only Region + Gu (e.g., 서울 영등포구)
                                const addressParts = result.address ? result.address.split(' ') : [];
                                const shortAddress = addressParts.length >= 2 ? `${addressParts[0]} ${addressParts[1]}` : result.address;

                                return (
                                    <div
                                        key={`search-hero-${idx}`}
                                        onClick={() => handleSelectResult(result)}
                                        className="px-5 py-4 hover:bg-white/10 cursor-pointer flex items-center justify-between gap-4 border-b border-white/5 last:border-0 transition-colors bg-[#1a1a1a]"
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
                        "sticky top-0 z-50 transition-all duration-300 ease-in-out border-b backdrop-blur-md w-full",
                        isSticky
                            ? "bg-[rgba(0,0,0,0.6)] py-2 shadow-2xl border-[rgba(255,255,255,0.2)]"
                            : "bg-transparent py-4 border-transparent border-white/5"
                    )
                }
            >

                <div
                    className={clsx(
                        "w-full max-w-7xl 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 space-y-2 transition-colors duration-300 rounded-lg",
                        !isFilterExpanded && "cursor-pointer hover:bg-white/5 py-1"
                    )}
                    onClick={() => !isFilterExpanded && setIsFilterExpanded(true)}
                >


                    {/* Collapsed View Redesigned - Recursive Layout */}
                    {!isFilterExpanded && (
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
                                {/* Like Button (Collapsed) */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsFilterExpanded(true);
                                        // Optional: Toggle like section? User just wants to open
                                    }}
                                    className="shrink-0 p-1 px-2 rounded-full border border-pink-500/50 bg-pink-500/10 text-pink-500 text-xs font-bold hover:bg-pink-500 hover:text-black flex items-center gap-1 transition-all"
                                >
                                    <Heart className="w-3 h-3 fill-current" />
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
                                                        className="px-4 py-3 hover:bg-white/10 cursor-pointer flex items-center justify-between gap-3 border-b border-white/5 last:border-0 transition-colors bg-[#1a1a1a]"
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
                                    {/* Like Button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowLikes(!showLikes);
                                        }}
                                        className={clsx(
                                            "flex items-center justify-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium border transition-all group w-full sm:w-auto",
                                            showLikes
                                                ? "bg-transparent border-pink-500 text-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.3)]"
                                                : "border-gray-600 text-gray-500 hover:border-gray-400 hover:text-gray-300"
                                        )}
                                    >
                                        <Heart className={clsx("w-4 h-4", showLikes ? "fill-pink-500" : "fill-none")} />
                                        <span>좋아요</span>
                                        {likedIds.length > 0 && (
                                            <span className={clsx(
                                                "ml-1 text-xs px-1.5 py-0.5 rounded-full transition-colors",
                                                showLikes ? "bg-pink-500 text-black" : "bg-gray-700 text-gray-400"
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
                                </div>


                            </div>

                            {/* Improved Keyword Input Toggle - Integrated in Sticky Filter */}
                            <div className={clsx(
                                "transition-all duration-300 overflow-hidden backdrop-blur-md bg-black/20",
                                showKeywordInput ? "max-h-60 opacity-100 border-b border-white/5 mb-2" : "max-h-0 opacity-0"
                            )} onClick={(e) => e.stopPropagation()}>
                                <div className="p-4 flex flex-col gap-3">
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

            {/* Liked Performances Section (Above Keywords) */}
            {
                viewMode === 'list' && showLikes && likedPerformances.length > 0 && (
                    <div className="max-w-7xl 2xl:max-w-[1800px] mx-auto px-4 mt-6 mb-8 relative z-10">
                        <div
                            className="flex items-center justify-between mb-4 pl-2 border-l-4 border-pink-500 cursor-pointer group"
                            onClick={() => setShowLikes(!showLikes)}
                        >
                            <h3 className="text-xl font-bold text-pink-500 flex items-center">
                                <Heart className="w-6 h-6 fill-pink-500 text-pink-500 mr-2" />
                                좋아요한 공연
                                <span className="text-base sm:text-xl text-gray-400 font-normal ml-[12px]">({likedPerformances.length})</span>
                            </h3>
                            <button className="p-1 rounded-full text-gray-400 group-hover:text-white transition-colors">
                                <ChevronUp className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
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
                                            variant="pink"
                                        />
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
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
                                키워드 공연
                                <span className="text-base sm:text-xl text-gray-400 font-normal ml-[12px]">({keywordMatches.length})</span>
                            </h3>
                            <button className="p-1 rounded-full text-gray-400 group-hover:text-white transition-colors">
                                {isKeywordsExpanded ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                            </button>
                        </div>
                        {isKeywordsExpanded && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-6">
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
                                                variant="yellow"
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
                                        <span>추천 공연</span>
                                        <span className="text-base sm:text-xl text-gray-400 font-normal ml-2">({filteredPerformances.length})</span>
                                    </>
                                )}
                            </h2>
                            <p className="text-gray-400 text-xs sm:text-sm font-medium pb-[3px]">
                                {activeLocation
                                    ? `${radius}km 이내 공연을 거리순으로 보여줍니다.`
                                    : null}
                            </p>
                        </div>
                    </div>
                </div>

                <div className={clsx(
                    "grid gap-6",
                    viewMode === 'list'
                        ? "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5" // List Mode: Multi-column
                        : viewMode === 'map'
                            ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4" // Map Mode (Bottom sheet style)
                            : "grid-cols-1" // Calendar Mode (Not grid)
                )}>
                    <AnimatePresence mode="popLayout">
                        {isFiltering ? (
                            Array.from({ length: 8 }).map((_, i) => (
                                <SkeletonCard key={i} />
                            ))
                        ) : (
                            visiblePerformances.map((perf, index) => {
                                const venueInfo = venues[perf.venue];
                                let distLabel = null;
                                if (activeLocation && venueInfo?.lat && venueInfo?.lng) {
                                    const d = getDistanceFromLatLonInKm(activeLocation.lat, activeLocation.lng, venueInfo.lat, venueInfo.lng);
                                    distLabel = d < 1 ? `${Math.floor(d * 1000)}m` : `${d.toFixed(1)}km`;
                                }

                                return (
                                    <motion.div
                                        key={`${perf.id}-${perf.region}`}
                                        className="h-full w-full"
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                                        transition={{ duration: 0.4, delay: index * 0.05 }}
                                    >
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
                                        />
                                    </motion.div>
                                );
                            })
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
                        onClose={() => setViewMode('list')}
                    />
                )
            }

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
// 🌟 3D Tilt Card Component
// ---------------------------
function PerformanceCard({ perf, distLabel, venueInfo, onLocationClick, variant = 'default', isLiked = false, onToggleLike }: { perf: any, distLabel: string | null, venueInfo: any, onLocationClick: (loc: any) => void, variant?: 'default' | 'yellow' | 'pink', isLiked?: boolean, onToggleLike?: (e: React.MouseEvent) => void }) {


    const cardRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null); // Kept for consistency if needed, though unused in Yellow
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

    // Mobile Touch Tilt
    const handleTouchStart = () => {
        if (!cardRef.current || window.innerWidth > 768) return; // Mobile only check if needed, or just let it be responsive
        // Apply a gentle tilt
        cardRef.current.style.transform = `perspective(1000px) rotateX(5deg) scale3d(0.98, 0.98, 0.98)`;
    };

    const handleTouchEnd = () => {
        if (!cardRef.current) return;
        // Reset
        cardRef.current.style.transform = `rotateX(0) rotateY(0) scale(1)`;
    };

    return (
        className = "perspective-1000 cursor-pointer group h-full relative hover:z-[9999]"
            onMouseMove = { handleMouseMove }
    onMouseLeave = { handleMouseLeave }
    onTouchStart = { handleTouchStart }
    onTouchEnd = { handleTouchEnd }
        >
        {/* New Gold Shimmer Wrapper Structure */ }
        < div
    ref = { cardRef }
    className = {
        clsx(
                    "relative transition-transform duration-100 ease-out transform-style-3d shadow-xl group-hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,1)] h-full",
            variant === 'yellow' ? "rounded-xl" : variant === 'pink' ? "rounded-xl" : "rounded-2xl aspect-[2/3]"
                )
}
style = {{ transformStyle: 'preserve-3d' }}
            >
    <div className="gold-shimmer-wrapper">
        <div
            className="gold-shimmer-border"
            style={{ '--shimmer-color': variant === 'pink' ? '#ec4899' : variant === 'yellow' ? '#eab308' : '#a78bfa' } as React.CSSProperties}
        />

        <div className={clsx(
            "gold-shimmer-main flex flex-col overflow-hidden",
            variant === 'yellow'
                ? "bg-yellow-500 ring-1 ring-yellow-500/50 hover:ring-white/50"
                : variant === 'pink'
                    ? "bg-pink-500 ring-1 ring-pink-500/50 hover:ring-white/50"
                    : "bg-gray-900 border border-white/10 group-hover:shadow-[#a78bfa]/20"
        )}>


            {/* Like Button (Heart) */}
            <button
                onClick={onToggleLike}
                className="absolute top-3 right-3 z-50 p-2 rounded-full hover:bg-black/20 transition-colors group/heart"
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

            {/* Glare Effect */}
            <div
                ref={glareRef}
                className="absolute inset-0 w-[200%] h-[200%] bg-linear-to-tr from-transparent via-white/10 via-[#a78bfa]/20 via-[#f472b6]/20 via-white/10 to-transparent opacity-0 pointer-events-none z-50 mix-blend-color-dodge transition-opacity duration-300"
                style={{ left: '-25%', top: '-25%' }}
            />

            {/* --- VARIANT: YELLOW/PINK (Keyword/Like Interest) --- */}
            {variant === 'yellow' || variant === 'pink' ? (
                <>
                    {/* Image Section (Top, Aspect 3/4) */}

                    <div className="relative aspect-[3/4] overflow-hidden shrink-0">
                        <div className="absolute inset-0 z-0">
                            <Image
                                src={perf.image || "/api/placeholder/400/300"}
                                alt={perf.title}
                                fill
                                className="object-cover group-hover:scale-110 transition-transform duration-500"
                                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                                loading="lazy"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/40 via-transparent to-transparent opacity-60" />
                        </div>
                        {/* Badge */}
                        <div
                            className={clsx(
                                "absolute top-2 left-2 text-xs font-bold px-2 py-1 rounded-full shadow-md z-10 flex items-center gap-1 border",
                                variant === 'yellow' ? "bg-black/80 text-yellow-500 border-yellow-500/30" : "bg-black/80 text-pink-500 border-pink-500/30"
                            )}
                            style={{ transform: 'translateZ(20px)' }}
                        >
                            {variant === 'yellow' ? <Star className="w-3 h-3 fill-yellow-500" /> : <Heart className="w-3 h-3 fill-pink-500" />}
                            {variant === 'yellow' ? '알림' : '좋아요'}
                        </div>
                    </div>

                    {/* Content Section (Bottom, Yellow/Pink) */}
                    <div className={clsx("p-4 flex flex-col flex-1 transform-style-3d", variant === 'yellow' ? "bg-yellow-400" : "bg-pink-500")} style={{ transform: 'translateZ(10px)' }}>
                        <a href={perf.link} target="_blank" rel="noopener noreferrer" className="block group/link" onClick={e => e.stopPropagation()}>
                            <h3 className="font-bold text-lg text-black mb-1 line-clamp-1 group-hover:opacity-80 transition-opacity">
                                {perf.title}
                            </h3>
                        </a>

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
                        <div className="flex justify-between items-end border-t border-black/10 pt-2 mt-auto">
                            <span className="text-white text-xs font-bold bg-black px-2 py-1 rounded">
                                {GENRES.find(g => g.id === perf.genre)?.label || perf.genre}
                            </span>
                            <span className="text-gray-900 text-xs font-medium">{perf.date}</span>
                        </div>
                    </div>
                </>
            ) : (
                /* --- VARIANT: DEFAULT (Spotlight/Standard) --- */
                <>
                    {/* Image Layer */}
                    {perf.image ? (
                        <Image
                            src={perf.image}
                            alt={perf.title}
                            fill
                            className="object-cover transition-transform duration-700 ease-out group-hover:scale-110 z-0"
                            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 20vw"
                            loading="lazy"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-800 text-gray-600">No Image</div>
                    )}

                    {/* Distance Badge (Top Right) */}
                    {distLabel && (
                        <div
                            className="absolute top-4 right-4 z-40 bg-black/60 backdrop-blur-md border border-[#a78bfa]/30 text-[#c084fc] px-3 py-1 rounded-full text-xs font-bold shadow-lg"
                            style={{ transform: 'translateZ(20px)' }}
                        >
                            {distLabel}
                        </div>
                    )}

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-transparent opacity-90 group-hover:opacity-100 transition-opacity duration-300 z-10 pointer-events-none" />

                    {/* Content Layer (Bottom) - Fixed Position */}
                    <div
                        className="absolute inset-x-0 bottom-0 p-5 z-20"
                        style={{ transform: 'translateZ(30px)' }} // 3D Depth
                    >

                        {/* Tags/Badges */}
                        <div className="flex flex-wrap gap-2 mb-2">
                            <span className={clsx(
                                "px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md border shadow-sm transition-all",
                                GENRE_STYLES[perf.genre]?.twBg ? `${GENRE_STYLES[perf.genre].twBg} border-white/20` : 'bg-black/30 border-[#a78bfa]/50 text-[#a78bfa]'
                            )}>
                                {GENRES.find(g => g.id === perf.genre)?.label || perf.genre}
                            </span>
                            {/* Date Badge */}
                            <span className="px-2 py-1 rounded-[4px] text-xs bg-white/10 text-gray-300 border border-white/10 backdrop-blur-sm flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {(() => {
                                    const parts = perf.date.split('~').map((s: string) => s.trim());
                                    return (parts.length === 2 && parts[0] === parts[1]) ? parts[0] : perf.date;
                                })()}
                            </span>
                        </div>

                        <a href={perf.link} target="_blank" rel="noopener noreferrer" className="block group/link" onClick={e => e.stopPropagation()}>
                            <h3 className="text-xl md:text-2xl font-[800] tracking-tighter text-white mb-1 leading-none line-clamp-2 drop-shadow-lg group-hover/link:text-[#a78bfa] transition-colors">
                                {perf.title}
                            </h3>
                        </a>

                        <div className="flex items-center gap-1.5 mt-2 text-gray-300 text-xs md:text-sm font-medium">
                            <MapPin className="w-3.5 h-3.5 text-[#a78bfa]" />
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (venueInfo?.lat && venueInfo?.lng) {
                                        onLocationClick({
                                            lat: venueInfo.lat,
                                            lng: venueInfo.lng,
                                            name: perf.venue
                                        });
                                    }
                                }}
                                className="hover:text-[#a78bfa] hover:underline truncate"
                            >
                                {perf.venue}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    </div>
            </div >
        </div >
    );
}
