'use client';

import { Performance } from '@/types';
import { GENRE_STYLES } from '@/lib/constants';
import { X } from 'lucide-react';
import Portal from './ui/Portal';
import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ContentDetailView from './ContentDetailView';

interface SharedDetailModalProps {
    performance: Performance;
    onClose: () => void;
    lastUpdated?: string;
}

export default function SharedDetailModal({ performance: p, onClose, lastUpdated }: SharedDetailModalProps) {
    const genreStyle = GENRE_STYLES[p.genre] || GENRE_STYLES['all'];
    const hex = genreStyle.hex;

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

    // Animation Variants
    const backdropVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1 }
    };

    const cardVariants = {
        hidden: {
            scale: 0.8,
            opacity: 0,
            y: 20,
        },
        visible: {
            scale: 1,
            opacity: 1,
            y: 0,
            transition: {
                type: 'spring' as const,
                stiffness: 300,
                damping: 30
            }
        },
        exit: {
            scale: 0.8,
            opacity: 0,
            y: 20,
            transition: { duration: 0.2 }
        }
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
                    {/* Floating Glow BGs */}
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
                    </div>

                    <motion.div
                        key="card"
                        variants={cardVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="relative w-full max-w-md z-[100]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Close button - Absolute */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 z-[110] p-2.5 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-md text-white/80 hover:text-white transition-all active:scale-95 border border-white/10"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <ContentDetailView performance={p} mode="modal" onClose={onClose} lastUpdated={lastUpdated} />
                    </motion.div>
                </motion.div>
            </AnimatePresence>
        </Portal>
    );
}
