export const GENRE_GROUPS = [
    { id: 'all', label: '전체', genres: ['all'] },
    { id: 'movie', label: '영화', genres: ['movie'] },
    { id: 'performance', label: '공연', genres: ['musical', 'concert', 'play', 'classic_tradition'] },
    { id: 'exhibition', label: '전시', genres: ['exhibition', 'museum'] },
    { id: 'experience', label: '체험/액티비티', genres: ['activity', 'class'] },
    { id: 'sports', label: '스포츠', genres: ['baseball', 'soccer', 'basketball', 'volleyball', 'handball'] },
    { id: 'tourism', label: '관광/여행', genres: ['tourism'] },
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
    { id: 'tourism', label: '관광/여행' },
    { id: 'volleyball', label: '배구' },
    { id: 'basketball', label: '농구' },
    { id: 'baseball', label: '야구' },
    { id: 'soccer', label: '축구' },
    { id: 'handball', label: '핸드볼' },

];

export const GENRE_STYLES: Record<string, { hex: string, twText: string, twBg: string, twBorder: string, twActivebg: string }> = {
    'movie': { hex: '#0ea5e9', twText: 'text-sky-600', twBg: 'bg-sky-600', twBorder: 'border-sky-500', twActivebg: 'bg-sky-500' },
    'musical': { hex: '#f43f5e', twText: 'text-rose-600', twBg: 'bg-rose-600', twBorder: 'border-rose-500', twActivebg: 'bg-rose-500' },
    'concert': { hex: '#3b82f6', twText: 'text-blue-600', twBg: 'bg-blue-600', twBorder: 'border-blue-500', twActivebg: 'bg-blue-500' },
    'play': { hex: '#22c55e', twText: 'text-green-600', twBg: 'bg-green-600', twBorder: 'border-green-500', twActivebg: 'bg-green-500' },
    'classic_tradition': { hex: '#eab308', twText: 'text-yellow-600', twBg: 'bg-yellow-600', twBorder: 'border-yellow-500', twActivebg: 'bg-yellow-500' },
    'exhibition': { hex: '#a855f7', twText: 'text-purple-600', twBg: 'bg-purple-600', twBorder: 'border-purple-500', twActivebg: 'bg-purple-500' },
    'activity': { hex: '#14b8a6', twText: 'text-teal-600', twBg: 'bg-teal-600', twBorder: 'border-teal-500', twActivebg: 'bg-teal-500' },
    'class': { hex: '#6366f1', twText: 'text-indigo-600', twBg: 'bg-indigo-600', twBorder: 'border-indigo-500', twActivebg: 'bg-indigo-500' },
    'museum': { hex: '#10b981', twText: 'text-emerald-600', twBg: 'bg-emerald-600', twBorder: 'border-emerald-500', twActivebg: 'bg-emerald-500' },
    'volleyball': { hex: '#bef264', twText: 'text-lime-600', twBg: 'bg-lime-600', twBorder: 'border-lime-500', twActivebg: 'bg-lime-500' },
    'basketball': { hex: '#f97316', twText: 'text-orange-500', twBg: 'bg-orange-500', twBorder: 'border-orange-400', twActivebg: 'bg-orange-400' },
    'baseball': { hex: '#1e40af', twText: 'text-blue-900', twBg: 'bg-blue-900', twBorder: 'border-blue-800', twActivebg: 'bg-blue-800' },
    'soccer': { hex: '#ef4444', twText: 'text-red-600', twBg: 'bg-red-600', twBorder: 'border-red-500', twActivebg: 'bg-red-500' },
    'handball': { hex: '#f59e0b', twText: 'text-amber-600', twBg: 'bg-amber-600', twBorder: 'border-amber-500', twActivebg: 'bg-amber-500' },
    'tourism': { hex: '#06b6d4', twText: 'text-cyan-600', twBg: 'bg-cyan-600', twBorder: 'border-cyan-500', twActivebg: 'bg-cyan-500' },
    'all': { hex: '#6b7280', twText: 'text-gray-600', twBg: 'bg-gray-700', twBorder: 'border-gray-500', twActivebg: 'bg-gray-600' },
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
    'volleyball', 'basketball', 'baseball', 'soccer', 'sports', 'handball', 'tourism'
];



