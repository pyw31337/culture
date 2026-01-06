import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, MapPin, Share2, ExternalLink, Download, Clock } from 'lucide-react';
import { Performance } from '@/types';
import ImageWithFallback from './ImageWithFallback';
import { getOptimizedUrl } from '@/lib/utils';
import Image from 'next/image';

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
        const startDate = `${dateStr}T090000`; // Default start time
        const endDate = `${dateStr}T110000`; // Default end time

        const icsContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//CultureFlow//KR',
            'BEGIN:VEVENT',
            `UID:${performance.id}@cultureflow`,
            `DTSTAMP:${now}`,
            `DTSTART:${startDate}`,
            `DTEND:${endDate}`,
            `SUMMARY:${performance.title}`,
            `DESCRIPTION:${performance.genre} | ${performance.price || ''} | ${performance.link}`,
            `LOCATION:${performance.venue}`,
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
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-xl z-[100] flex items-center justify-center p-4 sm:p-6"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed z-[101] w-full max-w-4xl bg-black/40 backdrop-blur-2xl rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-white/20 flex flex-col md:flex-row max-h-[90vh] md:max-h-[80vh] ring-1 ring-white/10"
                    >
                        {/* Close Button (Mobile Absolute) */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 z-[110] p-2 bg-black/20 backdrop-blur-md rounded-full text-white/80 hover:bg-white hover:text-black transition-all md:hidden border border-white/10"
                        >
                            <X size={20} />
                        </button>

                        {/* Left: Image Section */}
                        <div className="w-full md:w-2/5 h-64 md:h-auto relative">
                            <div className="absolute inset-0">
                                <ImageWithFallback
                                    src={getOptimizedUrl(performance.image, 800)}
                                    alt={performance.title}
                                    fill
                                    className="object-cover opacity-60 blur-sm scale-110"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent md:bg-gradient-to-r" />
                            </div>
                            <div className="relative z-10 h-full flex items-center justify-center p-6">
                                <div className="relative aspect-[3/4] w-48 md:w-64 rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/30 transform hover:scale-[1.02] transition-transform duration-500">
                                    <ImageWithFallback
                                        src={getOptimizedUrl(performance.image, 600)}
                                        alt={performance.title}
                                        fill
                                        className="object-cover"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Right: Info Section */}
                        <div className="w-full md:w-3/5 p-6 md:p-10 flex flex-col h-full overflow-y-auto custom-scrollbar relative">
                            {/* Subtle Noise Texture Overlay (Optional, simplified to gradient here) */}
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-50" />

                            {/* Header */}
                            <div className="relative flex justify-between items-start mb-6 z-10">
                                <div>
                                    <span className="inline-block px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-white/90 text-[10px] font-bold mb-3 border border-white/20 shadow-sm tracking-wider">
                                        {performance.genre.toUpperCase()}
                                    </span>
                                    <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight mb-2 break-keep drop-shadow-lg">
                                        {performance.title}
                                    </h2>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="hidden md:block p-2 text-white/50 hover:text-white transition-colors hover:bg-white/10 rounded-full"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Details Grid */}
                            <div className="relative grid gap-3 mb-8 z-10">
                                {[
                                    { icon: Calendar, label: "일정", value: performance.date, color: "text-indigo-300" },
                                    { icon: MapPin, label: "장소", value: performance.venue, color: "text-rose-300" },
                                    { icon: Clock, label: "가격", value: performance.price || '무료', color: "text-amber-300" }
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors shadow-inner">
                                        <div className={`p-2 rounded-lg bg-white/5 ${item.color}`}>
                                            <item.icon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-400 uppercase tracking-widest">{item.label}</p>
                                            <p className="text-sm text-gray-100 font-medium">{item.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Actions */}
                            <div className="mt-auto grid grid-cols-2 gap-3 z-10">
                                <button
                                    onClick={onShare}
                                    className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-white/5 text-white font-medium hover:bg-white/15 transition-all border border-white/10 hover:border-white/30 backdrop-blur-sm group"
                                >
                                    <Share2 size={18} className="group-hover:scale-110 transition-transform" />
                                    <span className="text-sm">공유하기</span>
                                </button>
                                <button
                                    onClick={generateICS}
                                    className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-white/5 text-white font-medium hover:bg-white/15 transition-all border border-white/10 hover:border-white/30 backdrop-blur-sm group"
                                >
                                    <Download size={18} className="group-hover:scale-110 transition-transform" />
                                    <span className="text-sm">캘린더 저장</span>
                                </button>
                                <button
                                    onClick={onBooking}
                                    className="col-span-2 flex items-center justify-center gap-2 py-4 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold hover:shadow-[0_0_20px_rgba(79,70,229,0.5)] hover:scale-[1.01] transition-all border border-indigo-400/30"
                                >
                                    <ExternalLink size={20} />
                                    예매처 바로가기
                                </button>
                            </div>

                            {/* Footer Info */}
                            <div className="mt-6 text-center text-[10px] text-white/30 z-10">
                                데이터 출처: {performance.link.includes('interpark') ? '인터파크' : '서울문화포털'} 외
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
