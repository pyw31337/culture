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
    const active = contexts.find((context) => context.id === activeContext) || contexts[0];

    return (
        <div className={clsx('mb-6 rounded-[1.75rem] border border-white/10 bg-white/6 p-4 light:border-slate-200 light:bg-white/90', className)}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400 light:text-slate-500">Quick Context</p>
                    <h3 className="mt-1 text-lg font-black tracking-tight text-white light:text-slate-900">지금 찾는 상황부터 좁혀볼 수 있어요.</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-300 light:text-slate-600">{active.description}</p>
                </div>
                <div className="flex flex-wrap gap-2 sm:max-w-[55%] sm:justify-end">
                    {contexts.map((context) => {
                        const selected = context.id === activeContext;
                        return (
                            <button
                                key={context.id}
                                type="button"
                                onClick={() => onChange(context.id)}
                                className={clsx(
                                    'rounded-full px-3.5 py-2 text-sm font-bold transition',
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
            </div>
        </div>
    );
}
