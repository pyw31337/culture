'use client';

import { Performance } from '@/types';
import { GENRES, GENRE_STYLES, FUTURES_TEAM_LOGOS } from '@/lib/constants';
import { ExternalLink, MapPin, Calendar, Clock, Users, Star, Tag, Ticket, Share2, Sparkles, Film, X, Play, BarChart3, Presentation } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { getOptimizedUrl, formatUnifiedDate } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ContentDetailViewProps {
    performance: Performance;
    mode?: 'modal' | 'standalone';
    onClose?: () => void;
}

export default function ContentDetailView({ performance: p, mode = 'modal', onClose }: ContentDetailViewProps) {
    const router = useRouter();
    const containerRef = useRef<HTMLDivElement>(null);
    const genreStyle = GENRE_STYLES[p.genre] || GENRE_STYLES['all'];
    const genreLabel = GENRES.find(g => g.id === p.genre)?.label || p.genre;

    const isSports = ['volleyball', 'basketball', 'baseball', 'handball', 'soccer'].includes(p.genre);
    const hasTeams = p.homeTeam && p.awayTeam;

    const hasDiscount = p.discount && p.originalPrice;
    const hasCast = p.cast && p.cast.length > 0;
    const rawImg = p.image || p.poster || p.backupPoster || p.posterUrl || '';
    const [imgSrc, setImgSrc] = useState(rawImg ? getOptimizedUrl(rawImg) : '');
    const fallbackImg = p.backupPoster || p.posterUrl || p.poster || '';

    const handleShare = async (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const url = `${window.location.origin}${window.location.pathname}${mode === 'modal' ? `#p=${p.id}` : ''}`;
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
        ? "w-full max-w-[380px] mx-auto bg-white dark:bg-gray-900 rounded-[32px] shadow-2xl overflow-hidden border border-black/5 dark:border-white/10"
        : "relative w-full h-full bg-gray-900 rounded-[32px] shadow-[0_32px_64px_rgba(0,0,0,0.6)] overflow-hidden border border-white/20 holo-effect";

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
            <div className={`overflow-y-auto overflow-x-hidden ${mode === 'standalone' ? 'max-h-none' : 'max-h-[85vh] md:max-h-none'} scrollbar-hide`}>
                <div className={mode === 'standalone' ? "flex flex-col" : ""}>
                    {/* Hero / Poster Section */}
                    {imgSrc && (
                        <div className={mode === 'standalone' 
                            ? "relative w-full aspect-[3/4] shrink-0 group cursor-default overflow-hidden" 
                            : "relative h-60 sm:h-[450px] w-full group cursor-default overflow-hidden"}>
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
                            
                            {/* Close Button UI */}
                            <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={handleClose}
                                className="absolute top-4 right-4 p-2 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white z-20 hover:bg-black/60 transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </motion.button>

                            {/* Play Button Overlay */}
                            <div className="absolute inset-0 flex items-center justify-center z-10">
                                <motion.a
                                    whileHover={{ scale: 1.1 }}
                                    whileTap={{ scale: 0.9 }}
                                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(p.title + (p.genre === 'movie' ? ' 예고편' : ''))}`}
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
                        ? "p-6 pt-5 space-y-5 bg-white dark:bg-gray-900 text-gray-900 dark:text-white" 
                        : "p-6 sm:p-8 pt-4 sm:pt-6 space-y-4 sm:space-y-8"}>
                        
                        <div className="space-y-4">
                            <motion.div variants={itemVariants} className="space-y-3">
                                {/* Genre badge next to title */}
                                <div className="flex items-center gap-2">
                                     <motion.span
                                        initial={{ scale: 0.8, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className={`px-3 py-1 rounded-md text-[10px] font-black text-white ${genreStyle.twBg} shadow-sm tracking-widest uppercase border border-white/10 shrink-0`}
                                    >
                                        {genreLabel}
                                    </motion.span>
                                    <h2 className="text-xl font-black leading-[1.2] tracking-tighter drop-shadow-sm">
                                        {p.title}
                                    </h2>
                                </div>
                                
                                 {p.originalTitle && (
                                    <p className="text-[12px] text-gray-400 font-medium italic opacity-70 tracking-wide mt-[-4px]">{p.originalTitle}</p>
                                )}
                            </motion.div>

                            {/* Info List - 1 Column Narrow Style */}
                            <motion.div variants={itemVariants} className="space-y-2.5">
                                {[
                                    { 
                                        icon: p.genre === 'movie' ? Film : MapPin, 
                                        text: p.district ? `${p.venue} (${p.district})` : p.venue, 
                                        color: 'text-emerald-500', 
                                        label: '장소',
                                        isLink: !!(p.lat && p.lng),
                                        onClick: handleVenueClick
                                    },
                                    { icon: Calendar, text: formatUnifiedDate(p.date), color: 'text-blue-500', label: '날짜' },
                                    { icon: Clock, text: p.runningTime, color: 'text-purple-500', label: '시간' },
                                    { icon: Tag, text: p.age || p.ageRating, color: 'text-rose-500', label: '연령' },
                                    { 
                                        icon: Users, 
                                        text: p.director, 
                                        color: 'text-indigo-500', 
                                        label: '감독',
                                        isLink: p.genre === 'movie',
                                        onClick: () => window.open(`https://search.naver.com/search.naver?query=${encodeURIComponent(p.director || '')}`, '_blank')
                                    },
                                    { icon: Ticket, text: p.price, color: 'text-amber-500', label: '가격' }
                                ].filter(item => item.text).map((item, idx) => (
                                     <div key={idx} className="flex items-center gap-4 py-1 border-b border-gray-50 dark:border-white/5 last:border-0">
                                        <item.icon className={`w-4 h-4 ${item.color} shrink-0 opacity-80`} />
                                        {item.isLink ? (
                                            <button 
                                                onClick={item.onClick}
                                                className="text-[13.5px] text-emerald-600 dark:text-emerald-400 font-black truncate leading-none hover:underline flex items-center gap-1.5"
                                            >
                                                <span>{item.text}</span>
                                                <ExternalLink className="w-3 h-3 opacity-50" />
                                            </button>
                                        ) : (
                                            <p className="text-[13.5px] text-gray-700 dark:text-gray-300 font-bold truncate leading-none">{item.text}</p>
                                        )}
                                    </div>
                                ))}
                            </motion.div>

                            {/* Description */}
                              {p.description && mode === 'standalone' && (
                                <motion.p variants={itemVariants} className="text-[13.5px] text-gray-500 dark:text-gray-400 leading-relaxed font-medium italic line-clamp-3 pt-2">
                                    "{p.description}"
                                </motion.p>
                            )}

                             {hasCast && mode === 'standalone' && (
                                <motion.div variants={itemVariants} className="flex flex-wrap gap-2 pt-2">
                                    <span className="w-full text-[12px] font-bold text-gray-500 dark:text-gray-400">출연진</span>
                                    {p.cast!.slice(0, 10).map((c, idx) => {
                                        const name = typeof c === 'string' ? c : c.name;
                                        let url = typeof c === 'string' ? undefined : (c as any).url;
                                        
                                        // Auto-generate Naver search link for any performance type if missing URL
                                        if (!url) {
                                            url = `https://search.naver.com/search.naver?query=${encodeURIComponent(`${name} ${p.title}`)}`;
                                        }

                                         const castClasses = "px-3 py-1 rounded-md bg-gray-50 dark:bg-white/5 text-[11px] font-bold text-gray-400 dark:text-gray-500 border border-black/5 dark:border-white/5 transition-colors";
                                        
                                        return url ? (
                                            <a 
                                                key={idx} 
                                                href={url} 
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

                             {p.crew && p.crew.length > 0 && mode === 'standalone' && (
                                <motion.div variants={itemVariants} className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 dark:border-white/5 mt-2">
                                    <span className="w-full text-[12px] font-bold text-gray-500 dark:text-gray-400">제작진</span>
                                    {p.crew!.slice(0, 5).map((c, idx) => {
                                        const url = `https://search.naver.com/search.naver?query=${encodeURIComponent(`${c} ${p.title}`)}`;
                                        const castClasses = "px-3 py-1 rounded-md bg-gray-50 dark:bg-white/5 text-[11px] font-bold text-gray-400 dark:text-gray-500 border border-black/5 dark:border-white/5 transition-colors text-blue-500";
                                        return (
                                            <a 
                                                key={idx} 
                                                href={url} 
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
                                    href={p.genre === 'movie' 
                                        ? `https://search.naver.com/search.naver?query=${encodeURIComponent(p.title + ' 상영시간표')}`
                                        : p.link}
                                    target="_blank"
                                     rel="noopener noreferrer"
                                    className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl text-white font-black text-base ${genreStyle.twBg} shadow-lg relative overflow-hidden group`}
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <ExternalLink className="w-5 h-5" />
                                    <span>예매하기 이동</span>
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
                                                href={p.versusLink}
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
                                                href={p.highlightsLink}
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
