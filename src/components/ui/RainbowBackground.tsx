'use client';

import React from 'react';

export default function RainbowBackground() {
    return (
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-white light:bg-white dark:bg-[#0a0a0a]">
            {/* Rainbow Layers */}
            {Array.from({ length: 25 }).map((_, i) => (
                <div key={i} className="rainbow" />
            ))}
            
            {/* Fog/Atmosphere Layers */}
            <div className="h" />
            <div className="v" />
        </div>
    );
}
