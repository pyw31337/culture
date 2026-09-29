import fs from 'fs';
import path from 'path';
import { isPerformanceRecord, isLocalPosterUrl, type PosterRecord } from './lib/poster-integrity';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type JsonObject = { [key: string]: JsonValue };

const ROOT = process.cwd();
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const REPORT_PATH = path.join(DATA_DIR, 'poster-integrity-report.json');

function isObject(value: JsonValue): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function walk(value: JsonValue, visitor: (object: JsonObject) => void) {
  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, visitor));
    return;
  }
  if (!isObject(value)) return;
  visitor(value);
  Object.values(value).forEach((child) => walk(child, visitor));
}

function collectJsonFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectJsonFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'poster-integrity-report.json') files.push(full);
  }
  return files;
}

function readJson(file: string): JsonValue {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as JsonValue;
}

function main() {
  if (!fs.existsSync(REPORT_PATH)) {
    throw new Error('poster integrity report is missing; run npm run cache:posters before publishing');
  }
  const report = readJson(REPORT_PATH) as Record<string, unknown>;
  if (report.policy !== 'verified-local-poster-or-exclude' || typeof report.checkedAt !== 'string') {
    throw new Error('poster integrity report is malformed or from an incompatible cache run');
  }

  const invalid: string[] = [];
  const statusCounts = new Map<string, number>();
  const seenIds = new Set<string>();
  for (const file of collectJsonFiles(DATA_DIR)) {
    const data = readJson(file);
    walk(data, (object) => {
      if (!isPerformanceRecord(object)) return;
      const record = object as PosterRecord;
      const id = String(record.id);
      if (seenIds.has(id)) return;
      seenIds.add(id);
      const status = typeof record.posterStatus === 'string' ? record.posterStatus : 'missing';
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1);

      if (status === 'verified') {
        if (!isLocalPosterUrl(record.image) || !fs.existsSync(path.join(PUBLIC_DIR, record.image))) {
          invalid.push(`${id}: verified record has no local poster`);
        }
        return;
      }
      if (status === 'unavailable' || status === 'pending') {
        if (record.image || record.poster || record.posterUrl || record.backupPoster) {
          invalid.push(`${id}: excluded record still exposes a display poster URL`);
        }
        return;
      }
      invalid.push(`${id}: missing recognized poster status`);
    });
  }

  if (invalid.length > 0) {
    throw new Error(`poster integrity validation failed for ${invalid.length} record(s):\n${invalid.slice(0, 30).join('\n')}`);
  }
  console.log(`[poster-integrity] valid ${seenIds.size} records (${[...statusCounts.entries()].map(([status, count]) => `${status}: ${count}`).join(', ')})`);
}

try {
  main();
} catch (error) {
  console.error('[poster-integrity] failed:', error instanceof Error ? error.message : error);
  process.exit(1);
}
