'use client';

import { Performance } from '@/types';
import Portal from './ui/Portal';
import { useEffect, useRef } from 'react';
import ContentDetailView from './ContentDetailView';

interface SharedDetailModalProps {
    performance: Performance;
    allPerformances?: Performance[];
    onClose: () => void;
}

export default function SharedDetailModal({ performance: p, allPerformances = [], onClose }: SharedDetailModalProps) {
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
        const originalHtmlOverflow = document.documentElement.style.overflow;
        const originalPosition = document.body.style.position;
        const originalTop = document.body.style.top;
        const originalWidth = document.body.style.width;

        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.top = `-${scrollYRef.current}px`;
        document.body.style.width = '100%';

        return () => {
            document.body.style.overflow = originalOverflow;
            document.documentElement.style.overflow = originalHtmlOverflow;
            document.body.style.position = originalPosition;
            document.body.style.top = originalTop;
            document.body.style.width = originalWidth;
            window.scrollTo({ top: scrollYRef.current, behavior: 'auto' });
        };
    }, []);

    return (
        <Portal>
            <div
                data-cf-modal-backdrop
                className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden p-4 bg-black/[0.9] text-white dark:bg-white/[0.9] dark:text-gray-950"
                onClick={onClose}
            >
                <div
                    className="absolute inset-0 pointer-events-none opacity-60"
                    style={{
                        backgroundImage:
                            'radial-gradient(circle at 78% 16%, rgba(45, 212, 191, 0.16), transparent 26%), radial-gradient(circle at 88% 32%, rgba(96, 165, 250, 0.16), transparent 28%), radial-gradient(circle at 72% 72%, rgba(232, 121, 249, 0.14), transparent 30%), linear-gradient(105deg, transparent 20%, rgba(34, 211, 238, 0.08) 38%, rgba(168, 85, 247, 0.10) 52%, rgba(236, 72, 153, 0.08) 66%, transparent 82%)',
                    }}
                />

                <div
                    className="relative w-full max-w-[1000px] z-[100]"
                    onClick={(e) => e.stopPropagation()}
                >
                    <ContentDetailView performance={p} allPerformances={allPerformances} mode="modal" onClose={onClose} />
                </div>
            </div>
        </Portal>
    );
}
