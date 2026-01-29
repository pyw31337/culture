
import React, { useRef, useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { ChevronDown, ChevronUp, RotateCcw, Search, X, Star, MapPin, Clock, TrendingUp } from 'lucide-react';
import { TypingHero } from './TypingHero';
import { LocationSelector } from '../LocationSelector';
import { HeroTemplate, HERO_TEMPLATES } from '../../lib/hero-templates';
import { REGIONS, RADIUS_OPTIONS } from '../../lib/constants';

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
    lastUpdated: string;
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
    lastUpdated,
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
    onSearchModeChange
}: HeroSectionProps) {
    const heroRef = useRef<HTMLDivElement>(null);

    // Logic for determining the current template to display
    const currentTemplate = (() => {
        const minuteSeed = new Date().getMinutes();

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
            { line1: "찜한 공연장에서", line2Pre: "오늘 어떤 ", highlight: "공연", suffix: "이 열리고 있을까요?" },
            { line1: "자주 찾는", line2Pre: "공연장의 ", highlight: "일정", suffix: "을 확인해보세요." },
            { line1: "좋아하는 공연장,", line2Pre: "그곳의 ", highlight: "무대", suffix: "가 기다리고 있어요." },
            { line1: "마음에 든 공연장의", line2Pre: "오늘의 ", highlight: "라인업", suffix: "은 뭘까요?" },
            { line1: "찜한 공연장에서", line2Pre: "새로운 ", highlight: "공연", suffix: "을 발견해보세요." },
            { line1: "익숙한 그 공연장,", line2Pre: "특별한 ", highlight: "오늘", suffix: "이 될 수도 있어요." },
            { line1: "당신이 사랑하는", line2Pre: "공연장의 ", highlight: "소식", suffix: "을 전해드릴게요." },
            { line1: "공연장 Pick,", line2Pre: "거기서 뭐 ", highlight: "하고 있나", suffix: " 볼까요?" },
            { line1: "찜한 공연장 어때요?", line2Pre: "오늘의 ", highlight: "무대", suffix: "를 확인해보세요." },
            { line1: "자주 가는 그곳,", line2Pre: "새 ", highlight: "공연", suffix: "이 기다리고 있을지도요." }
        ];

        const perfMsg = likesPerfMessages[minuteSeed % likesPerfMessages.length];
        const venueMsg = likesVenueMessages[minuteSeed % likesVenueMessages.length];

        // Category-specific emotional messages with boldPrefix
        const genreMessages: Record<string, any[]> = {
            hotdeal: [
                { line1: "지금 아니면", boldPrefix: "핫딜", line2Pre: "을 놓칠 수 있어요! ", highlight: "특가", suffix: "를 확인해보세요." },
                { line1: "가성비 갑!", boldPrefix: "핫딜", line2Pre: " 컨텐츠들이 ", highlight: "기다리고", suffix: " 있어요." },
                { line1: "이 가격에?", boldPrefix: "핫딜", line2Pre: " 놓치면 ", highlight: "후회", suffix: "해요." },
                { line1: "오늘만!", boldPrefix: "핫딜", line2Pre: " 가격에 만나는 ", highlight: "컨텐츠", suffix: "들이에요." },
                { line1: "알뜰하게", boldPrefix: "핫딜", line2Pre: "로 즐기는 ", highlight: "문화생활", suffix: "!" },
                { line1: "지갑은 가볍게,", boldPrefix: "핫딜", line2Pre: " 감동은 ", highlight: "크게", suffix: "!" },
                { line1: "현명한 선택,", boldPrefix: "핫딜", line2Pre: " 컨텐츠 ", highlight: "모음", suffix: "이에요." },
                { line1: "득템 찬스!", boldPrefix: "핫딜", line2Pre: " ", highlight: "컨텐츠", suffix: "를 잡아보세요." },
                { line1: "싸고 좋은", boldPrefix: "핫딜", line2Pre: " ", highlight: "발견", suffix: "!" },
                { line1: "할인의 기회,", boldPrefix: "핫딜", line2Pre: " ", highlight: "지금", suffix: " 바로 확인하세요." }
            ],
            movie: [
                { line1: "퇴근하고", boldPrefix: "영화", line2Pre: " 한편에 ", highlight: "맥주 한잔", suffix: "만한게 없죠?" },
                { line1: "오늘 밤,", boldPrefix: "영화", line2Pre: "관에서 만나는 ", highlight: "감동", suffix: "은 어떠세요?" },
                { line1: "팝콘 향기 가득한", boldPrefix: "영화", line2Pre: "관, ", highlight: "스크린", suffix: "이 기다리고 있어요." },
                { line1: "어둠 속에서", boldPrefix: "영화", line2Pre: " 한 편과 함께 ", highlight: "힐링", suffix: "해보세요." },
                { line1: "주말엔 역시", boldPrefix: "영화", line2Pre: "! ", highlight: "최신작", suffix: "을 확인해보세요." },
                { line1: "스크린 속으로", boldPrefix: "영화", line2Pre: " 보러 ", highlight: "떠나볼까요", suffix: "?" },
                { line1: "두 시간의 행복,", boldPrefix: "영화", line2Pre: " 한 편 ", highlight: "어때요", suffix: "?" },
                { line1: "눈과 귀가 즐거운", boldPrefix: "영화", line2Pre: " ", highlight: "시간", suffix: "을 선물해드릴게요." },
                { line1: "오늘의 기분엔", boldPrefix: "영화", line2Pre: " 한 편이 ", highlight: "딱", suffix: "이에요." },
                { line1: "좋은 사람과", boldPrefix: "영화", line2Pre: " 보는 ", highlight: "시간", suffix: "은 언제나 특별하죠." }
            ],
            musical: [
                { line1: "무대 위 감동,", boldPrefix: "뮤지컬", line2Pre: " 배우들의 ", highlight: "열창", suffix: "이 기다리고 있어요." },
                { line1: "라이브로 느끼는", boldPrefix: "뮤지컬", line2Pre: "의 ", highlight: "감동", suffix: "을 경험해보세요." },
                { line1: "음악과 연기가", boldPrefix: "뮤지컬", line2Pre: " ", highlight: "무대", suffix: "에서 만나요." },
                { line1: "화려한 무대,", boldPrefix: "뮤지컬", line2Pre: "의 ", highlight: "마법", suffix: "에 빠져보세요." },
                { line1: "노래가 흐르는", boldPrefix: "뮤지컬", line2Pre: " ", highlight: "무대", suffix: "로 초대해요." },
                { line1: "배우의 열정이", boldPrefix: "뮤지컬", line2Pre: " 무대를 ", highlight: "빛나게", suffix: " 해요." },
                { line1: "멜로디와 함께하는", boldPrefix: "뮤지컬", line2Pre: " ", highlight: "스토리", suffix: "를 만나보세요." },
                { line1: "넘버 하나하나가", boldPrefix: "뮤지컬", line2Pre: "의 ", highlight: "명장면", suffix: "이에요." },
                { line1: "오늘 밤 주인공은", boldPrefix: "뮤지컬", line2Pre: " ", highlight: "당신", suffix: "이에요." },
                { line1: "귀와 눈이 함께", boldPrefix: "뮤지컬", line2Pre: "을 ", highlight: "즐겨요", suffix: "." }
            ],
            play: [ // Using 'play' key but content might be labelled 'theater' in some contexts, keeping original keys
                { line1: "배우의 숨결이", boldPrefix: "연극", line2Pre: " 무대에서 ", highlight: "느껴져요", suffix: "." },
                { line1: "작은 무대,", boldPrefix: "연극", line2Pre: "만의 ", highlight: "큰 감동", suffix: "이 있어요." },
                { line1: "살아있는 연기,", boldPrefix: "연극", line2Pre: " ", highlight: "진짜 무대", suffix: "를 만나보세요." },
                { line1: "가까이서 느끼는", boldPrefix: "연극", line2Pre: " 배우의 ", highlight: "열정", suffix: "!" },
                { line1: "눈빛으로 전하는", boldPrefix: "연극", line2Pre: "의 ", highlight: "이야기", suffix: "를 들어보세요." },
                { line1: "무대와 객석이", boldPrefix: "연극", line2Pre: "에서 ", highlight: "하나", suffix: "가 되는 순간." },
                { line1: "생생한 감정이", boldPrefix: "연극", line2Pre: " 무대에서 ", highlight: "전해져요", suffix: "." },
                { line1: "오늘 밤,", boldPrefix: "연극", line2Pre: " 한 편 ", highlight: "어떠세요", suffix: "?" },
                { line1: "진짜 배우를", boldPrefix: "연극", line2Pre: " 무대에서 ", highlight: "만나보세요", suffix: "." },
                { line1: "배우와 눈을", boldPrefix: "연극", line2Pre: "에서 ", highlight: "마주쳐요", suffix: "." }
            ],
            concert: [
                { line1: "라이브의 전율,", boldPrefix: "콘서트", line2Pre: " ", highlight: "현장", suffix: "을 느껴보세요." },
                { line1: "함께 따라부르는", boldPrefix: "콘서트", line2Pre: " ", highlight: "떼창", suffix: "의 감동!" },
                { line1: "귀가 아닌", boldPrefix: "콘서트", line2Pre: "에서 ", highlight: "온몸", suffix: "으로 느끼는 음악." },
                { line1: "좋아하는 아티스트", boldPrefix: "콘서트", line2Pre: "를 ", highlight: "직접", suffix: " 만나보세요." },
                { line1: "응원봉 흔들며", boldPrefix: "콘서트", line2Pre: " ", highlight: "열광", suffix: "하는 밤!" },
                { line1: "현장의 열기를", boldPrefix: "콘서트", line2Pre: "에서 ", highlight: "느껴봐요", suffix: "." },
                { line1: "음악과 하나 되는", boldPrefix: "콘서트", line2Pre: " ", highlight: "순간", suffix: "!" },
                { line1: "셋리스트 기대하며", boldPrefix: "콘서트", line2Pre: "를 ", highlight: "기다려요", suffix: "." },
                { line1: "직접 눈으로 확인하는", boldPrefix: "콘서트", line2Pre: " ", highlight: "무대", suffix: "!" },
                { line1: "앵콜까지 함께하는", boldPrefix: "콘서트", line2Pre: " ", highlight: "밤", suffix: "!" }
            ],
            classic: [
                { line1: "선율이 마음을", boldPrefix: "클래식", line2Pre: " 연주로 ", highlight: "적셔요", suffix: "." },
                { line1: "오케스트라의", boldPrefix: "클래식", line2Pre: " ", highlight: "하모니", suffix: "를 느껴보세요." },
                { line1: "고요 속에서", boldPrefix: "클래식", line2Pre: " ", highlight: "선율", suffix: "이 피어나요." },
                { line1: "우아한 밤,", boldPrefix: "클래식", line2Pre: " 공연과 ", highlight: "함께", suffix: "해요." },
                { line1: "거장의 음악을", boldPrefix: "클래식", line2Pre: " 무대에서 ", highlight: "직접", suffix: " 만나보세요." },
                { line1: "마음이 정화되는", boldPrefix: "클래식", line2Pre: " ", highlight: "선율", suffix: "이에요." },
                { line1: "오늘은 조금", boldPrefix: "클래식", line2Pre: " ", highlight: "우아하게", suffix: " 어때요?" },
                { line1: "깊은 감동을", boldPrefix: "클래식", line2Pre: " 연주로 ", highlight: "전해요", suffix: "." },
                { line1: "정적 속 울리는", boldPrefix: "클래식", line2Pre: " ", highlight: "음표", suffix: "들." },
                { line1: "영혼까지 닿는", boldPrefix: "클래식", line2Pre: " ", highlight: "선율", suffix: "을 경험해보세요." }
            ],
            exhibition: [
                { line1: "작품 앞에서", boldPrefix: "전시", line2Pre: "회장에서 ", highlight: "멈춰서요", suffix: "." },
                { line1: "예술이 주는", boldPrefix: "전시", line2Pre: "의 ", highlight: "영감", suffix: "을 느껴보세요." },
                { line1: "눈으로 담는", boldPrefix: "전시", line2Pre: " ", highlight: "아름다움", suffix: "!" },
                { line1: "여유롭게 거닐며", boldPrefix: "전시", line2Pre: "를 ", highlight: "감상해요", suffix: "." },
                { line1: "작가의 세계 속으로", boldPrefix: "전시", line2Pre: "가 ", highlight: "초대", suffix: "해요." },
                { line1: "사진 찍기 좋은", boldPrefix: "전시", line2Pre: " ", highlight: "스팟", suffix: "도 있어요!" },
                { line1: "오늘은 문화인으로", boldPrefix: "전시", line2Pre: "회에서 ", highlight: "힐링", suffix: "해요." },
                { line1: "예술적 영감이", boldPrefix: "전시", line2Pre: "에서 ", highlight: "샘솟아요", suffix: "." },
                { line1: "작품과 대화하는", boldPrefix: "전시", line2Pre: " ", highlight: "시간", suffix: "!" },
                { line1: "미적 감각을", boldPrefix: "전시", line2Pre: "에서 ", highlight: "채워요", suffix: "." }
            ],
            activity: [
                { line1: "몸을 움직이면", boldPrefix: "액티비티", line2Pre: "로 ", highlight: "스트레스 해소", suffix: "!" },
                { line1: "짜릿한 경험,", boldPrefix: "액티비티", line2Pre: " ", highlight: "도전", suffix: "은 어떠세요?" },
                { line1: "일상을 벗어나", boldPrefix: "액티비티", line2Pre: "로 ", highlight: "특별한 체험", suffix: "!" },
                { line1: "새로운 도전이", boldPrefix: "액티비티", line2Pre: "에서 ", highlight: "기다려요", suffix: "." },
                { line1: "땀 흘리며 즐기는", boldPrefix: "액티비티", line2Pre: " ", highlight: "재미", suffix: "!" },
                { line1: "활력 넘치는 하루,", boldPrefix: "액티비티", line2Pre: "와 ", highlight: "함께", suffix: "!" },
                { line1: "아드레날린 폭발!", boldPrefix: "액티비티", line2Pre: " ", highlight: "체험", suffix: "해볼까요?" },
                { line1: "건강한 취미생활,", boldPrefix: "액티비티", line2Pre: " ", highlight: "추천", suffix: "해드려요." },
                { line1: "생생한 경험을", boldPrefix: "액티비티", line2Pre: "로 ", highlight: "만들어요", suffix: "." },
                { line1: "도전하는 즐거움,", boldPrefix: "액티비티", line2Pre: "에서 ", highlight: "느껴봐요", suffix: "!" }
            ],
            class: [
                { line1: "배움의 즐거움,", boldPrefix: "클래스", line2Pre: "에서 새로운 ", highlight: "나", suffix: "를 발견해요." },
                { line1: "취미 하나 늘리는", boldPrefix: "클래스", line2Pre: "로 ", highlight: "특별한 시간", suffix: "!" },
                { line1: "오늘 뭐 배울까?", boldPrefix: "클래스", line2Pre: " ", highlight: "탐색", suffix: "해봐요." },
                { line1: "실력이 쑥쑥!", boldPrefix: "클래스", line2Pre: "에서 ", highlight: "성장", suffix: "해요." },
                { line1: "새로운 기술을", boldPrefix: "클래스", line2Pre: "에서 ", highlight: "배워요", suffix: "." },
                { line1: "즐기면서 배우는", boldPrefix: "클래스", line2Pre: " ", highlight: "재미", suffix: "!" },
                { line1: "나만의 특기가", boldPrefix: "클래스", line2Pre: "에서 ", highlight: "생겨요", suffix: "." },
                { line1: "창작의 기쁨,", boldPrefix: "클래스", line2Pre: "가 ", highlight: "선물", suffix: "해요." },
                { line1: "알차게 보내는 시간,", boldPrefix: "클래스", line2Pre: "와 ", highlight: "함께", suffix: "!" },
                { line1: "실력 UP!", boldPrefix: "클래스", line2Pre: "에서 ", highlight: "레벨업", suffix: "해요." }
            ],
            travel: [
                { line1: "떠나요!", boldPrefix: "여행", line2Pre: "을 통해 ", highlight: "일상 탈출", suffix: "!" },
                { line1: "새로운 풍경이", boldPrefix: "여행", line2Pre: "에서 ", highlight: "기다려요", suffix: "." },
                { line1: "짐 싸고 떠나볼까요?", boldPrefix: "여행", line2Pre: " ", highlight: "설렘", suffix: "이 가득해요." },
                { line1: "인생샷 남기는", boldPrefix: "여행", line2Pre: " ", highlight: "명소", suffix: "로 가요!" },
                { line1: "맛집 탐방하는", boldPrefix: "여행", line2Pre: " ", highlight: "즐거움", suffix: "!" },
                { line1: "힐링이 필요할 땐", boldPrefix: "여행", line2Pre: "이 ", highlight: "정답", suffix: "이에요." },
                { line1: "추억 가득할", boldPrefix: "여행", line2Pre: "을 ", highlight: "떠나요", suffix: "!" },
                { line1: "오늘 바로 예약!", boldPrefix: "여행", line2Pre: " ", highlight: "특가", suffix: "를 잡아요." },
                { line1: "완벽한 휴식,", boldPrefix: "여행", line2Pre: "이 ", highlight: "선물", suffix: "해줄게요." },
                { line1: "어디로 떠날까?", boldPrefix: "여행", line2Pre: " ", highlight: "목적지", suffix: "를 정해봐요." }
            ],
            festival: [
                { line1: "축제의 열기 속으로!", boldPrefix: "축제", line2Pre: " ", highlight: "신나게", suffix: " 즐겨요." },
                { line1: "함께여서 더 즐거운", boldPrefix: "축제", line2Pre: " ", highlight: "현장", suffix: "으로!" },
                { line1: "불꽃놀이처럼 화려한", boldPrefix: "축제", line2Pre: "가 ", highlight: "기다려요", suffix: "!" },
                { line1: "신나는 음악과", boldPrefix: "축제", line2Pre: " ", highlight: "열정", suffix: "!" },
                { line1: "푸드 트럭 가득한", boldPrefix: "축제", line2Pre: " ", highlight: "맛집", suffix: " 탐방!" },
                { line1: "밤새도록 즐기는", boldPrefix: "축제", line2Pre: "의 ", highlight: "에너지", suffix: "!" },
                { line1: "친구들과 함께하는", boldPrefix: "축제", line2Pre: " ", highlight: "추억", suffix: " 만들기!" },
                { line1: "흥이 넘치는", boldPrefix: "축제", line2Pre: " ", highlight: "분위기", suffix: "에 취해봐요." },
                { line1: "다양한 볼거리,", boldPrefix: "축제", line2Pre: " ", highlight: "한가득", suffix: "!" },
                { line1: "올해의 핫한", boldPrefix: "축제", line2Pre: "를 ", highlight: "확인", suffix: "해보세요!" }
            ],
            leisure: [
                { line1: "자연 속에서", boldPrefix: "레저", line2Pre: "를 즐기며 ", highlight: "힐링", suffix: "해요." },
                { line1: "스트레스는 가고,", boldPrefix: "레저", line2Pre: " 활동 후 ", highlight: "상쾌함", suffix: " 가득!" },
                { line1: "바람을 가르며", boldPrefix: "레저", line2Pre: "의 ", highlight: "즐거움", suffix: "을 느껴요." },
                { line1: "야외에서 즐기는", boldPrefix: "레저", line2Pre: " ", highlight: "액티비티", suffix: "!" },
                { line1: "물 위에서 즐기는", boldPrefix: "레저", line2Pre: " ", highlight: "짜릿함", suffix: "!" },
                { line1: "자연과 하나 되는", boldPrefix: "레저", line2Pre: " ", highlight: "경험", suffix: "!" },
                { line1: "건강한 취미생활,", boldPrefix: "레저", line2Pre: " ", highlight: "스포츠", suffix: "!" },
                { line1: "주말엔 밖으로!", boldPrefix: "레저", line2Pre: " 활동 ", highlight: "추천", suffix: "해요." },
                { line1: "가족과 함께하는", boldPrefix: "레저", line2Pre: " ", highlight: "시간", suffix: "!" },
                { line1: "도심을 벗어나", boldPrefix: "레저", line2Pre: "로 ", highlight: "재충전", suffix: "!" }
            ],
            volleyball: [
                { line1: "스파이크!", boldPrefix: "배구", line2Pre: " 경기에서 ", highlight: "짜릿함", suffix: "을 느껴요." },
                { line1: "응원 열기 가득한", boldPrefix: "배구", line2Pre: " ", highlight: "경기장", suffix: "으로!" },
                { line1: "세트 점수,", boldPrefix: "배구", line2Pre: "의 ", highlight: "긴장감", suffix: " 넘치는 경기!" },
                { line1: "찐 팬이라면", boldPrefix: "배구", line2Pre: " 직관 ", highlight: "필수", suffix: "죠!" },
                { line1: "선수들의 열정,", boldPrefix: "배구", line2Pre: " 코트에서 ", highlight: "느껴봐요", suffix: "." },
                { line1: "리시브! 토스! 스파이크!", boldPrefix: "배구", line2Pre: "의 ", highlight: "묘미", suffix: "!" },
                { line1: "응원 준비 됐나요?", boldPrefix: "배구", line2Pre: " 경기 ", highlight: "직관", suffix: " 가요!" },
                { line1: "짜릿한 역전승,", boldPrefix: "배구", line2Pre: " ", highlight: "경기", suffix: "에서 만나요." },
                { line1: "함성과 박수로", boldPrefix: "배구", line2Pre: " ", highlight: "응원", suffix: "해요!" },
                { line1: "코트 위 열정,", boldPrefix: "배구", line2Pre: " 선수들의 ", highlight: "땀", suffix: "이 빛나요." }
            ],
            basketball: [
                { line1: "덩크슛!", boldPrefix: "농구", line2Pre: " 경기의 ", highlight: "역동성", suffix: "을 느껴요." },
                { line1: "코트 위 열정,", boldPrefix: "농구", line2Pre: " ", highlight: "경기", suffix: "를 관람해요." },
                { line1: "버저비터의 짜릿함!", boldPrefix: "농구", line2Pre: " ", highlight: "경기장", suffix: "으로 가요!" },
                { line1: "화려한 드리블,", boldPrefix: "농구", line2Pre: " 경기에서 ", highlight: "만나요", suffix: "." },
                { line1: "점수 터지는 순간!", boldPrefix: "농구", line2Pre: " ", highlight: "흥분", suffix: " 가득!" },
                { line1: "3점 슛! 스틸!", boldPrefix: "농구", line2Pre: "의 ", highlight: "재미", suffix: "!" },
                { line1: "응원석에서 함께하는", boldPrefix: "농구", line2Pre: " ", highlight: "열정", suffix: "!" },
                { line1: "국내 프로", boldPrefix: "농구", line2Pre: " ", highlight: "스케줄", suffix: " 확인해요." },
                { line1: "친구와 함께 보는", boldPrefix: "농구", line2Pre: " ", highlight: "경기", suffix: " 꿀잼!" },
                { line1: "선수들의 플레이,", boldPrefix: "농구", line2Pre: " 코트에서 ", highlight: "빛나요", suffix: "!" }
            ],
            baseball: [
                { line1: "치맥과 함께하는", boldPrefix: "야구", line2Pre: "장 ", highlight: "직관", suffix: "은 최고죠!" },
                { line1: "홈런 타구를", boldPrefix: "야구", line2Pre: "장에서 ", highlight: "직접", suffix: " 확인해요." },
                { line1: "9회말 투아웃,", boldPrefix: "야구", line2Pre: "의 ", highlight: "묘미", suffix: "를 느껴요." },
                { line1: "응원가 함께 부르며", boldPrefix: "야구", line2Pre: " ", highlight: "열정", suffix: " 폭발!" },
                { line1: "우리 팀 승리 기원!", boldPrefix: "야구", line2Pre: " ", highlight: "직관", suffix: " 가요!" },
                { line1: "시원한 맥주 한잔,", boldPrefix: "야구", line2Pre: "장에서 ", highlight: "힐링", suffix: "!" },
                { line1: "삼진 아웃! 스커볼!", boldPrefix: "야구", line2Pre: "의 ", highlight: "재미", suffix: "!" },
                { line1: "유니폼 입고", boldPrefix: "야구", line2Pre: "장 ", highlight: "출석", suffix: "해요!" },
                { line1: "함성으로 가득한", boldPrefix: "야구", line2Pre: "장 ", highlight: "분위기", suffix: "!" },
                { line1: "내 최애 선수,", boldPrefix: "야구", line2Pre: " 경기에서 ", highlight: "응원", suffix: "해요!" }
            ],
            soccer: [  // Using 'soccer' key but original might have mapped 'football' to it
                { line1: "골~~~!", boldPrefix: "축구", line2Pre: " 경기의 ", highlight: "열정", suffix: "을 느껴요." },
                { line1: "경기장 함성 속으로", boldPrefix: "축구", line2Pre: " ", highlight: "경기", suffix: "를 보러 가요!" },
                { line1: "대한민국!", boldPrefix: "축구", line2Pre: " 응원과 함께 ", highlight: "짜릿하게", suffix: "!" },
                { line1: "패스! 슛! 골!", boldPrefix: "축구", line2Pre: "의 ", highlight: "박진감", suffix: "!" },
                { line1: "붉은 악마와 함께!", boldPrefix: "축구", line2Pre: " ", highlight: "응원전", suffix: "으로!" },
                { line1: "필드 위 11인의", boldPrefix: "축구", line2Pre: " 선수들 ", highlight: "응원", suffix: "해요!" },
                { line1: "손에 땀 쥐는", boldPrefix: "축구", line2Pre: " ", highlight: "경기", suffix: "를 직관해요." },
                { line1: "현장에서 느끼는", boldPrefix: "축구", line2Pre: "의 ", highlight: "열기", suffix: "!" },
                { line1: "우리 팀 승리를 위해!", boldPrefix: "축구", line2Pre: " ", highlight: "함성", suffix: "을 질러요!" },
                { line1: "다 같이 외쳐요,", boldPrefix: "축구", line2Pre: " ", highlight: "대한민국", suffix: "!" }
            ],
            kids: [
                { line1: "아이와 함께하는", boldPrefix: "키즈", line2Pre: " 공연은 ", highlight: "특별", suffix: "해요." },
                { line1: "아이 눈이 반짝!", boldPrefix: "키즈", line2Pre: " ", highlight: "공연", suffix: "을 찾아봐요." },
                { line1: "온 가족이 즐기는", boldPrefix: "키즈", line2Pre: " ", highlight: "가족 공연", suffix: "!" },
                { line1: "아이에게 선물하는", boldPrefix: "키즈", line2Pre: " 공연 ", highlight: "추억", suffix: "!" },
                { line1: "캐릭터 만나는", boldPrefix: "키즈", line2Pre: " ", highlight: "공연", suffix: " 어때요?" },
                { line1: "신나게 뛰어노는", boldPrefix: "키즈", line2Pre: " ", highlight: "체험", suffix: "!" },
                { line1: "교육적이면서 재미있는", boldPrefix: "키즈", line2Pre: " ", highlight: "콘텐츠", suffix: "!" },
                { line1: "아이의 웃음소리가", boldPrefix: "키즈", line2Pre: " ", highlight: "공연", suffix: "에서 가득해요." },
                { line1: "주말엔 아이와 함께", boldPrefix: "키즈", line2Pre: " ", highlight: "나들이", suffix: "!" },
                { line1: "상상력 자극하는", boldPrefix: "키즈", line2Pre: " ", highlight: "공연", suffix: "!" }
            ]
        };

        const genreMsg = selectedGenre !== 'all' && genreMessages[selectedGenre]
            ? genreMessages[selectedGenre][minuteSeed % genreMessages[selectedGenre].length]
            : null;

        if (viewMode === 'likes-perf') {
            return { ...perfMsg, keywords: [], boldPrefix: undefined } as HeroTemplate;
        } else if (viewMode === 'likes-venue') {
            return { ...venueMsg, keywords: [], boldPrefix: undefined } as HeroTemplate;
        } else if (genreMsg) {
            return { ...genreMsg, keywords: [] } as HeroTemplate;
        } else if (searchText) {
            return {
                line1: "찾으시는 공연,",
                line2Pre: "입력하신 ",
                highlight: `"${searchText.replace(/^.*? \d+(?:-\d+)?\s*/, '').replace(/\(.*\)/, '').trim()}"`,
                suffix: " 키워드로 정리해드릴게요.",
                keywords: [],
                boldPrefix: undefined
            } as HeroTemplate;
        } else if (selectedRegion !== 'all' || selectedVenue !== 'all') {
            return {
                line1: "현재,",
                boldPrefix: `${[
                    selectedRegion !== 'all' ? REGIONS.find(r => r.id === selectedRegion)?.label : '',
                    selectedDistrict !== 'all' ? selectedDistrict : '',
                    selectedVenue !== 'all' ? selectedVenue : ''
                ].filter(Boolean).join(' ')}`,
                line2Pre: "에서 진행중인 ",
                highlight: "문화 정보",
                suffix: "들을 찾아줄게요.",
                keywords: []
            } as HeroTemplate;
        } else {
            return heroText;
        }
    })();


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
            "relative max-w-7xl 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-10 flex flex-col lg:flex-row justify-between lg:items-end gap-8",
            (isDropdownOpen && activeSearchSource === 'hero') ? "z-[100]" : "z-[30]"
        )}>
            <div className="text-left flex-1 min-w-0 z-10">
                {selectedGenre !== 'movie' && selectedGenre !== 'ott' && (
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
                                {(selectedRegion !== 'all' || selectedVenue !== 'all')
                                    ? '설정위치 :'
                                    : (activeLocation ? (searchLocation ? '검색위치 :' : '현재위치 :') : '현재위치 :')
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
                    </div>
                )}

                <div ref={heroRef}>
                    <TypingHero
                        template={currentTemplate}
                        onCycle={onCycle}
                        paused={!isHeroVisible || !['list', 'grid', 'likes-perf', 'likes-venue'].includes(viewMode)}
                        searchMode={searchMode}
                    />
                </div>

                {/* Mobile: Dynamic (Simplified Layout) */}
                <h2 className="text-4xl font-light text-white light:text-black leading-[1.2] tracking-tighter block sm:hidden">
                    {currentTemplate.line1}<br />
                    {currentTemplate.boldPrefix && (
                        <>
                            <span className="font-black text-white light:text-black">{currentTemplate.boldPrefix}</span>
                        </>
                    )}
                    {currentTemplate.line2Pre}
                    <span className={clsx(
                        "font-black text-transparent bg-clip-text animate-shine bg-[length:200%_auto] tracking-normal py-1",
                        searchMode === 'location'
                            ? "bg-gradient-to-r from-emerald-300 via-teal-400 to-green-300"
                            : "bg-gradient-to-r from-[#a78bfa] via-[#f472b6] to-[#a78bfa]"
                    )}>
                        {currentTemplate.highlight}
                    </span><br />
                    {currentTemplate.suffix}
                </h2>

                <div className="text-xs text-gray-500 font-mono mt-2 tracking-tighter">
                    {lastUpdated} 기준
                </div>
            </div>

            {/* Hero Search Bar */}
            <div className={clsx(
                "w-full lg:w-auto relative group",
                (isDropdownOpen && activeSearchSource === 'hero') ? "z-[101]" : "z-[30]"
            )}>
                {/* Rotating Neon Border (The requested "Rotating Glow") */}
                <div className={clsx(
                    "absolute -inset-[3px] rounded-full opacity-0 group-focus-within:opacity-100 animate-[spin_3s_linear_infinite] blur-md transition-opacity duration-300",
                    searchMode === 'location'
                        ? "bg-[conic-gradient(from_90deg_at_50%_50%,#transparent_0%,#10b981_50%,#transparent_100%)]"
                        : "bg-[conic-gradient(from_90deg_at_50%_50%,#transparent_0%,#a855f7_50%,#transparent_100%)]"
                )} />
                <div className={clsx(
                    "absolute -inset-[3px] rounded-full opacity-0 group-focus-within:opacity-100 animate-[spin_3s_linear_infinite_reverse] blur-md transition-opacity duration-300",
                    searchMode === 'location'
                        ? "bg-[conic-gradient(from_270deg_at_50%_50%,#transparent_0%,#14b8a6_50%,#transparent_100%)]"
                        : "bg-[conic-gradient(from_270deg_at_50%_50%,#transparent_0%,#f472b6_50%,#transparent_100%)]"
                )} />

                {/* Light Mode Static Glow */}
                <div className={clsx(
                    "hidden light:block absolute -inset-4 blur-2xl rounded-full opacity-70 pointer-events-none transition-colors duration-500",
                    searchMode === 'location'
                        ? "bg-gradient-to-r from-emerald-400/20 via-teal-400/15 to-green-400/20"
                        : "bg-gradient-to-r from-purple-400/20 via-pink-400/15 to-purple-400/20"
                )} />

                {/* Main Container */}
                <div className={clsx(
                    "p-[3px] rounded-full transition-all duration-300 relative",
                    searchMode === 'location'
                        ? "bg-linear-to-r from-emerald-400 via-teal-600 to-green-400 light:shadow-[0_4px_30px_rgba(16,185,129,0.35)]"
                        : "bg-linear-to-r from-[#a78bfa] via-purple-500 to-[#f472b6] light:shadow-[0_4px_30px_rgba(168,85,247,0.25)]"
                )}>
                    <div className="bg-[#0a0a0a] light:bg-white rounded-full flex items-center p-1 relative mix-blend-hard-light light:mix-blend-normal">

                        {/* Input Field (Moved to Left) */}
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={searchText}
                                onFocus={() => setActiveSearchSource('hero')}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setSearchText(val);
                                    // Reset location filters when user starts typing search
                                    if (val && (selectedRegion !== 'all' || selectedDistrict !== 'all' || selectedVenue !== 'all')) {
                                        setSelectedRegion('all');
                                        setSelectedDistrict('all');
                                        setSelectedVenue('all');
                                    }
                                }}
                                onKeyDown={handleKeyDown}
                                className="bg-transparent border-none text-white light:text-black text-lg font-extrabold px-5 py-3 w-full lg:w-[380px] focus:outline-none placeholder-gray-600 caret-white light:caret-black"
                                placeholder={searchMode === 'location'
                                    ? "지역, 지하철역, 장소 검색 (예: 강남역)"
                                    : "문화 정보, 장소, 공연명 검색..."
                                }
                            />
                            {/* Reset Button (Next to Input) */}
                            {searchText && (
                                <button
                                    onClick={() => {
                                        setSearchText('');
                                        setIsDropdownOpen(false);
                                        setSearchLocation(null);
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-500 hover:text-white light:hover:text-black transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>

                        {/* Divider */}
                        <div className="w-[1px] h-6 bg-white/10 light:bg-black/10 mx-1"></div>

                        {/* Mode Toggle Switch (Moved to Right of Input) */}
                        <div className="flex px-1 shrink-0">
                            {/* Single Toggle Button that flips mode */}
                            <button
                                onClick={() => onSearchModeChange(searchMode === 'keyword' ? 'location' : 'keyword')}
                                className={clsx(
                                    "px-4 py-2.5 rounded-full text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap border border-transparent hover:scale-105 active:scale-95",
                                    searchMode === 'location'
                                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30 light:bg-emerald-100 light:text-emerald-700 light:border-emerald-200"
                                        : "bg-purple-500/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/30 light:bg-purple-100 light:text-purple-700 light:border-purple-200"
                                )}
                                style={{ height: '80%' }} // Hint at 80% size relative to search button area roughly
                            >
                                {searchMode === 'location' ? (
                                    <>
                                        <MapPin size={14} className="fill-current" />
                                        <span>위치 검색</span>
                                    </>
                                ) : (
                                    <>
                                        <Search size={14} />
                                        <span>키워드 검색</span>
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Search Button (Far Right) */}
                        <button
                            onClick={handleSearch}
                            className={clsx(
                                "p-3.5 rounded-full text-white shadow-md hover:scale-105 active:scale-95 transition-all outline-none ml-1",
                                searchMode === 'location'
                                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 shadow-emerald-500/30"
                                    : "bg-gradient-to-r from-[#a78bfa] to-[#f472b6]"
                            )}
                        >
                            {searchMode === 'location'
                                ? <MapPin className="w-6 h-6 font-extrabold" />
                                : <Search className="w-6 h-6 font-extrabold" />
                            }
                        </button>
                    </div>
                </div>

                {/* Search Results Dropdown (Attached to Hero Input) */}
                {isDropdownOpen && activeSearchSource === 'hero' && (
                    <div className="absolute top-full left-0 right-0 mt-4 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl z-[100] overflow-hidden max-h-80 overflow-y-auto">

                        {/* Case 1: Search Text Exists -> Show Results */}
                        {searchText ? (
                            searchResults.length > 0 ? (
                                searchResults.map((result, idx) => {
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
                                                <div className="text-white text-base font-extrabold truncate">
                                                    {result.name}
                                                </div>
                                            </div>

                                            <div className="text-gray-400 text-sm whitespace-nowrap shrink-0">
                                                {shortAddress}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="p-8 text-center text-gray-400">
                                    검색 결과가 없습니다.
                                </div>
                            )
                        ) : (
                            /* Case 2: No Search Text -> Show Recent/Popular Keywords */
                            <div className="p-4 bg-[#1a0b2e]/95 backdrop-blur-3xl">
                                {/* Recent Keywords */}
                                <div className="mb-6">
                                    <div className="flex items-center justify-between mb-3 px-1">
                                        <h4 className="text-sm font-extrabold text-gray-400 flex items-center gap-2">
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
                                        <div className="text-center py-4 text-gray-600 text-sm bg-white/5 rounded-xl border border-white/5">
                                            최근 검색 내역이 없습니다.
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap gap-2">
                                            {recentKeywords.map((keyword, idx) => (
                                                <div
                                                    key={idx}
                                                    className="group flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full cursor-pointer transition-all"
                                                    onClick={() => onKeywordSelect(keyword)}
                                                >
                                                    <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{keyword}</span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onRemoveRecent(keyword);
                                                        }}
                                                        className="text-gray-500 hover:text-red-400 p-0.5 rounded-full hover:bg-white/10 transition-colors"
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
                                    <h4 className="text-sm font-extrabold text-gray-400 flex items-center gap-2 mb-3 px-1">
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
                                                className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer group transition-colors"
                                            >
                                                <span className={`text-sm font-extrabold w-4 text-center ${idx < 3 ? 'text-[#a78bfa]' : 'text-gray-500'}`}>
                                                    {idx + 1}
                                                </span>
                                                <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
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
        </div>
    );
}
