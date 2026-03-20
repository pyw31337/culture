'use client';

import { useMemo, useCallback, useState, useEffect } from 'react';
import { toMobileUrl } from '@/lib/utils';
import { useLocale } from 'next-intl';

interface UseBookingLinkOptions {
    link?: string;
    title: string;
    genre: string;
    source?: string;
    id: string;
    description?: string;
    mode?: 'modal' | 'standalone';
}

/**
 * Extracted hook for booking URL computation and share handling.
 * Reusable across ContentDetailView and any future detail components.
 */
export function useBookingLink({ link, title, genre, source, id, description, mode = 'modal' }: UseBookingLinkOptions) {
    const locale = useLocale();
    const [isMobile, setIsMobile] = useState(false);
    const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'shared'>('idle');

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const ua = navigator.userAgent || navigator.vendor || (window as any).opera || '';
        setIsMobile(/android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua.toLowerCase()));
    }, []);

    const bookingUrl = useMemo(() => {
        let url = link;
        const isMissingLink = !url || url.trim() === '';

        if (genre === 'movie' && isMissingLink) {
            const suffix = locale === 'ko' ? ' 상영시간표' : ' showtimes';
            url = `https://search.naver.com/search.naver?query=${encodeURIComponent(title + suffix)}`;
        } else if (isMissingLink) {
            if (source === 'mommom-activity' || source === 'mommom' || source === 'mommom-product') {
                url = `https://mom-mom.net/search?q=${encodeURIComponent(title)}`;
            } else {
                const suffix = locale === 'ko' ? ' 예매' : ' booking';
                url = `https://search.naver.com/search.naver?query=${encodeURIComponent(title + suffix)}`;
            }
        }

        return isMobile ? toMobileUrl(url) : url;
    }, [link, title, genre, source, isMobile, locale]);

    const handleShare = useCallback(async (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        const url = `${window.location.origin}${window.location.pathname}${mode === 'modal' ? `#p=${id}` : ''}`;
        
        if (navigator.share) {
            try {
                await navigator.share({
                    title: title,
                    text: description || title,
                    url: url,
                });
                setShareStatus('shared');
                setTimeout(() => setShareStatus('idle'), 2000);
                return;
            } catch (err) {
                console.warn('Web Share API failed', err);
            }
        }
        
        await navigator.clipboard.writeText(url);
        setShareStatus('copied');
        setTimeout(() => setShareStatus('idle'), 2000);
    }, [id, title, description, mode]);

    return { bookingUrl, handleShare, isMobile, shareStatus };
}
