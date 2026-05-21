'use client';

import { Performance } from '@/types';
import { GENRES, GENRE_STYLES, FUTURES_TEAM_LOGOS } from '@/lib/constants';
import { ExternalLink, MapPin, Calendar, Clock, Users, Star, Tag, Ticket, Share2, Check, Sparkles, Film, X, Play, BarChart3, Presentation, Phone, AlertCircle, Info, Coins, Globe, ParkingCircle, Wallet, Layers, Bath, Building2, AtSign, type LucideIcon } from 'lucide-react';
import { useState, useMemo, useRef } from 'react';
import Portal from './ui/Portal';
import { getOptimizedUrl, formatUnifiedDate, toMobileUrl } from '@/lib/utils';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { getExternalContentLink } from '@/lib/performance-links';
import { getDdayLabel } from '@/lib/dday';
import { formatCompactKoreanDateTime } from '@/lib/build-info';
import { getSourceLabel, getSourceOfficialUrl } from '@/lib/source-registry';
import { buildSportsContext, isRedundantSportsDescription } from '@/lib/sports-context';
import { getSportsTicketingInfo } from '@/lib/sports-ticketing';

interface ContentDetailViewProps {
    performance: Performance;
    allPerformances?: Performance[];
    mode?: 'modal' | 'standalone';
    onClose?: () => void;
}

type DetailPerformance = Performance & {
    runtime?: string | number;
    budgetKRW?: string | number;
    revenueKRW?: string | number;
    roi?: string | number;
};

type DetailInfoItem = {
    icon: LucideIcon;
    label: string;
    text: string | number;
    color: string;
    isLink?: boolean;
    href?: string;
    onClick?: React.MouseEventHandler;
    linkTitle?: string;
    rightText?: string | null;
};

const formatKoreanNumber = (value: string | number) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return String(value);
    return new Intl.NumberFormat('ko-KR').format(numericValue);
};

const formatApproxEokValue = (value: string | number) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return null;
    return new Intl.NumberFormat('ko-KR').format(Math.round(numericValue / 100000000));
};

const normalizeDetailText = (value: unknown) => String(value ?? '')
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim();

const compactDetailText = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim();

const comparableDetailText = (value: unknown) => compactDetailText(value)
    .replace(/[·ㆍ,./\\\-_:|"'“”‘’()[\]\s]/g, '')
    .toLowerCase();

const isGenericPerformanceState = (value?: string | null) => {
    const text = compactDetailText(value);
    return /^(공연예정|예정|판매예정)$/u.test(text);
};

const isRedundantAgeDetail = (ageDetail?: string | null, ...ageValues: Array<string | undefined | null>) => {
    const detail = comparableDetailText(ageDetail);
    if (!detail) return true;

    return ageValues
        .map(value => comparableDetailText(value))
        .filter(Boolean)
        .some(age => detail === age || (detail.includes(age) && detail.length <= age.length + 8));
};

const isGeneratedSummaryDescription = (performance: Performance, value?: string | null) => {
    const text = compactDetailText(value);
    if (!text || performance.genre === 'movie') return false;
    const comparableText = comparableDetailText(text);

    const patterns = [
        /에서\s+진행되는\s+.+입니다/u,
        /일정은\s+.+기준입니다/u,
        /위치는\s+.+입니다/u,
        /현장\s+편의\s+정보는\s+.+입니다/u,
        /이용\s+정보는\s+.+기준입니다/u,
    ];
    const signalCount = patterns.filter((pattern) => pattern.test(text)).length;

    if (signalCount >= 3) return true;

    const title = compactDetailText(performance.title);
    const startsWithTitleSummary = Boolean(title && (
        text.startsWith(`${title}는 `)
        || text.startsWith(`"${title}"는 `)
        || text.startsWith(`'${title}'는 `)
    ));

    if (startsWithTitleSummary && signalCount >= 2) return true;

    const redundantFieldHits = [
        performance.venue,
        performance.address,
        performance.date,
        performance.performanceTime,
        performance.price,
        performance.priceDetail,
        performance.facilities,
    ]
        .map((field) => comparableDetailText(field))
        .filter((field) => field.length >= 4 && comparableText.includes(field))
        .length;

    return startsWithTitleSummary && signalCount >= 1 && redundantFieldHits >= 3;
};

const formatWebsiteLabel = (value: string) => {
    const label = compactDetailText(value)
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, 'www.')
        .replace(/\/+$/, '');
    return label || value;
};

const formatParkingLabel = (value?: string | null) => {
    const text = compactDetailText(value);
    if (!text) return '';

    const normalized = text.toLowerCase();
    if (/^(y|yes|true|가능|있음|무료가능|유료가능)$/.test(normalized)) return '주차가능';
    if (/^(n|no|false|불가|없음)$/.test(normalized)) return '주차불가';
    return text
        .replace(/^y$/i, '주차가능')
        .replace(/^n$/i, '주차불가');
};

const getFullImageHref = (image: string) => {
    if (!image) return '#';
    if (!image.startsWith('/')) return image;

    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    return basePath && !image.startsWith(basePath) ? `${basePath}${image}` : image;
};

const getDetailHeroImageUrl = (image: string) => getOptimizedUrl(image, 960, 88);

const formatSourceTimestampLabel = (value?: string | null) => {
    const raw = compactDetailText(value || '');
    if (!raw) return null;

    if (/^\d{2}\.\d{2}\.\d{2}\s*\(.+\)/.test(raw)) {
        return raw;
    }

    const dotDateTime = raw.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/);
    const parsed = dotDateTime
        ? new Date(`${dotDateTime[1]}-${dotDateTime[2].padStart(2, '0')}-${dotDateTime[3].padStart(2, '0')}T${(dotDateTime[4] || '00').padStart(2, '0')}:${dotDateTime[5] || '00'}:00+09:00`)
        : new Date(raw);

    if (!Number.isNaN(parsed.getTime())) {
        return formatCompactKoreanDateTime(parsed.toISOString());
    }

    return raw;
};

const formatOfficialUpdateLabel = (value?: string | null) => {
    const raw = compactDetailText(value || '');
    if (!raw) return null;

    const dotDate = raw.match(/^(\d{4})\.(\d{1,2})\.(\d{1,2})/);
    if (dotDate) {
        return `${dotDate[1]}.${dotDate[2].padStart(2, '0')}.${dotDate[3].padStart(2, '0')}`;
    }

    const hyphenDate = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (hyphenDate) {
        return `${hyphenDate[1]}.${hyphenDate[2].padStart(2, '0')}.${hyphenDate[3].padStart(2, '0')}`;
    }

    return raw;
};

const buildNaverRoadviewUrl = (address: string) => {
    const query = compactDetailText(address);
    if (!query) return null;

    // Naver Maps uses `adh` in the c-parameter to open with the street-view layer active.
    return `https://map.naver.com/p/search/${encodeURIComponent(query)}?c=19.00,0,0,0,adh`;
};

const formatPersonName = (value: unknown) => compactDetailText(value)
    .replace(/\s*(?:등|외\s*\d*명?)$/u, '')
    .trim();

