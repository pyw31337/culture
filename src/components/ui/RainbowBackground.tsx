'use client';

import React from 'react';

/**
 * Lightweight rainbow atmosphere.
 *
 * The previous version animated 25 large box-shadow rays across a fixed layer.
 * That looked lively, but it kept the compositor busy while users scrolled or
 * opened modals. This static layered gradient preserves the brand mood while
 * removing continuous paint work from the main browsing path.
 */
export default function RainbowBackground() {
    return (
        <div className="rainbow-bg-wrapper" aria-hidden="true">
            <div className="rb-gradient rb-gradient-a" />
            <div className="rb-gradient rb-gradient-b" />
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
                    background: #fff;
                    contain: strict;
                }

                .dark .rainbow-bg-wrapper {
                    background: #0a0f1d;
                }

                .rb-gradient {
                    position: absolute;
                    inset: -12vh -10vw;
                    transform: translateZ(0) rotate(8deg);
                    will-change: auto;
                    mask-image: linear-gradient(to right, transparent 0%, transparent 43%, black 64%, black 100%);
                    -webkit-mask-image: linear-gradient(to right, transparent 0%, transparent 43%, black 64%, black 100%);
                }

                .rb-gradient-a {
                    opacity: 0.72;
                    background:
                        linear-gradient(100deg,
                            transparent 0 44%,
                            rgba(94, 234, 212, 0.0) 45%,
                            rgba(94, 234, 212, 0.38) 52%,
                            rgba(96, 165, 250, 0.42) 58%,
                            rgba(232, 121, 249, 0.48) 64%,
                            rgba(94, 234, 212, 0.36) 70%,
                            rgba(96, 165, 250, 0.30) 77%,
                            transparent 86%);
                    filter: blur(18px);
                }

                .rb-gradient-b {
                    opacity: 0.42;
                    background:
                        radial-gradient(circle at 78% 12%, rgba(232,121,249,0.36), transparent 23%),
                        radial-gradient(circle at 88% 50%, rgba(94,234,212,0.34), transparent 28%),
                        radial-gradient(circle at 70% 82%, rgba(96,165,250,0.32), transparent 24%);
                    filter: blur(28px);
                }

                .dark .rb-gradient-a { opacity: 0.38; }
                .dark .rb-gradient-b { opacity: 0.28; }

                .rb-fog-h {
                    position: absolute;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    height: 45vh;
                    background: linear-gradient(to top, var(--rb-bg), transparent);
                }

                .rb-fog-v {
                    position: absolute;
                    top: 0;
                    bottom: 0;
                    left: 0;
                    width: 54vw;
                    background: linear-gradient(to right, var(--rb-bg), transparent);
                }

                .rainbow-bg-wrapper { --rb-bg: #fff; }
                .dark .rainbow-bg-wrapper { --rb-bg: #0a0f1d; }
            `}} />
        </div>
    );
}
