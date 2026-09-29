import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import axios from 'axios';
import sharp from 'sharp';
import pLimit from 'p-limit';
import {
  collectPosterUrls,
  isLocalPosterUrl,
  isPerformanceRecord,
  normalizeRemotePosterUrl,
  type PosterRecord,
} from './lib/poster-integrity';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };
type PosterStatus = 'verified' | 'unavailable' | 'pending';

type PosterCandidate = {
  id: string;
  title: string;
  genre: string;
  source: string;
  imageUrl: string;
};

type PosterGroup = {
  id: string;
  title: string;
  genre: string;
  source: string;
  candidates: PosterCandidate[];
  candidateUrls: Set<string>;
  localUrls: Set<string>;
  priority: number;
  rank: number;
};

type PosterOutcome = {
  status: PosterStatus;
  localUrl?: string;
  sourceUrls: string[];
  recoveredFromAlternate?: boolean;
  failure?: string;
};

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const CACHE_ROOT = path.join(PUBLIC_DIR, 'images', 'posters', 'remote-cache');
const REPORT_PATH = path.join(DATA_DIR, 'poster-integrity-report.json');
const MAX_NEW_DOWNLOADS = Number(process.env.POSTER_CACHE_MAX_NEW_DOWNLOADS || '3500');
const CONCURRENCY = Number(process.env.POSTER_CACHE_CONCURRENCY || '8');
const HOME_VISIBLE_COUNT = Number(process.env.POSTER_CACHE_HOME_VISIBLE_COUNT || '260');
const PAGE_ONE_VISIBLE_COUNT = Number(process.env.POSTER_CACHE_PAGE_ONE_VISIBLE_COUNT || '360');
const INCLUDE_ALL_REMOTE = process.env.POSTER_CACHE_INCLUDE_ALL_REMOTE !== '0';
const POSTER_MIN_EDGE = Number(process.env.POSTER_CACHE_MIN_EDGE || '60');
const DRY_RUN = process.env.POSTER_CACHE_DRY_RUN === '1';

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

function isObject(value: JsonValue): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

function cachePathFor(candidate: PosterCandidate) {
  const sourceDir = slug(candidate.source || candidate.genre || 'remote');
  const fileBase = slug(`${candidate.id || candidate.title}_${hash(candidate.imageUrl)}`);
  const rel = `/images/posters/remote-cache/${sourceDir}/${fileBase}.webp`;
  return { rel, abs: path.join(PUBLIC_DIR, rel) };
}

function collectJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectJsonFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.json')) out.push(full);
  }
  return out;
}

function collectFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

function shouldRewriteDataFile(file: string) {
  const relPath = path.relative(DATA_DIR, file).replace(/\\/g, '/');
  return !/(^build-info\.json$|^operations-summary\.json$|^poster-integrity-report\.json$|report\.json$|manifest\.json$)/.test(relPath);
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
  const home = loadJson(path.join(DATA_DIR, 'home-feed.json'));
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
    if (!data) continue;
    walk(data, (object) => {
      if (seen >= PAGE_ONE_VISIBLE_COUNT || !isPerformanceRecord(object)) return;
      rememberVisible(visible, object.id, baseRank + seen);
      seen += 1;
    });
  }
  return visible;
}

function createGroup(record: PosterRecord, visibleIds: Map<string, number>): PosterGroup {
  const id = String(record.id);
  const visibleRank = visibleIds.get(id);
  return {
    id,
    title: typeof record.title === 'string' ? record.title : id,
    genre: typeof record.genre === 'string' ? record.genre : 'other',
    source: typeof record.source === 'string' ? record.source : 'remote',
    candidates: [],
    candidateUrls: new Set(),
    localUrls: new Set(),
    priority: typeof visibleRank === 'number' ? 1 : 3,
    rank: visibleRank ?? Number.MAX_SAFE_INTEGER,
  };
}

function collectPosterGroups(visibleIds: Map<string, number>) {
  const groups = new Map<string, PosterGroup>();
  for (const file of collectJsonFiles(DATA_DIR)) {
    if (!shouldRewriteDataFile(file)) continue;
    const data = loadJson(file);
    if (!data) continue;
    walk(data, (object) => {
      if (!isPerformanceRecord(object)) return;
      const record = object as PosterRecord;
      const id = String(record.id);
      const group = groups.get(id) || createGroup(record, visibleIds);
      groups.set(id, group);

      if (typeof record.image === 'string' && isLocalPosterUrl(record.image) && fs.existsSync(path.join(PUBLIC_DIR, record.image))) {
        group.localUrls.add(record.image);
      }

      for (const imageUrl of collectPosterUrls(record)) {
        if (group.candidateUrls.has(imageUrl)) continue;
        group.candidateUrls.add(imageUrl);
        const candidate: PosterCandidate = {
          id,
          title: group.title,
          genre: group.genre,
          source: group.source,
          imageUrl,
        };
        group.candidates.push(candidate);
        if (HIGH_RISK_HOSTS.has(getHost(imageUrl))) group.priority = Math.min(group.priority, 2);
      }
    });
  }

  return [...groups.values()]
    .filter((group) => INCLUDE_ALL_REMOTE || group.localUrls.size > 0 || group.priority <= 2)
    .sort((a, b) => a.priority - b.priority || a.rank - b.rank || a.id.localeCompare(b.id));
}