// Futures League Team Logos (emblemF versions for minor league / development teams)
// Futures League Team Logos (Using high-quality local SVGs where available)
const _BP = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const FUTURES_TEAM_LOGOS: Record<string, string> = {
    // KBO
    "한화": `${_BP}/images/logos/kbo/hanwha.svg`,
    "LG": `${_BP}/images/logos/kbo/lg.svg`,
    "SSG": `${_BP}/images/logos/kbo/ssg.svg`,
    "두산": `${_BP}/images/logos/kbo/doosan.svg`,
    "고양": `${_BP}/images/logos/kbo/kiwoom.svg`,
    "키움": `${_BP}/images/logos/kbo/kiwoom.svg`,
    "상무": `${_BP}/images/logos/kbl/sangmu.svg`,
    "KT": `${_BP}/images/logos/kbo/kt.svg`,
    "NC": `${_BP}/images/logos/kbo/nc.svg`,
    "롯데": `${_BP}/images/logos/kbo/lotte.svg`,
    "삼성(야구)": `${_BP}/images/logos/kbo/samsung.svg`,
    "KIA": `${_BP}/images/logos/kbo/kia.svg`,

    // K-League
    "울산": `${_BP}/images/logos/kleague/울산.png`,
    "전북": `${_BP}/images/logos/kleague/전북.png`,
    "포항": `${_BP}/images/logos/kleague/포항.png`,
    "광주": `${_BP}/images/logos/kleague/광주.png`,
    "대구": `${_BP}/images/logos/kleague/대구.png`,
    "인천": `${_BP}/images/logos/kleague/인천.png`,
    "서울": `${_BP}/images/logos/kleague/서울.png`,
    "대전": `${_BP}/images/logos/kleague/대전.png`,
    "제주": `${_BP}/images/logos/kleague/제주.png`,
    "강원": `${_BP}/images/logos/kleague/강원.png`,
    "수원": `${_BP}/images/logos/kleague/수원.png`,
    "수원FC": `${_BP}/images/logos/kleague/수원FC.png`,

    // KBL
    "DB": `${_BP}/images/logos/kbl/db.svg`,
    "KCC": `${_BP}/images/logos/kbl/kcc.svg`,
    "SK": `${_BP}/images/logos/kbl/sk.svg`,
    "KGC": `${_BP}/images/logos/kbl/kgc.svg`,
    "정관장": `${_BP}/images/logos/kbl/kgc.svg`,
    "현대모비스": `${_BP}/images/logos/kbl/mobis.svg`,
    "한국가스공사": `${_BP}/images/logos/kbl/kogas.svg`,
    "소노": `${_BP}/images/logos/kbl/sono.svg`,
    "삼성(농구)": `${_BP}/images/logos/kbl/samsung.svg`,
    "LG(농구)": `${_BP}/images/logos/kbl/lg.svg`,

    // V-League (KOVO)
    "대한항공": `${_BP}/images/logos/kovo/jumbos.svg`,
    "점보스": `${_BP}/images/logos/kovo/jumbos.svg`,
    "현대캐피탈": `${_BP}/images/logos/kovo/skywalkers.svg`,
    "스카이워커스": `${_BP}/images/logos/kovo/skywalkers.svg`,
    "한국전력": `${_BP}/images/logos/kovo/vixtorm.svg`,
    "VIXTORM": `${_BP}/images/logos/kovo/vixtorm.svg`,
    "OK금융그룹": `${_BP}/images/logos/kovo/okman.svg`,
    "읏맨": `${_BP}/images/logos/kovo/okman.svg`,
    "우리카드": `${_BP}/images/logos/kovo/wooriwon.svg`,
    "우리원": `${_BP}/images/logos/kovo/wooriwon.svg`,
    "KB손해보험": `${_BP}/images/logos/kovo/stars.svg`,
    "삼성화재": `${_BP}/images/logos/kovo/bluefangs.svg`,
    "블루팡스": `${_BP}/images/logos/kovo/bluefangs.svg`,
    "현대건설": `${_BP}/images/logos/kovo/hillstate.svg`,
    "흥국생명": `${_BP}/images/logos/kovo/pinkspiders.svg`,
    "핑크스파이더스": `${_BP}/images/logos/kovo/pinkspiders.svg`,
    "정관장(배구)": `${_BP}/images/logos/kovo/redsparks.svg`,
    "레드스파크스": `${_BP}/images/logos/kovo/redsparks.svg`,
    "GS칼텍스": `${_BP}/images/logos/kovo/kixx.svg`,
    "서울Kixx": `${_BP}/images/logos/kovo/kixx.svg`,
    "IBK기업은행": `${_BP}/images/logos/kovo/altos.svg`,
    "한국도로공사": `${_BP}/images/logos/kovo/hipass.svg`,
    "페퍼저축은행": `${_BP}/images/logos/kovo/aipeppers.svg`,
    "PEPPERS": `${_BP}/images/logos/kovo/aipeppers.svg`,
    "AI페퍼스": `${_BP}/images/logos/kovo/aipeppers.svg`,

    // Handball (H-League)
    "인천광역시청": `${_BP}/images/logos/handball/인천광역시청.png`,
    "SK슈가글라이더즈": `${_BP}/images/logos/handball/SK슈가글라이더즈.png`,
    "삼척시청": `${_BP}/images/logos/handball/삼척시청.png`,
    "광주도시공사": `${_BP}/images/logos/handball/광주도시공사.png`,
    "부산시설공단": `${_BP}/images/logos/handball/부산시설공단.png`,
    "경남개발공사": `${_BP}/images/logos/handball/경남개발공사.png`,
    "대구광역시청": `${_BP}/images/logos/handball/대구광역시청.png`,
    "서울시청": `${_BP}/images/logos/handball/서울시청.png`
};
