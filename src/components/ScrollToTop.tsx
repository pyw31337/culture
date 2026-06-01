'use client';

import { useState, useEffect } from 'react';
import { ChevronUp } from 'lucide-react';
import { clsx } from 'clsx';

export default function ScrollToTop() {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const toggleVisibility = () => setIsVisible(window.scrollY > 400);
        window.addEventListener('scroll', toggleVisibility, { passive: true });
        toggleVisibility();
        return () => window.removeEventListener('scroll', toggleVisibility);
    }, []);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <button
            onClick={scrollToTop}
            className={clsx(
                "fixed bottom-24 right-5 z-[999] p-3 rounded-full bg-white/10 dark:bg-black/20 border border-white/20 dark:border-white/10 text-white shadow-2xl hover:bg-emerald-500 hover:scale-110 active:scale-95 transition-all duration-200 group",
                isVisible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"
            )}
            aria-label="Scroll to top"
        >
            <ChevronUp className="w-6 h-6 group-hover:animate-bounce" />
        </button>
    );
}
