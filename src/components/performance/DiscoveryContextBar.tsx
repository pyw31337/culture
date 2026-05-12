import React from 'react';
import { clsx } from 'clsx';
import type { DiscoveryContextDefinition } from '@/lib/discovery';
import type { DiscoveryContextId } from '@/types';

interface DiscoveryContextBarProps {
    contexts: DiscoveryContextDefinition[];
    activeContext: DiscoveryContextId;
    onChange: (contextId: DiscoveryContextId) => void;
    className?: string;
}

export default function DiscoveryContextBar({
    contexts,
    activeContext,
    onChange,
    className,
}: DiscoveryContextBarProps) {
    return (
        <div className={clsx('flex flex-wrap items-center gap-2', className)}>
            {contexts.map((context) => {
                const selected = context.id === activeContext;
                return (
                    <button
                        key={context.id}
                        type="button"
                        onClick={() => onChange(context.id)}
                        className={clsx(
                            'rounded-full px-3 py-1.5 text-[11px] sm:text-xs font-bold transition whitespace-nowrap',
                            selected
                                ? 'bg-white text-slate-900 shadow-lg shadow-sky-500/10 light:bg-slate-900 light:text-white'
                                : 'border border-white/10 bg-white/6 text-slate-200 hover:border-sky-300/35 hover:text-white light:border-slate-200 light:bg-white light:text-slate-600 light:hover:border-sky-300 light:hover:text-sky-700'
                        )}
                    >
                        {context.label}
                    </button>
                );
            })}
        </div>
    );
}
