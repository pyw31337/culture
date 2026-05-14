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
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 perspective-1000"
                    style={{
                        background: 'radial-gradient(circle at center, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.95) 100%)',
                        backdropFilter: 'blur(8px)',
                    }}
                    onClick={onClose}
                >
                    {/* Floating Glow BGs */}
                    <div className="absolute pointer-events-none w-full h-full overflow-hidden">
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
