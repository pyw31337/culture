'use client';

import React, { useMemo } from 'react';

/**
 * Rainbow Background — faithful adaptation of: 
 * https://codepen.io/sylvaingarnot/pen/OJqoXaR
 * 
 * 25 individually animated color rays sweep across the screen. 
 * Each ray is a zero-width div with a multi-layered box-shadow (purple/blue/green).
 * Fog layers at the bottom and left edge blend the stripes softly into the background.
 * 
 * Light mode: white fog blending (like the original).
 * Dark mode: dark fog blending with slightly boosted color opacity.
 */
export default function RainbowBackground() {
    const layers = useMemo(() => {
        const PURPLE = 'rgb(232, 121, 249)';
        const BLUE = 'rgb(96, 165, 250)';
        const GREEN = 'rgb(94, 234, 212)';
        const ANIMATION_TIME = 45;
        const COUNT = 25;

        return Array.from({ length: COUNT }).map((_, i) => {
            const index = i + 1;
            const r = Math.floor(Math.random() * 6) + 1;
            let colors: string[];

            if (r === 1) colors = [PURPLE, BLUE, GREEN];
            else if (r === 2) colors = [PURPLE, GREEN, BLUE];
            else if (r === 3) colors = [GREEN, PURPLE, BLUE];
            else if (r === 4) colors = [GREEN, BLUE, PURPLE];
            else if (r === 5) colors = [BLUE, GREEN, PURPLE];
            else colors = [BLUE, PURPLE, GREEN];

            const duration = ANIMATION_TIME - (ANIMATION_TIME / COUNT / 2) * index;
            const delay = -(index / COUNT) * ANIMATION_TIME;

            return { id: index, colors, duration, delay };
        });
    }, []);

    return (
        <div className="rainbow-bg-wrapper">
            <div className="rb-rays-container">
                {layers.map((layer) => (
                    <div
                        key={layer.id}
                        className="rb-ray"
                        style={{
                            '--rb-c1': layer.colors[0],
                            '--rb-c2': layer.colors[1],
                            '--rb-c3': layer.colors[2],
                            '--rb-dur': `${layer.duration}s`,
                            '--rb-del': `${layer.delay}s`,
                        } as React.CSSProperties}
                    />
                ))}
            </div>
            <div className="rb-fog-h" />
            <div className="rb-fog-v" />

            <style dangerouslySetInnerHTML={{
                __html: `
                .rainbow-bg-wrapper {
                    position: fixed;
                    inset: 0;
                    z-index: 0;
                    overflow: hidden;
                    pointer-events: none;
                    background: white;
                }

                .dark .rainbow-bg-wrapper {
                    background: #0a0a0a;
                }

                .rb-rays-container {
                    position: absolute;
                    inset: 0;
                    mask-image: linear-gradient(to right, transparent 0%, transparent 50%, black 72%, black 100%);
                    -webkit-mask-image: linear-gradient(to right, transparent 0%, transparent 50%, black 72%, black 100%);
                }

                .rb-ray {
                    height: 100vh;
                    width: 0;
                    top: 0;
                    right: -25vw;
                    position: absolute;
                    transform: rotate(10deg);
                    transform-origin: top right;
                    box-shadow:
                        -130px 0 80px 40px var(--rb-bg),
                        -50px 0 50px 25px var(--rb-c1),
                        0 0 50px 25px var(--rb-c2),
                        50px 0 50px 25px var(--rb-c3),
                        130px 0 80px 40px var(--rb-bg);
                    animation: rb-slide var(--rb-dur) linear infinite;
                    animation-delay: var(--rb-del);
                }

                /* Light mode: white blending — exactly like the original */
                .rb-ray { --rb-bg: white; }
                .rb-fog-h { --rb-bg: white; }
                .rb-fog-v { --rb-bg: white; }

                /* Dark mode: dark blending, softer fog */
                .dark .rb-ray { --rb-bg: #0a0a0a; }
                .dark .rb-fog-h { --rb-bg: #0a0a0a; }
                .dark .rb-fog-v { --rb-bg: #0a0a0a; }

                @keyframes rb-slide {
                    from { right: -25vw; }
                    to { right: 125vw; }
                }

                .rb-fog-h {
                    box-shadow: 0 0 50vh 30vh var(--rb-bg);
                    width: 100vw;
                    height: 0;
                    bottom: 0;
                    left: 0;
                    position: absolute;
                    z-index: 1;
                }

                .rb-fog-v {
                    box-shadow: 0 0 25vw 15vw var(--rb-bg);
                    width: 0;
                    height: 100vh;
                    bottom: 0;
                    left: 0;
                    position: absolute;
                    z-index: 1;
                }
            `}} />
        </div>
    );
}
