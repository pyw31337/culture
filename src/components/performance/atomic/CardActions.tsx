import React, { useState } from 'react';
import { Share2, Search, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

interface CardActionsProps {
    onShare?: () => Promise<boolean>;
    onDetail?: () => void;
    className?: string;
    isPrimary?: boolean;
}

export const CardActions = ({ onShare, onDetail, className, isPrimary = true }: CardActionsProps) => {
    const [isCopied, setIsCopied] = useState(false);

    const handleShare = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onShare) {
            const success = await onShare();
            if (success) {
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
            }
        }
    };

    const handleDetail = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onDetail) onDetail();
    };

    return (
        <div className={clsx("flex gap-2 items-center w-full", className)} style={{ zIndex: 'var(--z-card-overlay)' }}>
            <button
                onClick={handleShare}
                className={clsx(
                    "flex-none aspect-square h-[44px] sm:h-[48px] rounded-[12px] flex items-center justify-center transition-all border relative",
                    isPrimary ? "bg-white/10 text-white border-white/20 hover:bg-white/20" : "bg-black/10 text-black border-black/10 hover:bg-black/20"
                )}
                aria-label="공공유하기"
            >
                <Share2 className="w-5 h-5" />
                <AnimatePresence>
                    {isCopied && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, y: 10 }}
                            className="absolute -top-12 left-1/2 -translate-x-1/2 bg-black/90 text-white text-xs font-extrabold px-3 py-1.5 rounded-lg whitespace-nowrap shadow-xl border border-white/20"
                        >
                            <span className="text-emerald-400">✓</span> 복사됨!
                        </motion.div>
                    )}
                </AnimatePresence>
            </button>

            <button
                onClick={handleDetail}
                className={clsx(
                    "flex-1 h-[44px] sm:h-[48px] rounded-[12px] flex items-center justify-center gap-2 font-black text-sm transition-all",
                    isPrimary ? "bg-white text-black hover:bg-gray-100 shadow-lg" : "bg-black text-white hover:bg-gray-800 shadow-md"
                )}
            >
                자세히 보기
                <Search className="w-4 h-4" />
            </button>
        </div>
    );
};
