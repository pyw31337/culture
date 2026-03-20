'use client';

import { Performance } from '@/types';
import { GENRES, GENRE_STYLES, FUTURES_TEAM_LOGOS } from '@/lib/constants';
import { ExternalLink, MapPin, Calendar, Clock, Users, Star, Tag, Ticket, Share2, Sparkles, Film, X, Play, BarChart3, Presentation, Phone, AlertCircle, Info, Coins, Globe, ParkingCircle, Wallet, Layers, Bath, Building2, Dog } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { getOptimizedUrl, formatUnifiedDate, getDistrictFromAddress, toMobileUrl } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';

interface ContentDetailViewProps {
    performance: Performance;
    mode?: 'modal' | 'standalone';
    onClose?: () => void;
    lastUpdated?: string;
}

export default function ContentDetailView({ performance: p, mode = 'modal', onClose, lastUpdated }: ContentDetailViewProps) {
    const router = useRouter();
    const t = useTranslations('Detail');
    const tm = useTranslations('MovieMetadata');
    const tc = useTranslations('Categories');
    const locale = useLocale();
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
        const mobile = /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua.toLowerCase());
        if (mobile !== isMobile) {
            setIsMobile(mobile);
        }
    }, [isMobile]);

    const genreStyle = GENRE_STYLES[p.genre] || GENRE_STYLES['all'];
    const genreLabel = tc(p.genre as any) || p.genre;

    const isSports = ['volleyball', 'basketball', 'baseball', 'handball', 'soccer'].includes(p.genre);
    const hasTeams = (p as any).homeTeam && (p as any).awayTeam;

    const hasCast = (p as any).cast && (p as any).cast.length > 0;
    const rawImg = (p as any).image || (p as any).poster || (p as any).backupPoster || (p as any).posterUrl || '';
    const [imgSrc, setImgSrc] = useState(rawImg ? getOptimizedUrl(rawImg) : '');
    const fallbackImg = (p as any).backupPoster || (p as any).posterUrl || (p as any).poster || '';
    
    // Unified Booking Link Logic with Fallback for Missing Data
    const bookingUrl = useMemo(() => {
        let url = p.link;
        const isMissingLink = !url || url.trim() === '';

        // Case 1: Genre-specific search fallback (Movies) - Only if link is missing
        if (p.genre === 'movie' && isMissingLink) {
            const suffix = t('movie_search_suffix');
            url = `https://search.naver.com/search.naver?query=${encodeURIComponent(p.title + suffix)}`;
        } 
        // Case 2: Platform-specific search fallback for missing links
        else if (isMissingLink) {
            if ((p as any).source === 'mommom-activity' || (p as any).source === 'mommom' || (p as any).source === 'mommom-product') {
                // Mommom search fallback
                url = `https://mom-mom.net/search?q=${encodeURIComponent(p.title)}`;
            } else {
                // Generic Naver search fallback
                const suffix = t('booking_search_suffix');
                url = `https://search.naver.com/search.naver?query=${encodeURIComponent(p.title + suffix)}`;
            }
        }

        return isMobile ? toMobileUrl(url) : url;
    }, [p.link, p.title, p.genre, (p as any).source, isMobile]);

    const handleShare = async (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const url = `${window.location.origin}${window.location.pathname}${mode === 'modal' ? `#p=${p.id}` : ''}`;
        
        if (navigator.share) {
            try {
                await navigator.share({
                    title: p.title,
                    text: (p as any).description || p.title,
                    url: url,
                });
                return;
            } catch (err) {
                console.warn('Web Share API failed', err);
            }
        }
        
        await navigator.clipboard.writeText(url);
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

    const containerVariants = {
        hidden: { opacity: 0, scale: 0.95 },
        visible: {
            opacity: 1,
            scale: 1,
            transition: {
                staggerChildren: 0.1,
                duration: 0.4,
                ease: "easeOut" as any
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    const containerClasses = mode === 'standalone'
        ? "w-full max-w-[380px] md:max-w-[1000px] mx-auto bg-white dark:bg-gray-900 rounded-[32px] shadow-2xl overflow-hidden border border-black/5 dark:border-white/10"
        : "relative w-full h-full lg:h-auto lg:max-h-[90vh] lg:max-w-[1000px] bg-gray-900 rounded-[32px] shadow-[0_32px_64px_rgba(0,0,0,0.6)] overflow-hidden border border-white/20 holo-effect";

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
            >
                {/* Close Button UI - Moved to container level to stay fixed */}
                {/* Close Button UI - Stay fixed in top-right */}
                <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={handleClose}
                    className="absolute top-6 right-6 p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white z-50 hover:bg-black/60 transition-colors shadow-xl"
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
                                    if (fallbackImg && imgSrc !== fallbackImg && imgSrc !== getOptimizedUrl(fallbackImg)) {
                                        setImgSrc(getOptimizedUrl(fallbackImg));
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
                                    href={isMobile ? toMobileUrl(`https://www.youtube.com/results?search_query=${encodeURIComponent(p.title + (p.genre === 'movie' ? ' ' + tm('synopsis') : ''))}`) : `https://www.youtube.com/results?search_query=${encodeURIComponent(p.title + (p.genre === 'movie' ? ' ' + tm('synopsis') : ''))}`}
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
                                            src={p.genre === 'baseball' && (p as any).homeTeam && FUTURES_TEAM_LOGOS[(p as any).homeTeam] ? FUTURES_TEAM_LOGOS[(p as any).homeTeam] : (p as any).homeTeamLogo}
                                            alt={(p as any).homeTeam}
                                            className="w-1/4 aspect-square object-contain drop-shadow-[0_12px_32px_rgba(255,255,255,0.3)]"
                                        />
                                        <div className="text-white text-xl font-black italic bg-black/40 px-4 py-1 rounded-full backdrop-blur-md border border-white/10 shadow-lg">VS</div>
                                        <motion.img
                                            initial={{ x: 30, opacity: 0, rotate: 10 }}
                                            animate={{ x: 0, opacity: 1, rotate: 0 }}
                                            transition={{ delay: 0.5, type: 'spring' }}
                                            src={p.genre === 'baseball' && (p as any).awayTeam && FUTURES_TEAM_LOGOS[(p as any).awayTeam] ? FUTURES_TEAM_LOGOS[(p as any).awayTeam] : (p as any).awayTeamLogo}
                                            alt={(p as any).awayTeam}
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
                        : "p-6 sm:p-8 lg:p-12 space-y-4 sm:space-y-8 lg:space-y-10 flex-1 lg:overflow-y-auto lg:h-full scrollbar-hide"}>
                        
                        <div className="space-y-4">
                            <motion.div variants={itemVariants} className="space-y-3">
                                {/* Genre badge next to title */}
                                {/* Category badge above title */}
                                <div className="flex flex-col gap-2.5">
                                     <motion.span
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className={`px-3 py-1 rounded-md text-[10px] font-black text-white ${genreStyle.twBg} shadow-sm tracking-widest uppercase border border-white/10 w-fit`}
                                    >
                                        {genreLabel}
                                    </motion.span>
                                    <h2 className="text-[22px] md:text-2xl font-black leading-[1.2] tracking-tighter drop-shadow-sm">
                                        {p.title}
                                    </h2>
                                </div>
                                
                                 {(p as any).originalTitle && (
                                    <p className="text-[12px] text-gray-400 font-medium italic opacity-70 tracking-wide mt-[-4px]">{(p as any).originalTitle}</p>
                                )}
                            </motion.div>

                            {/* Info List - 1 Column Narrow Style */}
                            <motion.div variants={itemVariants} className="space-y-2.5">
                                {(() => {
                                    const isMovie = p.genre === 'movie';
                                    let movieRating = p.ageRating || p.age || p.venue || '';
                                    if (movieRating && typeof movieRating === 'string') {
                                        if (movieRating.includes('전체')) movieRating = tm('rating_all');
                                        else if (movieRating.includes('12')) movieRating = tm('rating_12');
                                        else if (movieRating.includes('15')) movieRating = tm('rating_15');
                                        else if (movieRating.includes('18') || movieRating.includes('청소년') || movieRating.includes('불가') || movieRating.includes('청불')) movieRating = tm('rating_18');
                                    } else {
                                        movieRating = '';
                                    }

                                    const infoItems = [];

                                    if (isMovie && movieRating) {
                                        infoItems.push({ icon: Film, label: tm('rating_label'), text: movieRating, color: 'text-emerald-500' });
                                    } else if (!isMovie && p.venue) {
                                        infoItems.push({ 
                                            icon: Building2, 
                                            label: t('venue'), 
                                            text: p.venue, 
                                            color: 'text-emerald-500', 
                                            isLink: !!(p.lat && p.lng), 
                                            onClick: handleVenueClick 
                                        });
                                    }

                                    if (p.genre === 'tourism' && p.status) {
                                        infoItems.push({ icon: Star, label: t('info'), text: p.status, color: 'text-amber-500' });
                                    }

                                    if (p.address && p.address.trim() !== '') {
                                        infoItems.push({ 
                                            icon: MapPin, 
                                            label: t('location'), 
                                            text: p.address, 
                                            color: 'text-gray-400',
                                            isLink: false
                                        });
                                    }

                                    const dateText = formatUnifiedDate(p.date);
                                    if (dateText && p.genre !== 'tourism') {
                                        infoItems.push({ icon: Calendar, label: isMovie ? t('schedule') : t('schedule'), text: dateText, color: 'text-blue-500' });
                                    }

                                    if (p.operatingHours || p.performanceTime) {
                                        infoItems.push({ icon: Clock, label: t('running_time'), text: p.operatingHours || p.performanceTime, color: 'text-purple-500' });
                                    } else if ((p as any).runtime) {
                                        infoItems.push({ icon: Clock, label: t('running_time'), text: `${(p as any).runtime}${t('minutes')}`, color: 'text-purple-500' });
                                    }
                                    
                                    if (isMovie) {
                                        const dateLabel = lastUpdated ? (() => {
                                            const match = lastUpdated.match(/(\d{2,4})-(\d{2})-(\d{2})/);
                                            if (match) {
                                                const [, y, m, d] = match;
                                                const YY = y.slice(-2);
                                                return locale === 'en' 
                                                    ? ` <${t('standard')} ${YY}.${m}.${d}>`
                                                    : ` <${YY}.${m}.${d} ${t('standard')}>`;
                                            }
                                            return '';
                                        })() : (() => {
                                            const now = new Date();
                                            const YY = String(now.getFullYear()).slice(-2);
                                            const MM = String(now.getMonth() + 1).padStart(2, '0');
                                            const DD = String(now.getDate()).padStart(2, '0');
                                            return locale === 'en'
                                                ? ` <${t('standard')} ${YY}.${MM}.${DD}>`
                                                : ` <${YY}.${MM}.${DD} ${t('standard')}>`;
                                        })();

                                        if (p.reservationRate) {
                                            infoItems.push({ icon: BarChart3, label: tm('reservation_rate'), text: `${p.reservationRate}${dateLabel}`, color: 'text-rose-500' });
                                        }
                                        if (p.audienceCount) {
                                            infoItems.push({ icon: Users, label: tm('audience_count'), text: `${p.audienceCount}${dateLabel}`, color: 'text-blue-400' });
                                        }
                                        if ((p as any).budgetKRW) {
                                            const formatted = new Intl.NumberFormat(locale === 'ko' ? 'ko-KR' : 'en-US').format((p as any).budgetKRW);
                                            infoItems.push({ icon: Coins, label: tm('budget'), text: `₩${formatted}`, color: 'text-amber-500' });
                                        }
                                        if ((p as any).revenueKRW) {
                                            const formatted = new Intl.NumberFormat(locale === 'ko' ? 'ko-KR' : 'en-US').format((p as any).revenueKRW);
                                            infoItems.push({ icon: Wallet, label: tm('revenue'), text: `₩${formatted}${dateLabel}`, color: 'text-emerald-500' });
                                        }
                                        if ((p as any).roi) {
                                            infoItems.push({ icon: Presentation, label: tm('roi'), text: `${(p as any).roi}${dateLabel}`, color: 'text-purple-400' });
                                        }
                                    }

                                    if (!isMovie && (p.age || p.ageRating)) {
                                        const ageText = p.age || p.ageRating;
                                        // Prevent showing the exact same text twice (e.g. if age and ageRating are same)
                                        infoItems.push({ icon: Tag, label: t('age_label'), text: ageText, color: 'text-rose-500' });
                                    }

                                    if ((p as any).director) {
                                        infoItems.push({ 
                                            icon: Users, 
                                            label: t('director'), 
                                            text: (p as any).director, 
                                            color: 'text-indigo-500', 
                                            isLink: isMovie, 
                                            onClick: () => {
                                                const url = `https://search.naver.com/search.naver?query=${encodeURIComponent((p as any).director || '')}`;
                                                window.open(isMobile ? toMobileUrl(url) : url, '_blank');
                                            }
                                        });
                                    }

                                    // Advanced KOPIS metadata with deduplication
                                    const dedupeJoin = (items: { val?: any, label: string }[]) => {
                                        const valid = items.filter(i => typeof i.val === 'string' && i.val.trim() !== '');
                                        if (valid.length === 0) return '';
                                        
                                        // Group by identical values
                                        const groups: Record<string, string[]> = {};
                                        valid.forEach(i => {
                                            const v = String(i.val).trim();
                                            if (!groups[v]) groups[v] = [];
                                            groups[v].push(i.label);
                                        });

                                        return Object.entries(groups).map(([val, labels]) => 
                                            `${val}(${labels.join('/')})`
                                        ).join(', ');
                                    };

                                    const hostOrg = dedupeJoin([
                                        { val: p.host, label: t('host') },
                                        { val: p.organizer, label: t('organizer') }
                                    ]);
                                    if (hostOrg) {
                                        infoItems.push({ icon: Users, label: t('host_organizer'), text: hostOrg, color: 'text-indigo-400' });
                                    }

                                    const planProd = dedupeJoin([
                                        { val: p.planner, label: t('planner') },
                                        { val: p.producer, label: t('production') }
                                    ]);
                                    
                                    if (planProd) {
                                        infoItems.push({ icon: Sparkles, label: t('planner_producer'), text: planProd, color: 'text-amber-400' });
                                    } else if (p.production && !hostOrg.includes(p.production)) {
                                        infoItems.push({ icon: Sparkles, label: t('production'), text: p.production, color: 'text-amber-400' });
                                    }

                                    if (p.sponsor) {
                                        infoItems.push({ icon: Star, label: t('sponsor'), text: p.sponsor, color: 'text-yellow-400' });
                                    }

                                    if ((p as any).contact) {
                                        infoItems.push({ icon: Phone, label: t('contact'), text: (p as any).contact, color: 'text-emerald-400' });
                                    }

                                     if (p.price && !p.priceList) {
                                         infoItems.push({ icon: Ticket, label: t('price'), text: p.price, color: 'text-orange-500' });
                                     }

                                     if (p.genre === 'tourism' && p.priceDetail) {
                                         infoItems.push({ icon: Coins, label: t('price_detail'), text: p.priceDetail, color: 'text-amber-500' });
                                     }

                                    if (p.closedDays) {
                                        infoItems.push({ icon: Info, label: t('closed_days'), text: p.closedDays, color: 'text-rose-400' });
                                    }

                                    if ((p as any).website) {
                                        infoItems.push({ 
                                            icon: Globe, 
                                            label: t('homepage'), 
                                            text: (p as any).website.replace(/^https?:\/\//, ''), 
                                            color: 'text-cyan-400', 
                                            isLink: true, 
                                            onClick: () => {
                                                const url = (p as any).website!.startsWith('http') ? (p as any).website! : `https://${(p as any).website}`;
                                                window.open(isMobile ? toMobileUrl(url) : url, '_blank');
                                            }
                                        });
                                    }

                                     if (p.parking) {
                                         infoItems.push({ icon: ParkingCircle, label: t('parking'), text: p.parking, color: 'text-blue-500' });
                                     }
                                     
                                     if (p.petFriendly) {
                                         infoItems.push({ icon: Dog, label: t('pet_friendly'), text: p.petFriendly, color: 'text-amber-600' });
                                     }

                                    if (p.parkingFee) {
                                        infoItems.push({ icon: Wallet, label: t('parking_fee'), text: p.parkingFee, color: 'text-orange-400' });
                                    }

                                    if (p.facilities) {
                                        infoItems.push({ icon: Layers, label: t('facilities'), text: p.facilities, color: 'text-teal-400' });
                                    }

                                    if (p.restrooms) {
                                        infoItems.push({ icon: Bath, label: t('restrooms'), text: p.restrooms, color: 'text-blue-300' });
                                    }

                                    return infoItems.map((item: any, idx: number) => (
                                        <div key={idx} className="flex items-start justify-between gap-4 py-2 border-b border-gray-50 dark:border-white/5 last:border-0">
                                            <div className="flex items-start gap-3 min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5 w-14 shrink-0 mt-[2px]">
                                                    <item.icon className={`w-4 h-4 ${item.color} opacity-80`} />
                                                    <span className="text-[12px] font-bold text-gray-500 dark:text-gray-400">{item.label}</span>
                                                </div>
                                                <div className="flex flex-col gap-1 flex-1 min-w-0">
                                                    {item.isLink ? (
                                                        <button 
                                                            onClick={item.onClick!}
                                                            className="text-[14.5px] text-emerald-600 dark:text-emerald-400 font-extrabold text-left hover:underline flex items-center gap-1.5"
                                                        >
                                                            <span className="break-all">{item.text}</span>
                                                            <ExternalLink className="w-3 h-3 opacity-50 shrink-0" />
                                                        </button>
                                                    ) : (
                                                        <p className="text-[14.5px] text-gray-700 dark:text-gray-300 font-bold whitespace-pre-wrap">{item.text}</p>
                                                    )}
                                                    {item.rightText && (
                                                        <span className="text-[12px] font-bold text-gray-400 dark:text-gray-500">
                                                            {item.rightText}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ));
                                })()}
                            </motion.div>

                            {/* Enhanced Price List (Table style) */}
                            {p.priceList && p.priceList.length > 0 && (
                                <motion.div variants={itemVariants} className="mt-4 bg-gray-50 dark:bg-white/5 rounded-xl p-4 border border-black/5 dark:border-white/5">
                                    <h4 className="text-[13px] font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                                        <Coins className="w-4 h-4 text-orange-400" />
                                        {t('price_detail')}
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

                            {/* Mommom Specific: Fees and Programs */}
                            {p.feesAndPrograms && (
                                <motion.div variants={itemVariants} className="mt-4 bg-purple-50/50 dark:bg-purple-500/5 rounded-xl p-4 border border-purple-500/10">
                                    <h4 className="text-[13px] font-bold text-purple-600 dark:text-purple-400 mb-2 flex items-center gap-1.5">
                                        <Presentation className="w-4 h-4" />
                                        {t('fees_and_programs')}
                                    </h4>
                                    <p className="text-[13.5px] text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line font-medium">
                                        {p.feesAndPrograms}
                                    </p>
                                </motion.div>
                            )}

                            {/* Detailed Notices & Age Rules */}
                            {(p.ageDetail || p.bookingNotice) && (
                                <motion.div variants={itemVariants} className="mt-4 space-y-3">
                                    {p.ageDetail && (
                                        <div className="bg-blue-50/50 dark:bg-blue-500/5 rounded-xl p-4 border border-blue-500/10">
                                            <h4 className="text-[13px] font-bold text-blue-600 dark:text-blue-400 mb-1.5 flex items-center gap-1.5">
                                                <Info className="w-4 h-4" />
                                                {t('age_guide')}
                                            </h4>
                                            <p className="text-[13px] text-blue-800/80 dark:text-blue-300/80 leading-relaxed whitespace-pre-line font-medium">
                                                {p.ageDetail}
                                            </p>
                                        </div>
                                    )}
                                    {p.bookingNotice && (
                                        <div className="bg-amber-50/50 dark:bg-amber-500/5 rounded-xl p-4 border border-amber-500/10">
                                            <h4 className="text-[13px] font-bold text-amber-600 dark:text-amber-400 mb-1.5 flex items-center gap-1.5">
                                                <AlertCircle className="w-4 h-4" />
                                                {t('booking_notice')}
                                            </h4>
                                            <p className="text-[13px] text-amber-800/80 dark:text-amber-300/80 leading-relaxed whitespace-pre-line font-medium">
                                                {p.bookingNotice}
                                            </p>
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {/* Description - Short version for all modes (Hidden for tourism to avoid redundancy) */}
                            {(p as any).description && p.genre !== 'tourism' && (
                                <motion.p variants={itemVariants} className="text-[13.5px] text-gray-500 dark:text-gray-400 leading-relaxed font-medium italic line-clamp-3 pt-2">
                                    &quot;{(p as any).description}&quot;
                                </motion.p>
                            )}

                            {/* Long Description for Standalone or if quite long (Non-movie) */}
                            {(p as any).description && (p as any).description.length > 150 && p.genre !== 'movie' && (
                                <motion.div variants={itemVariants} className="mt-8 bg-black/5 dark:bg-white/5 rounded-2xl p-6 border border-black/5 dark:border-white/10">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-amber-500" />
                                        {p.genre === 'exhibition' ? t('description_exhibition') : p.genre === 'tourism' ? t('description_tourism') : t('description_common')}
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-400 text-[14.5px] leading-relaxed whitespace-pre-line">
                                        {(p as any).description}
                                    </p>
                                </motion.div>
                            )}

                             {hasCast && mode === 'standalone' && (
                                <motion.div variants={itemVariants} className="flex flex-wrap gap-2 pt-2">
                                    <span className="w-full text-[12px] font-bold text-gray-500 dark:text-gray-400">{t('cast')}</span>
                                    {(p as any).cast!.slice(0, 10).map((c, idx) => {
                                        const name = typeof c === 'string' ? c : c.name;
                                        let url = typeof c === 'string' ? undefined : (c as { url?: string }).url;
                                        
                                        // Auto-generate Naver search link for any performance type if missing URL
                                        if (!url) {
                                            url = `https://search.naver.com/search.naver?query=${encodeURIComponent(name)}`;
                                        }

                                         const castClasses = "px-3 py-1 rounded-md bg-gray-50 dark:bg-white/5 text-[11px] font-bold text-gray-400 dark:text-gray-500 border border-black/5 dark:border-white/5 transition-colors";
                                        
                                        return url ? (
                                            <a 
                                                key={idx} 
                                                href={isMobile ? toMobileUrl(url) : url} 
                                                target="_blank" 
                                                rel="noopener noreferrer" 
                                                className={`${castClasses} hover:bg-gray-100 dark:hover:bg-white/10 text-emerald-500`}
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                {name}
                                            </a>
                                        ) : (
                                            <span key={idx} className={castClasses}>
                                                {name}
                                            </span>
                                        );
                                    })}
                                </motion.div>
                            )}

                             {(p as any).crew && (p as any).crew.length > 0 && mode === 'standalone' && (
                                <motion.div variants={itemVariants} className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 dark:border-white/5 mt-2">
                                    <span className="w-full text-[12px] font-bold text-gray-500 dark:text-gray-400">{t('crew')}</span>
                                    {(p as any).crew!.slice(0, 5).map((c, idx) => {
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
                            {p.genre === 'movie' && (p.synopsis || (p as any).description) && (
                                <motion.div variants={itemVariants} className="mt-8 bg-indigo-50/30 dark:bg-indigo-500/5 rounded-2xl p-6 border border-indigo-500/10">
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-1.5">
                                        <Film className="w-5 h-5 text-indigo-500" />
                                        {tm('synopsis')}
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-300 text-[14.5px] leading-relaxed whitespace-pre-line font-medium">
                                        {p.synopsis || (p as any).description}
                                    </p>
                                </motion.div>
                            )}

                        </div>

                        {/* Actions Block */}
                        <div className="space-y-4 pt-2">
                            <motion.div variants={itemVariants} className="flex items-center gap-2">
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleShare}
                                    className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white border border-black/5 dark:border-white/10 flex items-center justify-center transition-all shrink-0"
                                >
                                    <Share2 className="w-5 h-5" />
                                </motion.button>
                                
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
                                    <span>{t('go_booking')}</span>
                                </motion.a>
                            </motion.div>

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
                                                <span>{t('vs_compare')}</span>
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
                                                <span>{t('highlights')}</span>
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
