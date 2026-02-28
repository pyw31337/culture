'use client';

import React, { useMemo } from 'react';

/**
 * Stunning Pure CSS Rainbow Background replication.
 * Dynamically generated via React to preserve SCSS randomization logic while maintaining 
 * perfect blending with the application's theme.
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
            let colors: string[] = [];

            // Replicating SCSS @if $r == ... logic
            if (r === 1) colors = [PURPLE, BLUE, GREEN];
            else if (r === 2) colors = [PURPLE, GREEN, BLUE];
            else if (r === 3) colors = [GREEN, PURPLE, BLUE];
            else if (r === 4) colors = [GREEN, BLUE, PURPLE];
            else if (r === 5) colors = [BLUE, GREEN, PURPLE];
            else colors = [BLUE, PURPLE, GREEN];

            // In Dark Mode, we use a dimmer version or just maintain the white borders as transparent/background
            // Note: The 'white' in box-shadow will be overridden by CSS variables for theme blending
            const duration = ANIMATION_TIME - (ANIMATION_TIME / COUNT / 2) * index;
            const delay = -(index / COUNT) * ANIMATION_TIME;

            return {
                id: index,
                colors,
                duration,
                delay
            };
        });
    }, []);

    return (
        <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none bg-white dark:bg-[#0a0a0a]">
            {/* Rainbow Layers */}
            {layers.map((layer) => (
                <div
                    key={layer.id}
                    className="rainbow-layer"
                    style={{
                        '--c1': layer.colors[0],
                        '--c2': layer.colors[1],
                        '--c3': layer.colors[2],
                        '--duration': `${layer.duration}s`,
                        '--delay': `${layer.delay}s`,
                    } as React.CSSProperties}
                />
            ))}

            {/* Fog/Atmosphere Layers */}
            <div className="h-fog" />
            <div className="v-fog" />

            <style dangerouslySetInnerHTML={{
                __html: `
                .rainbow-layer {
                    height: 100vh;
                    width: 0;
                    top: 0;
                    right: -25vw;
                    position: absolute;
                    transform: rotate(10deg);
                    transform-origin: top right;
                    box-shadow: 
                        -130px 0 80px 40px var(--bg-blur), 
                        -50px 0 50px 25px var(--c1),
                        0 0 50px 25px var(--c2), 
                        50px 0 50px 25px var(--c3),
                        130px 0 80px 40px var(--bg-blur);
                    animation: slide var(--duration) linear infinite;
                    animation-delay: var(--delay);
                }

                @keyframes slide {
                    from { right: -25vw; }
                    to { right: 125vw; }
                }

                .h-fog {
                    box-shadow: 0 0 50vh 40vh var(--bg-blur);
                    width: 100vw;
                    height: 0;
                    bottom: 0;
                    left: 0;
                    position: absolute;
                    z-index: 1;
                }

                .v-fog {
                    box-shadow: 0 0 35vw 25vw var(--bg-blur);
                    width: 0;
                    height: 100vh;
                    bottom: 0;
                    left: 0;
                    position: absolute;
                    z-index: 1;
                }

                .dark .rainbow-layer,
                .dark .h-fog,
                .dark .v-fog {
                    --bg-blur: #0a0a0a;
                }

                html:not(.dark) .rainbow-layer,
                html:not(.dark) .h-fog,
                html:not(.dark) .v-fog {
                    --bg-blur: white;
                }
            `}} />
        </div>
    );
}
