import React from 'react';
import { clsx } from 'clsx';

interface RecommendationReasonChipsProps {
    reasons?: string[];
    comparisonTags?: string[];
    className?: string;
    compact?: boolean;
}

export default function RecommendationReasonChips({
    reasons = [],
    comparisonTags = [],
    className,
    compact = false,
}: RecommendationReasonChipsProps) {
    const visibleReasons = reasons.slice(0, compact ? 1 : 2);
    const visibleTags = comparisonTags.slice(0, compact ? 1 : 2);

    if (visibleReasons.length === 0 && visibleTags.length === 0) return null;

    return (
        <div className={clsx('flex flex-wrap items-center gap-1.5', className)}>
            {visibleReasons.map((reason) => (
                <span
                    key={reason}
                    className={clsx(
                        'rounded-full border border-white/15 bg-black/35 px-2.5 py-1 text-[10px] font-black tracking-tight text-white backdrop-blur-md light:border-slate-300 light:bg-white light:text-slate-700',
                        compact && 'px-2 py-0.5 text-[9px]'
                    )}
                >
                    {reason}
                </span>
            ))}
            {visibleTags.map((tag) => (
                <span
                    key={tag}
                    className={clsx(
                        'rounded-full border border-white/10 bg-white/8 px-2.5 py-1 text-[10px] font-semibold tracking-tight text-slate-200 light:border-slate-300 light:bg-slate-100 light:text-slate-600',
                        compact && 'px-2 py-0.5 text-[9px]'
                    )}
                >
                    {tag}
                </span>
            ))}
        </div>
    );
}
