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
    fallbackSrc = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMzMzIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiM2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=',
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
