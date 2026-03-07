'use client';

import { Performance } from '@/types';
import { GENRES, GENRE_STYLES, FUTURES_TEAM_LOGOS } from '@/lib/constants';
import { ExternalLink, MapPin, Calendar, Clock, Users, Star, Tag, Ticket, Share2, Sparkles, Film } from 'lucide-react';
import { useState } from 'react';
import { getOptimizedUrl, formatUnifiedDate } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

interface ContentDetailViewProps {
    performance: Performance;
    mode?: 'modal' | 'standalone';
    onClose?: () => void;
}

export default function ContentDetailView({ performance: p, mode = 'modal', onClose }: ContentDetailViewProps) {
    const genreStyle = GENRE_STYLES[p.genre] || GENRE_STYLES['all'];
    const genreLabel = GENRES.find(g => g.id === p.genre)?.label || p.genre;

    const isSports = ['volleyball', 'basketball', 'baseball', 'handball', 'soccer'].includes(p.genre);
    const hasTeams = p.homeTeam && p.awayTeam;

    const hasDiscount = p.discount && p.originalPrice;
    const hasCast = p.cast && p.cast.length > 0;
    const castNames = hasCast ? p.cast!.map(c => typeof c === 'string' ? c : c.name) : [];
    const rawImg = p.image || p.poster || p.backupPoster || p.posterUrl || '';
    const [imgSrc, setImgSrc] = useState(rawImg ? getOptimizedUrl(rawImg) : '');
    const fallbackImg = p.backupPoster || p.posterUrl || p.poster || '';

    const handleShare = async () => {
        const url = `${window.location.origin}${window.location.pathname}${mode === 'modal' ? `#p=${p.id}` : ''}`;
        await navigator.clipboard.writeText(url);
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
        ? "w-full max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-[32px] shadow-2xl overflow-hidden border border-black/5 dark:border-white/10"
        : "relative w-full h-full bg-gray-900 rounded-[32px] shadow-[0_32px_64px_rgba(0,0,0,0.6)] overflow-hidden border border-white/20 holo-effect";

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className={containerClasses}
        >
            <div className={`overflow-y-auto overflow-x-hidden ${mode === 'standalone' ? 'max-h-none' : 'max-h-[85vh] md:max-h-none'} scrollbar-hide`}>
                <div className={mode === 'standalone' ? "flex flex-col md:flex-row h-full min-h-[500px] md:min-h-[600px]" : ""}>
                    {/* Hero / Poster Section */}
                    {imgSrc && (
                        <div className={mode === 'standalone' 
                            ? "relative w-full md:w-[40%] h-48 md:h-auto shrink-0 group" 
                            : "relative h-60 sm:h-[450px] w-full group"}>
                            <motion.img
                                initial={{ scale: 1.15 }}
                                animate={{ scale: 1 }}
                                transition={{ duration: 1.2, ease: "easeOut" }}
                                src={imgSrc}
                                alt={p.title}
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                referrerPolicy="no-referrer"
                                onError={() => {
                                    if (fallbackImg && imgSrc !== fallbackImg && imgSrc !== getOptimizedUrl(fallbackImg)) {
                                        setImgSrc(getOptimizedUrl(fallbackImg));
                                    } else {
                                        setImgSrc('');
                                    }
                                }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent md:hidden" />
                            
                            {/* Genre badge */}
                            <div className="absolute top-4 left-4 flex gap-2 z-20">
                                <motion.span
                                    initial={{ x: -20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                    className={`px-3 py-1 rounded-full text-[9px] font-black text-white ${genreStyle.twBg} shadow-xl tracking-[0.1em] uppercase border border-white/20`}
                                >
                                    {genreLabel}
                                </motion.span>
                            </div>

                            {/* Sports VS Overlay - Only for modal or if space allows */}
                            {isSports && hasTeams && mode !== 'standalone' && (
                                <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-8">
                                    <div className="flex justify-between items-center w-full gap-4">
                                        <motion.img
                                            initial={{ x: -30, opacity: 0, rotate: -10 }}
                                            animate={{ x: 0, opacity: 1, rotate: 0 }}
                                            transition={{ delay: 0.5, type: 'spring' }}
                                            src={p.genre === 'baseball' && p.homeTeam && FUTURES_TEAM_LOGOS[p.homeTeam] ? FUTURES_TEAM_LOGOS[p.homeTeam] : p.homeTeamLogo}
                                            alt={p.homeTeam}
                                            className="w-1/3 aspect-square object-contain drop-shadow-[0_12px_32px_rgba(255,255,255,0.5)]"
                                        />
                                        <div className="text-white text-xl font-black italic bg-black/60 px-4 py-1 rounded-full backdrop-blur-md border border-white/20 shadow-xl">VS</div>
                                        <motion.img
                                            initial={{ x: 30, opacity: 0, rotate: 10 }}
                                            animate={{ x: 0, opacity: 1, rotate: 0 }}
                                            transition={{ delay: 0.5, type: 'spring' }}
                                            src={p.genre === 'baseball' && p.awayTeam && FUTURES_TEAM_LOGOS[p.awayTeam] ? FUTURES_TEAM_LOGOS[p.awayTeam] : p.awayTeamLogo}
                                            alt={p.awayTeam}
                                            className="w-1/3 aspect-square object-contain drop-shadow-[0_12px_32px_rgba(255,255,255,0.5)]"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Main Content Area */}
                    <div className={mode === 'standalone' 
                        ? "flex-1 p-5 md:p-8 flex flex-col justify-between space-y-4 md:space-y-6 bg-white dark:bg-gray-900 text-gray-900 dark:text-white" 
                        : "p-6 sm:p-8 pt-4 sm:pt-6 space-y-4 sm:space-y-8"}>
                        
                        <div className="space-y-4">
                            <motion.div variants={itemVariants}>
                                <h2 className={`${mode === 'standalone' ? 'text-xl md:text-3xl' : 'text-2xl sm:text-5xl'} font-black leading-[1.1] tracking-tighter mb-1 drop-shadow-sm`}>
                                    {p.title}
                                </h2>
                                {p.originalTitle && (
                                    <p className="text-xs md:text-sm text-gray-400 font-medium italic opacity-70 tracking-wide">{p.originalTitle}</p>
                                )}
                            </motion.div>

                            {/* Info Grid - Ultra Compact for Standalone */}
                            <motion.div variants={itemVariants} className={`grid ${mode === 'standalone' ? 'grid-cols-2 gap-2' : 'grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4'}`}>
                                {[
                                    { icon: p.genre === 'movie' ? Film : MapPin, text: p.venue, color: 'text-emerald-500', label: '장소' },
                                    { icon: Calendar, text: formatUnifiedDate(p.date), color: 'text-blue-500', label: '날짜' },
                                    { icon: Ticket, text: p.price, color: 'text-amber-500', label: '가격' },
                                    { icon: Clock, text: p.runningTime, color: 'text-purple-500', label: '시간' }
                                ].filter(item => item.text).map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-gray-50 dark:bg-white/5 border border-black/5 dark:border-white/5 transition-colors">
                                        <div className="bg-white dark:bg-white/10 p-1.5 rounded-lg border border-black/5 dark:border-white/10 shrink-0">
                                            <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[10px] text-gray-600 dark:text-gray-200 font-bold truncate leading-tight">{item.text}</p>
                                        </div>
                                    </div>
                                ))}
                            </motion.div>

                            {/* Description - Brief in standalone */}
                            {p.description && mode === 'standalone' && (
                                <motion.p variants={itemVariants} className="text-xs md:text-sm text-gray-500 dark:text-gray-400 leading-relaxed font-medium italic line-clamp-2 md:line-clamp-3">
                                    "{p.description}"
                                </motion.p>
                            )}

                            {/* Cast for standalone - Small badges */}
                            {hasCast && mode === 'standalone' && (
                                <motion.div variants={itemVariants} className="flex flex-wrap gap-1.5">
                                    {castNames.slice(0, 4).map((name, idx) => (
                                        <span key={idx} className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-white/5 text-[9px] font-bold text-gray-500 dark:text-gray-400">
                                            {name}
                                        </span>
                                    ))}
                                </motion.div>
                            )}
                        </div>

                        {/* Actions Block */}
                        <div className="space-y-3">
                            <motion.div variants={itemVariants} className="flex gap-2">
                                <motion.a
                                    whileHover={{ scale: 1.02, y: -1 }}
                                    whileTap={{ scale: 0.98 }}
                                    href={p.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex-[2] flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white font-black text-sm ${genreStyle.twBg} shadow-lg relative overflow-hidden group`}
                                >
                                    <ExternalLink className="w-4 h-4" />
                                    <span>예매하기</span>
                                </motion.a>

                                <motion.button
                                    whileHover={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleShare}
                                    className="flex-1 px-4 py-3 rounded-xl bg-gray-100 dark:bg-white/5 text-gray-900 dark:text-white font-bold border border-black/5 dark:border-white/10 flex items-center justify-center gap-2 transition-all"
                                >
                                    <Share2 className="w-4 h-4" />
                                    <span>공유</span>
                                </motion.button>
                            </motion.div>

                            {mode === 'standalone' && (
                                <Link href="/">
                                    <motion.div
                                        whileHover={{ scale: 1.02 }}
                                        className="w-full py-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black text-[10px] text-center border border-emerald-500/20 tracking-wider uppercase flex items-center justify-center gap-2"
                                    >
                                        <Sparkles className="w-3.5 h-3.5" />
                                        <span>Culture Flow 둘러보기</span>
                                    </motion.div>
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
