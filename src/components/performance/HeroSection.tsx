import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { clsx } from 'clsx';
import { ChevronDown, RotateCcw, Search, X, Star, MapPin, Clock, TrendingUp } from 'lucide-react';
import { TypingHero } from './TypingHero';
import { LocationSelector } from '../LocationSelector';
import { HeroTemplate } from '../../lib/hero-templates';
import { REGIONS } from '../../lib/constants';

interface HeroSectionProps {
    heroText: HeroTemplate;
    onCycle: () => void;
    isHeroVisible: boolean;
    viewMode: string;
    selectedGenre: string;
    selectedRegion: string;
    selectedDistrict: string;
    selectedVenue: string;
    activeLocation: { lat?: number, lng?: number, name: string } | null;
    userAddress: string | null;
    radius: number;
    searchLocation?: any;
    searchText: string;
    searchResults: any[];
    isDropdownOpen: boolean;
    activeSearchSource: 'hero' | 'sticky';
    highlightedIndex: number;

    // Setters / Handlers
    setIsHeroFilterExpanded: React.Dispatch<React.SetStateAction<boolean>>;
    isHeroFilterExpanded: boolean;
    setSelectedRegion: (val: string) => void;
    setSelectedDistrict: (val: string) => void;
    setSelectedVenue: (val: string) => void;
    setUserLocation: (val: { lat: number, lng: number } | null) => void;
    setSearchLocation: (val: { lat: number, lng: number, name: string } | null) => void;
    setRadius: (val: number) => void;
    setSearchText: (val: string) => void;
    setActiveSearchSource: (val: 'hero' | 'sticky') => void;
    setIsDropdownOpen: (val: boolean) => void;
    handleSearch: () => void;
    handleSelectResult: (candidate: any) => void;
    handleKeyDown: (e: React.KeyboardEvent) => void;
    handleCurrentLocationClick: () => void; // New prop for location click

    // Data
    availableVenues: string[];
    districts: string[];

    // New Props for Search History
    recentKeywords: string[];
    onKeywordSelect: (keyword: string) => void;
    onRemoveRecent: (keyword: string) => void;
    onClearRecent: () => void;

    // Search Mode
    searchMode: 'keyword' | 'location';
    onSearchModeChange: (mode: 'keyword' | 'location') => void;
    onSearchChange: (text: string) => void;
}

