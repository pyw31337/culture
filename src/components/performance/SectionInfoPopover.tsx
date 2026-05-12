'use client';

import { useEffect, useRef, useState } from 'react';
import { Info, X } from 'lucide-react';
import { clsx } from 'clsx';

interface SectionInfoPopoverProps {
    title: string;
    description: string;
    className?: string;
}

export default function SectionInfoPopover({ title, description, className }: SectionInfoPopoverProps) {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (event: MouseEvent) => {
            if (!wrapperRef.current?.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsOpen(false);
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen]);

    return (
        <div
            ref={wrapperRef}
            className={clsx('relative inline-flex', className)}
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
        >
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/12 bg-white/8 text-slate-300 transition hover:border-sky-300/35 hover:text-white light:border-slate-200 light:bg-white light:text-slate-500 light:hover:border-sky-300 light:hover:text-sky-700"
                aria-label={`${title} 설명 보기`}
                title={`${title} 설명 보기`}
            >
                <Info className="h-3.5 w-3.5" />
            </button>

            {isOpen && (
                <div className="absolute left-0 top-[calc(100%+0.75rem)] z-40 w-[min(22rem,calc(100vw-2rem))] rounded-3xl border border-white/12 bg-[#07111f]/96 p-4 text-left text-white shadow-[0_20px_50px_rgba(0,0,0,0.35)] light:border-slate-200 light:bg-white light:text-slate-900">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-sky-300 light:text-sky-700">Section Note</p>
                            <h3 className="mt-1 text-sm font-black tracking-tight">{title}</h3>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="rounded-full p-1 text-slate-400 transition hover:bg-white/10 hover:text-white light:hover:bg-slate-100 light:hover:text-slate-900"
                            aria-label="설명 닫기"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-300 light:text-slate-600">{description}</p>
                </div>
            )}
        </div>
    );
}
