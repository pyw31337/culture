import { useState, useEffect } from 'react';
import Image, { ImageProps } from 'next/image';
// Trigger rebuild for deployment
import { getOptimizedUrl } from '@/lib/utils';

interface ImageWithFallbackProps extends Omit<ImageProps, 'src'> {
    src: string;
    backupSrc?: string; // New prop for remote URL backup
    fallbackSrc?: string;
    optimizationWidth?: number;
}

export default function ImageWithFallback({
    src,
    backupSrc, // Destructure backupSrc
    fallbackSrc = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMzMzIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiM2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=',
    alt,
    optimizationWidth = 400,
    ...props
}: ImageWithFallbackProps) {
    // 1. Try Optimized URL (usually same as src if local, or wsrv if remote)
    // 2. Try Backup URL (Remote original)
    // 3. Try Placeholder

    const [imgSrc, setImgSrc] = useState<string>('');
    const [errorStage, setErrorStage] = useState(0); // 0: Initial, 1: Backup/Retry, 2: Fallback

    useEffect(() => {
        // Reset state when src changes
        setErrorStage(0);
        // Start with optimized URL or local path
        setImgSrc(getOptimizedUrl(src, optimizationWidth));
    }, [src, optimizationWidth]);

    const handleError = () => {
        if (errorStage === 0) {
            // First failure
            if (backupSrc && backupSrc !== src) {
                // Try Backup URL (Remote)
                setImgSrc(backupSrc);
                setErrorStage(1);
            } else {
                // No backup, go straight to fallback
                setImgSrc(fallbackSrc);
                setErrorStage(2);
            }
        } else if (errorStage === 1) {
            // Backup failed, show placeholder
            setImgSrc(fallbackSrc);
            setErrorStage(2);
        }
    };

    const isUnoptimized = errorStage >= 1 || src.startsWith('/'); // Local or Backup usually unoptimized

    return (
        <Image
            {...props}
            src={imgSrc || fallbackSrc} // Ensure src is never empty
            alt={alt}
            onError={handleError}
            unoptimized={isUnoptimized}
            width={optimizationWidth}
            height={Math.floor(optimizationWidth * 1.4)}
            className={props.className}
            quality={75}
        />
    );
}
