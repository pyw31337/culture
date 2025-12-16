export const GENRES = [
    { id: 'all', label: '전체' },
    { id: 'hotdeal', label: '🔥 핫딜' },
    { id: 'movie', label: '🎬 영화' }, // Added Movie
    { id: 'musical', label: '뮤지컬' },
    { id: 'concert', label: '콘서트' },
    { id: 'play', label: '연극' },
    { id: 'classic', label: '클래식/무용' },
    { id: 'exhibition', label: '전시/행사' },
    { id: 'activity', label: '액티비티' }, // Added Activity
    { id: 'festival', label: '축제' },
    // { id: 'leisure', label: '레저' }, // Removed or commented out if not used? Keeping consistency with view_file
    { id: 'leisure', label: '레저' },
    { id: 'kids', label: '키즈' }, // Added Kids (Category 2123)
    { id: 'volleyball', label: '배구' },
    { id: 'basketball', label: '농구' },
    { id: 'baseball', label: '야구' },
    { id: 'soccer', label: '축구' },
];

export const GENRE_STYLES: Record<string, { hex: string, twText: string, twBg: string, twBorder: string, twActivebg: string }> = {
    'movie': { hex: '#06b6d4', twText: 'text-cyan-600', twBg: 'bg-cyan-600', twBorder: 'border-cyan-500', twActivebg: 'bg-cyan-500' }, // Movie Style
    'musical': { hex: '#be185d', twText: 'text-pink-700', twBg: 'bg-pink-700', twBorder: 'border-pink-500', twActivebg: 'bg-pink-600' },
    'concert': { hex: '#2563eb', twText: 'text-blue-700', twBg: 'bg-blue-700', twBorder: 'border-blue-500', twActivebg: 'bg-blue-600' },
    'play': { hex: '#16a34a', twText: 'text-green-700', twBg: 'bg-green-700', twBorder: 'border-green-500', twActivebg: 'bg-green-600' },
    'classic': { hex: '#ca8a04', twText: 'text-yellow-700', twBg: 'bg-yellow-700', twBorder: 'border-yellow-500', twActivebg: 'bg-yellow-600' },
    'exhibition': { hex: '#9333ea', twText: 'text-purple-700', twBg: 'bg-purple-700', twBorder: 'border-purple-500', twActivebg: 'bg-purple-600' },
    'activity': { hex: '#0891b2', twText: 'text-cyan-700', twBg: 'bg-cyan-700', twBorder: 'border-cyan-500', twActivebg: 'bg-cyan-600' }, // New Activity Style (Cyan-700)
    'festival': { hex: '#f97316', twText: 'text-orange-500', twBg: 'bg-orange-500', twBorder: 'border-orange-400', twActivebg: 'bg-orange-400' },
    'leisure': { hex: '#ea580c', twText: 'text-orange-700', twBg: 'bg-orange-700', twBorder: 'border-orange-500', twActivebg: 'bg-orange-600' },
    'kids': { hex: '#84cc16', twText: 'text-lime-700', twBg: 'bg-lime-700', twBorder: 'border-lime-500', twActivebg: 'bg-lime-600' }, // New Kids Style (Lime)
    'volleyball': { hex: '#059669', twText: 'text-emerald-700', twBg: 'bg-emerald-700', twBorder: 'border-emerald-500', twActivebg: 'bg-emerald-600' },
    'basketball': { hex: '#c2410c', twText: 'text-orange-800', twBg: 'bg-orange-800', twBorder: 'border-orange-600', twActivebg: 'bg-orange-700' },
    'baseball': { hex: '#1e40af', twText: 'text-blue-900', twBg: 'bg-blue-900', twBorder: 'border-blue-700', twActivebg: 'bg-blue-800' },
    'soccer': { hex: '#dc2626', twText: 'text-red-700', twBg: 'bg-red-700', twBorder: 'border-red-500', twActivebg: 'bg-red-600' },
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
