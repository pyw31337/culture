import type { Performance } from '@/types';
import { toMobileUrl } from '@/lib/utils';

const MOMMOM_SOURCES = new Set(['mommom', 'mommom-activity', 'mommom-product']);

function buildNaverSearchUrl(query: string): string {
    return `https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`;
}

export function getExternalContentLink(
    performance: Pick<Performance, 'genre' | 'title' | 'link' | 'website' | 'source'>,
    options: { mobile?: boolean } = {}
): string {
    let url = performance.link?.trim() || performance.website?.trim() || '';
    if (url === '#') {
        url = '';
    }

    if (performance.genre === 'movie') {
        url = buildNaverSearchUrl(`${performance.title} 상영시간표`);
    } else if (!url) {
        url = MOMMOM_SOURCES.has(performance.source || '')
            ? `https://mom-mom.net/search?q=${encodeURIComponent(performance.title)}`
            : buildNaverSearchUrl(`${performance.title} 예매`);
    }

    return options.mobile ? toMobileUrl(url) : url;
}
