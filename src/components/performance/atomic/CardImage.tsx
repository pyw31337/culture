import React from 'react';
import ImageWithFallback from '../../ImageWithFallback';
import { clsx } from 'clsx';

interface CardImageProps {
    src: string;
    alt: string;
    fallbackGenre?: string;
    className?: string;
    fill?: boolean;
    priority?: boolean;
}

export const CardImage = ({ src = '', alt = 'image', fallbackGenre, className, fill = true, priority = false }: CardImageProps) => {
    return (
        <div className={clsx("relative overflow-hidden w-full h-full", className)}>
            <ImageWithFallback
                src={src}
                alt={alt}
                fill={fill}
                priority={priority}
                className="object-cover transition-transform duration-500 group-hover:scale-110"
                sizes="(max-width: 768px) 50vw, 33vw"
                style={{ zIndex: 'var(--z-card-image)' }}
            />
            {/* Standard Gradient Overlay */}
            <div
                className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"
                style={{ zIndex: 'var(--z-card-gradient)' }}
            />
        </div>
    );
};
