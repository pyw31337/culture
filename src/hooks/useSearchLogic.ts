import { useState, useEffect, useRef, useMemo } from 'react';
import { Performance } from '@/types';
import { isChoseongMatch } from '@/lib/hangul';

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

    // Kakao Location Search Logic
    useEffect(() => {
        searchTextRef.current = searchText;

        if (searchMode === 'location' && searchLocation && searchText === searchLocation.name) {
            return;
        }

        if (searchMode === 'location' && searchText.trim().length > 1) {
            const currentSearchText = searchText.trim();
            const timer = setTimeout(() => {
                const kakao = (window as any).kakao;
                if (kakao && kakao.maps) {
                    kakao.maps.load(() => {
                        if (kakao.maps.services) {
                            const ps = new kakao.maps.services.Places();
                            ps.keywordSearch(currentSearchText, (data: any, status: any) => {
                                if (searchTextRef.current.trim() !== currentSearchText) return;

                                if (status === kakao.maps.services.Status.OK) {
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
                                    setIsDropdownOpen(true);
                                } else {
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
