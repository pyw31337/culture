export interface KopisBookingLink {
    name: string;
    url: string;
}

/**
 * Parses KOPIS `pblprfr/{mt20id}` detail `<relates><relate><relatenm/><relateurl/></relate></relates>`
 * (official booking sites) as produced by fast-xml-parser (object for one entry, array for many).
 */
type KopisRelateEntry = { relatenm?: unknown; relateurl?: unknown };

export function parseKopisRelates(relates: unknown): KopisBookingLink[] {
    const raw = (relates as { relate?: KopisRelateEntry | KopisRelateEntry[] } | null | undefined)?.relate;
    if (!raw || typeof raw !== 'object') return [];
    const list: KopisRelateEntry[] = Array.isArray(raw) ? raw : [raw];
    const seen = new Set<string>();
    const links: KopisBookingLink[] = [];
    for (const entry of list) {
        const name = String(entry?.relatenm ?? '').trim();
        let url = String(entry?.relateurl ?? '').trim().replace(/&amp;/g, '&');
        if (!name || !/^https?:\/\//i.test(url)) continue;
        try {
            url = new URL(url).toString();
        } catch {
            continue;
        }
        if (seen.has(url)) continue;
        seen.add(url);
        links.push({ name, url });
    }
    return links.slice(0, 8);
}
