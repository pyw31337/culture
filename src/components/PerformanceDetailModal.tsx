import React, { useEffect, useState } from 'react'; // Verified: Naver Link Enforced
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, MapPin, Share2, ExternalLink, Download, Clock, Ticket, Tag } from 'lucide-react';
import { Performance } from '@/types';
import ImageWithFallback from './ImageWithFallback';
import { getOptimizedUrl, getDistrictFromAddress } from '@/lib/utils';
import Image from 'next/image';
import Portal from './ui/Portal';

interface PerformanceDetailModalProps {
    performance: Performance;
    isOpen: boolean;
    onClose: () => void;
    onShare: () => void;
    onBooking: () => void;
}

export default function PerformanceDetailModal({ performance, isOpen, onClose, onShare, onBooking }: PerformanceDetailModalProps) {
    if (!isOpen) return null;



    // Helper to generate ICS file content
    const generateICS = () => {
        const now = new Date().toISOString().replace(/-|:|\.\d+/g, '');
        // Parsing logic for date (Simplified for demo)
        // Ideally should parse 'YYYY.MM.DD' to Date object
        const dateStr = performance.date.split('~')[0].trim().replace(/\./g, '');
        const startDate = `${dateStr} T090000`; // Default start time
        const endDate = `${dateStr} T110000`; // Default end time

        const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//CultureFlow//KR',
            'BEGIN:VEVENT',
            `UID:${performance.id} @cultureflow`,
            `DTSTAMP:${now} `,
            `DTSTART:${startDate} `,
            `DTEND:${endDate} `,
            `SUMMARY:${performance.title} `,
            `DESCRIPTION:${performance.genre} | ${performance.price || ''} | ${performance.link} `,
            `LOCATION:${performance.venue} `,
            'END:VEVENT',
            'END:VCALENDAR'
        ].join('\r\n');

        const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.setAttribute('download', `${performance.title}.ics`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (

        <Portal>
            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={onClose}
                            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100000] flex items-center justify-center p-4 sm:p-6"
                        />

                        {/* Modal Content */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            drag="y"
                            dragControls={undefined}
                            dragConstraints={{ top: 0, bottom: 0 }}
                            dragElastic={{ top: 0, bottom: 0.2 }}
                            onDragEnd={(e, info) => {
                                if (info.offset.y > 100 || info.velocity.y > 500) {
                                    onClose();
                                }
                            }}
                            className="fixed z-[100001] w-full max-w-4xl bg-[#1a1b1e] rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex flex-col md:flex-row max-h-[90vh] md:max-h-[80vh] cursor-grab active:cursor-grabbing"
                        >
                            {/* Close Button (Mobile Absolute) */}
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 z-[110] p-2 bg-black/50 rounded-full text-white/80 hover:bg-white hover:text-black transition-all md:hidden"
                            >
                                <X size={20} />
                            </button>

                            {/* Left: Image Section */}
                            <div className="w-full md:w-2/5 h-64 md:h-auto relative bg-black/50">
                                <div className="absolute inset-0">
                                    <ImageWithFallback
                                        src={getOptimizedUrl(performance.image, 800)}
                                        backupSrc={performance.backupPoster}
                                        alt={performance.title}
                                        fill
                                        className="object-cover opacity-80"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#1a1b1e] via-transparent to-transparent md:bg-gradient-to-r" />
                                </div>
                                <div className="relative z-10 h-full flex items-center justify-center p-6">
                                    <div className="relative aspect-[3/4] w-48 md:w-64 rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/20">
                                        <ImageWithFallback
                                            src={getOptimizedUrl(performance.image, 600)}
                                            backupSrc={performance.backupPoster}
                                            alt={performance.title}
                                            fill
                                            className="object-cover"
                                        />
                                        {/* Volleyball/Basketball/Baseball/Handball/Hockey Team Logos Overlay */}
                                        {['volleyball', 'basketball', 'baseball', 'handball'].includes(performance.genre) && performance.homeTeamLogo && performance.awayTeamLogo && (
                                            <div className="absolute inset-x-0 top-0 pt-6 px-4 flex justify-between items-start z-20">
                                                <div className="flex flex-col items-center gap-1">
                                                    <div className="w-24 h-24 bg-white/90 rounded-full p-2 shadow-lg backdrop-blur-sm">
                                                        <img src={performance.homeTeamLogo} alt={performance.homeTeam} className="w-full h-full object-contain" />
                                                    </div>
                                                    <span className="text-white font-extrabold drop-shadow-md bg-black/50 px-2 rounded-full text-sm">{performance.homeTeam}</span>
                                                </div>
                                                <div className="mt-8 text-white/90 font-black text-2xl italic bg-black/30 px-4 py-1 rounded-full backdrop-blur-[1px]">VS</div>
                                                <div className="flex flex-col items-center gap-1">
                                                    <div className="w-24 h-24 bg-white/90 rounded-full p-2 shadow-lg backdrop-blur-sm">
                                                        <img src={performance.awayTeamLogo} alt={performance.awayTeam} className="w-full h-full object-contain" />
                                                    </div>
                                                    <span className="text-white font-extrabold drop-shadow-md bg-black/50 px-2 rounded-full text-sm">{performance.awayTeam}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Right: Info Section */}
                            <div className="w-full md:w-3/5 p-6 md:p-10 flex flex-col h-full overflow-y-auto custom-scrollbar">
                                {/* Header */}
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <span className="inline-block px-2 py-1 rounded-md bg-white/10 text-white/70 text-xs font-black mb-3 border border-white/5">
                                            {performance.genre.toUpperCase()}
                                        </span>
                                        <h2 className="text-2xl md:text-3xl font-black text-white leading-tight mb-2 break-keep">
                                            {performance.title}
                                        </h2>


                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="hidden md:block p-2 text-gray-400 hover:text-white transition-colors"
                                    >
                                        <X size={24} />
                                    </button>
                                </div>

                                {/* Details Grid */}
                                <div className="grid gap-4 mb-8">
                                    <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                                        <Calendar className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
                                        <div>
                                            <p className="text-xs text-gray-400 mb-0.5">일정</p>
                                            <p className="text-sm text-gray-200 font-bold">{performance.date}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                                        <MapPin className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" />
                                        <div className="flex-1 flex items-center justify-between gap-4">
                                            <div>
                                                <p className="text-xs text-gray-400 mb-0.5">장소</p>
                                                <p className="text-sm text-gray-200 font-bold">{performance.venue}</p>
                                            </div>
                                            <span className="text-xs font-bold text-gray-500 shrink-0">
                                                {performance.district || getDistrictFromAddress(performance.address)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                                        <Ticket className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                                        <div className="flex-1">
                                            <p className="text-xs text-gray-400 mb-0.5">가격</p>
                                            <p className="text-sm text-gray-200 font-bold whitespace-pre-wrap">{performance.price || '가격 정보 없음'}</p>
                                        </div>
                                    </div>

                                    {(performance.runningTime || performance.ageRating) && (
                                        <div className="grid grid-cols-2 gap-4">
                                            {performance.runningTime && (
                                                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                                                    <Clock className="w-5 h-5 text-purple-400 mt-0.5 shrink-0" />
                                                    <div>
                                                        <p className="text-xs text-gray-400 mb-0.5">관람시간</p>
                                                        <p className="text-sm text-gray-200 font-bold">{performance.runningTime}</p>
                                                    </div>
                                                </div>
                                            )}
                                            {performance.ageRating && (
                                                <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                                                    <Tag className="w-5 h-5 text-rose-400 mt-0.5 shrink-0" />
                                                    <div>
                                                        <p className="text-xs text-gray-400 mb-0.5">관람연령</p>
                                                        <p className="text-sm text-gray-200 font-bold">{performance.ageRating}</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Detailed Metadata Section: Director, Cast, Provider, Info */}
                                {(performance.director || (performance.cast && performance.cast.length > 0) || performance.movieInfo) && (
                                    <div className="mb-6 space-y-4">
                                        {/* Director */}
                                        {performance.director && (
                                            <div>
                                                <h3 className="text-gray-400 text-xs font-black mb-2">감독</h3>
                                                <div className="flex flex-wrap gap-2">
                                                    <a
                                                        href={`https://search.naver.com/search.naver?query=${encodeURIComponent(performance.director.replace('더보기', '').trim())}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors text-sm text-gray-200"
                                                    >
                                                        {performance.director.replace('더보기', '').trim()}
                                                    </a >
                                                </div >
                                            </div >
                                        )}

                                        {/* Cast */}
                                        {
                                            performance.cast && performance.cast.length > 0 && (
                                                <div>
                                                    <h3 className="text-gray-400 text-xs font-black mb-2">출연</h3>
                                                    <div className="flex flex-wrap gap-2">
                                                        {performance.cast.map((actor: string | { name: string; url?: string }, idx: number) => {
                                                            const isObj = typeof actor === 'object';
                                                            const rawName = isObj ? actor.name : actor as string;

                                                            // Always use Naver Search Link
                                                            const url = `https://search.naver.com/search.naver?query=${encodeURIComponent(rawName.replace('더보기', '').trim())}`;

                                                            const cleanName = rawName.replace('더보기', '').trim();

                                                            if (!cleanName) return null;
                                                            return (
                                                                <a
                                                                    key={idx}
                                                                    href={url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors text-sm text-gray-200"
                                                                >
                                                                    {cleanName}
                                                                </a>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )
                                        }
                                        {/* Crew / Creators */}
                                        {performance.crew && performance.crew.length > 0 && (
                                            <div>
                                                <h3 className="text-gray-400 text-xs font-black mb-2">창작자</h3>
                                                <div className="flex flex-wrap gap-2">
                                                    {performance.crew.map((person: string, idx: number) => (
                                                        <a
                                                            key={idx}
                                                            href={`https://search.naver.com/search.naver?query=${encodeURIComponent(person.trim())}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors text-sm text-gray-200"
                                                        >
                                                            {person.trim()}
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Movie Info (Genre/Runtime/Rating) */}
                                        {
                                            performance.movieInfo && (
                                                <div>
                                                    <h3 className="text-gray-400 text-xs font-black mb-2">정보</h3>
                                                    <p className="text-sm text-gray-300 leading-relaxed">
                                                        {performance.movieInfo}
                                                    </p>
                                                </div>
                                            )
                                        }
                                        {/* Production Info (KOPIS) */}
                                        {performance.production && (
                                            <div>
                                                <h3 className="text-gray-400 text-xs font-black mb-2">제작</h3>
                                                <div className="text-sm text-gray-300 leading-relaxed bg-white/5 p-3 rounded-xl border border-white/5">
                                                    {performance.production}
                                                </div>
                                            </div>
                                        )}

                                        {/* Description (MomMom) */}
                                        {
                                            performance.description && (
                                                <div>
                                                    <h3 className="text-gray-400 text-xs font-black mb-2">상세 정보</h3>
                                                    <div className="text-sm text-gray-300 leading-relaxed whitespace-pre-line bg-white/5 p-4 rounded-xl border border-white/5">
                                                        {performance.description}
                                                    </div>
                                                </div>
                                            )
                                        }
                                    </div >
                                )}

                                {/* Actions */}
                                <div className="mt-auto grid grid-cols-2 gap-3">
                                    <button
                                        onClick={onShare}
                                        className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/5 text-white font-bold hover:bg-white/10 transition-colors border border-white/10"
                                    >
                                        <Share2 size={18} />
                                        공유하기
                                    </button>
                                    <button
                                        onClick={generateICS}
                                        className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/5 text-white font-bold hover:bg-white/10 transition-colors border border-white/10"
                                    >
                                        <Download size={18} />
                                        캘린더 저장
                                    </button>
                                    <button
                                        onClick={onBooking}
                                        className="col-span-2 flex items-center justify-center gap-2 py-4 px-6 rounded-xl bg-indigo-600 text-white font-black hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20"
                                    >
                                        <ExternalLink size={20} />
                                        예매처 바로가기
                                    </button>
                                </div>

                                {/* Footer Info */}
                                <div className="mt-6 text-center text-[10px] text-gray-500">
                                    데이터 출처: {performance.link.includes('interpark') ? '인터파크' : '서울문화포털'} 외
                                </div>
                            </div >
                        </motion.div >
                    </>
                )}
            </AnimatePresence >
        </Portal >
    );

}
