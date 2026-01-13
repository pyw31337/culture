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
import { motion, AnimatePresence } from 'framer-motion';
import LZString from 'lz-string';
import BottomNav, { BottomMenuType } from './BottomNav';
import BottomNavSheet from './BottomNavSheet';
import { getGenreIcon } from '@/components/GenreIcons';

const KakaoMapModal = dynamic(() => import('./KakaoMapModal'), { ssr: false });
const CalendarModal = dynamic(() => import('./CalendarModal'), { ssr: false });
const PerformanceDetailModal = dynamic(() => import('./PerformanceDetailModal'), { ssr: false });
const FavoriteVenuesModal = dynamic(() => import('./FavoriteVenuesModal'), { ssr: false });
import { useSearchParams, useRouter } from 'next/navigation';

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

// Debug helper
const logPlatform = (p: Performance) => {
    if (p.genre === 'ott') console.log('[PerformanceList] OTT Item:', p.title, p.platforms);
};

// Skeleton Loading Component for Grid View
const SkeletonCard = () => (
    <div className="relative rounded-xl overflow-hidden bg-gray-800/50 animate-pulse">
        {/* Image Placeholder */}
        <div className="aspect-[3/4] bg-gray-700/50" />
        {/* Content Placeholder */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
            <div className="h-3 bg-gray-600/30 rounded w-2/3" />
        </div>
    </div>
);


// Skeleton Loading Component for List View
const SkeletonListItem = () => (
    <div className="flex gap-4 p-4 rounded-xl bg-gray-800/50 animate-pulse">
        {/* Image Placeholder */}
        <div className="w-24 h-32 rounded-lg bg-gray-700/50 flex-shrink-0" />
        {/* Content Placeholder */}
        <div className="flex-1 flex flex-col justify-center gap-2">
            <div className="h-5 bg-gray-600/50 rounded w-3/4" />
            <div className="h-4 bg-gray-600/30 rounded w-1/2" />
            <div className="h-4 bg-gray-600/30 rounded w-2/3" />
            <div className="h-4 bg-gray-600/30 rounded w-1/3" />
        </div>
    </div>
);

// Skeleton Grid for multiple cards
const SkeletonGrid = ({ count = 8, isListMode = false }: { count?: number; isListMode?: boolean }) => (
    <div className={clsx(
        "grid gap-4 sm:gap-6",
        isListMode
            ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
            : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5"
    )}>
        {Array.from({ length: count }).map((_, i) => (
            isListMode ? <SkeletonListItem key={i} /> : <SkeletonCard key={i} />
        ))}
    </div>
);

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

// Helper to extract first price from a price string like "VIP석 154,000원 R석 132,000원..."
// Returns { label: 'VIP석', price: '154,000' } or { label: null, price: '30,000' }
function extractFirstPrice(priceStr: string): { label: string | null; price: string } | null {
    if (!priceStr) return null;

    // Check for free
    if (priceStr.includes('무료') || priceStr === '0') {
        return { label: null, price: '무료' };
    }

    // Try to match pattern: "XX석 NUMBER원" or "전석 NUMBER원"
    const match = priceStr.match(/([가-힣A-Z]+석?)\s*([\d,]+)원?/);
    if (match) {
        return { label: match[1], price: match[2] };
    }

    // Fallback: just extract first number
    const numMatch = priceStr.match(/([\d,]+)/);
    if (numMatch) {
        return { label: null, price: numMatch[1] };
    }

    return null;
}

// --- Text Templates for Hero Section ---
// Structure:
// Line 1: line1
// Line 2: line2Pre + <Highlight> + suffix

const HERO_TEMPLATES = {
    general: [
        { line1: "특별한 오늘,", line2Pre: "당신을 위한 ", highlight: "Spotlight", suffix: "는 어디일까요?", keywords: [] },
        { line1: "반복되는 일상 속,", line2Pre: "당신을 위한 ", highlight: "새로운 영감", suffix: "은 어디일까요?", keywords: ["전시", "exhibition"] },
        { line1: "감성이 메마른 날,", line2Pre: "당신을 위한 ", highlight: "설레는 경험", suffix: "은 어디일까요?", keywords: [] },
        { line1: "소중한 사람과 함께,", line2Pre: "당신을 위한 ", highlight: "잊지 못할 추억", suffix: "은 어디일까요?", keywords: ["가족", "연인", "친구"] },
        { line1: "혼자만의 시간이 필요할 때,", line2Pre: "당신을 위한 ", highlight: "특별한 순간", suffix: "은 어디일까요?", keywords: ["혼자", "1인"] },
        { line1: "문득 떠나고 싶은 지금,", line2Pre: "당신을 위한 ", highlight: "뜻밖의 발견", suffix: "이 기다립니다.", keywords: ["여행"] },
        { line1: "지루한 하루의 끝,", line2Pre: "나에게 주는 ", highlight: "작은 선물", suffix: "같은 컨텐츠 어때요?", keywords: ["힐링"] },
        { line1: "가슴 뛰는 설렘,", line2Pre: "놓치면 후회할 ", highlight: "화제의 컨텐츠", suffix: "를 확인하세요.", keywords: ["인기", "추천"] },
        { line1: "오늘 하루는,", line2Pre: "복잡한 생각 비우고 ", highlight: "몰입의 시간", suffix: "을 가져보세요.", keywords: ["몰입"] },
        { line1: "예술이 필요한 순간,", line2Pre: "당신의 마음을 채워줄 ", highlight: "아름다운 이야기", suffix: "가 있습니다.", keywords: ["예술", "스토리"] },
        { line1: "무대 위 벅찬 감동,", line2Pre: "생생하게 살아숨쉬는 ", highlight: "열정의 현장", suffix: "으로 초대합니다.", keywords: ["감동", "열정"] },
        { line1: "평범한 주말을,", line2Pre: "두고두고 기억될 ", highlight: "영화 같은 하루", suffix: "로 만들어보세요.", keywords: ["주말", "영화"] },
        { line1: "혹시, 마음이 답답하신가요?", line2Pre: "꽉 막힌 속을 뻥 뚫어줄 ", highlight: "시원한 무대", suffix: "를 준비했어요.", keywords: ["스트레스", "해소"] },
        { line1: "커피 한 잔보다,", line2Pre: "더 진한 여운을 남길 ", highlight: "예술 한 잔", suffix: " 어떠세요?", keywords: ["커피", "여운"] },
        { line1: "집에만 있기엔 아까워요,", line2Pre: "지금 바로 떠날 수 있는 ", highlight: "컨텐츠 바캉스", suffix: "가 여기 있습니다.", keywords: ["바캉스", "외출"] },
        { line1: "당신의 영혼을 채워줄,", line2Pre: "단 한 조각의 ", highlight: "마지막 퍼즐", suffix: " 같은 컨텐츠.", keywords: ["영혼", "예술"] },
        { line1: "매일 똑같은 하루,", line2Pre: "당신의 일상에 ", highlight: "특별한 BGM", suffix: "을 깔아드릴게요.", keywords: ["음악", "일상"] },
        { line1: "무료한 시간, 뭐 할까 고민된다면,", line2Pre: "저와 함께 ", highlight: "문화 탐험", suffix: " 떠나보실래요?", keywords: ["탐험", "고민"] },
        { line1: "설마 아직도 안 보셨나요?", line2Pre: "남들 다 본다는 ", highlight: "화제의 그 컨텐츠", suffix: "!", keywords: ["유행", "화제"] },
        { line1: "오늘 기분은 어떤가요?", line2Pre: "당신의 기분에 딱 맞는 ", highlight: "맞춤형 무대", suffix: "를 찾아드릴게요.", keywords: ["기분", "맞춤"] },
        { line1: "눈과 귀가 호강하는 날,", line2Pre: "오감을 깨우는 ", highlight: "짜릿한 경험", suffix: "을 선물합니다.", keywords: ["오감", "경험"] },
        { line1: "잠시 스마트폰은 내려놓고,", line2Pre: "눈앞에서 펼쳐지는 ", highlight: "생생한 감동", suffix: "을 느껴보세요.", keywords: ["디지털디톡스", "감동"] }
    ],
    keyword: [
        { line1: "드디어 오늘,", line2Pre: "기다리던 ", highlight: "{keyword}", suffix: " 컨텐츠가 오픈했어요!", keywords: ["{keyword}"] },
        { line1: "요즘 가장 핫한", line2Pre: "", highlight: "{keyword}", suffix: " 소식, 놓치지 않으셨나요?", keywords: ["{keyword}"] },
        { line1: "당신의 취향 저격,", line2Pre: "준비된 ", highlight: "{keyword}", suffix: " 컬렉션을 만나보세요.", keywords: ["{keyword}"] },
        { line1: "지금 딱 예매하기 좋은", line2Pre: "", highlight: "{keyword}", suffix: " 컨텐츠를 만나보세요.", keywords: ["{keyword}"] },
        { line1: "망설이면 늦어요!", line2Pre: "", highlight: "{keyword}", suffix: " 인기 컨텐츠 총집합.", keywords: ["{keyword}"] },
        { line1: "찾으시는 그 컨텐츠,", line2Pre: "", highlight: "{keyword}", suffix: " 관련 정보를 모두 모았습니다.", keywords: ["{keyword}"] },
        { line1: "팬심 저격!", line2Pre: "덕질의 완성은 역시 ", highlight: "{keyword}", suffix: " 직관이죠!", keywords: ["{keyword}"] },
        { line1: "혹시 좋아하세요?", line2Pre: "", highlight: "{keyword}", suffix: " 매니아를 위한 특별 추천.", keywords: ["{keyword}"] },
        { line1: "알림 신청 하셨나요?", line2Pre: "따끈따끈한 ", highlight: "{keyword}", suffix: " 티켓 오픈 소식!", keywords: ["{keyword}"] }
    ],
    weather: {
        rain: [
            { line1: "비 예보가 있는 오늘,", line2Pre: "감성 가득한 ", highlight: "촉촉한 전시/공연", suffix: " 어떠신가요?", keywords: ["비", "장마", "실내", "전시"] },
            { line1: "우산 챙기셨나요?", line2Pre: "비 오는 날 더 운치 있는 ", highlight: "실내 데이트", suffix: "를 즐겨보세요.", keywords: ["비", "실내", "데이트"] },
            { line1: "흐린 날씨엔 역시,", line2Pre: "기분 전환을 위한 ", highlight: "신나는 공연", suffix: "이 최고죠.", keywords: ["기분전환", "신나는"] },
            { line1: "빗소리와 함께,", line2Pre: "더 깊어지는 ", highlight: "감성 충전", suffix: "의 시간을 가져보세요.", keywords: ["감성", "비"] },
            { line1: "축 쳐지는 궂은 날씨,", line2Pre: "당신의 텐션을 올려줄 ", highlight: "에너지 넘치는 무대", suffix: "가 필요해요.", keywords: ["에너지", "콘서트"] },
            { line1: "비도 오고 그래서,", line2Pre: "당신의 마음을 적실 ", highlight: "음악이 있는 곳", suffix: "을 찾아봤어요.", keywords: ["비", "음악"] },
            { line1: "눅눅한 공기는 잊고,", line2Pre: "쾌적하고 시원한 ", highlight: "공연장 나들이", suffix: "는 어떨까요?", keywords: ["실내", "쾌적"] }
        ],
        snow: [
            { line1: "하얀 눈이 내리는 날,", line2Pre: "포근한 ", highlight: "공연장", suffix: "에서 몸을 녹이세요.", keywords: ["눈", "겨울", "따뜻한"] },
            { line1: "온 세상이 하얀 오늘,", line2Pre: "따뜻한 ", highlight: "감동", suffix: "을 만나보세요.", keywords: ["눈", "감동"] },
            { line1: "손발 시린 겨울,", line2Pre: "마음만은 훈훈하게 ", highlight: "로맨틱한 공연", suffix: " 어떠세요?", keywords: ["겨울", "로맨틱"] },
            { line1: "눈 오는 날의 낭만,", line2Pre: "영화 주인공처럼 ", highlight: "아름다운 추억", suffix: "을 남겨보세요.", keywords: ["눈", "낭만"] },
            { line1: "첫눈 같은 설렘,", line2Pre: "당신을 기다리는 ", highlight: "순백의 무대", suffix: "가 있습니다.", keywords: ["눈", "설렘"] },
            { line1: "눈길 조심하세요!", line2Pre: "하지만 이 공연은 ", highlight: "놓치면 후회", suffix: "할지도 몰라요.", keywords: ["눈", "추천"] }
        ],
        clear: [
            { line1: "날씨 좋은 오늘,", line2Pre: "산책하듯 ", highlight: "즐기기 좋은 공연", suffix: "들을 모았어요.", keywords: ["야외", "산책"] },
            { line1: "화창한 하늘 아래,", line2Pre: "설레는 마음으로 ", highlight: "공연장 나들이", suffix: " 어때요?", keywords: ["나들이"] },
            { line1: "오늘 같은 날씨엔,", line2Pre: "야외 활동 대신 시원한 ", highlight: "공연장 데이트!", suffix: "", keywords: ["데이트", "시원한"] },
            { line1: "햇살 가득한 날,", line2Pre: "어디론가 떠나고 싶다면 ", highlight: "문화 바캉스", suffix: "를 즐겨보세요.", keywords: ["바캉스", "여행"] },
            { line1: "기분 좋은 바람이 불 땐,", line2Pre: "사랑하는 사람과 ", highlight: "설레는 데이트", suffix: "를 계획해보세요.", keywords: ["데이트", "설레는"] },
            { line1: "하늘이 참 예쁘네요,", line2Pre: "이런 날엔 ", highlight: "예쁜 추억", suffix: "을 만들어야죠.", keywords: ["하늘", "추억"] },
            { line1: "햇살맛집 여기 있어요,", line2Pre: "광합성만큼 중요한 ", highlight: "문화 합성", suffix: "의 시간!", keywords: ["햇살", "문화"] }
        ]
    },
    time: {
        friday: [
            { line1: "설레는 금요일,", line2Pre: "한 주 동안 고생한 당신을 위한 ", highlight: "힐링 타임", suffix: "이 필요해요.", keywords: ["금요일", "불금", "힐링"] },
            { line1: "주말의 시작 금요일,", line2Pre: "사랑하는 사람과 함께할 ", highlight: "로맨틱한 데이트", suffix: " 계획하셨나요?", keywords: ["주말", "데이트"] },
            { line1: "불금엔 공연이지!", line2Pre: "화끈하게 스트레스 날려버릴 ", highlight: "열정적인 무대", suffix: "를 즐겨보세요.", keywords: ["불금", "열정"] },
            { line1: "여유로운 주말을 앞두고,", line2Pre: "미리 준비하는 ", highlight: "취향 저격 문화생활", suffix: " 리스트.", keywords: ["주말"] },
            { line1: "칼퇴 준비 되셨나요?", line2Pre: "지금 바로 출발하면 ", highlight: "완벽한 불금", suffix: "을 보낼 수 있어요.", keywords: ["칼퇴", "불금"] }
        ],
        evening: [
            { line1: "오늘도 수고했어요,", line2Pre: "퇴근 후 지친 마음을 달래줄 ", highlight: "위로의 시간", suffix: "을 가져보세요.", keywords: ["퇴근", "위로"] },
            { line1: "칼퇴 부르는 주문,", line2Pre: "지금 바로 달려가고 싶은 ", highlight: "저녁 공연", suffix: "이 기다립니다.", keywords: ["칼퇴", "저녁"] },
            { line1: "하루를 마무리하며,", line2Pre: "나를 채워주는 ", highlight: "풍성한 문화 산책", suffix: " 어떠신가요?", keywords: ["저녁", "산책"] },
            { line1: "어둠이 내리면,", line2Pre: "도시의 밤보다 화려한 ", highlight: "무대의 빛", suffix: "을 만나보세요.", keywords: ["밤", "야경"] },
            { line1: "저녁이 있는 삶,", line2Pre: "당신의 저녁을 더욱 풍요롭게 만들 ", highlight: "특별한 선택", suffix: "입니다.", keywords: ["저녁", "워라밸"] }
        ]
    },
    season: {
        spring: [ // 3, 4, 5
            { line1: "봄바람 휘날리며,", line2Pre: "꽃향기보다 설레는 ", highlight: "봄 맞이 공연", suffix: "으로 나들이 가요.", keywords: ["봄", "꽃"] },
            { line1: "따뜻한 봄날,", line2Pre: "겨우내 얼었던 감성을 녹여줄 ", highlight: "말랑말랑한 전시", suffix: "를 추천해요.", keywords: ["봄", "전시"] },
            { line1: "벚꽃은 졌지만,", line2Pre: "우리들의 봄은 ", highlight: "이제 시작", suffix: "입니다.", keywords: ["봄", "시작"] },
            { line1: "나랑 봄 보러 가지 않을래?", line2Pre: "노래 가사처럼 ", highlight: "설렘 가득한", suffix: " 공연 어때요?", keywords: ["봄", "설렘"] },
            { line1: "싱그러운 봄기운,", line2Pre: "새로운 시작을 응원하는 ", highlight: "희망찬 무대", suffix: "를 만나보세요.", keywords: ["봄", "희망"] }
        ],
        summer: [ // 6, 7, 8
            { line1: "무더운 여름,", line2Pre: "더위를 시원하게 날려버릴 ", highlight: "짜릿한 페스티벌", suffix: "이 시작됩니다.", keywords: ["여름", "페스티벌", "시원한"] },
            { line1: "해가 길어진 여름밤,", line2Pre: "잠들기 아쉬운 당신을 위한 ", highlight: "심야 괴담? 아니, 심야 공연!", suffix: "", keywords: ["여름", "심야"] },
            { line1: "여름 휴가 계획 하셨나요?", line2Pre: "멀리 못 간다면 ", highlight: "도심 속 피서", suffix: "를 즐겨보세요.", keywords: ["여름", "휴가"] },
            { line1: "아이스 아메리카노처럼,", line2Pre: "머리끝까지 시원해지는 ", highlight: "쿨한 무대", suffix: "가 기다립니다.", keywords: ["여름", "시원한"] },
            { line1: "뜨거운 태양 아래,", line2Pre: "더 뜨겁게 타오르는 ", highlight: "열정의 현장", suffix: "으로 초대합니다.", keywords: ["여름", "열정"] }
        ],
        autumn: [ // 9, 10, 11
            { line1: "독서의 계절 가을,", line2Pre: "책보다 깊은 울림을 주는 ", highlight: "명작 공연", suffix: "을 만나보세요.", keywords: ["가을", "독서"] },
            { line1: "선선한 가을 바람,", line2Pre: "센치해진 마음을 달래줄 ", highlight: "감성 충만 뮤직", suffix: " 플레이리스트.", keywords: ["가을", "감성"] },
            { line1: "가을 타나 봐요,", line2Pre: "외로운 마음을 달래줄 ", highlight: "따스한 위로", suffix: "가 필요해요.", keywords: ["가을", "위로"] },
            { line1: "단풍보다 붉게 물든,", line2Pre: "예술가들의 ", highlight: "뜨거운 열정", suffix: "을 만나보세요.", keywords: ["가을", "열정"] },
            { line1: "가을밤의 낭만,", line2Pre: "낙엽 밟는 소리보다 좋은 ", highlight: "아름다운 선율", suffix: "에 취해보세요.", keywords: ["가을", "낭만"] }
        ],
        winter: [ // 12, 1, 2
            { line1: "추운 겨울이지만,", line2Pre: "마음의 온도를 높여줄 ", highlight: "따뜻한 공연", suffix: "이 여기 있어요.", keywords: ["겨울", "따뜻한"] },
            { line1: "한 해를 마무리하며,", line2Pre: "소중한 사람들과 나누고픈 ", highlight: "특별한 선물", suffix: " 같은 시간.", keywords: ["연말", "선물"] },
            { line1: "코끝이 찡한 겨울,", line2Pre: "얼어붙은 몸과 마음을 ", highlight: "사르르 녹여줄", suffix: " 감동의 무대.", keywords: ["겨울", "감동"] },
            { line1: "이불 밖은 위험해?", line2Pre: "아니요, 이 컨텐츠를 놓치는 게 ", highlight: "더 위험해요!", suffix: "", keywords: ["겨울", "집순이"] },
            { line1: "겨울 밤하늘 별처럼,", line2Pre: "당신의 기억 속에 ", highlight: "오래 반짝일", suffix: " 추억 하나.", keywords: ["겨울", "추억"] },
            { line1: "붕어빵보다 따끈한,", line2Pre: "갓 구워낸 ", highlight: "신작 컨텐츠", suffix: " 소식입니다.", keywords: ["겨울", "신작"] }
        ]
    },
    holiday: {
        newYear: [ // 1.1
            { line1: "새로운 시작 1월,", line2Pre: "올해는 더 행복한 일만 가득하길 ", highlight: "문화생활", suffix: "로 응원합니다.", keywords: ["새해", "신년", "시작"] },
            { line1: "Happy New Year!", line2Pre: "작심삼일이 되지 않도록 ", highlight: "첫 공연 나들이", suffix: " 계획해볼까요?", keywords: ["새해", "첫"] },
            { line1: "복 많이 받으세요!", line2Pre: "당신의 일 년을 빛내줄 ", highlight: "행운 같은 공연", suffix: "을 추천해요.", keywords: ["새해", "행운"] },
            { line1: "해돋이는 보셨나요?", line2Pre: "떠오르는 태양처럼 ", highlight: "벅찬 감동", suffix: "을 느껴보세요.", keywords: ["새해", "감동"] },
            { line1: "올해의 버킷리스트,", line2Pre: "미뤄왔던 문화생활, ", highlight: "오늘부터 1일", suffix: " 실천해보세요.", keywords: ["버킷리스트", "시작"] }
        ],
        seollal: [ // Lunar New Year (2025: 1.28-30)
            { line1: "새해 복 많이 받으세요!", line2Pre: "가족들과 함께 나누는 ", highlight: "풍성한 덕담", suffix: " 같은 공연.", keywords: ["설날", "가족", "전통"] },
            { line1: "즐거운 설 연휴,", line2Pre: "오랜만에 만난 친척들과 ", highlight: "특별한 추억", suffix: "을 만들어보세요.", keywords: ["설날", "가족"] },
            { line1: "명절엔 역시,", line2Pre: "온 가족이 함께 즐기는 ", highlight: "흥겨운 무대", suffix: "가 제격이죠.", keywords: ["설날", "흥겨운"] },
            { line1: "연휴 순삭 방지!", line2Pre: "맛있는 음식 먹고 ", highlight: "소화시킬 겸", suffix: " 공연장 나들이 어때요?", keywords: ["연휴", "나들이"] },
            { line1: "까치 까치 설날은,", line2Pre: "어제고요, 우리 우리 설날은 ", highlight: "문화 즐기는 날", suffix: "이래요.", keywords: ["설날", "동요"] }
        ],
        valentine: [ // 2.14
            { line1: "달콤한 발렌타인,", line2Pre: "사랑하는 연인에게 초콜릿보다 달달한 ", highlight: "공연 데이트", suffix: "를 선물하세요.", keywords: ["발렌타인", "사랑", "커플"] },
            { line1: "두근두근 설레는 오늘,", line2Pre: "썸타는 그 사람과 ", highlight: "로맨틱한 시간", suffix: "을 보내고 싶다면?", keywords: ["로맨틱", "썸", "데이트"] },
            { line1: "사랑 고백 D-Day,", line2Pre: "성공 확률 100% ", highlight: "분위기 깡패", suffix: " 공연장 추천.", keywords: ["고백", "사랑"] },
            { line1: "솔로라도 괜찮아!", line2Pre: "나 자신을 사랑하는 ", highlight: "셀프 선물", suffix: "같은 하루를 보내세요.", keywords: ["솔로", "선물"] },
            { line1: "초콜릿처럼 녹아드는,", line2Pre: "감미로운 선율의 ", highlight: "러브 송", suffix: "을 들어보세요.", keywords: ["발렌타인", "음악"] }
        ],
        samil: [ // 3.1
            { line1: "대한독립만세!", line2Pre: "3.1절의 의미를 되새기며 ", highlight: "역사가 깃든", suffix: " 전시를 찾아보는 건 어떨까요?", keywords: ["역사", "독립", "대한"] },
            { line1: "뜻깊은 휴일,", line2Pre: "감사한 마음으로 즐기는 ", highlight: "문화 휴식", suffix: "을 제안합니다.", keywords: ["휴일", "문화"] },
            { line1: "그날의 함성,", line2Pre: "잊지 않고 기억하겠습니다. ", highlight: "역사적인", suffix: " 이야기를 만나보세요.", keywords: ["삼일절", "역사"] },
            { line1: "나라 사랑하는 마음,", line2Pre: "태극기 게양하고 ", highlight: "의미 있는 하루", suffix: "를 보내세요.", keywords: ["삼일절", "태극기"] },
            { line1: "봄의 시작과 함께,", line2Pre: "자유와 평화의 가치를 담은 ", highlight: "예술 작품", suffix: "을 감상해보세요.", keywords: ["평화", "예술"] }
        ],
        children: [ // 5.5
            { line1: "오늘은 어린이날!", line2Pre: "우리 아이들의 세상, 꿈과 희망이 가득한 ", highlight: "키즈 공연", suffix: " 총출동!", keywords: ["어린이", "가족", "키즈"] },
            { line1: "엄마 아빠 사랑해요,", line2Pre: "온 가족이 함께 웃을 수 있는 ", highlight: "패밀리 쇼", suffix: "를 만나보세요.", keywords: ["가족", "사랑"] },
            { line1: "너의 꿈을 응원해,", line2Pre: "아이들의 상상력을 자극하는 ", highlight: "창의력 대장", suffix: " 전시회.", keywords: ["어린이", "꿈"] },
            { line1: "선물 샀니?", line2Pre: "장난감보다 더 오래 기억될 ", highlight: "소중한 추억", suffix: "을 선물해주세요.", keywords: ["어린이날", "선물"] },
            { line1: "세상 모든 어린이들,", line2Pre: "오늘 하루만큼은 주인공이 되어 ", highlight: "신나게 놀아보자", suffix: "!", keywords: ["어린이", "주인공"] }
        ],
        chuseok: [ // Chuseok (2025: 10.5-8)
            { line1: "더도 말고 덜도 말고 한가위만 같아라,", line2Pre: "보름달처럼 꽉 찬 ", highlight: "감동의 무대", suffix: "가 기다립니다.", keywords: ["추석", "한가위", "가족"] },
            { line1: "풍성한 추석 연휴,", line2Pre: "가족 모두가 만족할 ", highlight: "대작 뮤지컬", suffix: " 어떠신가요?", keywords: ["추석", "뮤지컬", "가족"] },
            { line1: "고향 가는 길,", line2Pre: "지루한 귀성길을 달래줄 ", highlight: "재미있는 읽을거리", suffix: "를 챙겨가세요.", keywords: ["귀성길", "추석"] },
            { line1: "송편 빚고 공연 보고,", line2Pre: "전통과 현대가 어우러진 ", highlight: "퓨전 국악", suffix: " 공연은 어때요?", keywords: ["추석", "국악"] },
            { line1: "달님에게 소원을,", line2Pre: "당신의 바램이 이루어지는 ", highlight: "마법 같은 순간", suffix: "을 기원합니다.", keywords: ["소원", "보름달"] }
        ],
        halloween: [ // 10.31
            { line1: "Trick or Treat!", line2Pre: "할로윈의 밤, 등골이 오싹해지는 ", highlight: "이색 호러", suffix: " 체험을 즐겨보세요.", keywords: ["할로윈", "호러", "공포"] },
            { line1: "유령이 나올 것 같은 밤,", line2Pre: "평범한 일상을 깨울 ", highlight: "짜릿한 파티", suffix: " 같은 공연!", keywords: ["파티", "할로윈"] },
            { line1: "분장 준비 완료?", line2Pre: "누구보다 돋보이는 코스튬 입고 ", highlight: "할로윈 축제", suffix: " 현장으로!", keywords: ["할로윈", "코스튬"] },
            { line1: "오싹하지만 재밌어,", line2Pre: "아이들도 즐길 수 있는 ", highlight: "귀여운 유령", suffix: "들을 만나러 오세요.", keywords: ["할로윈", "가족"] },
            { line1: "오늘 밤 주인공은,", line2Pre: "마녀도 드라큘라도 아닌 ", highlight: "바로 당신", suffix: "입니다.", keywords: ["할로윈", "주인공"] }
        ],
        christmas: [ // 12.23-25
            { line1: "메리 크리스마스!", line2Pre: "산타가 선물처럼 준비한 ", highlight: "환상적인 쇼", suffix: "를 놓치지 마세요.", keywords: ["크리스마스", "성탄", "산타"] },
            { line1: "낭만 가득 성탄절,", line2Pre: "사랑하는 연인과 함께 ", highlight: "기적 같은 순간", suffix: "을 만들어보세요.", keywords: ["크리스마스", "낭만", "연인"] },
            { line1: "Happy Holidays,", line2Pre: "반짝이는 트리보다 빛나는 ", highlight: "당신의 미소", suffix: "를 보고 싶어요.", keywords: ["홀리데이", "트리"] },
            { line1: "화이트 크리스마스일까요?", line2Pre: "눈이 오지 않아도 괜찮아요, ", highlight: "눈꽃 같은 감동", suffix: "이 있으니까요.", keywords: ["크리스마스", "눈"] },
            { line1: "종소리 울려라,", line2Pre: "온 세상에 평화와 사랑을 전하는 ", highlight: "따뜻한 음악회", suffix: "에 초대합니다.", keywords: ["캐롤", "음악회"] }
        ],
        yearEnd: [ // 12.26-31
            { line1: "Good Bye 2025,", line2Pre: "한 해의 마지막 페이지를 ", highlight: "아름다운 선율", suffix: "로 장식해보세요.", keywords: ["연말", "콘서트", "음악회"] },
            { line1: "수고했어 올해도,", line2Pre: "나를 위한 연말 정산, ", highlight: "최고의 공연", suffix: "으로 보상받으세요.", keywords: ["연말", "보상"] },
            { line1: "카운트다운 준비!", line2Pre: "새해를 맞이하는 ", highlight: "벅찬 순간", suffix: "을 함께하고 싶어요.", keywords: ["카운트다운", "새해"] },
            { line1: "연말 모임 장소 고민?", line2Pre: "식상한 술자리 대신 ", highlight: "품격 있는 공연", suffix: " 회식 어때요?", keywords: ["연말", "모임"] },
            { line1: "아듀 2025,", line2Pre: "지나간 아쉬움은 털어버리고 ", highlight: "새로운 희망", suffix: "을 노래하세요.", keywords: ["송년회", "희망"] }
        ]
    },
    genre: {
        // Sports - Ball Games
        volleyball: [
            { line1: "오늘 배구 경기 어때요?", line2Pre: "스파이크 한 방에 스트레스 날려버릴 ", highlight: "배구 직관", suffix: " 가보자고!", keywords: ["배구", "volleyball", "V-리그"] },
            { line1: "심장이 쫄깃한 랠리,", line2Pre: "코트 위의 뜨거운 열기, ", highlight: "배구장", suffix: "으로 초대합니다.", keywords: ["배구", "volleyball"] },
            { line1: "거침없는 강스파이크!", line2Pre: "선수들의 투지가 빛나는 ", highlight: "승부의 세계", suffix: "를 만나보세요.", keywords: ["배구", "스파이크"] },
            { line1: "배구 여신 보러 갈래?", line2Pre: "TV보다 훨씬 더 생생한 ", highlight: "직관의 매력", suffix: "에 빠져보세요.", keywords: ["배구", "직관"] },
            { line1: "환상적인 블로킹!", line2Pre: "손에 땀을 쥐게 하는 ", highlight: "명승부", suffix: "가 펼쳐집니다.", keywords: ["배구", "블로킹"] }
        ],
        basketball: [
            { line1: "버저비터의 짜릿함!", line2Pre: "0.1초의 승부, ", highlight: "농구 직관", suffix: "의 묘미를 느껴보세요.", keywords: ["농구", "basketball", "KBL"] },
            { line1: "슬램덩크 좋아하세요?", line2Pre: "현실에서 펼쳐지는 ", highlight: "박진감 넘치는 경기", suffix: "가 기다립니다.", keywords: ["농구", "basketball"] },
            { line1: "코트 위를 지배하라,", line2Pre: "선수들의 뜨거운 열정, ", highlight: "농구장", suffix: "에서 확인하세요.", keywords: ["농구", "열정"] },
            { line1: "겨울 실내 스포츠의 꽃,", line2Pre: "추위도 잊게 만드는 ", highlight: "뜨거운 함성", suffix: " 속으로!", keywords: ["농구", "겨울"] },
            { line1: "마이클 조던 빙의?", line2Pre: "화려한 개인기와 ", highlight: "멋진 덩크슛", suffix: "을 눈앞에서!", keywords: ["농구", "덩크"] }
        ],
        soccer: [
            { line1: "골~인! 함성 소리,", line2Pre: "푸른 잔디 위에서 펼쳐지는 ", highlight: "축구 경기", suffix: " 함께 응원해요.", keywords: ["축구", "soccer", "K리그"] },
            { line1: "오늘은 축구 보는 날,", line2Pre: "치킨 하나 사들고 ", highlight: "축구장 나들이", suffix: " 어떠세요?", keywords: ["축구", "soccer"] },
            { line1: "붉은 악마가 되어볼까?", line2Pre: "심장을 울리는 ", highlight: "뜨거운 응원전", suffix: "에 합류하세요.", keywords: ["축구", "응원"] },
            { line1: "국가대표급 플레이,", line2Pre: "그라운드를 누비는 ", highlight: "선수들의 열정", suffix: "을 응원합니다.", keywords: ["축구", "국가대표"] },
            { line1: "90분의 드라마,", line2Pre: "예측불허 승부의 세계, ", highlight: "축구 직관", suffix: "이 답입니다.", keywords: ["축구", "직관"] }
        ],
        baseball: [
            { line1: "야구장 갈 준비 됐나요?", line2Pre: "9회말 2아웃, ", highlight: "역전의 드라마", suffix: "를 눈앞에서!", keywords: ["야구", "baseball", "KBO"] },
            { line1: "치맥과 함께 야구장!", line2Pre: "다 같이 부르는 ", highlight: "응원가", suffix: "가 그리울 땐 야구장으로!", keywords: ["야구", "baseball", "치맥"] },
            { line1: "홈런볼 날아갑니다!", line2Pre: "스트레스 날려버릴 ", highlight: "시원한 홈런", suffix: " 한 방!", keywords: ["야구", "홈런"] },
            { line1: "가을 야구를 향하여,", line2Pre: "매 경기 명승부, ", highlight: "치열한 순위 싸움", suffix: "을 지켜보세요.", keywords: ["야구", "가을야구"] },
            { line1: "야구는 끝날 때까지,", line2Pre: "끝난 게 아니다! ", highlight: "기적 같은 승리", suffix: "를 믿어보세요.", keywords: ["야구", "명언"] }
        ],
        handball: [
            { line1: "우생순의 감동 그대로,", line2Pre: "작은 공 하나에 담긴 ", highlight: "투지와 열정", suffix: "을 만나보세요.", keywords: ["핸드볼", "handball"] },
            { line1: "스피드와 파워의 조화,", line2Pre: "실내에서 즐기는 ", highlight: "다이내믹한 승부", suffix: " 핸드볼!", keywords: ["핸드볼", "경기"] },
            { line1: "핸드볼 H리그 개막!", line2Pre: "선수들의 거친 숨소리까지 들리는 ", highlight: "생생한 현장", suffix: "으로.", keywords: ["핸드볼", "H리그"] },
            { line1: "던지고 막고 뛰고!", line2Pre: "한시도 눈을 뗄 수 없는 ", highlight: "박진감", suffix: " 넘치는 경기.", keywords: ["핸드볼", "스포츠"] },
            { line1: "비인기? 아니 꿀재미!", line2Pre: "한 번 보면 빠져드는 ", highlight: "핸드볼의 매력", suffix: "을 발견하세요.", keywords: ["핸드볼", "매력"] }
        ],
        hockey: [
            { line1: "빙판 위의 격투기,", line2Pre: "가장 빠르고 거친 스포츠, ", highlight: "아이스하키", suffix: "의 세계로!", keywords: ["하키", "hockey", "아이스하키"] },
            { line1: "퍽! 소리 나는 쾌감,", line2Pre: "시속 160km로 질주하는 ", highlight: "퍽의 움직임", suffix: "을 쫓아보세요.", keywords: ["하키", "퍽"] },
            { line1: "쿨한 링크장 데이트,", line2Pre: "무더위를 날려버릴 ", highlight: "시원한 경기", suffix: " 관람 어때요?", keywords: ["하키", "피서"] },
            { line1: "바디체크의 짜릿함,", line2Pre: "남자들의 뜨거운 승부, ", highlight: "빙판 위의 전쟁", suffix: "이 시작됩니다.", keywords: ["하키", "승부"] },
            { line1: "동계 스포츠의 꽃,", line2Pre: "순백의 링크 위 펼쳐지는 ", highlight: "화려한 플레이", suffix: "를 감상하세요.", keywords: ["하키", "동계"] }
        ],

        // Arts & Performance
        musical: [
            { line1: "오늘은 내가 주인공,", line2Pre: "화려한 조명 아래 펼쳐지는 ", highlight: "뮤지컬 한 편", suffix: " 어때요?", keywords: ["뮤지컬", "musical"] },
            { line1: "눈과 귀가 즐거운 시간,", line2Pre: "당신의 감성을 채워줄 ", highlight: "명작 뮤지컬", suffix: "을 만나보세요.", keywords: ["뮤지컬", "musical"] },
            { line1: "브로드웨이 안 부럽다!", line2Pre: "한국에서 만나는 ", highlight: "월드클래스 무대", suffix: "가 여기 있어요.", keywords: ["뮤지컬", "대작"] },
            { line1: "가슴 벅찬 넘버의 향연,", line2Pre: "배우들의 폭팔적인 가창력에 ", highlight: "압도당할 시간", suffix: "입니다.", keywords: ["뮤지컬", "넘버"] },
            { line1: "VIP석 부럽지 않은,", line2Pre: "생생한 감동을 전해줄 ", highlight: "화제의 신작", suffix: "을 소개합니다.", keywords: ["뮤지컬", "신작"] }
        ],
        play: [
            { line1: "대학로 감성 충전,", line2Pre: "배우들의 숨소리까지 느껴지는 ", highlight: "연극 무대", suffix: "로 초대합니다.", keywords: ["연극", "play", "대학로"] },
            { line1: "소소하지만 확실한 행복,", line2Pre: "웃음과 감동이 있는 ", highlight: "연극 한 편", suffix: " 관람하세요.", keywords: ["연극", "play"] },
            { line1: "스크린과는 다른 매력,", line2Pre: "눈앞에서 펼쳐지는 ", highlight: "리얼한 연기", suffix: "에 빠져보세요.", keywords: ["연극", "배우"] },
            { line1: "로맨스부터 스릴러까지,", line2Pre: "취향대로 골라 보는 ", highlight: "다채로운 연극", suffix: "의 세계.", keywords: ["연극", "취향"] },
            { line1: "오늘 뭐 하지? 연극!", line2Pre: "친구, 연인과 함께 ", highlight: "특별한 추억", suffix: " 만들기 딱 좋아요.", keywords: ["연극", "데이트"] }
        ],
        classical: [
            { line1: "우아한 하루의 완성,", line2Pre: "마음을 차분하게 해줄 ", highlight: "클래식 선율", suffix: "을 선물합니다.", keywords: ["클래식", "classical", "음악회"] },
            { line1: "복잡한 생각은 잠시 끄고,", line2Pre: "오케스트라의 ", highlight: "웅장한 울림", suffix: "에 빠져보세요.", keywords: ["클래식", "classical"] },
            { line1: "영혼을 울리는 선율,", line2Pre: "지친 당신을 위로해줄 ", highlight: "치유의 음악", suffix: "이 흐릅니다.", keywords: ["클래식", "힐링"] },
            { line1: "발레의 우아함,", line2Pre: "손끝 하나에도 감정이 실린 ", highlight: "아름다운 몸짓", suffix: "을 감상하세요.", keywords: ["무용", "발레"] },
            { line1: "브런치 콘서트 어때요?", line2Pre: "여유로운 오전, ", highlight: "향긋한 커피와 클래식", suffix: "의 만남.", keywords: ["클래식", "브런치"] }
        ],
        concert: [
            { line1: "떼창 준비되셨나요?", line2Pre: "스트레스 확 날려버릴 ", highlight: "광란의 콘서트", suffix: " 현장으로!", keywords: ["콘서트", "concert"] },
            { line1: "나의 최애를 만나는 날,", line2Pre: "꿈꿔왔던 바로 그 순간, ", highlight: "두근두근 설렘", suffix: " 가득!", keywords: ["콘서트", "팬미팅"] },
            { line1: "음악에 취하는 밤,", line2Pre: "라이브로 듣는 ", highlight: "전율의 무대", suffix: "가 당신을 기다립니다.", keywords: ["콘서트", "라이브"] },
            { line1: "목이 터져라 소리질러!", line2Pre: "모두가 하나 되는 ", highlight: "열정의 도가니", suffix: " 속으로 빠져보세요.", keywords: ["콘서트", "열정"] },
            { line1: "감성 보컬의 라이브,", line2Pre: "지친 마음을 어루만져 줄 ", highlight: "따뜻한 노래", suffix: "를 들려드릴게요.", keywords: ["콘서트", "감성"] }
        ],

        // Exhibition & Activity
        exhibition: [
            { line1: "조용한 사색이 필요한 날,", line2Pre: "나만의 속도로 즐기는 ", highlight: "미술관 데이트", suffix: " 어떠세요?", keywords: ["전시", "exhibition", "미술관"] },
            { line1: "새로운 영감이 필요하다면,", line2Pre: "감각을 깨우는 ", highlight: "특별한 전시", suffix: "를 찾아보세요.", keywords: ["전시", "exhibition"] },
            { line1: "인생샷 성지 여기!", line2Pre: "찍는 족족 화보가 되는 ", highlight: "포토존 가득", suffix: "한 전시회.", keywords: ["전시", "인생샷"] },
            { line1: "예술과 기술의 만남,", line2Pre: "눈을 뗄 수 없는 ", highlight: "몰입형 미디어아트", suffix: "의 세계로.", keywords: ["전시", "미디어아트"] },
            { line1: "도슨트와 함께하는,", line2Pre: "알고 보면 더 재미있는 ", highlight: "친절한 예술 여행", suffix: "을 떠나보세요.", keywords: ["전시", "도슨트"] }
        ],
        activity: [
            { line1: "지루한 건 딱 질색!", line2Pre: "온몸으로 즐기는 ", highlight: "짜릿한 액티비티", suffix: "가 필요해요.", keywords: ["액티비티", "activity"] },
            { line1: "아드레날린 폭발!", line2Pre: "일상의 스트레스를 날려버릴 ", highlight: "익사이팅 체험", suffix: " 도전!", keywords: ["액티비티", "익사이팅"] },
            { line1: "이번 주말 이색 데이트,", line2Pre: "함께 땀 흘리며 더 가까워지는 ", highlight: "커플 액티비티", suffix: " 강추!", keywords: ["액티비티", "데이트"] },
            { line1: "VR부터 실내 스포츠까지,", line2Pre: "날씨 걱정 없이 즐기는 ", highlight: "실내 놀이터", suffix: " 총집합.", keywords: ["액티비티", "실내"] },
            { line1: "방소는 내가 탈출한다!", line2Pre: "두뇌 풀가동, ", highlight: "방탈출 게임", suffix: "의 주인공이 되어보세요.", keywords: ["방탈출", "액티비티"] }
        ],
        class: [
            { line1: "똥손도 금손 되는 마법,", line2Pre: "오늘 하루, 나만의 ", highlight: "취미 찾기", suffix: "에 도전해보세요.", keywords: ["클래스", "class", "원데이"] },
            { line1: "퇴근 후 갓생 살기,", line2Pre: "지친 일상에 활력을 불어넣을 ", highlight: "원데이 클래스", suffix: " 어때요?", keywords: ["클래스", "직장인"] },
            { line1: "나만의 향기 만들기,", line2Pre: "세상에 하나뿐인 ", highlight: "특별한 선물", suffix: "을 직접 만들어보세요.", keywords: ["클래스", "공방"] },
            { line1: "요리부터 드로잉까지,", line2Pre: "배움의 즐거움이 가득한 ", highlight: "취미 부자", suffix: "의 길로 초대합니다.", keywords: ["클래스", "배움"] },
            { line1: "베이킹의 달인 도전!", line2Pre: "달콤한 디저트 냄새 가득한 ", highlight: "쿠킹 클래스", suffix: "에서 힐링하세요.", keywords: ["클래스", "베이킹"] }
        ],

        // Lifestyle & Others
        travel: [
            { line1: "곧 연휴인데 어디 가지?", line2Pre: "지금 떠나기 딱 좋은 ", highlight: "여행지 정보", suffix: "를 모아봤어요.", keywords: ["여행", "travel", "투어"] },
            { line1: "일상 탈출, 준비되셨나요?", line2Pre: "가볍게 떠날 수 있는 ", highlight: "당일치기 여행", suffix: "을 추천해요.", keywords: ["여행", "travel"] },
            { line1: "이번 주말엔 여기!", line2Pre: "고민 없이 떠나는 ", highlight: "힐링 여행", suffix: " 어떠신가요?", keywords: ["여행", "travel"] },
            { line1: "캠핑 감성 충전,", line2Pre: "타닥타닥 타오르는 ", highlight: "불멍의 시간", suffix: "을 가져보세요.", keywords: ["여행", "캠핑", "글램핑"] },
            { line1: "바다가 부른다!", line2Pre: "속이 뻥 뚫리는 시원한 ", highlight: "오션뷰 여행", suffix: " 지금 바로 출발!", keywords: ["여행", "바다"] }
        ],
        festival: [
            { line1: "축제의 계절이 왔어요!", line2Pre: "전국 방방곡곡 ", highlight: "흥겨운 축제", suffix: "가 당신을 기다립니다.", keywords: ["축제", "festival"] },
            { line1: "밤하늘을 수놓는 불꽃,", line2Pre: "황홀한 야경과 함께하는 ", highlight: "로맨틱 축제", suffix: "를 즐겨보세요.", keywords: ["축제", "불꽃"] },
            { line1: "맛있는 건 0칼로리?", line2Pre: "지역 특산물이 가득한 ", highlight: "미식 여행", suffix: " 떠나볼까요?", keywords: ["축제", "먹거리"] },
            { line1: "거리마다 활기 가득,", line2Pre: "퍼레이드와 공연이 어우러진 ", highlight: "거리 축제", suffix: "의 현장으로.", keywords: ["축제", "퍼레이드"] },
            { line1: "꽃구경 갈 사람?", line2Pre: "인생샷 백만 장 남길 수 있는 ", highlight: "꽃 축제", suffix: " 놓치지 마세요.", keywords: ["축제", "꽃"] }
        ],
        kids: [
            { line1: "우리 아이 웃음꽃 활짝,", line2Pre: "온 가족이 함께 즐기는 ", highlight: "키즈 공연", suffix: " 여기 다 있어요.", keywords: ["아동", "kids", "가족"] },
            { line1: "엄마 아빠 어디 가?", line2Pre: "아이들이 더 좋아하는 ", highlight: "신나는 체험", suffix: " 떠나볼까요?", keywords: ["아동", "kids"] },
            { line1: "동화 속 세상으로!", line2Pre: "아이들의 상상력을 키워줄 ", highlight: "마법 같은 공연", suffix: "을 선물하세요.", keywords: ["아동", "동화"] },
            { line1: "교육과 재미를 동시에,", line2Pre: "놀면서 배우는 ", highlight: "유익한 전시", suffix: "를 만나보세요.", keywords: ["아동", "체험"] },
            { line1: "캐릭터 친구들 안녕?", line2Pre: "TV 속 친구들을 직접 만나는 ", highlight: "팬미팅 시간", suffix: "!", keywords: ["아동", "캐릭터"] }
        ],
        movie: [
            { line1: "영화 같은 하루,", line2Pre: "고소한 팝콘 냄새와 함께 ", highlight: "스크린 여행", suffix: " 떠나볼까요?", keywords: ["영화", "movie"] },
            { line1: "천만 관객의 선택,", line2Pre: "지금 가장 핫한 ", highlight: "블록버스터", suffix: "를 확인하세요.", keywords: ["영화", "movie"] },
            { line1: "감동의 대서사시,", line2Pre: "손수건 필수! 눈물 콧물 쏙 뺄 ", highlight: "인생 영화", suffix: " 한 편.", keywords: ["영화", "감동"] },
            { line1: "심장이 쫄깃한 스릴러,", line2Pre: "반전에 반전을 거듭하는 ", highlight: "미친 스토리", suffix: "에 빠져보세요.", keywords: ["영화", "스릴러"] },
            { line1: "달달한 로맨스,", line2Pre: "연애 세포 깨워줄 ", highlight: "사랑스러운 영화", suffix: " 추천해드려요.", keywords: ["영화", "로맨스"] }
        ],
        ott: [
            { line1: "이불 밖은 위험해,", line2Pre: "집에서 편안하게 즐기는 ", highlight: "방구석 1열", suffix: " 영화관.", keywords: ["OTT", "넷플릭스"] },
            { line1: "주말 순삭 주의보!", line2Pre: "한 번 시작하면 멈출 수 없는 ", highlight: "마성의 시리즈", suffix: " 정주행.", keywords: ["OTT", "드라마"] },
            { line1: "뭘 볼까 고민될 땐?", line2Pre: "당신의 취향을 저격할 ", highlight: "추천작 리스트", suffix: "를 확인하세요.", keywords: ["OTT", "추천"] },
            { line1: "내 손안의 극장,", line2Pre: "언제 어디서나 즐기는 ", highlight: "무제한 콘텐츠", suffix: "의 바다.", keywords: ["OTT", "콘텐츠"] },
            { line1: "독점 공개작 오픈!", line2Pre: "오직 여기서만 볼 수 있는 ", highlight: "오리지널 시리즈", suffix: "를 만나보세요.", keywords: ["OTT", "오리지널"] }
        ],
        hotdeal: [
            { line1: "놓치면 후회할 껄요?", line2Pre: "지금 이 순간만 가능한 ", highlight: "역대급 할인", suffix: " 찬스!", keywords: ["핫딜", "hotdeal"] },
            { line1: "지갑은 지키고 재미는 챙기고,", line2Pre: "가성비 끝판왕 ", highlight: "반값 티켓", suffix: "이 쏟아집니다.", keywords: ["핫딜", "할인"] },
            { line1: "마감 임박! 서두르세요,", line2Pre: "고민하는 순간 품절되는 ", highlight: "초특가 타임", suffix: ".", keywords: ["핫딜", "마감"] },
            { line1: "문화생활도 알뜰하게,", line2Pre: "똑똑한 당신을 위한 ", highlight: "최저가 혜택", suffix: " 모음.", keywords: ["핫딜", "최저가"] },
            { line1: "오늘만 이 가격!", line2Pre: "눈을 의심하게 만드는 ", highlight: "파격적인 혜택", suffix: "을 잡으세요.", keywords: ["핫딜", "이벤트"] }
        ],
        leisure: [
            { line1: "주말엔 역시 야외로!", line2Pre: "꽉 막힌 도심을 벗어나 ", highlight: "자유를 만끽", suffix: "하세요.", keywords: ["레저", "leisure"] },
            { line1: "물 위를 가르는 짜릿함,", line2Pre: "무더위를 잊게 해줄 ", highlight: "수상 레저", suffix: "의 세계로.", keywords: ["레저", "수상"] },
            { line1: "하얀 설원을 질주하라,", line2Pre: "짜릿한 속도감이 느껴지는 ", highlight: "겨울 레저", suffix: " 시즌!", keywords: ["레저", "스키"] },
            { line1: "힐링 낚시 캠프,", line2Pre: "잔잔한 물결을 바라보며 ", highlight: "세월을 낚는", suffix: " 여유를 즐기세요.", keywords: ["레저", "낚시"] },
            { line1: "도심 속 힐링 스팟,", line2Pre: "가볍게 즐길 수 있는 ", highlight: "실내 레저", suffix: "도 다양해요.", keywords: ["레저", "실내"] }
        ]
    },
    location: [
        { line1: "오늘 {location}에서,", line2Pre: "특별한 ", highlight: "{genre} 한 편", suffix: " 어떠세요?", keywords: ["{location}"] },
        { line1: "이번 주말, {location}에서", line2Pre: "당신을 기다리는 ", highlight: "{genre} 컨텐츠", suffix: "가 발견되었네요.", keywords: ["{location}"] },
        { line1: "{location} 나들이 가신다면,", line2Pre: "함께 즐기기 좋은 ", highlight: "{genre}", suffix: " 추천드려요.", keywords: ["{location}"] },
        { line1: "{location}의 밤을,", line2Pre: "아름답게 수놓을 ", highlight: "{genre}", suffix: " 어떠신가요?", keywords: ["{location}"] },
        { line1: "{location} 핫플레이스!", line2Pre: "요즘 뜨고 있는 ", highlight: "{genre}", suffix: " 소식을 전해드립니다.", keywords: ["{location}"] }
    ]
};

// Define explicit interface to allow optional boldPrefix
interface HeroTemplate {
    line1: string;
    line2Pre: string;
    highlight: string;
    suffix: string;
    keywords: string[];
    boldPrefix?: string; // New optional field for white bold text
}

// type HeroTemplate = typeof HERO_TEMPLATES.general[number] | typeof HERO_TEMPLATES.location[number];

const Cursor = () => (
    <span className="inline-block w-[4px] h-[1em] bg-[#FACC15] ml-[0.5ch] align-sub animate-cursor-blink" />
);

const TypingHero = ({
    template,
    onCycle,
    paused
}: {
    template: HeroTemplate,
    onCycle: () => void,
    paused: boolean
}) => {
    const [displayedTemplate, setDisplayedTemplate] = useState<HeroTemplate>(template);
    // Start from TYPE phase with progress 0 for typing animation on initial mount
    const [phase, setPhase] = useState<'WAIT' | 'DELETE' | 'TYPE'>('TYPE');
    const [progress, setProgress] = useState(0);

    // Calculate segment lengths
    const len1 = displayedTemplate.line1.length;
    const lenBold = displayedTemplate.boldPrefix?.length || 0;
    const len2Pre = displayedTemplate.line2Pre.length;
    const lenHl = displayedTemplate.highlight.length;
    const lenSuf = displayedTemplate.suffix.length;
    const totalLen = len1 + lenBold + len2Pre + lenHl + lenSuf;

    // React to template updates from parent
    useEffect(() => {
        // Only update if actually different to avoid loops
        if (template !== displayedTemplate) {
            setDisplayedTemplate(template);

            if (phase === 'DELETE') {
                // We were deleting and just got new text -> Start Typing
                setPhase('TYPE');
                setProgress(0);
            } else {
                // Template changed during WAIT or TYPE -> Start typing the new one
                setPhase('TYPE');
                setProgress(0);
            }
        }
    }, [template, displayedTemplate, phase]); // Added displayedTemplate and phase to dependencies

    useEffect(() => {
        // If paused, do NOT schedule next tick.
        // When unpaused, this effect will re-run and schedule based on current phase.
        if (paused) return;

        let timeout: NodeJS.Timeout;

        if (phase === 'WAIT') {
            // Wait 5 seconds before deleting
            timeout = setTimeout(() => {
                setPhase('DELETE');
                setProgress(totalLen); // Start deleting from true end
            }, 5000);
        } else if (phase === 'DELETE') {
            // Delete backwards
            timeout = setTimeout(() => {
                setProgress(prev => {
                    const next = prev - 1;
                    if (next < 0) {
                        onCycle(); // Request new template
                        return 0; // Wait for prop update to switch phase
                    }
                    return next;
                });
            }, 50);
        } else if (phase === 'TYPE') {
            // Type forwards
            timeout = setTimeout(() => {
                setProgress(prev => {
                    const next = prev + 1;
                    if (next > totalLen) {
                        setPhase('WAIT');
                        return totalLen;
                    }
                    return next;
                });
            }, 100);
        }

        return () => clearTimeout(timeout);
    }, [phase, progress, totalLen, onCycle, paused]);

    // Helper to slice text based on global progress
    const getSub = (text: string, offset: number) => {
        if (progress < offset) return '';
        if (progress >= offset + text.length) return text;
        return text.slice(0, progress - offset);
    };

    const t1 = getSub(displayedTemplate.line1, 0);
    const tBold = displayedTemplate.boldPrefix ? getSub(displayedTemplate.boldPrefix, len1) : '';
    const t2Pre = getSub(displayedTemplate.line2Pre, len1 + lenBold);
    const tHl = getSub(displayedTemplate.highlight, len1 + lenBold + len2Pre);
    const tSuf = getSub(displayedTemplate.suffix, len1 + lenBold + len2Pre + lenHl);

    // Determine active segment for cursor placement
    let cursorSegment: 'line1' | 'bold' | 'line2Pre' | 'hl' | 'suffix' | null = null;

    // Only show cursor if we are actively typing/deleting or waiting
    // But precise placement:
    if (progress <= len1) cursorSegment = 'line1';
    else if (progress <= len1 + lenBold) cursorSegment = 'bold';
    else if (progress <= len1 + lenBold + len2Pre) cursorSegment = 'line2Pre';
    else if (progress <= len1 + lenBold + len2Pre + lenHl) cursorSegment = 'hl';
    else cursorSegment = 'suffix';

    return (
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-light text-white light:text-black leading-[1.15] tracking-tighter hidden sm:block break-keep min-h-[2.3em]">
            {t1}
            {cursorSegment === 'line1' && <Cursor />}
            <br />
            {tBold && (
                <span className="font-extrabold text-white light:text-black">
                    {tBold}
                </span>
            )}
            {cursorSegment === 'bold' && <Cursor />}
            {t2Pre}
            {cursorSegment === 'line2Pre' && <Cursor />}
            <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#a78bfa] via-[#f472b6] to-[#a78bfa] animate-shine bg-[length:200%_auto] tracking-normal py-1">
                {tHl}
            </span>
            {cursorSegment === 'hl' && <Cursor />}
            {tSuf}
            {cursorSegment === 'suffix' && <Cursor />}
        </h2>
    );
};

export default function PerformanceList({ initialPerformances, lastUpdated, initialGenre = 'all', isCategoryPage = false, categoryLabel }: PerformanceListProps) {
    // Debug first few OTT items
    useEffect(() => {
        const ottItems = initialPerformances.filter(p => p.genre === 'ott').slice(0, 3);
        console.log('[PerformanceList] Initial OTT Sample:', ottItems.map(p => ({ title: p.title, platforms: p.platforms })));
    }, [initialPerformances]);


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

    // Bottom Navigation State
    const [activeBottomMenu, setActiveBottomMenu] = useState<BottomMenuType>(null);
    const [viewMode, setViewMode] = useState<string>('grid'); // 'list' | 'grid' | 'calendar' | 'map' | 'likes-perf' | 'likes-venue'
    const [isMapOpen, setIsMapOpen] = useState(false); // Map Modal State

    // Debug Logging
    useEffect(() => {
        if (initialPerformances.length > 0 && initialPerformances[0].genre === 'volleyball') {
            console.log('[PerformanceList Debug] Received Volleyball Performances:', initialPerformances.length);
            console.log('[PerformanceList Debug] First Item Genre:', initialPerformances[0].genre);
            console.log('[PerformanceList Debug] Selected Region:', selectedRegion);
            console.log('[PerformanceList Debug] Selected Genre:', selectedGenre);
        } else if (initialGenre === 'volleyball') {
            console.log('[PerformanceList Debug] Genre is volleyball but initialPerformances is:', initialPerformances.length);
        }
    }, [initialPerformances, selectedRegion, initialGenre, selectedGenre]);

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
        setSelectedPerformance(perf);
        // Update URL without reload for sharing capability
        // const newUrl = new URL(window.location.href);
        // newUrl.searchParams.set('id', perf.id);
        // window.history.pushState({}, '', newUrl.toString());
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

    // Intersection Observer for Hero Section
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

        return () => observer.disconnect();
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

            if (candidate === heroText) continue;

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

        setHeroText(selectedTemplate);
        if (selectedTemplate.keywords) {
            setContextKeywords(selectedTemplate.keywords);
        }
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
        selectNextTemplate();
        // Since setHeroText updates state, TypingHero will react to the prop change in its effect
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
            const savedKeywords: string[] = JSON.parse(localStorage.getItem('culture_keywords') || '[]');
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


            // 5. Weather Check (Async)
            try {
                // 30% chance to consider weather heavily
                if (Math.random() < 0.3) {
                    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780&current_weather=true');
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

        loadState('culture_keywords', setSavedKeywords);
        loadState('culture_likes', setLikedIds);
        loadState('culture_favorite_venues', setFavoriteVenues);
        loadState('culture_likes_expanded', setIsLikesExpanded);
        loadState('culture_venues_expanded', setIsFavoriteVenuesExpanded);
        loadState('culture_show_favorite_venues', setShowFavoriteVenues);
        loadState('culture_show_likes', setShowLikes);
        loadState('culture_view_mode', setViewMode);

        setIsStorageLoaded(true);
        // Delay to allow content to render before removing skeleton
        setTimeout(() => setIsInitialLoading(false), 100);
    }, []);

    useEffect(() => {
        if (!isStorageLoaded) return;
        localStorage.setItem('culture_keywords', JSON.stringify(savedKeywords));
    }, [savedKeywords, isStorageLoaded]);

    useEffect(() => {
        if (!isStorageLoaded) return;
        localStorage.setItem('culture_show_favorite_venues', JSON.stringify(showFavoriteVenues));
    }, [showFavoriteVenues, isStorageLoaded]);

    useEffect(() => {
        if (!isStorageLoaded) return;
        localStorage.setItem('culture_show_likes', JSON.stringify(showLikes));
    }, [showLikes, isStorageLoaded]);

    useEffect(() => {
        if (!isStorageLoaded) return;
        localStorage.setItem('culture_view_mode', JSON.stringify(viewMode));
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
    // Favorite Venues State
    // [State moved to top]

    // Initial Load for Favorite Venues Expanded State
    // Initial Load for Favorite Venues Expanded State (Removed - handled by consolidated loader)

    // Persist Favorite Venues Expanded State
    useEffect(() => {
        if (!isStorageLoaded) return;
        localStorage.setItem('culture_venues_expanded', JSON.stringify(isFavoriteVenuesExpanded));
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
        }
    };

    const [userAddress, setUserAddress] = useState<string>('');

    // 📍 Handle Current Location Click
    const handleCurrentLocationClick = () => {
        if (!navigator.geolocation) {
            alert("브라우저가 위치 정보를 지원하지 않습니다.");
            return;
        }

        setIsSearching(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setUserLocation({ lat: latitude, lng: longitude });
                setSearchLocation(null); // Clear manual search
                setRadius(5); // Default radius 5km

                // Reverse Geocoding (Coord -> Address)
                if (window.kakao && window.kakao.maps && window.kakao.maps.services) {
                    const geocoder = new window.kakao.maps.services.Geocoder();
                    geocoder.coord2Address(longitude, latitude, (result: any[], status: any) => {
                        if (status === window.kakao.maps.services.Status.OK) {
                            const addr = result[0].road_address ? result[0].road_address.address_name : result[0].address.address_name;
                            // Shorten address to Region + District (e.g., '서울시 성동구')
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
            const v = venues[p.venue || ''];
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
            localStorage.setItem('culture_keywords', JSON.stringify(updated));
        }
    };

    const handleKeywordRemove = (keyword: string) => {
        const updated = savedKeywords.filter(k => k !== keyword);
        setSavedKeywords(updated);
        localStorage.setItem('culture_keywords', JSON.stringify(updated));
    };

    // --- Bottom Nav Wrapper Handlers ---


    const handleViewModeChange = (mode: string) => {
        setViewMode(mode);
        // Don't scroll to top for calendar and map modes - they are layer popups
        if (mode !== 'calendar' && mode !== 'map') {
            scrollToTop();
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

        // Search Filter
        if (searchText) {
            console.log(`[Search Debug] Searching for: ${searchText}`);
            const lowerSearch = searchText.toLowerCase().normalize('NFC');
            filtered = filtered.filter(p => {
                if (p.title.includes('상상체험')) {
                    const titleTitle = p.title.toLowerCase().normalize('NFC');
                    const match = titleTitle.includes(lowerSearch);
                    console.log(`[Search Debug] Checking Item: ${p.title} (${p.genre}) -> Match? ${match}`);
                }
                return p.title.toLowerCase().normalize('NFC').includes(lowerSearch) ||
                    p.venue.toLowerCase().normalize('NFC').includes(lowerSearch) ||
                    (p.cast && (Array.isArray(p.cast) ? p.cast.join(' ') : p.cast).toLowerCase().normalize('NFC').includes(lowerSearch))
            });
        }

        // Genre Filter
        if (selectedGenre !== 'all') {
            if (selectedGenre === 'hotdeal') {
                filtered = filtered.filter(p => p.discount && p.discount !== '' && p.discount !== '0');
            } else {
                filtered = filtered.filter(p => p.genre === selectedGenre);
            }
        }

        // Region Filter
        if (selectedRegion !== 'all') {
            const beforeRegionCount = filtered.length;
            filtered = filtered.filter(p => {
                // 1. Trust server-side region assignment if available
                if (p.region === selectedRegion) return true;

                const venueInfo = venues[p.venue];
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
        if (['volleyball', 'basketball', 'baseball', 'handball', 'soccer'].includes(selectedGenre)) {
            return [...basePerformances].sort((a, b) => {
                // Remove (Time) or ~ range for comparison
                const dateA = (a.date || '').split('(')[0].split('~')[0].trim();
                const dateB = (b.date || '').split('(')[0].split('~')[0].trim();
                return dateA.localeCompare(dateB);
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
            <header className="relative z-[150] bg-transparent backdrop-blur-none border-b border-transparent light:border-transparent">
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
                "absolute top-16 sm:top-20 left-0 right-0 bg-[#1a0b2e]/95 light:bg-white/95 backdrop-blur-3xl border-b border-purple-500/20 light:border-black/5 shadow-2xl transition-all duration-300 ease-out overflow-hidden origin-top z-[200]",
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

            {/* Hero Section */}
            <div className={clsx(
                "relative max-w-7xl 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-10 flex flex-col lg:flex-row justify-between lg:items-end gap-8",
                (isDropdownOpen && activeSearchSource === 'hero') ? "z-[120]" : "z-[60]"
            )}>
                <div className="text-left flex-1 min-w-0 z-10">
                    {selectedGenre !== 'movie' && selectedGenre !== 'ott' && (
                        <p className="text-[#a78bfa] font-bold mb-3 flex items-center gap-2 text-sm md:text-base">
                            <button
                                onClick={handleCurrentLocationClick}
                                className="flex items-center gap-1 hover:text-white light:hover:text-purple-600 transition-colors group/label mr-2"
                                title="내 위치 찾기"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-[#a78bfa] light:text-purple-600 group-hover/label:scale-110 transition-transform"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" /><path d="M12 12m-8 0a8 8 0 1 0 16 0a8 8 0 1 0 -16 0" /><path d="M12 2l0 2" /><path d="M12 20l0 2" /><path d="M20 12l2 0" /><path d="M2 12l2 0" /></svg>
                                <span>
                                    {(selectedRegion !== 'all' || selectedVenue !== 'all')
                                        ? '설정위치 :'
                                        : (activeLocation ? (searchLocation ? '검색위치 :' : '현재위치 :') : '현재위치 :')
                                    }
                                </span>
                            </button>
                            <span
                                onClick={() => setIsHeroFilterExpanded(prev => !prev)}
                                className="text-white light:text-black border-b border-[#a78bfa] cursor-pointer hover:border-white transition-colors"
                            >
                                {(activeLocation && selectedRegion === 'all' && selectedVenue === 'all') // Show GPS/Search if NO manual filter
                                    ? (searchLocation ? searchLocation.name : (userAddress ? `${userAddress} (GPS)` : '내 위치 (GPS)'))
                                    : (
                                        (selectedRegion !== 'all' || selectedVenue !== 'all')
                                            ? `${selectedRegion !== 'all' ? REGIONS.find(r => r.id === selectedRegion)?.label || '' : ''} ${selectedDistrict !== 'all' ? selectedDistrict : ''} ${selectedVenue !== 'all' ? selectedVenue : ''}`.trim() || '전체 지역'
                                            : '전체 지역'
                                    )
                                }
                            </span>

                            {/* Expand Filter Button */}
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

                            {/* Reset Location Button */}
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
                        <div className="mt-2 mb-4 animate-in fade-in slide-in-from-top-2 duration-300 origin-top relative w-full bg-[#1a0b2e]/95 light:bg-white/95 backdrop-blur-3xl border border-purple-500/20 light:border-black/5 shadow-2xl rounded-2xl z-[60]">
                            {/* Inner content wrapper - Removed overflow-hidden from parent and added generous padding here */}
                            <div className="w-full xl:w-auto flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-center overflow-x-visible p-6">

                                {/* Venue Select */}
                                <div className="relative shrink-0 w-full sm:w-auto">
                                    <select
                                        value={selectedVenue}
                                        onChange={(e) => setSelectedVenue(e.target.value)}
                                        className="w-full sm:w-40 appearance-none bg-purple-900/20 light:bg-purple-50 border border-purple-500/20 light:border-purple-200 text-gray-200 light:text-purple-900 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-2.5 pr-8 transition-colors font-medium"
                                    >
                                        <option value="all">전체 공연장</option>
                                        {availableVenues.map(v => (
                                            <option key={v} value={v} className="bg-gray-900 text-white light:bg-white light:text-black">{v}</option>
                                        ))}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                    </div>
                                </div>

                                {/* Region Buttons Filter Group */}
                                <div className="flex bg-gray-900/80 light:bg-gray-100/80 rounded-full p-1 shrink-0 overflow-x-auto scrollbar-hide w-full sm:w-auto justify-between sm:justify-start border border-white/10 light:border-black/5">
                                    {(selectedGenre === 'festival' ? NATIONWIDE_REGIONS : REGIONS).map(r => (
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
                                                    ? 'bg-white light:bg-white text-black light:text-purple-700 font-bold shadow-lg mix-blend-normal light:shadow-sm light:border light:border-purple-100'
                                                    : 'text-gray-400 light:text-gray-500 hover:text-white light:hover:text-black hover:bg-white/10 light:hover:bg-black/5'
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
                                            className="w-full sm:w-32 appearance-none bg-purple-900/20 light:bg-purple-50 border border-purple-500/20 light:border-purple-200 text-gray-200 light:text-purple-900 text-sm rounded-xl focus:bg-gray-800 light:focus:bg-white focus:border-white/20 block p-2.5 pr-8 transition-colors font-medium"
                                        >
                                            <option value="all">전체 지역</option>
                                            {districts.map(d => (
                                                <option key={d} value={d} className="bg-gray-900 text-white light:bg-white light:text-black">{d}</option>
                                            ))}
                                        </select>
                                        <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    {/* Hero Text: 2 lines on PC, 4 lines on Mobile */}
                    {/* Hero Text: Dynamic */}
                    {/* Hero Text: Dynamic */}
                    {/* Hero Text: Dynamic */}
                    {/* Hero Text: Dynamic */}
                    {/* Hero Text: Dynamic */}
                    {/* Hero Text Logic Extraction */}
                    {(() => {
                        // Dynamic title messages for likes-perf
                        const likesPerfMessages = [
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
                        const likesVenueMessages = [
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

                        // Pick a random message (seeded by current minute for variety but stability)
                        const minuteSeed = new Date().getMinutes();
                        const perfMsg = likesPerfMessages[minuteSeed % likesPerfMessages.length];
                        const venueMsg = likesVenueMessages[minuteSeed % likesVenueMessages.length];

                        // Category-specific emotional messages with boldPrefix for category name
                        const genreMessages: Record<string, { line1: string; boldPrefix?: string; line2Pre: string; highlight: string; suffix: string }[]> = {
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
                            theater: [
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
                            football: [
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

                        // Get genre-specific message
                        const genreMsg = selectedGenre !== 'all' && genreMessages[selectedGenre]
                            ? genreMessages[selectedGenre][minuteSeed % genreMessages[selectedGenre].length]
                            : null;

                        const currentTemplate = viewMode === 'likes-perf' ? {
                            ...perfMsg,
                            keywords: [],
                            boldPrefix: undefined
                        } as HeroTemplate : viewMode === 'likes-venue' ? {
                            ...venueMsg,
                            keywords: [],
                            boldPrefix: undefined
                        } as HeroTemplate : genreMsg ? {
                            ...genreMsg,
                            keywords: []
                        } as HeroTemplate : searchText ? {
                            line1: "찾으시는 공연,",
                            line2Pre: "입력하신 ",
                            highlight: `"${searchText.replace(/^.*? \d+(?:-\d+)?\s*/, '').replace(/\(.*\)/, '').trim()}"`,
                            suffix: " 키워드로 정리해드릴게요.",
                            keywords: [],
                            boldPrefix: undefined
                        } as HeroTemplate : (selectedRegion !== 'all' || selectedVenue !== 'all') ? {
                            line1: "현재,",
                            boldPrefix: `${[
                                selectedRegion !== 'all' ? REGIONS.find(r => r.id === selectedRegion)?.label : '',
                                selectedDistrict !== 'all' ? selectedDistrict : '',
                                selectedVenue !== 'all' ? selectedVenue : ''
                            ].filter(Boolean).join(' ')}`,
                            line2Pre: "에서 진행중인 ",
                            highlight: "공연",
                            suffix: "들을 찾아줄게요.",
                            keywords: []
                        } : heroText;

                        return (
                            <>
                                <div ref={heroRef}>
                                    <TypingHero
                                        template={currentTemplate}
                                        onCycle={handleHeroCycle}
                                        paused={!isHeroVisible || !['list', 'grid', 'likes-perf', 'likes-venue'].includes(viewMode)}
                                    />
                                </div>
                                {/* Mobile: Dynamic (Simplified Layout) */}
                                <h2 className="text-4xl font-light text-white light:text-black leading-[1.2] tracking-tighter block sm:hidden">
                                    {currentTemplate.line1}<br />
                                    {currentTemplate.boldPrefix && (
                                        <>
                                            <span className="font-extrabold text-white light:text-black">{currentTemplate.boldPrefix}</span>
                                            {/* No BR here, let it flow or add space? Design usually flows. */}
                                            {/* But template structure implies distinct segments. */}
                                            {/* line2Pre usually follows immediately. */}
                                        </>
                                    )}
                                    {currentTemplate.line2Pre}
                                    <span className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#a78bfa] via-[#f472b6] to-[#a78bfa] animate-shine bg-[length:200%_auto] tracking-normal py-1">
                                        {currentTemplate.highlight}
                                    </span><br />
                                    {currentTemplate.suffix}
                                </h2>
                            </>
                        );
                    })()}
                    {/* Mobile: Dynamic (Simplified Layout) */}

                    <div className="text-xs text-gray-500 font-mono mt-2 tracking-tighter">
                        {lastUpdated} 기준
                    </div>
                </div>

                {/* Hero Search Bar */}
                <div className="w-full lg:w-auto relative group z-[60]">
                    {/* Light Mode: Subtle Purple Glow Behind Search Bar */}
                    <div className="hidden light:block absolute -inset-4 bg-gradient-to-r from-purple-400/20 via-pink-400/15 to-purple-400/20 blur-2xl rounded-full opacity-70 pointer-events-none" />
                    <div className="p-[3px] rounded-full bg-linear-to-r from-[#a78bfa] via-purple-500 to-[#f472b6] opacity-100 light:shadow-[0_4px_30px_rgba(168,85,247,0.25)]">
                        <div className="bg-[#0a0a0a] light:bg-white rounded-full flex items-center p-1 relative mix-blend-hard-light light:mix-blend-normal">
                            {/* Radius Select for Hero */}
                            {activeLocation && (
                                <div className="border-r border-gray-700 light:border-gray-300 pr-0 mr-2 ml-3 relative flex items-center">
                                    <div className="pointer-events-none absolute right-2 flex flex-col items-center justify-center opacity-70">
                                        <ChevronUp className="w-2 h-2 text-gray-400" />
                                        <ChevronDown className="w-2 h-2 text-gray-400" />
                                    </div>
                                    <select
                                        value={radius}
                                        onChange={(e) => setRadius(Number(e.target.value))}
                                        className="bg-transparent text-[#a78bfa] text-sm font-bold focus:outline-none cursor-pointer appearance-none pl-1 pr-6 py-2"
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
                                className="bg-transparent border-none text-white light:text-black text-lg font-bold px-4 py-3 w-full lg:w-[350px] focus:outline-none placeholder-gray-600 caret-white light:caret-black"
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
            <div className={clsx(
                "sticky top-[60px] md:top-[0px] z-[50] transition-all duration-300 transform",
                isSticky ? "translate-y-0 opacity-100 pointer-events-auto" : "-translate-y-4 opacity-0 pointer-events-none h-0 overflow-hidden"
            )}>
                <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
                <div className="bg-[#0f1115]/90 light:bg-white/95 backdrop-blur-xl border-b border-white/5 light:border-black/5 shadow-2xl">
                    <div className="max-w-7xl 2xl:max-w-[1800px] mx-auto px-4 py-3 flex items-center gap-3">
                        {/* 1. Home / Refresh */}
                        <button
                            onClick={() => {
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                                setSelectedGenre('all');
                                setSelectedRegion('all');
                                setSelectedDistrict('all');
                                setSelectedVenue('all');
                                setSearchText('');
                                setSearchLocation(null);
                                setUserLocation(null);
                            }}
                            className="p-2.5 rounded-full bg-gray-800/50 hover:bg-gray-800 text-gray-400 hover:text-white transition-colors border border-white/5 light:bg-gray-100 light:text-gray-600 light:hover:bg-gray-200 light:border-gray-200"
                        >
                            <Home size={18} />
                        </button>

                        {/* 2. Search Input (Compact) */}
                        <div className="flex-1 max-w-lg relative group">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <Search className="w-4 h-4 text-gray-500 group-focus-within:text-[#a78bfa] transition-colors" />
                            </div>
                            <input
                                type="text"
                                className="block w-full pl-10 pr-3 py-2.5 bg-gray-900/50 light:bg-gray-100 border border-white/10 light:border-gray-200 rounded-full leading-5 text-gray-300 light:text-gray-900 placeholder-gray-600 focus:outline-none focus:bg-gray-900 focus:border-[#a78bfa]/50 transition-all text-sm font-medium"
                                placeholder={searchLocation?.name || userAddress ? `${searchLocation?.name || userAddress} 주변 검색...` : "공연, 배우, 장소 검색..."}
                                value={searchText}
                                onChange={handleSearchTextChange}
                                onKeyDown={handleKeyDown}
                                onFocus={() => setActiveSearchSource('sticky')}
                            />
                            {/* Sticky Dropdown Positioned Here */}
                            {isDropdownOpen && activeSearchSource === 'sticky' && searchResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-3 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl z-[9999] overflow-hidden max-h-[60vh] overflow-y-auto">
                                    {searchResults.map((result, idx) => {
                                        const addressParts = result.address ? result.address.split(' ') : [];
                                        const shortAddress = addressParts.length >= 2 ? `${addressParts[0]} ${addressParts[1]}` : result.address;
                                        return (
                                            <div
                                                key={`search-sticky-${idx}`}
                                                onClick={() => handleSelectResult(result)}
                                                className={`px-4 py-3 cursor-pointer flex items-center justify-between gap-3 border-b border-white/5 last:border-0 transition-colors ${idx === highlightedIndex ? 'bg-white/20' : 'bg-[#1a1a1a] hover:bg-white/10'}`}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="bg-black/50 p-2 rounded-full shrink-0 border border-white/10">
                                                        {result.type === 'video' ? <Star className="w-3.5 h-3.5 text-yellow-500" /> : <MapPin className="w-3.5 h-3.5 text-[#a78bfa]" />}
                                                    </div>
                                                    <div className="text-white text-sm font-bold truncate">{result.name}</div>
                                                </div>
                                                <div className="text-gray-500 text-xs whitespace-nowrap shrink-0">{shortAddress}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* 3. Category Scroll (Compact) */}
                        <div className="flex-1 overflow-x-auto scrollbar-hide flex gap-2 mask-linear-fade">
                            {GENRES.map(genre => (
                                <button
                                    key={genre.id}
                                    onClick={() => setSelectedGenre(genre.id)}
                                    className={clsx(
                                        "whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-all border",
                                        selectedGenre === genre.id
                                            ? "bg-[#a78bfa] text-white border-[#a78bfa]"
                                            : "bg-gray-800/50 text-gray-400 border-white/10 hover:bg-gray-800 light:bg-gray-50 light:text-gray-600 light:border-gray-200"
                                    )}
                                >
                                    {genre.label}
                                    {/* Count badge could go here if available efficiently */}
                                </button>
                            ))}
                        </div>

                        {/* 4. Map/List Toggle */}
                        <button
                            onClick={() => setIsMapOpen(true)}
                            className="p-2.5 rounded-full bg-[#a78bfa]/20 hover:bg-[#a78bfa] text-[#a78bfa] hover:text-white transition-all border border-[#a78bfa]/30 shrink-0"
                        >
                            <MapIcon size={18} />
                        </button>
                    </div>
                </div>
            </div>


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
            <div className="max-w-7xl 2xl:max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 relative z-30">
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
                                            찜한공연장 목록
                                        </button>
                                    </>
                                ) : activeLocation ? (
                                    <>
                                        <MapPin className="text-green-500 w-5 h-5" />
                                        <span className="truncate max-w-[150px] sm:max-w-xs">
                                            {searchLocation ? `'${searchLocation.name}'` : (userAddress || '내 위치')}
                                        </span>
                                        <span className="text-base sm:text-xl shrink-0">주변 ({displayPerformances.length})</span>
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
                    {isInitialLoading ? (
                        <SkeletonGrid count={12} isListMode={layoutMode === 'list'} />
                    ) : (
                        <>

                            {displayPerformances.length > 0 ? (
                                <div
                                    key="grid-container"
                                    className={clsx(
                                        "w-full",
                                        layoutMode === 'grid'
                                            ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-6"
                                            : "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 sm:gap-6"
                                    )}
                                >
                                    {displayPerformances.slice(0, visibleCount).map((perf, index) => {
                                        // Venue Info
                                        const venueInfo = venues[perf.venue];

                                        const dist = activeLocation && venueInfo?.lat && venueInfo?.lng
                                            ? getDistanceFromLatLonInKm(activeLocation.lat, activeLocation.lng, venueInfo.lat, venueInfo.lng)
                                            : null;
                                        const distLabel = dist !== null ? `${dist.toFixed(1)}km` : null;

                                        return (
                                            <div
                                                key={`${perf.id}-${perf.region}`}
                                                className={clsx(layoutMode === 'grid' ? "h-full w-full" : "w-full", (selectedVenue !== 'all' && perf.venue !== selectedVenue && (index === 0 || displayPerformances[index - 1].venue === selectedVenue)) ? "col-span-full pt-8" : "")}
                                            >
                                                {/* Split List Header */}
                                                {(selectedVenue !== 'all' && perf.venue !== selectedVenue && (index === 0 || displayPerformances[index - 1].venue === selectedVenue)) && (
                                                    <div className="w-full h-px relative bg-gradient-to-r from-transparent via-[#a78bfa]/50 to-transparent mb-8 flex items-center justify-center">
                                                        <span className="bg-[#0f1115] px-4 text-[#a78bfa] text-sm font-bold tracking-widest uppercase">
                                                            Nearby Recommendations
                                                        </span>
                                                    </div>
                                                )}
                                                {layoutMode === 'grid' ? (
                                                    <PerformanceCard
                                                        perf={perf}
                                                        distLabel={distLabel}
                                                        venueInfo={venueInfo}
                                                        onLocationClick={(loc) => {
                                                            setSearchLocation(loc);
                                                            setIsMapOpen(true);
                                                        }}
                                                        isLiked={likedIds.includes(perf.id)}
                                                        onToggleLike={(e) => toggleLike(perf.id, e)}
                                                        // Logic Update: 
                                                        // - Ribbon: REMOVE from here (pass false)
                                                        // - Gradient: KEEP for general recommended lists
                                                        // - Actions: ENABLE for these lists
                                                        showRibbon={false}
                                                        isGradient={selectedGenre === 'all' && !activeLocation && viewMode !== 'likes-perf' && viewMode !== 'likes-venue'}
                                                        enableActions={true}
                                                        onShare={() => copyItemShareUrl(perf.id)}
                                                        onDetail={() => handleDetailOpen(perf)}
                                                    />
                                                ) : (
                                                    <PerformanceListItem
                                                        perf={perf}
                                                        distLabel={distLabel}
                                                        venueInfo={venueInfo}
                                                        onLocationClick={(loc) => {
                                                            setSearchLocation(loc);
                                                            setIsMapOpen(true);
                                                        }}
                                                        isLiked={likedIds.includes(perf.id)}
                                                        onToggleLike={(e) => toggleLike(perf.id, e)}
                                                        onShare={() => copyItemShareUrl(perf.id)}
                                                        onDetail={() => handleDetailOpen(perf)}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                /* Empty State */
                                <div
                                    key="empty-state"
                                    className="flex flex-col items-center justify-center py-10 text-gray-500 w-full text-center px-4"
                                >
                                    {viewMode === 'likes-perf' ? (
                                        <>
                                            <div className="w-20 h-20 rounded-full bg-pink-500/10 flex items-center justify-center mb-6">
                                                <Heart className="w-10 h-10 text-pink-500/50" />
                                            </div>
                                            <h3 className="text-xl font-bold text-pink-400 mb-2">좋아요한 컨텐츠가 없네요</h3>
                                            <p className="text-gray-500">마음에 드는 컨텐츠에 하트를 눌러보세요!</p>
                                        </>
                                    ) : viewMode === 'likes-venue' ? (
                                        <>
                                            <div className="w-20 h-20 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6">
                                                <Star className="w-10 h-10 text-emerald-500/50" />
                                            </div>
                                            <h3 className="text-xl font-bold text-emerald-400 mb-2">찜한 공연장이 없네요</h3>
                                            <p className="text-gray-500 mb-6">자주 가는 공연장을 등록하고 일정을 확인해보세요.</p>
                                            <button
                                                onClick={() => setIsMapOpen(true)}
                                                className="px-6 py-2.5 rounded-full bg-emerald-500/20 text-emerald-500 font-bold hover:bg-emerald-500 hover:text-black transition-all"
                                            >
                                                지도에서 찾기
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-16 h-16 mb-6 opacity-20 icon icon-tabler icons-tabler-outline icon-tabler-calendar-time"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M11.795 21h-6.795a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v4" /><path d="M14 18a4 4 0 1 0 8 0a4 4 0 1 0 -8 0" /><path d="M15 3v4" /><path d="M7 3v4" /><path d="M3 11h16" /><path d="M18 16.496v1.504l1 1" /></svg>
                                            <h3 className="text-xl font-bold text-gray-300 mb-2">
                                                {(selectedGenre === 'baseball' || selectedGenre === 'soccer')
                                                    ? '현재 경기 일정이 없습니다.'
                                                    : '조건에 맞는 공연이 없습니다.'}
                                            </h3>
                                            <p className="text-gray-500 mb-6">다른 검색어나 필터를 사용해보세요.</p>
                                            <div className="flex flex-col gap-3 items-center">
                                                <button onClick={() => {
                                                    setSelectedRegion('all');
                                                    setSelectedDistrict('all');
                                                    setSearchText('');
                                                    setUserLocation(null);
                                                    // Keep selectedGenre unchanged
                                                }} className="px-6 py-2.5 rounded-full bg-blue-500/20 text-blue-400 font-bold hover:bg-blue-500 hover:text-white transition-all">
                                                    필터 초기화
                                                </button>
                                                <a href="/culture/" className="px-6 py-2.5 rounded-full bg-gray-500/20 text-gray-400 font-bold hover:bg-gray-500 hover:text-white transition-all">
                                                    홈으로 가기
                                                </a>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Sentinel for Infinite Scroll - Only in List Mode */}
                {
                    (viewMode === 'list' || viewMode === 'grid') && visibleCount < displayPerformances.length && (
                        <div ref={observerTarget} className="h-20 flex items-center justify-center opacity-50">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                        </div>
                    )
                }
            </div >

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



            {/* Bottom Navigation Sheet */}
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

            {/* Fixed Bottom Navigation Bar */}
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
    );
}


// ---------------------------
// 📋 List View Item Component (Updated with Tilt/Shadow)
// ---------------------------
function PerformanceListItem({ perf, distLabel, venueInfo, onLocationClick, isLiked = false, onToggleLike, variant = 'default', onShare, onDetail }: { perf: any, distLabel: string | null, venueInfo: any, onLocationClick: (loc: any) => void, isLiked?: boolean, onToggleLike?: (e: React.MouseEvent) => void, variant?: 'default' | 'yellow' | 'pink' | 'emerald', onShare?: () => Promise<boolean>, onDetail?: () => void }) {
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
                : "border-white/5 hover:border-white/20 light:border-black/5 light:hover:border-black/10 shadow-xl hover:shadow-2xl light:shadow-none light:hover:shadow-none bg-gray-900 light:bg-white";

    // Content background for colored variants
    const contentBgStyle = variant === 'emerald'
        ? "bg-emerald-950/40"
        : variant === 'pink'
            ? "bg-pink-950/40"
            : variant === 'yellow'
                ? "bg-yellow-950 light:bg-yellow-100"
                : ""; // Default: transparent (no bg class)

    return (
        <div
            className="perspective-1000 group relative hover:z-[9999]"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            <div
                ref={cardRef}
                className={clsx(
                    "relative transition-transform duration-100 ease-out transform-style-3d rounded-xl overflow-hidden flex border backface-hidden",
                    outerVariantStyle
                )}
                style={{
                    transformStyle: 'preserve-3d',
                    WebkitMaskImage: '-webkit-radial-gradient(white, black)', // Force proper clipping on Safari/Chrome
                }}
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
                <div className="relative w-32 sm:w-48 shrink-0 aspect-[3/4] overflow-hidden isolate z-0">
                    <ImageWithFallback
                        src={perf.image}
                        optimizationWidth={200}
                        alt={perf.title}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                        sizes="(max-width: 640px) 128px, 192px"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />

                    {/* Sports Team Logos Overlay (List View) */}
                    {['volleyball', 'basketball', 'baseball', 'handball', 'hockey', 'soccer'].includes(perf.genre) && perf.homeTeam && perf.awayTeam && (
                        <div className="absolute top-1/2 left-0 w-full -translate-y-1/2 flex justify-between px-2 items-center z-20 pointer-events-none">
                            <img src={perf.genre === 'baseball' && FUTURES_TEAM_LOGOS[perf.homeTeam] ? FUTURES_TEAM_LOGOS[perf.homeTeam] : perf.homeTeamLogo} alt={perf.homeTeam} className="w-16 h-16 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
                            <div className="text-white/90 font-black text-sm italic bg-black/50 px-2 py-0.5 rounded backdrop-blur-[2px]">VS</div>
                            <img src={perf.genre === 'baseball' && FUTURES_TEAM_LOGOS[perf.awayTeam] ? FUTURES_TEAM_LOGOS[perf.awayTeam] : perf.awayTeamLogo} alt={perf.awayTeam} className="w-16 h-16 object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]" />
                        </div>
                    )}

                    {/* Distance Badge on Image */}
                    {distLabel && (
                        <div className="absolute bottom-1 right-1 bg-black/80 text-green-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-green-500/30 backdrop-blur-md z-[60]">
                            {distLabel}
                        </div>
                    )}

                    {/* OTT Platforms on Image (List View) */}
                    {perf.platforms && perf.platforms.length > 0 && (
                        <div className="absolute bottom-1 right-1 flex gap-1 z-[60]">
                            {perf.platforms.map((p: string) => {
                                const platformInfo = OTT_PLATFORMS[p];
                                if (!platformInfo) return null;
                                const url = platformInfo.url.replace('{title}', encodeURIComponent(perf.title));
                                return (
                                    <a
                                        key={p}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className={clsx(
                                            "w-6 h-6 flex items-center justify-center rounded-md text-[10px] font-black uppercase hover:scale-110 transition-transform shadow-md text-white border border-white/10",
                                            platformInfo.color
                                        )}
                                        title={`${platformInfo.label}에서 검색`}
                                    >
                                        {platformInfo.label.substring(0, 1)}
                                    </a>
                                );
                            })}
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
                        onClick={async (e) => {
                            e.stopPropagation();
                            if (onShare) {
                                const usedClipboard = await onShare();
                                if (usedClipboard) {
                                    setIsCopied(true);
                                    setTimeout(() => setIsCopied(false), 2000);
                                }
                            }
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
                                genreStyle.twBg ? `${genreStyle.twBg} text-white border-white/10` : 'bg-gray-800 text-gray-400 border-gray-700'
                            )}>
                                {GENRES.find(g => g.id === perf.genre)?.label || perf.genre}
                            </span>

                            {/* Date - Condensed */}
                            <span className={clsx(
                                "text-[10px] sm:text-xs flex items-center gap-1 ml-auto sm:ml-0",
                                variant === 'yellow' ? "text-gray-400 light:text-black light:font-bold" : "text-gray-400 light:text-black"
                            )}>
                                <Calendar className="w-3 h-3" />
                                {perf.date ? perf.date.split('~')[0].trim() : '상시'}
                            </span>
                        </div>

                        <a href={perf.link} target="_blank" rel="noopener noreferrer" className="block group/link" onClick={e => e.stopPropagation()}>
                            <h3 className={clsx(
                                "text-lg sm:text-xl font-bold leading-tight mb-1 group-hover/link:text-[#a78bfa] transition-colors line-clamp-5",
                                variant === 'yellow' ? "text-white light:text-black light:font-extrabold" : "text-white light:text-black"
                            )}>
                                {perf.title.replace(/^\[야구\]\s*/, '').trim()}
                            </h3>
                        </a>

                        <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-400 light:text-black mt-1">

                            {perf.genre === 'movie' || perf.genre === 'ott' ? (
                                <div className="text-gray-400 text-xs flex items-center gap-1 mb-2 truncate">
                                    {perf.gradeIcon ? (
                                        <img src={perf.gradeIcon} alt="Grade" className="h-[18px] w-auto object-contain" />
                                    ) : (
                                        <>
                                            <span className="text-cyan-400 font-bold border border-cyan-400/30 px-1 rounded text-[10px]">등급</span>
                                            {perf.grade || perf.venue.split('|').find((s: string) => s.includes('관람'))?.trim() || perf.venue}
                                        </>
                                    )}
                                </div>
                            ) : perf.genre === 'travel' ? (
                                <div className="text-gray-400 light:text-black text-xs flex flex-col gap-0.5 mb-2 truncate">
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
                                    className="hover:text-white light:hover:text-purple-600 hover:underline truncate text-gray-400 light:text-black text-xs flex items-center gap-1 mb-2"
                                >
                                    <MapPin className="w-3 h-3 flex-shrink-0" />
                                    <span className={clsx("truncate", variant === 'yellow' && "light:font-bold")}>{perf.venue}</span>
                                </button>
                            )}
                        </div>

                        {/* Movie & OTT Metadata (Cast, Director, Info) */}
                        {(perf.genre === 'movie' || perf.genre === 'ott') && (perf.cast || perf.director || perf.movieInfo) && (
                            <div className="mt-2 text-xs text-gray-400 light:text-gray-700 space-y-1 border-t border-white/5 light:border-black/5 pt-2">
                                {/* Director */}
                                {perf.director && (
                                    <div className="flex gap-2 items-start">
                                        <span className="text-gray-500 font-bold shrink-0">감독</span>
                                        <a
                                            href={`https://m.search.daum.net/search?w=tot&q=${encodeURIComponent(perf.director.replace('더보기', '').trim())}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-gray-300 light:text-black truncate hover:text-white light:hover:text-purple-600 hover:underline transition-colors"
                                            onClick={e => e.stopPropagation()}
                                        >
                                            {perf.director.replace('더보기', '').trim()}
                                        </a>
                                    </div>
                                )}
                                {/* Cast */}
                                {perf.cast && perf.cast.length > 0 && (
                                    <div className="flex gap-2 items-start">
                                        <span className="text-gray-500 font-bold shrink-0">출연</span>
                                        <div className="flex flex-wrap gap-x-1 leading-snug">
                                            {perf.cast.slice(0, 5).map((actor: string, idx: number) => {
                                                const cleanName = actor.replace('더보기', '').trim();
                                                if (!cleanName) return null;
                                                return (
                                                    <a
                                                        key={idx}
                                                        href={`https://m.search.daum.net/search?w=tot&q=${encodeURIComponent(cleanName)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-gray-300 light:text-black hover:text-white light:hover:text-purple-600 hover:underline transition-colors"
                                                        onClick={e => e.stopPropagation()}
                                                    >
                                                        {cleanName}{idx < Math.min(perf.cast.length, 5) - 1 ? ',' : ''}
                                                    </a>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                                {/* Provider (OTT) */}
                                {perf.platforms && perf.platforms.length > 0 && (
                                    <div className="flex gap-2 items-center">
                                        <span className="text-gray-500 font-bold shrink-0">제공</span>
                                        <div className="flex flex-wrap gap-1">
                                            {perf.platforms.map((p: string, idx: number) => {
                                                const key = typeof p === 'string' ? p.toLowerCase() : String(p);
                                                const platform = OTT_PLATFORMS[key];
                                                if (!platform) return null;

                                                const url = platform.url.replace('{title}', encodeURIComponent(perf.title));
                                                return (
                                                    <a
                                                        key={idx}
                                                        href={url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className={clsx(
                                                            "w-5 h-5 flex items-center justify-center rounded text-[9px] font-black uppercase hover:scale-110 transition-transform shadow-sm text-white border border-white/10",
                                                            platform.color
                                                        )}
                                                        onClick={(e) => e.stopPropagation()}
                                                        title={platform.label}
                                                    >
                                                        {platform.label.substring(0, 1)}
                                                    </a>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Info */}
                                {perf.movieInfo && (
                                    <div className="flex gap-2 items-start">
                                        <span className="text-gray-500 font-bold shrink-0">정보</span>
                                        <span className="text-gray-300 light:text-black line-clamp-1">{perf.movieInfo}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Price & Discount info for List View */}
                        {/* Price & Discount info for List View - Redesigned (11st Style) */}
                        {(perf.price || perf.discount) && (
                            <div className="flex flex-col mt-2 w-full border-t border-white/5 light:border-black/5 pt-2">
                                <div className="flex justify-between items-end">
                                    {/* Left: Discount */}
                                    <div className="flex flex-col">
                                        {perf.discount && perf.originalPrice && perf.originalPrice !== perf.price && (
                                            <div className="text-red-500">
                                                <span className="text-xl font-extrabold">{perf.discount.replace(/[^0-9]/g, '')}</span>
                                                <span className="text-sm font-light">%</span>
                                            </div>
                                        )}
                                    </div>
                                    {/* Right: Price */}
                                    <div className="flex flex-col items-end">
                                        {perf.originalPrice && perf.originalPrice !== perf.price && <span className={clsx("text-[10px] line-through mb-[-2px]", variant === 'yellow' ? "text-gray-500 light:text-gray-500" : "text-gray-500")}>{perf.originalPrice}</span>}
                                        {perf.price && (() => {
                                            const extracted = extractFirstPrice(perf.price);
                                            if (!extracted) return null;
                                            return (
                                                <div className={clsx(variant === 'yellow' ? "text-white light:text-black" : "text-white")}>
                                                    {extracted.price === '무료' ? (
                                                        <span className="text-lg font-extrabold">무료</span>
                                                    ) : (
                                                        <>
                                                            {extracted.label && <span className="text-[10px] text-gray-400 mr-1">{extracted.label}</span>}
                                                            <span className="text-lg font-extrabold">{extracted.price}</span>
                                                            <span className="text-xs font-light ml-0.5">원</span>
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })()}
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

                        {/* Detail View Button -> Direct Link */}
                        <div className="mt-3">
                            <a
                                href={perf.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className={clsx(
                                    "w-full py-2.5 transition-all flex items-center justify-center gap-1 text-xs sm:text-sm rounded-lg border",
                                    // Dark Mode: Subtle border/text
                                    "border-white/20 text-gray-400 hover:text-white hover:border-white/40 hover:bg-white/5",
                                    // Light Mode: Visible border/text
                                    "light:border-gray-400 light:text-gray-800 light:font-bold light:hover:border-black light:hover:text-black light:hover:bg-black/5"
                                )}
                            >
                                자세히 보기
                                <ChevronDown className="-rotate-90 w-3 h-3" />
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}


// ---------------------------
// 🌟 3D Tilt Card Component
// ---------------------------
function PerformanceCard({ perf, distLabel, venueInfo, onLocationClick, variant = 'default', isLiked = false, onToggleLike, showRibbon = false, enableActions = false, isGradient = false, onShare, onDetail }: { perf: any, distLabel: string | null, venueInfo: any, onLocationClick: (loc: any) => void, variant?: 'default' | 'yellow' | 'pink' | 'emerald', isLiked?: boolean, onToggleLike?: (e: React.MouseEvent) => void, showRibbon?: boolean, enableActions?: boolean, isGradient?: boolean, onShare?: () => Promise<boolean>, onDetail?: () => void }) {
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
        if (onDetail) {
            onDetail();
        } else if (!showActions) {
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
                        "relative transition-transform duration-100 ease-out sm:transform-style-3d shadow-xl light:shadow-none group-hover:shadow-[5px_30px_50px_-12px_rgba(0,0,0,1)] light:group-hover:shadow-none h-full rounded-[15px]",
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
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onToggleLike) onToggleLike(e);
                        }}
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
                                    <ImageWithFallback
                                        src={perf.image}
                                        optimizationWidth={400}
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
                                            onClick={async (e) => {
                                                e.stopPropagation();
                                                if (onShare) {
                                                    const usedClipboard = await onShare();
                                                    if (usedClipboard) {
                                                        setIsCopied(true);
                                                        setTimeout(() => setIsCopied(false), 2000);
                                                    }
                                                }
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
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (onDetail) onDetail();
                                            }}
                                            className="flex-1 bg-black/60 text-white hover:bg-black/90 backdrop-blur-md border border-white/20 py-3 rounded-[15px] flex items-center justify-center transition-all font-extrabold shadow-lg h-[50px] gap-2 text-sm"
                                        >
                                            자세히 보기
                                            <Search className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Content Section (Bottom, Yellow/Pink/Emerald) */}
                            <div className={clsx(
                                "relative flex-1 sm:transform-style-3d overflow-hidden p-4 flex flex-col min-h-0",
                                variant === 'yellow' ? "bg-yellow-400" : variant === 'emerald' ? "bg-emerald-500" : "bg-pink-500"
                            )} style={{ transform: 'translateZ(10px)' }}>

                                {/* Text Content Area */}
                                <button
                                    className="block group/link relative z-[100] text-left w-full"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onDetail) onDetail();
                                    }}
                                >
                                    <h3 className="font-bold text-lg text-black mb-1 line-clamp-2 group-hover:opacity-80 transition-opacity">
                                        {perf.title.replace(/^\[야구\]\s*/, '').trim()}
                                    </h3>
                                </button>

                                {perf.genre === 'movie' || perf.genre === 'ott' ? (
                                    <div className="text-gray-800 text-sm flex items-center gap-1 mb-2 w-max cursor-default">
                                        {perf.gradeIcon ? (
                                            <img src={perf.gradeIcon} alt="Grade" className="h-[20px] w-auto object-contain" />
                                        ) : (
                                            <>
                                                <span className="text-cyan-600 font-bold text-xs border border-cyan-600/30 px-1 rounded">등급</span>
                                                {perf.grade || perf.venue.split('|').find((s: string) => s.includes('관람'))?.trim() || perf.venue}
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
                                        <MapPin className="w-3 h-3 text-gray-700 flex-shrink-0" />
                                        <span className="truncate">{perf.venue}</span>
                                    </button>
                                )}
                                <div className="mt-auto mb-2">
                                    <div className="flex items-center gap-1.5 w-full">
                                        {perf.discount && <span className="text-rose-700 text-xl font-extrabold">{perf.discount}</span>}
                                        {perf.price && <span className="text-black text-xl font-black tracking-tighter">{perf.price}</span>}
                                        {perf.originalPrice && perf.originalPrice !== perf.price && <span className="text-gray-700/60 text-xs line-through">{perf.originalPrice}</span>}
                                    </div>
                                </div>
                                <div className="flex justify-between items-center border-t border-black/10 pt-2 text-black">
                                    <span className="text-white text-xs font-bold bg-black px-2 py-1 rounded whitespace-nowrap">
                                        {GENRES.find(g => g.id === perf.genre)?.label || perf.genre}
                                    </span>
                                    <span className="text-[13px] font-bold opacity-70">{perf.date}</span>
                                    {perf.platforms && perf.platforms.length > 0 && (
                                        <div className="flex gap-1 ml-2">
                                            {perf.platforms.map((p: string) => {
                                                const platformInfo = OTT_PLATFORMS[p];
                                                if (platformInfo) {
                                                    const url = platformInfo.url.replace('{title}', encodeURIComponent(perf.title));
                                                    return (
                                                        <a
                                                            key={p}
                                                            href={url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={(e) => e.stopPropagation()}
                                                            className={clsx("text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter text-white hover:opacity-80 transition-opacity",
                                                                platformInfo.color
                                                            )}
                                                            title={`${platformInfo.label}에서 검색`}
                                                        >
                                                            {platformInfo.label.substring(0, 1).toUpperCase()}
                                                        </a>
                                                    );
                                                }
                                                return (
                                                    <span key={p} className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter bg-gray-600 text-white">
                                                        {p.substring(0, 1).toUpperCase()}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        /* --- VARIANT: DEFAULT (Spotlight/Standard) --- */
                        <div className="relative h-full w-full">
                            <ImageWithFallback
                                src={perf.image}
                                optimizationWidth={400}
                                alt={perf.title}
                                fill
                                className="object-cover transition-transform duration-500 group-hover:scale-110 rounded-[15px]"
                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                loading="lazy"
                                referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent rounded-xl" />

                            {/* Volleyball/Basketball/Baseball/Handball/Hockey Team Logos Overlay */}
                            {['volleyball', 'basketball', 'baseball', 'handball', 'hockey'].includes(perf.genre) && perf.homeTeam && perf.awayTeam && (
                                <div className="absolute top-1/2 left-0 w-full -translate-y-1/2 flex justify-between px-6 items-center z-20 pointer-events-none" style={{ transform: 'translateZ(25px)' }}>
                                    <img src={perf.genre === 'baseball' && FUTURES_TEAM_LOGOS[perf.homeTeam] ? FUTURES_TEAM_LOGOS[perf.homeTeam] : perf.homeTeamLogo} alt={perf.homeTeam} className="w-24 h-24 object-contain drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]" />
                                    <div className="text-white/90 font-black text-xl italic bg-black/30 px-3 py-1 rounded-full backdrop-blur-[1px]">VS</div>
                                    <img src={perf.genre === 'baseball' && FUTURES_TEAM_LOGOS[perf.awayTeam] ? FUTURES_TEAM_LOGOS[perf.awayTeam] : perf.awayTeamLogo} alt={perf.awayTeam} className="w-24 h-24 object-contain drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]" />
                                </div>
                            )}

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


                            <div
                                className="absolute inset-x-0 bottom-0 z-[70] overflow-hidden rounded-[15px]"
                                style={{ transform: 'translateZ(30px)', transformStyle: 'preserve-3d' }}
                            >
                                <div className={clsx(
                                    "relative transition-transform duration-300 ease-out flex flex-col justify-end",
                                    enableActions
                                        ? (showActions ? "translate-y-0" : "translate-y-[55px] group-hover:translate-y-0")
                                        : ""
                                )}>
                                    {/* Discount Badge - Only specific variants or if high discount. Hide if no discount */}
                                    {perf.discountRate && perf.originalPrice && perf.originalPrice !== perf.price && (
                                        <div className="absolute top-2 right-2 z-40 bg-black/80 text-emerald-400 border border-emerald-400/30 px-2 py-1 rounded-full text-xs font-bold shadow-lg flex items-center gap-1 backdrop-blur-sm"
                                            style={{ transform: 'translateZ(20px)' }}>
                                            <Tag className="w-3 h-3 fill-emerald-400" />
                                            {perf.discountRate}
                                        </div>
                                    )}
                                    {/* Gradient Background Layer - spans full height of content */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent pointer-events-none" />

                                    {/* Performance Info */}
                                    <div className="relative z-10 p-4 pb-2">
                                        {/* Tags/Badges */}
                                        <div className="flex flex-wrap gap-2 mb-1.5">
                                            <span className={clsx(
                                                "px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md border shadow-sm transition-all text-white",
                                                GENRE_STYLES[perf.genre]?.twBg ? `${GENRE_STYLES[perf.genre].twBg} border-white/20` : 'bg-black/30 border-[#a78bfa]/50 text-[#a78bfa]'
                                            )}>
                                                {GENRES.find(g => g.id === perf.genre)?.label || perf.genre}
                                            </span>
                                            <span className="text-xs text-gray-300 flex items-center gap-1 font-medium">
                                                <Calendar className="w-3.5 h-3.5" />
                                                {(() => {
                                                    if (!perf.date) return '상시 관람';
                                                    const parts = perf.date.split('~').map((s: string) => s.trim());
                                                    return (parts.length === 2 && parts[0] === parts[1]) ? parts[0] : perf.date;
                                                })()}
                                                {/* Platform Icons (Default Variant) */}
                                                {perf.platforms && perf.platforms.length > 0 && (
                                                    <div className="flex gap-1 ml-2 border-l border-white/20 pl-2">
                                                        {perf.platforms.map((p: string) => {
                                                            const platformInfo = OTT_PLATFORMS[p];
                                                            const badgeClass = clsx(
                                                                "w-6 h-6 flex items-center justify-center rounded-md text-[10px] font-black uppercase cursor-pointer hover:scale-110 transition-transform shadow-md border border-white/10",
                                                                platformInfo ? platformInfo.color : "bg-gray-600"
                                                            );

                                                            // If platform info exists, make it a link
                                                            if (platformInfo) {
                                                                const url = platformInfo.url.replace('{title}', encodeURIComponent(perf.title));
                                                                return (
                                                                    <a
                                                                        key={p}
                                                                        href={url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className={clsx(badgeClass, "text-white no-underline")}
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        title={`${platformInfo.label}에서 검색`}
                                                                    >
                                                                        {platformInfo.label.substring(0, 1).toUpperCase()}
                                                                    </a>
                                                                );
                                                            }

                                                            // Fallback for unknown platforms
                                                            return (
                                                                <span key={p} className={clsx(badgeClass, "text-white")}>
                                                                    {p.substring(0, 1).toUpperCase()}
                                                                </span>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </span>
                                        </div>

                                        <a href={perf.link} target="_blank" rel="noopener noreferrer" className="block group/link relative z-[100]" onClick={e => e.stopPropagation()}>
                                            <h3 className="text-lg md:text-xl font-[800] tracking-tighter text-white mb-0.5 leading-tight line-clamp-2 drop-shadow-lg group-hover/link:text-[#a78bfa] transition-colors">
                                                {perf.title.replace(/^\[야구\]\s*/, '').trim()}
                                            </h3>
                                        </a>

                                        {/* Provider Text (Lower Body) */}
                                        {perf.platforms && perf.platforms.length > 0 && (
                                            <div className="flex gap-1 items-center mb-1 text-[11px] text-gray-400 font-medium relative z-[101]">
                                                <span className="text-gray-500 font-bold shrink-0">[제공]</span>
                                                <div className="flex flex-wrap gap-1 leading-none">
                                                    {perf.platforms.map((p: string, idx: number) => {
                                                        const platformInfo = OTT_PLATFORMS[p];
                                                        if (!platformInfo) return null;
                                                        const url = platformInfo.url.replace('{title}', encodeURIComponent(perf.title));
                                                        return (
                                                            <span key={idx} className="flex items-center">
                                                                <a
                                                                    href={url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="hover:text-white hover:underline transition-colors"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                >
                                                                    {platformInfo.label}
                                                                </a>
                                                                {idx < perf.platforms.length - 1 && <span className="mr-0.5">,</span>}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-1.5 mt-1 text-gray-300 text-xs font-medium">
                                            {perf.genre === 'movie' || perf.genre === 'ott' ? (
                                                <div className="text-gray-400 text-xs flex items-center gap-1 truncate h-[20px]">
                                                    {perf.gradeIcon ? (
                                                        <img src={perf.gradeIcon} alt="Grade" className="h-full w-auto object-contain" />
                                                    ) : (
                                                        <>
                                                            <span className="text-cyan-400 font-bold border border-cyan-400/30 px-1 rounded text-[10px]">등급</span>
                                                            {perf.grade || (perf.venue || 'Online').split('|').find((s: string) => s.includes('관람'))?.trim() || perf.venue || 'Online'}
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
                                                                name: perf.venue || 'Online'
                                                            });
                                                        }
                                                    }}
                                                    className="flex items-center gap-1 hover:text-[#a78bfa] hover:underline truncate relative z-[100] cursor-pointer max-w-full"
                                                >
                                                    <MapPin className="w-3.5 h-3.5 text-[#a78bfa] flex-shrink-0" />
                                                    <span className="truncate">{perf.venue || 'Online'}</span>
                                                </button>
                                            )}
                                        </div>

                                        {/* Movie Metadata (Director, Cast, Info) for Grid View */}
                                        {(perf.genre === 'movie' || perf.genre === 'ott') && (perf.cast || perf.director || perf.movieInfo) && (
                                            <div className="mt-2 text-xs text-gray-400 space-y-0.5 border-t border-white/10 pt-2">
                                                {perf.director && (
                                                    <div className="flex gap-1 items-start">
                                                        <span className="text-gray-500 font-bold shrink-0">감독</span>
                                                        <a
                                                            href={`https://m.search.daum.net/search?w=tot&q=${encodeURIComponent(perf.director.replace('더보기', '').trim())}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-gray-300 truncate hover:text-white hover:underline transition-colors relative z-[100]"
                                                            onClick={e => e.stopPropagation()}
                                                        >
                                                            {perf.director.replace('더보기', '').trim()}
                                                        </a>
                                                    </div>
                                                )}
                                                {perf.cast && perf.cast.length > 0 && (
                                                    <div className="flex gap-1 items-start">
                                                        <span className="text-gray-500 font-bold shrink-0">출연</span>
                                                        <div className="block truncate relative z-[101]">
                                                            {perf.cast.slice(0, 3).map((actor: string, idx: number) => {
                                                                const cleanName = actor.replace('더보기', '').trim();
                                                                if (!cleanName) return null;
                                                                return (
                                                                    <span key={idx}>
                                                                        <a
                                                                            href={`https://m.search.daum.net/search?w=tot&q=${encodeURIComponent(cleanName)}`}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="text-gray-300 hover:text-white hover:underline transition-colors"
                                                                            onClick={e => e.stopPropagation()}
                                                                        >
                                                                            {cleanName}
                                                                        </a>
                                                                        {idx < Math.min(perf.cast.length, 3) - 1 && ', '}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                                {/* Provider (OTT) */}
                                                {perf.platforms && perf.platforms.length > 0 && (
                                                    <div className="flex gap-1 items-start">
                                                        <span className="text-gray-500 font-bold shrink-0">제공</span>
                                                        <div className="block truncate relative z-[101]">
                                                            {perf.platforms.map((p: string, idx: number) => {
                                                                const key = typeof p === 'string' ? p.toLowerCase() : String(p);
                                                                const platform = OTT_PLATFORMS[key];
                                                                const label = platform ? platform.label : p;

                                                                if (platform) {
                                                                    const url = platform.url.replace('{title}', encodeURIComponent(perf.title));
                                                                    return (
                                                                        <span key={idx}>
                                                                            <a
                                                                                href={url}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="text-gray-300 hover:text-white hover:underline transition-colors"
                                                                                onClick={(e) => e.stopPropagation()}
                                                                            >
                                                                                {label}
                                                                            </a>
                                                                            {idx < perf.platforms.length - 1 ? ', ' : ''}
                                                                        </span>
                                                                    );
                                                                }

                                                                return (
                                                                    <span key={idx} className="text-gray-300 hover:text-white transition-colors">
                                                                        {label}{idx < perf.platforms.length - 1 ? ', ' : ''}
                                                                    </span>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}
                                                {perf.movieInfo && (
                                                    <div className="text-gray-500 text-[10px] mt-0.5 line-clamp-1">{perf.movieInfo}</div>
                                                )}
                                            </div>
                                        )}

                                        {(perf.price || perf.discount) && (
                                            <div className="flex justify-between items-end mt-2 w-full border-t border-white/10 pt-2">
                                                <div className="flex flex-col justify-end">
                                                    {perf.discount && perf.discount.replace(/[^0-9]/g, '').length > 0 && (
                                                        <div className="text-rose-500 drop-shadow-md leading-none">
                                                            <span className="text-xl font-extrabold">{perf.discount.replace(/[^0-9]/g, '')}</span>
                                                            <span className="text-xs font-light ml-0.5">%</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-baseline gap-1.5">
                                                    {perf.originalPrice && perf.originalPrice !== perf.price && <span className="text-gray-400 text-xs line-through decoration-gray-500/70">{perf.originalPrice}</span>}
                                                    {perf.price && (() => {
                                                        const extracted = extractFirstPrice(perf.price);
                                                        if (!extracted) return null;
                                                        return (
                                                            <div className="text-white drop-shadow-md leading-none">
                                                                {extracted.price === '무료' ? (
                                                                    <span className="text-lg font-extrabold">무료</span>
                                                                ) : (
                                                                    <>
                                                                        {extracted.label && <span className="text-[10px] text-gray-400 mr-1">{extracted.label}</span>}
                                                                        <span className="text-lg font-extrabold">{extracted.price}</span>
                                                                        <span className="text-xs font-light ml-0.5">원</span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Buttons (Share & Detail) */}
                                    {enableActions && (
                                        <div className="relative z-10 px-4 pb-3 pt-2 mt-1 flex gap-2 items-center justify-between">
                                            <button
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (onShare) {
                                                        const usedClipboard = await onShare();
                                                        if (usedClipboard) {
                                                            setIsCopied(true);
                                                            setTimeout(() => setIsCopied(false), 2000);
                                                        }
                                                    }
                                                }}
                                                className="w-[20%] bg-black/40 hover:bg-black/90 hover:text-white text-white backdrop-blur-md border border-white/20 py-2 rounded-[10px] flex items-center justify-center transition-all font-bold shadow-lg h-[40px] relative group/share"
                                                aria-label="공유하기"
                                            >
                                                <Share2 className="w-4 h-4" />
                                                <AnimatePresence>
                                                    {isCopied && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: -10 }}
                                                            className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-green-600 text-white text-xs font-bold rounded-md whitespace-nowrap shadow-lg"
                                                        >
                                                            복사됨!
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </button>
                                            <a
                                                href={perf.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-1 bg-[#a78bfa] hover:bg-[#9063f0] text-white py-2 rounded-[10px] flex items-center gap-1.5 justify-center transition-all font-bold text-sm h-[40px] shadow-lg relative z-[100]"
                                                onClick={e => e.stopPropagation()}
                                            >
                                                자세히 보기
                                                <Search className="w-4 h-4" />
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

        </div >
    );
}
