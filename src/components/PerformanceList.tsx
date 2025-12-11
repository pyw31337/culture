'use client';

import Link from 'next/link';
import { useState, useMemo, useEffect } from 'react';
import { Performance } from '@/types';
import { MapPin, CalendarDays, Search, Map as MapIcon, RotateCw, Filter, ChevronUp, ChevronDown, LayoutGrid, Star, X, Calendar, Navigation } from 'lucide-react';
import { clsx } from 'clsx';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import venueData from '@/data/venues.json';
import { GENRES, REGIONS, RADIUS_OPTIONS, GENRE_STYLES } from '@/lib/constants';

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

    // Search State
    const [searchText, setSearchText] = useState('');
    const [debouncedSearchText, setDebouncedSearchText] = useState(''); // Debounced value
    const [searchLocation, setSearchLocation] = useState<{ lat: number, lng: number, name: string } | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]); // New: Store multiple results
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);   // New: Dropdown visibility
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

    // Mobile Filter Toggle State
    const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
    const [isFilterExpanded, setIsFilterExpanded] = useState(true); // New: Filter Collapse State
    const [isSticky, setIsSticky] = useState(false); // Track if filters are pinned to top

    // Infinite Scroll State
    const [visibleCount, setVisibleCount] = useState(24);

    // Radius (User Location or Search Location)
    const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [radius, setRadius] = useState<number>(10);

    // Consolidated "Center" for radius calculation (User Loc OR Search Loc)
    const activeLocation = searchLocation || userLocation;

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
    const sentinelRef = useMemo(() => {
        return (node: HTMLDivElement | null) => {
            if (!node) return;
            const observer = new IntersectionObserver(([entry]) => {
                // If sentinel is NOT visible and bounding box is above, it means we scrolled past it
                setIsSticky(!entry.isIntersecting && entry.boundingClientRect.top < 0);
            }, { threshold: 0 });
            observer.observe(node);
            return () => observer.disconnect();
        }
    }, []);

    // Scroll to Top Logic
    const [showScrollTop, setShowScrollTop] = useState(false);



    // Auto-collapse when sticky
    useEffect(() => {
        if (isSticky) {
            setIsFilterExpanded(false);
        } else {
            setIsFilterExpanded(true);
        }
    }, [isSticky]);

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
        <div className="min-h-screen bg-gray-900 text-gray-100 font-sans pb-20 relative">

            {/* Header Optimized for Small Screens & View Tabs */}
            <div className="relative bg-black border-b border-gray-800">
                <div className="max-w-7xl mx-auto py-6 px-4 flex flex-col md:flex-row justify-between items-center gap-4">
                    {/* Left ALigned Title */}
                    <div className="text-center md:text-left">
                        <div onClick={() => {
                            // Reset Logic
                            setSearchText('');
                            setSelectedRegion('all');
                            setSelectedDistrict('all');
                            setSelectedVenue('all');
                            setSelectedGenre('all');
                            setUserLocation(null);
                            setSearchLocation(null);
                            setSearchResults([]);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}>
                            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600 mb-1 cursor-pointer hover:opacity-80 transition-opacity">
                                Culture Flow
                            </h1>
                        </div>
                        <p className="text-gray-400 text-xs sm:text-sm">
                            서울 · 경기 · 인천 통합 공연 검색 ({lastUpdated})


                        </p>
                    </div>

                    {/* View Toggles & Keyword Toggle */}
                    <div className="flex gap-2 shrink-0 w-full sm:w-auto justify-end">
                        <button
                            onClick={() => setShowKeywordInput(!showKeywordInput)}
                            className={clsx(
                                "p-2 rounded-md transition-all flex items-center gap-2 mr-2",
                                showKeywordInput ? "bg-yellow-500 text-black shadow font-bold" : "text-gray-400 hover:text-yellow-400"
                            )}
                            title="키워드 알림 설정"
                        >
                            <Star className={clsx("w-5 h-5", showKeywordInput && "fill-black")} />
                            <span className="hidden sm:inline text-xs">알림</span>
                        </button>

                        <div className="w-px h-6 bg-gray-700 mx-1 self-center" />

                        <button
                            onClick={() => setViewMode('list')}
                            className={clsx(
                                "p-2 rounded-md transition-all flex items-center gap-2",
                                viewMode === 'list' ? "bg-gray-700 text-white shadow" : "text-gray-400 hover:text-white"
                            )}
                            title="목록 보기"
                        >
                            <LayoutGrid className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setViewMode('calendar')}
                            className={clsx(
                                "p-2 rounded-md transition-all flex items-center gap-2",
                                viewMode === 'calendar' ? "bg-gray-700 text-white shadow" : "text-gray-400 hover:text-white"
                            )}
                            title="달력 보기"
                        >
                            <CalendarDays className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setViewMode('map')}
                            className={clsx(
                                "p-2 rounded-md transition-all flex items-center gap-2",
                                viewMode === 'map' ? "bg-gray-700 text-white shadow" : "text-gray-400 hover:text-white"
                            )}
                            title="지도 보기"
                        >
                            <MapIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Keyword Input Section (Collapsible) */}
            <div className={clsx(
                "bg-gray-800 border-b border-gray-700 transition-all duration-300 overflow-hidden",
                showKeywordInput ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
            )}>
                <div className="max-w-7xl mx-auto p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
                        <span className="text-yellow-400 font-bold shrink-0">⭐ 키워드 알림:</span>
                        <input
                            type="text"
                            value={newKeyword}
                            onChange={(e) => setNewKeyword(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.nativeEvent.isComposing) return;
                                if (e.key === 'Enter') addKeyword();
                            }}
                            placeholder="관심 키워드 (예: 만원, 무료)"
                            className="bg-gray-700 border border-gray-600 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:border-yellow-400 w-full sm:w-64"
                        />
                        <button
                            onClick={addKeyword}
                            className="bg-yellow-500 hover:bg-yellow-600 text-black font-bold px-3 py-1.5 rounded text-sm whitespace-nowrap"
                        >
                            추가
                        </button>
                    </div>

                    {/* Active Keywords Chips */}
                    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                        {keywords.map(k => (
                            <div key={k} className="flex items-center bg-gray-700 border border-yellow-500/30 text-yellow-100 px-2 py-1 rounded text-sm">
                                <span>{k}</span>
                                <button onClick={() => removeKeyword(k)} className="ml-2 text-yellow-500 hover:text-white">
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                        {keywords.length === 0 && <span className="text-gray-500 text-xs">등록된 키워드가 없습니다.</span>}
                        {keywords.length > 0 && (
                            <button
                                onClick={() => setKeywords([])}
                                className="text-xs text-gray-500 hover:text-red-400 underline ml-2"
                            >
                                전체 삭제
                            </button>
                        )}
                    </div>
                </div>
            </div >

            {/* Keyword Matches Section (Only in List View) */}
            {
                viewMode === 'list' && keywordMatches.length > 0 && (
                    <div className="max-w-7xl mx-auto px-4 mt-6">
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 sm:p-6 mb-8">
                            <h3 className="text-lg font-bold text-yellow-400 mb-4 flex items-center gap-2">
                                <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                                관심 키워드 알림
                                <span className="text-sm font-normal text-gray-400 ml-2">설정하신 키워드가 포함된 공연입니다.</span>
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                                {keywordMatches.map((performance) => (
                                    <div key={`keyword-${performance.id}`}
                                        className="group bg-gray-800 rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 ring-1 ring-yellow-500/50"
                                    >
                                        {/* Simplified Card Render for keywords - Duplicated purely for hoisting visual */}
                                        {/* Ideally refactor Card into component but strict modify rules make duplicated inline safer for now if small */}
                                        {/* Actually I can just map them using the same structure as below list */}
                                        <div className="relative aspect-[3/4] overflow-hidden">
                                            <div
                                                className="cursor-pointer w-full h-full"
                                                onClick={() => {
                                                    const v = venues[performance.venue];
                                                    if (v) {
                                                        setSearchLocation({ lat: v.lat || 0, lng: v.lng || 0, name: performance.venue });
                                                        setViewMode('map');
                                                    }
                                                }}
                                            >
                                                <Image
                                                    src={performance.image || "/api/placeholder/400/300"}
                                                    alt={performance.title}
                                                    fill
                                                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                                                    sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
                                                {/* Keyword Badge */}
                                                <div className="absolute top-2 left-2 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full shadow-md z-10 flex items-center gap-1">
                                                    <Star className="w-3 h-3 fill-black" />
                                                    알림
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-4">
                                            <h3 className="font-bold text-lg text-white mb-1 line-clamp-1 group-hover:text-yellow-400 transition-colors">
                                                {performance.title}
                                            </h3>
                                            {/* Venue Link */}
                                            <div
                                                onClick={() => {
                                                    const v = venues[performance.venue];
                                                    if (v) {
                                                        setSearchLocation({ lat: v.lat || 0, lng: v.lng || 0, name: performance.venue });
                                                        setViewMode('map');
                                                    } else {
                                                        // No coord, just update text?
                                                    }
                                                }}
                                                className="text-gray-400 text-sm flex items-center gap-1 mb-2 hover:text-blue-400 cursor-pointer w-max"
                                            >
                                                <MapPin className="w-3 h-3" />
                                                {performance.venue}
                                            </div>
                                            <div className="flex justify-between items-end">
                                                <span className="text-gray-500 text-xs font-medium bg-gray-900 px-2 py-1 rounded">
                                                    {performance.genre}
                                                </span>
                                                <span className="text-gray-400 text-xs">{performance.date}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Sticky Sentinel */}
            <div ref={sentinelRef} className="absolute top-[80px] h-1 w-full pointer-events-none" />

            {/* Sticky Container */}
            <div className={clsx(
                "sticky top-0 z-50 transition-all duration-300",
                isSticky
                    ? (isFilterExpanded ? "bg-gray-900/95 backdrop-blur-md shadow-lg border-b border-gray-800 py-2" : "bg-gray-900/95 backdrop-blur-md shadow-lg border-b border-gray-800 h-10 flex items-center justify-center")
                    : (!isFilterExpanded ? "bg-gray-900/95 backdrop-blur-md shadow-lg border-b border-gray-800 h-10 flex items-center justify-center" : "bg-transparent py-4")
            )}>
                <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">

                    {/* Collapsed Sticky Header (Visible whenever collapsed) */}
                    {!isFilterExpanded && (
                        <div
                            onClick={() => setIsFilterExpanded(true)}
                            className="w-full flex items-center justify-between cursor-pointer"
                        >
                            <span className="font-bold text-gray-200 flex items-center gap-2">
                                <Search className="w-4 h-4 text-blue-500" />
                                상세 검색
                            </span>
                            <div className="flex items-center gap-2 text-gray-400">
                                {searchText && <span className="text-sm bg-gray-800 px-2 py-0.5 rounded-full text-blue-300 mx-2">"{searchText}"</span>}
                                <ChevronDown className="w-5 h-5 animate-pulse" />
                            </div>
                        </div>
                    )}

                    {/* Top Group: Filters & Search (Hidden when collapsed) */}
                    <div className={clsx(
                        "flex flex-col xl:flex-row gap-3 sm:gap-4 justify-between items-start xl:items-center transition-all duration-500 overflow-hidden",
                        !isFilterExpanded ? "max-h-0 opacity-0" : "max-h-[500px] opacity-100"
                    )}>

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
                            <div className="flex bg-gray-800 rounded-lg p-1 shrink-0 overflow-x-auto scrollbar-hide w-full sm:w-auto justify-between sm:justify-start">
                                {REGIONS.map(r => (
                                    <button
                                        key={r.id}
                                        onClick={() => {
                                            setSelectedRegion(r.id);
                                            setSelectedDistrict('all');
                                            setSelectedVenue('all');
                                        }}
                                        className={clsx(
                                            'flex-1 sm:flex-none px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap text-center',
                                            selectedRegion === r.id
                                                ? 'bg-blue-600 text-white shadow-md'
                                                : 'text-gray-400 hover:text-white hover:bg-gray-700'
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


                        {/* Search & Radius */}
                        {/* Search & Radius - UI Enhancements */}
                        <div className="flex flex-row gap-2 sm:gap-3 w-full xl:w-auto items-center max-w-full">

                            <div className={clsx(
                                "relative flex items-center bg-gray-800 border border-gray-700 rounded-full transition-all duration-300 flex-1 min-w-0 w-full sm:w-auto sm:max-w-[500px] shadow-sm hover:shadow-md hover:border-gray-500",
                                activeLocation ? "pl-1" : "pl-4"
                            )}>

                                {/* Radius Selector (Animated / Conditional) - Left Side */}
                                <div className={clsx(
                                    "overflow-hidden transition-all duration-300 flex items-center shrink-0",
                                    activeLocation ? "w-16 sm:w-24 opacity-100 mr-1 sm:mr-2" : "w-0 opacity-0"
                                )}>
                                    {activeLocation && (
                                        <select
                                            value={radius}
                                            onChange={(e) => setRadius(Number(e.target.value))}
                                            className="bg-transparent text-green-400 text-xs font-bold w-full h-full focus:outline-none cursor-pointer py-2 pl-1 sm:pl-2 appearance-none"
                                        >
                                            {RADIUS_OPTIONS.map(r => (
                                                <option key={r.value} value={r.value} className="bg-gray-900 text-white">{r.label}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                {/* Vertical Divider (Only if Active Location) */}
                                {activeLocation && <div className="w-[1px] h-6 bg-gray-600 mr-2"></div>}

                                {/* Search Input */}
                                <input
                                    type="text"
                                    className="flex-grow bg-transparent text-sm text-gray-200 placeholder-gray-500 focus:outline-none py-3 min-w-0"
                                    placeholder="공연명/장소 검색"
                                    value={searchText}
                                    onChange={handleSearchTextChange}
                                    onKeyDown={handleKeyDown}
                                />

                                {/* Clear Text 'X' Button */}
                                {searchText && (
                                    <button
                                        onClick={() => {
                                            setSearchText('');
                                            setIsDropdownOpen(false);
                                            setSearchResults([]);
                                        }}
                                        className="p-1 mr-1 text-gray-500 hover:text-gray-300 rounded-full hover:bg-gray-700 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}

                                {/* Search Button (Circle) - Right Side */}
                                <button
                                    onClick={handleSearch}
                                    disabled={isSearching}
                                    className="m-1 w-9 h-9 flex items-center justify-center rounded-full bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-lg shrink-0"
                                >
                                    {isSearching ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <Search className="w-4 h-4" />
                                    )}
                                </button>

                                {/* Dropdown Results */}
                                {isDropdownOpen && searchResults.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden max-h-[300px] overflow-y-auto custom-scrollbar">
                                        <div className="p-2 text-xs font-bold text-gray-500 border-b border-gray-700 bg-gray-800 sticky top-0">
                                            검색 결과 ({searchResults.length})
                                        </div>
                                        {searchResults.map((result, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => handleSelectResult(result)}
                                                className="w-full text-left p-3 hover:bg-gray-700 transition-colors border-b border-gray-700/50 last:border-0 flex items-start gap-3 group"
                                            >
                                                <div className="mt-1 p-1.5 rounded-full bg-gray-700 group-hover:bg-blue-600/20 text-gray-400 group-hover:text-blue-400 transition-colors">
                                                    <MapPin className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-sm text-gray-200 group-hover:text-white">{result.name}</div>
                                                    <div className="text-xs text-gray-400 line-clamp-1">{result.address}</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                            </div>

                            {/* Reset Location Button (Separate Circle) */}
                            {(activeLocation || searchText) && (
                                <button
                                    onClick={() => {
                                        setUserLocation(null);
                                        setSearchLocation(null);
                                        setSearchText('');
                                        setSearchResults([]);
                                        setIsDropdownOpen(false);
                                        setRadius(10);
                                    }}
                                    className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-800 border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700 shadow-sm transition-all shrink-0 group"
                                    title="위치 초기화"
                                >
                                    <RotateCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Genre Filter Row & Toggle Button Container */}
                    <div className={clsx(
                        "flex items-center gap-2 transition-all duration-300",
                        (isSticky && !isFilterExpanded) ? "max-h-0 opacity-0 mt-0" : "max-h-20 opacity-100"
                    )}>
                        {/* Genre List - Scrollable */}
                        <div className="flex-1 flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
                            {GENRES.map(g => (
                                <button
                                    key={g.id}
                                    onClick={() => setSelectedGenre(g.id)}
                                    className={clsx(
                                        'px-4 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap shrink-0',
                                        selectedGenre === g.id
                                            ? clsx(GENRE_STYLES[g.id]?.twActivebg || 'bg-blue-600', GENRE_STYLES[g.id]?.twBorder || 'border-blue-500', 'text-white shadow-md')
                                            : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
                                    )}
                                >
                                    {g.label}
                                </button>
                            ))}
                        </div>

                        {/* Toggle Expansion Button - Right Aligned */}
                        {/* Always visible if content is populated, controls expansion state */}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsFilterExpanded(!isFilterExpanded);
                            }}
                            className="relative z-10 shrink-0 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-400 hover:text-white rounded-full p-1.5 shadow-sm transition-colors"
                            title={isFilterExpanded ? "검색창 접기" : "검색창 펼치기"}
                        >
                            {isFilterExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            </div>


            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

                {/* Results Info */}
                <div className="flex flex-col sm:flex-row justify-between items-end mb-6 gap-2">
                    <div className="w-full sm:w-auto">
                        <h2 className="text-xl sm:text-2xl font-bold text-white mb-1 flex items-center gap-2">
                            {activeLocation ? (
                                <>
                                    <MapPin className="text-green-500 w-5 h-5" />
                                    <span className="truncate max-w-[200px] sm:max-w-md">
                                        {searchLocation ? `'${searchLocation.name}'` : '내 위치'}
                                    </span>
                                    <span className="text-base sm:text-xl shrink-0">주변 ({filteredPerformances.length})</span>
                                </>
                            ) : (
                                <>
                                    <span>추천 공연</span>
                                    <span className="text-base sm:text-xl text-gray-500 font-normal ml-2">({filteredPerformances.length})</span>
                                </>
                            )}
                        </h2>
                        <p className="text-gray-400 text-xs sm:text-sm">
                            {activeLocation
                                ? `${radius}km 이내 공연을 거리순으로 보여줍니다.`
                                : `조건에 맞는 공연을 찾았습니다.`}
                        </p>
                    </div>

                </div >

                {/* List View (Grid) */}
                < div className={clsx("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6", viewMode !== 'list' && "hidden")
                }>
                    {
                        visiblePerformances.map((perf) => {
                            const venueInfo = venues[perf.venue];
                            return (
                                <div key={`${perf.id}-${perf.region}`} className="group bg-gray-800 rounded-xl overflow-hidden border border-gray-700 hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-900/20 transition-all duration-300 flex flex-col h-full relative">
                                    {/* Image */}
                                    <div className="relative aspect-[3/4] bg-gray-900 overflow-hidden">
                                        {perf.image ? (
                                            <img
                                                src={perf.image}
                                                alt={perf.title}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                                loading="lazy"
                                            />
                                        ) : (
                                            <div className="flex items-center justify-center h-full text-gray-600">No Image</div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-60" />

                                        <div className="absolute top-2 right-2">
                                            <span className={clsx(
                                                "px-2 py-1 rounded text-[10px] font-bold uppercase backdrop-blur-md border border-white/10 text-white",
                                                GENRE_STYLES[perf.genre]?.twBg || 'bg-gray-600/80',
                                                "opacity-90"
                                            )}>
                                                {GENRES.find(g => g.id === perf.genre)?.label || perf.genre}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Details */}
                                    <div className="p-4 flex flex-col flex-grow">
                                        <div className="mb-2">
                                            <span className="inline-flex items-center gap-1 text-blue-400 text-xs font-bold mb-1">
                                                <Calendar className="w-3 h-3" /> {perf.date}
                                            </span>
                                            <h3 className="text-lg font-bold text-gray-100 line-clamp-2 leading-tight min-h-[3rem]" title={perf.title}>
                                                {perf.title}
                                            </h3>
                                        </div>

                                        <div className="mt-auto space-y-3">
                                            <div className="text-sm text-gray-400">
                                                <div className="flex items-center gap-1.5 mb-1">
                                                    <MapPin className="w-3.5 h-3.5 text-gray-500" />
                                                    <button
                                                        onClick={() => {
                                                            const v = venues[perf.venue];
                                                            if (v?.lat && v?.lng) {
                                                                setSearchLocation({
                                                                    lat: v.lat,
                                                                    lng: v.lng,
                                                                    name: perf.venue
                                                                });
                                                                setViewMode('map');
                                                            } else {
                                                                alert("해당 공연장의 위치 정보가 없습니다.");
                                                            }
                                                        }}
                                                        className="line-clamp-1 hover:text-blue-400 hover:underline text-left"
                                                    >
                                                        {perf.venue}
                                                    </button>
                                                </div>
                                                {/* Address hidden per request */}
                                            </div>

                                            <a
                                                href={perf.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block w-full text-center py-2 rounded-lg bg-gray-700 hover:bg-blue-600 text-gray-300 hover:text-white text-sm font-bold transition-colors"
                                            >
                                                예매하기
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    }
                </div >

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
                        className="fixed bottom-6 right-6 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-500 transition-all z-50 animate-bounce"
                        aria-label="Scroll to top"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                        </svg>
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
                        centerLocation={searchLocation}      // Pass search/focused location
                        onClose={() => setViewMode('list')}
                    />
                )
            }

        </div >
    );
}
