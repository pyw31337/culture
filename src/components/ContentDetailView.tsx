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

    const hex = genreStyle.hex;

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
        ? "w-full max-w-2xl mx-auto bg-white/5 dark:bg-gray-900/40 backdrop-blur-3xl rounded-[32px] shadow-2xl overflow-hidden border border-white/10 border-t-white/20"
        : "relative w-full h-full bg-gray-900 rounded-[32px] shadow-[0_32px_64px_rgba(0,0,0,0.6)] overflow-hidden border border-white/20 holo-effect";

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className={containerClasses}
        >
            <div className="overflow-y-auto overflow-x-hidden max-h-[85vh] md:max-h-none scrollbar-hide">
                {/* Hero Image Section */}
                {imgSrc && (
                    <div className="relative h-60 sm:h-[450px] w-full group">
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
                        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/30 to-transparent" />

                        {/* Aesthetic Overlays */}
                        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                        {/* Genre badge */}
                        <div className="absolute top-6 left-6 flex gap-2 z-20">
                            <motion.span
                                initial={{ x: -20, opacity: 0 }}
                                animate={{ x: 0, opacity: 1 }}
                                transition={{ delay: 0.3 }}
                                className={`px-5 py-2 rounded-full text-[11px] font-black text-white ${genreStyle.twBg} shadow-xl tracking-[0.1em] uppercase border border-white/20`}
                            >
                                {genreLabel}
                            </motion.span>
                        </div>

                        {/* Sports VS Overlay */}
                        {isSports && hasTeams && (
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
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ delay: 0.7, type: 'spring' }}
                                        className="text-white text-3xl font-black italic bg-black/60 px-6 py-2 rounded-full backdrop-blur-2xl border border-white/20 shadow-2xl skew-x-[-12deg]"
                                    >
                                        VS
                                    </motion.div>
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

                {/* Main Content */}
                <div className="p-6 sm:p-8 pt-4 sm:pt-6 space-y-4 sm:space-y-8">
                    <motion.div variants={itemVariants}>
                        <h2 className="text-2xl sm:text-5xl font-black text-white leading-[1.1] tracking-tighter mb-2 sm:mb-3 drop-shadow-sm">
                            {p.title}
                        </h2>
                        {p.originalTitle && (
                            <p className="text-base text-gray-400 font-medium italic opacity-70 tracking-wide">{p.originalTitle}</p>
                        )}
                    </motion.div>

                    {/* Price & Primary CTA */}
                    <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                        {p.price && (
                            <div className="flex-1 p-4 sm:p-5 rounded-[20px] sm:rounded-[24px] bg-white/[0.04] border border-white/10 shadow-inner flex items-center gap-3 sm:gap-4 group hover:bg-white/[0.07] transition-all">
                                <div className={`p-3 sm:p-4 rounded-[16px] sm:rounded-[20px] ${genreStyle.twBg} bg-opacity-30 group-hover:scale-110 transition-transform`}>
                                    <Ticket className={`w-6 h-6 sm:w-7 sm:h-7 text-white`} />
                                </div>
                                <div>
                                    {hasDiscount && (
                                        <div className="flex items-center gap-2 mb-0.5 opacity-80">
                                            <span className="text-xs text-gray-500 line-through font-medium">{p.originalPrice}</span>
                                            <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-500 text-[10px] font-black">{p.discount}</span>
                                        </div>
                                    )}
                                    <span className="text-2xl font-black text-white tracking-tight leading-none">{p.price}</span>
                                </div>
                            </div>
                        )}
                    </motion.div>

                    {/* Content Grid */}
                    <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        {[
                            { icon: p.genre === 'movie' ? Film : MapPin, text: p.venue, color: 'text-emerald-400', label: '장소' },
                            { icon: Calendar, text: formatUnifiedDate(p.date), color: 'text-blue-400', label: '날짜' },
                            { icon: Clock, text: p.runningTime, color: 'text-amber-400', label: '시간' },
                            { icon: Tag, text: p.productionCountry, color: 'text-purple-400', label: '정보' }
                        ].filter(item => item.text).map((item, idx) => (
                            <div key={idx} className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-colors">
                                <div className="bg-white/10 p-2.5 sm:p-3 rounded-lg sm:rounded-xl border border-white/10 shrink-0">
                                    <item.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${item.color}`} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">{item.label}</p>
                                    <p className="text-sm text-gray-200 font-bold truncate">{item.text}</p>
                                </div>
                            </div>
                        ))}
                    </motion.div>

                    {/* Cast & Director */}
                    {(p.director || hasCast) && (
                        <motion.div variants={itemVariants} className="p-6 rounded-[28px] bg-gray-800/30 border border-white/10 space-y-5 backdrop-blur-lg">
                            {p.director && (
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shrink-0">
                                        <Star className="w-5 h-5 text-amber-500" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] text-gray-500 font-black tracking-[0.2em] uppercase">Director</p>
                                        <p className="text-base text-white font-bold truncate">{p.director}</p>
                                    </div>
                                </div>
                            )}
                            {hasCast && (
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-sky-500/10 flex items-center justify-center border border-sky-500/20 shrink-0 mt-1">
                                        <Users className="w-5 h-5 text-sky-500" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[10px] text-gray-500 font-black tracking-[0.2em] uppercase mb-2">Cast</p>
                                        <div className="flex flex-wrap gap-2">
                                            {castNames.map((name, idx) => (
                                                <a
                                                    key={idx}
                                                    href={`https://search.naver.com/search.naver?query=${encodeURIComponent(name)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-gray-300 hover:text-white transition-all font-bold border border-white/5"
                                                >
                                                    {name}
                                                </a>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {/* Description */}
                    {p.description && (
                        <motion.div variants={itemVariants} className="relative p-6 rounded-[28px] bg-emerald-500/5 border border-emerald-500/10">
                            <Sparkles className="absolute -top-3 -left-3 w-8 h-8 text-emerald-500/20" />
                            <p className="text-sm sm:text-base text-gray-300 leading-relaxed font-medium italic text-center opacity-90">
                                "{p.description}"
                            </p>
                        </motion.div>
                    )}

                    {/* Action Block */}
                    <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 pt-4">
                        <motion.a
                            whileHover={{ scale: 1.02, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            href={p.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex-[2] flex items-center justify-center gap-3 px-8 py-5 rounded-2xl text-white font-black text-lg ${genreStyle.twBg} shadow-2xl relative overflow-hidden group`}
                            style={{ boxShadow: `0 20px 40px -12px ${hex}80` }}
                        >
                            <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            <ExternalLink className="w-6 h-6 animate-bounce-slow" />
                            <span>지금 바로 예매하기</span>
                        </motion.a>

                        <motion.button
                            whileHover={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
                            whileTap={{ scale: 0.95 }}
                            onClick={handleShare}
                            className="flex-1 px-8 py-5 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold border border-white/10 flex items-center justify-center gap-3 transition-all backdrop-blur-md"
                        >
                            <Share2 className="w-5 h-5" />
                            <span>공유</span>
                        </motion.button>
                    </motion.div>

                    {mode === 'standalone' && (
                        <motion.div
                            variants={itemVariants}
                            className="pt-6 sm:pt-12 pb-2 sm:pb-4 text-center border-t border-white/10"
                        >
                            <p className="text-[9px] sm:text-[10px] text-gray-500 mb-4 sm:mb-6 tracking-[0.4em] uppercase font-black opacity-60">Experience More Culture</p>
                            <Link href="/">
                                <motion.div
                                    whileHover={{ scale: 1.05, y: -2 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="inline-flex items-center gap-3 px-10 py-4 rounded-full bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 text-white font-black text-sm border border-emerald-500/30 transition-all shadow-[0_0_30px_rgba(16,185,129,0.1)] group"
                                >
                                    <Sparkles className="w-5 h-5 text-emerald-400 group-hover:rotate-12 transition-transform" />
                                    <span>Culture Flow 전체 둘러보기</span>
                                </motion.div>
                            </Link>
                        </motion.div>
                    )}
                </div>
            </div>
        </motion.div>
    );
}
