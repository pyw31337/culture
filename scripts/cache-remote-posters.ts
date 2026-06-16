import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import sharp from 'sharp';
import pLimit from 'p-limit';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

type PosterCandidate = {
  key: string;
  id: string;
  title: string;
  genre: string;
  source: string;
  imageUrl: string;
  item: JsonObject;
  priority: number;
  rank: number;
};

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const CACHE_ROOT = path.join(PUBLIC_DIR, 'images', 'posters', 'remote-cache');
const MAX_NEW_DOWNLOADS = Number(process.env.POSTER_CACHE_MAX_NEW_DOWNLOADS || '900');
const CONCURRENCY = Number(process.env.POSTER_CACHE_CONCURRENCY || '8');
const HOME_VISIBLE_COUNT = Number(process.env.POSTER_CACHE_HOME_VISIBLE_COUNT || '260');
const PAGE_ONE_VISIBLE_COUNT = Number(process.env.POSTER_CACHE_PAGE_ONE_VISIBLE_COUNT || '360');

const HIGH_RISK_HOSTS = new Set([
  'kopis.or.kr',
  'www.kopis.or.kr',
  'timeticket.co.kr',
  'www.timeticket.co.kr',
  'culture.go.kr',
  'www.culture.go.kr',
  'ticketimage.interpark.com',
  'tkfile.yes24.com',
]);

const SOURCE_REFERER: Array<[RegExp, string]> = [
  [/kopis\.or\.kr/i, 'https://www.kopis.or.kr/'],
  [/interpark\.com/i, 'https://tickets.interpark.com/'],
  [/yes24\.com/i, 'https://ticket.yes24.com/'],
  [/timeticket\.co\.kr/i, 'https://timeticket.co.kr/'],
  [/culture\.go\.kr/i, 'https://www.culture.go.kr/'],
  [/culture\.seoul\.go\.kr/i, 'https://culture.seoul.go.kr/'],
  [/visitkorea\.or\.kr/i, 'https://korean.visitkorea.or.kr/'],
  [/mom-mom\.net|image\.mom-mom\.net|cdn-nhncommerce\.com/i, 'https://mom-mom.net/'],
];

const GENRE_FALLBACK: Record<string, string> = {
  movie: '/images/fallbacks/movie.svg',
  musical: '/images/fallbacks/exhibition.jpg',
  concert: '/images/fallbacks/classic.jpg',
  play: '/images/fallbacks/exhibition.jpg',
  classic: '/images/fallbacks/classic.jpg',
  exhibition: '/images/fallbacks/exhibition.jpg',
  activity: '/images/fallbacks/activity.jpg',
  museum: '/images/fallbacks/museum.jpg',
  tourism: '/images/fallbacks/activity.jpg',
  baseball: '/images/fallbacks/baseball.jpg',
  soccer: '/images/fallbacks/soccer.jpg',
  basketball: '/images/fallbacks/basketball.jpg',
  volleyball: '/images/fallbacks/volleyball.jpg',
  handball: '/images/fallbacks/handball.jpg',
};

function isObject(value: JsonValue): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isRemoteUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function safeString(value: JsonValue | undefined, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function hash(input: string) {
  return crypto.createHash('sha1').update(input).digest('hex').slice(0, 16);
}

function slug(input: string) {
  return input
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|#%&{}$!'`@+=]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80) || 'poster';
}

function normalizeRemoteUrl(url: string) {
  return url.replace(/^http:\/\//i, 'https://');
}

function getHost(url: string) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function getReferer(url: string) {
  for (const [pattern, referer] of SOURCE_REFERER) {
    if (pattern.test(url)) return referer;
  }
  return 'https://pyw31337.github.io/culture/';
}

function fallbackForGenre(genre: string) {
  return GENRE_FALLBACK[genre] || '/images/fallbacks/exhibition.jpg';
}

function cachePathFor(candidate: Pick<PosterCandidate, 'id' | 'title' | 'genre' | 'source' | 'imageUrl'>) {
  const sourceDir = slug(candidate.source || candidate.genre || 'remote');
  const fileBase = slug(`${candidate.id || candidate.title}_${hash(candidate.imageUrl)}`);
  const rel = `/images/posters/remote-cache/${sourceDir}/${fileBase}.webp`;
  return {
    rel,
    abs: path.join(PUBLIC_DIR, rel),
  };
}

function collectJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectJsonFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      out.push(full);
    }
  }
  return out;
}

function shouldRewriteDataFile(file: string) {
  const relPath = path.relative(DATA_DIR, file).replace(/\\/g, '/');
  return !/(^build-info\.json$|^operations-summary\.json$|report\.json$|manifest\.json$)/.test(relPath);
}

function candidateKey(id: string, imageUrl: string) {
  return `${id}::${normalizeRemoteUrl(imageUrl)}`;
}

