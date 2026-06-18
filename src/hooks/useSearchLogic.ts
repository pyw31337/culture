import { useState, useEffect, useRef, useMemo } from 'react';
import { Performance } from '@/types';
import { isChoseongMatch } from '@/lib/hangul';
import { loadKakaoMapSdk } from '@/lib/kakao-map-sdk';
import { buildLocalLocationCandidates, type LocationSearchCandidate } from '@/lib/location-search';

interface UseSearchLogicProps {
    allPerformances: Performance[];
    initialSearchText?: string;
}

export function useSearchLogic({ allPerformances, initialSearchText = '' }: UseSearchLogicProps) {
    const [searchText, setSearchText] = useState(initialSearchText);
    const [searchMode, setSearchMode] = useState<'keyword' | 'location'>('keyword');
    const [searchLocation, setSearchLocation] = useState<{ lat: number, lng: number, name: string } | null>(null);
    const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [userAddress, setUserAddress] = useState<string | null>(null);
    const [radius, setRadius] = useState<number>(1);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
    const [kakaoSearchResults, setKakaoSearchResults] = useState<any[]>([]);

    const searchTextRef = useRef(searchText);

    useEffect(() => {
        setSearchText(initialSearchText);
    }, [initialSearchText]);

    // Persistence of Search Mode
    useEffect(() => {
        const savedMode = localStorage.getItem('cultureflow_search_mode');
        if (savedMode === 'keyword' || savedMode === 'location') {
            setSearchMode(savedMode);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('cultureflow_search_mode', searchMode);
    }, [searchMode]);

    // Location search must stay separate from content keyword search.
    // Kakao Places is the primary source; local venue/address candidates keep the UI usable
    // when the SDK key is missing, blocked, or still loading.
    useEffect(() => {
        searchTextRef.current = searchText;

        if (searchMode === 'location' && searchLocation && searchText === searchLocation.name) {
            setKakaoSearchResults([]);
            return;
        }

        if (searchMode === 'location' && searchText.trim().length > 1) {
            const currentSearchText = searchText.trim();
            let cancelled = false;
            const timer = setTimeout(() => {
                const localFallback = () => buildLocalLocationCandidates(allPerformances, currentSearchText);

                loadKakaoMapSdk()
                    .then(() => {
                        if (cancelled || searchTextRef.current.trim() !== currentSearchText) return;

                        const kakao = (window as any).kakao;
                        if (!kakao?.maps?.services?.Places) {
                            setKakaoSearchResults(localFallback());
                            setIsDropdownOpen(true);
                            return;
                        }

                        kakao.maps.load(() => {
                            if (cancelled || searchTextRef.current.trim() !== currentSearchText) return;

                            const ps = new kakao.maps.services.Places();
                            ps.keywordSearch(currentSearchText, (data: any[], status: any) => {
                                if (cancelled || searchTextRef.current.trim() !== currentSearchText) return;

                                if (status === kakao.maps.services.Status.OK) {
                                    const filteredData = data.filter((place: any) => {
                                        const category = place.category_name || '';
                                        const isIrrelevant = /서비스,산업|부동산|기업/.test(category);
                                        const isExactMatch = place.place_name.toLowerCase().includes(currentSearchText.toLowerCase());
                                        return !isIrrelevant || isExactMatch;
                                    });

                                    const kakaoResults: LocationSearchCandidate[] = filteredData.map((place: any): LocationSearchCandidate => ({
                                        type: 'location',
                                        name: place.place_name,
                                        address: place.road_address_name || place.address_name,
                                        lat: parseFloat(place.y),
                                        lng: parseFloat(place.x),
                                        venueId: place.id,
                                        category: place.category_group_name || place.category_name,
                                        source: 'kakao'
                                    })).filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng));

                                    setKakaoSearchResults(kakaoResults.length > 0 ? kakaoResults : localFallback());
                                } else {
                                    setKakaoSearchResults(localFallback());
                                }
                                setIsDropdownOpen(true);
                            }, { size: 15 });
                        });
                    })
                    .catch(() => {
                        if (cancelled || searchTextRef.current.trim() !== currentSearchText) return;
                        setKakaoSearchResults(localFallback());
                        setIsDropdownOpen(true);
                    });
            }, 300);
            return () => {
                cancelled = true;
                clearTimeout(timer);
            };
        } else if (searchMode === 'location' && searchText.trim().length === 0) {
            setKakaoSearchResults([]);
        }
    }, [searchText, searchMode, searchLocation, allPerformances]);

    // Unified Search Results
    const searchResults = useMemo(() => {
        if (!searchText.trim()) return [];

        if (searchMode === 'location') {
            return kakaoSearchResults;
        } else {
            // Weighted scoring search.
            //   exact title prefix    : 100
            //   title contains        :  70
            //   choseong title match  :  60
            //   venue contains        :  35
            //   cast contains         :  25
            //   genre label contains  :  20
            // Higher score wins; ties broken by upcoming date (input order).
            const lowerText = searchText.toLowerCase().replace(/\s+/g, '');
            const isChoseong = /^[ㄱ-ㅎ\s]+$/.test(searchText);

            const scored: Array<{ p: Performance; score: number }> = [];
            const uniqueTitles = new Set<string>();

            for (const p of allPerformances) {
                if (uniqueTitles.has(p.title)) continue;
                const titleNoSpace = p.title.toLowerCase().replace(/\s+/g, '');
                const venueNoSpace = (p.venue || '').toLowerCase().replace(/\s+/g, '');
                const genreLabelNoSpace = (p.genre || '').toLowerCase();

                let score = 0;
                if (isChoseong) {
                    if (isChoseongMatch(p.title, searchText)) score = 60;
                } else {
                    if (titleNoSpace.startsWith(lowerText)) score = 100;
                    else if (titleNoSpace.includes(lowerText)) score = 70;
                    else if (venueNoSpace.includes(lowerText)) score = 35;
                    else if (p.cast && Array.isArray(p.cast) && p.cast.some((c: unknown) =>
                        typeof c === 'string'
                            ? c.replace(/\s+/g, '').toLowerCase().includes(lowerText)
                            : (c as { name?: string })?.name?.replace(/\s+/g, '').toLowerCase().includes(lowerText)
                    )) score = 25;
                    else if (genreLabelNoSpace.includes(lowerText)) score = 20;
                }

                if (score > 0) {
                    uniqueTitles.add(p.title);
                    scored.push({ p, score });
                }
            }

            scored.sort((a, b) => b.score - a.score);

            return scored.slice(0, 24).map(({ p }) => ({
                type: p.genre === 'movie' ? 'video' : 'stage',
                name: p.title,
                address: p.venue,
                ...p
            }));
        }
    }, [searchText, searchMode, allPerformances, kakaoSearchResults]);

    // Dropdown auto-management removed to prevent auto-opening on category change

    useEffect(() => {
        setHighlightedIndex(-1);
    }, [searchResults]);

    return {
        searchText,
        setSearchText,
        searchMode,
        setSearchMode,
        searchLocation,
        setSearchLocation,
        userLocation,
        setUserLocation,
        userAddress,
        setUserAddress,
        radius,
        setRadius,
        isDropdownOpen,
        setIsDropdownOpen,
        highlightedIndex,
        setHighlightedIndex,
        searchResults,
        kakaoSearchResults
    };
}
