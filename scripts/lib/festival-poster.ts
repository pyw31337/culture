/**
 * Festival poster selection (VisitKorea 지역축제 detail pages).
 *
 * A detail page links several images of the same festival on kfescdn.visitkorea.or.kr:
 * `<id>_31.jpg`, `<id>_32.jpg`, ... plus size-prefixed copies (`300_<id>_33.jpg`, `400_...`).
 * One of them is the real portrait poster, the others are landscape venue photos. The scraper
 * used to take whichever image the first DOM selector hit (often a landscape cover or a 300px
 * list thumbnail), save it once, and never look again -- ~40% of festival cards ended up as
 * small landscape photos (some 300x200) while a 445x627 poster sat on the same page.
 *
 * Here every candidate belonging to the festival is collected, measured after download, and the
 * best one wins: a portrait poster first, then the largest image.
 */
import axios from 'axios';
import sharp from 'sharp';

const KFES_CDN = /https?:\/\/kfescdn\.visitkorea\.or\.kr\/kfes\/upload\/contents\/db\/[^"'\s)<>]+?\.(?:jpe?g|png|gif|webp)/gi;

export type PosterCandidate = { url: string; width: number; height: number; buffer: Buffer };

/** Strips kfescdn's size prefixes (`300_`, `400_`, ...) so the original file is requested. */
export function toOriginalKfesUrl(url: string): string {
  return url.replace(/\/db\/\d{2,4}_/, '/db/');
}

/**
 * Candidate image URLs for one festival, best-guess order: explicit hints (og:image, the DOM
 * poster) first, then every kfescdn image whose filename carries this festival's id. Images of
 * other festivals linked from the same page ("다른 축제" cards) are excluded by the id check.
 */
export function collectFestivalImageCandidates(html: string, festivalId: string, hints: Array<string | null | undefined> = []): string[] {
  const out: string[] = [];
  const push = (value?: string | null) => {
    if (!value || !/^https?:\/\//i.test(value)) return;
    const url = toOriginalKfesUrl(value.trim());
    if (!out.includes(url)) out.push(url);
  };
  const og = String(html || '').match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  if (og) push(og[1]);
  hints.forEach(push);
  const id = String(festivalId || '').toLowerCase();
  for (const match of String(html || '').matchAll(KFES_CDN)) {
    if (id && !match[0].toLowerCase().includes(id)) continue;
    push(match[0]);
  }
  return out;
}

/** Portrait posters (height >= 1.2x width) beat landscape photos; within a group, bigger wins. */
export function rankPoster(width: number, height: number): number {
  if (!width || !height) return -1;
  const portrait = height >= width * 1.2 ? 1 : 0;
  return portrait * 1e9 + width * height;
}

export function pickBestPoster<T extends { width: number; height: number }>(candidates: T[]): T | null {
  let best: T | null = null;
  for (const candidate of candidates) {
    if (!best || rankPoster(candidate.width, candidate.height) > rankPoster(best.width, best.height)) best = candidate;
  }
  return best;
}

export async function fetchPosterCandidate(url: string, referer = 'https://korean.visitkorea.or.kr/'): Promise<PosterCandidate | null> {
  try {
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      validateStatus: () => true,
      headers: {
        Referer: referer,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      },
    });
    if (response.status < 200 || response.status >= 300) return null;
    const buffer = Buffer.from(response.data as ArrayBuffer);
    const meta = await sharp(buffer, { failOn: 'none' }).metadata();
    if (!meta.width || !meta.height) return null;
    return { url, width: meta.width, height: meta.height, buffer };
  } catch {
    return null;
  }
}

/** Downloads up to `limit` candidates (a page rarely has more than 6) and returns the best one. */
export async function fetchBestPoster(urls: string[], limit = 8): Promise<PosterCandidate | null> {
  const fetched: PosterCandidate[] = [];
  for (const url of urls.slice(0, limit)) {
    const candidate = await fetchPosterCandidate(url);
    if (candidate) fetched.push(candidate);
  }
  return pickBestPoster(fetched);
}

/** Long side the saved webp is capped at (was a 600px width cap). */
export const POSTER_MAX_WIDTH = 900;
export const POSTER_MAX_HEIGHT = 1300;

export async function encodePosterWebp(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer, { failOn: 'none', animated: false })
    .rotate()
    .resize({ width: POSTER_MAX_WIDTH, height: POSTER_MAX_HEIGHT, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
}

/** Size of an already-cached webp, or null if missing/unreadable. */
export async function readImageSize(file: string): Promise<{ width: number; height: number } | null> {
  try {
    const meta = await sharp(file).metadata();
    return meta.width && meta.height ? { width: meta.width, height: meta.height } : null;
  } catch {
    return null;
  }
}
