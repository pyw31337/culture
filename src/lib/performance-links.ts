import type { Performance } from '@/types';
import { toMobileUrl } from '@/lib/utils';
import { getSportsBookingUrl, isSportsPerformance } from '@/lib/sports-ticketing';

const MOMMOM_SOURCES = new Set(['mommom', 'mommom-activity', 'mommom-product', 'museum']);

function buildNaverSearchUrl(query: string): string {
    return `https://search.naver.com/search.naver?query=${encodeURIComponent(query)}`;
}

export function getExternalContentLink(
    performance: Pick<Performance, 'genre' | 'title' | 'link' | 'website' | 'source' | 'date' | 'homeTeam' | 'awayTeam' | 'venue'>,
    options: { mobile?: boolean } = {}
): string {
    let url = performance.link?.trim() || performance.website?.trim() || '';
    if (url === '#') {
        url = '';
    }

    if (isSportsPerformance(performance)) {
        // Honor the data-supplied schedule URL first. K-League rows ship a
        // kleague.com/schedule.do URL and KBO rows ship a
        // koreabaseball.com/Schedule/Schedule.aspx URL - both are more
        // reliable than the ticketlink genre pages, which now 302 away from
        // /sports/baseball|basketball|volleyball|handball, and the
        // /sports/soccer page sometimes renders the ticketlink
        // "서비스가 원활하지 않습니다" error state. Only fall through to the
        // genre-mapped booking provider when the data doesn't carry a link
        // at all.
        if (!url) url = getSportsBookingUrl(performance) || '';
    } else if (performance.genre === 'movie') {
        url = buildNaverSearchUrl(`${performance.title} 상영시간표`);
    } else if (!url) {
        url = MOMMOM_SOURCES.has(performance.source || '')
            ? `https://mom-mom.net/search?q=${encodeURIComponent(performance.title)}`
            : buildNaverSearchUrl(`${performance.title} 예매`);
    }

    return options.mobile ? toMobileUrl(url) : url;
}
