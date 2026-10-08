import type { Performance } from '@/types';
import { parseEventDateRange } from '@/lib/event-dates';

const SITE_URL = 'https://pyw31337.github.io/culture';

function absoluteImageUrl(value?: string) {
    if (!value) return undefined;
    if (/^https?:\/\//i.test(value)) return value;
    if (value.startsWith('/culture/')) return `https://pyw31337.github.io${value}`;
    return `${SITE_URL}${value.startsWith('/') ? '' : '/'}${value}`;
}

function deriveEventStatus(performance: Performance) {
    const text = `${performance.performanceState || ''} ${performance.title || ''}`;
    if (/취소|cancel/i.test(text)) return 'https://schema.org/EventCancelled';
    if (/연기|postpone/i.test(text)) return 'https://schema.org/EventPostponed';
    if (/일정\s*변경|rescheduled/i.test(text)) return 'https://schema.org/EventRescheduled';
    return 'https://schema.org/EventScheduled';
}

function parseLowestPrice(performance: Performance): number | null {
    const texts = [
        performance.price,
        ...(performance.priceList || []).map((item) => item.price),
    ].filter(Boolean) as string[];
    if (texts.some((text) => /^\s*무료\s*$/.test(text))) return 0;
    const amounts = texts
        .flatMap((text) => [...text.matchAll(/(\d{1,3}(?:,\d{3})+|\d{4,})\s*원/g)].map((match) => Number(match[1].replace(/,/g, ''))))
        .filter((amount) => Number.isFinite(amount) && amount > 0);
    return amounts.length > 0 ? Math.min(...amounts) : null;
}

/**
 * schema.org JSON-LD for a detail page. Dates/status/address come from the record;
 * nothing is invented (unknown values are omitted instead of defaulted to Seoul etc.).
 */
export function buildStructuredData(performance: Performance, pageUrl: string): Record<string, unknown> {
    const image = absoluteImageUrl(performance.image || performance.poster || performance.backupPoster);
    const description = performance.description || performance.synopsis || performance.title;

    if (performance.genre === 'movie' || performance.genre === 'ott') {
        return {
            '@context': 'https://schema.org',
            '@type': 'Movie',
            name: performance.title,
            ...(image ? { image } : {}),
            description,
            url: pageUrl,
        };
    }

    const { start, end } = parseEventDateRange(performance.date || performance.dateRaw);
    const timeMatch = String(performance.date || '').match(/\b(\d{1,2}):(\d{2})\b/);
    const startDate = start && timeMatch && start === end
        ? `${start}T${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}:00+09:00`
        : start || undefined;
    const lowestPrice = parseLowestPrice(performance);
    const address = performance.address?.trim();
    const offersUrl = performance.link || performance.website || pageUrl;

    return {
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: performance.title,
        ...(startDate ? { startDate } : {}),
        ...(end && end !== start ? { endDate: end } : {}),
        eventStatus: deriveEventStatus(performance),
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        location: {
            '@type': 'Place',
            name: performance.venue,
            ...(address
                ? { address: { '@type': 'PostalAddress', streetAddress: address, addressCountry: 'KR' } }
                : {}),
            ...(typeof performance.lat === 'number' && typeof performance.lng === 'number'
                ? { geo: { '@type': 'GeoCoordinates', latitude: performance.lat, longitude: performance.lng } }
                : {}),
        },
        ...(image ? { image: [image] } : {}),
        description,
        url: pageUrl,
        ...(lowestPrice !== null
            ? { offers: { '@type': 'Offer', price: String(lowestPrice), priceCurrency: 'KRW', url: offersUrl } }
            : {}),
    };
}
