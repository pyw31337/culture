import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HeroTemplate } from '../../lib/hero-templates';
import { clsx } from 'clsx';

const HOLD_DURATION_MS = 10000;
const TYPE_DELAY_MS = 46;
const DELETE_DELAY_MS = 28;
const CYCLE_GAP_MS = 260;

const Cursor = () => (
    <span className="inline-block w-[4px] h-[1em] bg-[#FACC15] ml-[0.5ch] align-sub animate-cursor-blink" />
);

export const TypingHero = ({
    template,
    onCycle,
    paused,
    searchMode = 'keyword',
    isAtTop = true
}: {
    template: HeroTemplate,
    onCycle: () => void,
    paused: boolean,
    searchMode?: 'keyword' | 'location',
    isAtTop?: boolean
}) => {
    const len1 = template.line1.length;
    const lenBold = template.boldPrefix?.length || 0;
    const len2Pre = template.line2Pre.length;
    const lenHl = template.highlight.length;
    const lenSuf = template.suffix.length;
    const totalLen = len1 + lenBold + len2Pre + lenHl + lenSuf;
    const fullText = useMemo(() => (
        `${template.line1}${template.boldPrefix || ''}${template.line2Pre}${template.highlight}${template.suffix}`
    ), [template.line1, template.boldPrefix, template.line2Pre, template.highlight, template.suffix]);
    const onCycleRef = useRef(onCycle);
    const [phase, setPhase] = useState<'TYPE' | 'WAIT' | 'DELETE' | 'CYCLING'>('TYPE');
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        onCycleRef.current = onCycle;
    }, [onCycle]);

    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout> | undefined;
        let animationFrame: number | undefined;

        if ((paused || !isAtTop) && phase !== 'WAIT') {
            timeout = setTimeout(() => {
                setProgress(totalLen);
                setPhase('WAIT');
            }, 0);
            return () => clearTimeout(timeout);
        }

        if (phase === 'WAIT') {
            if (paused || !isAtTop) return;

            timeout = setTimeout(() => {
                setPhase('DELETE');
            }, HOLD_DURATION_MS);
        } else if (phase === 'DELETE') {
            timeout = setTimeout(() => {
                setProgress((prev) => {
                    const next = prev - 1;
                    if (next <= 0) {
                        setPhase('CYCLING');
                        onCycleRef.current();
                        return 0;
                    }
                    return next;
                });
            }, DELETE_DELAY_MS);
        } else if (phase === 'TYPE') {
            const startedAt = performance.now() - (progress * TYPE_DELAY_MS);
            let lastProgress = progress;

            const tick = (now: number) => {
                const next = Math.min(totalLen, Math.floor((now - startedAt) / TYPE_DELAY_MS));

                if (next !== lastProgress) {
                    lastProgress = next;
                    setProgress(next);
                }

                if (next >= totalLen) {
                    setPhase('WAIT');
                    return;
                }

                animationFrame = requestAnimationFrame(tick);
            };

            animationFrame = requestAnimationFrame(tick);
        } else if (phase === 'CYCLING') {
            timeout = setTimeout(() => {
                setPhase((current) => current === 'CYCLING' ? 'TYPE' : current);
            }, CYCLE_GAP_MS);
        }

        return () => {
            if (timeout) clearTimeout(timeout);
            if (animationFrame) cancelAnimationFrame(animationFrame);
        };
    }, [phase, totalLen, paused, isAtTop, fullText]);

    const getSub = (text: string, offset: number) => {
        if (progress < offset) return '';
        if (progress >= offset + text.length) return text;
        return text.slice(0, progress - offset);
    };

    const t1 = getSub(template.line1, 0);
    const tBold = template.boldPrefix ? getSub(template.boldPrefix, len1) : '';
    const t2Pre = getSub(template.line2Pre, len1 + lenBold);
    const tHl = getSub(template.highlight, len1 + lenBold + len2Pre);
    const tSuf = getSub(template.suffix, len1 + lenBold + len2Pre + lenHl);

    let cursorSegment: 'line1' | 'bold' | 'line2Pre' | 'hl' | 'suffix' | null = null;

    if (phase === 'TYPE' || phase === 'DELETE' || phase === 'CYCLING') {
        if (progress <= len1) cursorSegment = 'line1';
        else if (progress <= len1 + lenBold) cursorSegment = 'bold';
        else if (progress <= len1 + lenBold + len2Pre) cursorSegment = 'line2Pre';
        else if (progress <= len1 + lenBold + len2Pre + lenHl) cursorSegment = 'hl';
        else cursorSegment = 'suffix';
    }

    if (phase === 'WAIT') cursorSegment = 'suffix';

    return (
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-light text-white light:text-black leading-[1.15] tracking-tighter block break-keep min-h-[2.3em]">
            {t1}
            {cursorSegment === 'line1' && <Cursor />}
            <br />
            {tBold && (
                <span className="font-black text-white light:text-black">
                    {tBold}
                </span>
            )}
            {cursorSegment === 'bold' && <Cursor />}
            {t2Pre}
            {cursorSegment === 'line2Pre' && <Cursor />}
            <span className={clsx(
                'font-black text-transparent bg-clip-text animate-shine bg-[length:200%_auto] tracking-normal py-1',
                searchMode === 'location'
                    ? 'bg-gradient-to-r from-emerald-300 via-teal-400 to-green-300'
                    : 'bg-gradient-to-r from-[#a78bfa] via-[#f472b6] to-[#a78bfa]'
            )}>
                {tHl}
            </span>
            {cursorSegment === 'hl' && <Cursor />}
            {tSuf}
            {cursorSegment === 'suffix' && <Cursor />}
        </h2>
    );
};
