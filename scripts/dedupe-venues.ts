import * as fs from 'fs';
import * as path from 'path';

const VENUES_PATH = path.resolve(process.cwd(), 'src/data/venues.json');

function normalize(name: string): string {
    return name.replace(/\s+/g, '').replace(/[^\wㄱ-ㅎㅏ-ㅣ가-힣]/g, '').toLowerCase();
}

function levenshtein(a: string, b: string): number {
    const tmp: number[][] = [];
    for (let i = 0; i <= a.length; i++) {
        tmp[i] = [i];
    }
    for (let j = 0; j <= b.length; j++) {
        tmp[0][j] = j;
    }
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            tmp[i][j] = Math.min(
                tmp[i - 1][j] + 1,
                tmp[i][j - 1] + 1,
                tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
    }
    return tmp[a.length][b.length];
}

async function run() {
    console.log('Starting Venue Deduplication...');
    const venues = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf-8'));
    const keys = Object.keys(venues);
    const normalizedMap: Record<string, string[]> = {};

    console.log(`Original count: ${keys.length}`);

    // Group by normalized name
    for (const key of keys) {
        const norm = normalize(key);
        if (!normalizedMap[norm]) normalizedMap[norm] = [];
        normalizedMap[norm].push(key);
    }

    const mergedVenues: any = {};
    let mergeCount = 0;

    for (const norm in normalizedMap) {
        const group = normalizedMap[norm];
        if (group.length === 1) {
            mergedVenues[group[0]] = venues[group[0]];
        } else {
            // Merge logic
            console.log(`Merging group: ${group.join(', ')}`);
            mergeCount += (group.length - 1);

            // Pick the one with best data (coords, address) or shortest name
            let canonical = group[0];
            for (const key of group) {
                const v = venues[key];
                const c = venues[canonical];
                const vHasCoords = v.lat && v.lng;
                const cHasCoords = c.lat && c.lng;

                if (vHasCoords && !cHasCoords) {
                    canonical = key;
                } else if (vHasCoords && cHasCoords) {
                    if (key.length < canonical.length) canonical = key;
                } else if (!vHasCoords && !cHasCoords) {
                    if (key.length < canonical.length) canonical = key;
                }
            }

            mergedVenues[canonical] = venues[canonical];
            // If others had coords but canonical didn't (unlikely with logic above), copy them
            for (const key of group) {
                if (key === canonical) continue;
                if (!mergedVenues[canonical].lat && venues[key].lat) {
                    mergedVenues[canonical].lat = venues[key].lat;
                    mergedVenues[canonical].lng = venues[key].lng;
                }
                if (!mergedVenues[canonical].address && venues[key].address) {
                    mergedVenues[canonical].address = venues[key].address;
                }
            }
        }
    }

    console.log(`Merged count: ${Object.keys(mergedVenues).length} (${mergeCount} duplicates removed).`);
    fs.writeFileSync(VENUES_PATH, JSON.stringify(mergedVenues, null, 2));
}

run();
