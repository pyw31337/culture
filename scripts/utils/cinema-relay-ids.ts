/**
 * Merges build-time theater id mappings (src/data/cinema-relay-ids.json, produced by
 * scripts/map-cinema-relay-ids.ts) into the public cinemas.json so the browser can call
 * the mcp.aka.page timetable relay with an exact theater id.
 */
export interface CinemaRelayMapping {
    brand: 'CGV' | '롯데시네마' | '메가박스';
    theaterId: string;
    theaterName: string;
    distanceKm?: number;
}

export interface CinemaRow {
    name: string;
    brand?: string;
    lat?: number;
    lng?: number;
    [key: string]: unknown;
}

export function cinemaRelayKey(cinema: Pick<CinemaRow, 'name' | 'brand'>): string {
    return `${cinema.brand || ''}::${cinema.name}`;
}

/**
 * Older cinemas.json rows took the brand from the search keyword, so e.g. "CGV 광주상무"
 * found via the "광주극장" query was labelled 독립영화관. Re-derive chain brands by name.
 */
export function normalizeCinemaBrand(cinema: CinemaRow): CinemaRow {
    const name = String(cinema.name || '').toLowerCase();
    let brand = cinema.brand;
    if (/^cgv/.test(name)) brand = 'CGV';
    else if (/^롯데\s?시네마/.test(name)) brand = '롯데시네마';
    else if (/^메가박스/.test(name)) brand = '메가박스';
    else if (/^씨네q|^씨네큐(?!브)/.test(name)) brand = '씨네Q';
    return brand === cinema.brand ? cinema : { ...cinema, brand };
}

export function mergeCinemaRelayIds(
    cinemas: CinemaRow[],
    mapping: Record<string, CinemaRelayMapping>,
): CinemaRow[] {
    return cinemas.map(normalizeCinemaBrand).map((cinema) => {
        const relay = mapping[cinemaRelayKey(cinema)];
        if (!relay?.theaterId) return cinema;
        return { ...cinema, relayTheaterId: relay.theaterId, relayTheaterName: relay.theaterName };
    });
}
