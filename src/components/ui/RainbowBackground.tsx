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
            <style dangerouslySetInnerHTML={{
                __html: `
                .rainbow-bg-wrapper {
                    position: fixed;
                    inset: 0;
                    z-index: 0;
                    overflow: hidden;
                    pointer-events: none;
                    background:
                        linear-gradient(to right, var(--rb-bg) 0%, var(--rb-bg) 46%, transparent 66%),
                        linear-gradient(to top, var(--rb-bg) 0%, transparent 42%),
                        radial-gradient(circle at 82% 12%, rgba(232,121,249,0.22), transparent 22%),
                        radial-gradient(circle at 88% 52%, rgba(94,234,212,0.24), transparent 28%),
                        radial-gradient(circle at 72% 82%, rgba(96,165,250,0.22), transparent 24%),
                        linear-gradient(100deg,
                            transparent 0 44%,
                            rgba(94, 234, 212, 0.0) 45%,
                            rgba(94, 234, 212, 0.28) 52%,
                            rgba(96, 165, 250, 0.32) 58%,
                            rgba(232, 121, 249, 0.34) 64%,
                            rgba(94, 234, 212, 0.26) 70%,
                            rgba(96, 165, 250, 0.22) 77%,
                            transparent 86%),
                        var(--rb-bg);
                    background-attachment: scroll;
                    contain: strict;
                }

                .rainbow-bg-wrapper { --rb-bg: #fff; }
                .dark .rainbow-bg-wrapper { --rb-bg: #0a0f1d; }
            `}} />
        </div>
    );
}
