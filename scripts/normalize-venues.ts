
import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

const DATA_DIR = path.resolve(process.cwd(), 'src/data');
const VENUES_PATH = path.join(DATA_DIR, 'venues.json');

// Suffixes to strip
// Strategy: "Name 1관" -> "Name"
// "Name 대극장" -> "Name"
const SUFFIX_REGEX = /\s+(\d+관|대극장|소극장|중극장|전용관|홀\d*|아트홀|콘서트홀)$/;
// Note: "아트홀" might be part of the name like "JTN 아트홀"? 
// User said "JTN 아트홀 1관" -> "JTN 아트홀". So "1관" is the suffix.
// but "예울마루 대극장" -> "예울마루".
// "BNK부산은행조은극장 1관" -> "BNK부산은행조은극장".

// We should be careful. "예술의전당" shouldn't become "예술의".
// Only strip if it matches specific patterns.

function normalizeName(name: string): string {
    // 1. Specific Fixes / Merges?
    // User examples:
    // "BNK부산은행조은극장 1관" -> "BNK부산은행조은극장"
    // "GS칼텍스 예울마루 대극장" -> "GS칼텍스 예울마루"
    // "JTN 아트홀 1관" -> "JTN 아트홀"

    let newName = name.replace(/\s+(1관|2관|3관|4관|5관|6관|7관|8관|9관)$/, '');
    newName = newName.replace(/\s+(대극장|소극장|중극장|전용관)$/, '');

    // "JTN 아트홀" is usually the base.
    // "세종문화회관 대극장" -> "세종문화회관" ? Yes usually.
    // "예술의전당 콘서트홀" -> "예술의전당" ? Probably yes for venue grouping.

    // Check if newName becomes empty or too short?
    if (newName.length < 2) return name;

    return newName.trim();
}

function normalizeAddress(addr: string): string {
    if (!addr) return '';
    let newAddr = addr;

    // Remove "대한민국" prefix
    newAddr = newAddr.replace(/^대한민국\s*/, '');

    // Ensure format "[City] [District]"
    // If it starts with "서울 ", it's fine.
    // If "서울시", change to "서울".

    newAddr = newAddr.replace(/^서울시\s/, '서울 ');
    newAddr = newAddr.replace(/^서울특별시\s/, '서울 ');
    newAddr = newAddr.replace(/^경기\s/, '경기도 ');
    // Wait, regex might be safer.

    return newAddr.trim();
}

// Simple strict similarity check
// Returns true if addresses are likely the same place (ignoring detail parts)
function areAddressesSimilar(addr1: string, addr2: string): boolean {
    if (!addr1 || !addr2) return false; // conservatively false if missing

    // Normalize simple spaces
    const a1 = addr1.replace(/\s+/g, ' ').trim();
    const a2 = addr2.replace(/\s+/g, ' ').trim();

    // If exact match (normalized)
    if (a1 === a2) return true;

    // Extract District/City
    // e.g. "서울 마포구 어울마당로" vs "서울 강남구 ???"
    const parts1 = a1.split(' ');
    const parts2 = a2.split(' ');

    // If first 2 parts (City + District) mismatch, DEFINITELY different
    // e.g. "서울 마포구" vs "서울 강남구"
    if (parts1.length >= 2 && parts2.length >= 2) {
        if (parts1[0] !== parts2[0]) return false;
        if (parts1[1] !== parts2[1]) return false;
    }

    // If Road Name matches, likely same
    if (parts1.length >= 3 && parts2.length >= 3) {
        if (parts1[2] === parts2[2]) return true;
    }

    return false;
}

async function run() {
    console.log('Starting Refined Venue Normalization...');
    const venues = JSON.parse(fs.readFileSync(VENUES_PATH, 'utf-8'));

    const venueMap: Record<string, string> = {}; // OldName -> NewName
    const newVenues: Record<string, any> = {};

    // 1. Determine New Names and Merge
    Object.entries(venues).forEach(([key, val]: [string, any]) => {
        let newName = normalizeName(key);
        const newAddr = normalizeAddress(val.address);

        // Check collision
        if (newVenues[newName]) {
            const existing = newVenues[newName];
            // Check Address Similarity
            if (areAddressesSimilar(existing.address, newAddr)) {
                // Merge allowed
                // Update existing if new one has better data?
                if (!existing.address && newAddr) existing.address = newAddr;
                if ((!existing.lat || existing.lat === 0) && val.lat) {
                    existing.lat = val.lat;
                    existing.lng = val.lng;
                }
            } else {
                // Collision but distinct addresses!
                console.log(`[CONFLICT] ${key} mapped to ${newName} but addresses differ from existing ${existing.name}`);
                console.log(`  Existing: ${existing.address}`);
                console.log(`  Current : ${newAddr}`);
                console.log(`  -> Keeping ${key} separate.`);

                newName = key; // Revert to original unique name
            }
        }

        venueMap[key] = newName;

        if (!newVenues[newName]) {
            newVenues[newName] = {
                ...val,
                name: newName,
                address: newAddr
            };
        }
    });

    console.log(`Venues reduced from ${Object.keys(venues).length} to ${Object.keys(newVenues).length}`);

    // 2. Save Venues
    fs.writeFileSync(VENUES_PATH, JSON.stringify(newVenues, null, 2));

    // 3. Update Performance Data
    const files = glob.sync(path.join(DATA_DIR, '*.json'));

    for (const file of files) {
        if (file === VENUES_PATH) continue;

        try {
            const content = JSON.parse(fs.readFileSync(file, 'utf-8'));
            if (!Array.isArray(content)) continue;

            let changed = false;
            const updated = content.map((item: any) => {
                const oldV = item.venue;
                if (venueMap[oldV] && venueMap[oldV] !== oldV) {
                    item.venue = venueMap[oldV];
                    if (item.address) item.address = normalizeAddress(item.address);
                    changed = true;
                } else if (item.address) {
                    // Just normalize address
                    const normAddr = normalizeAddress(item.address);
                    if (item.address !== normAddr) {
                        item.address = normAddr;
                        changed = true;
                    }
                }
                return item;
            });

            if (changed) {
                console.log(`Updated ${path.basename(file)}`);
                fs.writeFileSync(file, JSON.stringify(updated, null, 2));
            }
        } catch (e) {
            console.error(`Error processing ${file}:`, e);
        }
    }

    console.log('Normalization Complete.');
}

run();