function buildExistingCacheIndex() {
  const index = new Map<string, string>();
  for (const file of collectFiles(CACHE_ROOT)) {
    if (!file.endsWith('.webp')) continue;
    const match = path.basename(file).match(/_([a-f0-9]{16})\.webp$/i);
    if (!match) continue;
    index.set(match[1].toLowerCase(), `/${path.relative(PUBLIC_DIR, file).replace(/\\/g, '/')}`);
  }
  return index;
}

function findExistingPoster(group: PosterGroup, cacheIndex: Map<string, string>): PosterOutcome | null {
  const directLocal = [...group.localUrls][0];
  if (directLocal) return { status: 'verified', localUrl: directLocal, sourceUrls: [...group.candidateUrls] };
  for (const candidate of group.candidates) {
    const target = cachePathFor(candidate);
    const indexed = cacheIndex.get(hash(candidate.imageUrl));
    const localUrl = fs.existsSync(target.abs) ? target.rel : indexed;
    if (!localUrl || !fs.existsSync(path.join(PUBLIC_DIR, localUrl))) continue;
    return {
      status: 'verified',
      localUrl,
      sourceUrls: [...group.candidateUrls],
      recoveredFromAlternate: candidate.imageUrl !== group.candidates[0]?.imageUrl,
    };
  }
  return null;
}

