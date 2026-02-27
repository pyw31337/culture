'use client';

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';

interface MagicalMeshBackgroundProps {
    searchMode?: 'keyword' | 'location';
}

export default function MagicalMeshBackground({ searchMode = 'keyword' }: MagicalMeshBackgroundProps) {
    // Color Palettes
    // Format: [Color1, Color2, Color3, Color4, Color5]
    const palettes = {
        keyword: {
            dark: ['#7c3aed', '#db2777', '#4338ca', '#9333ea', '#6d28d9'],
            light: ['#ddd6fe', '#fce7f3', '#e0e7ff', '#f5f3ff', '#ede9fe']
        },
        location: {
            dark: ['#10b981', '#06b6d4', '#0f766e', '#0891b2', '#14b8a6'],
            light: ['#d1fae5', '#cfeff4', '#ccfbf1', '#ecfdf5', '#f0fdfa']
        }
    };

    const currentColors = palettes[searchMode];

    // Generate random animation patterns for 5 blobs
    const blobs = useMemo(() => [
        { id: 1, size: 'w-[60vw] h-[60vw]', delay: 0, duration: 25 },
        { id: 2, size: 'w-[50vw] h-[50vw]', delay: 5, duration: 30 },
        { id: 3, size: 'w-[55vw] h-[55vw]', delay: 2, duration: 28 },
        { id: 4, size: 'w-[45vw] h-[45vw]', delay: 8, duration: 35 },
        { id: 5, size: 'w-[65vw] h-[65vw]', delay: 4, duration: 32 },
    ], []);

    const [isDark, setIsDark] = React.useState(true);

    React.useEffect(() => {
        const checkTheme = () => {
            setIsDark(document.documentElement.classList.contains('dark'));
        };
        const observer = new MutationObserver(checkTheme);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        checkTheme();
        return () => observer.disconnect();
    }, []);

    return (
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-gray-950 light:bg-gray-50 transition-colors duration-1000">
            {/* Mesh Container */}
            <div className="absolute inset-[-10%] filter blur-[100px] sm:blur-[140px] opacity-70 dark:opacity-80 light:opacity-40 mix-blend-screen light:mix-blend-multiply transition-opacity duration-1000">
                {blobs.map((blob, i) => (
                    <motion.div
                        key={blob.id}
                        className={clsx(
                            "absolute rounded-full",
                            blob.size
                        )}
                        initial={{
                            x: `${i * 20}%`,
                            y: `${(i % 3) * 30}%`,
                            scale: 1,
                            opacity: 0.8
                        }}
                        animate={{
                            background: `radial-gradient(circle, ${isDark ? currentColors.dark[i] : currentColors.light[i]} 0%, transparent 70%)`,
                            x: [
                                `${(i * 15)}%`,
                                `${(i * 15 + 40) % 100}%`,
                                `${(i * 15 - 30 + 100) % 100}%`,
                                `${(i * 15)}%`
                            ],
                            y: [
                                `${((i % 4) * 20)}%`,
                                `${((i % 4) * 20 + 50) % 100}%`,
                                `${((i % 4) * 20 - 40 + 100) % 100}%`,
                                `${((i % 4) * 20)}%`
                            ],
                            scale: [1, 1.3, 0.85, 1.2, 1],
                            rotate: [0, 120, 240, 360],
                            opacity: [0.7, 0.9, 0.75, 0.85, 0.7]
                        }}
                        transition={{
                            background: { duration: 1, ease: "easeInOut" },
                            duration: blob.duration,
                            repeat: Infinity,
                            delay: blob.delay,
                            ease: "easeInOut"
                        }}
                    />
                ))}
            </div>

            {/* Noise Texture Overlay */}
            <div 
                className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none mix-blend-overlay"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
                }}
            />

            {/* Subtle Gradient Veil */}
            <div className="absolute inset-0 bg-gray-900/10 light:bg-white/5 backdrop-blur-[2px]" />
        </div>
    );
}
