import { useCallback, useMemo, useRef, useState, memo } from 'react';
import Image, { ImageProps } from 'next/image';
import { getOptimizedUrl, normalizeImageUrl } from '@/lib/utils';
import { buildPlaceholderDataUrl } from '@/lib/poster-placeholder';
import { clsx } from 'clsx';

interface PlaceholderInput {
    /** Card title - rendered large in the placeholder SVG. */
    title?: string | null;
    /** Genre id (movie / musical / baseball / ...) for palette + label. */
    genre?: string | null;
    /** Optional team-vs-team string for sports rows. */
    matchLabel?: string | null;
}

interface ImageWithFallbackProps extends Omit<ImageProps, 'src'> {
    src: string;
    backupSrc?: string; // New prop for remote URL backup
    fallbackSrc?: string;
    /**
     * When provided, this overrides the default "No Image" fallback with a
     * genre-aware SVG placeholder (gradient + title + label). Pass `null` to
     * keep the legacy gray fallback. Used by card grids so that items with
     * missing posters still render with a designed cover.
     */
    placeholderInput?: PlaceholderInput | null;
    optimizationWidth?: number;
    fastDisplay?: boolean;
}

interface ImageWithFallbackInnerProps extends Omit<ImageWithFallbackProps, 'fallbackSrc' | 'optimizationWidth' | 'src'> {
    originalSrc: string;
    initialSrc: string;
    fallbackSrc: string;
}

const loadedImageSources = new Set<string>();

function markImageSourceLoaded(src?: string) {
    if (typeof src === 'string' && src.trim()) {
        loadedImageSources.add(src);
    }
}

function isImageSourceLoaded(src?: string) {
    return typeof src === 'string' && loadedImageSources.has(src);
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
    const initialSourceIndex = useMemo(() => {
        const cachedIndex = sources.findIndex((source) => isImageSourceLoaded(source));
        return cachedIndex >= 0 ? cachedIndex : 0;
    }, [sources]);
    const [sourceIndex, setSourceIndex] = useState(initialSourceIndex);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const imgSrc = sources[sourceIndex] || fallbackSrc;
    const [isLoaded, setIsLoaded] = useState(() => fastDisplay || isImageSourceLoaded(imgSrc));

    const setImageRef = useCallback((node: HTMLImageElement | null) => {
        imageRef.current = node;
        if (node?.complete && node.naturalWidth > 0) {
            markImageSourceLoaded(imgSrc);
            setIsLoaded((current) => current ? current : true);
        }
    }, [imgSrc]);

    const handleError = () => {
        setIsLoaded((current) => current ? false : current);
        if (sourceIndex < sources.length - 1) {
            setSourceIndex((index) => Math.min(index + 1, sources.length - 1));
            return;
        }
        setIsLoaded((current) => current ? current : true);
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
            {!isLoaded && !isFallback && !fastDisplay && (
                <div
                    aria-hidden="true"
                    className={clsx(
                        props.className,
                        'absolute inset-0 pointer-events-none overflow-hidden rounded-[inherit]'
                    )}
                    style={{ zIndex: 0 }}
                >
                    <div className="absolute inset-0 bg-linear-to-br from-white/8 via-white/4 to-transparent" />
                    <div className="absolute inset-0 bg-white/6" />
                </div>
            )}

            <Image
                {...props}
                ref={setImageRef}
                src={imgSrc || fallbackSrc}
                alt={alt}
                loading={imageLoading}
                decoding={props.decoding ?? 'async'}
                onError={handleError}
                onLoad={() => {
                    markImageSourceLoaded(imgSrc);
                    setIsLoaded((current) => current ? current : true);
                }}
                unoptimized={isUnoptimized}
                className={props.className}
                quality={imageQuality}
                referrerPolicy="no-referrer"
                style={{ ...props.style }}
            />
        </>
    );
}

const LEGACY_FALLBACK = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMzMzIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtc2l6ZT0iMjAiIGZpbGw9IiM2NjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5ObyBJbWFnZTwvdGV4dD48L3N2Zz4=';

function ImageWithFallback({
    src,
    backupSrc, // Destructure backupSrc
    fallbackSrc,
    placeholderInput,
    alt,
    optimizationWidth = 400,
    ...props
}: ImageWithFallbackProps) {
    const imageQuality = typeof props.quality === 'number' ? props.quality : 64;
    const normalizedSrc = useMemo(() => normalizeImageUrl(src), [src]);
    const normalizedBackupSrc = useMemo(() => normalizeImageUrl(backupSrc), [backupSrc]);
    const optimizedSrc = useMemo(() => getOptimizedUrl(normalizedSrc, optimizationWidth, imageQuality), [normalizedSrc, optimizationWidth, imageQuality]);

    // Resolve the final fallback source. Order of precedence:
    //   1. explicit fallbackSrc prop (highest priority - lets callers force)
    //   2. genre-aware SVG placeholder if placeholderInput is given
    //   3. legacy "No Image" gray block (back-compat default)
    const resolvedFallback = useMemo(() => {
        if (fallbackSrc) return fallbackSrc;
        if (placeholderInput) return buildPlaceholderDataUrl(placeholderInput);
        return LEGACY_FALLBACK;
    }, [fallbackSrc, placeholderInput]);

    const imageKey = useMemo(() => `${optimizedSrc}|${normalizedSrc}|${normalizedBackupSrc}|${resolvedFallback}`, [resolvedFallback, normalizedBackupSrc, normalizedSrc, optimizedSrc]);

    return (
        <ImageWithFallbackInner
            key={imageKey}
            {...props}
            originalSrc={normalizedSrc}
            initialSrc={optimizedSrc}
            backupSrc={normalizedBackupSrc}
            fallbackSrc={resolvedFallback}
            alt={alt}
            width={!props.fill ? (props.width || optimizationWidth) : undefined}
            height={!props.fill ? (props.height || Math.floor(optimizationWidth * 1.4)) : undefined}
        />
    );
}

export default memo(ImageWithFallback);
