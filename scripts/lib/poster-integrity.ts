export type PosterRecord = Record<string, unknown>;

export const POSTER_UNAVAILABLE_STATUSES = new Set(['unavailable', 'pending']);

const POSTER_FIELDS = [
  'image',
  'poster',
  'posterUrl',
  'backupPoster',
  'thumbnail',
  'thumbnailUrl',
  'ogImage',
  'coverImage',
  'mainImage',
  'photoUrl',
  'imageUrl',
] as const;

const POSTER_ARRAY_FIELDS = ['stillImages', 'synopsisImages', 'images', 'posterSourceUrls'] as const;

const PLACEHOLDER_URL_PATTERN = /(?:no[-_ ]?image|placeholder|default[-_ ]?poster|image[-_ ]?not[-_ ]?found)/i;

export function normalizeRemotePosterUrl(value: string): string {
  return value.trim().replace(/^http:\/\//i, 'https://');
}

export function isRemotePosterUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim()) && !PLACEHOLDER_URL_PATTERN.test(value);
}

export function isLocalPosterUrl(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('/images/');
}

/**
 * Preserves the source's priority while considering every image field that can
 * legitimately act as a poster. A broken primary URL must not prevent a
 * usable detail/still image from being cached.
 */
export function collectPosterUrls(record: PosterRecord): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const add = (value: unknown) => {
    if (!isRemotePosterUrl(value)) return;
    const normalized = normalizeRemotePosterUrl(value);
    if (seen.has(normalized)) return;
    seen.add(normalized);
    urls.push(normalized);
  };

  POSTER_FIELDS.forEach((field) => add(record[field]));
  POSTER_ARRAY_FIELDS.forEach((field) => {
    const values = record[field];
    if (Array.isArray(values)) values.forEach(add);
  });

  return urls;
}

export function isPerformanceRecord(value: unknown): value is PosterRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as PosterRecord;
  return typeof record.id === 'string'
    && typeof record.title === 'string'
    && typeof record.genre === 'string';
}

/**
 * Data files whose records are rewritten by cache-remote-posters (and therefore
 * must carry a posterStatus). Diagnostic/report files only embed sample rows and
 * are skipped by both the cache step and the validator.
 */
export function isPosterAuditedDataFile(relativePath: string): boolean {
  const relPath = relativePath.replace(/\\/g, '/');
  return !/(^build-info\.json$|^operations-summary\.json$|^poster-integrity-report\.json$|report\.json$|manifest\.json$|opportunities\.json$|^sessions\.json$|^heritage-events\.json$)/.test(relPath);
}

export function isPosterExcluded(record: PosterRecord): boolean {
  return typeof record.posterStatus === 'string' && POSTER_UNAVAILABLE_STATUSES.has(record.posterStatus);
}
