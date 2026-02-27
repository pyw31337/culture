export const GENRE_GROUPS = [
    { id: 'all', label: '전체', genres: ['all'] },
    { id: 'movie', label: '영화', genres: ['movie'] },
    { id: 'performance', label: '공연', genres: ['musical', 'concert', 'play', 'classic_tradition'] },
    { id: 'exhibition', label: '전시', genres: ['exhibition', 'museum'] },
    { id: 'experience', label: '체험/액티비티', genres: ['activity', 'class'] },
    { id: 'sports', label: '스포츠', genres: ['baseball', 'soccer', 'basketball', 'volleyball', 'handball'] },
];

export const GENRES = [
    { id: 'all', label: '전체' },
    { id: 'movie', label: '영화' },

    { id: 'musical', label: '뮤지컬' },
    { id: 'concert', label: '콘서트' },
    { id: 'play', label: '연극' },
    { id: 'classic_tradition', label: '클래식' },
    { id: 'exhibition', label: '전시/행사' },
    { id: 'activity', label: '액티비티' },
    { id: 'class', label: '클래스' },
    { id: 'museum', label: '박물관/체험관' },
    { id: 'volleyball', label: '배구' },
    { id: 'basketball', label: '농구' },
    { id: 'baseball', label: '야구' },
    { id: 'soccer', label: '축구' },
    { id: 'handball', label: '핸드볼' },

];

export const GENRE_STYLES: Record<string, { hex: string, twText: string, twBg: string, twBorder: string, twActivebg: string }> = {
    'movie': { hex: '#06b6d4', twText: 'text-cyan-600', twBg: 'bg-cyan-600', twBorder: 'border-cyan-500', twActivebg: 'bg-cyan-500' },

    'musical': { hex: '#be185d', twText: 'text-pink-700', twBg: 'bg-pink-700', twBorder: 'border-pink-500', twActivebg: 'bg-pink-600' },
    'concert': { hex: '#2563eb', twText: 'text-blue-700', twBg: 'bg-blue-700', twBorder: 'border-blue-500', twActivebg: 'bg-blue-600' },
    'play': { hex: '#16a34a', twText: 'text-green-700', twBg: 'bg-green-700', twBorder: 'border-green-500', twActivebg: 'bg-green-600' },
    'classic_tradition': { hex: '#ca8a04', twText: 'text-yellow-700', twBg: 'bg-yellow-700', twBorder: 'border-yellow-500', twActivebg: 'bg-yellow-600' },
    'exhibition': { hex: '#9333ea', twText: 'text-purple-700', twBg: 'bg-purple-700', twBorder: 'border-purple-500', twActivebg: 'bg-purple-600' },
    'activity': { hex: '#0891b2', twText: 'text-cyan-700', twBg: 'bg-cyan-700', twBorder: 'border-cyan-500', twActivebg: 'bg-cyan-600' },
    'class': { hex: '#6366f1', twText: 'text-indigo-600', twBg: 'bg-indigo-600', twBorder: 'border-indigo-500', twActivebg: 'bg-indigo-500' },
    'museum': { hex: '#059669', twText: 'text-emerald-700', twBg: 'bg-emerald-700', twBorder: 'border-emerald-500', twActivebg: 'bg-emerald-600' },
    'volleyball': { hex: '#059669', twText: 'text-emerald-700', twBg: 'bg-emerald-700', twBorder: 'border-emerald-500', twActivebg: 'bg-emerald-600' },
    'basketball': { hex: '#c2410c', twText: 'text-orange-800', twBg: 'bg-orange-800', twBorder: 'border-orange-600', twActivebg: 'bg-orange-700' },
    'baseball': { hex: '#1e40af', twText: 'text-blue-900', twBg: 'bg-blue-900', twBorder: 'border-blue-700', twActivebg: 'bg-blue-800' },
    'soccer': { hex: '#dc2626', twText: 'text-red-700', twBg: 'bg-red-700', twBorder: 'border-red-500', twActivebg: 'bg-red-600' },
    'handball': { hex: '#d97706', twText: 'text-amber-600', twBg: 'bg-amber-600', twBorder: 'border-amber-500', twActivebg: 'bg-amber-500' },


    'all': { hex: '#4b5563', twText: 'text-gray-600', twBg: 'bg-gray-700', twBorder: 'border-gray-500', twActivebg: 'bg-gray-600' },
};

export const REGIONS = [
    { id: 'all', label: '전체' },
    { id: 'seoul', label: '서울' },
    { id: 'gyeonggi', label: '경기' },
    { id: 'incheon', label: '인천' },
    { id: 'busan', label: '부산' },
    { id: 'daegu', label: '대구' },
    { id: 'gwangju', label: '광주' },
    { id: 'daejeon', label: '대전' },
    { id: 'ulsan', label: '울산' },
    { id: 'sejong', label: '세종' },
    { id: 'gangwon', label: '강원' },
    { id: 'chungbuk', label: '충북' },
    { id: 'chungnam', label: '충남' },
    { id: 'jeonbuk', label: '전북' },
    { id: 'jeonnam', label: '전남' },
    { id: 'gyeongbuk', label: '경북' },
    { id: 'gyeongnam', label: '경남' },
    { id: 'jeju', label: '제주' },
];

// Alias for backward compatibility if needed, though we will update usage.
export const NATIONWIDE_REGIONS = REGIONS;

export const RADIUS_OPTIONS = [
    { value: 9999, label: '전체 반경' },
    { value: 5, label: '5km 반경' },
    { value: 10, label: '10km 반경' },
    { value: 15, label: '15km 반경' },
    { value: 20, label: '20km 반경' },
];

// Sports genres for composite /sports URL
export const SPORTS_GENRES = ['baseball', 'basketball', 'volleyball', 'soccer', 'handball'];

// Valid genre slugs for URL routing
export const VALID_GENRE_SLUGS = [
    'movie', 'musical', 'theater', 'play', 'concert', 'classic_tradition', 'exhibition',
    'activity', 'class', 'museum',
    'volleyball', 'basketball', 'baseball', 'soccer', 'sports', 'handball'
];



// Futures League Team Logos (emblemF versions for minor league / development teams)
// Futures League Team Logos (Using high-quality local SVGs where available)
export const FUTURES_TEAM_LOGOS: Record<string, string> = {
    "한화": "/images/logos/kbo/hanwha.svg",
    "LG": "/images/logos/kbo/lg.svg",
    "SSG": "/images/logos/kbo/ssg.svg",
    "두산": "/images/logos/kbo/doosan.svg",
    "고양": "/images/logos/kbo/kiwoom.svg", // Using Kiwoom logo for Goyang Heroes
    "상무": "/images/logos/kbl/sangmu.svg", // Sharing Sangmu Phoenix logo from KBL
    "KT": "/images/logos/kbo/kt.svg",
    "NC": "/images/logos/kbo/nc.svg",
    "롯데": "/images/logos/kbo/lotte.svg",
    "삼성": "/images/logos/kbo/samsung.svg",
    "KIA": "/images/logos/kbo/kia.svg"
};
