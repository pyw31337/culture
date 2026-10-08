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

export function mergeCinemaRelayIds(
    cinemas: CinemaRow[],
    mapping: Record<string, CinemaRelayMapping>,
): CinemaRow[] {
    return cinemas.map((cinema) => {
        const relay = mapping[cinemaRelayKey(cinema)];
        if (!relay?.theaterId) return cinema;
        return { ...cinema, relayTheaterId: relay.theaterId, relayTheaterName: relay.theaterName };
    });
}