function walk(value: JsonValue, visitor: (object: JsonObject) => void) {
  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, visitor));
    return;
  }
  if (!isObject(value)) return;
  visitor(value);
  for (const child of Object.values(value)) walk(child, visitor);
}

function loadJson(file: string): JsonValue | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as JsonValue;
  } catch (error) {
    console.warn(`[poster-cache] skip unreadable json: ${path.relative(ROOT, file)} (${error instanceof Error ? error.message : String(error)})`);
    return null;
  }
}

function rememberVisible(visible: Map<string, number>, id: string, rank: number) {
  if (!id) return;
  const previous = visible.get(id);
  if (typeof previous === 'number' && previous <= rank) return;
  visible.set(id, rank);
}

function collectVisibleIds() {
  const visible = new Map<string, number>();
  const homePath = path.join(DATA_DIR, 'home-feed.json');
  const home = loadJson(homePath);
  if (Array.isArray(home)) {
    home.slice(0, HOME_VISIBLE_COUNT).forEach((item, index) => {
      if (isObject(item)) rememberVisible(visible, safeString(item.id), index);
    });
  }

  for (const file of collectJsonFiles(DATA_DIR)) {
    const rel = path.relative(DATA_DIR, file).replace(/\\/g, '/');
    if (!/(^pages\/page-001\.json$|\/page-001\.json$|^categories\/[^/]+\.json$)/.test(rel)) continue;
    const baseRank = rel.startsWith('categories/') ? 400 : rel.includes('/page-001.json') ? 900 : 1400;
    const data = loadJson(file);
    let seen = 0;
    walk(data, (object) => {
      if (seen >= PAGE_ONE_VISIBLE_COUNT) return;
      const id = safeString(object.id);
      if (id && (isRemoteUrl(object.image) || typeof object.image === 'string')) {
        rememberVisible(visible, id, baseRank + seen);
        seen += 1;
      }
    });
  }
  return visible;
}

function collectCandidates(visibleIds: Map<string, number>) {
  const candidates = new Map<string, PosterCandidate>();

  for (const file of collectJsonFiles(DATA_DIR)) {
    if (!shouldRewriteDataFile(file)) continue;
    const data = loadJson(file);
    walk(data, (item) => {
      const id = safeString(item.id);
      if (!id) return;
      const imageUrl = normalizeRemoteUrl(safeString(item.image) || safeString(item.posterUrl));
      if (!isRemoteUrl(imageUrl)) return;

      const title = safeString(item.title, id);
      const genre = safeString(item.genre, 'exhibition');
      const source = safeString(item.source, genre);
      const host = getHost(imageUrl);
      const highRisk = HIGH_RISK_HOSTS.has(host);
      const visibleRank = visibleIds.get(id);
      const visible = typeof visibleRank === 'number';
      const key = candidateKey(id, imageUrl);
      const existing = cachePathFor({ id, title, genre, source, imageUrl });
      const alreadyCached = fs.existsSync(existing.abs);

      if (!highRisk && !visible && !alreadyCached) return;

      const priority = alreadyCached ? 0 : visible ? 1 : highRisk ? 2 : 3;
      const rank = visibleRank ?? Number.MAX_SAFE_INTEGER;
      const previous = candidates.get(key);
      if (!previous || priority < previous.priority || rank < previous.rank) {
        candidates.set(key, { key, id, title, genre, source, imageUrl, item, priority, rank });
      }
    });
  }

  return [...candidates.values()].sort((a, b) => a.priority - b.priority || a.rank - b.rank || a.id.localeCompare(b.id));
}

async function downloadPoster(candidate: PosterCandidate): Promise<{ localUrl?: string; failedStatus?: number | string }> {
  const target = cachePathFor(candidate);
  if (fs.existsSync(target.abs)) return { localUrl: target.rel };

  const url = normalizeRemoteUrl(candidate.imageUrl);
  try {
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: 'arraybuffer',
      maxRedirects: 5,
      timeout: 14000,
      validateStatus: () => true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': getReferer(url),
      },
    });

    const contentType = String(response.headers['content-type'] || '').toLowerCase();
    if (response.status < 200 || response.status >= 300) {
      return { failedStatus: response.status };
    }
    if (!contentType.includes('image') && !contentType.includes('octet-stream')) {
      return { failedStatus: contentType || 'non-image' };
    }

    const input = Buffer.from(response.data as ArrayBuffer);
    const output = await sharp(input, { failOn: 'none', animated: false })
      .rotate()
      .resize({ width: 760, height: 1100, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();

    fs.mkdirSync(path.dirname(target.abs), { recursive: true });
    fs.writeFileSync(target.abs, output);
    return { localUrl: target.rel };
  } catch (error) {
    return { failedStatus: error instanceof Error ? error.message : String(error) };
  }
}

