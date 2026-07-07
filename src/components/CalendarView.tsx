'use client';

import { Suspense, useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { Performance } from '@/types';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { X, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { clsx } from 'clsx';
import { GENRES, GENRE_STYLES } from '@/lib/constants';
import { buildGenreCounts, getAvailableGenres, getGenreNavigationItems, isGenreAvailable, type GenreCounts } from '@/lib/genre-availability';
import type { DataBuildInfo } from '@/lib/build-info';
import { getPerformanceLocationLabel } from '@/lib/location-display';
import { getExternalContentLink } from '@/lib/performance-links';
import CalendarDayCell from './CalendarDayCell';
import { useRouter } from 'next/navigation';
import SearchParamsBridge from './SearchParamsBridge';

// Empty URLSearchParams sentinel for static prerender. See
// SearchParamsBridge for rationale.
const EMPTY_SEARCH_PARAMS = new URLSearchParams();
import { usePerformanceData } from '@/hooks/usePerformanceData';
import ImageWithFallback from './ImageWithFallback';
import ServiceStatusStrip from './performance/list/ServiceStatusStrip';
import { LocationSelector } from './LocationSelector';
import { getRegionSelectionLabel, parseDistrictSelection, parseRegionSelection, persistRegionSelection, readPersistedRegionSelection, REGION_SELECTION_EVENT } from '@/lib/region-selection';

type CalendarVenueLookup = Record<string, { address?: string; district?: string; refined_name?: string; mapped_region_id?: string; lat?: number | null; lng?: number | null }>;

interface CalendarViewProps {
    performances: Performance[];
    initialGenreCounts?: GenreCounts;
    buildInfo?: DataBuildInfo | null;
    lastUpdated: string;
    embeddedSearchParams?: string;
    onClose?: () => void;
}

type CalendarView = 'daily' | 'weekly' | 'monthly';
type CalendarRegionId = 'all' | 'seoul' | 'gyeonggi' | 'incheon' | 'gangwon' | 'chungcheong' | 'jeolla' | 'gyeongsang' | 'jeju';

const CALENDAR_REGION_FILTERS: Array<{
    id: CalendarRegionId;
    label: string;
    regionIds: string[];
    tokens: string[];
}> = [
    { id: 'all', label: '전국', regionIds: [], tokens: [] },
    { id: 'seoul', label: '서울', regionIds: ['seoul'], tokens: ['서울', '서울특별시'] },
    { id: 'gyeonggi', label: '경기', regionIds: ['gyeonggi'], tokens: ['경기', '경기도'] },
    { id: 'incheon', label: '인천', regionIds: ['incheon'], tokens: ['인천', '인천광역시'] },
    { id: 'gangwon', label: '강원', regionIds: ['gangwon'], tokens: ['강원', '강원도', '강원특별자치도'] },
    { id: 'chungcheong', label: '충청', regionIds: ['chungbuk', 'chungnam', 'daejeon', 'sejong'], tokens: ['충북', '충청북도', '충남', '충청남도', '대전', '대전광역시', '세종', '세종특별자치시'] },
    { id: 'jeolla', label: '전라', regionIds: ['jeonbuk', 'jeonnam', 'gwangju'], tokens: ['전북', '전라북도', '전북특별자치도', '전남', '전라남도', '광주', '광주광역시'] },
    { id: 'gyeongsang', label: '경상', regionIds: ['gyeongbuk', 'gyeongnam', 'busan', 'daegu', 'ulsan'], tokens: ['경북', '경상북도', '경남', '경상남도', '부산', '부산광역시', '대구', '대구광역시', '울산', '울산광역시'] },
    { id: 'jeju', label: '제주', regionIds: ['jeju'], tokens: ['제주', '제주특별자치도'] },
];

const CALENDAR_REGION_ID_SET = new Set(CALENDAR_REGION_FILTERS.map((region) => region.id));
const KOREAN_REGION_TO_ID: Record<string, string> = {
    서울: 'seoul',
    경기: 'gyeonggi',
    경기도: 'gyeonggi',
    인천: 'incheon',
    강원: 'gangwon',
    충북: 'chungbuk',
    충남: 'chungnam',
    대전: 'daejeon',
    세종: 'sejong',
    전북: 'jeonbuk',
    전남: 'jeonnam',
    광주: 'gwangju',
    경북: 'gyeongbuk',
    경남: 'gyeongnam',
    부산: 'busan',
    대구: 'daegu',
    울산: 'ulsan',
    제주: 'jeju',
};

function normalizeCalendarRegionId(value?: string | null) {
    if (!value) return '';
    return KOREAN_REGION_TO_ID[value] || value;
}

function getCalendarRegionId(value?: string | null): CalendarRegionId {
    const normalized = normalizeCalendarRegionId(value);
    return CALENDAR_REGION_ID_SET.has(normalized as CalendarRegionId) ? normalized as CalendarRegionId : 'all';
}


function matchesRegionSelection(performance: Performance, regionValue: string, districtValue: string, venues: CalendarVenueLookup) {
    const selectedRegions = parseRegionSelection(regionValue);
    if (selectedRegions.length === 0) return true;

    const districtMap = parseDistrictSelection(districtValue, selectedRegions[0]);
    const venueInfo = performance.venue ? venues[performance.venue] : undefined;
    const normalizedRegion = normalizeCalendarRegionId(performance.region || venueInfo?.mapped_region_id);
    const haystack = [
        performance.address,
        venueInfo?.address,
        performance.venue,
        performance.district,
        venueInfo?.district,
        performance.bracketRegion,
    ].filter(Boolean).join(' ');

    return selectedRegions.some((regionId) => {
        const directRegionMatch = normalizedRegion === regionId || venueInfo?.mapped_region_id === regionId;
        const regionLabel = CALENDAR_REGION_FILTERS.find((region) => region.regionIds.includes(regionId) || region.id === regionId)?.label;
        const broadFilter = CALENDAR_REGION_FILTERS.find((region) => region.regionIds.includes(regionId) || region.id === regionId);
        const tokenMatch = Boolean(regionLabel && haystack.includes(regionLabel)) || Boolean(broadFilter?.tokens.some((token) => haystack.includes(token)));
        if (!directRegionMatch && !tokenMatch) return false;

        const selectedDistricts = districtMap[regionId] || [];
        if (selectedDistricts.length === 0) return true;
        return selectedDistricts.some((district) =>
            performance.district === district || venueInfo?.district === district || haystack.includes(district)
        );
    });
}

function matchesCalendarRegion(performance: Performance, regionId: CalendarRegionId) {
    if (regionId === 'all') return true;

    const filter = CALENDAR_REGION_FILTERS.find((region) => region.id === regionId);
    if (!filter) return true;

    const normalizedRegion = normalizeCalendarRegionId(performance.region);
    if (filter.regionIds.includes(normalizedRegion)) return true;

    const haystack = [
        performance.address,
        performance.venue,
        performance.district,
        performance.bracketRegion,
    ].filter(Boolean).join(' ');

    return filter.tokens.some((token) => haystack.includes(token));
}

export default function CalendarView({
    performances: initialPerformances,
    initialGenreCounts,
    buildInfo,
    lastUpdated,
    embeddedSearchParams,
    onClose,
}: CalendarViewProps) {
    const router = useRouter();
    // searchParams is populated by <SearchParamsBridge> after mount. Initial
    // render uses EMPTY_SEARCH_PARAMS so the static prerender doesn't bail out
    // to client-side rendering. A useEffect below syncs URL params -> state
    // once the bridge fires.
    const [searchParams, setSearchParams] = useState<URLSearchParams>(() => (
        embeddedSearchParams ? new URLSearchParams(embeddedSearchParams) : EMPTY_SEARCH_PARAMS
    ));
    const isEmbedded = typeof embeddedSearchParams === 'string';

    // Read initial state from URL params to initialize currentMonth early
    const initialDateStr = searchParams.get('date');
    const [currentMonth, setCurrentMonth] = useState<Date>(() => {
        if (initialDateStr) {
            const d = new Date(initialDateStr);
            if (!isNaN(d.getTime())) return d;
        }
        return new Date();
    });

    const formattedMonth = useMemo(() => {
        const year = currentMonth.getFullYear();
        const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    }, [currentMonth]);

    // Load full data client-side (server provides initial subset, client fetches monthly chunks)
    const { allPerformances, venues, isDataFullyLoaded } = usePerformanceData({
        initialPerformances,
        performanceLoadPolicy: 'full',
        performanceDataPath: `/data/calendar/${formattedMonth}.json`,
        dataVersion: buildInfo?.version,
        backgroundLoadPriority: 'immediate',
        loadVenues: true,
    });
    const performances = allPerformances;
    const genreCounts = useMemo(() => {
        if (isDataFullyLoaded) return buildGenreCounts(performances);
        if (initialGenreCounts && Object.keys(initialGenreCounts).length > 0) return initialGenreCounts;
        return buildGenreCounts(performances);
    }, [initialGenreCounts, isDataFullyLoaded, performances]);
    const availableGenres = useMemo(() => getAvailableGenres(genreCounts), [genreCounts]);
    const genreNavigationItems = useMemo(() => getGenreNavigationItems(genreCounts), [genreCounts]);
    const totalItemCount = useMemo(() => {
        if (buildInfo?.itemCount) return buildInfo.itemCount;
        return Object.values(genreCounts).reduce((sum, count) => sum + count, 0);
    }, [buildInfo, genreCounts]);
    const availableGenreCount = useMemo(() => {
        return availableGenres.filter((genre) => genre.id !== 'all').length;
    }, [availableGenres]);

    // Read initial state from URL params
    const initialGenre = searchParams.get('genre') || 'all';
    const initialView = (searchParams.get('view') as CalendarView) || 'monthly';
    const initialRegion = getCalendarRegionId(searchParams.get('region'));
    const initialDistrict = 'all';

    const [calendarView, setCalendarView] = useState<CalendarView>(initialView);
    const [localGenre, setLocalGenre] = useState(initialGenre);
    const [localRegion, setLocalRegion] = useState<string>(initialRegion);
    const [localDistrict, setLocalDistrict] = useState<string>(initialDistrict);
    const [isRegionPanelOpen, setIsRegionPanelOpen] = useState(false);
    const skipInitialRegionPersist = useRef(true);

    useEffect(() => {
        if (typeof document === 'undefined') return;
        const previousBodyOverflow = document.body.style.overflow;
        const previousHtmlOverflow = document.documentElement.style.overflow;
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        return () => {
            document.body.style.overflow = previousBodyOverflow;
            document.documentElement.style.overflow = previousHtmlOverflow;
        };
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const persistedRegion = readPersistedRegionSelection();
        if (persistedRegion?.region) setLocalRegion(persistedRegion.region);
        if (persistedRegion?.district) setLocalDistrict(persistedRegion.district);
    }, []);

    useEffect(() => {
        if (skipInitialRegionPersist.current) {
            skipInitialRegionPersist.current = false;
            return;
        }
        persistRegionSelection(localRegion, localDistrict, 'all');
    }, [localRegion, localDistrict]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handleRegionSync = (event: Event) => {
            const detail = (event as CustomEvent<{ region?: string; district?: string }>).detail;
            if (!detail) return;
            if (detail.region) setLocalRegion(detail.region);
            if (detail.district) setLocalDistrict(detail.district);
        };
        window.addEventListener(REGION_SELECTION_EVENT, handleRegionSync);
        return () => window.removeEventListener(REGION_SELECTION_EVENT, handleRegionSync);
    }, []);

    // Sync URL params -> local state. Done in the bridge callback (not in a
    // useEffect body) so React 19's set-state-in-effect rule is satisfied -
    // we're effectively subscribing to an external system (the URL).
    // We only apply a value when the URL actually carries it so user
    // interactions aren't overwritten.
    const handleSearchParamsChange = useCallback((sp: URLSearchParams) => {
        const genreParam = sp.get('genre');
        if (genreParam) setLocalGenre(genreParam);

        const viewParam = sp.get('view') as CalendarView | null;
        if (viewParam) setCalendarView(viewParam);

        const regionParam = sp.get('region');
        if (regionParam) setLocalRegion(getCalendarRegionId(regionParam));

        const dateParam = sp.get('date');
        if (dateParam) {
            const d = new Date(dateParam);
            if (!isNaN(d.getTime())) setCurrentMonth(d);
        }

        setSearchParams(sp);
    }, []);
    const effectiveGenre = useMemo(() => {
        if (localGenre === 'all') return 'all';
        return isGenreAvailable(genreCounts, localGenre) ? localGenre : 'all';
    }, [genreCounts, localGenre]);

    const startDate = startOfWeek(startOfMonth(currentMonth));
    const endDate = endOfWeek(endOfMonth(currentMonth));
    const dayList = eachDayOfInterval({ start: startDate, end: endDate });

    const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

    // Map performances to dates
    const performancesByDate = useMemo(() => {
        const map = new Map<string, Performance[]>();

        performances.forEach(perf => {
            const dateStr = (perf.date || '').trim();
            if (!dateStr) return;

            if (dateStr.includes('~')) {
                const [startRaw, endRaw] = dateStr.split('~').map(s => s.trim());
                if (startRaw && endRaw) {
                    const startRawCleanup = startRaw.replace(/\./g, '-');
                    const endRawCleanup = endRaw.replace(/\./g, '-');

                    if (startRawCleanup.startsWith('202') && endRawCleanup.startsWith('202')) {
                        const start = new Date(startRawCleanup);
                        const end = new Date(endRawCleanup);

                        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                            try {
                                let maxEnd = end;
                                const MAX_DAYS = 90;
                                const diffTime = Math.abs(end.getTime() - start.getTime());
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                                if (perf.genre === 'movie') {
                                    maxEnd = start;
                                } else if (diffDays > MAX_DAYS) {
                                    maxEnd = new Date(start.getTime() + (MAX_DAYS * 24 * 60 * 60 * 1000));
                                }

                                const interval = eachDayOfInterval({ start, end: maxEnd });

                                interval.forEach(day => {
                                    const dayStr = format(day, 'yyyy-MM-dd');
                                    if (!map.has(dayStr)) map.set(dayStr, []);
                                    map.get(dayStr)!.push(perf);
                                });
                            } catch { }
                        }
                    }
                }
            } else {
                const normalizedDate = dateStr.replace(/\./g, '-').substring(0, 10);
                if (normalizedDate.length === 10) {
                    if (!map.has(normalizedDate)) map.set(normalizedDate, []);
                    map.get(normalizedDate)!.push(perf);
                }
            }
        });

        return map;
    }, [performances]);

    const getPerformancesForDay = (day: Date) => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const allEvents = performancesByDate.get(dayStr) || [];
        return allEvents.filter((p) => (
            matchesRegionSelection(p, localRegion, localDistrict, venues) &&
            (effectiveGenre === 'all' || p.genre === effectiveGenre)
        ));
    };

    // Calculate Counts for the focused view context
    const currentViewTotalEvents = useMemo(() => {
        if (calendarView === 'daily') {
            const dayStr = format(currentMonth, 'yyyy-MM-dd');
            return performancesByDate.get(dayStr) || [];
        } else if (calendarView === 'weekly') {
            const start = startOfWeek(currentMonth, { weekStartsOn: 0 });
            const end = endOfWeek(currentMonth, { weekStartsOn: 0 });
            const result: Performance[] = [];
            const seen = new Set<string>();
            eachDayOfInterval({ start, end }).forEach(day => {
                const dayStr = format(day, 'yyyy-MM-dd');
                (performancesByDate.get(dayStr) || []).forEach(p => {
                    if (!seen.has(p.id)) {
                        seen.add(p.id);
                        result.push(p);
                    }
                });
            });
            return result;
        } else {
            const start = startOfMonth(currentMonth);
            const end = endOfMonth(currentMonth);
            const result: Performance[] = [];
            const seen = new Set<string>();
            eachDayOfInterval({ start, end }).forEach(day => {
                const dayStr = format(day, 'yyyy-MM-dd');
                (performancesByDate.get(dayStr) || []).forEach(p => {
                    if (!seen.has(p.id)) {
                        seen.add(p.id);
                        result.push(p);
                    }
                });
            });
            return result;
        }
    }, [calendarView, currentMonth, performancesByDate]);

    const regionFilteredTotalEvents = useMemo(() => {
        return currentViewTotalEvents.filter((p) => matchesRegionSelection(p, localRegion, localDistrict, venues));
    }, [currentViewTotalEvents, localRegion, localDistrict, venues]);

    const currentViewEvents = useMemo(() => {
        if (effectiveGenre === 'all') return regionFilteredTotalEvents;
        return regionFilteredTotalEvents.filter(p => p.genre === effectiveGenre);
    }, [regionFilteredTotalEvents, effectiveGenre]);

    const regionOptions = useMemo(() => {
        return CALENDAR_REGION_FILTERS.map((region) => {
            const count = region.id === 'all'
                ? currentViewTotalEvents.length
                : currentViewTotalEvents.filter((p) => matchesCalendarRegion(p, region.id)).length;
            return { ...region, count };
        });
    }, [currentViewTotalEvents]);

    const visibleCountKey = useMemo(
        () => `${calendarView}-${localRegion}-${localDistrict}-${effectiveGenre}-${format(currentMonth, 'yyyy-MM-dd')}`,
        [calendarView, currentMonth, effectiveGenre, localRegion, localDistrict]
    );
    const [visibleCountState, setVisibleCountState] = useState({ key: '', count: 20 });
    const visibleCount = visibleCountState.key === visibleCountKey ? visibleCountState.count : 20;

    // Drag to scroll logic
    const scrollRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const scrollLeftRef = useRef(0);

    const onMouseDown = (e: React.MouseEvent) => {
        if (!scrollRef.current) return;
        setIsDragging(true);
        setStartX(e.pageX - scrollRef.current.offsetLeft);
        scrollLeftRef.current = scrollRef.current.scrollLeft;
    };

    const onMouseLeave = () => setIsDragging(false);
    const onMouseUp = () => setIsDragging(false);

    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollRef.current.offsetLeft;
        const walk = (x - startX) * 2;
        scrollRef.current.scrollLeft = scrollLeftRef.current - walk;
    };

    // Scroll Handler for List
    const listRef = useRef<HTMLDivElement>(null);
    const onListScroll = () => {
        if (listRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = listRef.current;
            if (scrollTop + clientHeight >= scrollHeight - 50) {
                const totalFiltered = effectiveGenre === 'all'
                    ? currentViewEvents.length
                    : currentViewEvents.filter(p => p.genre === effectiveGenre).length;
                if (visibleCount < totalFiltered) {
                    setVisibleCountState(prev => ({
                        key: visibleCountKey,
                        count: (prev.key === visibleCountKey ? prev.count : 20) + 20,
                    }));
                }
            }
        }
    };

    const handleClose = () => {
        if (onClose) {
            onClose();
            return;
        }

        // Navigate back, or go to home if no history
        if (window.history.length > 1) {
            router.back();
        } else {
            router.push('/');
        }
    };

    const handleSelectDay = useMemo(() => (d: Date) => {
        setCurrentMonth(d);
        setCalendarView('daily');
    }, []); // Stable setter

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            {/* Isolated URL params bridge - see SearchParamsBridge for rationale. */}
            {!isEmbedded && (
                <Suspense fallback={null}>
                    <SearchParamsBridge onParams={handleSearchParamsChange} />
                </Suspense>
            )}
            <div className="bg-white dark:bg-gray-900 w-full h-full shadow-2xl flex flex-col border-0">
                {/* Header */}
                <div className="relative z-[120] flex items-center justify-between overflow-visible p-3 sm:p-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                    <h2 className="text-base sm:text-2xl font-extrabold text-gray-900 dark:text-white flex items-center gap-1 sm:gap-4 truncate">
                        <button onClick={() => {
                            if (calendarView === 'monthly') handlePrevMonth();
                            else if (calendarView === 'weekly') setCurrentMonth(subWeeks(currentMonth, 1));
                            else setCurrentMonth(subDays(currentMonth, 1));
                        }} className="p-1 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition shrink-0"><ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" /></button>

                        <span className="hidden sm:inline cursor-pointer hover:text-blue-500 dark:hover:text-blue-400 transition-colors" onClick={() => setCurrentMonth(new Date())} title="오늘로 이동">
                            {calendarView === 'daily'
                                ? format(currentMonth, 'yyyy년 M월 d일 (eee)', { locale: ko })
                                : calendarView === 'weekly'
                                    ? `${format(startOfWeek(currentMonth), 'M/d')} ~ ${format(endOfWeek(currentMonth), 'M/d')}`
                                    : format(currentMonth, 'yyyy년 M월', { locale: ko })}
                        </span>
                        <span className="sm:hidden text-base truncate cursor-pointer hover:text-blue-500 dark:hover:text-blue-400 transition-colors" onClick={() => setCurrentMonth(new Date())} title="오늘로 이동">
                            {calendarView === 'daily'
                                ? format(currentMonth, 'yy.MM.dd', { locale: ko })
                                : calendarView === 'weekly'
                                    ? `${format(startOfWeek(currentMonth), 'M/d')}~${format(endOfWeek(currentMonth), 'M/d')}`
                                    : format(currentMonth, 'yy.MM', { locale: ko })}
                        </span>

                        <button onClick={() => {
                            if (calendarView === 'monthly') handleNextMonth();
                            else if (calendarView === 'weekly') setCurrentMonth(addWeeks(currentMonth, 1));
                            else setCurrentMonth(addDays(currentMonth, 1));
                        }} className="p-1 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition shrink-0"><ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" /></button>

                        <ServiceStatusStrip
                            lastUpdated={lastUpdated}
                            totalItemCount={totalItemCount}
                            availableGenreCount={availableGenreCount}
                            qualitySummary={buildInfo?.qualitySummary}
                            sourceHealthSummary={buildInfo?.sourceHealthSummary}
                            className="ml-1 shrink-0"
                            buttonClassName="h-8 w-8 sm:h-9 sm:w-9 border-gray-200 bg-gray-100 text-gray-500 hover:border-blue-300 hover:text-blue-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-blue-500 dark:hover:text-blue-300"
                        />
                    </h2>
                    <div className="relative z-[130] flex min-w-0 items-center gap-1 sm:gap-2 shrink-0">
                        <div className="relative shrink-0">
                            <button
                                type="button"
                                onClick={() => setIsRegionPanelOpen((value) => !value)}
                                className="flex h-9 max-w-[42vw] items-center gap-2 rounded-full border border-gray-200 bg-gray-100 px-3 text-[11px] font-black text-gray-700 transition hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                                title="지역설정"
                            >
                                <MapPin className="h-3.5 w-3.5 text-emerald-500" />
                                <span className="shrink-0">지역설정</span>
                                <span className="shrink-0 text-gray-300 dark:text-gray-600"> / </span>
                                <span className="truncate text-emerald-600 dark:text-emerald-300">
                                    {getRegionSelectionLabel(localRegion, localDistrict)}
                                </span>
                            </button>
                            {isRegionPanelOpen && (
                                <div className="absolute right-0 top-full z-[200] mt-3 max-h-[min(76vh,720px)] w-[min(720px,calc(100vw-2rem))] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 shadow-2xl dark:border-gray-700 dark:bg-gray-900">
                                    <LocationSelector
                                        selectedRegion={localRegion}
                                        onRegionSelect={setLocalRegion}
                                        selectedDistrict={localDistrict}
                                        onDistrictSelect={setLocalDistrict}
                                        selectedVenue="all"
                                        onVenueSelect={() => {}}
                                        districts={[]}
                                        availableVenues={Object.keys(venues)}
                                        venueLookup={venues}
                                        searchMode="location"
                                        inline
                                    />
                                </div>
                            )}
                        </div>
                        {(['daily', 'weekly', 'monthly'] as CalendarView[]).map(v => (
                            <button
                                key={v}
                                onClick={() => setCalendarView(v)}
                                className={clsx(
                                    'px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-colors',
                                    calendarView === v
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
                                )}
                            >
                                {v === 'daily' ? '일간' : v === 'weekly' ? '주간' : '월간'}
                            </button>
                        ))}
                        <button onClick={handleClose} className="p-1 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition ml-0 sm:ml-2 shrink-0">
                            <X className="w-5 h-5 sm:w-6 sm:h-6" />
                        </button>
                    </div>
                </div>

                {/* Category Nav Header */}
                <div className="w-full px-4 py-3 bg-gray-100/30 dark:bg-black/20 border-b border-gray-200 dark:border-gray-800 overflow-x-auto scrollbar-hide shrink-0 cursor-grab z-10"
                    onMouseDown={onMouseDown} onMouseLeave={onMouseLeave} onMouseUp={onMouseUp} onMouseMove={onMouseMove} ref={scrollRef}>
                    <div className="flex gap-2 w-max">
                        {genreNavigationItems.map((genre) => {
                            const isSelected = effectiveGenre === genre.id;
                            const count = genre.id === 'all'
                                ? regionFilteredTotalEvents.length
                                : regionFilteredTotalEvents.filter(p => p.genre === genre.id).length;
                            const isDisabled = Boolean(genre.disabled || (count === 0 && genre.id !== 'all'));

                            return (
                                <button
                                    key={genre.id}
                                    disabled={isDisabled}
                                    aria-disabled={isDisabled}
                                    title={genre.offseason ? `${genre.label.replace(' (비시즌)', '')}은 현재 비시즌이라 수집된 경기가 없습니다.` : undefined}
                                    onClick={() => {
                                        if (isDisabled) return;
                                        setLocalGenre(genre.id);
                                    }}
                                    className={clsx(
                                        "px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-200 border shadow-sm flex items-center gap-1.5",
                                        isSelected
                                            ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white shadow-lg scale-105"
                                            : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800",
                                        isDisabled ? "opacity-30 grayscale cursor-not-allowed" : "opacity-100"
                                    )}
                                >
                                    {genre.label}
                                    {count > 0 && <span className={clsx("text-[10px] font-black opacity-60", isSelected ? "text-blue-400" : "text-gray-500")}>{count}</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Unified Day View Pane */}
                {!isDataFullyLoaded && performances.length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-6 text-center dark:border-gray-800 dark:bg-gray-950/60">
                        <div className="text-sm font-black text-gray-900 dark:text-white">달력 데이터를 불러오는 중...</div>
                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400">초기 진입 속도를 위해 캘린더 데이터는 클라이언트에서 바로 이어서 내려받습니다.</div>
                    </div>
                )}

                {calendarView === 'daily' && (
                    <div
                        ref={listRef}
                        onScroll={onListScroll}
                        className="flex-grow overflow-y-auto p-4 space-y-3 bg-white dark:bg-gray-900 custom-scrollbar"
                    >
                        {(() => {
                            const filteredEvents = effectiveGenre === 'all'
                                ? currentViewEvents
                                : currentViewEvents.filter(p => p.genre === effectiveGenre);

                            const displayedDailyEvents = filteredEvents.slice(0, visibleCount);

                            if (filteredEvents.length === 0) return (
                                <div className="flex flex-col items-center justify-center h-full py-20 opacity-40">
                                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 text-gray-400">
                                        <X size={32} />
                                    </div>
                                    <p className="text-gray-500 text-lg font-bold">일정이 없습니다</p>
                                </div>
                            );
                            return (
                                <div className="space-y-3 max-w-4xl mx-auto w-full">
                                    {displayedDailyEvents.map((perf, i) => (
                                        <a key={`${perf.id}-${i}`} href={getExternalContentLink(perf)} target="_blank" rel="noopener noreferrer"
                                            className="flex gap-4 p-4 bg-white dark:bg-gray-800/50 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-750 border border-gray-100 dark:border-gray-800 transition-all group shadow-sm hover:shadow-md active:scale-[0.98]"
                                        >
                                            <div className="relative w-14 h-20 shrink-0 shadow-lg group-hover:scale-105 transition-transform">
                                                <ImageWithFallback
                                                    src={perf.image || perf.poster || perf.backupPoster || perf.posterUrl || ''}
                                                    backupSrc={perf.backupPoster || perf.posterUrl || perf.poster}
                                                    placeholderInput={{
                                                        title: perf.title,
                                                        genre: perf.genre,
                                                        matchLabel: perf.homeTeam && perf.awayTeam ? `${perf.homeTeam} vs ${perf.awayTeam}` : null,
                                                    }}
                                                    alt={perf.title}
                                                    fill
                                                    optimizationWidth={72}
                                                    quality={45}
                                                    fastDisplay
                                                    loading={i < 8 ? 'eager' : 'lazy'}
                                                    fetchPriority={i < 4 ? 'high' : 'auto'}
                                                    sizes="56px"
                                                    className="object-cover rounded-lg bg-gray-100 dark:bg-gray-700"
                                                />
                                            </div>
                                            <div className="min-w-0 flex-1 flex flex-col justify-center">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className={clsx("px-2 py-0.5 rounded text-[10px] font-black tracking-wider text-white uppercase", GENRE_STYLES[perf.genre as keyof typeof GENRE_STYLES]?.twBg || 'bg-gray-600')}>
                                                        {GENRES.find(g => g.id === perf.genre)?.label}
                                                    </span>
                                                    <span className="text-[11px] text-gray-500 font-bold truncate">{perf.venue}</span>
                                                </div>
                                                <h4 className="text-sm sm:text-base font-black text-gray-900 dark:text-white leading-tight line-clamp-2 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">{perf.title}</h4>
                                                {(() => {
                                                    const loc = getPerformanceLocationLabel(perf, venues, 2);
                                                    return loc ? (
                                                        <span className="sm:hidden flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 font-bold mt-1">
                                                            <MapPin size={9} className="shrink-0" />{loc}
                                                        </span>
                                                    ) : null;
                                                })()}
                                            </div>
                                            {(() => {
                                                const loc = getPerformanceLocationLabel(perf, venues, 2);
                                                return loc ? (
                                                    <div className="hidden sm:flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 font-bold shrink-0 self-center">
                                                        <MapPin size={10} className="shrink-0" />{loc}
                                                    </div>
                                                ) : null;
                                            })()}
                                        </a>
                                    ))}

                                    {displayedDailyEvents.length < filteredEvents.length && (
                                        <div className="py-8 text-center text-xs text-gray-500 font-black animate-pulse uppercase tracking-widest">
                                            Loading More Data...
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                )}

                {/* Weekly View */}
                {calendarView === 'weekly' && (
                    <div className="flex-grow overflow-y-auto flex flex-col bg-gray-50 dark:bg-gray-950">
                        {eachDayOfInterval({
                            start: startOfWeek(currentMonth, { weekStartsOn: 0 }),
                            end: endOfWeek(currentMonth, { weekStartsOn: 0 })
                        }).map((day, idx) => {
                            const dayEvents = getPerformancesForDay(day);
                            const isToday = isSameDay(day, new Date());
                            const isSelectedDay = isSameDay(day, currentMonth);

                            return (
                                <div
                                    key={day.toISOString()}
                                    className={clsx(
                                        "flex border-b border-gray-200 dark:border-gray-900 min-h-[100px] last:border-b-0 cursor-pointer transition-colors active:bg-blue-50/20",
                                        isSelectedDay && "bg-blue-50/10 dark:bg-blue-900/5 ring-2 ring-inset ring-blue-500/20"
                                    )}
                                    onClick={() => {
                                        setCurrentMonth(day);
                                        setCalendarView('daily');
                                    }}
                                >
                                    <div className={clsx(
                                        "w-20 sm:w-32 flex flex-col items-center justify-center border-r border-gray-200 dark:border-gray-900 shrink-0 select-none",
                                        isToday ? "bg-blue-50/50 dark:bg-blue-900/10" : "bg-gray-50/30 dark:bg-gray-950/20"
                                    )}>
                                        <span className={clsx(
                                            "text-[10px] sm:text-xs font-black uppercase tracking-tighter",
                                            idx === 0 ? "text-red-500" : idx === 6 ? "text-blue-500" : "text-gray-500 dark:text-gray-400"
                                        )}>
                                            {format(day, 'eee', { locale: ko })}
                                        </span>
                                        <span className="text-xl sm:text-3xl font-black text-gray-900 dark:text-white leading-none mt-1">
                                            {format(day, 'd')}
                                        </span>
                                        <span className={clsx(
                                            "text-[10px] font-black mt-2 px-2 py-0.5 rounded-full border shadow-sm",
                                            dayEvents.length > 0 ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700" : "text-gray-400 border-transparent opacity-40 text-[9px]"
                                        )}>
                                            {dayEvents.length}
                                        </span>
                                    </div>

                                    <div className="flex-grow p-4 overflow-hidden relative group">
                                        <div className="flex flex-col gap-1.5 overflow-hidden">
                                            {dayEvents.slice(0, 10).map((perf, i) => (
                                                <a
                                                    key={`${perf.id}-${i}`}
                                                    href={getExternalContentLink(perf)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                                >
                                                    <span className={clsx("w-2 h-2 rounded-full shrink-0", GENRE_STYLES[perf.genre as keyof typeof GENRE_STYLES]?.twBg || 'bg-gray-400')} />
                                                    <span className="truncate">{perf.title}</span>
                                                </a>
                                            ))}
                                            {dayEvents.length > 10 && (
                                                <div className="text-[10px] text-gray-500 font-bold italic pl-4">외 {dayEvents.length - 10}건 더보기...</div>
                                            )}
                                            {dayEvents.length === 0 && (
                                                <div className="h-full flex items-center justify-center text-gray-300 dark:text-gray-700 font-black italic uppercase tracking-widest text-[10px]">No Events</div>
                                            )}
                                        </div>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                            <div className="bg-blue-600 text-white p-2 rounded-full shadow-lg">
                                                <ChevronRight size={16} strokeWidth={4} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Monthly View */}
                {calendarView === 'monthly' && (
                    <>
                        <div className="grid grid-cols-7 border-b border-gray-100 dark:border-gray-900 bg-gray-50 dark:bg-gray-950/50 shrink-0">
                            {['일', '월', '화', '수', '목', '금', '토'].map((day, idx) => (
                                <div key={day} className={clsx("py-3 text-center text-xs font-black uppercase tracking-widest", idx === 0 ? "text-red-500/80" : idx === 6 ? "text-blue-500/80" : "text-gray-400 dark:text-gray-500")}>
                                    {day}
                                </div>
                            ))}
                        </div>

                        <div className="grid grid-cols-7 flex-grow overflow-y-auto auto-rows-fr bg-gray-100 dark:bg-gray-900/50 gap-[1px]">
                            {dayList.map((day) => {
                                const dayEvents = getPerformancesForDay(day);
                                return (
                                    <CalendarDayCell
                                        key={day.toISOString()}
                                        day={day}
                                        currentMonth={currentMonth}
                                        dayEvents={dayEvents}
                                        onSelectDay={handleSelectDay}
                                    />
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
