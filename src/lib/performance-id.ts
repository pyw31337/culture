/**
 * Performance ids are human readable slugs (prefix_title_venue_date) and are used verbatim
 * as the /p/[id] route segment. Next.js turns that segment into real directory names
 * (.next/server/app/p/<id>.segments/..., out/p/<id>/), and Linux rejects any single path
 * component longer than 255 bytes with ENAMETOOLONG. Korean characters take 3 bytes each,
 * so a long title-derived id overflows the limit and kills the static export.
 *
 * Every id therefore has to stay inside a small byte budget: keep a character-safe prefix
 * and append a deterministic 8 hex character hash of the full original id so the result
 * stays unique and stable across runs.
 */
export const MAX_PERFORMANCE_ID_BYTES = 110;
const MAX_PREFIX_BYTES = 100;
const HASH_LENGTH = 8;
const COLLISION_LIMIT = 64;

const utf8Encoder = new TextEncoder();

/** UTF-8 byte length - the unit the filesystem actually limits. */
export function utf8ByteLength(value: string) {
    return utf8Encoder.encode(value).length;
}

/** Shorten a string to at most `maxBytes` UTF-8 bytes without splitting a character. */
export function truncateUtf8Bytes(value: string, maxBytes: number) {
    let used = 0;
    let result = '';
    for (const char of value) {
        const size = utf8ByteLength(char);
        if (used + size > maxBytes) break;
        result += char;
        used += size;
    }
    return result;
}

/**
 * FNV-1a 32bit over the UTF-8 bytes. Deterministic, dependency free and safe to use from
 * both the build (server) and the browser bundle, unlike node:crypto.
 */
function fnv1a32(bytes: Uint8Array) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < bytes.length; index += 1) {
        hash ^= bytes[index];
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash >>> 0;
}

export function shortIdHash(value: string, salt = 0) {
    const payload = salt === 0 ? value : `${value}:${salt}`;
    return fnv1a32(utf8Encoder.encode(payload)).toString(16).padStart(HASH_LENGTH, '0');
}

export function isSafePerformanceId(id: string | undefined | null) {
    return typeof id === 'string' && id.length > 0 && utf8ByteLength(id) <= MAX_PERFORMANCE_ID_BYTES;
}

/**
 * Return an id that is safe to use as a single path component. Ids that already fit are
 * returned untouched, so this is idempotent.
 *
 * `taken` carries the ids already in use; pass it whenever several ids are normalized
 * together so two different long ids can never collapse onto the same short id.
 */
export function normalizePerformanceId(id: string, taken?: Set<string>) {
    if (!id || utf8ByteLength(id) <= MAX_PERFORMANCE_ID_BYTES) return id;

    const truncated = truncateUtf8Bytes(id, MAX_PREFIX_BYTES);
    const prefix = truncated.replace(/_+$/u, '') || truncated;

    for (let salt = 0; salt < COLLISION_LIMIT; salt += 1) {
        const candidate = `${prefix}_${shortIdHash(id, salt)}`;
        if (candidate === id) return id;
        if (!taken || !taken.has(candidate)) return candidate;
    }

    throw new Error(`performance id collision could not be resolved: ${id}`);
}

/**
 * Normalize a list of performances in place and report which ids changed.
 * Ids that already fit are collected first so a truncated id can never steal one of them.
 */
export function normalizeIdList<T extends { id: string }>(items: T[]) {
    const taken = new Set<string>();
    for (const item of items) {
        if (isSafePerformanceId(item.id)) taken.add(item.id);
    }

    const changed = new Map<string, string>();
    for (const item of items) {
        if (!item.id || isSafePerformanceId(item.id)) continue;
        const next = normalizePerformanceId(item.id, taken);
        taken.add(next);
        changed.set(item.id, next);
        item.id = next;
    }

    return changed;
}
