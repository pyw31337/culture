'use client';

import { Performance } from '@/types';
import { GENRES, GENRE_STYLES } from '@/lib/constants';
import { FUTURES_TEAM_LOGOS } from '@/lib/constants';
import { X, ExternalLink, MapPin, Calendar, Clock, Users, Star, Tag, Ticket, Share2, Sparkles, Film } from 'lucide-react';
import Portal from './ui/Portal';
import { useEffect, useState } from 'react';
import { getOptimizedUrl, formatUnifiedDate } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface SharedDetailModalProps {
    performance: Performance;
    onClose: () => void;
}

export default function SharedDetailModal({ performance: p, onClose }: SharedDetailModalProps) {
    const genreStyle = GENRE_STYLES[p.genre] || GENRE_STYLES['all'];
    const genreLabel = GENRES.find(g => g.id === p.genre)?.label || p.genre;

    const isSports = ['volleyball', 'basketball', 'baseball', 'handball', 'soccer'].includes(p.genre);
    const hasTeams = p.homeTeam && p.awayTeam;

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    // Lock body scroll
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    const hasDiscount = p.discount && p.originalPrice;
    const hasCast = p.cast && p.cast.length > 0;
    const castNames = hasCast ? p.cast!.map(c => typeof c === 'string' ? c : c.name) : [];
    const rawImg = p.image || p.poster || p.backupPoster || p.posterUrl || '';
    const [imgSrc, setImgSrc] = useState(rawImg ? getOptimizedUrl(rawImg) : '');
    const fallbackImg = p.backupPoster || p.posterUrl || p.poster || '';

    const handleShare = async () => {
        const url = `${window.location.origin}${window.location.pathname}#p=${p.id}`;
        await navigator.clipboard.writeText(url);
        alert('링크가 복사되었습니다.');
    };

    const hex = genreStyle.hex;

    // Animation Variants
    const backdropVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1 }
    };

    const cardVariants = {
        hidden: {
            scale: 0.1,
            opacity: 0,
            y: 50,
            rotateY: 1080
        },
        visible: {
            scale: 1,
            opacity: 1,
            y: 0,
            rotateY: 0,
            transition: {
                type: 'spring' as const,
                stiffness: 70,
                damping: 20,
                mass: 1.5,
                delayChildren: 0.8,
                staggerChildren: 0.05
            }
        },
        exit: {
            scale: 0.8,
            opacity: 0,
            y: 20,
            transition: { duration: 0.2 }
        }
    } as const;

    const itemVariants = {
        hidden: { opacity: 0, y: 15 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <Portal>
            <AnimatePresence>
                <motion.div
                    key="backdrop"
                    variants={backdropVariants}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 perspective-1000"
                    style={{
                        background: 'radial-gradient(circle at center, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.95) 100%)',
                        backdropFilter: 'blur(16px)',
                    }}
                    onClick={onClose}
                >
                    {/* Floating Glow BGs & Squares */}
                    <div className="absolute pointer-events-none w-full h-full overflow-hidden">
                        <motion.div
                            animate={{
                                scale: [1, 1.2, 1],
                                opacity: [0.3, 0.5, 0.3],
                            }}
                            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute top-1/4 -left-1/4 w-[80vw] h-[80vw] rounded-full blur-[120px]"
                            style={{ background: `${hex}20` }}
                        />
                        <motion.div
                            animate={{
                                scale: [1.2, 1, 1.2],
                                opacity: [0.2, 0.4, 0.2],
                            }}
                            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute bottom-1/4 -right-1/4 w-[70vw] h-[70vw] rounded-full blur-[100px]"
                            style={{ background: `${hex}15` }}
                        />
                        {/* CSS Floating Squares */}
                        <div className="bg-squares text-[2rem] sm:text-[3rem]" style={{ '--square-bg': `${hex}40` } as React.CSSProperties}>
                            {Array.from({ length: 9 }).map((_, i) => (
                                <div key={i} className="bg-square" />
                            ))}
                        </div>
                    </div>

                    {/* Card Container wrapper for 3D flip */}
                    <motion.div
                        key="card"
                        variants={cardVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="relative w-full max-w-md transform-style-3d z-[100]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Back Face (Visible while spinning) */}
                        <div className="absolute inset-0 bg-gray-900 rounded-[32px] shadow-[0_32px_64px_rgba(0,0,0,0.6)] border border-white/20 backface-hidden rotate-y-180 flex items-center justify-center overflow-hidden pointer-events-none"
                            style={{ background: `linear-gradient(135deg, #111 0%, ${hex}40 100%)` }}>
                            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-50 pointer-events-none" />
                            <div className="text-white opacity-60 flex flex-col items-center">
                                <Sparkles className="w-20 h-20 mb-6 animate-pulse" style={{ color: hex }} />
                                <span className="font-black tracking-[0.2em] text-2xl" style={{
                                    textShadow: `0 0 20px ${hex}`,
                                    color: 'white'
                                }}>CULTURE FLOW</span>
                            </div>
                        </div>

                        {/* Front Face (The Actual Card) */}
                        <div className="relative w-full h-full bg-gray-900 rounded-[32px] shadow-[0_32px_64px_rgba(0,0,0,0.6)] overflow-hidden border border-white/20 backface-hidden holo-effect">
                            {/* Close button - Absolute */}
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 z-[60] p-2.5 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white/80 hover:text-white transition-all active:scale-95 border border-white/10"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="overflow-y-auto overflow-x-hidden max-h-[85vh] scrollbar-hide">
                                {/* Hero Image Section */}
                                {imgSrc && (
                                    <div className="relative h-64 sm:h-80 w-full">
                                        <motion.img
                                            initial={{ scale: 1.1 }}
                                            animate={{ scale: 1 }}
                                            transition={{ duration: 0.6, ease: "easeOut" }}
                                            src={imgSrc}
                                            alt={p.title}
                                            className="w-full h-full object-cover"
                                            referrerPolicy="no-referrer"
                                            onError={() => {
                                                if (fallbackImg && imgSrc !== fallbackImg && imgSrc !== getOptimizedUrl(fallbackImg)) {
                                                    setImgSrc(getOptimizedUrl(fallbackImg));
                                                } else {
                                                    setImgSrc('');
                                                }
                                            }}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/20 to-transparent" />

                                        {/* Genre badge */}
                                        <div className="absolute top-5 left-5 flex gap-2 z-20">
                                            <span className={`px-4 py-1.5 rounded-full text-[11px] font-black text-white ${genreStyle.twBg} shadow-lg tracking-wider uppercase`}>
                                                {genreLabel}
                                            </span>
                                        </div>

                                        {/* Recommended Badge */}
                                        <div className="absolute top-5 right-16 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 shadow-xl border border-white/20">
                                            <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
                                            <span className="text-[10px] font-black text-white tracking-widest">BEST</span>
                                        </div>

                                        {/* Sports VS Overlay */}
                                        {isSports && hasTeams && (
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-8">
                                                <div className="flex justify-between items-center w-full gap-4">
                                                    <motion.img
                                                        initial={{ x: -20, opacity: 0 }}
                                                        animate={{ x: 0, opacity: 1 }}
                                                        transition={{ delay: 0.4 }}
                                                        src={p.genre === 'baseball' && p.homeTeam && FUTURES_TEAM_LOGOS[p.homeTeam] ? FUTURES_TEAM_LOGOS[p.homeTeam] : p.homeTeamLogo}
                                                        alt={p.homeTeam}
                                                        className="w-1/3 aspect-square object-contain drop-shadow-[0_8px_24px_rgba(255,255,255,0.4)]"
                                                    />
                                                    <div className="text-white text-2xl font-black italic bg-black/60 px-4 py-1 rounded-full backdrop-blur-xl border border-white/20 shadow-2xl skew-x-[-10deg]">VS</div>
                                                    <motion.img
                                                        initial={{ x: 20, opacity: 0 }}
                                                        animate={{ x: 0, opacity: 1 }}
                                                        transition={{ delay: 0.4 }}
                                                        src={p.genre === 'baseball' && p.awayTeam && FUTURES_TEAM_LOGOS[p.awayTeam] ? FUTURES_TEAM_LOGOS[p.awayTeam] : p.awayTeamLogo}
                                                        alt={p.awayTeam}
                                                        className="w-1/3 aspect-square object-contain drop-shadow-[0_8px_24px_rgba(255,255,255,0.4)]"
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Main Content */}
                                <div className="p-7 pt-5 space-y-6">
                                    <motion.div variants={itemVariants}>
                                        <h2 className="text-2xl sm:text-3xl font-black text-white leading-[1.2] tracking-tight mb-2">
                                            {p.title}
                                        </h2>
                                        {p.originalTitle && (
                                            <p className="text-sm text-gray-500 font-medium italic">{p.originalTitle}</p>
                                        )}
                                    </motion.div>

                                    {/* Price / Ticket */}
                                    {p.price && (
                                        <motion.div variants={itemVariants} className="p-5 rounded-3xl bg-white/[0.03] border border-white/5 shadow-inner">
                                            <div className="flex items-center gap-4">
                                                <div className={`p-3 rounded-2xl ${genreStyle.twBg} bg-opacity-20`}>
                                                    <Ticket className={`w-6 h-6 ${genreStyle.twText}`} />
                                                </div>
                                                <div>
                                                    {hasDiscount && (
                                                        <div className="flex items-center gap-2 mb-0.5">
                                                            <span className="text-xs text-gray-500 line-through decoration-gray-600 font-medium">{p.originalPrice}</span>
                                                            <span className="px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 text-[10px] font-black">{p.discount}</span>
                                                        </div>
                                                    )}
                                                    <span className="text-2xl font-black text-white tracking-tight">{p.price}</span>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Info Grid */}
                                    <motion.div variants={itemVariants} className="grid grid-cols-1 gap-4">
                                        {[
                                            { icon: p.genre === 'movie' ? Film : MapPin, text: p.venue, color: 'text-emerald-400' },
                                            { icon: Calendar, text: formatUnifiedDate(p.date), color: 'text-blue-400' },
                                            { icon: Clock, text: p.runningTime, color: 'text-amber-400' },
                                            { icon: Tag, text: p.productionCountry, color: 'text-purple-400' }
                                        ].filter(item => item.text).map((item, idx) => (
                                            <div key={idx} className="flex items-center gap-3.5">
                                                <div className="bg-white/5 p-2 rounded-xl border border-white/5">
                                                    <item.icon className={`w-4 h-4 ${item.color}`} />
                                                </div>
                                                <span className="text-sm text-gray-300 font-medium opacity-90">{item.text}</span>
                                            </div>
                                        ))}
                                    </motion.div>

                                    {/* Cast & Director */}
                                    {(p.director || hasCast) && (
                                        <motion.div variants={itemVariants} className="p-5 rounded-3xl bg-gray-800/20 border border-white/5 space-y-3">
                                            {p.director && (
                                                <div className="flex items-center gap-3">
                                                    <Star className="w-4 h-4 text-amber-500 shrink-0" />
                                                    <span className="text-xs text-gray-400 font-black tracking-widest shrink-0 uppercase">Director</span>
                                                    <span className="text-sm text-white font-bold">{p.director}</span>
                                                </div>
                                            )}
                                            {hasCast && (
                                                <div className="flex items-start gap-3">
                                                    <Users className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                                                    <span className="text-xs text-gray-400 font-black tracking-widest shrink-0 mt-0.5 uppercase">Cast</span>
                                                    <div className="flex flex-wrap gap-x-2 gap-y-1.5 pt-px">
                                                        {castNames.map((name, idx) => (
                                                            <a
                                                                key={idx}
                                                                href={`https://search.naver.com/search.naver?query=${encodeURIComponent(name)}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-sm text-gray-300 hover:text-white underline underline-offset-4 decoration-white/20 transition-all font-medium"
                                                            >
                                                                {name}{idx < castNames.length - 1 ? ',' : ''}
                                                            </a>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </motion.div>
                                    )}

                                    {/* Description */}
                                    {p.description && (
                                        <motion.p variants={itemVariants} className="text-sm text-gray-400 leading-relaxed line-clamp-4 font-medium italic opacity-80">
                                            "{p.description}"
                                        </motion.p>
                                    )}

                                    {/* Sticky-like Action Footer inside Modal */}
                                    <motion.div variants={itemVariants} className="flex gap-3 pt-4">
                                        <motion.a
                                            whileHover={{ scale: 1.02, filter: 'brightness(1.1)' }}
                                            whileTap={{ scale: 0.98 }}
                                            href={p.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`flex-1 flex items-center justify-center gap-3 px-6 py-4 rounded-2xl text-white font-black text-sm ${genreStyle.twBg} shadow-[0_8px_20px_-4px_rgba(0,0,0,0.4)] relative overflow-hidden`}
                                            style={{ boxShadow: `0 12px 30px -10px ${hex}60` }}
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            <span>예매 및 상세보기</span>
                                        </motion.a>
                                        <motion.button
                                            whileHover={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={handleShare}
                                            className="px-5 py-4 rounded-2xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-white/10"
                                            title="링크 복사"
                                        >
                                            <Share2 className="w-5 h-5" />
                                        </motion.button>
                                    </motion.div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            </AnimatePresence>
        </Portal>
    );
}
