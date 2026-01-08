export const GENRES = [
    { id: 'all', label: '전체' },
    { id: 'hotdeal', label: '🔥 핫딜' },
    { id: 'movie', label: '영화' }, // Icon removed
    { id: 'ott', label: 'OTT' },
    { id: 'musical', label: '뮤지컬' },
    { id: 'concert', label: '콘서트' },
    { id: 'play', label: '연극' },
    { id: 'classic', label: '클래식/무용' },
    { id: 'exhibition', label: '전시/행사' },
    { id: 'activity', label: '액티비티' },
    { id: 'class', label: '클래스' }, // New Class category
    { id: 'travel', label: '여행' },
    { id: 'festival', label: '축제' },
    // { id: 'leisure', label: '레저' }, // Removed or commented out if not used? Keeping consistency with view_file
    { id: 'leisure', label: '레저' },
    { id: 'kids', label: '키즈' },
    { id: 'volleyball', label: '배구' },
    { id: 'basketball', label: '농구' },
    { id: 'baseball', label: '야구' },
    { id: 'soccer', label: '축구' },
    { id: 'handball', label: '핸드볼' },
    { id: 'hockey', label: '아이스하키' },
];

export const GENRE_STYLES: Record<string, { hex: string, twText: string, twBg: string, twBorder: string, twActivebg: string }> = {
    'movie': { hex: '#06b6d4', twText: 'text-cyan-600', twBg: 'bg-cyan-600', twBorder: 'border-cyan-500', twActivebg: 'bg-cyan-500' },
    'ott': { hex: '#8b5cf6', twText: 'text-violet-600', twBg: 'bg-violet-600', twBorder: 'border-violet-500', twActivebg: 'bg-violet-500' },
    'musical': { hex: '#be185d', twText: 'text-pink-700', twBg: 'bg-pink-700', twBorder: 'border-pink-500', twActivebg: 'bg-pink-600' },
    'concert': { hex: '#2563eb', twText: 'text-blue-700', twBg: 'bg-blue-700', twBorder: 'border-blue-500', twActivebg: 'bg-blue-600' },
    'play': { hex: '#16a34a', twText: 'text-green-700', twBg: 'bg-green-700', twBorder: 'border-green-500', twActivebg: 'bg-green-600' },
    'classic': { hex: '#ca8a04', twText: 'text-yellow-700', twBg: 'bg-yellow-700', twBorder: 'border-yellow-500', twActivebg: 'bg-yellow-600' },
    'exhibition': { hex: '#9333ea', twText: 'text-purple-700', twBg: 'bg-purple-700', twBorder: 'border-purple-500', twActivebg: 'bg-purple-600' },
    'activity': { hex: '#0891b2', twText: 'text-cyan-700', twBg: 'bg-cyan-700', twBorder: 'border-cyan-500', twActivebg: 'bg-cyan-600' },
    'class': { hex: '#6366f1', twText: 'text-indigo-600', twBg: 'bg-indigo-600', twBorder: 'border-indigo-500', twActivebg: 'bg-indigo-500' }, // Indigo for Class
    'travel': { hex: '#0ea5e9', twText: 'text-sky-600', twBg: 'bg-sky-600', twBorder: 'border-sky-500', twActivebg: 'bg-sky-500' }, // Sky Blue for Travel
    'festival': { hex: '#f97316', twText: 'text-orange-500', twBg: 'bg-orange-500', twBorder: 'border-orange-400', twActivebg: 'bg-orange-400' },
    'leisure': { hex: '#ea580c', twText: 'text-orange-700', twBg: 'bg-orange-700', twBorder: 'border-orange-500', twActivebg: 'bg-orange-600' },
    'kids': { hex: '#84cc16', twText: 'text-lime-700', twBg: 'bg-lime-700', twBorder: 'border-lime-500', twActivebg: 'bg-lime-600' },
    'volleyball': { hex: '#059669', twText: 'text-emerald-700', twBg: 'bg-emerald-700', twBorder: 'border-emerald-500', twActivebg: 'bg-emerald-600' },
    'basketball': { hex: '#c2410c', twText: 'text-orange-800', twBg: 'bg-orange-800', twBorder: 'border-orange-600', twActivebg: 'bg-orange-700' },
    'baseball': { hex: '#1e40af', twText: 'text-blue-900', twBg: 'bg-blue-900', twBorder: 'border-blue-700', twActivebg: 'bg-blue-800' },
    'soccer': { hex: '#dc2626', twText: 'text-red-700', twBg: 'bg-red-700', twBorder: 'border-red-500', twActivebg: 'bg-red-600' },
    'handball': { hex: '#d97706', twText: 'text-amber-600', twBg: 'bg-amber-600', twBorder: 'border-amber-500', twActivebg: 'bg-amber-500' },
    'hockey': { hex: '#0284c7', twText: 'text-sky-700', twBg: 'bg-sky-700', twBorder: 'border-sky-500', twActivebg: 'bg-sky-600' },
    'hotdeal': { hex: '#e11d48', twText: 'text-rose-600', twBg: 'bg-rose-600', twBorder: 'border-rose-500', twActivebg: 'bg-rose-500' },
    'all': { hex: '#4b5563', twText: 'text-gray-600', twBg: 'bg-gray-700', twBorder: 'border-gray-500', twActivebg: 'bg-gray-600' },
};

export const REGIONS = [
    { id: 'all', label: '전체' },
    { id: 'seoul', label: '서울' },
    { id: 'gyeonggi', label: '경기' },
    { id: 'incheon', label: '인천' },
];

export const RADIUS_OPTIONS = [
    { value: 9999, label: '전체 반경' },
    { value: 5, label: '5km 반경' },
    { value: 10, label: '10km 반경' },
    { value: 15, label: '15km 반경' },
    { value: 20, label: '20km 반경' },
];

// Sports genres for composite /sports URL
export const SPORTS_GENRES = ['baseball', 'basketball', 'volleyball', 'soccer', 'hockey', 'handball'];

// Valid genre slugs for URL routing
export const VALID_GENRE_SLUGS = [
    'hotdeal', 'movie', 'ott', 'musical', 'theater', 'concert', 'classic', 'exhibition',
    'activity', 'class', 'travel', 'festival', 'leisure', 'kids',
    'volleyball', 'basketball', 'baseball', 'soccer', 'sports', 'handball', 'hockey'
];