function applyLocalPosterToObject(object: JsonObject, originalRemote: string, localUrl: string) {
  if (isRemoteUrl(object.image)) {
    object.backupPoster = safeString(object.backupPoster) || object.image;
    object.posterUrl = safeString(object.posterUrl) || object.image;
    object.image = localUrl;
    return true;
  }
  if (!safeString(object.image) && isRemoteUrl(object.posterUrl)) {
    object.backupPoster = safeString(object.backupPoster) || object.posterUrl;
    object.image = localUrl;
    return true;
  }
  if (safeString(object.image) === originalRemote) {
    object.image = localUrl;
    return true;
  }
  return false;
}

function applyFallbackToObject(object: JsonObject, originalRemote: string, fallbackUrl: string) {
  if (isRemoteUrl(object.image) && normalizeRemoteUrl(object.image) === originalRemote) {
    object.backupPoster = safeString(object.backupPoster) || object.image;
    object.posterUrl = safeString(object.posterUrl) || object.image;
    object.image = fallbackUrl;
    return true;
  }
  return false;
}

function rewritePublicData(resultByKey: Map<string, { originalRemote: string; localUrl?: string; fallbackUrl?: string }>) {
  const files = collectJsonFiles(DATA_DIR);
  let changedFiles = 0;
  let changedObjects = 0;

  for (const file of files) {
    if (!shouldRewriteDataFile(file)) continue;
    const raw = fs.readFileSync(file, 'utf8');
    const data = loadJson(file);
    if (!data) continue;
    let changed = false;

    walk(data, (object) => {
      const id = safeString(object.id);
      const imageUrl = normalizeRemoteUrl(safeString(object.image) || safeString(object.posterUrl));
      const result = id && isRemoteUrl(imageUrl) ? resultByKey.get(candidateKey(id, imageUrl)) : undefined;
      if (!result) return;
      if (result.localUrl && applyLocalPosterToObject(object, result.originalRemote, result.localUrl)) {
        changed = true;
        changedObjects += 1;
        return;
      }
      if (result.fallbackUrl && applyFallbackToObject(object, result.originalRemote, result.fallbackUrl)) {
        changed = true;
        changedObjects += 1;
      }
    });

    if (changed) {
      const next = JSON.stringify(data);
      if (next !== raw) {
        fs.writeFileSync(file, next);
        changedFiles += 1;
      }
    }
  }

  return { changedFiles, changedObjects };
}

async function main() {
  const visibleIds = collectVisibleIds();
  const candidates = collectCandidates(visibleIds);
  const existingCount = candidates.filter((candidate) => fs.existsSync(cachePathFor(candidate).abs)).length;
  const toDownload = candidates.filter((candidate) => !fs.existsSync(cachePathFor(candidate).abs)).slice(0, MAX_NEW_DOWNLOADS);

  console.log(`[poster-cache] visible ids: ${visibleIds.size}`);
  console.log(`[poster-cache] candidates: ${candidates.length} (existing cache: ${existingCount}, new limit: ${MAX_NEW_DOWNLOADS}, downloading: ${toDownload.length})`);

  const resultByKey = new Map<string, { originalRemote: string; localUrl?: string; fallbackUrl?: string }>();
  for (const candidate of candidates) {
    const target = cachePathFor(candidate);
    if (fs.existsSync(target.abs)) {
      resultByKey.set(candidate.key, { originalRemote: candidate.imageUrl, localUrl: target.rel });
    }
  }

  const limit = pLimit(CONCURRENCY);
  let downloaded = 0;
  let failed = 0;
  await Promise.all(toDownload.map((candidate) => limit(async () => {
    const result = await downloadPoster(candidate);
    if (result.localUrl) {
      downloaded += 1;
      resultByKey.set(candidate.key, { originalRemote: candidate.imageUrl, localUrl: result.localUrl });
      return;
    }
    failed += 1;
    const host = getHost(candidate.imageUrl);
    if (HIGH_RISK_HOSTS.has(host) || visibleIds.has(candidate.id)) {
      resultByKey.set(candidate.key, {
        originalRemote: candidate.imageUrl,
        fallbackUrl: fallbackForGenre(candidate.genre),
      });
    }
    console.warn(`[poster-cache] failed ${candidate.id} ${candidate.title} (${result.failedStatus}) ${candidate.imageUrl}`);
  })));

  const rewrite = rewritePublicData(resultByKey);
  console.log(`[poster-cache] downloaded: ${downloaded}, failed: ${failed}, rewrite files: ${rewrite.changedFiles}, objects: ${rewrite.changedObjects}`);
}

main().catch((error) => {
  console.error('[poster-cache] fatal:', error);
  process.exit(1);
});
