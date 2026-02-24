'use client';

import { Performance } from '@/types';
import { GENRES, GENRE_STYLES } from '@/lib/constants';
import { OTT_PLATFORMS } from '@/lib/constants';
import { X, ExternalLink, MapPin, Calendar, Clock, Users, Star, Tag, Ticket, Share2, Sparkles, MonitorPlay } from 'lucide-react';
import Portal from './ui/Portal';
import { useEffect, useRef, useState } from 'react';
import { getOptimizedUrl } from '@/lib/utils';

interface SharedDetailModalProps {
    performance: Performance;
    onClose: () => void;
}

export default function SharedDetailModal({ performance: p, onClose }: SharedDetailModalProps) {
    const overlayRef = useRef<HTMLDivElement>(null);
    const genreStyle = GENRE_STYLES[p.genre] || GENRE_STYLES['all'];
    const genreLabel = GENRES.find(g => g.id === p.genre)?.label || p.genre;
    const [phase, setPhase] = useState<'spin' | 'reveal'>('spin');

    // Animation phases: spin (0.8s) → reveal
    useEffect(() => {
        const t = setTimeout(() => setPhase('reveal'), 800);
        return () => clearTimeout(t);
    }, []);

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

    return (
        <Portal>
            {/* Inline keyframes for the animations */}
            <style>{`
                @keyframes sdm-spin-in {
                    0% { transform: perspective(1200px) rotateY(0deg) scale(0.3); opacity: 0; }
                    30% { transform: perspective(1200px) rotateY(540deg) scale(0.6); opacity: 0.7; }
                    70% { transform: perspective(1200px) rotateY(900deg) scale(0.9); opacity: 1; }
                    85% { transform: perspective(1200px) rotateY(1050deg) scale(1.02); }
                    100% { transform: perspective(1200px) rotateY(1080deg) scale(1); }
                }
                @keyframes sdm-glow-rotate {
                    0% { transform: translate(-50%, -50%) rotate(0deg); }
                    100% { transform: translate(-50%, -50%) rotate(360deg); }
                }
                @keyframes sdm-shimmer {
                    0% { transform: translateX(-100%) rotate(25deg); }
                    100% { transform: translateX(200%) rotate(25deg); }
                }
                @keyframes sdm-sparkle {
                    0%, 100% { opacity: 0; transform: scale(0) rotate(0deg); }
                    50% { opacity: 1; transform: scale(1) rotate(180deg); }
                }
                @keyframes sdm-float {
                    0%, 100% { transform: translateY(0px); }
                    50% { transform: translateY(-6px); }
                }
                @keyframes sdm-pulse-ring {
                    0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.6; }
                    50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.2; }
                    100% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.6; }
                }
                @keyframes sdm-content-up {
                    0% { opacity: 0; transform: translateY(20px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
                .sdm-card-spin {
                    animation: sdm-spin-in 0.8s cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
                    backface-visibility: hidden;
                }
                .sdm-card-reveal {
                    animation: sdm-float 3s ease-in-out infinite;
                    transform: perspective(1200px) rotateY(0deg) scale(1);
                }
                .sdm-content-reveal {
                    animation: sdm-content-up 0.5s ease-out 0.1s both;
                }
            `}</style>

            <div
                ref={overlayRef}
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
                onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
                style={{
                    background: 'radial-gradient(circle at center, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.92) 100%)',
                    backdropFilter: 'blur(12px)',
                }}
            >
                {/* Rotating Glow Aura — behind the card */}
                <div
                    className="absolute pointer-events-none"
                    style={{
                        top: '50%', left: '50%',
                        width: '600px', height: '600px',
                        animation: 'sdm-glow-rotate 6s linear infinite',
                        background: `conic-gradient(from 0deg, ${hex}00, ${hex}50, ${hex}00, ${hex}30, ${hex}00, ${hex}60, ${hex}00)`,
                        borderRadius: '50%',
                        filter: 'blur(80px)',
                        opacity: phase === 'reveal' ? 0.5 : 0.3,
                        transition: 'opacity 0.5s',
                    }}
                />

                {/* Pulsing Ring */}
                <div
                    className="absolute pointer-events-none"
                    style={{
                        top: '50%', left: '50%',
                        width: '520px', height: '520px',
                        animation: 'sdm-pulse-ring 3s ease-in-out infinite',
                        border: `2px solid ${hex}30`,
                        borderRadius: '50%',
                        opacity: phase === 'reveal' ? 1 : 0,
                        transition: 'opacity 0.5s 0.3s',
                    }}
                />

                {/* Sparkle particles */}
                {phase === 'reveal' && Array.from({ length: 8 }).map((_, i) => (
                    <div
                        key={i}
                        className="absolute pointer-events-none text-white/60"
                        style={{
                            top: `${20 + Math.random() * 60}%`,
                            left: `${15 + Math.random() * 70}%`,
                            animation: `sdm-sparkle ${1.5 + Math.random() * 2}s ease-in-out ${Math.random() * 2}s infinite`,
                            fontSize: `${8 + Math.random() * 12}px`,
                        }}
                    >
                        ✦
                    </div>
                ))}

                {/* Card Container */}
                <div
                    className={phase === 'spin' ? 'sdm-card-spin' : 'sdm-card-reveal'}
                    style={{ perspective: '1200px', transformStyle: 'preserve-3d', width: '100%', maxWidth: '28rem' }}
                >
                    <div
                        className="relative w-full bg-gray-900 rounded-3xl shadow-2xl overflow-hidden"
                        style={{
                            maxHeight: '90vh',
                            border: `1px solid ${hex}30`,
                            boxShadow: `0 0 40px ${hex}20, 0 0 80px ${hex}10, 0 20px 60px rgba(0,0,0,0.5)`,
                        }}
                    >
                        {/* Shimmer sweep overlay */}
                        {phase === 'reveal' && (
                            <div
                                className="absolute inset-0 z-50 pointer-events-none overflow-hidden rounded-3xl"
                                style={{ opacity: 0.4 }}
                            >
                                <div
                                    style={{
                                        position: 'absolute', top: '-50%', left: '-50%',
                                        width: '50%', height: '200%',
                                        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)',
                                        animation: 'sdm-shimmer 3s ease-in-out 0.5s infinite',
                                    }}
                                />
                            </div>
                        )}

                        {/* "추천" Badge */}
                        {phase === 'reveal' && (
                            <div className="sdm-content-reveal absolute top-4 right-14 z-30 flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg shadow-amber-500/30">
                                <Sparkles className="w-3 h-3 text-white" />
                                <span className="text-[10px] font-extrabold text-white tracking-wider">추천</span>
                            </div>
                        )}

                        {/* Hero Image */}
                        {imgSrc && (
                            <div className="relative h-56 sm:h-72 overflow-hidden">
                                <img
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
                                {/* Gradient overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent" />

                                {/* Genre badge */}
                                <div className="absolute top-4 left-4 flex gap-2 z-20">
                                    <span className={`px-3 py-1 rounded-full text-xs font-extrabold text-white ${genreStyle.twBg} shadow-lg`}>
                                        {genreLabel}
                                    </span>
                                    {p.subGenre && p.subGenre !== genreLabel && (
                                        <span className="px-3 py-1 rounded-full text-xs font-bold text-white/90 bg-white/20 backdrop-blur-sm">
                                            {p.subGenre}
                                        </span>
                                    )}
                                </div>

                                {/* Close button */}
                                <button
                                    onClick={onClose}
                                    className="absolute top-4 right-4 z-30 p-2 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>

                                {/* Title overlay */}
                                <div className="absolute bottom-4 left-5 right-5 z-10">
                                    <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight drop-shadow-lg line-clamp-2">
                                        {p.title}
                                    </h2>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {p.ageRating && (
                                            <span className="px-2 py-0.5 rounded bg-white/10 backdrop-blur-md text-[10px] font-bold text-white/80 border border-white/20">
                                                {p.ageRating}
                                            </span>
                                        )}
                                        {p.originalTitle && (
                                            <p className="text-sm text-white/60 font-medium">{p.originalTitle}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Content — staggered reveal */}
                        <div
                            className={phase === 'reveal' ? 'sdm-content-reveal' : 'opacity-0'}
                            style={{ transition: 'opacity 0.3s' }}
                        >
                            <div className="p-5 overflow-y-auto" style={{ maxHeight: imgSrc ? 'calc(90vh - 18rem)' : '80vh' }}>
                                {/* No image - show title here */}
                                {!imgSrc && (
                                    <div className="mb-4">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className={`px-3 py-1 rounded-full text-xs font-extrabold text-white ${genreStyle.twBg}`}>
                                                {genreLabel}
                                            </span>
                                            <button onClick={onClose} className="ml-auto p-1.5 rounded-full hover:bg-gray-800 text-gray-400 hover:text-white transition">
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                        <h2 className="text-2xl font-black text-white">{p.title}</h2>
                                    </div>
                                )}

                                {/* Price Section */}
                                {p.price && (
                                    <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-gray-800/80 to-gray-800/40 border border-gray-700/50">
                                        <div className="flex items-end gap-3">
                                            <Ticket className="w-5 h-5 text-gray-400 shrink-0 mb-0.5" />
                                            <div>
                                                {hasDiscount && (
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-sm text-gray-500 line-through">{p.originalPrice}</span>
                                                        <span className="px-2 py-0.5 rounded-md bg-red-500/20 text-red-400 text-xs font-extrabold">{p.discount}</span>
                                                    </div>
                                                )}
                                                <span className="text-xl font-black text-white">{p.price}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Platform Section (For OTT/Movies) */}
                                {(p.platforms && p.platforms.length > 0) && (
                                    <div className="mb-5 flex flex-wrap gap-2 items-center">
                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mr-1">Available on</span>
                                        {p.platforms.map(pid => {
                                            const plat = OTT_PLATFORMS[pid.toLowerCase()];
                                            if (!plat) return null;
                                            return (
                                                <a
                                                    key={pid}
                                                    href={plat.url.replace('{title}', encodeURIComponent(p.title))}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${plat.color} text-white text-[11px] font-extrabold shadow-sm hover:scale-105 transition-transform`}
                                                >
                                                    {plat.label}
                                                </a>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Info Grid */}
                                <div className="space-y-3 mb-5">
                                    {p.venue && (
                                        <div className="flex items-start gap-3">
                                            {p.genre === 'ott' ? (
                                                <MonitorPlay className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                                            ) : (
                                                <MapPin className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                                            )}
                                            <span className="text-sm text-gray-300">
                                                {p.genre === 'ott' && p.venue === 'OTT' ? '온라인 스트리밍' : p.venue}
                                            </span>
                                        </div>
                                    )}
                                    {p.date && (
                                        <div className="flex items-start gap-3">
                                            <Calendar className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                                            <span className="text-sm text-gray-300">{p.date}</span>
                                        </div>
                                    )}
                                    {p.runningTime && (
                                        <div className="flex items-start gap-3">
                                            <Clock className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                                            <span className="text-sm text-gray-300">{p.runningTime}</span>
                                        </div>
                                    )}
                                    {p.productionCountry && (
                                        <div className="flex items-start gap-3">
                                            <Tag className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                                            <span className="text-sm text-gray-300">{p.productionCountry}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Cast & Director */}
                                {(p.director || hasCast) && (
                                    <div className="mb-5 p-4 rounded-2xl bg-gray-800/50 border border-gray-700/30">
                                        {p.director && (
                                            <div className="flex items-center gap-2 mb-2">
                                                <Star className="w-4 h-4 text-yellow-500" />
                                                <span className="text-xs text-gray-400 font-bold">감독</span>
                                                <span className="text-sm text-white font-semibold">{p.director}</span>
                                            </div>
                                        )}
                                        {hasCast && (
                                            <div className="flex items-start gap-2">
                                                <Users className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                                                <span className="text-xs text-gray-400 font-bold shrink-0 mt-0.5">출연</span>
                                                <div className="flex flex-wrap gap-x-2 gap-y-1">
                                                    {castNames.map((name, idx) => (
                                                        <a
                                                            key={idx}
                                                            href={`https://search.naver.com/search.naver?query=${encodeURIComponent(name)}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-sm text-gray-300 hover:text-white hover:underline transition-colors"
                                                        >
                                                            {name}{idx < castNames.length - 1 ? ',' : ''}
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Description */}
                                {p.description && (
                                    <p className="text-sm text-gray-400 leading-relaxed mb-5 line-clamp-4">{p.description}</p>
                                )}

                                {/* Action Buttons */}
                                <div className="flex gap-3 pt-2">
                                    <a
                                        href={p.link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-white font-extrabold text-sm ${genreStyle.twBg} hover:opacity-90 transition-all shadow-lg relative overflow-hidden`}
                                        style={{ boxShadow: `0 4px 24px ${hex}50` }}
                                    >
                                        {/* Button shimmer */}
                                        <div className="absolute inset-0 overflow-hidden">
                                            <div
                                                style={{
                                                    position: 'absolute', top: '-50%', left: '-50%',
                                                    width: '40%', height: '200%',
                                                    background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
                                                    animation: 'sdm-shimmer 2.5s ease-in-out 1.5s infinite',
                                                }}
                                            />
                                        </div>
                                        <ExternalLink className="w-4 h-4 relative z-10" />
                                        <span className="relative z-10">자세히 보기</span>
                                    </a>
                                    <button
                                        onClick={handleShare}
                                        className="px-4 py-3.5 rounded-2xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors border border-gray-700"
                                        title="링크 복사"
                                    >
                                        <Share2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </Portal>
    );
}
