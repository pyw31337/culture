import { useState, useEffect } from 'react';
import Image, { ImageProps } from 'next/image';
import { getOptimizedUrl, getLowResUrl } from '@/lib/utils';
import { clsx } from 'clsx';

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
    const [isLoaded, setIsLoaded] = useState(false);
    const [lowResSrc, setLowResSrc] = useState<string | null>(null);

    useEffect(() => {
        // Reset state when src changes
        setErrorStage(0);
        setIsLoaded(false);
        // Start with optimized URL or local path
        setImgSrc(getOptimizedUrl(src, optimizationWidth));
        // Generate Low Res URL
        setLowResSrc(getLowResUrl(src));
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

    const isUnoptimized = errorStage >= 1 || !!(src && src.startsWith('/')); // Local or Backup usually unoptimized

    return (
        <>
            {/* Low Res Placeholder (Blur Up) */}
            {lowResSrc && !isLoaded && errorStage === 0 && (
                <img
                    src={lowResSrc}
                    alt=""
                    className={clsx(
                        props.className,
                        "absolute inset-0 w-full h-full object-cover blur-xl scale-110 opacity-70 transition-opacity duration-300 pointer-events-none"
                    )}
                    style={{ zIndex: 0 }}
                />
            )}

            <Image
                {...props}
                src={imgSrc || fallbackSrc} // Ensure src is never empty
                alt={alt}
                onError={handleError}
                onLoad={() => setIsLoaded(true)}
                unoptimized={isUnoptimized}
                width={!props.fill ? (props.width || optimizationWidth) : undefined}
                height={!props.fill ? (props.height || Math.floor(optimizationWidth * 1.4)) : undefined}
                className={clsx(
                    props.className,
                    "transition-opacity duration-500",
                    isLoaded ? "opacity-100" : "opacity-0"
                )}
                quality={75}
                referrerPolicy="no-referrer"
                style={{ ...props.style }}
            />
        </>
    );
}