async function downloadPoster(candidate: PosterCandidate): Promise<{ localUrl?: string; failedStatus?: string }> {
  const target = cachePathFor(candidate);
  if (fs.existsSync(target.abs)) return { localUrl: target.rel };

  try {
    const response = await axios.get<ArrayBuffer>(normalizeRemotePosterUrl(candidate.imageUrl), {
      responseType: 'arraybuffer',
      maxRedirects: 5,
      timeout: 14000,
      validateStatus: () => true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': getReferer(candidate.imageUrl),
      },
    });
    if (response.status < 200 || response.status >= 300) return { failedStatus: `http-${response.status}` };

    // Some hosts return an HTML error page with image headers. Decoding the
    // bytes is the actual poster verification gate, not Content-Type.
    const input = Buffer.from(response.data as ArrayBuffer);
    const metadata = await sharp(input, { failOn: 'none', animated: false }).metadata();
    if (!metadata.width || !metadata.height || Math.min(metadata.width, metadata.height) < POSTER_MIN_EDGE) {
      return { failedStatus: `invalid-dimensions-${metadata.width || 0}x${metadata.height || 0}` };
    }
    const output = await sharp(input, { failOn: 'none', animated: false })
      .rotate()
      .resize({ width: 760, height: 1100, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer();
    if (output.length < 1024) return { failedStatus: 'poster-output-too-small' };

    fs.mkdirSync(path.dirname(target.abs), { recursive: true });
    fs.writeFileSync(target.abs, output);
    return { localUrl: target.rel };
  } catch (error) {
    return { failedStatus: error instanceof Error ? error.message : String(error) };
  }
}

async function resolvePosterGroup(group: PosterGroup): Promise<PosterOutcome> {
  if (group.candidates.length === 0) {
    return { status: 'unavailable', sourceUrls: [], failure: 'no-poster-candidate' };
  }
  const failures: string[] = [];
  for (let index = 0; index < group.candidates.length; index += 1) {
    const candidate = group.candidates[index];
    const result = await downloadPoster(candidate);
    if (result.localUrl) {
      return {
        status: 'verified',
        localUrl: result.localUrl,
        sourceUrls: [...group.candidateUrls],
        recoveredFromAlternate: index > 0,
      };
    }
    failures.push(result.failedStatus || 'download-failed');
  }
  return {
    status: 'unavailable',
    sourceUrls: [...group.candidateUrls],
    failure: failures.slice(0, 3).join(', '),
  };
}

function applyPosterOutcome(record: PosterRecord, outcome: PosterOutcome, checkedAt: string) {
  const next = record as Record<string, JsonValue>;
  const previous = JSON.stringify(record);
  next.posterSourceUrls = outcome.sourceUrls;
  next.posterStatus = outcome.status;
  next.posterCheckedAt = checkedAt;

  if (outcome.status === 'verified' && outcome.localUrl) {
    // A verified local copy is canonical. Replacing every display fallback
    // prevents the client from reviving a stale remote URL later.
    next.image = outcome.localUrl;
    next.poster = outcome.localUrl;
    next.posterUrl = outcome.localUrl;
    next.backupPoster = outcome.localUrl;
  } else {
    // Keep source candidates for the next retry, but never expose a known-
    // broken remote URL to the browser.
    next.image = '';
    next.poster = '';
    next.posterUrl = '';
    next.backupPoster = '';
  }

  return JSON.stringify(record) !== previous;
}

function rewritePublicData(outcomes: Map<string, PosterOutcome>, checkedAt: string) {
  let changedFiles = 0;
  let changedObjects = 0;
  for (const file of collectJsonFiles(DATA_DIR)) {
    if (!shouldRewriteDataFile(file)) continue;
    const raw = fs.readFileSync(file, 'utf8');
    const data = loadJson(file);
    if (!data) continue;
    let changed = false;
    walk(data, (object) => {
      if (!isPerformanceRecord(object)) return;
      const outcome = outcomes.get(object.id);
      if (outcome && applyPosterOutcome(object as PosterRecord, outcome, checkedAt)) {
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

function writeReport(groups: PosterGroup[], outcomes: Map<string, PosterOutcome>, checkedAt: string) {
  const values = [...outcomes.entries()];
  const report = {
    version: 1,
    checkedAt,
    policy: 'verified-local-poster-or-exclude',
    total: groups.length,
    verified: values.filter(([, outcome]) => outcome.status === 'verified').length,
    unavailable: values.filter(([, outcome]) => outcome.status === 'unavailable').length,
    pending: values.filter(([, outcome]) => outcome.status === 'pending').length,
    recoveredFromAlternate: values.filter(([, outcome]) => outcome.recoveredFromAlternate).length,
    unavailableSamples: groups
      .filter((group) => outcomes.get(group.id)?.status === 'unavailable')
      .slice(0, 100)
      .map((group) => ({
        id: group.id,
        title: group.title,
        source: group.source,
        candidates: group.candidates.map((candidate) => candidate.imageUrl),
        failure: outcomes.get(group.id)?.failure || 'unavailable',
      })),
    pendingSamples: groups
      .filter((group) => outcomes.get(group.id)?.status === 'pending')
      .slice(0, 100)
      .map((group) => ({ id: group.id, title: group.title, source: group.source })),
  };
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  return report;
}

async function main() {
  const checkedAt = new Date().toISOString();
  const visibleIds = collectVisibleIds();
  const groups = collectPosterGroups(visibleIds);
  const cacheIndex = buildExistingCacheIndex();
  const outcomes = new Map<string, PosterOutcome>();
  const unresolved: PosterGroup[] = [];

  for (const group of groups) {
    const existing = findExistingPoster(group, cacheIndex);
    if (existing) outcomes.set(group.id, existing);
    else unresolved.push(group);
  }

  const toDownload = unresolved.slice(0, MAX_NEW_DOWNLOADS);
  const deferred = unresolved.slice(MAX_NEW_DOWNLOADS);
  console.log(`[poster-cache] visible ids: ${visibleIds.size}`);
  console.log(`[poster-cache] groups: ${groups.length}, verified cache: ${outcomes.size}, download: ${toDownload.length}, deferred: ${deferred.length}`);
  if (DRY_RUN) {
    console.log('[poster-cache] dry run: no files or public data were changed');
    return;
  }

  const limit = pLimit(CONCURRENCY);
  await Promise.all(toDownload.map((group) => limit(async () => {
    const outcome = await resolvePosterGroup(group);
    outcomes.set(group.id, outcome);
    if (outcome.status === 'unavailable') {
      console.warn(`[poster-cache] unavailable ${group.id} ${group.title} (${outcome.failure})`);
    }
  })));

  for (const group of deferred) {
    outcomes.set(group.id, {
      status: 'pending',
      sourceUrls: [...group.candidateUrls],
      failure: 'deferred-by-download-limit',
    });
  }

  const rewrite = rewritePublicData(outcomes, checkedAt);
  const report = writeReport(groups, outcomes, checkedAt);
  console.log(`[poster-cache] verified: ${report.verified}, alternate recovery: ${report.recoveredFromAlternate}, unavailable: ${report.unavailable}, pending: ${report.pending}`);
  console.log(`[poster-cache] rewrite files: ${rewrite.changedFiles}, objects: ${rewrite.changedObjects}`);
}

main().catch((error) => {
  console.error('[poster-cache] fatal:', error);
  process.exit(1);
});
