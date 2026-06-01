import React from 'react';
import { clsx } from 'clsx';

interface HorizontalScrollProps {
    children: React.ReactNode;
    className?: string;
}

export const HorizontalScroll = ({ children, className }: HorizontalScrollProps) => {
    return (
        <div className={clsx("relative overflow-hidden", className)}>
            <div className="flex gap-2 min-w-max overflow-x-auto overscroll-x-contain scrollbar-hide pb-2 pt-0.5" style={{ touchAction: 'pan-x pan-y' }}>
                {children}
            </div>
            <div className="absolute right-0 top-0 bottom-2 w-12 bg-gradient-to-l from-gray-900/40 light:from-white/40 to-transparent pointer-events-none" />
        </div>
    );
};
