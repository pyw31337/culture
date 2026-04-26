import { useMemo, useState, memo } from 'react';
import Image, { ImageProps } from 'next/image';
import { getOptimizedUrl } from '@/lib/utils';
import { clsx } from 'clsx';

interface ImageWithFallbackProps extends Omit<ImageProps, 'src'> {
    src: string;
    backupSrc?: string; // New prop for remote URL backup
    fallbackSrc?: string;
    optimizationWidth?: number;
}

interface ImageWithFallbackInnerProps extends Omit<ImageWithFallbackProps, 'fallbackSrc' | 'optimizationWidth' | 'src'> {
    originalSrc: string;
    initialSrc: string;
    fallbackSrc: string;
}

function ImageWithFallbackInner({
    originalSrc,
    initialSrc,
    backupSrc,
    fallbackSrc,
    alt,
    ...props
}: ImageWithFallbackInnerProps) {
    const [imgSrc, setImgSrc] = useState<string>(initialSrc);
    const [errorStage, setErrorStage] = useState(0); // 0: Initial, 1: Backup/Retry, 2: Fallback
    const [isLoaded, setIsLoaded] = useState(false);

    const handleError = () => {
        if (errorStage === 0) {
            if (backupSrc && backupSrc !== originalSrc) {
                setImgSrc(backupSrc);
                setErrorStage(1);
            } else {
                setImgSrc(fallbackSrc);
                setErrorStage(2);
            }
        } else if (errorStage === 1) {
            setImgSrc(fallbackSrc);
            setErrorStage(2);
        }
    };

    const isUnoptimized = errorStage >= 1 || !!(originalSrc && originalSrc.startsWith('/'));

    return (
        <>
            {!isLoaded && errorStage < 2 && (
                <div
                    aria-hidden="true"
                    className={clsx(
                        props.className,
                        'absolute inset-0 pointer-events-none overflow-hidden rounded-[inherit]'
                    )}
                    style={{ zIndex: 0 }}
                >
                    <div className="absolute inset-0 bg-linear-to-br from-white/8 via-white/4 to-transparent" />
                    <div className="absolute inset-0 animate-pulse bg-white/6" />
                </div>
            )}

            <Image
                {...props}
                src={imgSrc || fallbackSrc}
                alt={alt}
                onError={handleError}
                onLoad={() => setIsLoaded(true)}
                unoptimized={isUnoptimized}
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

function ImageWithFallback({
    src,
    backupSrc, // Destructure backupSrc
    fallbackSrc = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMzMzIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiM2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=',
    alt,
    optimizationWidth = 400,
    ...props
}: ImageWithFallbackProps) {
    const optimizedSrc = useMemo(() => getOptimizedUrl(src, optimizationWidth), [src, optimizationWidth]);
    const imageKey = useMemo(() => `${optimizedSrc}|${backupSrc || ''}|${fallbackSrc}`, [backupSrc, fallbackSrc, optimizedSrc]);

    return (
        <ImageWithFallbackInner
            key={imageKey}
            {...props}
            originalSrc={src}
            initialSrc={optimizedSrc}
            backupSrc={backupSrc}
            fallbackSrc={fallbackSrc}
            alt={alt}
            width={!props.fill ? (props.width || optimizationWidth) : undefined}
            height={!props.fill ? (props.height || Math.floor(optimizationWidth * 1.4)) : undefined}
        />
    );
}

export default memo(ImageWithFallback);
