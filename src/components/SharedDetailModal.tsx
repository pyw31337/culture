'use client';

import { Performance } from '@/types';
import { GENRES, GENRE_STYLES } from '@/lib/constants';
import { X, ExternalLink, MapPin, Calendar, Clock, Users, Star, Tag, Ticket, Share2 } from 'lucide-react';
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
    const rawImg = p.image || p.backupPoster || p.posterUrl || '';
    const [imgSrc, setImgSrc] = useState(rawImg ? getOptimizedUrl(rawImg) : '');
    const fallbackImg = p.backupPoster || p.posterUrl || '';

    const handleShare = async () => {
        const url = `${window.location.origin}${window.location.pathname}#p=${p.id}`;
        await navigator.clipboard.writeText(url);
        alert('링크가 복사되었습니다.');
    };

    return (
        <Portal>
            <div
                ref={overlayRef}
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
                onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
            >
                {/* Card */}
                <div
                    className="relative w-full max-w-lg bg-gray-900 rounded-3xl shadow-2xl border border-gray-700/50 overflow-hidden animate-in fade-in zoom-in-95 duration-300"
                    style={{ maxHeight: '90vh' }}
                >
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
                            <div className="absolute top-4 left-4 flex gap-2">
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
                                className="absolute top-4 right-4 p-2 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            {/* Title overlay */}
                            <div className="absolute bottom-4 left-5 right-5">
                                <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight drop-shadow-lg line-clamp-2">
                                    {p.title}
                                </h2>
                                {p.originalTitle && (
                                    <p className="text-sm text-white/60 mt-1 font-medium">{p.originalTitle}</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Content */}
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

                        {/* Info Grid */}
                        <div className="space-y-3 mb-5">
                            {p.venue && (
                                <div className="flex items-start gap-3">
                                    <MapPin className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                                    <span className="text-sm text-gray-300">{p.venue}</span>
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
                                        <span className="text-sm text-gray-300 leading-relaxed">{castNames.join(', ')}</span>
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
                                className={`flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-white font-extrabold text-sm ${genreStyle.twBg} hover:opacity-90 transition-all shadow-lg`}
                                style={{ boxShadow: `0 4px 20px ${genreStyle.hex}40` }}
                            >
                                <ExternalLink className="w-4 h-4" />
                                자세히 보기
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
        </Portal>
    );
}
