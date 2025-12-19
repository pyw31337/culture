import { useState, useEffect } from 'react';
import Image, { ImageProps } from 'next/image';
import { getOptimizedUrl } from '@/lib/utils';

interface ImageWithFallbackProps extends Omit<ImageProps, 'src'> {
    src: string;
    fallbackSrc?: string;
    optimizationWidth?: number;
}

export default function ImageWithFallback({
    src,
    fallbackSrc = '/api/placeholder/400/300',
    alt,
    optimizationWidth = 400,
    ...props
}: ImageWithFallbackProps) {
    // 1. Try Optimized URL
    // 2. Try Original URL (bypassing optimization)
    // 3. Show Placeholder

    const [imgSrc, setImgSrc] = useState<string>('');
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        // Reset state when src changes
        setHasError(false);
        // Start with optimized URL
        setImgSrc(getOptimizedUrl(src, optimizationWidth));
    }, [src, optimizationWidth]);

    const handleError = () => {
        if (!hasError) {
            // First failure: Try original URL (bypass proxy)
            setHasError(true);
            setImgSrc(src);
        } else {
            // Second failure: Show fallback placeholder
            if (imgSrc !== fallbackSrc) {
                setImgSrc(fallbackSrc);
            }
        }
    };

    return (
        <Image
            {...props}
            src={imgSrc || fallbackSrc} // Ensure src is never empty
            alt={alt}
            onError={handleError}
            // Ensure unoptimized is true if we are falling back to original to avoid next/image server errors if domain not configured
            unoptimized={hasError}
        />
    );
}
