'use client';

import { Performance } from '@/types';
import { GENRE_STYLES } from '@/lib/constants';
import Portal from './ui/Portal';
import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ContentDetailView from './ContentDetailView';

interface SharedDetailModalProps {
    performance: Performance;
    onClose: () => void;
}

export default function SharedDetailModal({ performance: p, onClose }: SharedDetailModalProps) {
    const genreStyle = GENRE_STYLES[p.genre] || GENRE_STYLES['all'];
    const hex = genreStyle.hex;
    const scrollYRef = useRef(0);

    // Close on Escape
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    // Lock body scroll without losing the list position behind the modal.
    useEffect(() => {
        scrollYRef.current = window.scrollY;
        const originalOverflow = document.body.style.overflow;
        const originalPosition = document.body.style.position;
        const originalTop = document.body.style.top;
        const originalWidth = document.body.style.width;

        document.body.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollYRef.current}px`;
        document.body.style.width = '100%';

        return () => {
            document.body.style.overflow = originalOverflow;
            document.body.style.position = originalPosition;
            document.body.style.top = originalTop;
            document.body.style.width = originalWidth;
            window.scrollTo({ top: scrollYRef.current, behavior: 'auto' });
        };
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
                    data-cf-modal-backdrop
                    className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden p-4 perspective-1000 bg-black/[0.88] text-white backdrop-blur-[10px] dark:bg-white/[0.88] dark:text-gray-950"
                    onClick={onClose}
                >
                    {/* Keep the page's rainbow atmosphere visible inside the modal backdrop. */}
                    <div className="absolute inset-0 pointer-events-none opacity-80 mix-blend-screen dark:mix-blend-multiply">
                        <div className="absolute -right-16 top-0 h-full w-[55vw] rotate-6 bg-[linear-gradient(90deg,transparent,rgba(34,211,238,0.28),rgba(168,85,247,0.32),rgba(236,72,153,0.24),transparent)] blur-3xl" />
                        <div className="absolute bottom-0 left-0 h-[40vh] w-full bg-[radial-gradient(circle_at_70%_40%,rgba(45,212,191,0.26),transparent_38%),radial-gradient(circle_at_82%_15%,rgba(96,165,250,0.26),transparent_36%),radial-gradient(circle_at_92%_30%,rgba(232,121,249,0.22),transparent_34%)] blur-2xl" />
                    </div>

                    {/* Floating Glow BGs */}
                    <div className="absolute pointer-events-none w-full h-full overflow-hidden opacity-90">
                        <div
                            className="absolute top-1/4 -left-1/4 w-[80vw] h-[80vw] rounded-full blur-[120px]"
                            style={{ background: `${hex}20` }}
                        />
                        <div
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
                        className="relative w-full max-w-[1000px] z-[100]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <ContentDetailView performance={p} mode="modal" onClose={onClose} />
                    </motion.div>
                </motion.div>
            </AnimatePresence>
        </Portal>
    );
}
