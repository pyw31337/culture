import React, { useState, useEffect } from 'react';
import { HeroTemplate } from '../../lib/hero-templates';
import { clsx } from 'clsx';

const Cursor = () => (
    <span className="inline-block w-[4px] h-[1em] bg-[#FACC15] ml-[0.5ch] align-sub animate-cursor-blink" />
);

export const TypingHero = ({
    template,
    onCycle,
    paused,
    searchMode = 'keyword'
}: {
    template: HeroTemplate,
    onCycle: () => void,
    paused: boolean,
    searchMode?: 'keyword' | 'location'
}) => {
    const [displayedTemplate, setDisplayedTemplate] = useState<HeroTemplate>(template);
    // Phases: TYPE (writing), WAIT (holding text), DELETE (erasing), CYCLING (waiting for new prop)
    const [phase, setPhase] = useState<'WAIT' | 'DELETE' | 'TYPE' | 'CYCLING'>('TYPE');
    const [progress, setProgress] = useState(0);

    // Calculate segment lengths
    const len1 = displayedTemplate.line1.length;
    const lenBold = displayedTemplate.boldPrefix?.length || 0;
    const len2Pre = displayedTemplate.line2Pre.length;
    const lenHl = displayedTemplate.highlight.length;
    const lenSuf = displayedTemplate.suffix.length;
    const totalLen = len1 + lenBold + len2Pre + lenHl + lenSuf;

    // React to template updates from parent
    useEffect(() => {
        // Only update if actually different content/reference

        const isStructureSame =
            template.line1 === displayedTemplate.line1 &&
            template.line2Pre === displayedTemplate.line2Pre &&
            template.suffix === displayedTemplate.suffix;

        const isContentDifferent =
            template.line1 !== displayedTemplate.line1 ||
            template.highlight !== displayedTemplate.highlight;

        if (template !== displayedTemplate || isContentDifferent) {
            // Smart Update: If only highlight changed (e.g. user typing in search), 
            // update the content but DO NOT reset the typing phase.
            // AND ensure we don't restart progress or phase.
            if (isStructureSame && template.highlight !== displayedTemplate.highlight) {
                setDisplayedTemplate(prev => ({ ...prev, highlight: template.highlight }));
                return;
            }

            setDisplayedTemplate(template);
            setPhase('TYPE');
            setProgress(0);
        }
    }, [template, displayedTemplate]);

    useEffect(() => {
        if (phase === 'CYCLING') return; // Idle while waiting for parent

        let timeout: NodeJS.Timeout;

        if (phase === 'WAIT') {
            // Key Fix: If paused, stay in WAIT phase (hold the completed sentence).
            if (paused) return;

            // Wait 5 seconds before deleting
            timeout = setTimeout(() => {
                setPhase('DELETE');
            }, 5000);
        } else if (phase === 'DELETE') {
            // If paused during delete, freeze state.
            if (paused) return;

            // Delete backwards
            timeout = setTimeout(() => {
                setProgress(prev => {
                    const next = prev - 1;
                    if (next < 0) {
                        setPhase('CYCLING'); // Stop loop
                        onCycle(); // Request new template
                        return 0;
                    }
                    return next;
                });
            }, 50);
        } else if (phase === 'TYPE') {
            // Key Fix: Ignore 'paused' prop during TYPE phase to ensure sentence finishes.
            // Type forwards
            timeout = setTimeout(() => {
                setProgress(prev => {
                    const next = prev + 1;
                    if (next > totalLen) {
                        setPhase('WAIT');
                        return totalLen;
                    }
                    return next;
                });
            }, 100);
        }

        return () => clearTimeout(timeout);
    }, [phase, progress, totalLen, onCycle, paused]);

    // Helper to slice text based on global progress
    const getSub = (text: string, offset: number) => {
        if (progress < offset) return '';
        if (progress >= offset + text.length) return text;
        return text.slice(0, progress - offset);
    };

    const t1 = getSub(displayedTemplate.line1, 0);
    const tBold = displayedTemplate.boldPrefix ? getSub(displayedTemplate.boldPrefix, len1) : '';
    const t2Pre = getSub(displayedTemplate.line2Pre, len1 + lenBold);
    const tHl = getSub(displayedTemplate.highlight, len1 + lenBold + len2Pre);
    const tSuf = getSub(displayedTemplate.suffix, len1 + lenBold + len2Pre + lenHl);

    // Determine active segment for cursor placement
    let cursorSegment: 'line1' | 'bold' | 'line2Pre' | 'hl' | 'suffix' | null = null;

    // Show cursor during typing, deletion, or cycling (at start)
    if (phase === 'TYPE' || phase === 'DELETE' || phase === 'CYCLING') {
        if (progress <= len1) cursorSegment = 'line1';
        else if (progress <= len1 + lenBold) cursorSegment = 'bold';
        else if (progress <= len1 + lenBold + len2Pre) cursorSegment = 'line2Pre';
        else if (progress <= len1 + lenBold + len2Pre + lenHl) cursorSegment = 'hl';
        else cursorSegment = 'suffix';
    }
    // In WAIT phase, we usually hide cursor or blink at end. Let's blink at end.
    if (phase === 'WAIT') cursorSegment = 'suffix';

    return (
        <h2 className="text-4xl md:text-5xl lg:text-6xl font-light text-white light:text-black leading-[1.15] tracking-tighter hidden sm:block break-keep min-h-[2.3em]">
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
                "font-black text-transparent bg-clip-text animate-shine bg-[length:200%_auto] tracking-normal py-1",
                searchMode === 'location'
                    ? "bg-gradient-to-r from-emerald-300 via-teal-400 to-green-300"
                    : "bg-gradient-to-r from-[#a78bfa] via-[#f472b6] to-[#a78bfa]"
            )}>
                {tHl}
            </span>
            {cursorSegment === 'hl' && <Cursor />}
            {tSuf}
            {cursorSegment === 'suffix' && <Cursor />}
        </h2>
    );
};