const buildNaverPersonSearchUrl = (name: string) => {
    const query = encodeURIComponent(name);
    return `https://search.naver.com/search.naver?where=nexearch&sm=top_hty&fbm=0&ie=utf8&query=${query}`;
};

const dedupeDetailInfoItems = <T extends { label: string; text?: unknown }>(items: T[]) => {
    const seen = new Set<string>();
    return items.filter((item) => {
        const text = compactDetailText(item.text);
        if (!text) return false;
        const key = `${item.label}::${text}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

export default function ContentDetailView({ performance: p, allPerformances = [], mode = 'modal', onClose }: ContentDetailViewProps) {
    const router = useRouter();
    const detail = p as DetailPerformance;
    const isMobile = useMemo(() => {
        if (typeof navigator === 'undefined') return false;
        return /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test((navigator.userAgent || '').toLowerCase());
    }, []);

    const genreStyle = GENRE_STYLES[p.genre] || GENRE_STYLES['all'];
    const genreLabel = GENRES.find(g => g.id === p.genre)?.label || p.genre;

    const isSports = ['volleyball', 'basketball', 'baseball', 'handball', 'soccer'].includes(p.genre);
    const hasTeams = p.homeTeam && p.awayTeam;

    const castMembers = useMemo(() => {
        if (!p.cast || p.cast.length === 0) return [];

        const seen = new Set<string>();
        return p.cast
            .map((cast) => {
                const rawName = typeof cast === 'string' ? cast : cast.name;
                const name = formatPersonName(rawName);
                if (!name) return null;

                const key = comparableDetailText(name);
                if (!key || seen.has(key)) return null;
                seen.add(key);

                const explicitUrl = typeof cast === 'string' ? undefined : cast.url;
                return {
                    name,
                    url: explicitUrl || buildNaverPersonSearchUrl(name),
                };
            })
            .filter((cast): cast is { name: string; url: string } => Boolean(cast));
    }, [p.cast]);
    const hasCast = castMembers.length > 0;
    const rawImg = p.image || p.poster || p.backupPoster || p.posterUrl || '';
    const [imgSrc, setImgSrc] = useState(rawImg ? getDetailHeroImageUrl(rawImg) : '');
    const fallbackImg = p.backupPoster || p.posterUrl || p.poster || '';
    const fallbackImgSrc = fallbackImg ? getDetailHeroImageUrl(fallbackImg) : '';
    const isMomMomSource = (p.source || '').startsWith('mommom');
    const galleryLabel = isMomMomSource ? '상품 상세 이미지' : (p.genre === 'tourism' ? '여행지 사진' : '공연 소개 이미지');
    const galleryLimit = isMomMomSource || p.genre === 'tourism' ? 8 : 4;
    const galleryThumbWidth = isMomMomSource ? 520 : 360;
    const galleryThumbQuality = isMomMomSource ? 76 : 66;
    const galleryAspectClass = isMomMomSource ? 'aspect-[3/4]' : (p.genre === 'tourism' ? 'aspect-video' : 'aspect-[4/5]');
    const galleryImageClass = isMomMomSource
        ? 'w-full h-auto object-contain bg-white dark:bg-white'
        : `${galleryAspectClass} w-full object-cover`;
    const dDayLabel = getDdayLabel(p);
    const movieStatsReferenceLabel = p.statsCollectedAt
        ? `${formatCompactKoreanDateTime(p.statsCollectedAt)} 수집`
        : null;
    const sourceLabel = getSourceLabel(p.source || 'unknown');
    const sourceUrl = getSourceOfficialUrl(p.source, p.link);
    const collectedAtLabel = formatSourceTimestampLabel(
        p.dataCollectedAt || p.statsCollectedAt || p.lastModifiedAt
    );
    const officialUpdateLabel = formatOfficialUpdateLabel(p.sourceUpdatedAt);
    const visibleAgeDetail = normalizeDetailText(p.ageDetail);
    const shouldShowAgeDetail = Boolean(visibleAgeDetail && !isRedundantAgeDetail(visibleAgeDetail, p.age, p.ageRating));
    const sportsContext = useMemo(
        () => buildSportsContext(p, allPerformances),
        [p, allPerformances]
    );
    const sportsTicketingInfo = useMemo(() => getSportsTicketingInfo(p), [p]);
    
    // Unified Booking Link Logic with Fallback for Missing Data
    const bookingUrl = useMemo(
        () => getExternalContentLink(p, { mobile: isMobile }),
        [p, isMobile]
    );

    const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'shared' | 'error'>('idle');
    const shareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleShare = async (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const url = `${window.location.origin}${window.location.pathname}${mode === 'modal' ? `#p=${p.id}` : ''}`;

        // Prefer native share sheet on mobile. Falls through to clipboard on
        // unsupported browsers or when the user cancels the share dialog (the
        // promise rejects with AbortError).
        try {
            if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
                try {
                    await navigator.share({ title: p.title, url });
                    setShareStatus('shared');
                } catch (err) {
                    // User cancelled - silently fall through to clipboard copy
                    // so they still get a usable result.
                    if ((err as DOMException)?.name === 'AbortError') {
                        await navigator.clipboard.writeText(url);
                        setShareStatus('copied');
                    } else {
                        throw err;
                    }
                }
            } else {
                await navigator.clipboard.writeText(url);
                setShareStatus('copied');
            }
        } catch (err) {
            console.warn('handleShare failed', err);
            setShareStatus('error');
        }

        if (shareTimerRef.current) clearTimeout(shareTimerRef.current);
        shareTimerRef.current = setTimeout(() => setShareStatus('idle'), 2000);
    };

    const handleClose = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (onClose) {
            onClose();
        } else {
            // If there's meaningful history, go back
            if (typeof window !== 'undefined' && window.history.length > 2) {
                router.back();
            } else {
                router.push('/');
            }
        }
    };

    const handleBackgroundClick = (e: React.MouseEvent) => {
        // Only close if clicking the actual container and not its children
        if (e.target === e.currentTarget) {
            handleClose(e);
        }
    };

    const handleVenueClick = (e: React.MouseEvent) => {
        if (p.lat && p.lng) {
            e.preventDefault();
            const mapUrl = `/?mode=location&lat=${p.lat}&lng=${p.lng}&venue=${encodeURIComponent(p.venue)}`;
            if (onClose) onClose();
            router.push(mapUrl);
        }
    };

    const containerVariants: Variants = {
        hidden: { opacity: 0, scale: 0.95 },
        visible: {
            opacity: 1,
            scale: 1,
            transition: {
                staggerChildren: 0.1,
                duration: 0.4,
                ease: "easeOut"
            }
        }
    };

    const itemVariants: Variants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    const containerClasses = mode === 'standalone'
        ? "w-full max-w-[380px] md:max-w-[1000px] mx-auto bg-white dark:bg-gray-900 rounded-[32px] shadow-2xl overflow-hidden border border-black/5 dark:border-white/10"
        : "relative w-full h-full lg:h-auto lg:max-h-[90vh] lg:max-w-[1000px] bg-white text-gray-900 dark:bg-[#070b14] dark:text-white rounded-[32px] shadow-[0_32px_64px_rgba(0,0,0,0.6)] overflow-hidden border border-black/10 dark:border-white/10";
    const normalizedDescription = normalizeDetailText(p.description);
    const displayDescription = (isGeneratedSummaryDescription(p, normalizedDescription) || isRedundantSportsDescription(p, normalizedDescription)) ? '' : normalizedDescription;
    const movieSynopsisText = p.genre === 'movie' ? normalizeDetailText(p.synopsis || displayDescription) : '';
    const hasLongDescription = Boolean(displayDescription && displayDescription.length > 150 && p.genre !== 'movie');
    const hasMovieSynopsis = Boolean(movieSynopsisText);
    const shouldShowShortDescription = Boolean(
        displayDescription
        && p.genre !== 'tourism'
        && !hasLongDescription
        && !hasMovieSynopsis
    );

    return (
        <div 
            className={mode === 'standalone' ? "relative z-10 min-h-screen w-full flex items-center justify-center p-4 cursor-pointer" : "relative"}
            onClick={handleBackgroundClick}
        >
            <motion.div
                initial="hidden"
                animate="visible"
                variants={containerVariants}
                className={containerClasses}
                data-cf-detail-view={mode}
            >
                {/* Close Button UI - Moved to container level to stay fixed */}
                {/* Close Button UI - Stay fixed in top-right */}
                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleClose}
                    className="absolute top-6 right-6 p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white z-50 hover:bg-black/60 transition-colors shadow-xl dark:bg-white/10 dark:hover:bg-white/20 dark:border-white/20"
                >
                    <X className="w-6 h-6" />
                </motion.button>

                <div className={`overflow-y-auto md:overflow-hidden overflow-x-hidden ${mode === 'standalone' ? 'max-h-none' : 'max-h-[85vh] lg:max-h-none md:max-h-none'} scrollbar-hide`}>
                    <div className="flex flex-col md:flex-row md:min-h-[600px] lg:h-[85vh]">
                    {/* Hero / Poster Section */}
                    {imgSrc && (
                        <div className={mode === 'standalone' 
                            ? "relative w-full md:w-[42%] aspect-[3/4] md:aspect-auto shrink-0 group cursor-default overflow-hidden" 
                            : "relative h-60 sm:h-[450px] lg:h-full lg:w-[42%] w-full group cursor-default overflow-hidden shrink-0"}>
                            <motion.img
                                initial={{ scale: 1.05 }}
                                animate={{ scale: 1 }}
                                transition={{ duration: 1.2, ease: "easeOut" }}
                                src={imgSrc}
                                alt={p.title}
                                className="w-full h-full object-cover transition-transform duration-700"
                                referrerPolicy="no-referrer"
                                onError={() => {
                                    if (fallbackImgSrc && imgSrc !== fallbackImgSrc) {
                                        setImgSrc(fallbackImgSrc);
                                    } else {
                                        setImgSrc('');
                                    }
                                }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                            

                            {/* Play Button Overlay */}
                            <div className="absolute inset-0 flex items-center justify-center z-10">
                                <motion.a
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    href={isMobile ? toMobileUrl(`https://www.youtube.com/results?search_query=${encodeURIComponent(p.title + (p.genre === 'movie' ? ' 예고편' : ''))}`) : `https://www.youtube.com/results?search_query=${encodeURIComponent(p.title + (p.genre === 'movie' ? ' 예고편' : ''))}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm border border-white/30 flex items-center justify-center text-white shadow-2xl transition-all hover:bg-black/70"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <Play className="w-8 h-8 fill-current translate-x-0.5" />
                                </motion.a>
                            </div>

                            {/* Sports VS Overlay */}
                            {isSports && hasTeams && (
                                <div className="absolute inset-x-0 bottom-6 flex items-center justify-center pointer-events-none px-6">
                                    <div className="flex justify-between items-center w-full gap-4">
                                        <motion.img
                                            initial={{ x: -30, opacity: 0, rotate: -10 }}
                                            animate={{ x: 0, opacity: 1, rotate: 0 }}
                                            transition={{ delay: 0.5, type: 'spring' }}
                                            src={p.genre === 'baseball' && p.homeTeam && FUTURES_TEAM_LOGOS[p.homeTeam] ? FUTURES_TEAM_LOGOS[p.homeTeam] : p.homeTeamLogo}
                                            alt={p.homeTeam}
                                            className="w-1/4 aspect-square object-contain drop-shadow-[0_12px_32px_rgba(255,255,255,0.3)]"
                                        />
                                        <div className="text-white text-xl font-black italic bg-black/40 px-4 py-1 rounded-full backdrop-blur-md border border-white/10 shadow-lg">VS</div>
                                        <motion.img
                                            initial={{ x: 30, opacity: 0, rotate: 10 }}
                                            animate={{ x: 0, opacity: 1, rotate: 0 }}
                                            transition={{ delay: 0.5, type: 'spring' }}
                                            src={p.genre === 'baseball' && p.awayTeam && FUTURES_TEAM_LOGOS[p.awayTeam] ? FUTURES_TEAM_LOGOS[p.awayTeam] : p.awayTeamLogo}
                                            alt={p.awayTeam}
                                            className="w-1/4 aspect-square object-contain drop-shadow-[0_12px_32px_rgba(255,255,255,0.3)]"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Main Content Area */}
                    <div className={mode === 'standalone' 
                        ? "p-6 md:p-8 lg:p-12 space-y-5 flex-1 md:overflow-y-auto md:h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-white" 
                        : "p-6 sm:p-8 lg:p-12 space-y-4 sm:space-y-8 lg:space-y-10 flex-1 lg:overflow-y-auto lg:h-full bg-white text-gray-900 dark:bg-[#070b14] dark:text-white scrollbar-hide"}>
                        
                        <div className="space-y-4">
                            <motion.div variants={itemVariants} className="space-y-3">
                                {/* Genre badge next to title */}
                                {/* Category badge above title */}
                                <div className="flex flex-col gap-2.5">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <motion.span
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className={`px-3 py-1 rounded-md text-[10px] font-black text-white ${genreStyle.twBg} shadow-sm tracking-widest uppercase border border-white/10 w-fit`}
                                        >
                                            {genreLabel}
                                        </motion.span>
                                        {dDayLabel && (
                                            <span className="inline-flex items-center rounded-full border border-black/10 bg-black/5 px-3 py-1 text-[10px] font-black tracking-[0.16em] text-gray-600 dark:border-white/15 dark:bg-white/5 dark:text-gray-200">
                                                {dDayLabel}
                                            </span>
                                        )}
                                    </div>
                                    <h2 className="text-[22px] md:text-2xl font-black leading-[1.2] tracking-tighter drop-shadow-sm">
                                        {p.title}
                                    </h2>
                                </div>
                                
                                 {p.originalTitle && (
                                    <p className="text-[12px] text-gray-400 font-medium italic opacity-70 tracking-wide mt-[-4px]">{p.originalTitle}</p>
                                )}
                            </motion.div>

                            {/* Info List - 1 Column Narrow Style */}
                            <motion.div variants={itemVariants} className="space-y-2.5">
                                {(() => {
                                    const isMovie = p.genre === 'movie';
                                    let movieRating = p.ageRating || p.age || p.venue || '';
                                    if (movieRating) {
                                        if (movieRating.includes('전체')) movieRating = '전체 관람가';
                                        else if (movieRating.includes('12')) movieRating = '12세 이상 관람가';
                                        else if (movieRating.includes('15')) movieRating = '15세 이상 관람가';
                                        else if (movieRating.includes('18') || movieRating.includes('청소년') || movieRating.includes('불가') || movieRating.includes('청불')) movieRating = '청소년 관람불가';
                                    }

                                    const infoItems: DetailInfoItem[] = [];

                                    if (isMovie && movieRating) {
                                        infoItems.push({ icon: Film, label: '등급', text: movieRating, color: 'text-emerald-500' });
                                    } else if (!isMovie && p.venue) {
                                        infoItems.push({ 
                                            icon: Building2, 
                                            label: '장소', 
                                            text: p.venue, 
                                            color: 'text-emerald-500', 
                                            isLink: !!(p.lat && p.lng), 
                                            onClick: handleVenueClick 
                                        });
                                    }

                                    if (p.genre === 'tourism' && p.status) {
                                        infoItems.push({ icon: Star, label: '상태', text: p.status, color: 'text-amber-500' });
                                    }

                                    if (p.address && p.address.trim() !== '') {
                                        const naverRoadviewUrl = buildNaverRoadviewUrl(p.address);
                                        infoItems.push({ 
                                            icon: MapPin, 
                                            label: '주소', 
                                            text: p.address, 
                                            color: 'text-gray-400',
                                            isLink: Boolean(naverRoadviewUrl),
                                            href: naverRoadviewUrl || undefined,
                                            linkTitle: '네이버 거리뷰로 새 창에서 보기',
                                        });
                                    }

                                    const dateText = formatUnifiedDate(p.date);
                                    if (dateText && p.genre !== 'tourism') {
                                        infoItems.push({ icon: Calendar, label: isMovie ? '개봉' : '일정', text: dateText, color: 'text-blue-500' });
                                    }

                                    const operatingHoursText = normalizeDetailText(p.operatingHours);
                                    const performanceTimeText = normalizeDetailText(p.performanceTime);
                                    const runtimeText = normalizeDetailText(detail.runtime || p.runningTime);
                                    if (operatingHoursText) {
                                        infoItems.push({ icon: Clock, label: '운영시간', text: operatingHoursText, color: 'text-purple-500' });
                                    }
                                    if (performanceTimeText && !operatingHoursText && p.genre === 'tourism') {
                                        infoItems.push({ icon: Clock, label: '운영시간', text: performanceTimeText, color: 'text-purple-500' });
                                    } else if (performanceTimeText && compactDetailText(performanceTimeText) !== compactDetailText(operatingHoursText) && p.genre !== 'tourism') {
                                        infoItems.push({
                                            icon: Clock,
                                            label: operatingHoursText ? '공연시간' : '시간',
                                            text: performanceTimeText,
                                            color: operatingHoursText ? 'text-cyan-500' : 'text-purple-500'
                                        });
                                    }
                                    if (
                                        runtimeText
                                        && compactDetailText(runtimeText) !== compactDetailText(performanceTimeText)
                                        && compactDetailText(runtimeText) !== compactDetailText(operatingHoursText)
                                    ) {
                                        infoItems.push({
                                            icon: Clock,
                                            label: performanceTimeText || operatingHoursText ? '공연시간' : '시간',
                                            text: runtimeText.includes('분') || runtimeText.includes('시간') ? runtimeText : `${runtimeText}분`,
                                            color: 'text-purple-500'
                                        });
                                    }

                                    const performanceStateText = normalizeDetailText(p.performanceState);
                                    if (!isMovie && performanceStateText && !isGenericPerformanceState(performanceStateText)) {
                                        infoItems.push({ icon: Info, label: '상태', text: performanceStateText, color: 'text-amber-500' });
                                    }

                                    if (!isMovie && (p.openRun === true || p.openRun === 'Y' || p.openRun === 'true')) {
                                        infoItems.push({ icon: Calendar, label: '오픈런', text: '상시 진행', color: 'text-emerald-500' });
                                    }
                                    
                                    if (isMovie) {
                                        if (p.reservationRate) {
                                            infoItems.push({
                                                icon: BarChart3,
                                                label: '예매율',
                                                text: p.reservationRate,
                                                color: 'text-rose-500',
                                                rightText: movieStatsReferenceLabel
                                            });
                                        }
                                        if (p.audienceCount) {
                                            infoItems.push({
                                                icon: Users,
                                                label: '관객수',
                                                text: p.audienceCount,
                                                color: 'text-blue-400',
                                                rightText: movieStatsReferenceLabel
                                            });
                                        }
                                        if (detail.budgetKRW) {
                                            const formatted = formatKoreanNumber(detail.budgetKRW);
                                            const approxEok = formatApproxEokValue(detail.budgetKRW);
                                            infoItems.push({ icon: Coins, label: '제작비', text: approxEok ? `₩${formatted} (약 ${approxEok}억원)` : `₩${formatted}`, color: 'text-amber-500' });
                                        }
                                        if (detail.revenueKRW) {
                                            const formatted = formatKoreanNumber(detail.revenueKRW);
                                            const approxEok = formatApproxEokValue(detail.revenueKRW);
                                            infoItems.push({ icon: Wallet, label: '수익', text: approxEok ? `₩${formatted} (약 ${approxEok}억원)` : `₩${formatted}`, color: 'text-emerald-500' });
                                        }
                                        if (detail.roi) {
                                            infoItems.push({ icon: Presentation, label: '수익률', text: detail.roi, color: 'text-purple-400' });
                                        }
                                        if (p.platforms && p.platforms.length > 0) {
                                            infoItems.push({ icon: Globe, label: 'OTT', text: p.platforms.slice(0, 5).join(', '), color: 'text-cyan-500' });
                                        }
                                        if (p.voteAverage) {
                                            const voteText = p.voteCount ? `${p.voteAverage} / 10 (${Number(p.voteCount).toLocaleString()}명)` : `${p.voteAverage} / 10`;
                                            infoItems.push({ icon: Star, label: '평점', text: voteText, color: 'text-yellow-500' });
                                        }
                                    }

                                    if (!isMovie && (p.age || p.ageRating)) {
                                        const ageText = p.age || p.ageRating || '';
                                        // Prevent showing the exact same text twice (e.g. if age and ageRating are same)
                                        infoItems.push({ icon: Tag, label: '연령', text: ageText, color: 'text-rose-500' });
                                    }

                                    if (p.director) {
                                        infoItems.push({ 
                                            icon: Users, 
                                            label: '감독', 
                                            text: p.director, 
                                            color: 'text-indigo-500', 
                                            isLink: isMovie, 
                                            onClick: () => {
                                                const url = `https://search.naver.com/search.naver?query=${encodeURIComponent(p.director || '')}`;
                                                window.open(isMobile ? toMobileUrl(url) : url, '_blank');
                                            }
                                        });
                                    }

                                    // Advanced KOPIS metadata with deduplication
                                    const dedupeJoin = (items: { val?: string, label: string }[]) => {
                                        const valid = items.filter(i => i.val && i.val.trim() !== '');
                                        if (valid.length === 0) return '';
                                        
                                        // Group by identical values
                                        const groups: Record<string, string[]> = {};
                                        valid.forEach(i => {
                                            if (!groups[i.val!]) groups[i.val!] = [];
                                            groups[i.val!].push(i.label);
                                        });

                                        return Object.entries(groups).map(([val, labels]) => 
                                            `${val}(${labels.join('/')})`
                                        ).join(', ');
                                    };

                                    const hostOrg = dedupeJoin([
                                        { val: p.host, label: '주최' },
                                        { val: p.organizer, label: '주관' }
                                    ]);
                                    if (hostOrg) {
                                        infoItems.push({ icon: Users, label: '주최/주관', text: hostOrg, color: 'text-indigo-400' });
                                    }

                                    const planProd = dedupeJoin([
                                        { val: p.planner, label: '기획' },
                                        { val: p.producer, label: '제작' }
                                    ]);
                                    
                                    if (planProd) {
                                        infoItems.push({ icon: Sparkles, label: '기획/제작', text: planProd, color: 'text-amber-400' });
                                    } else if (p.production && !hostOrg.includes(p.production)) {
                                        infoItems.push({ icon: Sparkles, label: '제작/기획', text: p.production, color: 'text-amber-400' });
                                    }

                                    if (p.sponsor) {
                                        infoItems.push({ icon: Star, label: '후원', text: p.sponsor, color: 'text-yellow-400' });
                                    }

                                    if (p.contact) {
                                        infoItems.push({ icon: Phone, label: '문의', text: p.contact, color: 'text-emerald-400' });
                                    }

                                    if (p.reservationInfo) {
                                        infoItems.push({ icon: Ticket, label: '예약', text: p.reservationInfo, color: 'text-orange-400' });
                                    }

                                    if (p.instagram) {
                                        const instagramHandle = compactDetailText(p.instagram)
                                            .replace(/^@/, '')
                                            .replace(/^https?:\/\/(www\.)?instagram\.com\//, '')
                                            .replace(/\/$/, '');
                                        const instagramUrl = p.instagram.startsWith('http')
                                            ? p.instagram
                                            : `https://www.instagram.com/${instagramHandle}/`;
                                        infoItems.push({
                                            icon: AtSign,
                                            label: '인스타그램',
                                            text: instagramHandle,
                                            color: 'text-pink-500',
                                            isLink: true,
                                            href: instagramUrl,
                                            linkTitle: '인스타그램 새 창에서 보기',
                                        });
                                    }

                                     if (p.price && !p.priceList) {
                                         infoItems.push({ icon: Ticket, label: '가격', text: p.price, color: 'text-orange-500' });
                                     } else if (sportsTicketingInfo?.ticketBay?.label) {
                                         infoItems.push({
                                             icon: Ticket,
                                             label: '참고가',
                                             text: sportsTicketingInfo.ticketBay.label,
                                             color: 'text-orange-500',
                                             isLink: true,
                                             href: sportsTicketingInfo.ticketBay.url,
                                             linkTitle: `${sportsTicketingInfo.ticketBay.sourceLabel} 새 창에서 보기`,
                                         });
                                     }

                                     if (!isMovie && p.priceDetail && compactDetailText(p.priceDetail) !== compactDetailText(p.price)) {
                                         infoItems.push({ icon: Coins, label: '상세 요금', text: p.priceDetail, color: 'text-amber-500' });
                                     }

                                    if (p.closedDays) {
                                        infoItems.push({ icon: Info, label: '휴무일', text: p.closedDays, color: 'text-rose-400' });
                                    }

                                    if (p.website) {
                                        infoItems.push({ 
                                            icon: Globe, 
                                            label: '홈페이지', 
                                            text: formatWebsiteLabel(p.website),
                                            color: 'text-cyan-400', 
                                            isLink: true, 
                                            onClick: () => {
                                                const url = p.website!.startsWith('http') ? p.website! : `https://${p.website}`;
                                                window.open(isMobile ? toMobileUrl(url) : url, '_blank');
                                            }
                                        });
                                    }

                                    if (p.parking) {
                                        infoItems.push({ icon: ParkingCircle, label: '주차', text: formatParkingLabel(p.parking), color: 'text-blue-500' });
                                    }

                                    if (p.parkingFee) {
                                        infoItems.push({ icon: Wallet, label: '주차요금', text: p.parkingFee, color: 'text-orange-400' });
                                    }

                                    if (p.facilities) {
                                        infoItems.push({ icon: Layers, label: '주요시설', text: p.facilities, color: 'text-teal-400' });
                                    }

                                    if (p.venueSeatScale) {
                                        const seatText = String(p.venueSeatScale).includes('석') ? String(p.venueSeatScale) : `${p.venueSeatScale}석`;
                                        infoItems.push({ icon: Building2, label: '객석', text: seatText, color: 'text-slate-400' });
                                    }

                                    if (p.venueAmenities && p.venueAmenities.length > 0) {
                                        infoItems.push({ icon: Layers, label: '편의시설', text: p.venueAmenities.slice(0, 8).join(', '), color: 'text-teal-400' });
                                    }

                                    if (p.restrooms) {
                                        infoItems.push({ icon: Bath, label: '화장실', text: p.restrooms, color: 'text-blue-300' });
                                    }

                                    return dedupeDetailInfoItems(infoItems).map((item, idx) => (
                                        <div key={idx} className="flex items-start justify-between gap-4 py-2 border-b border-gray-50 dark:border-white/5 last:border-0">
                                            <div className="flex items-start gap-3 min-w-0 flex-1">
                                                <div className="grid w-[6.75rem] shrink-0 grid-cols-[1rem_1fr] items-start gap-2 mt-[2px]">
                                                    <item.icon className={`w-4 h-4 shrink-0 ${item.color} opacity-80`} />
                                                    <span className="text-[12px] font-bold text-gray-500 dark:text-gray-400 whitespace-nowrap leading-4">{item.label}</span>
                                                </div>
                                                <div className="flex flex-col gap-1 flex-1 min-w-0">
                                                    {item.isLink ? (
                                                        item.href ? (
                                                            <a
                                                                href={item.href}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                title={item.linkTitle}
                                                                aria-label={item.linkTitle || `${item.label} 링크 열기`}
                                                                className="text-[14.5px] text-emerald-600 dark:text-emerald-400 font-extrabold text-left hover:underline flex items-center gap-1.5 w-fit"
                                                            >
                                                                <span className="break-all">{item.text}</span>
                                                                <ExternalLink className="w-3 h-3 opacity-50 shrink-0" />
                                                            </a>
                                                        ) : (
                                                            <button
                                                                onClick={item.onClick!}
                                                                title={item.linkTitle}
                                                                aria-label={item.linkTitle || `${item.label} 링크 열기`}
                                                                className="text-[14.5px] text-emerald-600 dark:text-emerald-400 font-extrabold text-left hover:underline flex items-center gap-1.5 w-fit"
                                                            >
                                                                <span className="break-all">{item.text}</span>
                                                                <ExternalLink className="w-3 h-3 opacity-50 shrink-0" />
                                                            </button>
                                                        )
                                                    ) : (
                                                        <p className="text-[14.5px] text-gray-700 dark:text-gray-300 font-bold whitespace-pre-wrap leading-relaxed">
                                                            {item.text}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            {item.rightText && (
                                                <span className="shrink-0 pt-[2px] text-right text-[12px] font-bold text-gray-400 dark:text-gray-500 whitespace-nowrap">
                                                    {item.rightText}
                                                </span>
                                            )}
                                        </div>
                                    ));
                                })()}
                            </motion.div>

                            {/* Enhanced Price List (Table style) */}
                            {p.priceList && p.priceList.length > 0 && (
                                <motion.div variants={itemVariants} className="mt-4 bg-gray-50 dark:bg-white/5 rounded-xl p-4 border border-black/5 dark:border-white/5">
                                    <h4 className="text-[13px] font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                                        <Coins className="w-4 h-4 text-orange-400" />
                                        상세 가격 정보
                                    </h4>
                                    <div className="space-y-1.5">
                                        {p.priceList.map((item, idx) => (
                                            <div key={idx} className="flex items-center justify-between text-[13.5px]">
                                                <span className="text-gray-500 dark:text-gray-400 font-medium">{item.label}</span>
                                                <div className="flex items-center gap-2">
                                                    {item.discount && <span className="text-[11px] font-bold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded">{item.discount}</span>}
                                                    <span className="text-gray-900 dark:text-white font-extrabold">{item.price}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            {/* Source-provided program / fee details */}
                            {p.feesAndPrograms && (
                                <motion.div variants={itemVariants} className="mt-4 bg-purple-50/50 dark:bg-purple-500/5 rounded-xl p-4 border border-purple-500/10">
                                    <h4 className="text-[13px] font-bold text-purple-600 dark:text-purple-400 mb-2 flex items-center gap-1.5">
                                        <Presentation className="w-4 h-4" />
                                        {p.source === 'festival' ? '행사내용' : '요금 및 프로그램'}
                                    </h4>
                                    <p className="text-[13.5px] text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line font-medium">
                                        {p.feesAndPrograms}
                                    </p>
                                </motion.div>
                            )}

                            {p.foodInfo && (
                                <motion.div variants={itemVariants} className="mt-4 bg-emerald-50/50 dark:bg-emerald-500/5 rounded-xl p-4 border border-emerald-500/10">
                                    <h4 className="text-[13px] font-bold text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
                                        <Ticket className="w-4 h-4" />
                                        먹거리 정보
                                    </h4>
                                    <p className="text-[13.5px] text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line font-medium">
                                        {p.foodInfo.replace(/^먹거리 정보\s*/u, '')}
                                    </p>
                                </motion.div>
                            )}

                            {/* Detailed Notices & Age Rules */}
                            {(shouldShowAgeDetail || p.bookingNotice) && (
                                <motion.div variants={itemVariants} className="mt-4 space-y-3">
                                    {shouldShowAgeDetail && (
                                        <div className="bg-blue-50/50 dark:bg-blue-500/5 rounded-xl p-4 border border-blue-500/10">
                                            <h4 className="text-[13px] font-bold text-blue-600 dark:text-blue-400 mb-1.5 flex items-center gap-1.5">
                                                <Info className="w-4 h-4" />
                                                관람/입장 연령 안내
                                            </h4>
                                            <p className="text-[13px] text-blue-800/80 dark:text-blue-300/80 leading-relaxed whitespace-pre-line font-medium">
                                                {visibleAgeDetail}
                                            </p>
                                        </div>
                                    )}
                                    {p.bookingNotice && (
                                        <div className="bg-amber-50/50 dark:bg-amber-500/5 rounded-xl p-4 border border-amber-500/10">
                                            <h4 className="text-[13px] font-bold text-amber-600 dark:text-amber-400 mb-1.5 flex items-center gap-1.5">
                                                <AlertCircle className="w-4 h-4" />
                                                예매시 유의사항
                                            </h4>
                                            <p className="text-[13px] text-amber-800/80 dark:text-amber-300/80 leading-relaxed whitespace-pre-line font-medium">
                                                {p.bookingNotice}
                                            </p>
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {sportsContext && (
                                <motion.div variants={itemVariants} className="mt-5 rounded-2xl border border-emerald-500/15 bg-emerald-50/70 p-5 dark:border-emerald-400/15 dark:bg-emerald-400/5">
                                    <h3 className="mb-2 flex items-center gap-2 text-lg font-black text-gray-900 dark:text-white">
                                        <BarChart3 className="h-5 w-5 text-emerald-500" />
                                        {sportsContext.title}
                                    </h3>
                                    <p className="text-[13.5px] font-medium leading-relaxed text-gray-600 dark:text-gray-300">
                                        {sportsContext.summary}
                                    </p>

                                    {sportsContext.facts.length > 0 && (
                                        <div className="mt-4 grid grid-cols-2 gap-2">
                                            {sportsContext.facts.slice(0, 8).map((fact) => (
                                                <div key={`${fact.label}-${fact.value}`} className="rounded-xl border border-black/5 bg-white/70 p-3 dark:border-white/10 dark:bg-white/5">
                                                    <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-gray-400 dark:text-gray-500">
                                                        {fact.label}
                                                    </span>
                                                    <span className="mt-1 block truncate text-[13px] font-black text-gray-900 dark:text-white" title={fact.value}>
                                                        {fact.value}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {sportsContext.relatedGames.length > 0 && (
                                        <div className="mt-4 space-y-2">
                                            <span className="block text-[11px] font-black text-gray-500 dark:text-gray-400">함께 보면 좋은 수집 일정</span>
                                            {sportsContext.relatedGames.map((game) => (
                                                <div key={`${game.label}-${game.title}-${game.date}`} className="rounded-xl bg-white/65 px-3 py-2 text-[12px] font-bold text-gray-600 dark:bg-white/5 dark:text-gray-300">
                                                    <span className="mr-2 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-600 dark:text-emerald-300">{game.label}</span>
                                                    <span>{game.title}</span>
                                                    <span className="ml-2 text-gray-400 dark:text-gray-500">{formatUnifiedDate(game.date)} · {game.venue}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {sportsContext.links.length > 0 && (
                                        <div className="mt-4 flex flex-wrap gap-2">
                                            {sportsContext.links.slice(0, 7).map((link) => (
                                                <a
                                                    key={`${link.label}-${link.href}`}
                                                    href={isMobile ? toMobileUrl(link.href) : link.href}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    title={link.helper || link.label}
                                                    aria-label={`${link.label} 새창열기`}
                                                    onClick={(event) => event.stopPropagation()}
                                                    className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/15 bg-white px-3 py-1.5 text-[11px] font-black text-emerald-700 shadow-sm transition-colors hover:bg-emerald-50 dark:border-emerald-400/20 dark:bg-white/5 dark:text-emerald-300 dark:hover:bg-emerald-400/10"
                                                >
                                                    <span>{link.label}</span>
                                                    <ExternalLink className="h-3 w-3 opacity-60" />
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {/* Description - Short version for all modes (Hidden for tourism to avoid redundancy) */}
                            {shouldShowShortDescription && (
                                <motion.p variants={itemVariants} className="text-[13.5px] text-gray-500 dark:text-gray-400 leading-relaxed font-medium italic line-clamp-3 pt-2">
                                    &quot;{displayDescription}&quot;
                                </motion.p>
                            )}

                            {/* Long Description for Standalone or if quite long (Non-movie) */}
                            {hasLongDescription && (
                                <motion.div variants={itemVariants} className="mt-8 bg-black/5 dark:bg-white/5 rounded-2xl p-6 border border-black/5 dark:border-white/10">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-amber-500" />
                                        {p.genre === 'exhibition' ? '전시 소개' : p.genre === 'tourism' ? '여행지 정보' : '상세 설명'}
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-400 text-[14.5px] leading-relaxed whitespace-pre-line">
                                        {displayDescription}
                                    </p>
                                </motion.div>
                            )}

                             {hasCast && (
                                <motion.div variants={itemVariants} className="flex flex-wrap gap-2 pt-2">
                                    <span className="w-full text-[12px] font-bold text-gray-500 dark:text-gray-400">출연진</span>
                                    {castMembers.slice(0, 10).map(({ name, url }) => {
                                        const castClasses = "px-3 py-1 rounded-md bg-gray-50 dark:bg-white/5 text-[11px] font-bold text-gray-400 dark:text-gray-500 border border-black/5 dark:border-white/5 transition-colors";
                                        
                                        return (
                                            <a 
                                                key={name}
                                                href={isMobile ? toMobileUrl(url) : url} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                title={`${name} 네이버 인물검색`}
                                                aria-label={`${name} 네이버 인물검색 새창열기`}
                                                className={`${castClasses} hover:bg-gray-100 dark:hover:bg-white/10 text-emerald-500`}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {name}
                                            </a>
                                        );
                                    })}
                                </motion.div>
                            )}

                             {p.crew && p.crew.length > 0 && mode === 'standalone' && (
                                <motion.div variants={itemVariants} className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 dark:border-white/5 mt-2">
                                    <span className="w-full text-[12px] font-bold text-gray-500 dark:text-gray-400">제작진</span>
                                    {p.crew!.slice(0, 5).map((c, idx) => {
                                        const url = `https://search.naver.com/search.naver?query=${encodeURIComponent(`${c} ${p.title}`)}`;
                                        const castClasses = "px-3 py-1 rounded-md bg-gray-50 dark:bg-white/5 text-[11px] font-bold text-gray-400 dark:text-gray-500 border border-black/5 dark:border-white/5 transition-colors text-blue-500";
                                        return (
                                            <a 
                                                key={idx} 
                                                href={isMobile ? toMobileUrl(url) : url} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className={`${castClasses} hover:bg-gray-100 dark:hover:bg-white/10`}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {c}
                                            </a>
                                        );
                                    })}
                                </motion.div>
                            )}

                            {/* Movie Synopsis Section - Dedicated below cast for movies */}
                            {hasMovieSynopsis && (
                                <motion.div variants={itemVariants} className="mt-8 bg-indigo-50/30 dark:bg-indigo-500/5 rounded-2xl p-6 border border-indigo-500/10">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-1.5">
                                        <Film className="w-5 h-5 text-indigo-500" />
                                        시놉시스
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-300 text-[14.5px] leading-relaxed whitespace-pre-line font-medium">
                                        {movieSynopsisText}
                                    </p>
                                </motion.div>
                            )}

                            {p.genre === 'movie' && p.keywords && p.keywords.some((keyword) => /[가-힣]/.test(keyword)) && (
                                <motion.div variants={itemVariants} className="flex flex-wrap gap-2 pt-2">
                                    <span className="w-full text-[12px] font-bold text-gray-500 dark:text-gray-400">영화 키워드</span>
                                    {p.keywords.filter((keyword) => /[가-힣]/.test(keyword)).slice(0, 12).map((keyword) => (
                                        <span key={keyword} className="px-3 py-1 rounded-full bg-indigo-50 text-[11px] font-bold text-indigo-600 border border-indigo-500/10 dark:bg-indigo-500/10 dark:text-indigo-300">
                                            #{keyword}
                                        </span>
                                    ))}
                                </motion.div>
                            )}

                            {p.stillImages && p.stillImages.length > 0 && (
                                <motion.div variants={itemVariants} className="mt-6">
                                    <h3 className="text-sm font-black text-gray-900 dark:text-white mb-3 flex items-center gap-1.5">
                                        <Presentation className="w-4 h-4 text-rose-500" />
                                        장면 이미지
                                    </h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        {p.stillImages.slice(0, 4).map((image) => (
                                            <img
                                                key={image}
                                                src={getOptimizedUrl(image, 360, 62)}
                                                alt={`${p.title} 장면 이미지`}
                                                loading="lazy"
                                                referrerPolicy="no-referrer"
                                                className="aspect-video w-full rounded-xl object-cover border border-black/5 dark:border-white/10"
                                            />
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            {p.synopsisImages && p.synopsisImages.length > 0 && (
                                <motion.div variants={itemVariants} className="mt-6">
                                    <h3 className="text-sm font-black text-gray-900 dark:text-white mb-3 flex items-center gap-1.5">
                                        <Sparkles className="w-4 h-4 text-amber-500" />
                                        {galleryLabel}
                                    </h3>
                                    <div className="grid grid-cols-2 gap-2">
                                        {p.synopsisImages.slice(0, galleryLimit).map((image) => (
                                            <a
                                                key={image}
                                                href={getFullImageHref(image)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                referrerPolicy="no-referrer"
                                                title={`${galleryLabel} 크게 보기`}
                                                aria-label={`${p.title} ${galleryLabel} 새창에서 크게 보기`}
                                                onClick={(event) => event.stopPropagation()}
                                                className="group block overflow-hidden rounded-xl border border-black/5 bg-gray-100 dark:border-white/10 dark:bg-white/5"
                                            >
                                                <img
                                                    src={getOptimizedUrl(image, galleryThumbWidth, galleryThumbQuality)}
                                                    alt={`${p.title} ${galleryLabel}`}
                                                    loading="lazy"
                                                    referrerPolicy="no-referrer"
                                                    className={`${galleryImageClass} transition-transform duration-300 group-hover:scale-[1.03]`}
                                                />
                                            </a>
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            <motion.div variants={itemVariants} className="rounded-2xl bg-gray-50/80 p-4 text-[12px] font-bold text-gray-500 border border-black/5 dark:bg-white/5 dark:text-gray-400 dark:border-white/10">
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                    <span className="inline-flex items-center gap-1.5">
                                        <span className="text-gray-400 dark:text-gray-500">[출처]</span>
                                        {sourceUrl ? (
                                            <a
                                                href={sourceUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                onClick={(event) => event.stopPropagation()}
                                                className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-500 dark:text-emerald-300 dark:hover:text-emerald-200 transition-colors"
                                                title={`${sourceLabel} 원수집 페이지 새창열기`}
                                            >
                                                {sourceLabel}
                                                <ExternalLink className="h-3 w-3" />
                                            </a>
                                        ) : (
                                            <span>{sourceLabel}</span>
                                        )}
                                    </span>
                                    {collectedAtLabel && (
                                        <span className="inline-flex items-center gap-1.5">
                                            <span className="text-gray-400 dark:text-gray-500">[수집/갱신]</span>
                                            <span>{collectedAtLabel}</span>
                                        </span>
                                    )}
                                    {officialUpdateLabel && (
                                        <span className="inline-flex items-center gap-1.5">
                                            <span className="text-gray-400 dark:text-gray-500">[공식 업데이트]</span>
                                            <span>{officialUpdateLabel}</span>
                                        </span>
                                    )}
                                </div>
                            </motion.div>

                        </div>

                        {/* Actions Block */}
                        <div className="space-y-4 pt-2">
                            <motion.div variants={itemVariants} className="flex items-center gap-2">
                                <div className="relative shrink-0">
                                    <motion.button
                                        whileTap={{ scale: 0.95 }}
                                        onClick={handleShare}
                                        aria-label="링크 공유"
                                        className={`p-4 rounded-2xl border flex items-center justify-center transition-all shrink-0 ${
                                            shareStatus === 'copied' || shareStatus === 'shared'
                                                ? 'bg-emerald-500 text-white border-emerald-400'
                                                : shareStatus === 'error'
                                                    ? 'bg-red-600 text-white border-red-400'
                                                    : 'bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white border-black/5 dark:border-white/10'
                                        }`}
                                    >
                                        {/* Icon swap gives an immediate visual confirmation even if the
                                            toast happens to be visually clipped on the user's screen. */}
                                        {shareStatus === 'copied' || shareStatus === 'shared' ? (
                                            <Check className="w-5 h-5" />
                                        ) : (
                                            <Share2 className="w-5 h-5" />
                                        )}
                                    </motion.button>
                                </div>

                                {/* Toast rendered via Portal so it always sits above the modal stacking
                                    context. The previous inline absolute toast was being clipped/hidden
                                    by the modal's z-index — making the share button look dead. */}
                                <Portal>
                                    <AnimatePresence>
                                        {shareStatus !== 'idle' && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -12, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: -12, scale: 0.95 }}
                                                transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                                                role="status"
                                                aria-live="polite"
                                                className={`pointer-events-none fixed left-1/2 -translate-x-1/2 top-[max(env(safe-area-inset-top),16px)] whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-extrabold shadow-2xl border z-[2147483647] flex items-center gap-2 ${
                                                    shareStatus === 'error'
                                                        ? 'bg-red-600 text-white border-red-400/40'
                                                        : 'bg-emerald-500 text-white border-emerald-300/60'
                                                }`}
                                            >
                                                {shareStatus === 'error'
                                                    ? <AlertCircle className="w-4 h-4" />
                                                    : <Check className="w-4 h-4" />}
                                                {shareStatus === 'copied' && '링크가 복사되었습니다'}
                                                {shareStatus === 'shared' && '공유되었습니다'}
                                                {shareStatus === 'error' && '복사에 실패했습니다. 다시 시도해주세요'}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </Portal>

                                {sportsTicketingInfo?.officialUrl && sportsTicketingInfo.officialUrl !== bookingUrl && (
                                    <motion.a
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.99 }}
                                        href={isMobile ? toMobileUrl(sportsTicketingInfo.officialUrl) : sportsTicketingInfo.officialUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex min-w-[112px] items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white px-4 py-4 text-sm font-black text-gray-700 shadow-sm transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
                                        title={`${sportsTicketingInfo.officialLabel || '공식사이트'} 새창열기`}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <Globe className="w-4 h-4" />
                                        <span>공식사이트</span>
                                    </motion.a>
                                )}
                                
                                 <motion.a
                                    whileHover={{ scale: 1.01 }}
                                    whileTap={{ scale: 0.99 }}
                                    href={bookingUrl}
                                    target="_blank"
                                     rel="noopener noreferrer"
                                    className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl text-white font-black text-base ${genreStyle.twBg} shadow-lg relative overflow-hidden group`}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <ExternalLink className="w-5 h-5" />
                                    <span>예매하러 가기</span>
                                </motion.a>
                            </motion.div>

                            {sportsTicketingInfo?.ticketBay && (
                                <motion.a
                                    variants={itemVariants}
                                    href={isMobile ? toMobileUrl(sportsTicketingInfo.ticketBay.url) : sportsTicketingInfo.ticketBay.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block rounded-2xl border border-orange-500/15 bg-orange-50/60 px-4 py-3 text-[12px] font-bold text-orange-800 transition-colors hover:bg-orange-50 dark:border-orange-400/15 dark:bg-orange-400/5 dark:text-orange-200"
                                    title="티켓베이 참고가 새창열기"
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    <span className="mr-2 text-orange-500">[{sportsTicketingInfo.ticketBay.sourceLabel}]</span>
                                    {sportsTicketingInfo.ticketBay.detail}
                                </motion.a>
                            )}

                            {/* Volleyball Specific Links: 관전포인트 & 전력비교 */}
                            {p.genre === 'volleyball' && (p.versusLink || p.highlightsLink) && (
                                <motion.div variants={itemVariants} className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                        {p.versusLink && (
                                            <motion.a
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                href={isMobile ? toMobileUrl(p.versusLink) : p.versusLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/20 font-bold text-sm transition-all hover:bg-purple-500/20 dark:hover:bg-purple-500/30"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <BarChart3 className="w-4 h-4" />
                                                <span>전력비교</span>
                                            </motion.a>
                                        )}
                                        {p.highlightsLink && (
                                            <motion.a
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                href={isMobile ? toMobileUrl(p.highlightsLink) : p.highlightsLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 border border-sky-500/20 font-bold text-sm transition-all hover:bg-sky-500/20 dark:hover:bg-sky-500/30"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <Presentation className="w-4 h-4" />
                                                <span>관전포인트/상세결과</span>
                                            </motion.a>
                                        )}
                                    </div>
                                </motion.div>
                            )}

                             {/* Removed: 컬처플로우 바로가기 버튼 */}
                        </div>
                    </div>
                </div>
            </div>
            </motion.div>
        </div>
    );
}

ContentDetailView.displayName = 'ContentDetailView';