export default function HeroSection({
    heroText,
    onCycle,
    isHeroVisible,
    viewMode,
    selectedGenre,
    selectedRegion,
    selectedDistrict,
    selectedVenue,
    activeLocation,
    userAddress,
    radius,
    searchLocation,
    searchText,
    searchResults,
    isDropdownOpen,
    activeSearchSource,
    highlightedIndex,
    setIsHeroFilterExpanded,
    isHeroFilterExpanded,
    setSelectedRegion,
    setSelectedDistrict,
    setSelectedVenue,
    setUserLocation,
    setSearchLocation,
    setRadius,
    setSearchText,
    setActiveSearchSource,
    setIsDropdownOpen,
    handleSearch,
    handleSelectResult,
    handleKeyDown,
    handleCurrentLocationClick,
    availableVenues,
    districts,
    recentKeywords,
    onKeywordSelect,
    onRemoveRecent,
    onClearRecent,
    searchMode,
    onSearchModeChange,
    onSearchChange
}: HeroSectionProps) {
    const heroRef = useRef<HTMLDivElement>(null);
    const searchContainerRef = useRef<HTMLDivElement>(null);

    // Handle scroll to sync animation
    const [isAtTop, setIsAtTop] = useState(true);
    const [localHeroCycle, setLocalHeroCycle] = useState(0);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollPos = window.scrollY;
            setIsAtTop(currentScrollPos < 50); // Threshold for being "at top"
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleHeroCycle = useCallback(() => {
        setLocalHeroCycle((prev) => prev + 1);
        onCycle();
    }, [onCycle]);

    // Handle click outside to close search dropdown
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                if (isDropdownOpen && activeSearchSource === 'hero') {
                    setIsDropdownOpen(false);
                }
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isDropdownOpen, activeSearchSource, setIsDropdownOpen]);

    // Logic for determining the current template to display
    const currentTemplate = useMemo(() => {
        const now = new Date();
        const minuteSeed = now.getMinutes();
        const rotationSeed = minuteSeed + localHeroCycle;
        const hour = now.getHours();
        const day = now.getDay();
        const month = now.getMonth() + 1;

        const isWeekend = day === 0 || day === 6;
        const isFriday = day === 5;

        // Dynamic title messages for likes-perf
        const likesPerfMessages: any[] = [
            { line1: "평소에", line2Pre: "좋아요로 Pick 한 ", highlight: "컨텐츠들", suffix: "을 살펴볼까요?" },
            { line1: "당신의", line2Pre: "마음을 사로잡은 ", highlight: "컨텐츠", suffix: "들이에요." },
            { line1: "하트를 눌렀던", line2Pre: "그 순간을 ", highlight: "다시", suffix: " 만나보세요." },
            { line1: "찜해둔", line2Pre: "컨텐츠 중에 ", highlight: "오늘", suffix: " 볼만한 건 뭐가 있을까요?" },
            { line1: "좋아요 리스트,", line2Pre: "당신만의 ", highlight: "컬렉션", suffix: "이에요." },
            { line1: "설렘이 담긴", line2Pre: "컨텐츠 ", highlight: "리스트", suffix: "를 확인해볼게요." },
            { line1: "기억해둔", line2Pre: "그 컨텐츠들, ", highlight: "지금", suffix: " 확인해보세요." },
            { line1: "마음에 담아둔", line2Pre: "컨텐츠 ", highlight: "목록", suffix: "이에요." },
            { line1: "좋아요 버튼,", line2Pre: "진심을 담아 누른 ", highlight: "컨텐츠", suffix: "들이죠." },
            { line1: "당신의 취향이", line2Pre: "반영된 ", highlight: "컨텐츠들", suffix: "을 모아봤어요." }
        ];

        // Dynamic title messages for likes-venue
        const likesVenueMessages: any[] = [
            { line1: "찜한 공연장에서", line2Pre: "오늘 어떤 ", highlight: "컨텐츠", suffix: "가 열리고 있을까요?" },
            { line1: "자주 찾는", line2Pre: "공연장의 ", highlight: "일정", suffix: "을 확인해보세요." },
            { line1: "좋아하는 공연장,", line2Pre: "그곳의 ", highlight: "무대", suffix: "가 기다리고 있어요." },
            { line1: "마음에 든 공연장의", line2Pre: "오늘의 ", highlight: "라인업", suffix: "은 뭘까요?" },
            { line1: "찜한 공연장에서", line2Pre: "새로운 ", highlight: "컨텐츠", suffix: "를 발견해보세요." },
            { line1: "익숙한 그 공연장,", line2Pre: "특별한 ", highlight: "오늘", suffix: "이 될 수도 있어요." },
            { line1: "당신이 사랑하는", line2Pre: "공연장의 ", highlight: "소식", suffix: "을 전해드릴게요." },
            { line1: "공연장 Pick,", line2Pre: "거기서 뭐 ", highlight: "하고 있나", suffix: " 볼까요?" },
            { line1: "찜한 공연장 어때요?", line2Pre: "오늘의 ", highlight: "무대", suffix: "를 확인해보세요." },
            { line1: "자주 가는 그곳,", line2Pre: "새 ", highlight: "컨텐츠", suffix: "가 기다리고 있을지도요." }
        ];

        const perfMsg = likesPerfMessages[rotationSeed % likesPerfMessages.length];
        const venueMsg = likesVenueMessages[rotationSeed % likesVenueMessages.length];

        // Category-specific emotional messages with boldPrefix
        const genreMessages: Record<string, any[]> = {
            movie: [
                { line1: "퇴근하고", boldPrefix: "영화", line2Pre: " 한편에 ", highlight: "맥주 한잔", suffix: "만한게 없죠?" },
                { line1: "오늘 밤,", boldPrefix: "영화", line2Pre: "관에서 만나는 ", highlight: "감동", suffix: "은 어떠세요?" },
                { line1: "팝콘 향기 가득한", boldPrefix: "영화", line2Pre: "관, ", highlight: "스크린", suffix: "이 기다리고 있어요." },
                { line1: "어둠 속에서", boldPrefix: "영화", line2Pre: " 한 편과 함께 ", highlight: "힐링", suffix: "해보세요." },
                { line1: hour < 12 ? "조용한 아침," : (hour < 18 ? "나른한 오후," : "깊어가는 밤,"), boldPrefix: "영화", line2Pre: "관에서 ", highlight: "색다른 휴식", suffix: "을 즐겨보세요." },
                { line1: isWeekend ? "여유로운 주말엔" : "지루한 일상엔", boldPrefix: "영화", line2Pre: "! ", highlight: "최신 개봉작", suffix: "을 확인해보세요." },
                { line1: "스크린 속으로", boldPrefix: "영화", line2Pre: " 보러 ", highlight: "떠나볼까요", suffix: "?" },
                { line1: "두 시간의 행복,", boldPrefix: "영화", line2Pre: " 한 편 ", highlight: "어때요", suffix: "?" },
                { line1: "눈과 귀가 즐거운", boldPrefix: "영화", line2Pre: " ", highlight: "시간", suffix: "을 선물해드릴게요." },
                { line1: "오늘의 기분엔", boldPrefix: "영화", line2Pre: " 한 편이 ", highlight: "딱", suffix: "이에요." }
            ],
            musical: [
                { line1: "무대 위 감동,", boldPrefix: "뮤지컬", line2Pre: " 배우들의 ", highlight: "열창", suffix: "이 기다리고 있어요." },
                { line1: "라이브로 느끼는", boldPrefix: "뮤지컬", line2Pre: "의 ", highlight: "감동", suffix: "을 경험해보세요." },
                { line1: "화려한 무대,", boldPrefix: "뮤지컬", line2Pre: "의 ", highlight: "마법", suffix: "에 빠져보세요." },
                { line1: isFriday ? "불타는 금요일엔" : "특별한 날엔", boldPrefix: "뮤지컬", line2Pre: " ", highlight: "대작 무대", suffix: "가 정답이죠." },
                { line1: "배우의 열정이", boldPrefix: "뮤지컬", line2Pre: " 무대를 ", highlight: "빛나게", suffix: " 해요." },
                { line1: "멜로디와 함께하는", boldPrefix: "뮤지컬", line2Pre: " ", highlight: "스토리", suffix: "를 만나보세요." },
                { line1: "넘버 하나하나가", boldPrefix: "뮤지컬", line2Pre: "의 ", highlight: "명장면", suffix: "이에요." },
                { line1: "오늘 밤 주인공은", boldPrefix: "뮤지컬", line2Pre: " ", highlight: "당신", suffix: "이에요." },
                { line1: (month >= 3 && month <= 5) ? "봄바람과 어울리는" : (month >= 11 || month <= 2 ? "겨울밤 따뜻한" : "언제나 설레는"), boldPrefix: "뮤지컬", line2Pre: " ", highlight: "데이트", suffix: " 어때요?" }
            ],
            play: [
                { line1: "배우의 숨결이", boldPrefix: "연극", line2Pre: " 무대에서 ", highlight: "느껴져요", suffix: "." },
                { line1: "작은 무대,", boldPrefix: "연극", line2Pre: "만의 ", highlight: "큰 감동", suffix: "이 있어요." },
                { line1: "살아있는 연기,", boldPrefix: "연극", line2Pre: " ", highlight: "진짜 무대", suffix: "를 만나보세요." },
                { line1: "가까이서 느끼는", boldPrefix: "연극", line2Pre: " 배우의 ", highlight: "열정", suffix: "!" },
                { line1: "눈빛으로 전하는", boldPrefix: "연극", line2Pre: "의 ", highlight: "이야기", suffix: "를 들어보세요." },
                { line1: "무대와 객석이", boldPrefix: "연극", line2Pre: "에서 ", highlight: "하나", suffix: "가 되는 순간." },
                { line1: "오늘 밤,", boldPrefix: "연극", line2Pre: " 한 편 ", highlight: "어떠세요", suffix: "?" },
                { line1: isWeekend ? "주말 대학로 나들이," : "평일 저녁의 여유,", boldPrefix: "연극", line2Pre: "과 ", highlight: "함께", suffix: "하세요." },
                { line1: "배우와 눈을", boldPrefix: "연극", line2Pre: "에서 ", highlight: "마주쳐요", suffix: "." }
            ],
            concert: [
                { line1: "라이브의 전율,", boldPrefix: "콘서트", line2Pre: " ", highlight: "현장", suffix: "을 느껴보세요." },
                { line1: "함께 따라부르는", boldPrefix: "콘서트", line2Pre: " ", highlight: "떼창", suffix: "의 감동!" },
                { line1: "좋아하는 아티스트", boldPrefix: "콘서트", line2Pre: "를 ", highlight: "직접", suffix: " 만나보세요." },
                { line1: isFriday || isWeekend ? "스트레스 날리는" : "지친 하루 끝엔", boldPrefix: "콘서트", line2Pre: " ", highlight: "열광의 밤", suffix: "!" },
                { line1: "응원봉 흔들며", boldPrefix: "콘서트", line2Pre: " ", highlight: "열광", suffix: "하는 밤!" },
                { line1: "현장의 열기를", boldPrefix: "콘서트", line2Pre: "에서 ", highlight: "느껴봐요", suffix: "." },
                { line1: "음악과 하나 되는", boldPrefix: "콘서트", line2Pre: " ", highlight: "순간", suffix: "!" },
                { line1: "앵콜까지 함께하는", boldPrefix: "콘서트", line2Pre: " ", highlight: "밤", suffix: "!" }
            ],
            exhibition: [
                { line1: "작품 앞에서", boldPrefix: "전시", line2Pre: "회장에서 ", highlight: "멈춰서요", suffix: "." },
                { line1: "예술이 주는", boldPrefix: "전시", line2Pre: "의 ", highlight: "영감", suffix: "을 느껴보세요." },
                { line1: hour < 12 ? "조용한 오전의 미술관," : "오후의 따뜻한 전시,", boldPrefix: "전시", line2Pre: " ", highlight: "사색의 시간", suffix: "을 가져보세요." },
                { line1: "여유롭게 거닐며", boldPrefix: "전시", line2Pre: "를 ", highlight: "감상해요", suffix: "." },
                { line1: "사진 찍기 좋은", boldPrefix: "전시", line2Pre: " ", highlight: "인생샷 스팟", suffix: "을 찾아보세요." },
                { line1: "오늘은 문화인으로", boldPrefix: "전시", line2Pre: "회에서 ", highlight: "힐링", suffix: "해요." },
                { line1: "예술적 영감이", boldPrefix: "전시", line2Pre: "에서 ", highlight: "샘솟아요", suffix: "." },
                { line1: "작품과 대화하는", boldPrefix: "전시", line2Pre: " ", highlight: "시간", suffix: "!" }
            ],
            activity: [
                { line1: "몸을 움직이면", boldPrefix: "액티비티", line2Pre: "로 ", highlight: "스트레스 해소", suffix: "!" },
                { line1: "짜릿한 경험,", boldPrefix: "액티비티", line2Pre: " ", highlight: "도전", suffix: "은 어떠세요?" },
                { line1: isWeekend ? "주말엔 역시 밖으로!" : "답답한 일상 탈출,", boldPrefix: "액티비티", line2Pre: "로 ", highlight: "에너지 충전", suffix: "!" },
                { line1: "새로운 도전이", boldPrefix: "액티비티", line2Pre: "에서 ", highlight: "기다려요", suffix: "." },
                { line1: "땀 흘리며 즐기는", boldPrefix: "액티비티", line2Pre: " ", highlight: "재미", suffix: "!" },
                { line1: "아드레날린 폭발!", boldPrefix: "액티비티", line2Pre: " ", highlight: "체험", suffix: "해볼까요?" }
            ]
        };

        const genreMsg = selectedGenre !== 'all' && genreMessages[selectedGenre]
            ? genreMessages[selectedGenre][rotationSeed % genreMessages[selectedGenre].length]
            : null;

        if (viewMode === 'likes-perf') {
            return { ...perfMsg, keywords: [], boldPrefix: undefined } as HeroTemplate;
        } else if (viewMode === 'likes-venue') {
            return { ...venueMsg, keywords: [], boldPrefix: undefined } as HeroTemplate;
        } else if (genreMsg) {
            return { ...genreMsg, keywords: [] } as HeroTemplate;
        } else if (searchText) {
            const rawSearchLabel =
                searchMode === 'location'
                    ? (searchLocation?.name || activeLocation?.name || searchText)
                    : searchText;
            const cleanSearch = rawSearchLabel
                .replace(/\s*\([^)]*\)\s*/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            const searchMsgs = [
                { line1: "찾으시는 컨텐츠,", line2Pre: "입력하신 ", highlight: `"${cleanSearch}"`, suffix: " 결과입니다." },
                { line1: "궁금해하신 정보,", line2Pre: "", highlight: `"${cleanSearch}"`, suffix: " 키워드로 모아봤어요." },
                { line1: "원하시는 그곳,", line2Pre: "", highlight: `"${cleanSearch}"`, suffix: " 관련 소식을 전해드려요." }
            ];
            if (searchMode === 'location') {
                return { ...searchMsgs[0], keywords: [] } as HeroTemplate;
            }
            return { ...searchMsgs[rotationSeed % searchMsgs.length], keywords: [] } as HeroTemplate;
        } else if (selectedRegion !== 'all' || selectedVenue !== 'all') {
            const regionName = selectedRegion !== 'all' ? REGIONS.find(r => r.id === selectedRegion)?.label : '';
            const locationString = `${regionName || ''} ${selectedDistrict !== 'all' ? selectedDistrict : ''} ${selectedVenue !== 'all' ? selectedVenue : ''}`.trim();

            const locationMsgs = [
                { line1: "현재,", boldPrefix: locationString, line2Pre: "에서 진행중인 ", highlight: "문화 정보", suffix: "들이에요." },
                { line1: "지금,", boldPrefix: locationString, line2Pre: " 주변의 ", highlight: "핫한 무대", suffix: "를 확인해보세요." },
                { line1: "우리 동네,", boldPrefix: locationString, line2Pre: " 숨은 ", highlight: "문화 예술", suffix: "을 찾아줄게요." }
            ];
            return { ...locationMsgs[rotationSeed % locationMsgs.length], keywords: [] } as HeroTemplate;
        } else {
            return heroText;
        }
    }, [viewMode, selectedGenre, searchText, searchMode, searchLocation, activeLocation, selectedRegion, selectedDistrict, selectedVenue, heroText, localHeroCycle]);


    // Close filter panel when clicking outside
    const filterRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                // Also check if the toggle button was clicked (avoid immediate re-open)
                // We can't easily check the button ref here unless we pass it or use a shared parent.
                // But the toggle button usually stops propagation or we just check closest.
                // Simple fix: Check if target is inside the toggle button.
                const target = event.target as Element;
                if (target.closest('button[title="지역 설정 열기"]') || target.closest('button[title="지역 설정 닫기"]')) {
                    return;
                }
                setIsHeroFilterExpanded(false);
            }
        }
        if (isHeroFilterExpanded) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isHeroFilterExpanded, setIsHeroFilterExpanded]);

    return (
        <div className={clsx(
            "relative max-w-7xl 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-10 flex flex-col lg:flex-row justify-between lg:items-center gap-8",
            (!(isDropdownOpen && activeSearchSource === 'hero')) && "overflow-visible",
            (isDropdownOpen && activeSearchSource === 'hero') ? "z-[100]" : "z-[30]"
        )}>
            <div className="text-left flex-1 min-w-0 z-10">
                {selectedGenre !== 'movie' && (
                    <p className={clsx(
                        "font-extrabold mb-3 flex items-center gap-2 text-sm md:text-base transition-colors duration-500",
                        searchMode === 'location' ? "text-emerald-400" : "text-[#a78bfa]"
                    )}>
                        <button
                            onClick={handleCurrentLocationClick}
                            className={clsx(
                                "flex items-center gap-1 transition-colors group/label mr-2",
                                searchMode === 'location'
                                    ? "hover:text-white light:hover:text-emerald-600"
                                    : "hover:text-white light:hover:text-purple-600"
                            )}
                            title="내 위치 찾기"
                        >
                            <MapPin className={clsx(
                                "w-4 h-4 group-hover/label:scale-110 transition-transform",
                                searchMode === 'location'
                                    ? "text-emerald-400 light:text-emerald-600"
                                    : "text-[#a78bfa] light:text-purple-600"
                            )} />
                            <span>
                                {(selectedRegion === 'all' && selectedVenue === 'all')
                                    ? (activeLocation ? (searchLocation ? '검색위치 :' : '현재위치 :') : '현재위치 :')
                                    : '설정위치 :'
                                }
                            </span>
                        </button>
                        <span
                            onClick={() => setIsHeroFilterExpanded(prev => !prev)}
                            className={clsx(
                                "text-white light:text-black cursor-pointer hover:border-white transition-colors",
                                searchMode === 'location'
                                    ? "border-b border-emerald-400"
                                    : "border-b border-[#a78bfa]"
                            )}
                        >
                            {(selectedRegion === 'all' && selectedVenue === 'all')
                                ? (searchLocation?.name
                                    ? searchLocation.name
                                    : (activeLocation
                                        ? (userAddress || '내 위치 (GPS)')
                                        : '전국'))
                                : `${selectedRegion !== 'all' ? REGIONS.find(r => r.id === selectedRegion)?.label || '' : ''} ${selectedDistrict !== 'all' ? selectedDistrict : ''} ${selectedVenue !== 'all' ? selectedVenue : ''}`.trim() || '전국'
                            }
                        </span>

                        <button
                            onClick={() => setIsHeroFilterExpanded(prev => !prev)}
                            className={clsx(
                                "ml-2 p-1.5 rounded-full bg-white/10 hover:bg-white/20 light:bg-black/5 light:hover:bg-black/10 text-gray-400 hover:text-white light:text-gray-600 light:hover:text-black transition-all border border-white/5 hover:border-white/20 light:border-black/5 light:hover:border-black/10",
                                isHeroFilterExpanded && "bg-white/20 text-white light:bg-purple-100 light:text-purple-700"
                            )}
                            title={isHeroFilterExpanded ? "지역 설정 닫기" : "지역 설정 열기"}
                        >
                            <ChevronDown className={clsx("w-3.5 h-3.5 transition-transform duration-300", isHeroFilterExpanded && "rotate-180")} />
                        </button>

                        {(activeLocation || selectedRegion !== 'all' || selectedVenue !== 'all') && (
                            <button
                                onClick={() => {
                                    setSelectedRegion('all');
                                    setSelectedDistrict('all');
                                    setSelectedVenue('all');
                                    setUserLocation(null);
                                    setSearchLocation(null);
                                    onSearchChange(''); // Clear search keyword and sync with URL
                                }}
                                className="ml-2 p-1.5 rounded-full bg-white/10 hover:bg-white/20 light:bg-black/5 light:hover:bg-black/10 text-gray-400 hover:text-white light:text-gray-600 light:hover:text-black transition-all border border-white/5 hover:border-white/20 light:border-black/5 light:hover:border-black/10 group/reload"
                                title="전체 지역으로 초기화"
                            >
                                <RotateCcw className="w-3.5 h-3.5 group-hover/reload:-rotate-180 transition-transform duration-500" />
                            </button>
                        )}
                    </p>
                )}

                {/* Inline Filter Panel (Toggle) */}
                {isHeroFilterExpanded && (
                    <div ref={filterRef} className={clsx(
                        "mt-2 mb-4 animate-in fade-in slide-in-from-top-2 duration-300 origin-top relative w-full backdrop-blur-3xl shadow-2xl rounded-2xl z-[60] transition-colors duration-500",
                        searchMode === 'location'
                            ? "bg-[#0a1f1a]/95 light:bg-white/95 border border-emerald-500/20 light:border-black/5"
                            : "bg-[#1a0b2e]/95 light:bg-white/95 border border-purple-500/20 light:border-black/5"
                    )}>
                        <div className="flex flex-col gap-4 p-6">
                            <LocationSelector
                                selectedRegion={selectedRegion}
                                onRegionSelect={(r) => {
                                    setSelectedRegion(r);
                                    if (r !== selectedRegion) {
                                        setSelectedDistrict('all');
                                        setSelectedVenue('all');
                                    }
                                }}
                                selectedDistrict={selectedDistrict}
                                onDistrictSelect={(d) => {
                                    setSelectedDistrict(d);
                                    if (d !== selectedDistrict) setSelectedVenue('all');
                                }}
                                selectedVenue={selectedVenue}
                                onVenueSelect={setSelectedVenue}
                                districts={districts}
                                availableVenues={availableVenues}
                                searchMode={searchMode}
                            />
                        </div>

                        {/* Search Dropdown - Main Hero */}
                        {isDropdownOpen && searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-4 bg-[#1a0b2e] light:bg-white backdrop-blur-xl rounded-2xl border border-white/10 light:border-gray-200 shadow-[0_10px_40px_rgba(0,0,0,0.5)] overflow-hidden z-[100] max-h-[320px] overflow-y-auto custom-scrollbar">
                                <div className="p-2">
                                    <div className="px-3 py-2 text-xs font-bold text-gray-400 light:text-gray-500 uppercase tracking-wider flex justify-between items-center">
                                        <span>검색 결과</span>
                                        <button onClick={() => setIsDropdownOpen(false)} className="bg-transparent hover:bg-white/5 p-1 rounded-full text-white light:text-black"><X size={14} /></button>
                                    </div>
                                    {searchResults.map((result, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleSelectResult(result)}
                                            className="w-full text-left px-4 py-3 rounded-xl hover:bg-white/10 light:hover:bg-gray-50 transition-colors flex items-start gap-3 group"
                                        >
                                            <div className="mt-0.5 p-2 rounded-lg bg-gray-800 light:bg-gray-100 text-gray-400 group-hover:text-white light:group-hover:text-black group-hover:bg-purple-500 transition-colors">
                                                {result.type === 'location' ? <MapPin size={16} /> : <Search size={16} />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-bold text-gray-200 light:text-gray-900 truncate group-hover:text-purple-400 light:group-hover:text-purple-600 transition-colors">
                                                    {result.name}
                                                </div>
                                                {result.address && (
                                                    <div className="text-xs text-gray-500 light:text-gray-500 truncate mt-0.5">
                                                        {result.category ? <span className="text-purple-400 mr-2">{result.category}</span> : null}
                                                        {result.address}
                                                    </div>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div ref={heroRef}>
                    <TypingHero
                        key={[
                            currentTemplate.line1,
                            currentTemplate.boldPrefix || '',
                            currentTemplate.line2Pre,
                            currentTemplate.highlight,
                            currentTemplate.suffix
                        ].join('||')}
                        template={currentTemplate}
                        onCycle={handleHeroCycle}
                        paused={!isHeroVisible || !['list', 'grid', 'likes-perf', 'likes-venue'].includes(viewMode)}
                        searchMode={searchMode}
                        isAtTop={isAtTop}
                    />
                </div>

            </div>

            {/* Hero Search Bar */}
            <div
                ref={searchContainerRef}
                className={clsx(
                    "w-full lg:w-auto relative group",
                    (isDropdownOpen && activeSearchSource === 'hero') ? "z-[101]" : "z-[30]"
                )}>


                {/* Light Mode Static Glow */}
                <div className={clsx(
                    "hidden light:block absolute -inset-4 blur-2xl rounded-full opacity-70 pointer-events-none transition-colors duration-500",
                    searchMode === 'location'
                        ? "bg-gradient-to-r from-[#55df99]/30 to-[#0090f5]/30"
                        : "bg-gradient-to-r from-purple-400/20 via-pink-400/15 to-purple-400/20"
                )} />

                {/* Main Container */}
                <div className={clsx(
                    "p-[3px] rounded-full transition-all duration-300 relative",
                    searchMode === 'location'
                        ? "bg-linear-to-r from-[#55df99] to-[#0090f5] light:shadow-[0_4px_30px_rgba(85,223,153,0.35)]"
                        : "bg-linear-to-r from-[#a78bfa] via-purple-500 to-[#f472b6] light:shadow-[0_4px_30px_rgba(168,85,247,0.25)]"
                )}>
                    <div className="bg-[#0a0a0a] light:bg-white rounded-full flex items-center p-1 relative mix-blend-hard-light light:mix-blend-normal">
                        {/* Mode Toggle Button (Now on Left) */}
                        <button
                            onClick={() => onSearchModeChange(searchMode === 'keyword' ? 'location' : 'keyword')}
                            className={clsx(
                                "p-3.5 rounded-full text-white shadow-md hover:scale-105 active:scale-95 transition-all outline-none flex items-center justify-center shrink-0",
                                searchMode === 'location'
                                    ? "bg-gradient-to-br from-[#55df99] to-[#0090f5] shadow-emerald-500/30 text-white"
                                    : "bg-gradient-to-r from-[#a78bfa] to-[#f472b6] text-white"
                            )}
                            title={searchMode === 'location' ? "키워드 검색으로 변경" : "위치 검색으로 변경"}
                        >
                            {searchMode === 'location'
                                ? <MapPin className="w-5 h-5 font-extrabold" />
                                : <Search className="w-5 h-5 font-extrabold" />
                            }
                        </button>

                        {/* Input Field (Fill the rest) */}
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={searchText}
                                onFocus={() => {
                                    setActiveSearchSource('hero');
                                    setIsDropdownOpen(true);
                                }}
                                onClick={() => setIsDropdownOpen(true)}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSearchText(val);
                                    // Reset location filters when user starts typing search
                                    if (val && (selectedRegion !== 'all' || selectedDistrict !== 'all' || selectedVenue !== 'all')) {
                                        setSelectedRegion('all');
                                        setSelectedDistrict('all');
                                        setSelectedVenue('all');
                                    }
                                    if (!isDropdownOpen) setIsDropdownOpen(true);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        if (searchMode === 'location' && searchResults?.length > 0 && searchText.trim() !== '') {
                                            handleSelectResult(searchResults[0]);
                                        } else {
                                            setIsDropdownOpen(false);
                                            handleKeyDown(e);
                                        }
                                    }
                                }}
                                className="bg-transparent border-none text-white light:text-black text-lg font-extrabold px-5 py-3 w-full lg:w-[480px] focus:outline-none placeholder-gray-600 caret-white light:caret-black"
                                placeholder={searchMode === 'location'
                                    ? "위치 검색"
                                    : "컨텐츠 검색"
                                }
                            />
                            {/* Reset Button (Next to Input) */}
                            {searchText && (
                                <button
                                    onClick={() => {
                                        onSearchChange('');
                                        setIsDropdownOpen(false);
                                        setSearchLocation(null);
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-white light:hover:text-black transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Search Results Dropdown (Attached to Hero Input) */}
                {isDropdownOpen && activeSearchSource === 'hero' && (
                    <div className="absolute top-full left-0 right-0 mt-4 bg-[#1a1a1a]/95 light:bg-white/95 backdrop-blur-md border border-white/10 light:border-gray-200 rounded-2xl shadow-2xl z-[100] overflow-hidden max-h-80 overflow-y-auto animate-in fade-in zoom-in-95 duration-200 pb-4">

                        {/* Case 1: Search Text Exists -> Show Results */}
                        {searchText.trim() ? (
                            searchResults.length > 0 ? (
                                searchResults.map((result, idx) => {
                                    const addressParts = result.address ? result.address.split(' ') : [];
                                    const shortAddress = addressParts.length >= 2 ? `${addressParts[0]} ${addressParts[1]}` : result.address;

                                    return (
                                        <div
                                            key={`search-hero-${idx}`}
                                            onClick={() => handleSelectResult(result)}
                                            className={`px-5 py-4 cursor-pointer flex items-center justify-between gap-4 border-b border-white/5 light:border-gray-100 last:border-0 transition-colors ${idx === highlightedIndex
                                                ? 'bg-white/10 dark:bg-white/20 light:bg-purple-50'
                                                : 'bg-[#1a1a1a] light:bg-white hover:bg-white/10 light:hover:bg-gray-50'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="bg-black/50 light:bg-gray-100 p-2.5 rounded-full shrink-0 border border-white/10 light:border-gray-200">
                                                    {result.type === 'location' ? (
                                                        <MapPin className="w-4 h-4 text-emerald-400 light:text-emerald-600" />
                                                    ) : result.type === 'video' ? (
                                                        <Star className="w-4 h-4 text-yellow-500 light:text-yellow-600" />
                                                    ) : (
                                                        <Search className="w-4 h-4 text-[#a78bfa] light:text-purple-600" />
                                                    )}
                                                </div>
                                                <div className="text-white light:text-black text-base font-extrabold truncate">
                                                    {result.name}
                                                </div>
                                            </div>

                                            <div className="text-gray-400 light:text-gray-600 text-sm whitespace-nowrap shrink-0">
                                                {shortAddress}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="p-8 text-center flex flex-col items-center gap-3">
                                    <div className="text-gray-400 light:text-gray-600 text-sm">
                                        <strong className={searchMode === 'location' ? "text-emerald-500" : "text-purple-500"}>
                                            {searchMode === 'location' ? '위치' : '키워드'}
                                        </strong> 검색 결과가 없습니다 😢
                                    </div>
                                    <button onClick={() => {
                                        onSearchModeChange(searchMode === 'location' ? 'keyword' : 'location');
                                    }} className={`px-4 py-2 rounded-full text-sm font-extrabold text-white transition-all flex items-center gap-2 shadow-lg hover:-translate-y-0.5 ${searchMode === 'location'
                                        ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-500/20'
                                        : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'
                                        }`}>
                                        {searchMode === 'location' ? <Search size={14} /> : <MapPin size={14} />}
                                        {searchMode === 'location' ? '키워드 검색 전환' : '위치 검색 전환'}
                                    </button>
                                </div>
                            )
                        ) : (
                            /* Case 2: No Search Text -> Show Recent/Popular Keywords */
                            <div className="p-4 bg-[#1a0b2e]/95 light:bg-white/95 backdrop-blur-3xl">
                                {/* Recent Keywords */}
                                <div className="mb-6">
                                    <div className="flex items-center justify-between mb-3 px-1">
                                        <h4 className="text-sm font-extrabold text-gray-400 light:text-gray-600 flex items-center gap-2">
                                            <Clock className="w-3.5 h-3.5" /> 최근 검색어
                                        </h4>
                                        {recentKeywords.length > 0 && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onClearRecent();
                                                }}
                                                className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                                            >
                                                전체 삭제
                                            </button>
                                        )}
                                    </div>

                                    {recentKeywords.length === 0 ? (
                                        <div className="text-center py-4 text-gray-600 light:text-gray-500 text-sm bg-white/5 light:bg-gray-50 rounded-xl border border-white/5 light:border-gray-100">
                                            최근 검색 내역이 없습니다.
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {recentKeywords.map((keyword, idx) => (
                                                <div
                                                    key={idx}
                                                    className="group flex items-center gap-2 px-3 py-1.5 bg-white/5 light:bg-gray-100 hover:bg-white/10 light:hover:bg-gray-200 border border-white/10 light:border-gray-200 rounded-full cursor-pointer transition-all"
                                                    onClick={() => onKeywordSelect(keyword)}
                                                >
                                                    <span className="text-sm text-gray-300 light:text-gray-700 group-hover:text-white light:group-hover:text-black transition-colors">{keyword}</span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onRemoveRecent(keyword);
                                                        }}
                                                        className="text-gray-500 light:text-gray-400 hover:text-red-400 light:hover:text-red-500 p-0.5 rounded-full hover:bg-white/10 light:hover:bg-white transition-colors"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Popular Keywords */}
                                <div>
                                    <h4 className="text-sm font-extrabold text-gray-400 light:text-gray-600 flex items-center gap-2 mb-3 px-1">
                                        <TrendingUp className="w-3.5 h-3.5 text-red-400" /> 인기 검색어
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            '뮤지컬', '콘서트', '서울', '전시회',
                                            '아이브', '임영웅', '싸이', '모네',
                                            '예술의전당', '세종문화회관'
                                        ].map((keyword, idx) => (
                                            <div
                                                key={idx}
                                                onClick={() => onKeywordSelect(keyword)}
                                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 light:hover:bg-gray-50 cursor-pointer group transition-colors"
                                            >
                                                <span className={`text-sm font-extrabold w-4 text-center ${idx < 3 ? 'text-[#a78bfa] light:text-purple-600' : 'text-gray-500'}`}>
                                                    {idx + 1}
                                                </span>
                                                <span className="text-sm text-gray-300 light:text-gray-700 group-hover:text-white light:group-hover:text-black transition-colors">
                                                    {keyword}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div >
    );
}
