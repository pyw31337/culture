import { useEffect, useMemo, useRef, useState, memo } from 'react';
import Image, { ImageProps } from 'next/image';
import { getOptimizedUrl, normalizeImageUrl } from '@/lib/utils';
import { clsx } from 'clsx';

interface ImageWithFallbackProps extends Omit<ImageProps, 'src'> {
    src: string;
    backupSrc?: string; // New prop for remote URL backup
    fallbackSrc?: string;
    optimizationWidth?: number;
    fastDisplay?: boolean;
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
    fastDisplay = false,
    alt,
    ...props
}: ImageWithFallbackInnerProps) {
    const sources = useMemo(() => {
        const uniqueSources = new Set<string>();
        [initialSrc, originalSrc, backupSrc, fallbackSrc].forEach((candidate) => {
            const source = typeof candidate === 'string' ? candidate.trim() : '';
            if (source) uniqueSources.add(source);
        });
        return Array.from(uniqueSources);
    }, [backupSrc, fallbackSrc, initialSrc, originalSrc]);
    const [sourceIndex, setSourceIndex] = useState(0);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isNearViewport, setIsNearViewport] = useState(false);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const imgSrc = sources[sourceIndex] || fallbackSrc;

    useEffect(() => {
        const node = imageRef.current;
        if (!node) return;

        if (typeof IntersectionObserver === 'undefined') {
            setIsNearViewport(true);
            return;
        }

        setIsNearViewport(false);
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setIsNearViewport(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '0px' }
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, [imgSrc]);

    useEffect(() => {
        if (!isNearViewport || isLoaded || sourceIndex >= sources.length - 1) return;

        const timeoutMs = fastDisplay ? 3500 : 5000;
        const timeoutId = window.setTimeout(() => {
            setSourceIndex((index) => (
                index === sourceIndex ? Math.min(index + 1, sources.length - 1) : index
            ));
        }, timeoutMs);

        return () => window.clearTimeout(timeoutId);
    }, [fastDisplay, isLoaded, isNearViewport, sourceIndex, sources.length]);

    const handleError = () => {
        setIsLoaded(false);
        if (sourceIndex < sources.length - 1) {
            setSourceIndex((index) => Math.min(index + 1, sources.length - 1));
            return;
        }
        setIsLoaded(true);
    };

    const isUnoptimized =
        imgSrc === originalSrc ||
        imgSrc === backupSrc ||
        imgSrc.startsWith('/') ||
        imgSrc.startsWith('data:');
    const imageQuality = typeof props.quality === 'number' ? props.quality : 64;
    const imageLoading = props.priority ? undefined : (props.loading ?? 'lazy');
    const isFallback = imgSrc === fallbackSrc;

    return (
        <>
            {!isLoaded && !isFallback && (
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
                ref={imageRef}
                src={imgSrc || fallbackSrc}
                alt={alt}
                loading={imageLoading}
                decoding={props.decoding ?? 'async'}
                onError={handleError}
                onLoad={() => setIsLoaded(true)}
                unoptimized={isUnoptimized}
                className={clsx(
                    props.className,
                    fastDisplay ? "transition-opacity duration-100" : "transition-opacity duration-500",
                    isLoaded ? "opacity-100" : "opacity-0"
                )}
                quality={imageQuality}
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
    const imageQuality = typeof props.quality === 'number' ? props.quality : 64;
    const normalizedSrc = useMemo(() => normalizeImageUrl(src), [src]);
    const normalizedBackupSrc = useMemo(() => normalizeImageUrl(backupSrc), [backupSrc]);
    const optimizedSrc = useMemo(() => getOptimizedUrl(normalizedSrc, optimizationWidth, imageQuality), [normalizedSrc, optimizationWidth, imageQuality]);
    const imageKey = useMemo(() => `${optimizedSrc}|${normalizedSrc}|${normalizedBackupSrc}|${fallbackSrc}`, [fallbackSrc, normalizedBackupSrc, normalizedSrc, optimizedSrc]);

    return (
        <ImageWithFallbackInner
            key={imageKey}
            {...props}
            originalSrc={normalizedSrc}
            initialSrc={optimizedSrc}
            backupSrc={normalizedBackupSrc}
            fallbackSrc={fallbackSrc}
            alt={alt}
            width={!props.fill ? (props.width || optimizationWidth) : undefined}
            height={!props.fill ? (props.height || Math.floor(optimizationWidth * 1.4)) : undefined}
        />
    );
}

export default memo(ImageWithFallback);
