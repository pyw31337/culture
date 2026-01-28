import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface HorizontalScrollProps {
    children: React.ReactNode;
    className?: string;
}

export const HorizontalScroll = ({ children, className }: HorizontalScrollProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const [constraints, setConstraints] = useState({ left: 0, right: 0 });

    const updateConstraints = () => {
        if (containerRef.current && contentRef.current) {
            const containerWidth = containerRef.current.offsetWidth;
            const contentWidth = contentRef.current.scrollWidth;
            // Subtracting safety margin (16px) to ensure user can scroll to the very end
            setConstraints({ left: Math.min(0, containerWidth - contentWidth - 16), right: 0 });
        }
    };

    useEffect(() => {
        updateConstraints();
        // Use a small timeout to handle cases where children rendering/layout might be delayed
        const timer = setTimeout(updateConstraints, 50);
        window.addEventListener('resize', updateConstraints);
        return () => {
            window.removeEventListener('resize', updateConstraints);
            clearTimeout(timer);
        };
    }, [children]);

    return (
        <div ref={containerRef} className={clsx("overflow-hidden cursor-grab active:cursor-grabbing relative", className)}>
            <motion.div
                ref={contentRef}
                drag="x"
                dragConstraints={constraints}
                dragElastic={0.4}
                // Use whileDrag to handle pointer events more cleanly if needed
                className="flex gap-2 min-w-max pb-2 pt-0.5"
            >
                {children}
            </motion.div>
            {/* Visual indicator for overflow */}
            <div className="absolute right-0 top-0 bottom-2 w-12 bg-gradient-to-l from-gray-900/40 light:from-white/40 to-transparent pointer-events-none" />
        </div>
    );
};
