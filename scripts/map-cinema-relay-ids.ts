/**
 * Maps src/data/cinemas.json rows to theater ids of the public daiso-mcp relay
 * (https://mcp.aka.page, k-skill korean-cinema-search) so the browser can query
 * timetables/remaining seats with an exact id instead of a fuzzy keyword.
 *
 *   npx tsx scripts/map-cinema-relay-ids.ts            # only unmapped cinemas
 *   CINEMA_RELAY_REFRESH=1 npx tsx scripts/map-cinema-relay-ids.ts
 *
 * Writes src/data/cinema-relay-ids.json. No API key needed. Read-only.
 */
import fs from 'fs';
import path from 'path';
import { cinemaRelayKey, normalizeCinemaBrand, type CinemaRelayMapping, type CinemaRow } from './utils/cinema-relay-ids';

const RELAY_BASE = (process.env.CINEMA_RELAY_BASE_URL || 'https://mcp.aka.page').replace(/\/$/, '');
const CINEMAS_PATH = path.join(process.cwd(), 'src/data/cinemas.json');
const OUTPUT_PATH = path.join(process.cwd(), 'src/data/cinema-relay-ids.json');
const MAX_DISTANCE_KM = Number(process.env.CINEMA_RELAY_MAX_DISTANCE_KM || 0.6);
const DELAY_MS = Math.max(200, Number(process.env.CINEMA_RELAY_DELAY_MS || 300));
const REFRESH = process.env.CINEMA_RELAY_REFRESH === '1';

const CHAIN_PATH: Record<string, { path: string; idField: 'theaterCode' | 'theaterId'; brand: CinemaRelayMapping['brand'] }> = {
    CGV: { path: 'cgv', idField: 'theaterCode', brand: 'CGV' },
    롯데시네마: { path: 'lottecinema', idField: 'theaterId', brand: '롯데시네마' },
    메가박스: { path: 'megabox', idField: 'theaterId', brand: '메가박스' },
};

type RelayTheater = { theaterCode?: string; theaterId?: string; theaterName?: string; distanceKm?: number };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function compactName(value: string) {
    return value.replace(/^(cgv|롯데\s?시네마|메가박스)\s*/i, '').replace(/[\s()·.-]|점$/g, '').toLowerCase();
}

async function findTheater(chainPath: string, cinema: CinemaRow): Promise<RelayTheater[] | null> {
    const url = `${RELAY_BASE}/api/${chainPath}/theaters?lat=${cinema.lat}&lng=${cinema.lng}&limit=3`;
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { Accept: 'application/json' } });
            if (response.status === 429 || response.status >= 500) {
                await sleep(1500 * (attempt + 1));
                continue;
            }
            if (!response.ok) return null;
            const json = await response.json() as { success?: boolean; data?: { theaters?: RelayTheater[] } };
            return json.success ? json.data?.theaters || [] : null;
        } catch {
            await sleep(1000 * (attempt + 1));
        }
    }
    return null;
}

function save(items: Record<string, CinemaRelayMapping>) {
    const sorted = Object.fromEntries(Object.entries(items).sort(([a], [b]) => a.localeCompare(b, 'ko')));
    fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify({
        generatedAt: new Date().toISOString(),
        source: `${RELAY_BASE}/api/{cgv|megabox|lottecinema}/theaters`,
        items: sorted,
    }, null, 2)}\n`);
    return Object.keys(sorted).length;
}

async function main() {
    const cinemas = (JSON.parse(fs.readFileSync(CINEMAS_PATH, 'utf8')) as CinemaRow[]).map(normalizeCinemaBrand);
    const previous = fs.existsSync(OUTPUT_PATH)
        ? (JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8')).items || {}) as Record<string, CinemaRelayMapping>
        : {};
    const items: Record<string, CinemaRelayMapping> = REFRESH ? {} : { ...previous };
    let mapped = 0;
    let skipped = 0;
    let failed = 0;

    for (const cinema of cinemas) {
        const chain = CHAIN_PATH[String(cinema.brand)];
        if (!chain || typeof cinema.lat !== 'number' || typeof cinema.lng !== 'number') continue;
        const key = cinemaRelayKey(cinema);
        if (!REFRESH && items[key]) {
            skipped++;
            continue;
        }
        const theaters = await findTheater(chain.path, cinema);
        await sleep(DELAY_MS);
        if (!theaters) {
            failed++;
            continue;
        }
        const cinemaName = compactName(cinema.name);
        const best = theaters.find((theater) => {
            const id = theater[chain.idField];
            if (!id || typeof theater.distanceKm !== 'number') return false;
            if (theater.distanceKm <= 0.15) return true;
            const theaterName = compactName(theater.theaterName || '');
            const nameMatches = Boolean(theaterName) && (cinemaName.includes(theaterName) || theaterName.includes(cinemaName));
            return theater.distanceKm <= MAX_DISTANCE_KM && nameMatches;
        });
        if (!best) continue;
        items[key] = {
            brand: chain.brand,
            theaterId: String(best[chain.idField]),
            theaterName: String(best.theaterName || ''),
            distanceKm: best.distanceKm,
        };
        mapped++;
        // Checkpoint so an interrupted run keeps its progress.
        if (mapped % 25 === 0) save(items);
    }

    const total = save(items);
    console.log(`[cinema-relay] mapped ${mapped} new, kept ${skipped}, failed ${failed}; total ${total} → ${OUTPUT_PATH}`);
}

main().catch((error) => {
    console.error('[cinema-relay] failed:', error);
    process.exit(1);
});
