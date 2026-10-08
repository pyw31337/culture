export interface KopisBookingLink {
    name: string;
    url: string;
}

/**
 * Parses KOPIS `pblprfr/{mt20id}` detail `<relates><relate><relatenm/><relateurl/></relate></relates>`
 * (official booking sites) as produced by fast-xml-parser (object for one entry, array for many).
 */
export function parseKopisRelates(relates: any): KopisBookingLink[] {
    const raw = relates?.relate;
    if (!raw) return [];
    const list = Array.isArray(raw) ? raw : [raw];
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
