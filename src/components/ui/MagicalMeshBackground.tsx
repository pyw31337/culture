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
            light: ['#c4b5fd', '#f9a8d4', '#a5b4fc', '#d8b4fe', '#c084fc'] // Stronger colors for visibility
        },
        location: {
            dark: ['#10b981', '#06b6d4', '#0f766e', '#0891b2', '#14b8a6'],
            light: ['#6ee7b7', '#67e8f9', '#5eead4', '#22d3ee', '#2dd4bf'] // Stronger colors for visibility
        }
    };

    const currentColors = palettes[searchMode];

    // Generate random animation patterns for 5 blobs - focused on top-right
    const blobs = useMemo(() => [
        { id: 1, size: 'w-[40vw] h-[40vw]', delay: 0, duration: 20 },
        { id: 2, size: 'w-[35vw] h-[35vw]', delay: 5, duration: 25 },
        { id: 3, size: 'w-[30vw] h-[30vw]', delay: 2, duration: 22 },
        { id: 4, size: 'w-[38vw] h-[38vw]', delay: 8, duration: 28 },
        { id: 5, size: 'w-[42vw] h-[42vw]', delay: 4, duration: 26 },
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
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-transparent">
            {/* Mesh Container - Focused Top-Right */}
            <div className="absolute top-[-20%] right-[-20%] w-[120%] h-[120%] filter blur-[80px] sm:blur-[120px] opacity-60 dark:opacity-70 light:opacity-50 mix-blend-screen light:mix-blend-multiply transition-opacity duration-1000">
                {blobs.map((blob, i) => (
                    <motion.div
                        key={blob.id}
                        className={clsx(
                            "absolute rounded-full",
                            blob.size
                        )}
                        initial={{
                            x: `${60 + (i * 5)}%`,
                            y: `${(i % 3) * 10}%`,
                            scale: 1,
                            opacity: 0.6
                        }}
                        animate={{
                            background: `radial-gradient(circle, ${isDark ? currentColors.dark[i] : currentColors.light[i]} 0%, transparent 80%)`,
                            x: [
                                `${70 + (i * 2)}%`,
                                `${85 + (i * 2)}%`,
                                `${65 + (i * 2)}%`,
                                `${70 + (i * 2)}%`
                            ],
                            y: [
                                `${5 + (i * 5)}%`,
                                `${20 + (i * 5)}%`,
                                `${-5 + (i * 5)}%`,
                                `${5 + (i * 5)}%`
                            ],
                            scale: [1, 1.2, 0.9, 1.1, 1],
                            rotate: [0, 90, 180, 270, 360],
                            opacity: [0.5, 0.8, 0.6, 0.7, 0.5]
                        }}
                        transition={{
                            background: { duration: 1.5, ease: "easeInOut" },
                            duration: blob.duration,
                            repeat: Infinity,
                            delay: blob.delay,
                            ease: "easeInOut"
                        }}
                    />
                ))}
            </div>

            {/* Subtle Gradient Veil */}
            <div className="absolute inset-0 bg-transparent backdrop-blur-[1px]" />
        </div>
    );
}
